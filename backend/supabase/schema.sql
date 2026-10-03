-- =============================================================================
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
      and c.table_name not like 'legacy\_%'
      and c.table_name <> 'audit_log'
  loop
    execute format('alter table public.%I rename to %I', r.table_name, 'legacy_' || r.table_name);
  end loop;
  for r in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'value' and c.data_type = 'jsonb'
      and c.table_name not like 'legacy\_%'
  loop
    execute format('alter table public.%I rename to %I', r.table_name, 'legacy_' || r.table_name);
  end loop;
end $$;

-- products
create table if not exists public."products" (
  "sku" text primary key,
  "name" text,
  "category" text,
  "unit" text,
  "retail_price" numeric,
  "wholesale_price" numeric,
  "project_price" numeric,
  "stock" numeric,
  "stock_status" text,
  "last_restock" text,
  "supplier" text,
  "last_restock_qty" numeric,
  "lead_time" text,
  "warehouse_location" text,
  "image" text,
  "product_type" text,
  "alias" text,
  "brand" text,
  "category1" text,
  "category2" text,
  "category3" text,
  "barcode" text,
  "cost_price" numeric,
  "min_sell_price" numeric,
  "standard_sell_price" numeric,
  "show_low_stock_alert" boolean,
  "min_stock_qty" numeric,
  "show_in_deadstock" boolean,
  "deadstock_period_months" numeric,
  "sku_location_id" text,
  "parent_sku" text,
  "conversion_value" numeric,
  "allow_decimal_qty" boolean,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."products" add column if not exists "name" text;
alter table public."products" add column if not exists "category" text;
alter table public."products" add column if not exists "unit" text;
alter table public."products" add column if not exists "retail_price" numeric;
alter table public."products" add column if not exists "wholesale_price" numeric;
alter table public."products" add column if not exists "project_price" numeric;
alter table public."products" add column if not exists "stock" numeric;
alter table public."products" add column if not exists "stock_status" text;
alter table public."products" add column if not exists "last_restock" text;
alter table public."products" add column if not exists "supplier" text;
alter table public."products" add column if not exists "last_restock_qty" numeric;
alter table public."products" add column if not exists "lead_time" text;
alter table public."products" add column if not exists "warehouse_location" text;
alter table public."products" add column if not exists "image" text;
alter table public."products" add column if not exists "product_type" text;
alter table public."products" add column if not exists "alias" text;
alter table public."products" add column if not exists "brand" text;
alter table public."products" add column if not exists "category1" text;
alter table public."products" add column if not exists "category2" text;
alter table public."products" add column if not exists "category3" text;
alter table public."products" add column if not exists "barcode" text;
alter table public."products" add column if not exists "cost_price" numeric;
alter table public."products" add column if not exists "min_sell_price" numeric;
alter table public."products" add column if not exists "standard_sell_price" numeric;
alter table public."products" add column if not exists "show_low_stock_alert" boolean;
alter table public."products" add column if not exists "min_stock_qty" numeric;
alter table public."products" add column if not exists "show_in_deadstock" boolean;
alter table public."products" add column if not exists "deadstock_period_months" numeric;
alter table public."products" add column if not exists "sku_location_id" text;
alter table public."products" add column if not exists "parent_sku" text;
alter table public."products" add column if not exists "conversion_value" numeric;
alter table public."products" add column if not exists "allow_decimal_qty" boolean;
drop trigger if exists trg_products_db_updated on public."products";
create trigger trg_products_db_updated before update on public."products" for each row execute function public.set_db_updated_at();

create table if not exists public."product_sell_units" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."products"("sku") on update cascade on delete cascade,
  position integer not null default 0,
  "label" text,
  "factor" numeric,
  "price" numeric
);
alter table public."product_sell_units" add column if not exists "label" text;
alter table public."product_sell_units" add column if not exists "factor" numeric;
alter table public."product_sell_units" add column if not exists "price" numeric;
create index if not exists product_sell_units_parent_idx on public."product_sell_units" (parent_key, position);

