export interface Expense {
  id: string;
  date: string;
  category: 'Logistics' | 'Supplies' | 'Travel' | 'Utility' | 'Office';
  description: string;
  submittedBy: string;
  amount: number;
  receiptName: string;
  status: 'Pending' | 'Approved' | 'Rejected';
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
