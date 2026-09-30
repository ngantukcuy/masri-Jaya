-- =============================================================================
-- Keamanan login (PIN di-hash, kunci permanen setelah 5x salah) + notifikasi
-- =============================================================================
-- Jalankan SETELAH schema.sql (dan migrate_from_legacy.sql kalau dipakai).
-- Aman diulang.
--
-- 1) PIN tidak lagi disimpan/terbaca di tabel biasa. PIN di-hash (bcrypt) di
--    tabel staff_credentials yang TIDAK bisa dibaca aplikasi — cuma bisa
--    diperiksa lewat fungsi verify_login().
-- 2) 5x PIN salah -> akun terkunci PERMANEN (tanpa hitungan mundur) sampai
--    Owner membukanya (unlock_login) atau Owner reset lewat link email.
-- 3) Semua kejadian penting masuk ke tabel notification_events lewat trigger.
--    Satu Database Webhook di tabel itu -> edge function send-push.
-- =============================================================================
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set client_min_messages = warning;

-- ---------------------------------------------------------------- tabel
create table if not exists public.staff_credentials (
  staff_id   text primary key references public.staff_list(id) on update cascade on delete cascade,
  pin_hash   text not null,
  changed_at timestamptz not null default now()
);
create table if not exists public.login_lockouts (
  staff_id        text primary key references public.staff_list(id) on update cascade on delete cascade,
  attempts        integer not null default 0,
  locked          boolean not null default false,
  locked_at       timestamptz,
  last_attempt_at timestamptz
);
create table if not exists public.notification_events (
  id         bigint generated always as identity primary key,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  roles      text[] not null default array['Owner'],
  created_at timestamptz not null default now()
);
create index if not exists notification_events_created_idx on public.notification_events (created_at desc);

alter table public.staff_credentials  enable row level security;   -- tanpa policy = tertutup
alter table public.login_lockouts     enable row level security;   -- tanpa policy = tertutup
alter table public.notification_events enable row level security;
drop policy if exists notification_events_select on public.notification_events;
create policy notification_events_select on public.notification_events for select to authenticated using (true);
revoke all on public.staff_credentials, public.login_lockouts from anon, authenticated;
revoke all on public.notification_events from anon, authenticated;
grant select on public.notification_events to authenticated;
grant all on public.staff_credentials, public.login_lockouts, public.notification_events to service_role;

-- ------------------------------------------------- pindahin PIN lama (kalau ada)
do $$
begin
  -- a) kolom pin di staff_list (skema v3 awal)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff_list' and column_name='pin') then
    insert into public.staff_credentials (staff_id, pin_hash)
    select id, extensions.crypt(pin, extensions.gen_salt('bf')) from public.staff_list
    where pin is not null and pin <> '' and pin not like '$2%'
    on conflict (staff_id) do nothing;
    alter table public.staff_list drop column pin;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='store_profile' and column_name='pin') then
    alter table public.store_profile drop column pin;
  end if;
  -- b) tabel legacy (key/data JSON)
  if to_regclass('public.legacy_staff_list') is not null then
    insert into public.staff_credentials (staff_id, pin_hash)
    select l.key, extensions.crypt(l.data->>'pin', extensions.gen_salt('bf'))
    from public.legacy_staff_list l
    where coalesce(l.data->>'pin','') <> ''
      and exists (select 1 from public.staff_list s where s.id = l.key)
    on conflict (staff_id) do nothing;
  end if;
end $$;

-- --------------------------------------------------------------- helper notif
create or replace function public._notify(p_kind text, p_title text, p_body text, p_roles text[])
returns void language sql security definer set search_path = public as $$
  insert into public.notification_events (kind, title, body, roles) values (p_kind, p_title, p_body, p_roles);
$$;
revoke all on function public._notify(text, text, text, text[]) from public, anon, authenticated;

create or replace function public._rp(n numeric) returns text language sql immutable as $$
  select 'Rp ' || replace(to_char(coalesce(n,0), 'FM999G999G999G999'), ',', '.');
$$;

-- ---------------------------------------------------------------- login
create or replace function public._owner_id() returns text language sql stable security definer set search_path = public as $$
  select id from public.staff_list where role = 'Owner' order by id limit 1;
$$;
revoke all on function public._owner_id() from public, anon, authenticated;