-- purchase_orders
create table if not exists public."purchase_orders" (
  "po_number" text primary key,
  "supplier" text,
  "total" numeric,
  "status" text,
  "created_date" text,
  "logistics_note" text,
  "payment_method" text,
  "delivery_note_number" text,
  "tax_included" boolean,
  "total_discount" numeric,
  "additional_cost" numeric,
  "additional_cost_name" text,
  "received_at" text,
  "due_date" text,
  "paid_at" text,
  "paid_amount" numeric,
  "paid_method" text,
  "dropship" boolean,
  "dropship_note" text,
  "direct_to_customer" boolean,
  "direct_to_customer_name" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."purchase_orders" add column if not exists "supplier" text;
alter table public."purchase_orders" add column if not exists "total" numeric;
alter table public."purchase_orders" add column if not exists "status" text;
alter table public."purchase_orders" add column if not exists "created_date" text;
alter table public."purchase_orders" add column if not exists "logistics_note" text;
alter table public."purchase_orders" add column if not exists "payment_method" text;
alter table public."purchase_orders" add column if not exists "delivery_note_number" text;
alter table public."purchase_orders" add column if not exists "tax_included" boolean;
alter table public."purchase_orders" add column if not exists "total_discount" numeric;
alter table public."purchase_orders" add column if not exists "additional_cost" numeric;
alter table public."purchase_orders" add column if not exists "additional_cost_name" text;
alter table public."purchase_orders" add column if not exists "received_at" text;
alter table public."purchase_orders" add column if not exists "due_date" text;
alter table public."purchase_orders" add column if not exists "paid_at" text;
alter table public."purchase_orders" add column if not exists "paid_amount" numeric;
alter table public."purchase_orders" add column if not exists "paid_method" text;
alter table public."purchase_orders" add column if not exists "dropship" boolean;
alter table public."purchase_orders" add column if not exists "dropship_note" text;
alter table public."purchase_orders" add column if not exists "direct_to_customer" boolean;
alter table public."purchase_orders" add column if not exists "direct_to_customer_name" text;
drop trigger if exists trg_purchase_orders_db_updated on public."purchase_orders";
create trigger trg_purchase_orders_db_updated before update on public."purchase_orders" for each row execute function public.set_db_updated_at();

create table if not exists public."purchase_order_items" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."purchase_orders"("po_number") on update cascade on delete cascade,
  position integer not null default 0,
  "name" text,
  "sku" text,
  "quantity" numeric,
  "price" numeric,
  "tax_included" boolean,
  "discount_per_unit" numeric,
  "total_discount" numeric,
  "location_id" text,
  "bonus" boolean
);
alter table public."purchase_order_items" add column if not exists "name" text;
alter table public."purchase_order_items" add column if not exists "sku" text;
alter table public."purchase_order_items" add column if not exists "quantity" numeric;
alter table public."purchase_order_items" add column if not exists "price" numeric;
alter table public."purchase_order_items" add column if not exists "tax_included" boolean;
alter table public."purchase_order_items" add column if not exists "discount_per_unit" numeric;
alter table public."purchase_order_items" add column if not exists "total_discount" numeric;
alter table public."purchase_order_items" add column if not exists "location_id" text;
alter table public."purchase_order_items" add column if not exists "bonus" boolean;
create index if not exists purchase_order_items_parent_idx on public."purchase_order_items" (parent_key, position);

create table if not exists public."purchase_order_payments" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."purchase_orders"("po_number") on update cascade on delete cascade,
  position integer not null default 0,
  "id" text,
  "amount" numeric,
  "method" text,
  "date" text,
  "proof_url" text,
  "by" text
);
alter table public."purchase_order_payments" add column if not exists "id" text;
alter table public."purchase_order_payments" add column if not exists "amount" numeric;
alter table public."purchase_order_payments" add column if not exists "method" text;
alter table public."purchase_order_payments" add column if not exists "date" text;
alter table public."purchase_order_payments" add column if not exists "proof_url" text;
alter table public."purchase_order_payments" add column if not exists "by" text;
alter table public."purchase_order_payments" add column if not exists "request_status" text;
alter table public."purchase_order_payments" add column if not exists "request_action" text;
alter table public."purchase_order_payments" add column if not exists "requested_amount" numeric;
alter table public."purchase_order_payments" add column if not exists "requested_method" text;
alter table public."purchase_order_payments" add column if not exists "requested_date" text;
alter table public."purchase_order_payments" add column if not exists "requested_by" text;
create index if not exists purchase_order_payments_parent_idx on public."purchase_order_payments" (parent_key, position);

create table if not exists public."purchase_order_paid_history" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."purchase_orders"("po_number") on update cascade on delete cascade,
  position integer not null default 0,
  "date" text,
  "amount" numeric,
  "method" text,
  "receipt_name" text
);
alter table public."purchase_order_paid_history" add column if not exists "date" text;
alter table public."purchase_order_paid_history" add column if not exists "amount" numeric;
alter table public."purchase_order_paid_history" add column if not exists "method" text;
alter table public."purchase_order_paid_history" add column if not exists "receipt_name" text;
create index if not exists purchase_order_paid_history_parent_idx on public."purchase_order_paid_history" (parent_key, position);

