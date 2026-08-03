import React, { useState } from 'react';
import { 
  Search, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  UserCheck,
  Coins,
  Printer as PrinterIcon,
  Calendar,
  PlusCircle,
  FileText
} from 'lucide-react';
import { Customer, Printer } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { addMutation } from '../../lib/cashSession';
import { getSupabaseTableCache } from '../../lib/supabaseCache';
import { useDialog } from '../../components/shared/DialogProvider';
import NumberInput from '../../components/shared/NumberInput';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

const numberInputClass =
  'flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-black outline-none transition-colors focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/15';

interface DebtsStoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  taxId?: string;
}

interface DebtsViewProps {
  customers: Customer[];
  onUpdateCustomers: (updatedCustomers: Customer[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  storeProfile?: DebtsStoreProfileLite;
}

export default function DebtsView({ 
  customers, 
  onUpdateCustomers, 
  onAddActivity,
  storeProfile,
}: DebtsViewProps) {
  const dialog = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Cleared' | 'Pending' | 'Overdue'>('Semua');
  
  // Modals state
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [selectedCustomerForAction, setSelectedCustomerForAction] = useState<Customer | null>(null);
  const [showPrintInvoice, setShowPrintInvoice] = useState(false);
  
  // Form states
  const [payAmount, setPayAmount] = useState(0);
  const [addDebtAmount, setAddDebtAmount] = useState(0);
  const [debtDescription, setDebtDescription] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');

  // Toast / feedback state
  const [toastMsg, setToastMsg] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // A customer counts as overdue either because someone manually flagged
  // them (debtStatus === 'Overdue') or because their tracked due date
  // (auto-set from a POS split payment, or entered manually via Tambah
  // Hutang) has already passed. Purely additive — never overrides the
  // manually-managed debtStatus field itself.
  const todayIso = new Date().toISOString().split('T')[0];
  const isEffectivelyOverdue = (cust: Customer) =>
    cust.currentDebt > 0 && (cust.debtStatus === 'Overdue' || (!!cust.nextDueDate && cust.nextDueDate < todayIso));

  // Get filtered customers
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Semua' || (statusFilter === 'Overdue' ? isEffectivelyOverdue(c) : c.debtStatus === statusFilter);
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalDebt = customers.reduce((acc, c) => acc + (c.currentDebt || 0), 0);
  const totalOverdue = customers.reduce((acc, c) => acc + (isEffectivelyOverdue(c) ? (c.overdueAmount || c.currentDebt) : 0), 0);
  const activeDebtorsCount = customers.filter(c => c.currentDebt > 0).length;
  const overdueDebtorsCount = customers.filter(c => isEffectivelyOverdue(c)).length;

  const handleOpenPayModal = (customer: Customer) => {
    setSelectedCustomerForAction(customer);
    setPayAmount(customer.currentDebt);
    setShowPayModal(true);
  };

  const handleOpenAddDebtModal = (customer: Customer) => {
    setSelectedCustomerForAction(customer);
    setAddDebtAmount(0);
    setDebtDescription('');
    // Default due date 30 days from now
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDebtDueDate(d.toISOString().split('T')[0]);
    setShowAddDebtModal(true);
  };

  const handleOpenInvoice = (customer: Customer) => {
    setSelectedCustomerForAction(customer);
    setShowPrintInvoice(true);
  };

  const submitRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForAction) return;

    const payment = payAmount;
    if (!payment || payment <= 0) {
      dialog.alert("Masukkan nominal pembayaran yang valid!");
      return;
    }

    if (payment > selectedCustomerForAction.currentDebt) {
      dialog.alert("Nominal pembayaran melebihi total sisa hutang!");
      return;
    }

    const remaining = Math.max(0, selectedCustomerForAction.currentDebt - payment);
    
    // Update overdue/pending amounts accordingly
    let newStatus: 'Cleared' | 'Pending' | 'Overdue' = 'Cleared';
    let newOverdue = selectedCustomerForAction.overdueAmount || 0;
    let newPending = selectedCustomerForAction.pendingAmount || 0;

    if (remaining > 0) {
      newStatus = selectedCustomerForAction.debtStatus === 'Overdue' ? 'Overdue' : 'Pending';
      if (newStatus === 'Overdue') {
        newOverdue = Math.max(0, newOverdue - payment);
      } else {
        newPending = Math.max(0, newPending - payment);
      }
    } else {
      newOverdue = 0;
      newPending = 0;
    }

    const updated = customers.map(c => {
      if (c.id === selectedCustomerForAction.id) {
        // Record payment in transaction history
        const updatedTransactions = [
          { orderName: `Pembayaran Piutang (Sisa: Rp ${remaining.toLocaleString('id-ID')})`, date: new Date().toISOString().split('T')[0], amount: -payment },
          ...c.lastTransactions
        ];
        return {
          ...c,
          currentDebt: remaining,
          debtStatus: newStatus,
          overdueAmount: newOverdue,
          pendingAmount: newPending,
          lastTransactions: updatedTransactions,
          nextDueDate: remaining === 0 ? undefined : c.nextDueDate
        };
      }
      return c;
    });

    onUpdateCustomers(updated);
    addMutation('in', 'Pembayaran Piutang', payment, selectedCustomerForAction.name);
    onAddActivity(
      `Pelunasan Piutang: ${selectedCustomerForAction.name}`,
      `Menerima cicilan sebesar Rp ${payment.toLocaleString('id-ID')} dari sisa Rp ${selectedCustomerForAction.currentDebt.toLocaleString('id-ID')}`,
      payment,
      'sale'
    );

    setShowPayModal(false);
    triggerToast(`Berhasil menerima pembayaran Rp ${payment.toLocaleString('id-ID')} untuk ${selectedCustomerForAction.name}`);
  };