-- Inti pemeriksaan PIN: hitung percobaan, kunci di percobaan ke-5.
create or replace function public._attempt(p_staff_id text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text; v_role text; v_hash text; v_lock public.login_lockouts; v_left int;
  c_max constant int := 5;
begin
  select name, role into v_name, v_role from public.staff_list where id = p_staff_id;
  if not found then return jsonb_build_object('status', 'unknown'); end if;

  insert into public.login_lockouts (staff_id) values (p_staff_id) on conflict do nothing;
  select * into v_lock from public.login_lockouts where staff_id = p_staff_id for update;
  if v_lock.locked then
    return jsonb_build_object('status', 'locked', 'attemptsLeft', 0);
  end if;

  select pin_hash into v_hash from public.staff_credentials where staff_id = p_staff_id;
  if v_hash is null then return jsonb_build_object('status', 'no_pin'); end if;

  if p_pin is not null and crypt(p_pin, v_hash) = v_hash then
    update public.login_lockouts set attempts = 0, last_attempt_at = now() where staff_id = p_staff_id;
    return jsonb_build_object('status', 'ok', 'role', v_role, 'name', v_name);
  end if;

  update public.login_lockouts
     set attempts = attempts + 1, last_attempt_at = now(),
         locked = (attempts + 1 >= c_max),
         locked_at = case when attempts + 1 >= c_max then now() else locked_at end
   where staff_id = p_staff_id
   returning c_max - attempts into v_left;

  if v_left <= 0 then
    perform public._notify('login_locked', 'Akun terkunci: ' || v_name,
      'PIN salah ' || c_max || 'x berturut-turut. Akun dikunci sampai Owner membukanya.',
      array['Owner', 'Admin']);
    return jsonb_build_object('status', 'locked', 'attemptsLeft', 0);
  end if;

  perform public._notify('login_failed', 'Percobaan login gagal: ' || v_name,
    'PIN salah (percobaan ke-' || (c_max - v_left) || ' dari ' || c_max || ').',
    array['Owner']);
  return jsonb_build_object('status', 'wrong', 'attemptsLeft', v_left);
end;
$$;
revoke all on function public._attempt(text, text) from public, anon, authenticated;

create or replace function public.verify_login(p_staff_id text, p_pin text)
returns jsonb language sql security definer set search_path = public as $$
  select public._attempt(p_staff_id, p_pin);
$$;

-- Daftar akun yang sedang terkunci (buat tampilan layar login)
create or replace function public.get_locked_staff()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(staff_id), '{}') from public.login_lockouts where locked;
$$;