-- customers
create table if not exists public."customers" (
  "id" text primary key,
  "name" text,
  "loyalty_tier" text,
  "points" numeric,
  "current_debt" numeric,
  "total_purchases" numeric,
  "debt_status" text,
  "overdue_amount" numeric,
  "pending_amount" numeric,
  "logo_letters" text,
  "customer_type" text,
  "phone" text,
  "address" text,
  "payment_terms" text,
  "tempo_days" numeric,
  "credit_limit" numeric,
  "deposit_balance" numeric,
  "next_due_date" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."customers" add column if not exists "name" text;
alter table public."customers" add column if not exists "loyalty_tier" text;
alter table public."customers" add column if not exists "points" numeric;
alter table public."customers" add column if not exists "current_debt" numeric;
alter table public."customers" add column if not exists "total_purchases" numeric;
alter table public."customers" add column if not exists "debt_status" text;
alter table public."customers" add column if not exists "overdue_amount" numeric;
alter table public."customers" add column if not exists "pending_amount" numeric;
alter table public."customers" add column if not exists "logo_letters" text;
alter table public."customers" add column if not exists "customer_type" text;
alter table public."customers" add column if not exists "phone" text;
alter table public."customers" add column if not exists "address" text;
alter table public."customers" add column if not exists "payment_terms" text;
alter table public."customers" add column if not exists "tempo_days" numeric;
alter table public."customers" add column if not exists "credit_limit" numeric;
alter table public."customers" add column if not exists "deposit_balance" numeric;
alter table public."customers" add column if not exists "next_due_date" text;
drop trigger if exists trg_customers_db_updated on public."customers";
create trigger trg_customers_db_updated before update on public."customers" for each row execute function public.set_db_updated_at();

create table if not exists public."customer_transactions" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."customers"("id") on update cascade on delete cascade,
  position integer not null default 0,
  "order_name" text,
  "date" text,
  "amount" numeric,
  "created_at" text
);
alter table public."customer_transactions" add column if not exists "order_name" text;
alter table public."customer_transactions" add column if not exists "date" text;
alter table public."customer_transactions" add column if not exists "amount" numeric;
alter table public."customer_transactions" add column if not exists "created_at" text;
create index if not exists customer_transactions_parent_idx on public."customer_transactions" (parent_key, position);

create table if not exists public."customer_deposit_transactions" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."customers"("id") on update cascade on delete cascade,
  position integer not null default 0,
  "id" text,
  "type" text,
  "amount" numeric,
  "method" text,
  "date" text
);
alter table public."customer_deposit_transactions" add column if not exists "id" text;
alter table public."customer_deposit_transactions" add column if not exists "type" text;
alter table public."customer_deposit_transactions" add column if not exists "amount" numeric;
alter table public."customer_deposit_transactions" add column if not exists "method" text;
alter table public."customer_deposit_transactions" add column if not exists "date" text;
create index if not exists customer_deposit_transactions_parent_idx on public."customer_deposit_transactions" (parent_key, position);

-- suppliers
create table if not exists public."suppliers" (
  "name" text primary key,
  "rating" numeric,
  "recent_po" text,
  "debt" numeric,
  "lead_time_stability" numeric,
  "logo_letters" text,
  "phone" text,
  "npwp" text,
  "address" text,
  "sales_name" text,
  "sales_phone" text,
  "top_days" numeric,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."suppliers" add column if not exists "rating" numeric;
alter table public."suppliers" add column if not exists "recent_po" text;
alter table public."suppliers" add column if not exists "debt" numeric;
alter table public."suppliers" add column if not exists "lead_time_stability" numeric;
alter table public."suppliers" add column if not exists "logo_letters" text;
alter table public."suppliers" add column if not exists "phone" text;
alter table public."suppliers" add column if not exists "npwp" text;
alter table public."suppliers" add column if not exists "address" text;
alter table public."suppliers" add column if not exists "sales_name" text;
alter table public."suppliers" add column if not exists "sales_phone" text;
alter table public."suppliers" add column if not exists "top_days" numeric;
drop trigger if exists trg_suppliers_db_updated on public."suppliers";
create trigger trg_suppliers_db_updated before update on public."suppliers" for each row execute function public.set_db_updated_at();

create table if not exists public."supplier_sales_contacts" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."suppliers"("name") on update cascade on delete cascade,
  position integer not null default 0,
  "name" text,
  "phone" text
);
alter table public."supplier_sales_contacts" add column if not exists "name" text;
alter table public."supplier_sales_contacts" add column if not exists "phone" text;
create index if not exists supplier_sales_contacts_parent_idx on public."supplier_sales_contacts" (parent_key, position);

