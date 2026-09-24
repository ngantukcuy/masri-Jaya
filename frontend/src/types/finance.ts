export interface Expense {
  id: string;
  /** Tanggal pengeluaran (ISO yyyy-mm-dd), dipilih manual lewat form — bukan selalu hari ini. */
  date: string;
  category: 'Bensin' | 'Gaji' | 'Bon' | 'Lainnya';
  description: string;
  submittedBy: string;
  amount: number;
  receiptName: string;
  /** URL bukti pengeluaran (foto nota/struk) yang diupload ke Supabase Storage, kalau ada. */
  receiptUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  /** Metode bayar pengeluaran ini. 'Tunai Kas' mengurangi Kas Harian toko;
   * 'Tunai Luar' juga dibayar cash tapi BUKAN dari kas toko (mis. uang
   * pribadi/di luar kasir) sehingga tidak menyentuh mutasi Kas Harian.
   * Transfer/Giro juga tidak menyentuh Kas Harian. */
  paymentMethod?: 'Tunai Kas' | 'Tunai Luar' | 'Transfer' | 'Giro';
  expenseDate?: string;
  receiptFile?: string;
  /** Diisi Owner saat menyetujui/menolak pengeluaran yang berstatus Pending. */
  approvedBy?: string;
  approvedAt?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'Bank' | 'E-Wallet' | 'QRIS' | 'Cash';
  accountNumber?: string;
  holderName?: string;
  notes?: string;
  /** Public URL of the uploaded QRIS code image, used when type is 'QRIS'
   * so the POS payment modal can show the store's real QRIS instead of a
   * placeholder icon. */
  qrisImageUrl?: string;
}

// ---- Kas Harian (Daily Cash) ----
export interface CashMutation {
  id: string;
  type: 'in' | 'out';
  category: string;
  amount: number;
  note?: string;
  time: string;
}

export interface CashSession {
  id: string;
  date: string;
  openedAt: string;
  closedAt?: string;
  /** ISO timestamp versi lengkap dari openedAt/closedAt, dipakai untuk
   * mencocokkan invoice penjualan & retur yang terjadi selama sesi ini
   * (lihat KasHarianDetailModal). */
  openedAtISO?: string;
  closedAtISO?: string;
  /** Nama kasir yang membuka sesi (diambil dari user yang sedang login). */
  cashierName?: string;
  status: 'Open' | 'Closed';
  openingBalance: number;
  mutations: CashMutation[];
  totalInvoicesCash: number;
  totalStocksSoldCash: number;
  totalInvoicesNonCash: number;
  closingActual?: number;
}