-- Owner membuka kunci akun (staf atau Owner lain) — wajib PIN Owner yang benar.
create or replace function public.unlock_login(p_owner_pin text, p_target_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; v_owner text := public._owner_id(); v_name text;
begin
  if v_owner is null then return jsonb_build_object('status', 'unknown'); end if;
  if p_target_id = v_owner then
    return jsonb_build_object('status', 'forbidden'); -- akun Owner hanya bisa dibuka lewat link email
  end if;
  r := public._attempt(v_owner, p_owner_pin);
  if r->>'status' <> 'ok' then return r; end if;
  update public.login_lockouts set attempts = 0, locked = false, locked_at = null where staff_id = p_target_id;
  select name into v_name from public.staff_list where id = p_target_id;
  perform public._notify('login_unlocked', 'Akun dibuka: ' || coalesce(v_name, p_target_id), 'Owner membuka kunci akun.', array['Owner']);
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Atur/ubah PIN. Owner boleh mengubah PIN siapa pun (wajib PIN Owner). Akun yang
-- belum punya PIN sama sekali (akun baru / registrasi toko) boleh diberi PIN awal.
create or replace function public.set_pin(p_owner_pin text, p_target_id text, p_new_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; v_owner text := public._owner_id(); v_has boolean; v_owner_has boolean; v_name text;
begin
  if p_new_pin is null or p_new_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('status', 'invalid_pin');
  end if;
  select name into v_name from public.staff_list where id = p_target_id;
  if v_name is null then return jsonb_build_object('status', 'unknown'); end if;
  select exists(select 1 from public.staff_credentials where staff_id = p_target_id) into v_has;
  select exists(select 1 from public.staff_credentials where staff_id = v_owner) into v_owner_has;

  -- PIN awal: akun belum punya PIN. Untuk akun selain Owner pertama, tetap minta PIN Owner.
  if not (not v_has and (p_target_id = v_owner or not v_owner_has)) then
    r := public._attempt(v_owner, p_owner_pin);
    if r->>'status' <> 'ok' then return r; end if;
  end if;

  insert into public.staff_credentials (staff_id, pin_hash, changed_at)
  values (p_target_id, crypt(p_new_pin, gen_salt('bf')), now())
  on conflict (staff_id) do update set pin_hash = excluded.pin_hash, changed_at = now();
  if v_has then
    perform public._notify('pin_changed', 'PIN diubah: ' || v_name, 'PIN akun ini diganti.', array['Owner']);
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Lupa PIN Owner: dipanggil setelah Owner klik link di email (sesi Supabase Auth
-- non-anonim dengan email yang sama dengan email toko). Mengganti PIN Owner &
-- membuka kuncinya.
create or replace function public.reset_owner_pin_via_email(p_new_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_email text; v_jwt jsonb; v_owner text := public._owner_id();
begin
  v_jwt := coalesce(auth.jwt(), '{}'::jsonb);
  select lower(email) into v_email from public.store_profile where id = 'main';
  if v_email is null or v_email = '' or lower(coalesce(v_jwt->>'email','')) <> v_email
     or coalesce((v_jwt->>'is_anonymous')::boolean, false) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{6}$' then return jsonb_build_object('status', 'invalid_pin'); end if;
  if v_owner is null then return jsonb_build_object('status', 'unknown'); end if;
  insert into public.staff_credentials (staff_id, pin_hash, changed_at)
  values (v_owner, crypt(p_new_pin, gen_salt('bf')), now())
  on conflict (staff_id) do update set pin_hash = excluded.pin_hash, changed_at = now();
  insert into public.login_lockouts (staff_id, attempts, locked) values (v_owner, 0, false)
  on conflict (staff_id) do update set attempts = 0, locked = false, locked_at = null;
  perform public._notify('pin_reset', 'PIN Owner direset lewat email', 'PIN Owner diganti lewat link reset di email.', array['Owner', 'Admin']);
  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.verify_login(text, text) to authenticated;
grant execute on function public.get_locked_staff() to authenticated;
grant execute on function public.unlock_login(text, text) to authenticated;
grant execute on function public.set_pin(text, text, text) to authenticated;
grant execute on function public.reset_owner_pin_via_email(text) to authenticated;

-- ------------------------------------------------------ trigger notifikasi
-- 1) Stok menipis / habis (saat MELEWATI batas, bukan tiap kali stok berubah)
create or replace function public.trg_notify_stock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock is null or old.stock is null then return new; end if;
  if new.stock <= 0 and old.stock > 0 then
    perform public._notify('stock_out', 'Stok habis: ' || new.name, 'SKU ' || new.sku || ' sudah 0.', array['Owner','Admin','Stoker']);
  elsif coalesce(new.show_low_stock_alert, false) and coalesce(new.min_stock_qty, 0) > 0
        and new.stock <= new.min_stock_qty and old.stock > new.min_stock_qty then
    perform public._notify('stock_low', 'Stok menipis: ' || new.name,
      'Sisa ' || new.stock || ' ' || coalesce(new.unit, '') || ' (batas ' || new.min_stock_qty || ').', array['Owner','Admin','Stoker']);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_stock on public.products;
create trigger trg_notify_stock after update of stock on public.products for each row execute function public.trg_notify_stock();

-- 2) Transaksi baru + permintaan hapus transaksi
create or replace function public.trg_notify_invoice() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._notify('sale_new', 'Transaksi baru ' || new.invoice_number,
      public._rp(new.total) || ' · ' || coalesce(new.payment_method, '-') || coalesce(' · ' || nullif(new.customer_name, ''), ''), array['Owner','Admin']);
  elsif new.deletion_status = 'Pending' and coalesce(old.deletion_status, '') <> 'Pending' then
    perform public._notify('approval_delete_sale', 'Permintaan hapus transaksi ' || new.invoice_number,
      public._rp(new.total) || ' menunggu persetujuan.', array['Owner','Admin']);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_invoice on public.sales_invoices;
create trigger trg_notify_invoice after insert or update of deletion_status on public.sales_invoices for each row execute function public.trg_notify_invoice();

-- 3) Retur
create or replace function public.trg_notify_return() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._notify(case when new.status = 'Pending' then 'approval_return' else 'return_new' end,
      case when new.status = 'Pending' then 'Retur menunggu persetujuan' else 'Retur baru' end,
      coalesce(new.type, '') || ' ' || coalesce(new.ref_number, new.id) || ' · ' || coalesce(new.party_name, '-') || ' · ' || public._rp(new.total_refund),
      array['Owner','Admin']);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_return on public.returns;
create trigger trg_notify_return after insert on public.returns for each row execute function public.trg_notify_return();

