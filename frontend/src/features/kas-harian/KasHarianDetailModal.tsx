import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CashSession, SalesInvoice, ReturnRecord } from '../../types';
import { getMutationTotals } from '../../lib/cashSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';

interface KasHarianDetailModalProps {
  session: CashSession;
  salesInvoices: SalesInvoice[];
  returns: ReturnRecord[];
  onClose: () => void;
}

const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

// Semua metode bayar yang ada di POS. `masukKas` = nominalnya masuk ke laci
// (Kas Harian). Metode lain (QRIS, Transfer, Deposit, Piutang) tetap dicatat
// dan tampil di ringkasan ini, tapi TIDAK menambah kas laci karena bayarnya
// tidak lewat laci (tidak memakai payment gateway, dicek manual di rekening).
const PAYMENT_METHODS = [
  { key: 'Cash', label: 'Tunai', masukKas: true },
  { key: 'QRIS', label: 'QRIS', masukKas: false },
  { key: 'Transfer', label: 'Transfer', masukKas: false },
  { key: 'Deposit', label: 'Deposit', masukKas: false },
  { key: 'Piutang', label: 'Piutang', masukKas: false },
  { key: 'Split', label: 'Bayar Sebagian', masukKas: true },
] as const;

export default function KasHarianDetailModal({ session, salesInvoices, returns, onClose }: KasHarianDetailModalProps) {
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  // Cocokkan invoice & retur yang terjadi selama jendela waktu sesi ini
  // (dari waktu buka sampai waktu tutup, atau sampai sekarang kalau sesi
  // masih berjalan). Sesi lama yang belum punya openedAtISO (dibuat
  // sebelum field ini ada) tidak bisa dicocokkan secara akurat.
  const windowStart = session.openedAtISO ? new Date(session.openedAtISO) : null;
  const windowEnd = session.closedAtISO ? new Date(session.closedAtISO) : new Date();

  const matchedInvoices = useMemo(() => {
    if (!windowStart) return [];
    return salesInvoices.filter((inv) => {
      if (!inv.createdAt) return false;
      const t = new Date(inv.createdAt);
      return t >= windowStart && t <= windowEnd;
    });
  }, [salesInvoices, session.id]);

  const matchedReturns = useMemo(() => {
    if (!windowStart) return [];
    return returns.filter((r) => {
      if (r.type !== 'Penjualan' || !r.createdAt) return false;
      const t = new Date(r.createdAt);
      return t >= windowStart && t <= windowEnd;
    });
  }, [returns, session.id]);

  const jumlahItemTerjual = matchedInvoices.reduce(
    (acc, inv) => acc + inv.items.reduce((a, i) => a + i.quantity, 0),
    0
  );

  const sumCat = (cats: string[], type: 'in' | 'out') =>
    session.mutations.filter((m) => m.type === type && cats.includes(m.category)).reduce((a, m) => a + m.amount, 0);

  const listCat = (cats: string[], type: 'in' | 'out') =>
    session.mutations.filter((m) => m.type === type && cats.includes(m.category));

  const totals = getMutationTotals(session);
  const totalCashAkhir = session.status === 'Closed' ? session.closingActual ?? totals.systemTotal : totals.systemTotal;

  const kasMasukFields = [
    { key: 'cashAwal', label: 'Cash Awal', value: session.openingBalance, cats: [] as string[] },
    { key: 'cashTambahan', label: 'Cash Tambahan', value: sumCat(['Kas Tambahan'], 'in'), cats: ['Kas Tambahan'] },
    {
      key: 'penjualanTunai',
      label: 'Penjualan Tunai',
      value: sumCat(['Penjualan Tunai', 'Penjualan Tunai Lainnya'], 'in'),
      cats: ['Penjualan Tunai', 'Penjualan Tunai Lainnya'],
    },
    { key: 'pembayaranPiutang', label: 'Pembayaran Piutang', value: sumCat(['Pembayaran Piutang'], 'in'), cats: ['Pembayaran Piutang'] },
    { key: 'topupDeposit', label: 'Topup Deposit', value: sumCat(['Top Up Deposit'], 'in'), cats: ['Top Up Deposit'] },
    { key: 'returPembelian', label: 'Retur Pembelian', value: sumCat(['Retur Pembelian'], 'in'), cats: ['Retur Pembelian'] },
  ];

  const kasKeluarFields = [
    { key: 'kembalianTunai', label: 'Kembalian Tunai', value: sumCat(['Kembalian'], 'out'), cats: ['Kembalian'] },
    { key: 'transaksiDibatalkan', label: 'Transaksi Dibatalkan', value: sumCat(['Transaksi Dibatalkan'], 'out'), cats: ['Transaksi Dibatalkan'] },
    { key: 'returPenjualan', label: 'Retur Penjualan', value: sumCat(['Retur Penjualan'], 'out'), cats: ['Retur Penjualan'] },
    { key: 'pembayaranUtang', label: 'Pembayaran Utang', value: sumCat(['Pembayaran Hutang'], 'out'), cats: ['Pembayaran Hutang'] },
    { key: 'pembayaranLainnya', label: 'Pembayaran Lainnya', value: sumCat(['Pembayaran Lainnya'], 'out'), cats: ['Pembayaran Lainnya'] },
    { key: 'withdrawDeposit', label: 'Withdraw Deposit', value: sumCat(['Withdraw Deposit'], 'out'), cats: ['Withdraw Deposit'] },
    { key: 'pembelianStokLokasi', label: 'Pembelian Stok Lokasi SKU', value: sumCat(['Pembelian Stok Lokasi SKU'], 'out'), cats: ['Pembelian Stok Lokasi SKU'] },
    { key: 'pembelianStokPemasok', label: 'Pembelian Stok di Pemasok', value: sumCat(['Pembelian Stok Pemasok'], 'out'), cats: ['Pembelian Stok Pemasok'] },
  ];

  // Mutasi Penjualan Hari Ini — dikelompokkan per metode bayar. Semua metode
  // POS ditampilkan (Tunai/QRIS/Transfer/Deposit/Piutang/Bayar Sebagian),
  // tapi hanya Tunai (+ bagian tunai dari Bayar Sebagian) yang masuk kas laci.
  const invoicesBy = (method: string) => matchedInvoices.filter((i) => i.paymentMethod === method);
  const countBy = (method: string) => invoicesBy(method).length;
  const totalBy = (method: string) => invoicesBy(method).reduce((a, i) => a + i.total, 0);

  const splitInvoices = invoicesBy('Split');
  const splitPaid = splitInvoices.reduce((a, i) => a + (i.splitPaidAmount || 0), 0);
  const splitDebt = splitInvoices.reduce(
    (a, i) => a + (i.splitRemainingDebt ?? Math.max(0, i.total - (i.splitPaidAmount || 0))),
    0
  );

  const totalTunai = totalBy('Cash') + splitPaid;
  const totalQris = totalBy('QRIS');
  const totalTransfer = totalBy('Transfer');
  const totalDeposit = totalBy('Deposit');
  const totalPiutang = totalBy('Piutang') + splitDebt;
  const totalMutasiPenjualan = matchedInvoices.reduce((a, i) => a + i.total, 0);

  const mutasiRows: { label: string; value: number; masukKas: boolean }[] = [
    { label: 'Total Nominal Tunai', value: totalTunai, masukKas: true },
    { label: 'Total Nominal QRIS', value: totalQris, masukKas: false },
    { label: 'Total Nominal Transfer', value: totalTransfer, masukKas: false },
    { label: 'Total Nominal Deposit', value: totalDeposit, masukKas: false },
    { label: 'Total Nominal Piutang', value: totalPiutang, masukKas: false },
  ];
  const returCountBy = (method: 'Tunai' | 'Transfer') => matchedReturns.filter((r) => r.refundMethod === method).length;
  const returTotalBy = (method: 'Tunai' | 'Transfer') =>
    matchedReturns.filter((r) => r.refundMethod === method).reduce((a, r) => a + r.totalRefund, 0);

  const toggleDetail = (key: string) => setOpenDetail((prev) => (prev === key ? null : key));

  const FieldRow = ({ field, type }: { field: { key: string; label: string; value: number; cats: string[] }; type: 'in' | 'out' }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-muted-foreground font-bold uppercase">{field.label}</p>
        {field.cats.length > 0 && (
          <button
            type="button"
            onClick={() => toggleDetail(field.key)}
            className="text-[9px] font-bold text-primary hover:opacity-80 cursor-pointer flex items-center gap-0.5"
          >
            Lihat Detail <ChevronRight className={`w-3 h-3 transition-transform ${openDetail === field.key ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      <div className="bg-muted border border-border rounded-lg px-3 py-2.5 font-black text-foreground text-sm">{fmt(field.value)}</div>
      {openDetail === field.key && (
        <div className="mt-1.5 border border-border rounded-lg divide-y divide-border overflow-hidden">
          {listCat(field.cats, type).length === 0 ? (
            <p className="p-2.5 text-center text-[10px] text-muted-foreground">Tidak ada mutasi.</p>
          ) : (
            listCat(field.cats, type).map((m) => (
              <div key={m.id} className="flex justify-between p-2.5 text-[10px]">
                <span className="text-foreground/80 font-semibold">{m.note || m.category} <span className="text-muted-foreground">· {m.time}</span></span>
                <span className="font-bold text-foreground">{fmt(m.amount)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[88vh] flex flex-col">
        <DialogHeader className="px-5 py-4 mb-0 border-b border-border shrink-0">
          <DialogTitle className="text-sm text-foreground normal-case tracking-normal">Kas Harian</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Info Sesi */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Nama Kasir</p>
              <div className="bg-muted border border-border rounded-lg px-3 py-2.5 font-bold text-foreground">{session.cashierName || '-'}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Waktu Buka</p>
                <div className="bg-muted border border-border rounded-lg px-3 py-2.5 font-bold text-foreground">{session.date}, {session.openedAt}</div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Waktu Tutup</p>
                <div className="bg-muted border border-border rounded-lg px-3 py-2.5 font-bold text-foreground">{session.closedAt || 'Masih berjalan'}</div>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Jumlah Invoice</p>
              <div className="bg-muted border border-border rounded-lg px-3 py-2.5 font-bold text-foreground">{matchedInvoices.length}</div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Jumlah Item Terjual</p>
              <div className="bg-muted border border-border rounded-lg px-3 py-2.5 font-bold text-foreground">{jumlahItemTerjual}</div>
            </div>
          </div>

          {/* Kas Masuk */}
          <div>
            <h4 className="font-extrabold text-foreground text-xs uppercase tracking-wide border-b border-border pb-2 mb-3">Kas Masuk</h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {kasMasukFields.map((f) => <FieldRow key={f.key} field={f} type="in" />)}
            </div>
          </div>

          {/* Kas Keluar */}
          <div>
            <h4 className="font-extrabold text-foreground text-xs uppercase tracking-wide border-b border-border pb-2 mb-3">Kas Keluar</h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {kasKeluarFields.map((f) => <FieldRow key={f.key} field={f} type="out" />)}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Total Cash Akhir</p>
            <div className="bg-gray-900 text-white rounded-lg px-3 py-3 font-black text-base">{fmt(totalCashAkhir)}</div>
          </div>

          {/* Mutasi Penjualan Hari Ini */}
          <div>
            <h4 className="font-extrabold text-foreground text-xs uppercase tracking-wide border-b border-border pb-2 mb-3">Mutasi Penjualan Hari Ini</h4>
            <div className="space-y-2.5">
              {mutasiRows.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">{row.label}</p>
                    <span className={`text-[9px] font-bold ${row.masukKas ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {row.masukKas ? 'Masuk kas laci' : 'Tidak masuk kas laci'}
                    </span>
                  </div>
                  <div className="bg-muted border border-border rounded-lg px-3 py-2.5 font-black text-foreground">{fmt(row.value)}</div>
                </div>
              ))}
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Total Nominal Mutasi</p>
                <div className="bg-muted border border-border rounded-lg px-3 py-2.5 font-black text-foreground">{fmt(totalMutasiPenjualan)}</div>
              </div>
            </div>
          </div>

          {/* Transaksi dan Retur Penjualan */}
          <div>
            <h4 className="font-extrabold text-foreground text-xs uppercase tracking-wide border-b border-border pb-2 mb-3">Transaksi dan Retur Penjualan</h4>
            <div className="grid grid-cols-3 gap-x-3 gap-y-3 text-center">
              <p className="col-span-3 text-left text-[9px] text-muted-foreground font-bold uppercase -mb-1">Transaksi per Metode Bayar</p>
              {PAYMENT_METHODS.map((m) => (
                <div key={m.key} className="bg-muted border border-border rounded-lg px-2 py-2.5">
                  <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">{m.label}</p>
                  <p className="font-black text-foreground text-sm">{countBy(m.key)}x</p>
                  <p className="font-bold text-foreground/80 text-[10px] mt-0.5">{fmt(totalBy(m.key))}</p>
                  {m.key === 'Split' && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">Tunai {fmt(splitPaid)}</p>
                  )}
                  <p className={`text-[8px] font-bold uppercase mt-1 ${m.masukKas ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {m.key === 'Split' ? 'Sebagian masuk kas' : m.masukKas ? 'Masuk kas laci' : 'Tidak masuk kas'}
                  </p>
                </div>
              ))}
              <p className="col-span-3 text-left text-[9px] text-muted-foreground font-bold uppercase mt-2 -mb-1">Retur Penjualan</p>
              <div className="col-span-3 grid grid-cols-2 gap-3">
                {(['Tunai', 'Transfer'] as const).map((m) => (
                  <div key={m}>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Retur {m}</p>
                    <div className="bg-muted border border-border rounded-lg px-2 py-2 font-bold text-foreground/80 text-[10px]">
                      {returCountBy(m)}x &middot; {fmt(returTotalBy(m))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!windowStart && (
            <Badge variant="outline" className="w-full justify-center py-2 normal-case text-[10px] font-medium">
              Sesi ini dibuka sebelum fitur pencocokan waktu tersedia, sehingga rincian invoice/retur di atas belum bisa ditampilkan secara akurat.
            </Badge>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}