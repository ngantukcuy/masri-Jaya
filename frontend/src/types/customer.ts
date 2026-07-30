export interface CustomerTransaction {
  orderName: string;
  date: string;
  amount: number;
}

export interface Customer {
  id: string;
  name: string;
  loyaltyTier: string;
  points: number;
  currentDebt: number;
  totalPurchases: number;
  debtStatus: 'Cleared' | 'Overdue' | 'Pending';
  overdueAmount?: number;
  pendingAmount?: number;
  logoLetters: string;
  lastTransactions: CustomerTransaction[];
  customerType?: 'Toko' | 'Perusahaan' | 'Perusahaan Project' | 'Perorangan Retail';
  phone?: string;
  address?: string;
  paymentTerms?: 'Tunai' | 'Tempo';
  tempoDays?: number;
  creditLimit?: number;
  depositBalance?: number;
  /** ISO date (yyyy-mm-dd) of the earliest outstanding piutang due date —
   * set automatically from a POS "Bayar Sebagian" split (today + tempoDays)
   * or manually from Utang & Piutang > Tambah Hutang. Cleared once
   * currentDebt reaches 0. */
  nextDueDate?: string;
}
