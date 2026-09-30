// Generator: membaca frontend/src/lib/db/spec.json (SATU sumber kebenaran untuk
// nama tabel & kolom) lalu menulis:
//   - schema.sql              -> tabel per kolom + RLS + realtime + storage
//   - migrate_from_legacy.sql -> pindahin data lama (tabel key/data JSON) ke tabel baru
// Jalankan ulang setiap spec.json berubah:  node backend/supabase/generate-schema.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(here, '../../frontend/src/lib/db/spec.json'), 'utf8'));

const snake = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase();
const q = (s) => `"${s}"`;
const sqlType = { text: 'text', num: 'numeric', bool: 'boolean', json: 'jsonb', 'text[]': 'text[]' };

const colDef = ([field, type]) => `  ${q(snake(field))} ${sqlType[type]}`;

// ---------------------------------------------------------------- schema.sql
const allTables = [];
let out = `-- =============================================================================
-- Tokku POS — Supabase schema v3: TABEL PER KOLOM (bukan JSON key/data lagi)
-- =============================================================================
-- FILE INI DIGENERATE dari frontend/src/lib/db/spec.json oleh
-- backend/supabase/generate-schema.mjs — jangan edit tangan, edit spec.json lalu
-- jalankan ulang generator.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor > Run. Aman diulang.
-- Kalau sebelumnya kamu pakai skema lama (tabel key/data), tabel lamanya otomatis
-- DIGANTI NAMA jadi legacy_<nama> (data TIDAK dihapus). Setelah schema ini jalan,
-- jalankan migrate_from_legacy.sql kalau mau memindahkan data lama.
-- =============================================================================

set client_min_messages = warning;

create or replace function public.set_db_updated_at()
returns trigger language plpgsql as $$
begin
  new.db_updated_at = now();
  return new;
end;
$$;

-- 0) Amankan tabel skema lama (key/data jsonb atau id/value jsonb)
do $$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'data' and c.data_type = 'jsonb'
      and c.table_name not like 'legacy\\_%'
      and c.table_name <> 'audit_log'
  loop
    execute format('alter table public.%I rename to %I', r.table_name, 'legacy_' || r.table_name);
  end loop;
  for r in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'value' and c.data_type = 'jsonb'
      and c.table_name not like 'legacy\\_%'
  loop
    execute format('alter table public.%I rename to %I', r.table_name, 'legacy_' || r.table_name);
  end loop;
end $$;

`;

for (const t of spec.tables) {
  const keyCol = snake(t.key);
  allTables.push(t.table);
  out += `-- ${t.table}\ncreate table if not exists public.${q(t.table)} (\n`;
  out += `  ${q(keyCol)} text primary key${t.singleton ? ` check (${q(keyCol)} = 'main')` : ''},\n`;
  out += t.columns.map(colDef).join(',\n');
  out += `,\n  db_created_at timestamptz not null default now(),\n  db_updated_at timestamptz not null default now()\n);\n`;
  // kolom baru kalau spec bertambah setelah tabel sudah ada
  for (const c of t.columns) {
    out += `alter table public.${q(t.table)} add column if not exists ${colDef(c).trim()};\n`;
  }
  out += `drop trigger if exists trg_${t.table}_db_updated on public.${q(t.table)};\n`;
  out += `create trigger trg_${t.table}_db_updated before update on public.${q(t.table)} for each row execute function public.set_db_updated_at();\n\n`;

  for (const ch of t.children ?? []) {
    allTables.push(ch.table);
    out += `create table if not exists public.${q(ch.table)} (\n`;
    out += `  row_id bigint generated always as identity primary key,\n`;
    out += `  parent_key text not null references public.${q(t.table)}(${q(keyCol)}) on update cascade on delete cascade,\n`;
    out += `  position integer not null default 0,\n`;
    out += ch.columns.map(colDef).join(',\n');
    out += `\n);\n`;
    for (const c of ch.columns) {
      out += `alter table public.${q(ch.table)} add column if not exists ${colDef(c).trim()};\n`;
    }
    out += `create index if not exists ${ch.table}_parent_idx on public.${q(ch.table)} (parent_key, position);\n\n`;
  }
}

