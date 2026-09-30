// Daftar semua tabel yang dipakai app. Satu baris per tabel Supabase.
import { createRepo, type Repo } from './core';
import type {
  Product, PO, Customer, Supplier, Expense, Activity, Branch, SalesInvoice, ReturnRecord,
  DigitalOrder, Banner, SkuLocation, StaffMember, BankAccount, Printer, OpnameSubmission,
  ProductCategory, ProductBrand, ProductUnit, Bundle, CashSession, StoreOwner, StoreSettings,
} from '../../types';

/** Baris draft keranjang kasir (tabel pos_cart_drafts + pos_cart_items + pos_cart_fees). */
export interface PosCartDraft {
  id: string;
  selectedCustomerId?: string;
  discountMode?: 'percent' | 'fixed';
  discountValue?: number;
  additionalFeeName?: string;
  additionalFee?: number;
  paymentMethod?: string;
  fulfillmentMethod?: 'Pickup' | 'Delivery';
  deliveryAddress?: string;
  cart: {
    productSku: string;
    quantity: number;
    selectedPriceType: 'retail' | 'wholesale' | 'project';
    customPrice?: number;
    bonus?: boolean;
    notes?: string;
  }[];
  additionalFees: { name: string; amount: number }[];
}

export interface PushTokenRow {
  token: string;
  platform?: string;
  deviceLabel?: string;
  role?: string;
  updatedAt?: string;
}

export const SINGLETON_ID = 'main';

export const db = {
  products: createRepo<Product>('products'),
  purchaseOrders: createRepo<PO>('purchase_orders'),
  customers: createRepo<Customer>('customers'),
  suppliers: createRepo<Supplier>('suppliers'),
  expenses: createRepo<Expense>('expenses'),
  activities: createRepo<Activity>('activities'),
  branches: createRepo<Branch>('branches'),
  salesInvoices: createRepo<SalesInvoice>('sales_invoices'),
  returns: createRepo<ReturnRecord>('returns'),
  digitalOrders: createRepo<DigitalOrder>('digital_orders'),
  banners: createRepo<Banner>('banners'),
  skuLocations: createRepo<SkuLocation>('sku_locations'),
  staff: createRepo<StaffMember>('staff_list'),
  bankAccounts: createRepo<BankAccount>('bank_accounts'),
  printers: createRepo<Printer>('printers'),
  opnameSubmissions: createRepo<OpnameSubmission>('opname_submissions'),
  productCategories: createRepo<ProductCategory>('product_categories'),
  productBrands: createRepo<ProductBrand>('product_brands'),
  productUnits: createRepo<ProductUnit>('product_units'),
  productBundles: createRepo<Bundle>('product_bundles'),
  cashSessions: createRepo<CashSession>('cash_sessions'),
  pushTokens: createRepo<PushTokenRow>('push_tokens'),
  // Tabel satu-baris (id selalu 'main')
  storeProfile: createRepo<StoreOwner & { id: string }>('store_profile'),
  storeSettings: createRepo<StoreSettings & { id: string }>('store_settings'),
  posCartDrafts: createRepo<PosCartDraft>('pos_cart_drafts'),
};

/** Tabel yang dimuat begitu user login (semua kecuali yang khusus layar login). */
export function startBusinessRepos(): Promise<unknown> {
  const skip = new Set<Repo<unknown>>();
  return Promise.all(
    Object.values(db)
      .filter((r) => !skip.has(r as Repo<unknown>))
      .map((r) => (r as Repo<unknown>).start())
  );
}

// ----- helper tabel satu-baris -----
export function getStoreProfile(): StoreOwner | null {
  return db.storeProfile.snapshot()[0] ?? null;
}
export function saveStoreProfile(value: StoreOwner | null): Promise<void> {
  return value
    ? db.storeProfile.upsert([{ ...value, id: SINGLETON_ID }])
    : db.storeProfile.remove([SINGLETON_ID]);
}
export function getStoreSettings(): StoreSettings {
  return db.storeSettings.snapshot()[0] ?? {};
}
export function patchStoreSettings(patch: Partial<StoreSettings>): Promise<void> {
  return db.storeSettings.upsert([{ ...getStoreSettings(), ...patch, id: SINGLETON_ID }]);
}
