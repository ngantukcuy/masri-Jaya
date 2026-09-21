import React, { useState } from 'react';
import { 
  Wallet, 
  TrendingDown, 
  Plus, 
  Check,
  X
} from 'lucide-react';
import { Expense, PO, SalesInvoice } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
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
 * lama tanpa metode bayar) baru lunas setelah dibayar lewat tab ini. */
const isPOPaid = (po: PO) => !!po.paidAt || po.paymentMethod === 'Cash' || po.paymentMethod === 'Transfer';

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

  // Tab halaman Pembayaran + state tiap tab
  const [activeTab, setActiveTab] = useState<FinanceTab>('supplier');
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>('semua');
  const [supplierPage, setSupplierPage] = useState(1);
  const [salesFilter, setSalesFilter] = useState<string>('Semua');
  const [salesPage, setSalesPage] = useState(1);
  const [previewPO, setPreviewPO] = useState<PO | null>(null);
  const [payingPO, setPayingPO] = useState<PO | null>(null);
  const [payMethod, setPayMethod] = useState<'Tunai' | 'Transfer'>('Tunai');

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
  const [newExpMethod, setNewExpMethod] = useState<'Tunai' | 'Transfer' | 'Giro'>('Tunai');

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

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpDesc || !newExpUser) {
      dialog.alert("Silakan lengkapi seluruh kolom formulir pengeluaran!");
      return;
    }

    const nextExpense: Expense = {
      id: `EXP-MAN-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('id-ID'),
      category: newExpCat,
      description: newExpDesc,
      submittedBy: newExpUser,
      amount: newExpAmount,
      receiptName: "BUKTI_MANUAL.pdf",
      status: 'Approved'
    };

    onUpdateExpenses([nextExpense, ...expenses]);
    setShowSubmitModal(false);

    if (newExpMethod === 'Tunai') {
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
    setNewExpMethod('Tunai');
    dialog.alert("Klaim pengeluaran kas toko berhasil disimpan ke dalam log buku kas!");
  };

  // ---- Tab: Pembayaran ke Supplier ----
  // Sumber datanya sama dengan tabel di Stok > Stok Supplier (bon yang sudah
  // masuk / sedang dalam perjalanan), jadi tiap bon baru otomatis muncul di sini.
  const supplierBons = pos
    .filter((po) => po.status === 'Received' || po.status === 'In Transit' || po.receivedAt)
    .sort((a, b) => (b.receivedAt || b.createdDate).localeCompare(a.receivedAt || a.createdDate));
  const todayISO = new Date().toISOString().slice(0, 10);
  const unpaidBons = supplierBons.filter((po) => !isPOPaid(po));
  const unpaidTotal = unpaidBons.reduce((sum, po) => sum + po.total, 0);
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
    setPayingPO(po);
  };

  const handlePaySupplierBon = () => {
    if (!payingPO || !onUpdatePOs) return;
    const po = payingPO;
    onUpdatePOs(pos.map((item) => item.poNumber === po.poNumber
      ? { ...item, paidAt: new Date().toISOString(), paidAmount: po.total, paidMethod: payMethod }
      : item));

    if (payMethod === 'Tunai') {
      const session = addMutation('out', 'Pembayaran Hutang', po.total, `Bayar bon ${po.poNumber} - ${po.supplier}`);
      if (!session) {
        dialog.alert('Bon ditandai lunas, tapi Kas Harian belum dibuka sehingga uang keluar tunai belum tercatat di kas.');
      }
    }
    onAddActivity(
      `Bon Supplier Dibayar: ${po.poNumber}`,
      `Pembayaran ${payMethod.toLowerCase()} ke ${po.supplier}`,
      po.total,
      'overdue'
    );
    setPayingPO(null);
    dialog.alert(`Bon ${po.poNumber} sebesar ${rupiah(po.total)} berhasil ditandai lunas.`);
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
              <p className="text-[10px] text-gray-400 mt-0.5">{rupiah(overdueBons.reduce((sum, po) => sum + po.total, 0))}</p>
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

      {/* Konfirmasi pembayaran bon supplier */}
      <Dialog open={!!payingPO} onOpenChange={(open) => { if (!open) setPayingPO(null); }}>
        <DialogContent className="max-w-sm">
          {payingPO && (
            <>
              <DialogHeader>
                <DialogTitle>Bayar Bon {payingPO.poNumber}</DialogTitle>
                <DialogDescription>{payingPO.supplier}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg p-3">
                  <span className="font-bold text-muted-foreground uppercase text-[10px]">Total dibayar</span>
                  <span className="text-base font-black">{rupiah(payingPO.total)}</span>
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPayingPO(null)}>Batal</Button>
                <Button type="button" className="flex-1" onClick={handlePaySupplierBon}>Tandai Lunas</Button>
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
                    onChange={(e) => setNewExpMethod(e.target.value as 'Tunai' | 'Transfer' | 'Giro')}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-750 outline-none"
                  >
                    <option value="Tunai">Tunai (mempengaruhi Kas Harian)</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Giro">Giro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Rincian Pengeluaran</label>
                  <input 
                    type="text"
                    required
                    placeholder="Contoh: Beli sabun cuci toko &amp; plastik bungkus..."
                    value={newExpDesc}
                    onChange={(e) => setNewExpDesc(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-medium text-gray-750 outline-none"
                  />
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
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/15 cursor-pointer"
                  >
                    Simpan Pengeluaran
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