  const submitAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForAction) return;

    const amount = addDebtAmount;
    if (isNaN(amount) || amount <= 0) {
      dialog.alert("Masukkan nominal penambahan hutang yang valid!");
      return;
    }

    const updated = customers.map(c => {
      if (c.id === selectedCustomerForAction.id) {
        const nextDebt = c.currentDebt + amount;
        const nextTransactions = [
          { orderName: `Pencatatan Piutang: ${debtDescription || 'Bahan Bangunan'}`, date: new Date().toISOString().split('T')[0], amount: amount },
          ...c.lastTransactions
        ];
        return {
          ...c,
          currentDebt: nextDebt,
          debtStatus: 'Pending' as const,
          pendingAmount: (c.pendingAmount || 0) + amount,
          lastTransactions: nextTransactions,
          nextDueDate: c.nextDueDate && c.nextDueDate < debtDueDate ? c.nextDueDate : debtDueDate
        };
      }
      return c;
    });

    onUpdateCustomers(updated);
    onAddActivity(
      `Pemberian Kredit: ${selectedCustomerForAction.name}`,
      `Melakukan pencatatan hutang baru senilai Rp ${amount.toLocaleString('id-ID')} tempo s.d ${debtDueDate}`,
      amount,
      'overdue'
    );

    setShowAddDebtModal(false);
    triggerToast(`Berhasil menambahkan hutang baru Rp ${amount.toLocaleString('id-ID')} untuk ${selectedCustomerForAction.name}`);
  };

  const simulatePrint = () => {
    setIsPrinting(true);
    // Printers are registered in Supabase (shared across devices); whether
    // one is actually connected right now is local to whichever browser
    // paired it in Pengaturan > Printer, so this just names the first
    // registered printer for the toast — it doesn't claim to know live
    // connection state from here.
    const registeredPrinters = getSupabaseTableCache<Printer>('printers');
    const connectedPrinterName = registeredPrinters[0]?.name || "printer default";

    triggerToast(`Mengirim ke ${connectedPrinterName}...`);
    setTimeout(() => {
      setIsPrinting(false);
      window.print();
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Popup */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white font-bold text-xs uppercase px-5 py-3 rounded-xl shadow-xl border border-emerald-500/20 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 animate-bounce" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Coins className="w-7 h-7 text-blue-600" /> Buku Piutang &amp; Hutang Pelanggan
          </h2>
          <p className="text-gray-500 text-sm">Monitor outstanding kredit pembeli, status keterlambatan jatuh tempo, dan riwayat pembayaran cicilan.</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Sisa Piutang</span>
            <span className="text-lg font-black text-slate-800">Rp {totalDebt.toLocaleString('id-ID')}</span>
            <span className="text-[9px] text-gray-400 block mt-0.5">{activeDebtorsCount} Pelanggan Aktif</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Jatuh Tempo (Kritis)</span>
            <span className="text-lg font-black text-red-600">Rp {totalOverdue.toLocaleString('id-ID')}</span>
            <span className="text-[9px] text-red-500 font-extrabold block mt-0.5">{overdueDebtorsCount} Pelanggan Overdue</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Kreditur Aman</span>
            <span className="text-lg font-black text-emerald-600">
              {customers.filter(c => c.debtStatus === 'Cleared').length} Org
            </span>
            <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">Kolektibilitas Lancar</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Rasio Piutang</span>
            <span className="text-lg font-black text-slate-800">
              {((totalDebt / Math.max(1, customers.reduce((acc, c) => acc + c.totalPurchases, 0))) * 100).toFixed(1)}%
            </span>
            <span className="text-[9px] text-gray-400 block mt-0.5">Dari Total Penjualan</span>
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
              placeholder="Cari nama debitur atau ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 bg-white"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto">
            {(['Semua', 'Pending', 'Overdue', 'Cleared'] as const).map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? 'default' : 'outline'}
                onClick={() => setStatusFilter(st)}
                className="whitespace-nowrap"
              >
                {st === 'Semua' ? 'Semua Debitur' : st === 'Pending' ? 'Berjalan (Pending)' : st === 'Overdue' ? 'Jatuh Tempo (Overdue)' : 'Lunas (Cleared)'}
              </Button>
            ))}
          </div>
        </div>

        {/* List of Debtors */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-slate-100/50">
                <TableHead>ID &amp; Pelanggan</TableHead>
                <TableHead>Tingkat Loyalitas</TableHead>
                <TableHead>Status Kredit</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Sisa Piutang Aktif</TableHead>
                <TableHead className="text-right">Opsi Operasional</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-8 text-center text-gray-400">
                    <span className="text-2xl block mb-2">📒</span>
                    <span className="font-extrabold uppercase tracking-wider block text-xs">Tidak Ada Data Piutang</span>
                    <span className="text-[10px] text-gray-400 mt-1 block">Silakan ubah filter atau tambahkan transaksi piutang baru di POS.</span>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((cust) => (
                  <TableRow key={cust.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                          {cust.logoLetters}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{cust.name}</h4>
                          <p className="text-[9px] text-gray-400 mt-0.5">{cust.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-gray-600">{cust.loyaltyTier}</TableCell>
                    <TableCell>
                      {cust.currentDebt === 0 ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">Lunas</Badge>
                      ) : isEffectivelyOverdue(cust) ? (
                        <Badge className="bg-red-50 text-red-700 border-red-100 animate-pulse">Jatuh Tempo</Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-100">Berjalan</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {cust.currentDebt > 0 && cust.nextDueDate ? (
                        <div>
                          <p className="font-bold text-gray-700">{new Date(cust.nextDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          {isEffectivelyOverdue(cust) && (
                            <p className="text-[9px] text-red-500 font-bold mt-0.5">
                              Terlambat {Math.max(1, Math.floor((new Date(todayIso).getTime() - new Date(cust.nextDueDate).getTime()) / 86400000))} hari
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`font-black text-xs ${cust.currentDebt > 0 ? 'text-gray-800' : 'text-emerald-600'}`}>
                        Rp {cust.currentDebt.toLocaleString('id-ID')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenInvoice(cust)}
                          className="text-[10px]"
                          title="Cetak Surat Tagihan"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Surat</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenAddDebtModal(cust)}
                          className="text-[10px] bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 shadow-none"
                          title="Tambah Hutang Baru"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Kredit</span>
                        </Button>
                        {cust.currentDebt > 0 && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayModal(cust)}
                            className="text-[10px] bg-emerald-600 hover:bg-emerald-700"
                            title="Bayar Cicilan"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Cicil / Lunas</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* REPAYMENT MODAL */}
      <Dialog open={showPayModal && !!selectedCustomerForAction} onOpenChange={setShowPayModal}>
        <DialogContent className="max-w-md">
          {selectedCustomerForAction && (
            <>
              <DialogHeader>
                <DialogTitle className="text-emerald-600">
                  <CreditCard className="w-5 h-5" /> Pembayaran Cicilan Piutang
                </DialogTitle>
              </DialogHeader>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nama Pelanggan:</span>
                  <span className="font-bold text-gray-800">{selectedCustomerForAction.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Outstanding:</span>
                  <span className="font-black text-red-600">Rp {selectedCustomerForAction.currentDebt.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <form onSubmit={submitRepayment} className="space-y-4">
                <div>
                  <Label>Nominal Pembayaran (Rp)</Label>
                  <NumberInput
                    value={payAmount}
                    onChange={setPayAmount}
                    placeholder="Masukkan nominal Rp..."
                    required
                    className={numberInputClass}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPayAmount(Math.round(selectedCustomerForAction.currentDebt / 2))}
                      className="flex-1 text-[10px] text-gray-500"
                    >
                      Bayar Setengah (50%)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPayAmount(selectedCustomerForAction.currentDebt)}
                      className="flex-1 text-[10px] text-gray-500"
                    >
                      Bayar Lunas (100%)
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPayModal(false)}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-900/10">
                    Konfirmasi Bayar
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD DEBT MODAL */}
      <Dialog open={showAddDebtModal && !!selectedCustomerForAction} onOpenChange={setShowAddDebtModal}>
        <DialogContent className="max-w-md">
          {selectedCustomerForAction && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <PlusCircle className="w-5 h-5" /> Catat Hutang Baru
                </DialogTitle>
              </DialogHeader>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nama Pelanggan:</span>
                  <span className="font-bold text-gray-800">{selectedCustomerForAction.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Hutang Saat Ini:</span>
                  <span className="font-bold text-gray-700">Rp {selectedCustomerForAction.currentDebt.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <form onSubmit={submitAddDebt} className="space-y-4 text-xs">
                <div>
                  <Label>Nominal Hutang Baru (Rp)</Label>
                  <NumberInput
                    value={addDebtAmount}
                    onChange={setAddDebtAmount}
                    placeholder="Rp..."
                    required
                    className={numberInputClass}
                  />
                </div>

                <div>
                  <Label>Keterangan / Detail Bahan</Label>
                  <Input
                    type="text"
                    value={debtDescription}
                    onChange={(e) => setDebtDescription(e.target.value)}
                    placeholder="Contoh: Semen 15 sak, Besi Beton 10 btg"
                    required
                  />
                </div>

                <div>
                  <Label>Batas Jatuh Tempo</Label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                    <Input
                      type="date"
                      value={debtDueDate}
                      onChange={(e) => setDebtDueDate(e.target.value)}
                      required
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddDebtModal(false)}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button type="submit" className="flex-1 shadow-sm">
                    Simpan Catatan
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PRINT INVOICE MODAL / SURAT TAGIHAN */}
      <Dialog open={showPrintInvoice && !!selectedCustomerForAction} onOpenChange={setShowPrintInvoice}>
        <DialogContent className="max-w-lg print:p-0 print:border-none print:shadow-none">
          {selectedCustomerForAction && (
            <>
              <DialogHeader className="print:hidden">
                <DialogTitle className="text-gray-800">
                  <FileText className="w-5 h-5" /> Kartu Piutang &amp; Tagihan
                </DialogTitle>
              </DialogHeader>

              {/* Printable Invoice Sheet */}
              <div className="bg-amber-50/20 border border-dashed border-amber-200 rounded-2xl p-6 font-mono text-slate-800 text-[11px] leading-relaxed relative">
                <div className="text-center border-b border-slate-200 pb-4 mb-4">
                  <h4 className="font-black text-sm uppercase tracking-wider text-slate-900">{(storeProfile?.storeName || 'Toko Saya').toUpperCase()}</h4>
                  {(storeProfile?.address || storeProfile?.phone) && (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {[storeProfile?.address, storeProfile?.phone ? `Telp: ${storeProfile.phone}` : null].filter(Boolean).join(' • ')}
                    </p>
                  )}
                  {storeProfile?.taxId && <p className="text-[9px] text-slate-400">NPWP: {storeProfile.taxId}</p>}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span>ID Debitur:</span>
                    <span className="font-bold">{selectedCustomerForAction.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nama Pelanggan:</span>
                    <span className="font-bold uppercase">{selectedCustomerForAction.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Loyalty Status:</span>
                    <span>{selectedCustomerForAction.loyaltyTier}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5">
                    <span>Tanggal Cetak:</span>
                    <span>{new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-black border-b border-slate-200 pb-1 text-slate-900 uppercase tracking-widest text-[10px]">Riwayat Mutasi / Kredit</h5>
                  {selectedCustomerForAction.lastTransactions && selectedCustomerForAction.lastTransactions.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedCustomerForAction.lastTransactions.map((trx, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-4">
                          <div className="text-left">
                            <p className="font-bold text-slate-700">{trx.orderName}</p>
                            <span className="text-[9px] text-slate-400">{trx.date}</span>
                          </div>
                          <span className={`font-black ${trx.amount < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {trx.amount < 0 ? '-' : '+'}Rp {Math.abs(trx.amount).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-slate-400 py-4 italic">Belum ada mutasi piutang tercatat.</p>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3 mt-4 space-y-1">
                  <div className="flex justify-between text-xs font-black">
                    <span className="text-slate-900 uppercase">SISA HUTANG AKTIF:</span>
                    <span className="text-red-600">Rp {selectedCustomerForAction.currentDebt.toLocaleString('id-ID')}</span>
                  </div>
                  {selectedCustomerForAction.nextDueDate && (
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Jatuh Tempo:</span>
                      <span className="font-bold">{new Date(selectedCustomerForAction.nextDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>Status Kolektibilitas:</span>
                    <span className="font-bold">{isEffectivelyOverdue(selectedCustomerForAction) ? 'Jatuh Tempo (Kritis)' : selectedCustomerForAction.currentDebt > 0 ? 'Berjalan (Lancar)' : 'Lunas'}</span>
                  </div>
                </div>

                <div className="text-center border-t border-slate-200 pt-4 mt-4 text-[9px] text-slate-400">
                  <p>Harap lunasi tagihan Anda sebelum jatuh tempo.</p>
                  <p className="font-bold mt-1 text-slate-600">Terima Kasih atas Kemitraan Anda</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 print:hidden pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPrintInvoice(false)}
                  className="flex-1"
                >
                  Tutup
                </Button>
                <Button
                  onClick={simulatePrint}
                  disabled={isPrinting}
                  className="flex-1 shadow-sm"
                >
                  <PrinterIcon className={`w-4 h-4 ${isPrinting ? 'animate-spin' : ''}`} />
                  <span>{isPrinting ? 'Mencetak...' : 'Cetak Tagihan'}</span>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
