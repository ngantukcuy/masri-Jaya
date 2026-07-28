import { supabase } from './supabase';

// Full table list lives in backend/supabase/schema.sql. `staff_list` and
// `store_owner` are deliberately EXCLUDED from both lists below — those are
// login credentials (owner PIN, staff PINs), and wiping them would lock
// everyone (including whoever clicked the reset button) out of the app.
//
// One-row-per-item tables: every row gets deleted.
const LIST_TABLES_TO_WIPE = [
  'products',
  'purchase_orders',
  'customers',
  'suppliers',
  'expenses',
  'activities',
  'branches',
  'sales_invoices',
  'returns',
  'digital_orders',
  'banners',
  'sku_locations',
  'bank_accounts',
  'printers',
  'opname_submissions',
  'product_categories',
  'product_brands',
  'product_units',
  'product_bundles',
] as const;

// Single-row (id = 1) tables: deleting the row is safe. Every reader
// (useSupabaseState / getSupabaseCache) re-seeds its own default value
// (0, '', null, []) the next time it loads when no row is found — that's
// exactly the "reset" behavior we want here.
const SINGLETON_TABLES_TO_WIPE = [
  'ecommerce_username',
  'total_sales',
  'total_orders_count',
  'cash_session_current',
  'cash_session_history',
  'pos_cart_state',
] as const;

export interface ResetAllDataResult {
  ok: boolean;
  errors: string[];
}

/**
 * Wipes every business/transactional table (products, customers, sales,
 * expenses, cash sessions, etc.) back to empty. Login credentials
 * (store_owner, staff_list) are intentionally left untouched. Irreversible —
 * callers are responsible for confirming with the user before calling this.
 */
export async function resetAllBusinessData(): Promise<ResetAllDataResult> {
  const errors: string[] = [];

  for (const table of LIST_TABLES_TO_WIPE) {
    const { data, error: selectError } = await supabase.from(table).select('key');
    if (selectError) {
      errors.push(`${table}: ${selectError.message}`);
      continue;
    }
    const keys = (data ?? []).map((row: { key: string }) => row.key);
    if (keys.length === 0) continue;
    const { error: deleteError } = await supabase.from(table).delete().in('key', keys);
    if (deleteError) errors.push(`${table}: ${deleteError.message}`);
  }

  for (const table of SINGLETON_TABLES_TO_WIPE) {
    const { error } = await supabase.from(table).delete().eq('id', 1);
    if (error) errors.push(`${table}: ${error.message}`);
  }

  return { ok: errors.length === 0, errors };
}
