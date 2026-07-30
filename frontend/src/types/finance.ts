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
  status: 'Open' | 'Closed';
  openingBalance: number;
  mutations: CashMutation[];
  totalInvoicesCash: number;
  totalStocksSoldCash: number;
  totalInvoicesNonCash: number;
  closingActual?: number;
}
