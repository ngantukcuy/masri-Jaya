import { db } from './db/repos';
import type { Repo } from './db/core';

// Semua tabel bisnis yang dikosongkan saat reset. `staff_list` dan
// `store_profile` sengaja TIDAK ikut — itu kredensial login (PIN owner/staf),
// menghapusnya mengunci semua orang (termasuk yang menekan tombol reset).
// `push_tokens` juga dibiarkan (bukan data bisnis).
const TABLES_TO_WIPE: { name: string; repo: Repo<unknown> }[] = [
  ['products', db.products],
  ['purchase_orders', db.purchaseOrders],
  ['customers', db.customers],
  ['suppliers', db.suppliers],
  ['expenses', db.expenses],
  ['activities', db.activities],
  ['branches', db.branches],
  ['sales_invoices', db.salesInvoices],
  ['returns', db.returns],
  ['digital_orders', db.digitalOrders],
  ['banners', db.banners],
  ['sku_locations', db.skuLocations],
  ['bank_accounts', db.bankAccounts],
  ['printers', db.printers],
  ['opname_submissions', db.opnameSubmissions],
  ['product_categories', db.productCategories],
  ['product_brands', db.productBrands],
  ['product_units', db.productUnits],
  ['product_bundles', db.productBundles],
  ['cash_sessions', db.cashSessions],
  ['store_settings', db.storeSettings],
  ['pos_cart_drafts', db.posCartDrafts],
].map(([name, repo]) => ({ name: name as string, repo: repo as Repo<unknown> }));

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

  for (const { name, repo } of TABLES_TO_WIPE) {
    try {
      await repo.reload();
      tables[name] = repo.snapshot();
    } catch (err) {
      errors.push(`${name}: ${(err as Error).message}`);
    }
  }

  if (errors.length >= TABLES_TO_WIPE.length) {
    return { ok: false, errors, json: null };
  }

  const payload = { exportedAt: new Date().toISOString(), tables };
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
 * (store_profile, staff_list) are intentionally left untouched. Irreversible —
 * callers are responsible for confirming with the user before calling this.
 */
export async function resetAllBusinessData(): Promise<ResetAllDataResult> {
  const errors: string[] = [];

  for (const { name, repo } of TABLES_TO_WIPE) {
    try {
      await repo.reload();
      const keys = repo.snapshot().map((row) => repo.keyOf(row));
      if (keys.length === 0) continue;
      await repo.persistDelete(keys); // tulis langsung ke DB & lempar error kalau gagal
      await repo.reload();
    } catch (err) {
      errors.push(`${name}: ${(err as Error).message}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