// Fungsi atomik: ganti seluruh baris anak (mis. item invoice) dalam SATU transaksi,
// jadi kalau gagal di tengah jalan, item lama tidak hilang setengah-setengah.
const childTables = spec.tables.flatMap((t) => (t.children ?? []).map((c) => c.table));
out += `create or replace function public.replace_children(p_table text, p_parent_keys text[], p_rows jsonb)
returns void
language plpgsql
as $fn$
declare cols text;
begin
  if p_table <> all (array[${childTables.map((c) => `'${c}'`).join(', ')}]) then
    raise exception 'replace_children: tabel % tidak diizinkan', p_table;
  end if;
  execute format('delete from public.%I where parent_key = any($1)', p_table) using p_parent_keys;
  if p_rows is null or jsonb_array_length(p_rows) = 0 then return; end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table and column_name <> 'row_id';
  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)',
    p_table, cols
  ) using p_rows;
end;
$fn$;
grant execute on function public.replace_children(text, text[], jsonb) to authenticated, service_role;

`;

// Index bantu buat pencarian yang sering dipakai
out += `create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_parent_sku_idx on public.products (parent_sku);
create index if not exists sales_invoices_created_idx on public.sales_invoices (created_at_text_dummy);\n`.replace(
  '\ncreate index if not exists sales_invoices_created_idx on public.sales_invoices (created_at_text_dummy);',
  '\ncreate index if not exists sales_invoices_customer_idx on public.sales_invoices (customer_id);\ncreate index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier);'
);

out += `
-- RLS + grant + realtime untuk semua tabel di atas
do $$
declare
  t text;
  tbls text[] := array[${allTables.map((t) => `'${t}'`).join(', ')}];
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select_authenticated" on public.%I', t, t);
    execute format('create policy "%s_select_authenticated" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s_insert_authenticated" on public.%I', t, t);
    execute format('create policy "%s_insert_authenticated" on public.%I for insert to authenticated with check (true)', t, t);
    execute format('drop policy if exists "%s_update_authenticated" on public.%I', t, t);
    execute format('create policy "%s_update_authenticated" on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('drop policy if exists "%s_delete_authenticated" on public.%I', t, t);
    execute format('create policy "%s_delete_authenticated" on public.%I for delete to authenticated using (true)', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

grant usage on schema public to authenticated;

-- Storage bucket foto produk (tidak berubah)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects for select to public
  using (bucket_id = 'product-images');
drop policy if exists "product_images_authenticated_upload" on storage.objects;
create policy "product_images_authenticated_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
drop policy if exists "product_images_authenticated_update" on storage.objects;
create policy "product_images_authenticated_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
drop policy if exists "product_images_authenticated_delete" on storage.objects;
create policy "product_images_authenticated_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');
`;
writeFileSync(join(here, 'schema.sql'), out);

// --------------------------------------------------- migrate_from_legacy.sql
const num = (e) => `case when jsonb_typeof(${e}) = 'number' then (${e} #>> '{}')::numeric end`;
const bool = (e) => `case when jsonb_typeof(${e}) = 'boolean' then (${e} #>> '{}')::boolean end`;
const txt = (e) => `(${e} #>> '{}')`;
const arr = (e) => `case when jsonb_typeof(${e}) = 'array' then array(select jsonb_array_elements_text(${e})) end`;
const expr = (type, e) =>
  type === 'num' ? num(e) : type === 'bool' ? bool(e) : type === 'json' ? e : type === 'text[]' ? arr(e) : txt(e);