-- expenses
create table if not exists public."expenses" (
  "id" text primary key,
  "date" text,
  "category" text,
  "description" text,
  "submitted_by" text,
  "amount" numeric,
  "receipt_name" text,
  "receipt_url" text,
  "status" text,
  "payment_method" text,
  "expense_date" text,
  "receipt_file" text,
  "approved_by" text,
  "approved_at" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."expenses" add column if not exists "date" text;
alter table public."expenses" add column if not exists "category" text;
alter table public."expenses" add column if not exists "description" text;
alter table public."expenses" add column if not exists "submitted_by" text;
alter table public."expenses" add column if not exists "amount" numeric;
alter table public."expenses" add column if not exists "receipt_name" text;
alter table public."expenses" add column if not exists "receipt_url" text;
alter table public."expenses" add column if not exists "status" text;
alter table public."expenses" add column if not exists "payment_method" text;
alter table public."expenses" add column if not exists "expense_date" text;
alter table public."expenses" add column if not exists "receipt_file" text;
alter table public."expenses" add column if not exists "approved_by" text;
alter table public."expenses" add column if not exists "approved_at" text;
drop trigger if exists trg_expenses_db_updated on public."expenses";
create trigger trg_expenses_db_updated before update on public."expenses" for each row execute function public.set_db_updated_at();

-- activities
create table if not exists public."activities" (
  "id" text primary key,
  "title" text,
  "subtitle" text,
  "amount" numeric,
  "time" text,
  "created_at" text,
  "type" text,
  "audience" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."activities" add column if not exists "title" text;
alter table public."activities" add column if not exists "subtitle" text;
alter table public."activities" add column if not exists "amount" numeric;
alter table public."activities" add column if not exists "time" text;
alter table public."activities" add column if not exists "created_at" text;
alter table public."activities" add column if not exists "type" text;
alter table public."activities" add column if not exists "audience" text;
drop trigger if exists trg_activities_db_updated on public."activities";
create trigger trg_activities_db_updated before update on public."activities" for each row execute function public.set_db_updated_at();

-- branches
create table if not exists public."branches" (
  "name" text primary key,
  "location" text,
  "manager" text,
  "manager_initials" text,
  "hw_ok" numeric,
  "hw_error" numeric,
  "address" text,
  "city" text,
  "branch_code" text,
  "phone" text,
  "postal_code" text,
  "receipt_note" text,
  "image_url" text,
  "allow_negative_stock" boolean,
  "show_stock_in_digital" boolean,
  "use_daily_cash" boolean,
  "opening_hours" jsonb,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."branches" add column if not exists "location" text;
alter table public."branches" add column if not exists "manager" text;
alter table public."branches" add column if not exists "manager_initials" text;
alter table public."branches" add column if not exists "hw_ok" numeric;
alter table public."branches" add column if not exists "hw_error" numeric;
alter table public."branches" add column if not exists "address" text;
alter table public."branches" add column if not exists "city" text;
alter table public."branches" add column if not exists "branch_code" text;
alter table public."branches" add column if not exists "phone" text;
alter table public."branches" add column if not exists "postal_code" text;
alter table public."branches" add column if not exists "receipt_note" text;
alter table public."branches" add column if not exists "image_url" text;
alter table public."branches" add column if not exists "allow_negative_stock" boolean;
alter table public."branches" add column if not exists "show_stock_in_digital" boolean;
alter table public."branches" add column if not exists "use_daily_cash" boolean;
alter table public."branches" add column if not exists "opening_hours" jsonb;
drop trigger if exists trg_branches_db_updated on public."branches";
create trigger trg_branches_db_updated before update on public."branches" for each row execute function public.set_db_updated_at();

-- sales_invoices
create table if not exists public."sales_invoices" (
  "invoice_number" text primary key,
  "customer_name" text,
  "customer_id" text,
  "date" text,
  "created_at" text,
  "total" numeric,
  "payment_method" text,
  "subtotal" numeric,
  "discount_amount" numeric,
  "discount_type" text,
  "discount_value" numeric,
  "additional_fee_name" text,
  "additional_fee" numeric,
  "fulfillment_method" text,
  "delivery_address" text,
  "driver_name" text,
  "deletion_status" text,
  "deletion_requested_at" text,
  "cash_received" numeric,
  "change_amount" numeric,
  "split_paid_amount" numeric,
  "split_remaining_debt" numeric,
  "split_due_date" text,
  "pay_on_delivery" boolean,
  "payment_account_name" text,
  "payment_account_number" text,
  "payment_account_holder" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."sales_invoices" add column if not exists "customer_name" text;
alter table public."sales_invoices" add column if not exists "customer_id" text;
alter table public."sales_invoices" add column if not exists "date" text;
alter table public."sales_invoices" add column if not exists "created_at" text;
alter table public."sales_invoices" add column if not exists "total" numeric;
alter table public."sales_invoices" add column if not exists "payment_method" text;
alter table public."sales_invoices" add column if not exists "subtotal" numeric;
alter table public."sales_invoices" add column if not exists "discount_amount" numeric;
alter table public."sales_invoices" add column if not exists "discount_type" text;
alter table public."sales_invoices" add column if not exists "discount_value" numeric;
alter table public."sales_invoices" add column if not exists "additional_fee_name" text;
alter table public."sales_invoices" add column if not exists "additional_fee" numeric;
alter table public."sales_invoices" add column if not exists "fulfillment_method" text;
alter table public."sales_invoices" add column if not exists "delivery_address" text;
alter table public."sales_invoices" add column if not exists "driver_name" text;
alter table public."sales_invoices" add column if not exists "deletion_status" text;
alter table public."sales_invoices" add column if not exists "deletion_requested_at" text;
alter table public."sales_invoices" add column if not exists "cash_received" numeric;
alter table public."sales_invoices" add column if not exists "change_amount" numeric;
alter table public."sales_invoices" add column if not exists "split_paid_amount" numeric;
alter table public."sales_invoices" add column if not exists "split_remaining_debt" numeric;
alter table public."sales_invoices" add column if not exists "split_due_date" text;
alter table public."sales_invoices" add column if not exists "pay_on_delivery" boolean;
alter table public."sales_invoices" add column if not exists "payment_account_name" text;
alter table public."sales_invoices" add column if not exists "payment_account_number" text;
alter table public."sales_invoices" add column if not exists "payment_account_holder" text;
drop trigger if exists trg_sales_invoices_db_updated on public."sales_invoices";
create trigger trg_sales_invoices_db_updated before update on public."sales_invoices" for each row execute function public.set_db_updated_at();

create table if not exists public."sales_invoice_items" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."sales_invoices"("invoice_number") on update cascade on delete cascade,
  position integer not null default 0,
  "sku" text,
  "name" text,
  "quantity" numeric,
  "price" numeric,
  "original_price" numeric,
  "unit" text,
  "bonus" boolean,
  "delivered_quantity" numeric
);
alter table public."sales_invoice_items" add column if not exists "sku" text;
alter table public."sales_invoice_items" add column if not exists "name" text;
alter table public."sales_invoice_items" add column if not exists "quantity" numeric;
alter table public."sales_invoice_items" add column if not exists "price" numeric;
alter table public."sales_invoice_items" add column if not exists "original_price" numeric;
alter table public."sales_invoice_items" add column if not exists "unit" text;
alter table public."sales_invoice_items" add column if not exists "bonus" boolean;
alter table public."sales_invoice_items" add column if not exists "delivered_quantity" numeric;
create index if not exists sales_invoice_items_parent_idx on public."sales_invoice_items" (parent_key, position);

create table if not exists public."sales_invoice_fees" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."sales_invoices"("invoice_number") on update cascade on delete cascade,
  position integer not null default 0,
  "name" text,
  "amount" numeric
);
alter table public."sales_invoice_fees" add column if not exists "name" text;
alter table public."sales_invoice_fees" add column if not exists "amount" numeric;
create index if not exists sales_invoice_fees_parent_idx on public."sales_invoice_fees" (parent_key, position);

-- returns
create table if not exists public."returns" (
  "id" text primary key,
  "type" text,
  "ref_number" text,
  "party_name" text,
  "discount" numeric,
  "total_refund" numeric,
  "refund_method" text,
  "status" text,
  "created_at" text,
  "approved_at_iso" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."returns" add column if not exists "type" text;
alter table public."returns" add column if not exists "ref_number" text;
alter table public."returns" add column if not exists "party_name" text;
alter table public."returns" add column if not exists "discount" numeric;
alter table public."returns" add column if not exists "total_refund" numeric;
alter table public."returns" add column if not exists "refund_method" text;
alter table public."returns" add column if not exists "status" text;
alter table public."returns" add column if not exists "created_at" text;
alter table public."returns" add column if not exists "approved_at_iso" text;
drop trigger if exists trg_returns_db_updated on public."returns";
create trigger trg_returns_db_updated before update on public."returns" for each row execute function public.set_db_updated_at();

create table if not exists public."return_items" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."returns"("id") on update cascade on delete cascade,
  position integer not null default 0,
  "sku" text,
  "name" text,
  "quantity" numeric,
  "condition" text,
  "price" numeric
);
alter table public."return_items" add column if not exists "sku" text;
alter table public."return_items" add column if not exists "name" text;
alter table public."return_items" add column if not exists "quantity" numeric;
alter table public."return_items" add column if not exists "condition" text;
alter table public."return_items" add column if not exists "price" numeric;
create index if not exists return_items_parent_idx on public."return_items" (parent_key, position);

-- digital_orders
create table if not exists public."digital_orders" (
  "id" text primary key,
  "buyer_name" text,
  "phone" text,
  "address" text,
  "total" numeric,
  "status" text,
  "created_at" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."digital_orders" add column if not exists "buyer_name" text;
alter table public."digital_orders" add column if not exists "phone" text;
alter table public."digital_orders" add column if not exists "address" text;
alter table public."digital_orders" add column if not exists "total" numeric;
alter table public."digital_orders" add column if not exists "status" text;
alter table public."digital_orders" add column if not exists "created_at" text;
drop trigger if exists trg_digital_orders_db_updated on public."digital_orders";
create trigger trg_digital_orders_db_updated before update on public."digital_orders" for each row execute function public.set_db_updated_at();

create table if not exists public."digital_order_items" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."digital_orders"("id") on update cascade on delete cascade,
  position integer not null default 0,
  "sku" text,
  "name" text,
  "quantity" numeric,
  "price" numeric
);
alter table public."digital_order_items" add column if not exists "sku" text;
alter table public."digital_order_items" add column if not exists "name" text;
alter table public."digital_order_items" add column if not exists "quantity" numeric;
alter table public."digital_order_items" add column if not exists "price" numeric;
create index if not exists digital_order_items_parent_idx on public."digital_order_items" (parent_key, position);

-- banners
create table if not exists public."banners" (
  "id" text primary key,
  "image_url" text,
  "title" text,
  "active" boolean,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."banners" add column if not exists "image_url" text;
alter table public."banners" add column if not exists "title" text;
alter table public."banners" add column if not exists "active" boolean;
drop trigger if exists trg_banners_db_updated on public."banners";
create trigger trg_banners_db_updated before update on public."banners" for each row execute function public.set_db_updated_at();

-- sku_locations
create table if not exists public."sku_locations" (
  "id" text primary key,
  "name" text,
  "city" text,
  "address" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."sku_locations" add column if not exists "name" text;
alter table public."sku_locations" add column if not exists "city" text;
alter table public."sku_locations" add column if not exists "address" text;
drop trigger if exists trg_sku_locations_db_updated on public."sku_locations";
create trigger trg_sku_locations_db_updated before update on public."sku_locations" for each row execute function public.set_db_updated_at();

-- staff_list
create table if not exists public."staff_list" (
  "id" text primary key,
  "name" text,
  "phone" text,
  "role" text,
  "permissions" text[],
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."staff_list" add column if not exists "name" text;
alter table public."staff_list" add column if not exists "phone" text;
alter table public."staff_list" add column if not exists "role" text;
alter table public."staff_list" add column if not exists "permissions" text[];
drop trigger if exists trg_staff_list_db_updated on public."staff_list";
create trigger trg_staff_list_db_updated before update on public."staff_list" for each row execute function public.set_db_updated_at();

-- bank_accounts
create table if not exists public."bank_accounts" (
  "id" text primary key,
  "name" text,
  "type" text,
  "account_number" text,
  "holder_name" text,
  "notes" text,
  "qris_image_url" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."bank_accounts" add column if not exists "name" text;
alter table public."bank_accounts" add column if not exists "type" text;
alter table public."bank_accounts" add column if not exists "account_number" text;
alter table public."bank_accounts" add column if not exists "holder_name" text;
alter table public."bank_accounts" add column if not exists "notes" text;
alter table public."bank_accounts" add column if not exists "qris_image_url" text;
drop trigger if exists trg_bank_accounts_db_updated on public."bank_accounts";
create trigger trg_bank_accounts_db_updated before update on public."bank_accounts" for each row execute function public.set_db_updated_at();

-- printers
create table if not exists public."printers" (
  "id" text primary key,
  "name" text,
  "connection_type" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."printers" add column if not exists "name" text;
alter table public."printers" add column if not exists "connection_type" text;
drop trigger if exists trg_printers_db_updated on public."printers";
create trigger trg_printers_db_updated before update on public."printers" for each row execute function public.set_db_updated_at();

-- opname_submissions
create table if not exists public."opname_submissions" (
  "id" text primary key,
  "product_sku" text,
  "product_name" text,
  "type" text,
  "amount" numeric,
  "notes" text,
  "submitted_by" text,
  "date" text,
  "status" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."opname_submissions" add column if not exists "product_sku" text;
alter table public."opname_submissions" add column if not exists "product_name" text;
alter table public."opname_submissions" add column if not exists "type" text;
alter table public."opname_submissions" add column if not exists "amount" numeric;
alter table public."opname_submissions" add column if not exists "notes" text;
alter table public."opname_submissions" add column if not exists "submitted_by" text;
alter table public."opname_submissions" add column if not exists "date" text;
alter table public."opname_submissions" add column if not exists "status" text;
drop trigger if exists trg_opname_submissions_db_updated on public."opname_submissions";
create trigger trg_opname_submissions_db_updated before update on public."opname_submissions" for each row execute function public.set_db_updated_at();

-- product_categories
create table if not exists public."product_categories" (
  "id" text primary key,
  "name" text,
  "level" numeric,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."product_categories" add column if not exists "name" text;
alter table public."product_categories" add column if not exists "level" numeric;
drop trigger if exists trg_product_categories_db_updated on public."product_categories";
create trigger trg_product_categories_db_updated before update on public."product_categories" for each row execute function public.set_db_updated_at();

-- product_brands
create table if not exists public."product_brands" (
  "id" text primary key,
  "name" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."product_brands" add column if not exists "name" text;
drop trigger if exists trg_product_brands_db_updated on public."product_brands";
create trigger trg_product_brands_db_updated before update on public."product_brands" for each row execute function public.set_db_updated_at();

-- product_units
create table if not exists public."product_units" (
  "id" text primary key,
  "name" text,
  "level" numeric,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."product_units" add column if not exists "name" text;
alter table public."product_units" add column if not exists "level" numeric;
drop trigger if exists trg_product_units_db_updated on public."product_units";
create trigger trg_product_units_db_updated before update on public."product_units" for each row execute function public.set_db_updated_at();

-- product_bundles
create table if not exists public."product_bundles" (
  "id" text primary key,
  "name" text,
  "bundle_price" numeric,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."product_bundles" add column if not exists "name" text;
alter table public."product_bundles" add column if not exists "bundle_price" numeric;
drop trigger if exists trg_product_bundles_db_updated on public."product_bundles";
create trigger trg_product_bundles_db_updated before update on public."product_bundles" for each row execute function public.set_db_updated_at();

create table if not exists public."product_bundle_items" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."product_bundles"("id") on update cascade on delete cascade,
  position integer not null default 0,
  "sku" text,
  "name" text,
  "quantity" numeric
);
alter table public."product_bundle_items" add column if not exists "sku" text;
alter table public."product_bundle_items" add column if not exists "name" text;
alter table public."product_bundle_items" add column if not exists "quantity" numeric;
create index if not exists product_bundle_items_parent_idx on public."product_bundle_items" (parent_key, position);

-- store_profile
create table if not exists public."store_profile" (
  "id" text primary key check ("id" = 'main'),
  "store_name" text,
  "owner_name" text,
  "email" text,
  "address" text,
  "phone" text,
  "receipt_note" text,
  "tax_id" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."store_profile" add column if not exists "store_name" text;
alter table public."store_profile" add column if not exists "owner_name" text;
alter table public."store_profile" add column if not exists "email" text;
alter table public."store_profile" add column if not exists "address" text;
alter table public."store_profile" add column if not exists "phone" text;
alter table public."store_profile" add column if not exists "receipt_note" text;
alter table public."store_profile" add column if not exists "tax_id" text;
drop trigger if exists trg_store_profile_db_updated on public."store_profile";
create trigger trg_store_profile_db_updated before update on public."store_profile" for each row execute function public.set_db_updated_at();

-- store_settings
create table if not exists public."store_settings" (
  "id" text primary key check ("id" = 'main'),
  "ecommerce_username" text,
  "default_customer_id" text,
  "total_sales" numeric,
  "total_orders_count" numeric,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."store_settings" add column if not exists "ecommerce_username" text;
alter table public."store_settings" add column if not exists "default_customer_id" text;
alter table public."store_settings" add column if not exists "total_sales" numeric;
alter table public."store_settings" add column if not exists "total_orders_count" numeric;
drop trigger if exists trg_store_settings_db_updated on public."store_settings";
create trigger trg_store_settings_db_updated before update on public."store_settings" for each row execute function public.set_db_updated_at();

-- cash_sessions
create table if not exists public."cash_sessions" (
  "id" text primary key,
  "date" text,
  "opened_at" text,
  "closed_at" text,
  "opened_at_iso" text,
  "closed_at_iso" text,
  "cashier_name" text,
  "status" text,
  "opening_balance" numeric,
  "total_invoices_cash" numeric,
  "total_stocks_sold_cash" numeric,
  "total_invoices_non_cash" numeric,
  "closing_actual" numeric,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."cash_sessions" add column if not exists "date" text;
alter table public."cash_sessions" add column if not exists "opened_at" text;
alter table public."cash_sessions" add column if not exists "closed_at" text;
alter table public."cash_sessions" add column if not exists "opened_at_iso" text;
alter table public."cash_sessions" add column if not exists "closed_at_iso" text;
alter table public."cash_sessions" add column if not exists "cashier_name" text;
alter table public."cash_sessions" add column if not exists "status" text;
alter table public."cash_sessions" add column if not exists "opening_balance" numeric;
alter table public."cash_sessions" add column if not exists "total_invoices_cash" numeric;
alter table public."cash_sessions" add column if not exists "total_stocks_sold_cash" numeric;
alter table public."cash_sessions" add column if not exists "total_invoices_non_cash" numeric;
alter table public."cash_sessions" add column if not exists "closing_actual" numeric;
drop trigger if exists trg_cash_sessions_db_updated on public."cash_sessions";
create trigger trg_cash_sessions_db_updated before update on public."cash_sessions" for each row execute function public.set_db_updated_at();

create table if not exists public."cash_mutations" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."cash_sessions"("id") on update cascade on delete cascade,
  position integer not null default 0,
  "id" text,
  "type" text,
  "category" text,
  "amount" numeric,
  "note" text,
  "time" text
);
alter table public."cash_mutations" add column if not exists "id" text;
alter table public."cash_mutations" add column if not exists "type" text;
alter table public."cash_mutations" add column if not exists "category" text;
alter table public."cash_mutations" add column if not exists "amount" numeric;
alter table public."cash_mutations" add column if not exists "note" text;
alter table public."cash_mutations" add column if not exists "time" text;
create index if not exists cash_mutations_parent_idx on public."cash_mutations" (parent_key, position);

-- pos_cart_drafts
create table if not exists public."pos_cart_drafts" (
  "id" text primary key,
  "selected_customer_id" text,
  "discount_mode" text,
  "discount_value" numeric,
  "additional_fee_name" text,
  "additional_fee" numeric,
  "payment_method" text,
  "fulfillment_method" text,
  "delivery_address" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."pos_cart_drafts" drop constraint if exists pos_cart_drafts_id_check;
alter table public."pos_cart_drafts" add column if not exists "selected_customer_id" text;
alter table public."pos_cart_drafts" add column if not exists "discount_mode" text;
alter table public."pos_cart_drafts" add column if not exists "discount_value" numeric;
alter table public."pos_cart_drafts" add column if not exists "additional_fee_name" text;
alter table public."pos_cart_drafts" add column if not exists "additional_fee" numeric;
alter table public."pos_cart_drafts" add column if not exists "payment_method" text;
alter table public."pos_cart_drafts" add column if not exists "fulfillment_method" text;
alter table public."pos_cart_drafts" add column if not exists "delivery_address" text;
drop trigger if exists trg_pos_cart_drafts_db_updated on public."pos_cart_drafts";
create trigger trg_pos_cart_drafts_db_updated before update on public."pos_cart_drafts" for each row execute function public.set_db_updated_at();

create table if not exists public."pos_cart_items" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."pos_cart_drafts"("id") on update cascade on delete cascade,
  position integer not null default 0,
  "product_sku" text,
  "quantity" numeric,
  "selected_price_type" text,
  "custom_price" numeric,
  "bonus" boolean,
  "notes" text
);
alter table public."pos_cart_items" add column if not exists "product_sku" text;
alter table public."pos_cart_items" add column if not exists "quantity" numeric;
alter table public."pos_cart_items" add column if not exists "selected_price_type" text;
alter table public."pos_cart_items" add column if not exists "custom_price" numeric;
alter table public."pos_cart_items" add column if not exists "bonus" boolean;
alter table public."pos_cart_items" add column if not exists "notes" text;
create index if not exists pos_cart_items_parent_idx on public."pos_cart_items" (parent_key, position);

create table if not exists public."pos_cart_fees" (
  row_id bigint generated always as identity primary key,
  parent_key text not null references public."pos_cart_drafts"("id") on update cascade on delete cascade,
  position integer not null default 0,
  "name" text,
  "amount" numeric
);
alter table public."pos_cart_fees" add column if not exists "name" text;
alter table public."pos_cart_fees" add column if not exists "amount" numeric;
create index if not exists pos_cart_fees_parent_idx on public."pos_cart_fees" (parent_key, position);

-- push_tokens
create table if not exists public."push_tokens" (
  "token" text primary key,
  "platform" text,
  "device_label" text,
  "role" text,
  "updated_at" text,
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now()
);
alter table public."push_tokens" add column if not exists "platform" text;
alter table public."push_tokens" add column if not exists "device_label" text;
alter table public."push_tokens" add column if not exists "role" text;
alter table public."push_tokens" add column if not exists "updated_at" text;
drop trigger if exists trg_push_tokens_db_updated on public."push_tokens";
create trigger trg_push_tokens_db_updated before update on public."push_tokens" for each row execute function public.set_db_updated_at();

create or replace function public.replace_children(p_table text, p_parent_keys text[], p_rows jsonb)
returns void
language plpgsql
as $fn$
declare cols text;
begin
  if p_table <> all (array['product_sell_units', 'purchase_order_items', 'purchase_order_payments', 'purchase_order_paid_history', 'customer_transactions', 'customer_deposit_transactions', 'supplier_sales_contacts', 'sales_invoice_items', 'sales_invoice_fees', 'return_items', 'digital_order_items', 'product_bundle_items', 'cash_mutations', 'pos_cart_items', 'pos_cart_fees']) then
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

create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_parent_sku_idx on public.products (parent_sku);
create index if not exists sales_invoices_customer_idx on public.sales_invoices (customer_id);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier);

-- RLS + grant + realtime untuk semua tabel di atas
do $$
declare
  t text;
  tbls text[] := array['products', 'product_sell_units', 'purchase_orders', 'purchase_order_items', 'purchase_order_payments', 'purchase_order_paid_history', 'customers', 'customer_transactions', 'customer_deposit_transactions', 'suppliers', 'supplier_sales_contacts', 'expenses', 'activities', 'branches', 'sales_invoices', 'sales_invoice_items', 'sales_invoice_fees', 'returns', 'return_items', 'digital_orders', 'digital_order_items', 'banners', 'sku_locations', 'staff_list', 'bank_accounts', 'printers', 'opname_submissions', 'product_categories', 'product_brands', 'product_units', 'product_bundles', 'product_bundle_items', 'store_profile', 'store_settings', 'cash_sessions', 'cash_mutations', 'pos_cart_drafts', 'pos_cart_items', 'pos_cart_fees', 'push_tokens'];
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
