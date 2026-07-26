-- =============================================================================
-- Tokku POS — Supabase schema (v2: satu tabel per entitas)
-- =============================================================================
-- Jalankan seluruh file ini sekali lewat Supabase Dashboard > SQL Editor > New
-- query > Run. Aman dijalankan berkali-kali (idempotent).
--
-- Desain: setiap jenis data (produk, pelanggan, invoice, dst) punya TABEL
-- SENDIRI — bukan satu tabel generik buat semuanya. Tiap tabel punya bentuk
-- yang sama secara sengaja:
--   key         text primary key   -- identifier alami entitas itu (lihat
--                                     peta di bawah — sku untuk produk,
--                                     invoiceNumber untuk invoice, id untuk
--                                     yang lain, dst — persis field yang
--                                     SUDAH dipakai app buat mengenali baris
--                                     itu, bukan kolom baru)
--   data        jsonb              -- sisa field entitas itu apa adanya
--   created_at  timestamptz
--   updated_at  timestamptz
--
-- Kenapa bukan kolom per-field yang sepenuhnya dinormalisasi (mis. kolom
-- `name`, `stock`, `price` sendiri-sendiri untuk produk)? Beberapa entitas
-- (invoice, PO, retur) punya array line-item bersarang yang secara alami
-- jadi JSON, dan field di TypeScript-nya bisa berubah tanpa perlu migrasi
-- SQL tiap kali. `key` sebagai kolom sungguhan (bukan terkubur dalam JSON)
-- sudah cukup buat index/lookup/relasi cepat, realtime per-baris, dan query
-- SQL langsung dari SQL Editor kalau perlu.
--
-- Peta "key" per tabel (dipakai oleh frontend/src/lib/useSupabaseTable.ts):
--   products            -> sku
--   purchase_orders     -> poNumber
--   customers           -> id
--   suppliers           -> name
--   expenses            -> id
--   activities          -> id
--   branches            -> name
--   sales_invoices      -> invoiceNumber
--   returns             -> id
--   digital_orders      -> id
--   banners             -> id
--   sku_locations       -> id
--   staff_list          -> id
--   bank_accounts       -> id
--   printers            -> id
--   opname_submissions  -> id
--   product_categories  -> id
--   product_brands      -> id
--   product_units       -> id
--   product_bundles     -> id
--
-- Data yang BUKAN daftar/list (cuma satu nilai tunggal per toko: profil
-- owner yang lagi login, username e-commerce, counter total penjualan, sesi
-- kas yang lagi jalan, riwayat sesi kas, draft keranjang POS) juga punya
-- tabelnya masing-masing (lihat bagian 2 di bawah) — satu baris tetap
-- (id = 1) per tabel, bukan satu tabel key-value generik buat semuanya.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Fungsi bersama buat auto-update kolom updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1) Tabel per entitas — dibuat lewat loop biar konsisten (RLS, grant,
--    trigger, dan realtime-nya identik untuk semua tabel di bawah ini)
-- -----------------------------------------------------------------------------
do $$
declare
  entity_tables text[] := array[
    'products', 'purchase_orders', 'customers', 'suppliers', 'expenses',
    'activities', 'branches', 'sales_invoices', 'returns', 'digital_orders',
    'banners', 'sku_locations', 'staff_list', 'bank_accounts', 'printers',
    'opname_submissions', 'product_categories', 'product_brands',
    'product_units', 'product_bundles'
  ];
  t text;
begin
  foreach t in array entity_tables loop
    execute format($f$
      create table if not exists public.%1$I (
        key         text primary key,
        data        jsonb not null,
        created_at  timestamptz not null default now(),
        updated_at  timestamptz not null default now()
      );
    $f$, t);

    execute format('drop trigger if exists trg_%1$I_updated_at on public.%1$I;', t);
    execute format($f$
      create trigger trg_%1$I_updated_at
      before update on public.%1$I
      for each row execute function public.set_row_updated_at();
    $f$, t);

    -- RLS: sama seperti sebelumnya, cukup "user yang signed-in" (termasuk
    -- anonymous sign-in) — belum role-based per user. Lihat catatan di
    -- SUPABASE_SETUP.md soal ini sebelum production multi-toko.
    execute format('alter table public.%1$I enable row level security;', t);

    execute format('drop policy if exists "%1$s_select_authenticated" on public.%1$I;', t);
    execute format($f$create policy "%1$s_select_authenticated" on public.%1$I for select to authenticated using (true);$f$, t);

    execute format('drop policy if exists "%1$s_insert_authenticated" on public.%1$I;', t);
    execute format($f$create policy "%1$s_insert_authenticated" on public.%1$I for insert to authenticated with check (true);$f$, t);

    execute format('drop policy if exists "%1$s_update_authenticated" on public.%1$I;', t);
    execute format($f$create policy "%1$s_update_authenticated" on public.%1$I for update to authenticated using (true) with check (true);$f$, t);

    execute format('drop policy if exists "%1$s_delete_authenticated" on public.%1$I;', t);
    execute format($f$create policy "%1$s_delete_authenticated" on public.%1$I for delete to authenticated using (true);$f$, t);

    -- Grant eksplisit ke Data API (PostgREST/supabase-js) — sejak
    -- pertengahan 2026, project Supabase baru gak lagi otomatis expose tabel
    -- baru di schema public walau RLS-nya udah benar.
    -- Ref: https://github.com/orgs/supabase/discussions/45329
    execute format('grant select, insert, update, delete on public.%1$I to authenticated;', t);
    execute format('grant select, insert, update, delete on public.%1$I to service_role;', t);

    -- Realtime — biar tiap tab/device lain langsung dapat perubahan per-baris.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%1$I;', t);
    end if;
  end loop;