let mig = `-- =============================================================================
-- Pindahin data dari skema lama (tabel legacy_*) ke tabel per kolom.
-- DIGENERATE oleh generate-schema.mjs. Jalankan SETELAH schema.sql.
-- Aman diulang (on conflict do nothing) dan tidak menghapus tabel legacy_*.
-- =============================================================================
do $$
begin
`;
const legacyMigrated = spec.tables.filter((t) => !['store_profile','store_settings','cash_sessions','pos_cart_drafts'].includes(t.table));
for (const t of legacyMigrated) {
  const keyCol = snake(t.key);
  const cols = t.columns.map(([f]) => q(snake(f))).join(', ');
  const vals = t.columns.map(([f, ty]) => expr(ty, `l.data -> '${f}'`)).join(', ');
  mig += `  if to_regclass('public.legacy_${t.table}') is not null then
    insert into public.${q(t.table)} (${q(keyCol)}, ${cols}, db_created_at, db_updated_at)
    select l.key, ${vals}, l.created_at, l.updated_at from public.legacy_${t.table} l
    on conflict (${q(keyCol)}) do nothing;\n`;
  for (const ch of t.children ?? []) {
    const ccols = ch.columns.map(([f]) => q(snake(f))).join(', ');
    const cvals = ch.columns.map(([f, ty]) => expr(ty, `e.elem -> '${f}'`)).join(', ');
    mig += `    if not exists (select 1 from public.${q(ch.table)} limit 1) then
      insert into public.${q(ch.table)} (parent_key, position, ${ccols})
      select l.key, (e.ord - 1)::int, ${cvals}
      from public.legacy_${t.table} l,
           jsonb_array_elements(case when jsonb_typeof(l.data -> '${ch.field}') = 'array' then l.data -> '${ch.field}' else '[]'::jsonb end) with ordinality as e(elem, ord)
      where exists (select 1 from public.${q(t.table)} p where p.${q(keyCol)} = l.key);
    end if;\n`;
  }
  mig += `  end if;\n\n`;
}
// singleton lama -> tabel baru
mig += `  -- store_owner -> store_profile
  if to_regclass('public.legacy_store_owner') is not null then
    insert into public.store_profile (id, store_name, owner_name, email, address, phone, receipt_note, tax_id)
    select 'main', value->>'storeName', value->>'ownerName', value->>'email',
           value->>'address', value->>'phone', value->>'receiptNote', value->>'taxId'
    from public.legacy_store_owner where jsonb_typeof(value) = 'object'
    on conflict (id) do nothing;
  end if;

  -- ecommerce_username / default_customer_id / total_sales / total_orders_count -> store_settings
  insert into public.store_settings (id) values ('main') on conflict (id) do nothing;
  if to_regclass('public.legacy_ecommerce_username') is not null then
    update public.store_settings set ecommerce_username = (select value #>> '{}' from public.legacy_ecommerce_username limit 1)
    where ecommerce_username is null;
  end if;
  if to_regclass('public.legacy_default_customer_id') is not null then
    update public.store_settings set default_customer_id = (select nullif(value #>> '{}', 'null') from public.legacy_default_customer_id limit 1)
    where default_customer_id is null;
  end if;
  if to_regclass('public.legacy_total_sales') is not null then
    update public.store_settings set total_sales = (select ${num('value')} from public.legacy_total_sales limit 1)
    where total_sales is null;
  end if;
  if to_regclass('public.legacy_total_orders_count') is not null then
    update public.store_settings set total_orders_count = (select ${num('value')} from public.legacy_total_orders_count limit 1)
    where total_orders_count is null;
  end if;

  -- cash_session_current + cash_session_history -> cash_sessions (+ cash_mutations)
  if to_regclass('public.legacy_cash_session_current') is not null or to_regclass('public.legacy_cash_session_history') is not null then
    create temp table _legacy_sessions on commit drop as
    select s.elem as s, (s.ord + 1000) as ord from (
      select e.elem, e.ord from public.legacy_cash_session_history h,
        jsonb_array_elements(case when jsonb_typeof(h.value) = 'array' then h.value else '[]'::jsonb end) with ordinality e(elem, ord)
    ) s
    union all
    select c.value, 0 from public.legacy_cash_session_current c where jsonb_typeof(c.value) = 'object';
`;
const cs = spec.tables.find((t) => t.table === 'cash_sessions');
const csCols = cs.columns.map(([f]) => q(snake(f))).join(', ');
const csVals = cs.columns.map(([f, ty]) => expr(ty, `s -> '${f}'`)).join(', ');
mig += `    insert into public.cash_sessions (id, ${csCols}, db_created_at)
    select s->>'id', ${csVals}, now() - (ord || ' seconds')::interval from _legacy_sessions
    on conflict (id) do nothing;
`;
const mu = cs.children[0];
mig += `    insert into public.cash_mutations (parent_key, position, ${mu.columns.map(([f]) => q(snake(f))).join(', ')})
    select s->>'id', (e.ord - 1)::int, ${mu.columns.map(([f, ty]) => expr(ty, `e.elem -> '${f}'`)).join(', ')}
    from _legacy_sessions,
         jsonb_array_elements(case when jsonb_typeof(s -> 'mutations') = 'array' then s -> 'mutations' else '[]'::jsonb end) with ordinality e(elem, ord)
    where not exists (select 1 from public.cash_mutations m where m.parent_key = s->>'id');
  end if;
end $$;
`;
writeFileSync(join(here, 'migrate_from_legacy.sql'), mig);
console.log(`OK: ${spec.tables.length} tabel utama, ${allTables.length} tabel total`);
