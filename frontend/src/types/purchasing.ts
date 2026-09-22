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
  paidMethod?: 'Tunai' | 'Transfer';
  /** Riwayat cicilan pembayaran bon — diisi tiap kali ada pembayaran dari
   * tab Pembayaran > Pembayaran ke Supplier. Bon lunas ketika total cicilan
   * >= total bon. */
  paidHistory?: { date: string; amount: number; method: string; receiptName?: string }[];
  /** Jika true, barang dipesan langsung diantarkan ke customer (tidak masuk
   * gudang toko). Saat status berubah ke Received, stok tidak bertambah —
   * hanya mencatat pengeluaran ke activity. */
  directToCustomer?: boolean;
  /** Nama / catatan customer tujuan untuk pesanan directToCustomer. */
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
