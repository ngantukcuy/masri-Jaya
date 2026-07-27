// Single source of truth for "what can this staff account do" — used by:
//   - SettingsView's "Tambah Staff" form (renders the checkboxes)
//   - Sidebar (hides menu tabs the logged-in staff can't open)
//   - Dashboard/App (blocks direct navigation to a tab that isn't visible)
//   - Individual feature views (hide Tambah/Ubah/Hapus buttons, hide cost price)
//
// A permission is just a string key. `tab_*` keys gate whole pages/menu
// items; the rest gate a specific action inside a page. Everything is
// additive — if a key isn't in a staff member's `permissions` array, that
// capability is off.

export type StaffRole = 'Owner' | 'Admin' | 'Kasir' | 'Stoker';

export interface CurrentUser {
  name: string;
  role: string;
  permissions: string[];
}

/** Every top-level tab in the app (matches the `baseTab` switch in App.tsx / the ids used by Sidebar). */
export const TAB_DEFS: { key: string; label: string }[] = [
  { key: 'tab_dashboard', label: 'Dashboard' },
  { key: 'tab_kas-harian', label: 'Kas Harian' },
  { key: 'tab_pos', label: 'POS Kasir' },
  { key: 'tab_riwayat-transaksi', label: 'Riwayat Transaksi' },
  { key: 'tab_products', label: 'Stok' },
  { key: 'tab_master-data', label: 'Products (Master Data)' },
  { key: 'tab_customer', label: 'Pelanggan' },
  { key: 'tab_pemasok', label: 'Pemasok' },
  { key: 'tab_deposit', label: 'Deposit' },
  { key: 'tab_debts', label: 'Utang & Piutang' },
  { key: 'tab_finance', label: 'Pembayaran / Keuangan' },
  { key: 'tab_purchase', label: 'Pesanan Barang (Purchasing)' },
  { key: 'tab_retur', label: 'Retur' },
  { key: 'tab_toko-digital', label: 'Toko Digital' },
  { key: 'tab_reports', label: 'Laporan' },
  { key: 'tab_settings', label: 'Pengaturan' },
];

/** Granular CRUD permissions inside specific pages. */
export const FEATURE_PERMISSION_DEFS: { key: string; label: string }[] = [
  { key: 'manage_rekening_list', label: 'List Rekening' },
  { key: 'manage_rekening_add', label: 'Tambah Rekening' },
  { key: 'manage_rekening_update', label: 'Ubah Rekening' },
  { key: 'manage_rekening_delete', label: 'Hapus Rekening' },
  { key: 'manage_gudang_list', label: 'List Gudang' },
  { key: 'manage_gudang_add', label: 'Tambah Gudang' },
  { key: 'manage_gudang_update', label: 'Ubah Gudang' },
  { key: 'manage_gudang_delete', label: 'Hapus Gudang' },
  { key: 'manage_customer_list', label: 'List Pelanggan' },
  { key: 'manage_customer_add', label: 'Tambah Pelanggan' },
  { key: 'manage_customer_update', label: 'Ubah Pelanggan' },
  { key: 'manage_customer_delete', label: 'Hapus Pelanggan' },
  { key: 'manage_supplier_list', label: 'List Supplier' },
  { key: 'manage_supplier_add', label: 'Tambah Supplier' },
  { key: 'manage_supplier_update', label: 'Ubah Supplier' },
  { key: 'manage_supplier_delete', label: 'Hapus Supplier' },
  { key: 'manage_product_list', label: 'List Produk' },
  { key: 'manage_product_add', label: 'Tambah Produk' },
  { key: 'manage_product_update', label: 'Ubah Produk' },
  { key: 'manage_product_delete', label: 'Hapus Produk' },
  { key: 'view_cost_price', label: 'Lihat Harga Modal' },
  { key: 'manage_user_list', label: 'List User' },
  { key: 'manage_user_add', label: 'Tambah User' },
  { key: 'manage_user_update', label: 'Ubah User' },
  { key: 'manage_user_delete', label: 'Hapus User' },
  { key: 'manage_retur_approve', label: 'Setujui/Tolak Retur' },
];

export const ALL_PERMISSION_DEFS = [...TAB_DEFS, ...FEATURE_PERMISSION_DEFS];

const ALL_TAB_KEYS = TAB_DEFS.map((t) => t.key);
const ALL_FEATURE_KEYS = FEATURE_PERMISSION_DEFS.map((p) => p.key);

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, string[]> = {
  // Owner always has everything — full tab access + full feature access.
  Owner: [...ALL_TAB_KEYS, ...ALL_FEATURE_KEYS],

  // Admin: full operational access to every tab, and every feature
  // permission except deleting/adding other user accounts (owner-only).
  Admin: [
    ...ALL_TAB_KEYS,
    'manage_rekening_list', 'manage_rekening_add', 'manage_rekening_update', 'manage_rekening_delete',
    'manage_gudang_list', 'manage_gudang_add', 'manage_gudang_update', 'manage_gudang_delete',
    'manage_customer_list', 'manage_customer_add', 'manage_customer_update', 'manage_customer_delete',
    'manage_supplier_list', 'manage_supplier_add', 'manage_supplier_update', 'manage_supplier_delete',
    'manage_product_list', 'manage_product_add', 'manage_product_update', 'manage_product_delete',
    'view_cost_price',
    'manage_user_list',
    'manage_retur_approve',
  ],

  // Kasir: front-of-house/register tabs only, plus basic customer lookup.
  Kasir: [
    'tab_dashboard', 'tab_kas-harian', 'tab_pos', 'tab_riwayat-transaksi',
    'tab_products', 'tab_customer', 'tab_deposit', 'tab_debts',
    'manage_customer_list', 'manage_customer_add', 'manage_product_list',
  ],

  // Stoker: warehouse/stock-side tabs only.
  Stoker: [
    'tab_dashboard', 'tab_products', 'tab_master-data', 'tab_purchase', 'tab_pemasok', 'tab_retur',
    'manage_gudang_list', 'manage_gudang_update',
    'manage_product_list', 'manage_product_update',
    'manage_supplier_list',
  ],
};

/** True if the current user has this exact permission key. Owners implicitly have everything. */
export function hasPermission(user: CurrentUser | null | undefined, key: string): boolean {
  if (!user) return false;
  if (user.role === 'Owner') return true;
  return (user.permissions || []).includes(key);
}

/** True if the current user is allowed to open this top-level tab (base tab id, without the `tab_` prefix or any `:subtab`). */
export function canAccessTab(user: CurrentUser | null | undefined, tabId: string): boolean {
  const baseTab = tabId.split(':')[0];
  return hasPermission(user, `tab_${baseTab}`);
}

/** First tab (in TAB_DEFS order) the user is allowed to open — used as a safe fallback/redirect target. */
export function firstAccessibleTab(user: CurrentUser | null | undefined): string {
  const found = TAB_DEFS.find((t) => hasPermission(user, t.key));
  return found ? found.key.replace(/^tab_/, '') : 'dashboard';
}
