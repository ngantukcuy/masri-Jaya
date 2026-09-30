import { CashSession, CashMutation } from '../types';
import { db } from './db/repos';

// Sesi kas harian disimpan di tabel `cash_sessions` (+ `cash_mutations` untuk
// tiap mutasi uang masuk/keluar). Sesi yang statusnya 'Open' = sesi berjalan,
// yang 'Closed' = riwayat. Semua fungsi di sini menulis langsung ke tabel itu
// lewat db.cashSessions.

const nowTime = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const newMutationId = () => `MUT-${Math.floor(10000 + Math.random() * 90000)}`;

export function getCurrentSession(): CashSession | null {
  return db.cashSessions.snapshot().find((s) => s.status === 'Open') ?? null;
}

/** Dipanggil tiap isi tabel cash_sessions berubah; listener menerima sesi yang sedang buka (atau null). */
export function subscribeCurrentSession(listener: (session: CashSession | null) => void): () => void {
  void db.cashSessions.start();
  listener(getCurrentSession());
  return db.cashSessions.subscribe(() => listener(getCurrentSession()));
}

/** Sama seperti subscribeCurrentSession tapi untuk riwayat sesi yang sudah ditutup. */
export function subscribeSessionHistory(listener: (history: CashSession[]) => void): () => void {
  void db.cashSessions.start();
  listener(getSessionHistory());
  return db.cashSessions.subscribe(() => listener(getSessionHistory()));
}

export function getSessionHistory(): CashSession[] {
  return db.cashSessions
    .snapshot()
    .filter((s) => s.status === 'Closed')
    .slice()
    .sort((a, b) => new Date(b.closedAtISO ?? b.openedAtISO ?? 0).getTime() - new Date(a.closedAtISO ?? a.openedAtISO ?? 0).getTime());
}

function saveSession(session: CashSession) {
  void db.cashSessions.upsert([session]);
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
  saveSession(session);
  return session;
}

// Adds a cash-affecting mutation to the currently open session. No-op (returns null) if no session is open.
export function addMutation(type: 'in' | 'out', category: string, amount: number, note?: string): CashSession | null {
  const current = getCurrentSession();
  if (!current || amount <= 0) return null;

  const mutation: CashMutation = { id: newMutationId(), type, category, amount, note, time: nowTime() };
  const session: CashSession = { ...current, mutations: [mutation, ...current.mutations] };
  saveSession(session);
  return session;
}

// Records a completed sale for reporting purposes (cash sales affect the drawer, non-cash only affect the omzet counter).
export function recordSale(isCash: boolean, invoiceTotal: number, stockQty: number, invoiceNumber: string, cashAmount = invoiceTotal) {
  const current = getCurrentSession();
  if (!current) return;

  let session: CashSession = { ...current };
  if (isCash) {
    const mutation: CashMutation = {
      id: newMutationId(), type: 'in', category: 'Penjualan Tunai', amount: cashAmount,
      note: `Invoice ${invoiceNumber}`, time: nowTime(),
    };
    session = {
      ...session,
      mutations: cashAmount > 0 ? [mutation, ...session.mutations] : session.mutations,
      totalInvoicesCash: session.totalInvoicesCash + 1,
      totalStocksSoldCash: session.totalStocksSoldCash + stockQty,
    };
  } else {
    session = { ...session, totalInvoicesNonCash: session.totalInvoicesNonCash + 1 };
  }
  saveSession(session);
}

/** Reverses the cash-session impact of a deleted sale after approval. */
export function reverseSale(
  paymentMethod: string,
  invoiceTotal: number,
  stockQty: number,
  invoiceNumber: string,
  splitPaidAmount = 0
): CashSession | null {
  const current = getCurrentSession();
  if (!current) return null;

  const isCash = paymentMethod === 'Cash' || paymentMethod === 'Split';
  // Cash: seluruh total keluar dari laci. Split: hanya porsi yang dibayar tunai
  // (sisanya piutang, tidak pernah masuk laci). Metode lain tidak menyentuh laci.
  const refundAmount =
    paymentMethod === 'Cash' ? invoiceTotal : paymentMethod === 'Split' ? splitPaidAmount : 0;

  let session: CashSession = { ...current };
  if (refundAmount > 0) {
    const mutation: CashMutation = {
      id: newMutationId(), type: 'out', category: 'Transaksi Dibatalkan', amount: refundAmount,
      note: `Pengembalian ${invoiceNumber}`, time: nowTime(),
    };
    session = { ...session, mutations: [mutation, ...session.mutations] };
  }

  if (isCash) {
    session = {
      ...session,
      totalInvoicesCash: Math.max(0, session.totalInvoicesCash - 1),
      totalStocksSoldCash: Math.max(0, session.totalStocksSoldCash - stockQty),
    };
  } else {
    session = { ...session, totalInvoicesNonCash: Math.max(0, session.totalInvoicesNonCash - 1) };
  }
  saveSession(session);
  return session;
}

export function getMutationTotals(session: CashSession) {
  const totalIn = session.mutations.filter(m => m.type === 'in').reduce((acc, m) => acc + m.amount, 0);
  const totalOut = session.mutations.filter(m => m.type === 'out').reduce((acc, m) => acc + m.amount, 0);
  const systemTotal = session.openingBalance + totalIn - totalOut;
  return { totalIn, totalOut, systemTotal };
}

export function closeSession(actualCash: number): CashSession | null {
  const current = getCurrentSession();
  if (!current) return null;

  const now = new Date();
  const session: CashSession = {
    ...current,
    status: 'Closed',
    closedAt: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    closedAtISO: now.toISOString(),
    closingActual: actualCash,
  };
  saveSession(session);
  return session;
}
