import React, { useState } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Check,
  X
} from 'lucide-react';
import { Expense } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import NumberInput from '../../components/shared/NumberInput';

interface FinanceViewProps {
  expenses: Expense[];
  onUpdateExpenses: (updatedExpenses: Expense[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote') => void;
  currentUser?: CurrentUser | null;
}

interface PendingApproval {
  id: string;
  item: string;
  submittedBy: string;
  amount: number;
  category: 'Office' | 'Travel' | 'Logistics' | 'Supplies' | 'Utility';
}

export default function FinanceView({ expenses, onUpdateExpenses, onAddActivity, currentUser }: FinanceViewProps) {
  const dialog = useDialog();
  // Same gap as the retur bug: without this, anyone who can open the Finance
  // tab could approve/reject reimbursement claims regardless of role.
  const canApproveFinance = hasPermission(currentUser, 'manage_finance_approve');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('Semua');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  // Translate categories
  const categoryTranslationMap: Record<string, string> = {
    'Office': 'Kantor',
    'Travel': 'Perjalanan / BBM',
    'Logistics': 'Logistik Armada',
    'Supplies': 'Perlengkapan Toko',
    'Utility': 'Utilitas & Listrik'
  };

  // Pending claims in IDR equivalents (local queue — not yet wired to a shared backend table)
  const [pendingClaims, setPendingClaims] = useState<PendingApproval[]>([]);

  // Form states for new expense
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpAmount, setNewExpAmount] = useState(150000);
  const [newExpCat, setNewExpCat] = useState<'Office' | 'Travel' | 'Logistics' | 'Supplies' | 'Utility'>('Supplies');
  const [newExpUser, setNewExpUser] = useState('');
  const [newExpMethod, setNewExpMethod] = useState<'Tunai' | 'Transfer' | 'Giro'>('Tunai');

  // Weekly Cash Flow chart data in IDR
  const weeklyCashFlow = [
    { day: 'Sen', sales: 12400000, supplier: 4000000, expense: 1200000 },
    { day: 'Sel', sales: 18500000, supplier: 2500000, expense: 2100000 },
    { day: 'Rab', sales: 14200000, supplier: 6500000, expense: 1800000 },
    { day: 'Kam', sales: 24500000, supplier: 3000000, expense: 3200000 },
    { day: 'Jum', sales: 32100000, supplier: 12400000, expense: 4500000 },
    { day: 'Sab', sales: 15400000, supplier: 0, expense: 800000 },
    { day: 'Min', sales: 9800000, supplier: 0, expense: 500000 }
  ];

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

  // Filtered Expenses
  const filteredExpenses = expenses.filter((e) => {
    if (activeCategoryFilter === 'Semua') return true;
    return e.category === activeCategoryFilter;
  });

  const totalExpensesThisMonth = expenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Kas &amp; Pengeluaran Keuangan</h2>
          <p className="text-gray-500 text-sm">Kelola pengeluaran operasional harian, persetujuan klaim staf, dan buku jurnal kas keluar.</p>
        </div>
        <button 
          onClick={() => setShowSubmitModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Pengeluaran Kas</span>
        </button>
      </div>

      {/* Finance Metrics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">RASIO ARUS KAS MASUK</p>
            <h4 className="text-lg font-black text-emerald-600 mt-0.5">74.2% Efisien</h4>
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

      {/* Weekly Cash Flow Visualiser (Weekly Bar Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Weekly Cash Flow Visualiser */}
        <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-black text-gray-800 tracking-tight">Rasio Aliran Kas Mingguan</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Laporan komparatif pemasukan kasir vs belanja modal supplier &amp; operasional harian</p>
          </div>

          {/* Bar Charts Graph with Hover State */}
          <div className="relative h-44 mt-6 flex items-end justify-between px-2">
            {weeklyCashFlow.map((day, idx) => {
              const maxVal = 40000000;
              const salesHeight = (day.sales / maxVal) * 120;
              const supplierHeight = (day.supplier / maxVal) * 120;
              const expenseHeight = (day.expense / maxVal) * 120;

              return (
                <div 
                  key={day.day} 
                  className="flex flex-col items-center flex-1 group"
                  onMouseEnter={() => setHoveredDayIdx(idx)}
                  onMouseLeave={() => setHoveredDayIdx(null)}
                >
                  {/* Floating value popovers */}
                  <AnimatePresence>
                    {hoveredDayIdx === idx && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: -15 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute bottom-24 bg-gray-900 text-white rounded-lg p-2.5 shadow-xl text-[10px] w-48 border border-gray-800 z-10 space-y-1"
                      >
                        <p className="font-extrabold text-blue-400 mb-1 border-b border-gray-800 pb-1 uppercase">{day.day} - Detail Arus Kas</p>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Kas Masuk:</span>
                          <span className="font-bold text-emerald-400">Rp {day.sales.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Supplier:</span>
                          <span className="font-bold text-amber-400">Rp {day.supplier.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Pengeluaran:</span>
                          <span className="font-bold text-red-400">Rp {day.expense.toLocaleString('id-ID')}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bars stack column */}
                  <div className="flex items-end gap-1.5 h-32 relative">
                    <div 
                      style={{ height: `${salesHeight}px` }} 
                      className="w-2 bg-blue-600 rounded-t transition-all group-hover:brightness-110" 
                      title="Kas Masuk"
                    />
                    <div 
                      style={{ height: `${supplierHeight}px` }} 
                      className="w-2 bg-amber-500 rounded-t transition-all group-hover:brightness-110" 
                      title="Supplier"
                    />
                    <div 
                      style={{ height: `${expenseHeight}px` }} 
                      className="w-2 bg-red-500 rounded-t transition-all group-hover:brightness-110" 
                      title="Operasional"
                    />
                  </div>

                  <span className="text-[10px] font-bold text-gray-400 mt-2">{day.day}</span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-600 rounded-full" />
              <span>Pemasukan Toko</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              <span>Biaya Supplier</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              <span>Pengeluaran Operasional</span>
            </div>
          </div>
        </div>

        {/* Right: Employee Claim Approvals list */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
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
      </div>

      {/* Cash Ledger / Jurnal Kas Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="text-sm font-bold text-gray-800">Log Buku Kas Jurnal Pengeluaran</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Arsip seluruh bukti nota fisik dan status pencairan pengeluaran kas toko</p>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
            {['Semua', 'Office', 'Travel', 'Logistics', 'Supplies', 'Utility'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategoryFilter === cat || (cat === 'Semua' && activeCategoryFilter === 'Semua')
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cat === 'Semua' ? 'Semua Pengeluaran' : (categoryTranslationMap[cat] || cat)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[10px] text-gray-400 font-bold uppercase border-b border-gray-100">
                <th className="py-3 px-4">Nomor Ref</th>
                <th className="py-3 px-4">Tanggal Pencatatan</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Rincian Deskripsi</th>
                <th className="py-3 px-4">Penerima Manfaat</th>
                <th className="py-3 px-4 text-right">Nilai Pengeluaran</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-bold">Tidak ada pengeluaran kas yang cocok dengan kategori filter.</td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-800">{exp.id}</td>
                    <td className="py-3.5 px-4 text-gray-500 font-medium">{exp.date}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-600">
                      {categoryTranslationMap[exp.category] || exp.category}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-900">{exp.description}</td>
                    <td className="py-3.5 px-4 font-medium text-gray-600">{exp.submittedBy}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-red-600">
                      -Rp {exp.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        exp.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {exp.status === 'Approved' ? 'DISETUJUI' : 'DRAFT'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    <option value="Supplies">Perlengkapan Toko</option>
                    <option value="Office">Kebutuhan Kantor / ATK</option>
                    <option value="Travel">BBM / Perjalanan Armada</option>
                    <option value="Logistics">Transportasi Logistik Cargo</option>
                    <option value="Utility">Utilitas &amp; Biaya Listrik / Air</option>
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
