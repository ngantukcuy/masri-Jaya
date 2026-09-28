export interface Product {
  name: string;
  sku: string;
  category: string;
  unit: string;
  retailPrice: number;
  wholesalePrice: number;
  projectPrice: number;
  stock: number;
  stockStatus: 'Healthy' | 'Low Stock' | 'Out of Stock';
  lastRestock: string;
  supplier?: string;
  /** Jumlah unit yang masuk di penerimaan PO terakhir — dipakai kartu "Stok Baru Masuk" di halaman Stok. Tidak diisi untuk restock manual. */
  lastRestockQty?: number;
  leadTime: string;
  warehouseLocation: string;
  image: string;
  // ---- Sku Master (Produk Induk & Produk Eceran) - PRD ----
  productType?: 'Induk' | 'Eceran';
  alias?: string;
  brand?: string;
  category1?: string;
  category2?: string;
  category3?: string;
  barcode?: string;
  costPrice?: number;
  minSellPrice?: number;
  standardSellPrice?: number;
  showLowStockAlert?: boolean;
  minStockQty?: number;
  showInDeadstock?: boolean;
  deadstockPeriodMonths?: number;
  skuLocationId?: string;
  // Produk Eceran only: link to induk + conversion value (e.g. 1 sak = 40 kg -> 40)
  parentSku?: string;
  conversionValue?: number;
  // ---- Varian takaran dari satu tumpukan stok (pasir, kerikil, tanah, batu) ----
  // Kalau diisi, produk ini TIDAK punya stok sendiri: setiap terjual, stok
  // dipotong dari produk sumber (mis. "Pasir (kubik)") sebanyak
  // qty × stockPerUnit. Contoh: "Pasir Pickup Besar" → sumber "Pasir", 1,2 kubik.
  stockSourceSku?: string;
  stockPerUnit?: number;
}

// ---- SKU Location (Lokasi Penyimpanan / Gudang) ----
export interface SkuLocation {
  id: string;
  name: string;
  city: string;
  address?: string;
}

// ---- Product Bundles (Paket Barang) ----
export interface BundleItem {
  sku: string;
  name: string;
  quantity: number;
}

export interface Bundle {
  id: string;
  name: string;
  items: BundleItem[];
  bundlePrice: number;
}
