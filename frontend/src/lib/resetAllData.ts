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

export interface BackupResult {
  ok: boolean;
  errors: string[];
  /** JSON string ready to write to a file, or null if the backup failed outright. */
  json: string | null;
}

/**
 * Snapshots every table that `resetAllBusinessData` is about to wipe into a
 * single JSON blob, so a botched or accidental reset isn't unrecoverable.
 * Read-only — safe to call any time, not just right before a reset.
 */
export async function backupAllBusinessData(): Promise<BackupResult> {
  const errors: string[] = [];
  const tables: Record<string, unknown> = {};

  for (const table of LIST_TABLES_TO_WIPE) {
    const { data, error } = await supabase.from(table).select('key, data');
    if (error) {
      errors.push(`${table}: ${error.message}`);
      continue;
    }
    tables[table] = data ?? [];
  }

  for (const table of SINGLETON_TABLES_TO_WIPE) {
    const { data, error } = await supabase.from(table).select('value').eq('id', 1).maybeSingle();
    if (error) {
      errors.push(`${table}: ${error.message}`);
      continue;
    }
    tables[table] = data?.value ?? null;
  }

  // A backup where every single table errored out isn't worth downloading —
  // surface it as a hard failure instead of a 0-byte "success".
  if (errors.length >= LIST_TABLES_TO_WIPE.length + SINGLETON_TABLES_TO_WIPE.length) {
    return { ok: false, errors, json: null };
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    tables,
  };

  return { ok: errors.length === 0, errors, json: JSON.stringify(payload, null, 2) };
}

/** Triggers a browser download of the backup JSON — call after `backupAllBusinessData()`. */
export function downloadBackupJson(json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `tokku-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
