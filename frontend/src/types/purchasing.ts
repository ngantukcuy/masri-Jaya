export interface POPayment {
  id: string;
  /** Nominal yang dibayarkan pada cicilan/pembayaran ini (bukan sisa atau total). */
  amount: number;
  /** 'Tunai' = data lama sebelum metode disamakan dengan Pembayaran Lainnya. */
  method: 'Tunai Kas' | 'Tunai Luar' | 'Transfer' | 'Giro' | 'Tunai';
  date: string;
  /** URL bukti bayar (foto struk/transfer) yang diupload ke Supabase Storage. */
  proofUrl?: string;
  by?: string;
}

export interface POItem {
  name: string;
  sku: string;
  quantity: number;
  price: number;
  taxIncluded?: boolean;
  discountPerUnit?: number;
  totalDiscount?: number;
  locationId?: string;
  bonus?: boolean;
}

export interface PO {
  poNumber: string;
  supplier: string;
  total: number;
  status: 'Draft' | 'Approved' | 'Ordered' | 'In Transit' | 'Received';
  items: POItem[];
  createdDate: string;
  logisticsNote: string;
  paymentMethod?: 'Cash' | 'Transfer' | 'Tempo';
  deliveryNoteNumber?: string;
  taxIncluded?: boolean;
  totalDiscount?: number;
  additionalCost?: number;
  additionalCostName?: string;
  receivedAt?: string;
  dueDate?: string;
  /** Diisi saat bon dibayar dari halaman Pembayaran > Pembayaran ke Supplier
   * (dipakai untuk bon Tempo). Bon Cash/Transfer dianggap lunas saat diterima. */
  paidAt?: string;
  paidAmount?: number;
  paidMethod?: 'Tunai Kas' | 'Tunai Luar' | 'Transfer' | 'Giro' | 'Tunai';
  /** Riwayat cicilan pembayaran bon ini (tiap entri bisa punya bukti bayar sendiri). */
  paymentHistory?: POPayment[];
  paidHistory?: { date: string; amount: number; method: string; receiptName?: string }[];
  /** True kalau barang pesanan ini dikirim langsung ke customer oleh
   * supplier (dropship) — tidak pernah singgah/masuk ke gudang toko, jadi
   * saat "Konfirmasi Barang Diterima" stok TIDAK ditambah. Tetap tercatat
   * sebagai bon/hutang ke supplier seperti biasa di Pembayaran > Supplier. */
  dropship?: boolean;
  /** Catatan opsional tujuan pengiriman dropship (mis. nama/alamat customer). */
  dropshipNote?: string;
  directToCustomer?: boolean;
  directToCustomerName?: string;
}

export interface Supplier {
  name: string;
  rating: number;
  recentPO: string;
  debt: number;
  leadTimeStability: number;
  logoLetters: string;
  phone?: string;
  npwp?: string;
  address?: string;
  salesName?: string;
  salesPhone?: string;
  additionalSales?: { name: string; phone: string }[];
  topDays?: number;
}