end $$;

grant usage on schema public to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Tabel singleton — satu tabel per nilai tunggal (bukan daftar), masing-
--    masing dikunci ke SATU baris lewat `id smallint primary key default 1
--    check (id = 1)`. Sebelumnya semua nilai ini numpuk di satu tabel
--    generik `app_settings` (key/value) — sekarang tiap nilai punya
--    tabelnya sendiri, konsisten dengan tabel per-entitas di atas.
--    Dipakai oleh frontend/src/lib/useSupabaseState.ts (registeredOwner,
--    ecommerceUsername, totalSales, totalOrdersCount) dan
--    frontend/src/lib/supabaseCache.ts (cashSessionCurrent,
--    cashSessionHistory, posCartState).
--
--    Peta value -> tabel:
--      registeredOwner      -> store_owner
--      ecommerceUsername    -> ecommerce_username
--      totalSales           -> total_sales
--      totalOrdersCount     -> total_orders_count
--      cashSessionCurrent   -> cash_session_current
--      cashSessionHistory   -> cash_session_history
--      posCartState         -> pos_cart_state
-- -----------------------------------------------------------------------------
do $$
declare
  singleton_tables text[] := array[
    'store_owner', 'ecommerce_username', 'total_sales', 'total_orders_count',
    'cash_session_current', 'cash_session_history', 'pos_cart_state'
  ];
  t text;
begin
  foreach t in array singleton_tables loop
    execute format($f$
      create table if not exists public.%1$I (
        id          smallint primary key default 1 check (id = 1),
        value       jsonb not null,
        updated_at  timestamptz not null default now()
      );
    $f$, t);

    execute format('drop trigger if exists trg_%1$I_updated_at on public.%1$I;', t);
    execute format($f$
      create trigger trg_%1$I_updated_at
      before update on public.%1$I
      for each row execute function public.set_row_updated_at();
    $f$, t);

    execute format('alter table public.%1$I enable row level security;', t);

    execute format('drop policy if exists "%1$s_select_authenticated" on public.%1$I;', t);
    execute format($f$create policy "%1$s_select_authenticated" on public.%1$I for select to authenticated using (true);$f$, t);

    execute format('drop policy if exists "%1$s_insert_authenticated" on public.%1$I;', t);
    execute format($f$create policy "%1$s_insert_authenticated" on public.%1$I for insert to authenticated with check (true);$f$, t);

    execute format('drop policy if exists "%1$s_update_authenticated" on public.%1$I;', t);
    execute format($f$create policy "%1$s_update_authenticated" on public.%1$I for update to authenticated using (true) with check (true);$f$, t);

    execute format('drop policy if exists "%1$s_delete_authenticated" on public.%1$I;', t);
    execute format($f$create policy "%1$s_delete_authenticated" on public.%1$I for delete to authenticated using (true);$f$, t);

    execute format('grant select, insert, update, delete on public.%1$I to authenticated;', t);
    execute format('grant select, insert, update, delete on public.%1$I to service_role;', t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%1$I;', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3) Storage bucket buat foto produk (tidak berubah)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit     = excluded.file_size_limit,
  allowed_mime_types  = excluded.allowed_mime_types;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'product-images');

drop policy if exists "product_images_authenticated_upload" on storage.objects;
create policy "product_images_authenticated_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images');

drop policy if exists "product_images_authenticated_update" on storage.objects;
create policy "product_images_authenticated_update"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

drop policy if exists "product_images_authenticated_delete" on storage.objects;
create policy "product_images_authenticated_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images');

-- =============================================================================
-- MIGRASI DARI SKEMA LAMA (kalau kamu sebelumnya sudah pernah menjalankan versi
-- 1-tabel dan sudah ada data beneran di `tokku_state`, atau versi generik
-- `app_settings`): tabel lama dibiarkan apa adanya di bawah (TIDAK dihapus
-- otomatis, biar data lama gak hilang kalau tanpa sengaja run ulang) —
-- pindahkan datanya manual per key ke tabel singleton barunya di atas
-- (lihat peta value -> tabel di bagian 2), baru drop:
--   drop table if exists public.tokku_state;
--   drop table if exists public.app_settings;
-- =============================================================================
