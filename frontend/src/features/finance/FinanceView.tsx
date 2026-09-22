import React, { useState } from 'react';
import { 
  Wallet, 
  TrendingDown, 
  Plus, 
  Check,
  X
} from 'lucide-react';
import { Expense, PO, POPayment, SalesInvoice } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import { uploadProductImage } from '../../lib/uploadProductImage';
import NumberInput from '../../components/shared/NumberInput';
import Pagination, { PAGE_SIZE } from '../../components/shared/Pagination';
import PODetailDialog from '../../components/shared/PODetailDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { toDateInputValue } from '../../lib/dateBuckets';

interface FinanceViewProps {
  expenses: Expense[];
  onUpdateExpenses: (updatedExpenses: Expense[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  currentUser?: CurrentUser | null;
  /** Bon/PO dari supplier — sumber data tab "Pembayaran ke Supplier". */
  pos?: PO[];
  onUpdatePOs?: (updatedPOs: PO[]) => void;
  /** Invoice penjualan — sumber data tab "Penjualan". */
  salesInvoices?: SalesInvoice[];
}

type FinanceTab = 'supplier' | 'lainnya' | 'penjualan';
type SupplierFilter = 'semua' | 'belum' | 'lunas';

const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`;

function fmtDate(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Bon Cash/Transfer dianggap lunas saat barang diterima; bon Tempo (atau bon
 * lama tanpa metode bayar) baru lunas setelah dibayar penuh (bisa dicicil)
 * lewat tab ini — paidAt di-set otomatis begitu paidAmount menyamai total. */
const isPOPaid = (po: PO) => !!po.paidAt || po.paymentMethod === 'Cash' || po.paymentMethod === 'Transfer';
const poRemaining = (po: PO) => Math.max(0, po.total - (po.paidAmount || 0));

const PAYMENT_LABEL: Record<string, string> = { Cash: 'Tunai', Split: 'Split' };

interface PendingApproval {
  id: string;
  item: string;
  submittedBy: string;
  amount: number;
  category: 'Bensin' | 'Gaji' | 'Bon' | 'Lainnya';
}

export default function FinanceView({ expenses, onUpdateExpenses, onAddActivity, currentUser, pos = [], onUpdatePOs, salesInvoices = [] }: FinanceViewProps) {
  const dialog = useDialog();
  // Same gap as the retur bug: without this, anyone who can open the Finance
  // tab could approve/reject reimbursement claims regardless of role.
  const canApproveFinance = hasPermission(currentUser, 'manage_finance_approve');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('Semua');
  const [expensePage, setExpensePage] = useState(1);

  // Tab halaman Pembayaran + state tiap tab
  const [activeTab, setActiveTab] = useState<FinanceTab>('supplier');
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>('semua');
  const [supplierPage, setSupplierPage] = useState(1);
  const [salesFilter, setSalesFilter] = useState<string>('Semua');
  const [salesPage, setSalesPage] = useState(1);
  const [previewPO, setPreviewPO] = useState<PO | null>(null);
  const [payingPO, setPayingPO] = useState<PO | null>(null);
  const [payMethod, setPayMethod] = useState<'Tunai' | 'Transfer'>('Tunai');
  const [payAmountInput, setPayAmountInput] = useState(0);
  const [payProofFile, setPayProofFile] = useState<File | null>(null);
  const [isPaySubmitting, setIsPaySubmitting] = useState(false);

  // Translate categories
  const categoryTranslationMap: Record<string, string> = {
    'Bensin': 'Bensin / Transportasi',
    'Gaji': 'Gaji Karyawan',
    'Bon': 'Bon / Tagihan',
    'Lainnya': 'Lainnya'
  };

  // Pending claims in IDR equivalents (local queue — not yet wired to a shared backend table)
  const [pendingClaims, setPendingClaims] = useState<PendingApproval[]>([]);

  // Form states for new expense
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpAmount, setNewExpAmount] = useState(150000);
  const [newExpCat, setNewExpCat] = useState<'Bensin' | 'Gaji' | 'Bon' | 'Lainnya'>('Bensin');
  const [newExpUser, setNewExpUser] = useState('');
  const [newExpMethod, setNewExpMethod] = useState<'Tunai Kas' | 'Tunai Luar' | 'Transfer' | 'Giro'>('Tunai Kas');
  const [newExpDate, setNewExpDate] = useState(() => toDateInputValue(new Date()));
  const [newExpProofFile, setNewExpProofFile] = useState<File | null>(null);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);

  const handleApproveClaim = (claim: PendingApproval) => {
    if (!canApproveFinance) {
      dialog.alert("Anda tidak memiliki izin untuk menyetujui klaim reimbursement. Hubungi Owner/Admin.");
      return;
    }
    // 1. Move to Expense ledger
    const nextExpense: Expense = {
      id: `EXP-APR-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toLocaleDateString('id-ID'),
      category: claim.category,
      description: claim.item,
      submittedBy: claim.submittedBy,
      amount: claim.amount,
      receiptName: "NOTA_REIMBURSEMENT.pdf",
      status: 'Approved'
    };

