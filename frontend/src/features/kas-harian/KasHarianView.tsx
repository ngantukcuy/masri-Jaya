import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Lock,
  Unlock,
  ArrowUpCircle,
  ArrowDownCircle,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  History,
  AlertTriangle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CashSession } from '../../types';
import {
  getCurrentSession,
  getSessionHistory,
  openSession,
  closeSession,
  addMutation,
  getMutationTotals
} from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import NumberInput from '../../components/shared/NumberInput';

interface KasHarianViewProps {
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
}

export default function KasHarianView({ onAddActivity }: KasHarianViewProps) {
  const dialog = useDialog();
  const [session, setSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [activeTab, setActiveTab] = useState<'kas' | 'laporan'>('kas');

  const [openingInput, setOpeningInput] = useState<number>(500000);

  const [showMutationModal, setShowMutationModal] = useState<'in' | 'out' | null>(null);
  const [mutationCategory, setMutationCategory] = useState('Kas Tambahan');
  const [mutationAmount, setMutationAmount] = useState<number>(0);
  const [mutationNote, setMutationNote] = useState('');

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCashInput, setActualCashInput] = useState<number>(0);

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const refresh = () => {
    setSession(getCurrentSession());
    setHistory(getSessionHistory());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleOpenSession = () => {
    if (openingInput < 0) {
      dialog.alert('Jumlah kas awal tidak boleh negatif.');
      return;
    }
    const newSession = openSession(openingInput);
    onAddActivity(
      'Kas Harian Dibuka',
      `Kas awal Rp ${openingInput.toLocaleString('id-ID')} disiapkan di laci`,
      0,
      'quote'
    );
    setSession(newSession);
  };

  const handleSubmitMutation = () => {
    if (!showMutationModal) return;
    if (mutationAmount <= 0) {
      dialog.alert('Nominal harus lebih dari 0.');
      return;
    }
    const updated = addMutation(showMutationModal, mutationCategory, mutationAmount, mutationNote || undefined);
    if (updated) {
      setSession(updated);
      onAddActivity(
        showMutationModal === 'in' ? 'Kas Masuk Dicatat' : 'Kas Keluar Dicatat',
        `${mutationCategory}: Rp ${mutationAmount.toLocaleString('id-ID')}`,
        0,
        'quote'
      );
    }
    setShowMutationModal(null);
    setMutationAmount(0);
    setMutationNote('');
    setMutationCategory('Kas Tambahan');
  };

  const handleCloseSession = () => {
    const closed = closeSession(actualCashInput);
    if (closed) {
      onAddActivity(
        'Kas Harian Ditutup',
        `Total kas akhir tercatat Rp ${actualCashInput.toLocaleString('id-ID')}`,
        0,
        'quote'
      );
    }
    setShowCloseModal(false);
    setActualCashInput(0);
    refresh();
  };

  const totals = session ? getMutationTotals(session) : null;
  const selisih = showCloseModal && totals ? actualCashInput - totals.systemTotal : 0;

  const inCategories = ['Kas Tambahan', 'Top Up Deposit', 'Pembayaran Piutang', 'Retur Pembelian', 'Penjualan Tunai Lainnya'];
  const outCategories = ['Kembalian', 'Retur Penjualan', 'Pembayaran Lainnya', 'Pembelian Stok', 'Transaksi Dibatalkan', 'Pembayaran Hutang', 'Withdraw Deposit'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            Kas Harian
          </h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Pantau kas masuk, kas keluar, dan kesesuaian uang laci toko.</p>
        </div>
        <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('kas')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'kas' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Kas Hari Ini
          </button>
          <button
            onClick={() => setActiveTab('laporan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'laporan' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Laporan
          </button>
        </div>
      </div>

      {activeTab === 'kas' && (
        <>
          {!session ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900">Kas Harian Belum Dibuka</h3>
                <p className="text-xs text-gray-500 mt-1">Masukkan jumlah kas awal yang sudah disiapkan di laci sebelum mulai melayani transaksi tunai.</p>
              </div>
              <div className="w-full">
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5 text-left">Jumlah Kas Awal (IDR)</label>
                <NumberInput
                  value={openingInput}
                  onChange={setOpeningInput}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl p-3 text-center font-bold text-lg outline-none focus:border-blue-400"
                />
              </div>
              <button
                onClick={handleOpenSession}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl cursor-pointer flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                Buka Kas Harian
              </button>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kas Awal</p>
                  <p className="text-lg font-black text-gray-900 mt-1">Rp {session.openingBalance.toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Dibuka {session.openedAt}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kas Masuk</p>
                  <p className="text-lg font-black text-emerald-600 mt-1">+Rp {(totals?.totalIn || 0).toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{session.totalInvoicesCash} invoice tunai</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kas Keluar</p>
                  <p className="text-lg font-black text-red-500 mt-1">-Rp {(totals?.totalOut || 0).toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{session.mutations.filter(m => m.type === 'out').length} transaksi</p>
                </div>
                <div className="bg-blue-600 rounded-2xl shadow-sm p-4 text-white">
                  <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Total Kas Sistem</p>
                  <p className="text-lg font-black mt-1">Rp {(totals?.systemTotal || 0).toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-blue-100 mt-1">Seharusnya ada di laci</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setShowMutationModal('in'); setMutationCategory('Kas Tambahan'); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Catat Kas Masuk
                </button>
                <button
                  onClick={() => { setShowMutationModal('out'); setMutationCategory('Pembayaran Lainnya'); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  <MinusCircle className="w-4 h-4" /> Catat Kas Keluar
                </button>
                <button
                  onClick={() => { setShowCloseModal(true); setActualCashInput(totals?.systemTotal || 0); }}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Lock className="w-4 h-4" /> Tutup Kas Harian
                </button>
              </div>

              {/* Mutations List */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h4 className="font-extrabold text-sm text-gray-800">Mutasi Kas Hari Ini</h4>
                </div>
                <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                  {session.mutations.length === 0 ? (
                    <p className="p-6 text-center text-xs text-gray-400">Belum ada mutasi kas tercatat hari ini.</p>
                  ) : (
                    session.mutations.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3.5 text-xs">
                        <div className="flex items-center gap-2.5">
                          {m.type === 'in' ? (
                            <ArrowUpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <ArrowDownCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-gray-800">{m.category}</p>
                            {m.note && <p className="text-[10px] text-gray-400 mt-0.5">{m.note}</p>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-3">
                          <p className={`font-extrabold ${m.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {m.type === 'in' ? '+' : '-'}Rp {m.amount.toLocaleString('id-ID')}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{m.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'laporan' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            <h4 className="font-extrabold text-sm text-gray-800">Riwayat Kas Harian (Sesi Ditutup)</h4>
          </div>
          <div className="divide-y divide-gray-100">
            {history.length === 0 ? (
              <p className="p-6 text-center text-xs text-gray-400">Belum ada sesi kas harian yang ditutup.</p>
            ) : (
              history.map((h) => {
                const t = getMutationTotals(h);
                const selisihHist = (h.closingActual || 0) - t.systemTotal;
                const isExpanded = expandedHistoryId === h.id;
                return (
                  <div key={h.id} className="p-4">
                    <button
                      onClick={() => setExpandedHistoryId(isExpanded ? null : h.id)}
                      className="w-full flex items-center justify-between text-left cursor-pointer"
                    >
                      <div>
                        <p className="font-extrabold text-gray-800 text-xs">{h.date}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{h.openedAt} – {h.closedAt} · {h.totalInvoicesCash + h.totalInvoicesNonCash} invoice ({h.totalStocksSoldCash} item terjual tunai)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-gray-900 text-sm">Rp {(h.closingActual || 0).toLocaleString('id-ID')}</p>
                        <p className={`text-[10px] font-bold ${selisihHist === 0 ? 'text-emerald-600' : selisihHist > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                          {selisihHist === 0 ? 'Sesuai' : selisihHist > 0 ? `Lebih Rp ${selisihHist.toLocaleString('id-ID')}` : `Kurang Rp ${Math.abs(selisihHist).toLocaleString('id-ID')}`}
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-[9px] text-gray-400 font-bold uppercase">Kas Awal</p>
                            <p className="font-bold text-xs text-gray-800">Rp {h.openingBalance.toLocaleString('id-ID')}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-2">
                            <p className="text-[9px] text-emerald-500 font-bold uppercase">Kas Masuk</p>
                            <p className="font-bold text-xs text-emerald-700">Rp {t.totalIn.toLocaleString('id-ID')}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2">
                            <p className="text-[9px] text-red-400 font-bold uppercase">Kas Keluar</p>
                            <p className="font-bold text-xs text-red-600">Rp {t.totalOut.toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                        <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
                          {h.mutations.length === 0 ? (
                            <p className="p-3 text-center text-[10px] text-gray-400">Tidak ada mutasi pada sesi ini.</p>
                          ) : (
                            h.mutations.map((m) => (
                              <div key={m.id} className="flex justify-between p-2.5 text-[11px]">
                                <span className="text-gray-600 font-semibold">{m.category}</span>
                                <span className={`font-bold ${m.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {m.type === 'in' ? '+' : '-'}Rp {m.amount.toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Mutation Modal */}
      <AnimatePresence>
        {showMutationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-gray-900">
                  {showMutationModal === 'in' ? 'Catat Kas Masuk' : 'Catat Kas Keluar'}
                </h4>
                <button onClick={() => setShowMutationModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Kategori</label>
                <select
                  value={mutationCategory}
                  onChange={(e) => setMutationCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-xs font-bold outline-none"
                >
                  {(showMutationModal === 'in' ? inCategories : outCategories).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Nominal (IDR)</label>
                <NumberInput
                  value={mutationAmount}
                  onChange={setMutationAmount}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-bold outline-none"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Catatan (opsional)</label>
                <input
                  type="text"
                  value={mutationNote}
                  onChange={(e) => setMutationNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-xs outline-none"
                  placeholder="Contoh: tips supir, beli ATK, dsb."
                />
              </div>

              <button
                onClick={handleSubmitMutation}
                className={`w-full py-2.5 rounded-xl font-extrabold text-xs text-white cursor-pointer ${showMutationModal === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                Simpan Mutasi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close Session Modal */}
      <AnimatePresence>
        {showCloseModal && session && totals && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-gray-900">Tutup Kas Harian</h4>
                <button onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">Total Kas Sistem</span><span className="font-bold text-gray-800">Rp {totals.systemTotal.toLocaleString('id-ID')}</span></div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Jumlah Kas Aktual di Laci</label>
                <NumberInput
                  value={actualCashInput}
                  onChange={setActualCashInput}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg p-3 text-center text-lg font-black outline-none"
                />
              </div>

              {selisih !== 0 && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-bold ${selisih > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {selisih > 0 ? `Kas lebih Rp ${selisih.toLocaleString('id-ID')}` : `Kas kurang Rp ${Math.abs(selisih).toLocaleString('id-ID')}`}
                </div>
              )}

              <button
                onClick={handleCloseSession}
                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-extrabold text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Konfirmasi & Tutup Kas
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
