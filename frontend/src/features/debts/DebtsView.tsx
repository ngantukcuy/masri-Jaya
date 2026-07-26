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
  X,
  PlusCircle,
  FileText
} from 'lucide-react';
import { Customer, Printer } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { addMutation } from '../../lib/cashSession';
import { getSupabaseTableCache } from '../../lib/supabaseCache';

interface DebtsStoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  taxId?: string;
}

interface DebtsViewProps {
  customers: Customer[];
  onUpdateCustomers: (updatedCustomers: Customer[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote') => void;
  storeProfile?: DebtsStoreProfileLite;
}

export default function DebtsView({ 
  customers, 
  onUpdateCustomers, 
  onAddActivity,
  storeProfile,
}: DebtsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Cleared' | 'Pending' | 'Overdue'>('Semua');
  
  // Modals state
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [selectedCustomerForAction, setSelectedCustomerForAction] = useState<Customer | null>(null);
  const [showPrintInvoice, setShowPrintInvoice] = useState(false);
  
  // Form states
  const [payAmount, setPayAmount] = useState('');
  const [addDebtAmount, setAddDebtAmount] = useState('');
  const [debtDescription, setDebtDescription] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');

  // Toast / feedback state
  const [toastMsg, setToastMsg] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Get filtered customers
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Semua' || c.debtStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalDebt = customers.reduce((acc, c) => acc + (c.currentDebt || 0), 0);
  const totalOverdue = customers.reduce((acc, c) => acc + (c.overdueAmount || (c.debtStatus === 'Overdue' ? c.currentDebt : 0)), 0);
  const activeDebtorsCount = customers.filter(c => c.currentDebt > 0).length;
  const overdueDebtorsCount = customers.filter(c => c.debtStatus === 'Overdue' && c.currentDebt > 0).length;

  const handleOpenPayModal = (customer: Customer) => {
    setSelectedCustomerForAction(customer);
    setPayAmount(customer.currentDebt.toString());
    setShowPayModal(true);
  };

  const handleOpenAddDebtModal = (customer: Customer) => {
    setSelectedCustomerForAction(customer);
    setAddDebtAmount('');
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

    const payment = Number(payAmount);
    if (isNaN(payment) || payment <= 0) {
      alert("Masukkan nominal pembayaran yang valid!");
      return;
    }

    if (payment > selectedCustomerForAction.currentDebt) {
      alert("Nominal pembayaran melebihi total sisa hutang!");
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
          lastTransactions: updatedTransactions
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

    const amount = Number(addDebtAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Masukkan nominal penambahan hutang yang valid!");
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
          lastTransactions: nextTransactions
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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text"
              placeholder="Cari nama debitur atau ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-600/15"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto">
            {(['Semua', 'Pending', 'Overdue', 'Cleared'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                  statusFilter === st 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {st === 'Semua' ? 'Semua Debitur' : st === 'Pending' ? 'Berjalan (Pending)' : st === 'Overdue' ? 'Jatuh Tempo (Overdue)' : 'Lunas (Cleared)'}
              </button>
            ))}
          </div>
        </div>

        {/* List of Debtors */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-slate-100/50">
                <th className="p-4 font-extrabold text-gray-500 uppercase tracking-widest text-[9px]">ID &amp; Pelanggan</th>
                <th className="p-4 font-extrabold text-gray-500 uppercase tracking-widest text-[9px]">Tingkat Loyalitas</th>
                <th className="p-4 font-extrabold text-gray-500 uppercase tracking-widest text-[9px]">Status Kredit</th>
                <th className="p-4 font-extrabold text-gray-500 uppercase tracking-widest text-[9px]">Sisa Piutang Aktif</th>
                <th className="p-4 font-extrabold text-gray-500 uppercase tracking-widest text-[9px] text-right">Opsi Operasional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    <span className="text-2xl block mb-2">📒</span>
                    <span className="font-extrabold uppercase tracking-wider block text-xs">Tidak Ada Data Piutang</span>
                    <span className="text-[10px] text-gray-400 mt-1 block">Silakan ubah filter atau tambahkan transaksi piutang baru di POS.</span>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
                          {cust.logoLetters}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{cust.name}</h4>
                          <p className="text-[9px] text-gray-400 mt-0.5">{cust.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-gray-600">{cust.loyaltyTier}</td>
                    <td className="p-4">
                      {cust.currentDebt === 0 ? (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-emerald-100">Lunas</span>
                      ) : cust.debtStatus === 'Overdue' ? (
                        <span className="bg-red-50 text-red-700 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-red-100 animate-pulse">Jatuh Tempo</span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-amber-100">Berjalan</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`font-black text-xs ${cust.currentDebt > 0 ? 'text-gray-800' : 'text-emerald-600'}`}>
                        Rp {cust.currentDebt.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenInvoice(cust)}
                          className="bg-gray-100 hover:bg-slate-200 text-gray-700 font-extrabold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="Cetak Surat Tagihan"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Surat</span>
                        </button>
                        <button
                          onClick={() => handleOpenAddDebtModal(cust)}
                          className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-extrabold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="Tambah Hutang Baru"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Kredit</span>
                        </button>
                        {cust.currentDebt > 0 && (
                          <button
                            onClick={() => handleOpenPayModal(cust)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Bayar Cicilan"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Cicil / Lunas</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REPAYMENT MODAL */}
      <AnimatePresence>
        {showPayModal && selectedCustomerForAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPayModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-md w-full border border-gray-200 p-6 shadow-2xl max-h-[85vh] overflow-y-auto relative z-10 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-800">Pembayaran Cicilan Piutang</h3>
                </div>
                <button onClick={() => setShowPayModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

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
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Nominal Pembayaran (Rp)</label>
                  <input 
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Masukkan nominal Rp..."
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 font-black text-sm outline-none focus:ring-2 focus:ring-emerald-500/15 text-gray-800"
                  />
                  <div className="flex gap-2 mt-2">
                    <button 
                      type="button"
                      onClick={() => setPayAmount((selectedCustomerForAction.currentDebt / 2).toString())}
                      className="flex-1 py-1 px-2 border border-gray-200 rounded-lg hover:bg-slate-50 text-[10px] text-gray-500 font-bold"
                    >
                      Bayar Setengah (50%)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPayAmount(selectedCustomerForAction.currentDebt.toString())}
                      className="flex-1 py-1 px-2 border border-gray-200 rounded-lg hover:bg-slate-50 text-[10px] text-gray-500 font-bold"
                    >
                      Bayar Lunas (100%)
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPayModal(false)}
                    className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl cursor-pointer text-xs uppercase"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl cursor-pointer text-xs uppercase shadow-sm shadow-emerald-900/10"
                  >
                    Konfirmasi Bayar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD DEBT MODAL */}
      <AnimatePresence>
        {showAddDebtModal && selectedCustomerForAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddDebtModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-md w-full border border-gray-200 p-6 shadow-2xl max-h-[85vh] overflow-y-auto relative z-10 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-blue-600" />
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-800">Catat Hutang Baru</h3>
                </div>
                <button onClick={() => setShowAddDebtModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

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
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Nominal Hutang Baru (Rp)</label>
                  <input 
                    type="number"
                    value={addDebtAmount}
                    onChange={(e) => setAddDebtAmount(e.target.value)}
                    placeholder="Rp..."
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 font-black text-sm outline-none focus:ring-2 focus:ring-blue-500/15 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Keterangan / Detail Bahan</label>
                  <input 
                    type="text"
                    value={debtDescription}
                    onChange={(e) => setDebtDescription(e.target.value)}
                    placeholder="Contoh: Semen 15 sak, Besi Beton 10 btg"
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500/15 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Batas Jatuh Tempo</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="date"
                      value={debtDueDate}
                      onChange={(e) => setDebtDueDate(e.target.value)}
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3.5 py-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500/15 text-gray-800"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddDebtModal(false)}
                    className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl cursor-pointer text-xs uppercase"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl cursor-pointer text-xs uppercase shadow-sm"
                  >
                    Simpan Catatan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT INVOICE MODAL / SURAT TAGIHAN */}
      <AnimatePresence>
        {showPrintInvoice && selectedCustomerForAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPrintInvoice(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 p-6 shadow-2xl max-h-[85vh] overflow-y-auto relative z-10 space-y-4 print:p-0 print:border-none print:shadow-none"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-700" />
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-800">Kartu Piutang &amp; Tagihan</h3>
                </div>
                <button onClick={() => setShowPrintInvoice(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

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
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>Status Kolektibilitas:</span>
                    <span className="font-bold">{selectedCustomerForAction.debtStatus === 'Overdue' ? 'Jatuh Tempo (Kritis)' : selectedCustomerForAction.currentDebt > 0 ? 'Berjalan (Lancar)' : 'Lunas'}</span>
                  </div>
                </div>

                <div className="text-center border-t border-slate-200 pt-4 mt-4 text-[9px] text-slate-400">
                  <p>Harap lunasi tagihan Anda sebelum jatuh tempo.</p>
                  <p className="font-bold mt-1 text-slate-600">Terima Kasih atas Kemitraan Anda</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 print:hidden pt-2">
                <button
                  onClick={() => setShowPrintInvoice(false)}
                  className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl cursor-pointer text-xs uppercase"
                >
                  Tutup
                </button>
                <button
                  onClick={simulatePrint}
                  disabled={isPrinting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl cursor-pointer text-xs uppercase shadow-sm flex items-center justify-center gap-2"
                >
                  <PrinterIcon className={`w-4 h-4 ${isPrinting ? 'animate-spin' : ''}`} />
                  <span>{isPrinting ? 'Mencetak...' : 'Cetak Tagihan'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