-- 4) Pengajuan stok opname (barang masuk/keluar) & pengeluaran butuh persetujuan Owner
create or replace function public.trg_notify_opname() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Pending' then
    perform public._notify('approval_stock', case when new.type = 'add' then 'Persetujuan barang masuk' else 'Persetujuan barang keluar' end,
      coalesce(new.product_name, new.product_sku) || ' · ' || new.amount || ' oleh ' || coalesce(new.submitted_by, '-'), array['Owner','Admin']);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_opname on public.opname_submissions;
create trigger trg_notify_opname after insert on public.opname_submissions for each row execute function public.trg_notify_opname();

create or replace function public.trg_notify_expense() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Pending' then
    perform public._notify('approval_expense', 'Pengeluaran menunggu persetujuan',
      coalesce(new.category, '') || ' · ' || public._rp(new.amount) || ' oleh ' || coalesce(new.submitted_by, '-'), array['Owner','Admin']);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_expense on public.expenses;
create trigger trg_notify_expense after insert on public.expenses for each row execute function public.trg_notify_expense();

-- 5) PO baru, PO diterima, pembayaran hutang supplier
create or replace function public.trg_notify_po() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._notify('po_new', 'PO baru ' || new.po_number,
      coalesce(new.supplier, '-') || ' · ' || public._rp(new.total), array['Owner','Admin','Stoker']);
  else
    if new.status = 'Received' and coalesce(old.status, '') <> 'Received' then
      perform public._notify('po_received', 'PO diterima ' || new.po_number, coalesce(new.supplier, '-'), array['Owner','Admin','Stoker']);
    end if;
    if coalesce(new.paid_amount, 0) > coalesce(old.paid_amount, 0) then
      perform public._notify('debt_paid_supplier', 'Pembayaran hutang supplier',
        coalesce(new.supplier, '-') || ' · ' || new.po_number || ' · ' || public._rp(new.paid_amount - coalesce(old.paid_amount, 0)), array['Owner','Admin']);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_po on public.purchase_orders;
create trigger trg_notify_po after insert or update of status, paid_amount on public.purchase_orders for each row execute function public.trg_notify_po();

-- 6) Deposit, penarikan deposit & pelunasan piutang pelanggan — dicatat aplikasi
--    sebagai baris `activities`, jadi cukup dipantau dari sana.
create or replace function public.trg_notify_activity() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.title like 'Top Up Deposit%' then
    perform public._notify('deposit_topup', new.title, new.subtitle, array['Owner','Admin']);
  elsif new.title like 'Penarikan Deposit%' then
    perform public._notify('deposit_withdraw', new.title, new.subtitle, array['Owner','Admin']);
  elsif new.title like 'Pelunasan Piutang%' or new.title like 'Pembayaran Piutang%' then
    perform public._notify('debt_paid_customer', new.title, new.subtitle, array['Owner','Admin']);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_activity on public.activities;
create trigger trg_notify_activity after insert on public.activities for each row execute function public.trg_notify_activity();

-- 7) Kas harian: buka & tutup (dengan selisih)
create or replace function public.trg_notify_cash() returns trigger language plpgsql security definer set search_path = public as $$
declare v_in numeric; v_out numeric; v_expected numeric; v_diff numeric;
begin
  if tg_op = 'INSERT' and new.status = 'Open' then
    perform public._notify('cash_open', 'Kas harian dibuka', coalesce(new.cashier_name, 'Kasir') || ' · modal ' || public._rp(new.opening_balance), array['Owner']);
  elsif tg_op = 'UPDATE' and new.status = 'Closed' and old.status = 'Open' then
    select coalesce(sum(amount) filter (where type = 'in'), 0), coalesce(sum(amount) filter (where type = 'out'), 0)
      into v_in, v_out from public.cash_mutations where parent_key = new.id;
    v_expected := coalesce(new.opening_balance, 0) + v_in - v_out;
    v_diff := coalesce(new.closing_actual, 0) - v_expected;
    perform public._notify(case when v_diff <> 0 then 'cash_diff' else 'cash_close' end,
      case when v_diff <> 0 then 'Kas harian ditutup — ada selisih' else 'Kas harian ditutup' end,
      'Seharusnya ' || public._rp(v_expected) || ', uang di laci ' || public._rp(new.closing_actual)
        || case when v_diff <> 0 then ' (selisih ' || public._rp(v_diff) || ')' else '' end, array['Owner']);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_cash on public.cash_sessions;
create trigger trg_notify_cash after insert or update of status on public.cash_sessions for each row execute function public.trg_notify_cash();

grant usage on schema public to authenticated;
