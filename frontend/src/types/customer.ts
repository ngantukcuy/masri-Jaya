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
}
