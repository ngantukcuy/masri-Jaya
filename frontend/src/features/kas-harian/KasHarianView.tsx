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
} from 'lucide-react';
import { CashSession, SalesInvoice, ReturnRecord } from '../../types';
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
import KasHarianDetailModal from './KasHarianDetailModal';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

interface KasHarianViewProps {
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  salesInvoices?: SalesInvoice[];
  returns?: ReturnRecord[];
  currentUserName?: string;
}

export default function KasHarianView({ onAddActivity, salesInvoices = [], returns = [], currentUserName }: KasHarianViewProps) {
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
  const [detailSession, setDetailSession] = useState<CashSession | null>(null);

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
    const newSession = openSession(openingInput, currentUserName);
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
  const outCategories = ['Kembalian', 'Retur Penjualan', 'Pembayaran Lainnya', 'Pembelian Stok Lokasi SKU', 'Pembelian Stok Pemasok', 'Transaksi Dibatalkan', 'Pembayaran Hutang', 'Withdraw Deposit'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Kas Harian
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Pantau kas masuk, kas keluar, dan kesesuaian uang laci toko.</p>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-muted rounded-xl p-1 border-none gap-0">
            <TabsTrigger
              value="kas"
              className="px-4 py-2 rounded-lg border-none data-[state=active]:bg-background data-[state=active]:shadow data-[state=active]:text-primary uppercase tracking-wider"
            >
              Kas Hari Ini
            </TabsTrigger>
            <TabsTrigger
              value="laporan"
              className="px-4 py-2 rounded-lg border-none data-[state=active]:bg-background data-[state=active]:shadow data-[state=active]:text-primary uppercase tracking-wider"
            >
              Laporan
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'kas' && (
        <>
          {!session ? (
            <Card className="p-8 flex flex-col items-center text-center gap-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-extrabold text-foreground">Kas Harian Belum Dibuka</h3>
                <p className="text-xs text-muted-foreground mt-1">Masukkan jumlah kas awal yang sudah disiapkan di laci sebelum mulai melayani transaksi tunai.</p>
              </div>
              <div className="w-full">
                <Label className="text-left">Jumlah Kas Awal (IDR)</Label>
                <NumberInput
                  value={openingInput}
                  onChange={setOpeningInput}
                  placeholder="0"
                  className="w-full border border-input rounded-xl p-3 text-center font-bold text-lg outline-none focus:border-primary"
                />
              </div>
              <Button onClick={handleOpenSession} size="lg" className="w-full">
                <Unlock className="w-4 h-4" />
                Buka Kas Harian
              </Button>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kas Awal</p>
                  <p className="text-lg font-black text-foreground mt-1">Rp {session.openingBalance.toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Dibuka {session.openedAt}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kas Masuk</p>
                  <p className="text-lg font-black text-emerald-600 mt-1">+Rp {(totals?.totalIn || 0).toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{session.totalInvoicesCash} invoice tunai</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kas Keluar</p>
                  <p className="text-lg font-black text-red-500 mt-1">-Rp {(totals?.totalOut || 0).toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{session.mutations.filter(m => m.type === 'out').length} transaksi</p>
                </Card>
                <Card className="p-4 bg-primary border-primary text-primary-foreground">
                  <p className="text-[10px] font-bold text-primary-foreground/80 uppercase tracking-wider">Total Kas Sistem</p>
                  <p className="text-lg font-black mt-1">Rp {(totals?.systemTotal || 0).toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-primary-foreground/80 mt-1">Seharusnya ada di laci</p>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => { setShowMutationModal('in'); setMutationCategory('Kas Tambahan'); }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                >
                  <PlusCircle className="w-4 h-4" /> Catat Kas Masuk
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setShowMutationModal('out'); setMutationCategory('Pembayaran Lainnya'); }}
                  className="bg-red-50 hover:bg-red-100 text-red-700"
                >
                  <MinusCircle className="w-4 h-4" /> Catat Kas Keluar
                </Button>
                <Button variant="secondary" onClick={() => setDetailSession(session)}>
                  Lihat Ringkasan Lengkap
                </Button>
                <Button
                  onClick={() => { setShowCloseModal(true); setActualCashInput(totals?.systemTotal || 0); }}
                  className="ml-auto bg-gray-900 hover:bg-black text-white"
                >
                  <Lock className="w-4 h-4" /> Tutup Kas Harian
                </Button>
              </div>

              {/* Mutations List */}
              <Card className="p-0 gap-0 overflow-hidden">
                <CardHeader className="p-4 border-b border-border">
                  <CardTitle>Mutasi Kas Hari Ini</CardTitle>
                </CardHeader>
                <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                  {session.mutations.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">Belum ada mutasi kas tercatat hari ini.</p>
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
                            <p className="font-bold text-foreground">{m.category}</p>
                            {m.note && <p className="text-[10px] text-muted-foreground mt-0.5">{m.note}</p>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-3">
                          <p className={`font-extrabold ${m.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {m.type === 'in' ? '+' : '-'}Rp {m.amount.toLocaleString('id-ID')}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{m.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {activeTab === 'laporan' && (
        <Card className="p-0 gap-0 overflow-hidden">
          <CardHeader className="p-4 border-b border-border flex-row items-center gap-2 space-y-0">
            <History className="w-4 h-4 text-muted-foreground" />
            <CardTitle>Riwayat Kas Harian (Sesi Ditutup)</CardTitle>
          </CardHeader>
          <div className="divide-y divide-border">
            {history.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">Belum ada sesi kas harian yang ditutup.</p>
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
                        <p className="font-extrabold text-foreground text-xs">{h.date}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{h.openedAt} – {h.closedAt} · {h.totalInvoicesCash + h.totalInvoicesNonCash} invoice ({h.totalStocksSoldCash} item terjual tunai)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-foreground text-sm">Rp {(h.closingActual || 0).toLocaleString('id-ID')}</p>
                        <p className={`text-[10px] font-bold ${selisihHist === 0 ? 'text-emerald-600' : selisihHist > 0 ? 'text-primary' : 'text-red-500'}`}>
                          {selisihHist === 0 ? 'Sesuai' : selisihHist > 0 ? `Lebih Rp ${selisihHist.toLocaleString('id-ID')}` : `Kurang Rp ${Math.abs(selisihHist).toLocaleString('id-ID')}`}
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        <Button variant="secondary" size="sm" className="w-full uppercase" onClick={() => setDetailSession(h)}>
                          Lihat Ringkasan Lengkap
                        </Button>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-muted rounded-lg p-2">
                            <p className="text-[9px] text-muted-foreground font-bold uppercase">Kas Awal</p>
                            <p className="font-bold text-xs text-foreground/80">Rp {h.openingBalance.toLocaleString('id-ID')}</p>
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
                        <div className="border border-border rounded-lg divide-y divide-border">
                          {h.mutations.length === 0 ? (
                            <p className="p-3 text-center text-[10px] text-muted-foreground">Tidak ada mutasi pada sesi ini.</p>
                          ) : (
                            h.mutations.map((m) => (
                              <div key={m.id} className="flex justify-between p-2.5 text-[11px]">
                                <span className="text-foreground/80 font-semibold">{m.category}</span>
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
        </Card>
      )}

      {/* Mutation Modal */}
      <Dialog open={!!showMutationModal} onOpenChange={(open) => !open && setShowMutationModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm text-foreground normal-case tracking-normal">
              {showMutationModal === 'in' ? 'Catat Kas Masuk' : 'Catat Kas Keluar'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Kategori</Label>
              <Select value={mutationCategory} onValueChange={setMutationCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(showMutationModal === 'in' ? inCategories : outCategories).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Nominal (IDR)</Label>
              <NumberInput
                value={mutationAmount}
                onChange={setMutationAmount}
                className="w-full border border-input rounded-lg p-2.5 text-sm font-bold outline-none"
                placeholder="0"
              />
            </div>

            <div>
              <Label>Catatan (opsional)</Label>
              <Input
                type="text"
                value={mutationNote}
                onChange={(e) => setMutationNote(e.target.value)}
                placeholder="Contoh: tips supir, beli ATK, dsb."
              />
            </div>

            <Button
              onClick={handleSubmitMutation}
              className={`w-full ${showMutationModal === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              Simpan Mutasi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Session Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm text-foreground normal-case tracking-normal">Tutup Kas Harian</DialogTitle>
          </DialogHeader>

          {session && totals && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Kas Sistem</span><span className="font-bold text-foreground/80">Rp {totals.systemTotal.toLocaleString('id-ID')}</span></div>
              </div>

              <div>
                <Label>Jumlah Kas Aktual di Laci</Label>
                <NumberInput
                  value={actualCashInput}
                  onChange={setActualCashInput}
                  placeholder="0"
                  className="w-full border border-input rounded-lg p-3 text-center text-lg font-black outline-none"
                />
              </div>

              {selisih !== 0 && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-bold ${selisih > 0 ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-600'}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {selisih > 0 ? `Kas lebih Rp ${selisih.toLocaleString('id-ID')}` : `Kas kurang Rp ${Math.abs(selisih).toLocaleString('id-ID')}`}
                </div>
              )}

              <Button onClick={handleCloseSession} className="w-full bg-gray-900 hover:bg-black text-white">
                <CheckCircle2 className="w-4 h-4" /> Konfirmasi & Tutup Kas
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {detailSession && (
        <KasHarianDetailModal
          session={detailSession}
          salesInvoices={salesInvoices}
          returns={returns}
          onClose={() => setDetailSession(null)}
        />
      )}
    </div>
  );
}
