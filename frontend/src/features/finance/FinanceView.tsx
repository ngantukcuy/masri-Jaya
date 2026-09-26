import React, { useState } from 'react';
import { 
  Wallet, 
  TrendingDown,
  Plus, 
  Check,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Coins,
  FileText
} from 'lucide-react';
import { Expense, PO, POPayment, SalesInvoice } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser } from '../../lib/permissions';
import { uploadProductImage } from '../../lib/uploadProductImage';
import NumberInput from '../../components/shared/NumberInput';
import Pagination, { PAGE_SIZE } from '../../components/shared/Pagination';
import PODetailDialog from '../../components/shared/PODetailDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
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
  /** Tidak dipakai lagi (tab Penjualan dihapus); dipertahankan agar App.tsx tidak perlu diubah. */
  salesInvoices?: SalesInvoice[];
}

type FinanceTab = 'supplier' | 'lainnya';
type PayMethod = 'Tunai Kas' | 'Tunai Luar' | 'Transfer' | 'Giro';
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

const initials = (name?: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
};

export default function FinanceView({ expenses, onUpdateExpenses, onAddActivity, currentUser, pos = [], onUpdatePOs }: FinanceViewProps) {
  const dialog = useDialog();
  // Pengeluaran di tab Pembayaran Lainnya hanya sah setelah disetujui Owner.
  // Owner yang mencatat sendiri langsung berstatus Approved.
  const isOwner = currentUser?.role === 'Owner';
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('Semua');
  const [expensePage, setExpensePage] = useState(1);

  // Tab halaman Pembayaran + state tiap tab
  const [activeTab, setActiveTab] = useState<FinanceTab>('supplier');
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>('semua');
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [previewPO, setPreviewPO] = useState<PO | null>(null);
  const [payingPO, setPayingPO] = useState<PO | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('Tunai Kas');
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

  // Form states for new expense
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpAmount, setNewExpAmount] = useState(0);
  const [newExpCat, setNewExpCat] = useState<'Bensin' | 'Gaji' | 'Bon' | 'Lainnya'>('Bensin');
  const [newExpUser, setNewExpUser] = useState('');
  const [newExpMethod, setNewExpMethod] = useState<'Tunai Kas' | 'Tunai Luar' | 'Transfer' | 'Giro'>('Tunai Kas');
  const [newExpDate, setNewExpDate] = useState(() => toDateInputValue(new Date()));
  const [newExpProofFile, setNewExpProofFile] = useState<File | null>(null);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);

  const pendingExpenses = expenses.filter((e) => e.status === 'Pending');

  const handleApproveExpense = (exp: Expense) => {
    if (!isOwner) {
      dialog.alert('Hanya Owner yang dapat menyetujui pengeluaran.');
      return;
    }
    onUpdateExpenses(expenses.map((item) => item.id === exp.id
      ? { ...item, status: 'Approved' as const, approvedBy: currentUser?.name, approvedAt: new Date().toISOString() }
      : item));

    // Hanya "Tunai Kas" yang keluar dari laci Kas Harian, dicatat saat disetujui.
    let kasNote = '';
    if (exp.paymentMethod === 'Tunai Kas') {
      const session = addMutation('out', 'Pembayaran Lainnya', exp.amount, `${categoryTranslationMap[exp.category]}: ${exp.description}`);
      if (!session) kasNote = ' Catatan: Kas Harian belum dibuka sehingga uang keluar tunai belum tercatat di kas.';
    }
    onAddActivity(
      `Pengeluaran Disetujui: Rp ${exp.amount.toLocaleString('id-ID')}`,
      `${exp.description} (diajukan ${exp.submittedBy}) disetujui ${currentUser?.name || 'Owner'}`,
      exp.amount,
      'overdue'
    );
    dialog.alert(`Pengeluaran ${exp.id} sebesar Rp ${exp.amount.toLocaleString('id-ID')} disetujui dan dicatat.${kasNote}`);
  };

  const handleRejectExpense = (exp: Expense) => {
    if (!isOwner) {
      dialog.alert('Hanya Owner yang dapat menolak pengeluaran.');
      return;
    }
    onUpdateExpenses(expenses.map((item) => item.id === exp.id
      ? { ...item, status: 'Rejected' as const, approvedBy: currentUser?.name, approvedAt: new Date().toISOString() }
      : item));
    onAddActivity(
      `Pengeluaran Ditolak: ${exp.id}`,
      `${exp.description} milik ${exp.submittedBy} ditolak ${currentUser?.name || 'Owner'}`,
      0,
      'quote'
    );
    dialog.alert(`Pengeluaran ${exp.id} yang diajukan oleh ${exp.submittedBy} telah ditolak.`);
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
        status: isOwner ? 'Approved' : 'Pending',
        ...(isOwner ? { approvedBy: currentUser?.name, approvedAt: new Date().toISOString() } : {}),
      };

      onUpdateExpenses([nextExpense, ...expenses]);
      setShowSubmitModal(false);

      if (isOwner) {
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
      } else {
        onAddActivity(
          `Pengeluaran Menunggu Persetujuan`,
          `${newExpDesc} (Rp ${newExpAmount.toLocaleString('id-ID')}) diajukan ${newExpUser}`,
          newExpAmount,
          'overdue',
          'approvers'
        );
      }

      // Reset forms
      setNewExpDesc('');
      setNewExpAmount(0);
      setNewExpUser('');
      setNewExpMethod('Tunai Kas');
      setNewExpDate(toDateInputValue(new Date()));
      setNewExpProofFile(null);
      dialog.alert(isOwner
        ? "Pengeluaran berhasil dicatat dan langsung disetujui."
        : "Pengeluaran berhasil diajukan dan menunggu persetujuan Owner. Belum tercatat di kas sampai disetujui.");
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
    const q = supplierSearch.trim().toLowerCase();
    if (q && !`${po.poNumber} ${po.supplier}`.toLowerCase().includes(q)) return false;
    if (supplierFilter === 'belum') return !isPOPaid(po);
    if (supplierFilter === 'lunas') return isPOPaid(po);
    return true;
  });
  const supplierPageCount = Math.ceil(filteredBons.length / PAGE_SIZE);
  const safeSupplierPage = Math.min(supplierPage, Math.max(1, supplierPageCount));

  const openPayDialog = (po: PO) => {
    setPayMethod('Tunai Kas');
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

      if (payMethod === 'Tunai Kas') {
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

  const approvedExpenses = expenses.filter((e) => e.status === 'Approved');
  const totalExpensesThisMonth = approvedExpenses.reduce((acc, e) => acc + e.amount, 0);

  // Daftar pengeluaran operasional untuk tab ini — sumbernya cuma `expenses`
  // (kategori sudah dibatasi ke Bensin/Gaji/Bon/Lainnya), jadi tidak perlu
  // sentuh mutasi Kas Harian sama sekali dan tidak ada celah data penjualan
  // atau bon supplier ikut nyasar ke sini.
  const filteredExpenses = expenses.filter((e) => {
    const q = expenseSearch.trim().toLowerCase();
    if (q && !`${e.id} ${e.description} ${e.submittedBy}`.toLowerCase().includes(q)) return false;
    return expenseCategoryFilter === 'Semua' || e.category === expenseCategoryFilter;
  });
  const expensePageCount = Math.ceil(filteredExpenses.length / PAGE_SIZE);
  const safeExpensePage = Math.min(expensePage, Math.max(1, expensePageCount));

  return (
    <div className="space-y-6">
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinanceTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="supplier" className="text-sm">Pembayaran ke Supplier</TabsTrigger>
          <TabsTrigger value="lainnya" className="text-sm">Pembayaran Lainnya</TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: Pembayaran ke Supplier ===== */}
        <TabsContent value="supplier" className="mt-5 space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Bon Masuk</span>
                <span className="text-lg font-black text-slate-800">{supplierBons.length} Bon</span>
                <span className="text-[9px] text-gray-400 block mt-0.5">Dari Stok Supplier</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Belum Dibayar</span>
                <span className="text-lg font-black text-amber-600">{rupiah(unpaidTotal)}</span>
                <span className="text-[9px] text-gray-400 block mt-0.5">{unpaidBons.length} Bon Aktif</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className={`w-6 h-6 ${overdueBons.length > 0 ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Lewat Jatuh Tempo</span>
                <span className={`text-lg font-black ${overdueBons.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {rupiah(overdueBons.reduce((sum, po) => sum + poRemaining(po), 0))}
                </span>
                <span className={`text-[9px] block mt-0.5 ${overdueBons.length > 0 ? 'text-red-500 font-extrabold' : 'text-gray-400'}`}>{overdueBons.length} Bon Overdue</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Sudah Lunas</span>
                <span className="text-lg font-black text-emerald-600">{supplierBons.length - unpaidBons.length} Bon</span>
                <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">Pembayaran Lancar</span>
              </div>
            </div>
          </div>

          {/* Main Table Panel */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Controls Bar */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-3 justify-between items-center">
              <div className="relative w-full md:max-w-xs group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors z-10" />
                <Input
                  type="text"
                  placeholder="Cari nomor PO atau pemasok..."
                  value={supplierSearch}
                  onChange={(e) => { setSupplierSearch(e.target.value); setSupplierPage(1); }}
                  className="pl-9 h-8 bg-white"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto">
                {([['semua', 'Semua Bon'], ['belum', 'Belum Lunas'], ['lunas', 'Lunas']] as [SupplierFilter, string][]).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={supplierFilter === key ? 'default' : 'outline'}
                    onClick={() => { setSupplierFilter(key); setSupplierPage(1); }}
                    className="whitespace-nowrap"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* List of Bons */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-100/50">
                    <TableHead>Pemasok &amp; Nomor PO</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Total Bon</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Opsi Operasional</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-8 text-center text-gray-400">
                        <span className="text-2xl block mb-2">🧾</span>
                        <span className="font-extrabold uppercase tracking-wider block text-xs">
                          {supplierBons.length === 0 ? 'Belum Ada Bon Masuk' : 'Tidak Ada Bon yang Cocok'}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          {supplierBons.length === 0 ? 'Bon akan muncul otomatis setelah barang diterima lewat Stok > Stok Supplier.' : 'Silakan ubah kata kunci atau filter.'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : filteredBons.slice((safeSupplierPage - 1) * PAGE_SIZE, safeSupplierPage * PAGE_SIZE).map((po) => {
                    const paid = isPOPaid(po);
                    const overdue = !paid && po.paymentMethod === 'Tempo' && !!po.dueDate && po.dueDate < todayISO;
                    return (
                      <TableRow key={po.poNumber} onClick={() => setPreviewPO(po)} className="cursor-pointer" title="Klik untuk melihat isi bon">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                              {initials(po.supplier)}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800">{po.supplier}</h4>
                              <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{po.poNumber}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-gray-600">{fmtDate(po.createdDate)}</TableCell>
                        <TableCell className="font-semibold text-gray-600">{po.paymentMethod || '-'}</TableCell>
                        <TableCell>
                          {po.paymentMethod === 'Tempo' && po.dueDate ? (
                            <div>
                              <p className="font-bold text-gray-700 whitespace-nowrap">{fmtDate(po.dueDate)}</p>
                              {overdue && (
                                <p className="text-[9px] text-red-500 font-bold mt-0.5">
                                  Terlambat {Math.max(1, Math.floor((new Date(todayISO).getTime() - new Date(po.dueDate).getTime()) / 86400000))} hari
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-black text-xs text-gray-800">{rupiah(po.total)}</span>
                          {!paid && (po.paidAmount || 0) > 0 && (
                            <span className="block text-[9px] text-emerald-600 font-bold mt-0.5">Dicicil {rupiah(po.paidAmount || 0)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {paid ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">Lunas</Badge>
                          ) : overdue ? (
                            <Badge className="bg-red-50 text-red-700 border-red-100 animate-pulse">Jatuh Tempo</Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-100">Belum Lunas</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {!paid && onUpdatePOs && (
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); openPayDialog(po); }}
                                className="text-[10px] bg-emerald-600 hover:bg-emerald-700"
                                title="Bayar Bon"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Cicil / Lunas</span>
                              </Button>
                            )}
                            {paid && po.paidAt && <span className="text-[10px] text-gray-400">Lunas {fmtDate(po.paidAt)}</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination page={safeSupplierPage} pageCount={supplierPageCount} onPageChange={setSupplierPage} />
            </div>
          </div>
        </TabsContent>

        {/* ===== Tab 2: Pembayaran Lainnya ===== */}
        <TabsContent value="lainnya" className="mt-5 space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Biaya Operasional</span>
                <span className="text-lg font-black text-slate-800">Rp {totalExpensesThisMonth.toLocaleString('id-ID')}</span>
                <span className="text-[9px] text-gray-400 block mt-0.5">{approvedExpenses.length} Pengeluaran Disetujui</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Menunggu Persetujuan</span>
                <span className="text-lg font-black text-red-600">
                  Rp {pendingExpenses.reduce((acc, c) => acc + c.amount, 0).toLocaleString('id-ID')}
                </span>
                <span className="text-[9px] text-red-500 font-extrabold block mt-0.5">{pendingExpenses.length} Pengajuan Menunggu Owner</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            
                <Button
                  size="lg"
                  onClick={() => setShowSubmitModal(true)}
                  className="blue-nowrap text-[10px] bg-blue-500 hover:bg-blue-600 hover:text-white text-white-700 shadow-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Catat Pengeluaran</span>
                </Button>
          </div>

          {/* Pengeluaran yang menunggu persetujuan Owner */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Menunggu Persetujuan Owner</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Pengeluaran baru dari staf baru tercatat (dan mengurangi Kas Harian bila Tunai Kas) setelah disetujui Owner.</p>
            </div>

            <div className="space-y-3.5">
              {pendingExpenses.length === 0 ? (
                <div className="py-8 text-center text-gray-400 font-bold border border-dashed border-gray-200 rounded-xl">
                  Tidak ada pengeluaran yang menunggu persetujuan.
                </div>
              ) : (
                pendingExpenses.map((exp) => (
                  <div key={exp.id} className="p-4 border border-gray-200 rounded-xl space-y-3 hover:border-gray-300 transition-all bg-gray-50/50">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-extrabold text-xs text-gray-900 leading-snug">{exp.description}</p>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          Diajukan: {exp.submittedBy} • {categoryTranslationMap[exp.category]} • {exp.paymentMethod || '-'} • {fmtDate(exp.date)}
                        </span>
                        {exp.receiptUrl && (
                          <a href={exp.receiptUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold underline underline-offset-2">Lihat bukti</a>
                        )}
                      </div>
                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded uppercase font-mono shrink-0">{exp.id}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-150">
                      <span className="font-black text-xs text-gray-950">Rp {exp.amount.toLocaleString('id-ID')}</span>
                      {isOwner ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRejectExpense(exp)}
                            className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                            title="Tolak"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApproveExpense(exp)}
                            className="w-7 h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                            title="Setujui"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">Menunggu persetujuan Owner.</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Riwayat Pengeluaran Operasional (Bensin/Gaji/Bon/Lainnya) — murni dari expenses, tanpa data penjualan atau bon supplier */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Controls Bar */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-3 justify-between items-center">
              <div className="relative w-full md:max-w-xs group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors z-10" />
                <Input
                  type="text"
                  placeholder="Cari deskripsi, ref, atau pencatat..."
                  value={expenseSearch}
                  onChange={(e) => { setExpenseSearch(e.target.value); setExpensePage(1); }}
                  className="pl-9 h-8 bg-white"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto items-center">
                {['Semua', 'Bensin', 'Gaji', 'Bon', 'Lainnya'].map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={expenseCategoryFilter === cat ? 'default' : 'outline'}
                    onClick={() => { setExpenseCategoryFilter(cat); setExpensePage(1); }}
                    className="whitespace-nowrap"
                  >
                    {cat === 'Semua' ? 'Semua' : (categoryTranslationMap[cat] || cat)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-100/50">
                    <TableHead>Deskripsi &amp; Ref</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Dicatat Oleh</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Bukti</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-8 text-center text-gray-400">
                        <span className="text-2xl block mb-2">💸</span>
                        <span className="font-extrabold uppercase tracking-wider block text-xs">Tidak Ada Data Pengeluaran</span>
                        <span className="text-[10px] text-gray-400 mt-1 block">Silakan ubah filter atau catat pengeluaran baru.</span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.slice((safeExpensePage - 1) * PAGE_SIZE, safeExpensePage * PAGE_SIZE).map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                              {initials(categoryTranslationMap[exp.category] || exp.category)}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800">{exp.description}</h4>
                              <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{exp.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-gray-600">{fmtDate(exp.date)}</TableCell>
                        <TableCell className="font-semibold text-gray-600">{categoryTranslationMap[exp.category] || exp.category}</TableCell>
                        <TableCell className="font-semibold text-gray-600">{exp.submittedBy}</TableCell>
                        <TableCell className="font-semibold text-gray-600">{exp.paymentMethod || '-'}</TableCell>
                        <TableCell>
                          <span className="font-black text-xs text-red-600">-Rp {exp.amount.toLocaleString('id-ID')}</span>
                        </TableCell>
                        <TableCell>
                          {exp.receiptUrl ? (
                            <a href={exp.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline underline-offset-2">Lihat</a>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {exp.status === 'Approved' ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">Disetujui</Badge>
                          ) : exp.status === 'Rejected' ? (
                            <Badge className="bg-red-50 text-red-700 border-red-100">Ditolak</Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-100">Menunggu</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pagination page={safeExpensePage} pageCount={expensePageCount} onPageChange={setExpensePage} />
            </div>
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
                  <Select value={payMethod} onValueChange={(value) => setPayMethod(value as PayMethod)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tunai Kas">Tunai — dari Kas Toko (mempengaruhi Kas Harian)</SelectItem>
                      <SelectItem value="Tunai Luar">Tunai — Bukan dari Kas Toko (tidak mempengaruhi Kas Harian)</SelectItem>
                      <SelectItem value="Transfer">Transfer</SelectItem>
                      <SelectItem value="Giro">Giro</SelectItem>
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
              className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header tetap di tempat — hanya isi form di bawah yang discroll,
                  supaya scrollbar tidak "kepotong" oleh sudut membulat kartu. */}
              <div className="flex justify-between items-center border-b border-gray-100 px-6 pt-6 pb-3 shrink-0">
                <span className="font-black text-xs uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> FORMULIR PENCATATAN PENGELUARAN BARU
                </span>
                <button onClick={() => setShowSubmitModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs overflow-y-auto p-6">
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
                  {isOwner
                    ? 'Sebagai Owner, pengeluaran ini langsung disetujui: mengurangi Kas Harian (bila Tunai Kas) dan dicatat ke log aktivitas.'
                    : 'Pengeluaran ini harus disetujui Owner dulu. Sebelum disetujui, belum tercatat sebagai pengeluaran dan belum mengurangi Kas Harian.'}
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
                    {isExpenseSubmitting ? 'Menyimpan...' : isOwner ? 'Simpan Pengeluaran' : 'Ajukan ke Owner'}
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
