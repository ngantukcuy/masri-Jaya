import { CashSession, CashMutation } from '../types';
import { getSupabaseCache, setSupabaseCache } from './supabaseCache';

const CURRENT_KEY = 'cash_session_current';
const HISTORY_KEY = 'cash_session_history';

export function getCurrentSession(): CashSession | null {
  const cached = getSupabaseCache<CashSession | null>(CURRENT_KEY, null);
  if (!cached || cached.status !== 'Open') return null;
  return cached;
}

export function getSessionHistory(): CashSession[] {
  return getSupabaseCache<CashSession[]>(HISTORY_KEY, []);
}

export function openSession(openingBalance: number, cashierName?: string): CashSession {
  const now = new Date();
  const session: CashSession = {
    id: `KAS-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`,
    date: now.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
    openedAt: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    openedAtISO: now.toISOString(),
    cashierName,
    status: 'Open',
    openingBalance,
    mutations: [],
    totalInvoicesCash: 0,
    totalStocksSoldCash: 0,
    totalInvoicesNonCash: 0,
  };
  setSupabaseCache(CURRENT_KEY, session);
  return session;
}

// Adds a cash-affecting mutation to the currently open session. No-op (returns null) if no session is open.
export function addMutation(type: 'in' | 'out', category: string, amount: number, note?: string): CashSession | null {
  const session = getCurrentSession();
  if (!session || amount <= 0) return null;

  const mutation: CashMutation = {
    id: `MUT-${Math.floor(10000 + Math.random() * 90000)}`,
    type,
    category,
    amount,
    note,
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };
  session.mutations = [mutation, ...session.mutations];
  setSupabaseCache(CURRENT_KEY, session);
  return session;
}

// Records a completed sale for reporting purposes (cash sales affect the drawer, non-cash only affect the omzet counter).
export function recordSale(isCash: boolean, invoiceTotal: number, stockQty: number, invoiceNumber: string) {
  const session = getCurrentSession();
  if (!session) return;

  if (isCash) {
    addMutation('in', 'Penjualan Tunai', invoiceTotal, `Invoice ${invoiceNumber}`);
    session.totalInvoicesCash += 1;
    session.totalStocksSoldCash += stockQty;
  } else {
    session.totalInvoicesNonCash += 1;
  }
  setSupabaseCache(CURRENT_KEY, session);
}

export function getMutationTotals(session: CashSession) {
  const totalIn = session.mutations.filter(m => m.type === 'in').reduce((acc, m) => acc + m.amount, 0);
  const totalOut = session.mutations.filter(m => m.type === 'out').reduce((acc, m) => acc + m.amount, 0);
  const systemTotal = session.openingBalance + totalIn - totalOut;
  return { totalIn, totalOut, systemTotal };
}

export function closeSession(actualCash: number): CashSession | null {
  const session = getCurrentSession();
  if (!session) return null;

  const now = new Date();
  session.status = 'Closed';
  session.closedAt = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  session.closedAtISO = now.toISOString();
  session.closingActual = actualCash;

  const history = getSessionHistory();
  const updatedHistory = [session, ...history];
  setSupabaseCache(HISTORY_KEY, updatedHistory);
  setSupabaseCache(CURRENT_KEY, null);
  return session;
}