    onUpdateExpenses([nextExpense, ...expenses]);

    // 2. Clear pending list
    setPendingClaims(pendingClaims.filter(c => c.id !== claim.id));
    addMutation('out', 'Pembayaran Lainnya', claim.amount, `Reimbursement: ${claim.item} (${claim.submittedBy})`);

    onAddActivity(
      `Klaim Disetujui: Rp ${claim.amount.toLocaleString('id-ID')}`,
      `Klaim reimbursement ${claim.id} disetujui untuk ${claim.submittedBy}`,
      claim.amount,
      'overdue'
    );

    dialog.alert(`Klaim reimbursement ${claim.id} sebesar Rp ${claim.amount.toLocaleString('id-ID')} berhasil disetujui dan dicatat.`);
  };

  const handleRejectClaim = (claim: PendingApproval) => {
    if (!canApproveFinance) {
      dialog.alert("Anda tidak memiliki izin untuk menolak klaim reimbursement. Hubungi Owner/Admin.");
      return;
    }
    setPendingClaims(pendingClaims.filter(c => c.id !== claim.id));
    onAddActivity(
      `Klaim Ditolak: ${claim.id}`,
      `Klaim reimbursement ${claim.item} milik ${claim.submittedBy} ditolak`,
      0,
      'quote'
    );
    dialog.alert(`Klaim reimbursement ${claim.id} yang diajukan oleh ${claim.submittedBy} telah ditolak.`);
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpDesc || !newExpUser) {
      dialog.alert("Silakan lengkapi seluruh kolom formulir pengeluaran!");
      return;
    }
    if (!newExpDate) {
      dialog.alert("Silakan pilih tanggal pengeluaran!");
      return;
    }

    setIsExpenseSubmitting(true);
    try {
      let receiptUrl: string | undefined;
      if (newExpProofFile) {
        receiptUrl = await uploadProductImage(newExpProofFile, 'bukti-pengeluaran');
      }

      const nextExpense: Expense = {
        id: `EXP-MAN-${Math.floor(1000 + Math.random() * 9000)}`,
        date: newExpDate,
        expenseDate: newExpDate,
        category: newExpCat,
        description: newExpDesc,
        submittedBy: newExpUser,
        amount: newExpAmount,
        receiptName: newExpProofFile ? newExpProofFile.name : "BUKTI_MANUAL.pdf",
        receiptFile: newExpProofFile ? newExpProofFile.name : undefined,
        receiptUrl,
        paymentMethod: newExpMethod,
        status: 'Approved'
      };

      onUpdateExpenses([nextExpense, ...expenses]);
      setShowSubmitModal(false);

      // Hanya "Tunai Kas" yang benar-benar keluar dari laci Kas Harian toko —
      // "Tunai Luar" tetap tunai tapi bukan dari kas toko (mis. uang pribadi).
      if (newExpMethod === 'Tunai Kas') {
        addMutation('out', 'Pembayaran Lainnya', newExpAmount, `${categoryTranslationMap[newExpCat]}: ${newExpDesc}`);
      }

      onAddActivity(
        `Pengeluaran Toko Dicatat`,
        `${newExpDesc} oleh ${newExpUser}`,
        newExpAmount,
        'overdue'
      );

      // Reset forms
      setNewExpDesc('');
      setNewExpAmount(150000);
      setNewExpUser('');
      setNewExpMethod('Tunai Kas');
      setNewExpDate(toDateInputValue(new Date()));
      setNewExpProofFile(null);
      dialog.alert("Klaim pengeluaran kas toko berhasil disimpan ke dalam log buku kas!");
    } catch (err) {
      dialog.alert(err instanceof Error ? err.message : 'Gagal menyimpan pengeluaran, silakan coba lagi.');
    } finally {
      setIsExpenseSubmitting(false);
    }
  };

  // ---- Tab: Pembayaran ke Supplier ----
  // Sumber datanya sama dengan tabel di Stok > Stok Supplier (bon yang sudah
  // masuk / sedang dalam perjalanan), jadi tiap bon baru otomatis muncul di sini.
  const supplierBons = pos
    .filter((po) => po.status === 'Received' || po.status === 'In Transit' || po.receivedAt)
    .sort((a, b) => (b.receivedAt || b.createdDate).localeCompare(a.receivedAt || a.createdDate));
  const todayISO = new Date().toISOString().slice(0, 10);
  const unpaidBons = supplierBons.filter((po) => !isPOPaid(po));
  const unpaidTotal = unpaidBons.reduce((sum, po) => sum + poRemaining(po), 0);
  const overdueBons = unpaidBons.filter((po) => po.paymentMethod === 'Tempo' && po.dueDate && po.dueDate < todayISO);
  const filteredBons = supplierBons.filter((po) => {
    if (supplierFilter === 'belum') return !isPOPaid(po);
    if (supplierFilter === 'lunas') return isPOPaid(po);
    return true;
  });
  const supplierPageCount = Math.ceil(filteredBons.length / PAGE_SIZE);
  const safeSupplierPage = Math.min(supplierPage, Math.max(1, supplierPageCount));

  const openPayDialog = (po: PO) => {
    setPayMethod('Tunai');
    setPayAmountInput(poRemaining(po));
    setPayProofFile(null);
    setPayingPO(po);
  };

  const handlePaySupplierBon = async () => {
    if (!payingPO || !onUpdatePOs) return;
    const po = payingPO;
    const remaining = poRemaining(po);
    const amount = payAmountInput;

    if (!amount || amount <= 0) {
      dialog.alert('Masukkan nominal pembayaran yang valid!');
      return;
    }
    if (amount > remaining) {
      dialog.alert(`Nominal pembayaran melebihi sisa bon (${rupiah(remaining)})!`);
      return;
    }

    setIsPaySubmitting(true);
    try {
      let proofUrl: string | undefined;
      if (payProofFile) {
        proofUrl = await uploadProductImage(payProofFile, 'bukti-bayar-supplier');
      }

      const newPaidAmount = (po.paidAmount || 0) + amount;
      const isFullyPaid = newPaidAmount >= po.total;
      const paymentEntry: POPayment = {
        id: `PAY-${Date.now()}`,
        amount,
        method: payMethod,
        date: new Date().toISOString(),
        proofUrl,
        by: currentUser?.name,
      };
      const paidHistoryEntry = {
        date: new Date().toISOString(),
        amount,
        method: payMethod,
        receiptName: payProofFile ? payProofFile.name : undefined,
      };

      onUpdatePOs(pos.map((item) => item.poNumber === po.poNumber
        ? {
          ...item,
          paidAmount: newPaidAmount,
          paidAt: isFullyPaid ? new Date().toISOString() : item.paidAt,
          paidMethod: payMethod,
          paymentHistory: [...(item.paymentHistory || []), paymentEntry],
          paidHistory: [...(item.paidHistory || []), paidHistoryEntry],
        }
        : item));

      if (payMethod === 'Tunai') {
        const session = addMutation('out', 'Pembayaran Hutang', amount, `${isFullyPaid ? 'Lunas' : 'Cicilan'} bon ${po.poNumber} - ${po.supplier}`);
        if (!session) {
          dialog.alert('Pembayaran dicatat, tapi Kas Harian belum dibuka sehingga uang keluar tunai belum tercatat di kas.');
        }
      }
      onAddActivity(
        isFullyPaid ? `Bon Supplier Lunas: ${po.poNumber}` : `Cicilan Bon Supplier: ${po.poNumber}`,
        `Pembayaran ${payMethod.toLowerCase()} ${rupiah(amount)} ke ${po.supplier}`,
        amount,
        'overdue'
      );

      setPayingPO(isFullyPaid ? null : { ...po, paidAmount: newPaidAmount, paymentHistory: [...(po.paymentHistory || []), paymentEntry] });
      setPayAmountInput(isFullyPaid ? 0 : Math.max(0, remaining - amount));
      setPayProofFile(null);
      dialog.alert(isFullyPaid
        ? `Bon ${po.poNumber} sebesar ${rupiah(po.total)} berhasil dilunasi.`
        : `Cicilan ${rupiah(amount)} untuk bon ${po.poNumber} berhasil dicatat. Sisa: ${rupiah(Math.max(0, remaining - amount))}.`);
    } catch (err) {
      dialog.alert(err instanceof Error ? err.message : 'Gagal menyimpan pembayaran, silakan coba lagi.');
    } finally {
      setIsPaySubmitting(false);
    }
  };

  // ---- Tab: Penjualan ----
  const invoiceTime = (inv: SalesInvoice) => {
    const t = inv.createdAt ? new Date(inv.createdAt).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
  };
  const sortedInvoices = [...salesInvoices].sort((a, b) => invoiceTime(b) - invoiceTime(a));
  const salesMethods = ['Semua', ...Array.from(new Set(salesInvoices.map((inv) => inv.paymentMethod).filter(Boolean)))];
  const filteredInvoices = sortedInvoices.filter((inv) => salesFilter === 'Semua' || inv.paymentMethod === salesFilter);
  const salesTotal = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const salesPageCount = Math.ceil(filteredInvoices.length / PAGE_SIZE);
  const safeSalesPage = Math.min(salesPage, Math.max(1, salesPageCount));

  const totalExpensesThisMonth = expenses.reduce((acc, e) => acc + e.amount, 0);

  // Daftar pengeluaran operasional untuk tab ini — sumbernya cuma `expenses`
  // (kategori sudah dibatasi ke Bensin/Gaji/Bon/Lainnya), jadi tidak perlu
  // sentuh mutasi Kas Harian sama sekali dan tidak ada celah data penjualan
  // atau bon supplier ikut nyasar ke sini.
  const filteredExpenses = expenses.filter((e) => expenseCategoryFilter === 'Semua' || e.category === expenseCategoryFilter);
  const expensePageCount = Math.ceil(filteredExpenses.length / PAGE_SIZE);
  const safeExpensePage = Math.min(expensePage, Math.max(1, expensePageCount));

  return (
    <div className="space-y-6">
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinanceTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="supplier" className="text-sm">Pembayaran ke Supplier</TabsTrigger>
          <TabsTrigger value="lainnya" className="text-sm">Pembayaran Lainnya</TabsTrigger>
          <TabsTrigger value="penjualan" className="text-sm">Penjualan</TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: Pembayaran ke Supplier ===== */}
        <TabsContent value="supplier" className="mt-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Total Bon Masuk</p>
              <h4 className="text-lg font-black text-gray-800 mt-0.5">{supplierBons.length} bon</h4>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Belum Dibayar</p>
              <h4 className="text-lg font-black text-amber-600 mt-0.5">{rupiah(unpaidTotal)}</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">{unpaidBons.length} bon</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Lewat Jatuh Tempo</p>
              <h4 className={`text-lg font-black mt-0.5 ${overdueBons.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>{overdueBons.length} bon</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">{rupiah(overdueBons.reduce((sum, po) => sum + poRemaining(po), 0))}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-gray-800">Bon dari Supplier</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">Bon yang masuk lewat Stok &gt; Stok Supplier. Klik baris untuk melihat isi bon.</p>
              </div>
              <div className="flex gap-1.5">
                {([['semua', 'Semua'], ['belum', 'Belum Lunas'], ['lunas', 'Lunas']] as [SupplierFilter, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSupplierFilter(key); setSupplierPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      supplierFilter === key ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Tgl</TableHead>
                  <TableHead>Nomor PO</TableHead>
                  <TableHead>Pemasok</TableHead>
                  <TableHead className="text-right">Total Bon</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-8 text-center text-gray-400 font-bold">
                      {supplierBons.length === 0 ? 'Belum ada bon masuk dari supplier.' : 'Tidak ada bon yang cocok dengan filter.'}
                    </TableCell>
                  </TableRow>
                ) : filteredBons.slice((safeSupplierPage - 1) * PAGE_SIZE, safeSupplierPage * PAGE_SIZE).map((po) => {
                  const paid = isPOPaid(po);
                  const overdue = !paid && po.paymentMethod === 'Tempo' && !!po.dueDate && po.dueDate < todayISO;
                  return (
                    <TableRow key={po.poNumber} onClick={() => setPreviewPO(po)} className="cursor-pointer" title="Klik untuk melihat isi bon">
                      <TableCell className="whitespace-nowrap">{fmtDate(po.createdDate)}</TableCell>
                      <TableCell className="font-mono font-bold">{po.poNumber}</TableCell>
                      <TableCell className="font-semibold">{po.supplier}</TableCell>
                      <TableCell className="text-right font-bold">{rupiah(po.total)}</TableCell>
                      <TableCell>{po.paymentMethod || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{po.paymentMethod === 'Tempo' ? fmtDate(po.dueDate) : '-'}</TableCell>
                      <TableCell>
                        {paid
                          ? <Badge variant="success">Lunas</Badge>
                          : <Badge variant={overdue ? 'destructive' : 'warning'}>{overdue ? 'Lewat Tempo' : 'Belum Lunas'}</Badge>}
                        {!paid && (po.paidAmount || 0) > 0 && (
                          <span className="block text-[9px] text-emerald-600 font-bold mt-0.5">Dicicil {rupiah(po.paidAmount || 0)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!paid && onUpdatePOs && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); openPayDialog(po); }}>Bayar</Button>
                        )}
                        {paid && po.paidAt && <span className="text-[10px] text-gray-400">{fmtDate(po.paidAt)}</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={safeSupplierPage} pageCount={supplierPageCount} onPageChange={setSupplierPage} />
          </div>
        </TabsContent>

        {/* ===== Tab 2: Pembayaran Lainnya ===== */}
        <TabsContent value="lainnya" className="mt-5 space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Pengeluaran Kas</span>
            </button>
          </div>

      {/* Finance Metrics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">BIAYA OPERASIONAL BULAN INI</p>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">Rp {totalExpensesThisMonth.toLocaleString('id-ID')}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">BIAYA REIMBURSEMENT TERTUNDA</p>
            <h4 className="text-lg font-black text-red-600 mt-0.5">
              Rp {pendingClaims.reduce((acc, c) => acc + c.amount, 0).toLocaleString('id-ID')}
            </h4>
          </div>
        </div>
      </div>

      {/* Employee Claim Approvals list */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div>
          <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Klaim Reimbursement Karyawan</h4>
          <p className="text-[11px] text-gray-400 mt-0.5">Verifikasi pengajuan nota bensin, servis armada, atau pembelian alat kantor.</p>
        </div>

        <div className="space-y-3.5">
          {pendingClaims.length === 0 ? (
            <div className="py-8 text-center text-gray-400 font-bold border border-dashed border-gray-200 rounded-xl">
              Tidak ada pengajuan reimbursement baru.
            </div>
          ) : (
            pendingClaims.map((claim) => (
              <div key={claim.id} className="p-4 border border-gray-200 rounded-xl space-y-3 hover:border-gray-300 transition-all bg-gray-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-extrabold text-xs text-gray-900 leading-snug">{claim.item}</p>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">Diajukan: {claim.submittedBy} • {categoryTranslationMap[claim.category]}</span>
                  </div>
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded uppercase font-mono">{claim.id}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-150">
                  <span className="font-black text-xs text-gray-950">Rp {claim.amount.toLocaleString('id-ID')}</span>
                  {canApproveFinance ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectClaim(claim)}
                        className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                        title="Tolak Klaim"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleApproveClaim(claim)}
                        className="w-7 h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                        title="Setujui Klaim"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">Menunggu persetujuan Owner/Admin.</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Riwayat Pengeluaran Operasional (Bensin/Gaji/Bon/Lainnya) — murni dari expenses, tanpa data penjualan atau bon supplier */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="text-sm font-bold text-gray-800">Riwayat Pengeluaran Operasional</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Bensin, gaji, bon/tagihan, dan pengeluaran operasional lain yang dicatat di sini.</p>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
            {['Semua', 'Bensin', 'Gaji', 'Bon', 'Lainnya'].map((cat) => (
              <button
                key={cat}
                onClick={() => { setExpenseCategoryFilter(cat); setExpensePage(1); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  expenseCategoryFilter === cat ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cat === 'Semua' ? 'Semua' : (categoryTranslationMap[cat] || cat)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[10px] text-gray-400 font-bold uppercase border-b border-gray-100">
                <th className="py-3 px-4">Nomor Ref</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Deskripsi</th>
                <th className="py-3 px-4">Dicatat Oleh</th>
                <th className="py-3 px-4">Metode</th>
                <th className="py-3 px-4 text-right">Jumlah</th>
                <th className="py-3 px-4 text-center">Bukti</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 font-bold">Belum ada pengeluaran operasional yang cocok dengan filter.</td>
                </tr>
              ) : (
                filteredExpenses.slice((safeExpensePage - 1) * PAGE_SIZE, safeExpensePage * PAGE_SIZE).map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-800">{exp.id}</td>
                    <td className="py-3.5 px-4 text-gray-500 font-medium whitespace-nowrap">{fmtDate(exp.date)}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-600">{categoryTranslationMap[exp.category] || exp.category}</td>
                    <td className="py-3.5 px-4 font-medium text-gray-900">{exp.description}</td>
                    <td className="py-3.5 px-4 font-medium text-gray-600">{exp.submittedBy}</td>
                    <td className="py-3.5 px-4 text-gray-500">{exp.paymentMethod || '-'}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-red-600">-Rp {exp.amount.toLocaleString('id-ID')}</td>
                    <td className="py-3.5 px-4 text-center">
                      {exp.receiptUrl ? (
                        <a href={exp.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline underline-offset-2">Lihat</a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        exp.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : exp.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {exp.status === 'Approved' ? 'DISETUJUI' : exp.status === 'Rejected' ? 'DITOLAK' : 'DRAFT'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination page={safeExpensePage} pageCount={expensePageCount} onPageChange={setExpensePage} />
        </div>
      </div>

        </TabsContent>

        {/* ===== Tab 3: Penjualan ===== */}
        <TabsContent value="penjualan" className="mt-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Total Penjualan{salesFilter !== 'Semua' ? ` (${PAYMENT_LABEL[salesFilter] || salesFilter})` : ''}</p>
              <h4 className="text-lg font-black text-emerald-600 mt-0.5">{rupiah(salesTotal)}</h4>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Jumlah Transaksi</p>
              <h4 className="text-lg font-black text-gray-800 mt-0.5">{filteredInvoices.length}</h4>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-gray-800">Pembayaran dari Penjualan</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">Seluruh invoice penjualan kasir beserta metode pembayarannya.</p>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                {salesMethods.map((method) => (
                  <button
                    key={method}
                    onClick={() => { setSalesFilter(method); setSalesPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      salesFilter === method ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {PAYMENT_LABEL[method] || method}
                  </button>
                ))}
              </div>
            </div>

            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Metode Bayar</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-8 text-center text-gray-400 font-bold">Belum ada transaksi penjualan.</TableCell>
                  </TableRow>
                ) : filteredInvoices.slice((safeSalesPage - 1) * PAGE_SIZE, safeSalesPage * PAGE_SIZE).map((inv) => (
                  <TableRow key={inv.invoiceNumber}>
                    <TableCell className="whitespace-nowrap">{inv.date}</TableCell>
                    <TableCell className="font-mono font-bold">{inv.invoiceNumber}</TableCell>
                    <TableCell className="font-semibold">{inv.customerName || '-'}</TableCell>
                    <TableCell>{PAYMENT_LABEL[inv.paymentMethod] || inv.paymentMethod}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">{rupiah(inv.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={safeSalesPage} pageCount={salesPageCount} onPageChange={setSalesPage} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview isi bon supplier */}
      <PODetailDialog po={previewPO} onClose={() => setPreviewPO(null)} />

      {/* Konfirmasi pembayaran bon supplier — bisa cicil atau lunas, dengan riwayat & bukti bayar */}
      <Dialog open={!!payingPO} onOpenChange={(open) => { if (!open) { setPayingPO(null); setPayProofFile(null); } }}>
        <DialogContent className="max-w-sm">
          {payingPO && (
            <>
              <DialogHeader>
                <DialogTitle>Bayar Bon {payingPO.poNumber}</DialogTitle>
                <DialogDescription>{payingPO.supplier}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="font-bold text-muted-foreground uppercase text-[9px] block">Total Bon</span>
                    <span className="text-sm font-black">{rupiah(payingPO.total)}</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="font-bold text-muted-foreground uppercase text-[9px] block">Sudah Dibayar</span>
                    <span className="text-sm font-black text-emerald-600">{rupiah(payingPO.paidAmount || 0)}</span>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between items-center">
                  <span className="font-bold text-amber-700 uppercase text-[10px]">Sisa Tagihan</span>
                  <span className="text-base font-black text-amber-700">{rupiah(poRemaining(payingPO))}</span>
                </div>

                <div>
                  <Label>Nominal Dibayar Sekarang (bisa dicicil)</Label>
                  <div className="flex gap-2 items-center">
                    <NumberInput
                      value={payAmountInput}
                      onChange={setPayAmountInput}
                      min={1}
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-black outline-none"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => setPayAmountInput(poRemaining(payingPO))}>
                      Bayar Lunas
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Metode Pembayaran</Label>
                  <Select value={payMethod} onValueChange={(value) => setPayMethod(value as 'Tunai' | 'Transfer')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tunai">Tunai (mengurangi Kas Harian)</SelectItem>
                      <SelectItem value="Transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Upload Bukti Bayar (opsional)</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPayProofFile(e.target.files?.[0] || null)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium text-gray-750 outline-none file:mr-2 file:px-2.5 file:py-1 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:font-bold file:cursor-pointer cursor-pointer"
                  />
                  {payProofFile && <p className="text-[10px] text-emerald-600 font-bold mt-1">{payProofFile.name} siap diupload.</p>}
                </div>

                {(payingPO.paymentHistory && payingPO.paymentHistory.length > 0) && (
                  <div>
                    <Label>Riwayat Pembayaran / Cicilan</Label>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-150 rounded-lg p-2">
                      {[...payingPO.paymentHistory].reverse().map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-[11px] border-b border-dashed border-gray-100 last:border-0 pb-1.5 last:pb-0">
                          <div>
                            <span className="font-bold text-gray-800">{rupiah(p.amount)}</span>
                            <span className="text-gray-400 ml-1">({p.method})</span>
                            <span className="block text-[9px] text-gray-400">{fmtDate(p.date)}{p.by ? ` • ${p.by}` : ''}</span>
                          </div>
                          {p.proofUrl && (
                            <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline underline-offset-2">Bukti</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setPayingPO(null); setPayProofFile(null); }}>Batal</Button>
                <Button type="button" className="flex-1" disabled={isPaySubmitting} onClick={handlePaySupplierBon}>
                  {isPaySubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Submit Expense Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-black text-xs uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> FORMULIR PENCATATAN PENGELUARAN BARU
                </span>
                <button onClick={() => setShowSubmitModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Nama Operator / Karyawan</label>
                  <input 
                    type="text"
                    required
                    placeholder="Contoh: Andi Wijaya..."
                    value={newExpUser}
                    onChange={(e) => setNewExpUser(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Tanggal Pengeluaran</label>
                  <input
                    type="date"
                    required
                    value={newExpDate}
                    max={toDateInputValue(new Date())}
                    onChange={(e) => setNewExpDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Pilih Kategori Anggaran</label>
                  <select 
                    value={newExpCat}
                    onChange={(e) => setNewExpCat(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-750 outline-none"
                  >
                    <option value="Bensin">Bensin / Transportasi</option>
                    <option value="Gaji">Gaji Karyawan</option>
                    <option value="Bon">Bon / Tagihan (listrik, air, dll)</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Rincian / Deskripsi Pengeluaran</label>
                  <input 
                    type="text"
                    required
                    placeholder="Contoh: Beli sabun cuci toko &amp; plastik bungkus..."
                    value={newExpDesc}
                    onChange={(e) => setNewExpDesc(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-medium text-gray-750 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Jumlah Biaya Pengeluaran (IDR)</label>
                    <NumberInput
                      min={100}
                      value={newExpAmount}
                      onChange={setNewExpAmount}
                      placeholder="0"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-850 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Metode Pembayaran</label>
                  <select 
                    value={newExpMethod}
                    onChange={(e) => setNewExpMethod(e.target.value as 'Tunai Kas' | 'Tunai Luar' | 'Transfer' | 'Giro')}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-750 outline-none"
                  >
                    <option value="Tunai Kas">Tunai — dari Kas Toko (mempengaruhi Kas Harian)</option>
                    <option value="Tunai Luar">Tunai — Bukan dari Kas Toko (tidak mempengaruhi Kas Harian)</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Giro">Giro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Upload Bukti Pengeluaran (opsional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewExpProofFile(e.target.files?.[0] || null)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-medium text-gray-750 outline-none file:mr-2 file:px-2.5 file:py-1 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:font-bold file:cursor-pointer cursor-pointer"
                  />
                  {newExpProofFile && (
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">{newExpProofFile.name} siap diupload.</p>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed bg-blue-50/40 p-3 rounded-lg border border-blue-100">
                  Data pengeluaran yang disimpan akan langsung mengurangi kas operasional toko di jurnal utama serta dicatat otomatis ke log aktivitas.
                </p>

                <div className="pt-3 border-t border-gray-100 flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowSubmitModal(false)}
                    className="w-full py-2.5 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isExpenseSubmitting}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/15 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isExpenseSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
