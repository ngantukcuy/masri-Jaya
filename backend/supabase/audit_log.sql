-- =============================================================================
-- Tokku POS — Audit log (siapa mengubah apa)
-- =============================================================================
-- Jalankan file ini SEKALI lewat Supabase Dashboard > SQL Editor > New query >
-- Run, setelah schema.sql sudah pernah dijalankan. Aman dijalankan berkali-kali
-- (idempotent), sama seperti schema.sql.
--
-- Yang dibikin:
--   1) Tabel `audit_log` — satu baris per perubahan (INSERT/UPDATE/DELETE) di
--      SEMUA tabel bisnis (produk, transaksi, pelanggan, PO, staff, dst).
--   2) Trigger generik yang otomatis nyatet ke `audit_log` tiap ada
--      perubahan — gak perlu ubah kode aplikasi tiap ada fitur baru.
--   3) Nama staf yang login (`actor_name`) ikut kecatet, dikirim otomatis
--      dari browser lewat header `X-Actor-Name` (lihat frontend/src/lib/
--      supabase.ts) — soalnya semua staf berbagi satu sesi anonymous
--      Supabase yang sama, jadi Postgres sendiri gak bisa tau siapa yang
--      login tanpa bantuan ini.
--   4) PIN staff/owner OTOMATIS disamarkan ("[REDACTED]") sebelum disimpan
--      ke audit_log, walau kolom `pin`-nya berubah — audit log ini nantinya
--      bisa dilihat banyak Owner/Admin, jadi PIN gak boleh ikut kebaca di situ.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabel audit_log
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  row_key     text,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  actor_name  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_table_name_idx on public.audit_log (table_name);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_row_key_idx on public.audit_log (row_key);

alter table public.audit_log enable row level security;

-- Cuma bisa dibaca dari aplikasi (untuk ditampilkan di halaman viewer) —
-- gak pernah ditulis langsung dari aplikasi, cuma lewat trigger di bawah.
drop policy if exists "audit_log_select_authenticated" on public.audit_log;
create policy "audit_log_select_authenticated" on public.audit_log for select to authenticated using (true);

grant select on public.audit_log to authenticated;
grant select, insert on public.audit_log to service_role;
grant usage, select on sequence public.audit_log_id_seq to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2) Helper: samarkan field `pin` di dalam kolom data/value bersarang
-- -----------------------------------------------------------------------------
create or replace function public.audit_redact_pin(row_json jsonb, col text)
returns jsonb
language sql
immutable
as $$
  select case
    when row_json is null then null
    when row_json -> col ? 'pin' then jsonb_set(row_json, array[col, 'pin'], '"[REDACTED]"'::jsonb)
    else row_json
  end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Fungsi trigger generik — dipasang ke semua tabel di bagian 4
-- -----------------------------------------------------------------------------
create or replace function public.audit_log_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
  new_json jsonb;
  old_json jsonb;
  key_val text;
begin
  -- Nama staf yang lagi login, dikirim browser lewat header X-Actor-Name.
  -- PostgREST mengekspos semua header request masuk lewat GUC
  -- 'request.headers' (JSON). Kalau headernya gak ada (mis. dipanggil dari
  -- Edge Function/service role tanpa header ini), actor tetap NULL —
  -- bukan error.
  begin
    actor := nullif(current_setting('request.headers', true)::jsonb ->> 'x-actor-name', '');
  exception when others then
    actor := null;
  end;

  new_json := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  old_json := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;

  -- Jangan pernah simpan PIN asli ke log — staff_list & store_owner nyimpen
  -- PIN di dalam kolom `data`/`value`.
  if TG_TABLE_NAME = 'staff_list' then
    new_json := public.audit_redact_pin(new_json, 'data');
    old_json := public.audit_redact_pin(old_json, 'data');
  elsif TG_TABLE_NAME = 'store_owner' then
    new_json := public.audit_redact_pin(new_json, 'value');
    old_json := public.audit_redact_pin(old_json, 'value');
  end if;

  -- Tabel per-entitas pakai kolom `key` (text), tabel singleton pakai `id`
  -- (smallint). Diambil lewat representasi JSON-nya (bukan NEW.key/NEW.id
  -- langsung) supaya satu fungsi ini aman dipasang ke tabel manapun tanpa
  -- peduli kolom PK-nya apa.
  key_val := coalesce(new_json ->> 'key', new_json ->> 'id', old_json ->> 'key', old_json ->> 'id');

  insert into public.audit_log (table_name, row_key, action, old_data, new_data, actor_name)
  values (TG_TABLE_NAME, key_val, TG_OP, old_json, new_json, actor);

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Pasang trigger ke semua tabel bisnis (entitas + singleton)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  all_tables text[] := array[
    -- Tabel per-entitas
    'products', 'purchase_orders', 'customers', 'suppliers', 'expenses',
    'activities', 'branches', 'sales_invoices', 'returns', 'digital_orders',
    'banners', 'sku_locations', 'staff_list', 'bank_accounts', 'printers',
    'opname_submissions', 'product_categories', 'product_brands',
    'product_units', 'product_bundles', 'push_tokens',
    -- Tabel singleton
    'store_owner', 'ecommerce_username', 'total_sales', 'total_orders_count',
    'cash_session_current', 'cash_session_history', 'pos_cart_state',
    'default_customer_id'
  ];
begin
  foreach t in array all_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_%1$I_audit on public.%1$I;', t);
      execute format($f$
        create trigger trg_%1$I_audit
        after insert or update or delete on public.%1$I
        for each row execute function public.audit_log_row_change();
      $f$, t);
    end if;
  end loop;
end $$;
