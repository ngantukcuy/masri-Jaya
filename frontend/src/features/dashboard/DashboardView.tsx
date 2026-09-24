import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag, 
  DollarSign, 
  FileText, 
  Activity as ActivityIcon, 
  Lightbulb, 
  CheckCircle2, 
  AlertTriangle,
  Forklift,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Activity, SalesInvoice, Customer, Expense, PO, ReturnRecord } from '../../types';
import { timeAgo } from '../../lib/timeAgo';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { buildDateBuckets, toDateInputValue } from '../../lib/dateBuckets';

function downloadSalesCSV(salesInvoices: SalesInvoice[]) {
  const escapeCSV = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = ['No. Invoice', 'Tanggal', 'Pelanggan', 'Metode Bayar', 'Item', 'Subtotal', 'Diskon', 'Biaya Tambahan', 'Total'];
  const rows = salesInvoices.map((invoice) => [
    invoice.invoiceNumber,
    invoice.createdAt || invoice.date,
    invoice.customerName,
    invoice.paymentMethod,
    invoice.items.map((item) => `${item.name} (${item.quantity} x ${item.price})`).join('; '),
    invoice.subtotal ?? invoice.total,
    invoice.discountAmount ?? 0,
    invoice.additionalFee ?? invoice.additionalFees?.reduce((sum, fee) => sum + fee.amount, 0) ?? 0,
    invoice.total,
  ]);
  const csv = [header, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `laporan-penjualan-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

interface DashboardViewProps {
  products: Product[];
  activities: Activity[];
  salesInvoices: SalesInvoice[];
  customers: Customer[];
  expenses?: Expense[];
  pos?: PO[];
  returns?: ReturnRecord[];
  totalSales: number;
  totalOrdersCount: number;
  onTabChange: (tab: string) => void;
  onQuickRestock: () => void;
}

export default function DashboardView({ 
  products, 
  activities, 
  salesInvoices,
  customers,
  expenses = [],
  pos = [],
  returns = [],
  totalSales, 
  totalOrdersCount, 
  onTabChange, 
  onQuickRestock 
}: DashboardViewProps) {
  const [previewKind, setPreviewKind] = useState<'income' | 'expense' | null>(null);
  const [chartDateFrom, setChartDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    d.setDate(1);
    return toDateInputValue(d);
  });
  const [chartDateTo, setChartDateTo] = useState(() => toDateInputValue(new Date()));
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [showIntelligenceReport, setShowIntelligenceReport] = useState(false);
  const [showDebtPreview, setShowDebtPreview] = useState(false);

  // Untung per invoice = (harga jual yang benar-benar dipakai di kasir − Harga
  // Modal) × qty untuk tiap item, lalu dikurangi diskon level invoice. Harga
  // jual bisa harga standar atau harga custom yang diketik kasir (item.price
  // sudah menyimpan harga akhir itu). Item bonus berharga 0, jadi otomatis
  // jadi minus sebesar modalnya. Fallback ke asumsi margin 35% hanya untuk
  // item yang Harga Modalnya belum diisi.
  const productCostBySku = new Map(products.map((p) => [p.sku, p.costPrice]));
  const fallbackMarginRate = 0.35;
  const estimateInvoiceProfit = (inv: SalesInvoice) => {
    const itemsProfit = inv.items.reduce((sum, item) => {
      const cost = productCostBySku.get(item.sku);
      const itemProfit = cost && cost > 0
        ? (item.price - cost) * item.quantity
        : item.price * item.quantity * fallbackMarginRate;
      return sum + itemProfit;
    }, 0);
    return itemsProfit - (inv.discountAmount || 0);
  };

  const sameDay = (isoA: string, dateB: Date) => new Date(isoA).toDateString() === dateB.toDateString();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const todayInvoices = salesInvoices.filter((inv) => inv.createdAt && sameDay(inv.createdAt, today));
  const yesterdayInvoices = salesInvoices.filter((inv) => inv.createdAt && sameDay(inv.createdAt, yesterday));

  const pctChange = (current: number, previous: number) => {
    if (previous > 0) return ((current - previous) / previous) * 100;
    return current > 0 ? 100 : 0;
  };

  // ---- Buku besar keuangan Dashboard ----
  // Satu sumber data untuk 3 kartu (Pendapatan, Pengeluaran, Untung) DAN grafik,
  // supaya angka kartu selalu sama dengan jumlah titik di grafik.
  //  Pendapatan  = penjualan (kecuali yang dibayar Deposit) + top up deposit
  //                − penarikan deposit − retur dari pelanggan + retur ke supplier
  //  Pengeluaran = pembayaran bon supplier (per cicilan) + pengeluaran lain yang
  //                sudah disetujui − retur ke supplier
  //  Untung      = untung penjualan − untung yang hilang karena retur pelanggan
  // Penjualan berdeposit tidak menambah pendapatan lagi karena uangnya sudah
  // dihitung saat top up deposit.
  const isPOPaidForRange = (po: PO) => !!po.paidAt || po.paymentMethod === 'Cash' || po.paymentMethod === 'Transfer';

  const parseReturnDate = (r: ReturnRecord): Date | null => {
    if (r.approvedAtISO) {
      const d = new Date(r.approvedAtISO);
      if (!isNaN(d.getTime())) return d;
    }
    const iso = new Date(r.createdAt);
    if (!isNaN(iso.getTime())) return iso;
    const months: Record<string, number> = { januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11 };
    const m = r.createdAt.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:,?\s+(\d{1,2})[.:](\d{2}))?/);
    if (!m || months[m[2].toLowerCase()] === undefined) return null;
    return new Date(Number(m[3]), months[m[2].toLowerCase()], Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
  };

  type LedgerKind = 'income' | 'expense' | 'profit';
  interface LedgerEvent { kind: LedgerKind; source: string; label: string; date: Date; amount: number }

  const ledger = useMemo(() => {
    const events: LedgerEvent[] = [];
    const add = (kind: LedgerKind, source: string, label: string, dateLike: string | Date | null | undefined, amount: number) => {
      if (!dateLike || !amount) return;
      const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
      if (isNaN(date.getTime())) return;
      events.push({ kind, source, label, date, amount });
    };

    // Penjualan
    const invoiceByNumber = new Map(salesInvoices.map((inv) => [inv.invoiceNumber, inv]));
    salesInvoices.forEach((inv) => {
      if (!inv.createdAt) return;
      const label = `${inv.invoiceNumber} · ${inv.customerName || '-'}`;
      if (inv.paymentMethod !== 'Deposit') add('income', 'Penjualan', label, inv.createdAt, inv.total);
      add('profit', 'Penjualan', label, inv.createdAt, estimateInvoiceProfit(inv));
    });

    // Deposit pelanggan
    customers.forEach((c) => {
      (c.depositHistory || []).forEach((t) => {
        add('income', t.type === 'topup' ? 'Top Up Deposit' : 'Penarikan Deposit', `${c.name} · ${t.method}`, t.date, t.type === 'topup' ? t.amount : -t.amount);
      });
    });

    // Pembayaran bon supplier: tiap pembayaran/cicilan dihitung pada tanggalnya sendiri.
    const paidByPO = new Map<string, number>();
    pos.forEach((po) => {
      const payments = po.paymentHistory && po.paymentHistory.length > 0
        ? po.paymentHistory.map((p) => ({ date: p.date, amount: p.amount }))
        : (po.paidHistory || []).map((p) => ({ date: p.date, amount: p.amount }));
      const label = `${po.supplier} · ${po.poNumber}`;
      if (payments.length > 0) {
        payments.forEach((p) => add('expense', 'Bayar Bon Supplier', label, p.date, p.amount));
        paidByPO.set(po.poNumber, payments.reduce((s, p) => s + p.amount, 0));
      } else if (isPOPaidForRange(po) || (po.paidAmount && po.paidAmount > 0)) {
        // Bon Cash/Transfer (lunas saat diterima) atau data lama tanpa riwayat.
        const paid = po.paidAmount && po.paidAmount > 0 ? po.paidAmount : po.total;
        add('expense', 'Bayar Bon Supplier', label, po.paidAt || po.receivedAt || po.createdDate, paid);
        paidByPO.set(po.poNumber, paid);
      }
    });

    // Pengeluaran lain (hanya yang sudah disetujui Owner)
    expenses.forEach((e) => {
      if (e.status === 'Approved') add('expense', 'Pengeluaran Lainnya', e.description, e.date, e.amount);
    });

    // Retur yang sudah disetujui, diproses urut tanggal
    const approvedReturns = returns
      .filter((r) => r.status === 'Approved')
      .map((r) => ({ r, date: parseReturnDate(r) }))
      .filter((x): x is { r: ReturnRecord; date: Date } => !!x.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const refundedByPO = new Map<string, number>();
    approvedReturns.forEach(({ r, date }) => {
      const label = `${r.refNumber} · ${r.partyName}`;
      if (r.type === 'Penjualan') {
        // Retur dari pelanggan: pendapatan berkurang, pengeluaran TIDAK bertambah.
        // Kalau invoice aslinya dibayar Deposit, pendapatannya memang tidak pernah dihitung.
        if (invoiceByNumber.get(r.refNumber)?.paymentMethod !== 'Deposit') {
          add('income', 'Retur dari Pelanggan', label, date, -r.totalRefund);
        }
        const itemsProfit = r.items.reduce((sum, item) => {
          const cost = productCostBySku.get(item.sku);
          const unitMargin = cost && cost > 0 ? item.price - cost : item.price * fallbackMarginRate;
          // Barang baik kembali ke stok (hilang untungnya saja); barang rusak hilang total.
          return sum - (item.condition === 'Rusak' ? item.price * item.quantity : unitMargin * item.quantity);
        }, 0);
        add('profit', 'Retur dari Pelanggan', label, date, itemsProfit + (r.discount || 0));
      } else {
        // Retur ke supplier: hanya sebesar yang sudah dibayar di bon tsb.
        // Pendapatan bertambah, pengeluaran berkurang sebesar nilai itu.
        const paid = paidByPO.get(r.refNumber) || 0;
        const already = refundedByPO.get(r.refNumber) || 0;
        const refundable = Math.max(0, Math.min(r.totalRefund, paid - already));
        if (refundable > 0) {
          refundedByPO.set(r.refNumber, already + refundable);
          add('income', 'Retur ke Supplier', label, date, refundable);
          add('expense', 'Retur ke Supplier', label, date, -refundable);
        }
      }
    });

    return events;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesInvoices, customers, pos, expenses, returns, products]);

  // Grafik memakai bucket rentang tanggal (harian/mingguan/bulanan). Kartu = jumlah bucket.
  const buckets = useMemo(() => buildDateBuckets(chartDateFrom, chartDateTo), [chartDateFrom, chartDateTo]);
  const monthlyData = useMemo(() => buckets.map((b) => {
    const inBucket = ledger.filter((e) => e.date >= b.start && e.date < b.endExclusive);
    const sumKind = (kind: LedgerKind) => inBucket.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0);
    return { name: b.label, start: b.start, income: sumKind('income'), expense: sumKind('expense'), profit: sumKind('profit') };
  }), [buckets, ledger]);

  const coverStart = buckets[0]?.start;
  const coverEnd = buckets[buckets.length - 1]?.endExclusive;
  const rangeEvents = useMemo(
    () => (coverStart && coverEnd ? ledger.filter((e) => e.date >= coverStart && e.date < coverEnd) : []),
    [ledger, coverStart, coverEnd]
  );

  // KPI "hari ini" dihitung dari transaksi POS sungguhan, dibandingkan kemarin.
  const liveTodaySales = todayInvoices.reduce((s, inv) => s + inv.total, 0);
  const yesterdaySales = yesterdayInvoices.reduce((s, inv) => s + inv.total, 0);
  const salesChangePct = pctChange(liveTodaySales, yesterdaySales);

  const liveNetProfit = todayInvoices.reduce((s, inv) => s + estimateInvoiceProfit(inv), 0);

  // Piutang jatuh tempo dihitung dari data pelanggan sungguhan (bukan angka tetap).
  const overdueCustomers = customers.filter((c) => c.debtStatus === 'Overdue');
  const totalOverdueAmount = overdueCustomers.reduce(
    (s, c) => s + (c.overdueAmount ?? c.currentDebt ?? 0),
    0
  );

  // ---- KPI 4 kotak dashboard, mengikuti filter tanggal (chartDateFrom/chartDateTo) ----
  const sumRange = (kind: LedgerKind) => rangeEvents.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0);
  const rangeTotalRevenue = sumRange('income');
  const rangeTotalPengeluaran = sumRange('expense');
  const rangeNetProfit = sumRange('profit');
  const rangeMarginPct = rangeTotalRevenue > 0 ? (rangeNetProfit / rangeTotalRevenue) * 100 : 0;
  const rangeSaleCount = rangeEvents.filter((e) => e.kind === 'income' && e.source === 'Penjualan').length;
  const rangeTopUpCount = rangeEvents.filter((e) => e.kind === 'income' && e.source === 'Top Up Deposit').length;

  // Kotak 4 "Tagihan Hutang & Piutang" = gabungan piutang dari customer
  // (jatuh tempo/belum lunas) dan hutang ke supplier (bon belum lunas).
  // Ini status LIVE hari ini (bukan per-rentang-tanggal) karena "jatuh
  // tempo" itu relatif ke sekarang, bukan ke rentang grafik yang dipilih.
  const allPendingCustomers = customers.filter((c) => (c.currentDebt || 0) > 0);
  const totalPiutangAmount = allPendingCustomers.reduce((s, c) => s + (c.currentDebt || 0), 0);
  const unpaidSupplierBons = pos.filter((po) => !isPOPaidForRange(po) && (po.status === 'Received' || po.status === 'In Transit' || po.receivedAt));
  const totalHutangAmount = unpaidSupplierBons.reduce((s, po) => s + Math.max(0, po.total - (po.paidAmount || 0)), 0);
  const totalHutangPiutang = totalPiutangAmount + totalHutangAmount;

  const handleExportReport = () => downloadSalesCSV(salesInvoices);

  // Peringatan stok kritis: produk asli dengan status Low/Out of Stock (bukan contoh statis).
  const criticalStockProducts = [...products]
    .filter((p) => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock')
    .sort((a, b) => a.stock - b.stock);
  const mostCriticalProduct = criticalStockProducts[0];

  // Kontribusi penjualan per kategori: item invoice sungguhan di-join ke
  // kategori produknya (bukan tiga baris persentase tetap 65/22/13%).
  const categoryBySku = new Map(products.map((p) => [p.sku, p.category]));
  const categoryRevenue = new Map<string, number>();
  salesInvoices.forEach((inv) => {
    inv.items.forEach((item) => {
      const cat = categoryBySku.get(item.sku) || 'Lainnya';
      categoryRevenue.set(cat, (categoryRevenue.get(cat) || 0) + item.price * item.quantity);
    });
  });
  const totalCategoryRevenue = Array.from(categoryRevenue.values()).reduce((s, v) => s + v, 0);
  const topCategories = Array.from(categoryRevenue.entries())
    .map(([name, revenue]) => ({
      name,
      percent: totalCategoryRevenue > 0 ? Math.round((revenue / totalCategoryRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);
  const categoryBarColors = ['bg-blue-600', 'bg-sky-400', 'bg-slate-400'];

  // Render bento KPI card helper with glassmorphic style
  const renderKpiCard = (
    title: string, 
    value: string, 
    trend: string, 
    trendType: 'up' | 'down' | 'neutral', 
    icon: React.ReactNode, 
    bgColor: string, 
    iconColor: string,
    onClick?: () => void
  ) => {
    return (
      <motion.div 
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        onClick={onClick}
        className={`glass-card glass-card-hover p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{title}</span>
          <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
        </div>
        <div className="mt-2 z-10">
          <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{value}</h3>
          <p className="mt-0.5 text-[10px] flex items-center font-bold">
            {trendType === 'up' && <TrendingUp className="w-3 h-3 text-emerald-500 mr-1 shrink-0" />}
            {trendType === 'down' && <TrendingDown className="w-3 h-3 text-red-500 mr-1 shrink-0" />}
            <span className={trendType === 'up' ? 'text-emerald-500' : trendType === 'down' ? 'text-red-500' : 'text-slate-500'}>
              {trend}
            </span>
          </p>
        </div>
      </motion.div>
    );
  };

  // SVG Line Chart — ketiga garis (pendapatan, pengeluaran, untung) digambar sekaligus
  // dengan satu skala bersama supaya bisa dibandingkan langsung.
  const chartSeries = [
    { key: 'income' as const, label: 'Pendapatan', stroke: '#2563EB' },
    { key: 'expense' as const, label: 'Pengeluaran', stroke: '#EF4444' },
    { key: 'profit' as const, label: 'Untung Bersih', stroke: '#10B981' },
  ];
  const allChartValues = monthlyData.flatMap((d) => [d.income, d.expense, d.profit]);
  const maxVal = Math.max(1, ...allChartValues) * 1.15;
  // Nilai bisa negatif (mis. retur lebih besar dari penjualan di satu periode), jadi garis nol dihitung.
  const minVal = Math.min(0, ...allChartValues) * 1.15;
  const valueRange = Math.max(1, maxVal - minVal);
  const yOf = (val: number) => 170 - ((val - minVal) / valueRange) * 130;
  const y0 = yOf(0);
  const xOf = (i: number) => 30 + i * (610 / Math.max(monthlyData.length - 1, 1));
  const seriesPaths = chartSeries.map((sr) => ({
    ...sr,
    points: monthlyData.map((d, i) => ({ x: xOf(i), y: yOf(d[sr.key]) })),
  }));

  return (
    <div className="space-y-6">
      
      {/* Upper Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 position-center ">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
          <Label className="text-[9px]">Dari Tanggal</Label>
                <Input
                  type="date"
                  value={chartDateFrom}
                  max={chartDateTo}
                  onChange={(e) => setChartDateFrom(e.target.value)}
                  className="h-8 text-[11px] w-auto"
                />
                </div>
                <div className="flex flex-col gap-1">
                <Label className="text-[9px]">Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={chartDateTo}
                  min={chartDateFrom}
                  max={toDateInputValue(new Date())}
                  onChange={(e) => setChartDateTo(e.target.value)}
                  className="h-8 text-[11px] w-auto"
                />
                </div>
                <p className="text-[9px] text-slate-400 self-end pb-1 hidden md:block max-w-[160px] leading-snug">Filter ini berlaku untuk kotak pendapatan/pengeluaran/untung &amp; grafik di bawah.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={handleExportReport}
            size="lg"
            className="w-full sm:w-auto shadow-md shadow-blue-500/15 active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Laporan CSV</span>
          </Button>
        </div>
      </div>

      {/* Bento Grid 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {renderKpiCard(
          "Pendapatan Keseluruhan",
          `Rp ${rangeTotalRevenue.toLocaleString('id-ID')}`,
          `${rangeSaleCount} transaksi${rangeTopUpCount > 0 ? ` · ${rangeTopUpCount} top up deposit` : ''} — klik untuk rincian`,
          "neutral",
          <DollarSign className="w-4.5 h-4.5" />,
          "bg-emerald-500/10",
          "text-emerald-600",
          () => setPreviewKind('income')
        )}
        {renderKpiCard(
          "Total Pengeluaran",
          `Rp ${rangeTotalPengeluaran.toLocaleString('id-ID')}`,
          "Bon supplier + pengeluaran lain — klik untuk rincian",
          "neutral",
          <TrendingDown className="w-4.5 h-4.5" />,
          "bg-red-500/10",
          "text-red-600",
          () => setPreviewKind('expense')
        )}
        {renderKpiCard(
          "Estimasi Untung Bersih",
          `Rp ${rangeNetProfit.toLocaleString('id-ID')}`,
          `${rangeMarginPct >= 0 ? '+' : ''}${rangeMarginPct.toFixed(1)}% margin dari pendapatan`,
          rangeNetProfit >= 0 ? "up" : "down",
          <TrendingUp className="w-4.5 h-4.5" />,
          "bg-blue-500/10",
          "text-blue-600"
        )}
        {renderKpiCard(
          "Tagihan Hutang & Piutang",
          `Rp ${totalHutangPiutang.toLocaleString('id-ID')}`,
          `${allPendingCustomers.length} piutang · ${unpaidSupplierBons.length} bon — klik untuk detail`,
          totalHutangPiutang > 0 ? "down" : "neutral",
          <FileText className="w-4.5 h-4.5" />,
          "bg-amber-500/10",
          "text-amber-600",
          () => setShowDebtPreview(true)
        )}
      </div>

      {/* Middle Grid: Main charts + AI Insight Section - Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sales Chart Panel (Stripe-style Glass Card) */}
        <div className="glass-card lg:col-span-8 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex flex-col gap-3 pb-4 border-b border-slate-100/60">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h4 className="text-sm font-black text-slate-800 tracking-tight">Tren Keuangan</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Pendapatan, pengeluaran, dan untung bersih — angkanya sama dengan 3 kartu di atas</p>
              </div>

              {/* Legenda 3 garis */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 self-start sm:self-auto">
                {chartSeries.map((sr) => (
                  <span key={sr.key} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span className="w-3 h-1 rounded-full" style={{ backgroundColor: sr.stroke }} />
                    {sr.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* SVG Line Canvas (Highly Responsive) */}
          <div className="relative w-full h-48 mt-4 overflow-x-auto overflow-y-hidden">
            <div className="min-w-[640px] h-full">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 680 180" preserveAspectRatio="none">
                {/* Reference Grid lines */}
                <line x1="30" y1="40" x2="640" y2="40" stroke="#E2E8F0" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="30" y1="105" x2="640" y2="105" stroke="#E2E8F0" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="30" y1="170" x2="640" y2="170" stroke="#E2E8F0" strokeOpacity="0.8" strokeWidth="1" />
                {minVal < 0 && <line x1="30" y1={y0} x2="640" y2={y0} stroke="#94A3B8" strokeOpacity="0.7" strokeWidth="1" strokeDasharray="4,3" />}

                {/* Kolom sorotan saat hover */}
                {hoveredMonth !== null && monthlyData[hoveredMonth] && (
                  <rect x={xOf(hoveredMonth) - 12} y="10" width="24" height="160" rx="4" fill="#94A3B8" opacity="0.12" />
                )}

                {/* Tiga garis sekaligus */}
                {seriesPaths.map((sr) => (
                  <motion.path
                    key={sr.key}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    d={`M ${sr.points.map((pt) => `${pt.x} ${pt.y}`).join(' L ')}`}
                    fill="none"
                    stroke={sr.stroke}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {/* Titik tiap periode + area hover */}
                {monthlyData.map((_, i) => {
                  const isHovered = hoveredMonth === i;
                  return (
                    <g key={i}>
                      {seriesPaths.map((sr) => (
                        <circle
                          key={sr.key}
                          cx={sr.points[i].x}
                          cy={sr.points[i].y}
                          r={isHovered ? 5 : 3}
                          fill={sr.stroke}
                          stroke="white"
                          strokeWidth={isHovered ? 2 : 1}
                          className="transition-all"
                        />
                      ))}
                      <rect
                        x={xOf(i) - 25}
                        y="10"
                        width="50"
                        height="170"
                        fill="transparent"
                        onMouseEnter={() => setHoveredMonth(i)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        className="cursor-pointer"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Float Tooltip */}
              <AnimatePresence>
                {hoveredMonth !== null && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ 
                      left: `${(hoveredMonth / Math.max(monthlyData.length - 1, 1)) * 80 + 3}%`,
                      top: '20px'
                    }}
                    className="absolute bg-slate-900 text-white rounded-xl p-3 shadow-xl z-20 pointer-events-none text-[10px] w-44 border border-slate-800"
                  >
                    <p className="font-extrabold mb-1 tracking-wider text-slate-400">{monthlyData[hoveredMonth].name}</p>
                    <div className="flex justify-between items-center gap-2 mt-1">
                      <span className="text-blue-300">Pendapatan:</span>
                      <span className="font-bold text-white">Rp {monthlyData[hoveredMonth].income.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-1 border-t border-slate-800 pt-1">
                      <span className="text-red-300">Pengeluaran:</span>
                      <span className="font-bold text-red-200">Rp {monthlyData[hoveredMonth].expense.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-1 border-t border-slate-800 pt-1">
                      <span className="text-emerald-400">Untung:</span>
                      <span className="font-bold text-emerald-300">Rp {monthlyData[hoveredMonth].profit.toLocaleString('id-ID')}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex justify-between mt-3 text-slate-400 text-[9px] font-bold tracking-wider px-4">
            {(() => {
              const labelStep = Math.ceil(monthlyData.length / 12);
              return monthlyData.map((d, i) => (
                <span key={`${d.name}-${d.start.toISOString()}`}>{i % labelStep === 0 ? d.name : ''}</span>
              ));
            })()}
          </div>
        </div>

        {/* AI Insight Column Panel - Bento Piece */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* AI Insights Card (Glossy Futuristic Dark Card) */}
          <div className="bg-zinc-900/95 text-white border border-zinc-800/80 p-5 relative overflow-hidden rounded-2xl shadow-xl flex flex-col justify-between h-full min-h-[300px]">
            {/* Design Watermark */}
            <div className="absolute top-4 right-4 text-[20px] font-black italic uppercase text-white/5 select-none pointer-events-none">AETHER/01</div>
            
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-[#052c16] border border-emerald-500/20 p-1.5 rounded-lg">
                    <Lightbulb className="w-4 h-4 text-emerald-400 fill-emerald-400/15" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Analisis AI</h4>
                </div>

                {/* Tech Coordinates Accent */}
                <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-2 text-[9px] font-mono text-slate-500">
                  <span>SYSTEM ACTIVE • LIVE DATA</span>
                  <span className="text-emerald-400">{products.length} SKU dipantau</span>
                </div>

                <div className="space-y-3">
                  <div className="bg-black/35 p-2.5 border border-slate-800/80 rounded-xl">
                    <div className="flex gap-2">
                      {salesChangePct >= 0
                        ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />}
                      <p className="text-[11px] text-slate-300 uppercase tracking-wide leading-normal">
                        Pendapatan hari ini {salesChangePct >= 0 ? 'naik' : 'turun'} <span className={`font-bold ${salesChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.abs(salesChangePct).toFixed(1)}%</span> dibanding kemarin, dari {todayInvoices.length} transaksi kasir.
                      </p>
                    </div>
                  </div>

                  <div className="bg-black/35 p-2.5 border border-slate-800/80 rounded-xl">
                    <div className="flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-300 uppercase tracking-wide leading-normal">
                        {mostCriticalProduct
                          ? <><span className="font-bold text-red-400">Stok Kritis:</span> {mostCriticalProduct.name} tersisa {mostCriticalProduct.stock} {mostCriticalProduct.unit}.</>
                          : <>Belum ada produk dengan stok kritis saat ini.</>}
                      </p>
                    </div>
                  </div>

                  <div className="bg-black/35 p-2.5 border border-slate-800/80 rounded-xl">
                    <div className="flex gap-2 items-center justify-between w-full">
                      <div className="flex gap-1.5 items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <p className="text-[10px] text-white uppercase tracking-wider font-extrabold">
                          {criticalStockProducts.length > 0 ? `${criticalStockProducts.length} Produk Stok Rendah` : 'Stok Rendah'}
                        </p>
                      </div>
                      <Button
                        onClick={onQuickRestock}
                        size="sm"
                        className="text-[9px] h-auto bg-emerald-400 hover:bg-emerald-500 text-slate-950 tracking-widest px-2.5 py-1.5 rounded-lg active:scale-95"
                      >
                        Restock Cepat
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setShowIntelligenceReport(true)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 uppercase tracking-widest active:scale-[0.98]"
              >
                Lihat Laporan Prediksi AI
              </Button>
            </div>
          </div>

          {/* Revenue by Category (Small Card) - Bento Piece */}
          <div className="glass-card p-5 rounded-2xl flex-1 flex flex-col justify-between">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Penjualan Kategori</h4>
            {topCategories.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Belum ada data penjualan untuk dihitung.</p>
            ) : (
              <div className="space-y-3">
                {topCategories.map((cat, idx) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span className="truncate pr-2">{cat.name}</span>
                      <span className="shrink-0">{cat.percent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${categoryBarColors[idx]} rounded-full`} style={{ width: `${cat.percent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity & Top Products Section - Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Activity List */}
        <div className="glass-card lg:col-span-7 rounded-2xl overflow-hidden flex flex-col justify-between">
          <div className="p-5 border-b border-slate-100/60 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-blue-600" /> Log Riwayat Aktivitas
            </h4>
            <Button variant="link" onClick={() => onTabChange('finance')} className="h-auto p-0 text-xs">
              Lihat Log Jurnal
            </Button>
          </div>
          <div className="divide-y divide-slate-100/60 max-h-80 overflow-y-auto">
            {activities.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs uppercase font-bold">Belum ada aktivitas baru</div>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="p-4 hover:bg-slate-50/40 transition-colors flex items-center gap-3 md:gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    act.type === 'sale' ? 'bg-emerald-500/10 text-emerald-600' :
                    act.type === 'arrival' ? 'bg-blue-500/10 text-blue-600' :
                    act.type === 'overdue' ? 'bg-red-500/10 text-red-600' :
                    'bg-amber-500/10 text-amber-600'
                  }`}>
                    {act.type === 'sale' && <ShoppingBag className="w-4 h-4" />}
                    {act.type === 'arrival' && <Forklift className="w-4 h-4" />}
                    {act.type === 'overdue' && <AlertTriangle className="w-4 h-4" />}
                    {act.type === 'quote' && <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{act.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{act.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {act.amount > 0 && (
                      <p className={`text-xs font-black ${act.type === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {act.type === 'overdue' ? '-' : '+'}Rp {act.amount.toLocaleString('id-ID')}
                      </p>
                    )}
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{timeAgo(act.createdAt, act.time)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Performing Products */}
        <div className="glass-card lg:col-span-5 rounded-2xl overflow-hidden flex flex-col justify-between">
          <div className="p-5 border-b border-slate-100/60 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-800">Bahan Bangunan Paling Laris</h4>
            <span className="text-[10px] bg-blue-100/80 text-blue-800 font-bold px-2 py-0.5 rounded-lg">Minggu Ini</span>
          </div>
          <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
            {products.slice(0, 4).map((prod, index) => (
              <div key={prod.sku} className="flex items-center gap-4 group">
                <div className="relative shrink-0">
                  <img 
                    src={prod.image} 
                    alt={prod.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-100 group-hover:scale-105 transition-transform duration-350"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-blue-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-xs text-slate-800 truncate group-hover:text-blue-600 transition-colors">{prod.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-wider ${
                      prod.stockStatus === 'Healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {prod.stockStatus === 'Healthy' ? 'STOK AMAN' : 'STOK RENDAH'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold">Tersedia {prod.stock} {prod.unit}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-xs text-slate-900">Rp {prod.retailPrice.toLocaleString('id-ID')}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">per {prod.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview gabungan Hutang (ke Supplier) & Piutang (dari Customer) — dibuka dari kotak KPI ke-4 */}
      {/* Preview rincian Pendapatan / Pengeluaran — isinya persis sumber angka kartu & grafik */}
      <Dialog open={previewKind !== null} onOpenChange={(open) => { if (!open) setPreviewKind(null); }}>
        <DialogContent className="max-w-lg">
          {previewKind && (() => {
            const items = rangeEvents
              .filter((e) => e.kind === previewKind)
              .sort((a, b) => b.date.getTime() - a.date.getTime());
            const total = items.reduce((s, e) => s + e.amount, 0);
            const bySource = new Map<string, { count: number; sum: number }>();
            items.forEach((e) => {
              const cur = bySource.get(e.source) || { count: 0, sum: 0 };
              bySource.set(e.source, { count: cur.count + 1, sum: cur.sum + e.amount });
            });
            const fmt = (n: number) => `${n < 0 ? '-' : ''}Rp ${Math.abs(n).toLocaleString('id-ID')}`;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-sm normal-case tracking-normal">
                    Rincian {previewKind === 'income' ? 'Pendapatan' : 'Pengeluaran'}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total pada periode terpilih</span>
                  <span className={`text-base font-black ${previewKind === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(total)}</span>
                </div>

                <div className="space-y-1.5">
                  {Array.from(bySource.entries()).map(([source, v]) => (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-semibold">{source} <span className="text-slate-400 font-normal">({v.count})</span></span>
                      <span className={`font-black ${v.sum < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmt(v.sum)}</span>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-center text-xs text-slate-400 py-4">Belum ada data pada periode ini.</p>}
                </div>

                {items.length > 0 && (
                  <div className="border-t border-slate-100 pt-2 max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {items.slice(0, 200).map((e, i) => (
                      <div key={`${e.source}-${e.label}-${i}`} className="flex items-start justify-between gap-3 py-2 text-[11px]">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-700 truncate">{e.label}</p>
                          <p className="text-[9px] text-slate-400">{e.source} · {e.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className={`font-black shrink-0 ${e.amount < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[9px] text-slate-400 leading-snug">
                  {previewKind === 'income'
                    ? 'Penjualan yang dibayar Deposit tidak dihitung lagi karena sudah masuk saat top up. Retur pelanggan mengurangi pendapatan; retur ke supplier menambah sebesar yang sudah dibayar di bonnya.'
                    : 'Retur ke supplier mengurangi pengeluaran sebesar yang sudah dibayar di bonnya. Retur dari pelanggan tidak menambah pengeluaran.'}
                </p>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showDebtPreview} onOpenChange={setShowDebtPreview}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm normal-case tracking-widest flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" /> Rincian Tagihan Hutang &amp; Piutang
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
            {/* Section 1: Bon Supplier Belum Lunas */}
            <div className="bg-red-50/70 border border-red-150 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-extrabold text-red-800 uppercase text-[10px] tracking-wider">Hutang ke Supplier (Bon Belum Lunas)</p>
                <span className="text-base font-black text-red-700">Rp {totalHutangAmount.toLocaleString('id-ID')}</span>
              </div>
              
              {unpaidSupplierBons.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">Tidak ada bon supplier yang belum lunas saat ini.</p>
              ) : (
                <div className="overflow-x-auto bg-white rounded-lg border border-red-100 mt-2">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-red-100/50 text-red-900 font-bold text-[9px] uppercase">
                      <tr>
                        <th className="py-2 px-3">Supplier</th>
                        <th className="py-2 px-3">No. PO</th>
                        <th className="py-2 px-3 text-right">Sisa Bon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50 font-medium">
                      {unpaidSupplierBons.slice(0, 5).map((po) => {
                        const sisa = Math.max(0, po.total - (po.paidAmount || 0));
                        return (
                          <tr key={po.poNumber}>
                            <td className="py-2 px-3 font-semibold text-slate-800">{po.supplier}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{po.poNumber}</td>
                            <td className="py-2 px-3 text-right font-bold text-red-600">Rp {sisa.toLocaleString('id-ID')}</td>
                          </tr>
                        );
                      })}
                      {unpaidSupplierBons.length > 5 && (
                        <tr>
                          <td colSpan={3} className="py-1.5 px-3 text-center text-[10px] text-slate-400 font-bold">
                            + {unpaidSupplierBons.length - 5} bon supplier lainnya
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div className="pt-1 text-right">
                <Button variant="link" className="h-auto p-0 text-[11px] text-red-700 font-bold" onClick={() => { setShowDebtPreview(false); onTabChange('finance'); }}>
                  Bayar di Pembayaran &gt; Supplier →
                </Button>
              </div>
            </div>

            {/* Section 2: Piutang Customer Aktif */}
            <div className="bg-amber-50/70 border border-amber-150 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-extrabold text-amber-800 uppercase text-[10px] tracking-wider">Piutang dari Customer (Belum Lunas)</p>
                <span className="text-base font-black text-amber-700">Rp {totalPiutangAmount.toLocaleString('id-ID')}</span>
              </div>
              
              {allPendingCustomers.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">Tidak ada piutang customer aktif saat ini.</p>
              ) : (
                <div className="overflow-x-auto bg-white rounded-lg border border-amber-100 mt-2">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-amber-100/50 text-amber-900 font-bold text-[9px] uppercase">
                      <tr>
                        <th className="py-2 px-3">Nama Customer</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Sisa Hutang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-50 font-medium">
                      {allPendingCustomers.slice(0, 5).map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{c.name}</td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              c.debtStatus === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {c.debtStatus === 'Overdue' ? 'Jatuh Tempo' : 'Aktif'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-amber-700">Rp {(c.currentDebt || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                      {allPendingCustomers.length > 5 && (
                        <tr>
                          <td colSpan={3} className="py-1.5 px-3 text-center text-[10px] text-slate-400 font-bold">
                            + {allPendingCustomers.length - 5} customer lainnya
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div className="pt-1 text-right">
                <Button variant="link" className="h-auto p-0 text-[11px] text-amber-700 font-bold" onClick={() => { setShowDebtPreview(false); onTabChange('debts'); }}>
                  Tagih di Utang &amp; Piutang →
                </Button>
              </div>
            </div>

            {/* Total Ringkasan Gabungan */}
            <div className="flex justify-between items-center border-t border-slate-200 pt-3 font-black text-slate-900 bg-slate-50 p-3 rounded-xl">
              <span className="uppercase text-[10px] tracking-wider text-slate-500">Total Gabungan Hutang &amp; Piutang</span>
              <span className="text-lg">Rp {totalHutangPiutang.toLocaleString('id-ID')}</span>
            </div>
          </div>
          <DialogFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => setShowDebtPreview(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Intelligence Report Modal */}
      <Dialog open={showIntelligenceReport} onOpenChange={setShowIntelligenceReport}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm normal-case tracking-widest">
              <Lightbulb className="w-5 h-5" /> Laporan Kecerdasan Prediktif AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs text-slate-600 max-h-96 overflow-y-auto pr-1 leading-relaxed">
            <p className="font-bold text-slate-800">Ringkasan Performa:</p>
            <p>
              Pendapatan hari ini {salesChangePct >= 0 ? 'naik' : 'turun'} {Math.abs(salesChangePct).toFixed(1)}% dibanding kemarin, dari {todayInvoices.length} transaksi kasir senilai Rp {liveTodaySales.toLocaleString('id-ID')}. Estimasi untung bersih hari ini sekitar Rp {liveNetProfit.toLocaleString('id-ID')}.
            </p>
            {mostCriticalProduct && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 space-y-2">
                <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> Peringatan Kritis Stok Rendah</p>
                <p>
                  {mostCriticalProduct.name} tersisa {mostCriticalProduct.stock} {mostCriticalProduct.unit}
                  {criticalStockProducts.length > 1 ? `, dan ${criticalStockProducts.length - 1} produk lain juga berstatus stok rendah/habis.` : '.'}
                </p>
              </div>
            )}
            <p className="font-bold text-slate-800">Rekomendasi Tindakan:</p>
            <ul className="list-disc pl-5 space-y-2">
              {mostCriticalProduct && (
                <li>Segera buat PO (Purchase Order) untuk <span className="font-bold">{mostCriticalProduct.name}</span> sebelum stok benar-benar habis.</li>
              )}
              {overdueCustomers.length > 0 ? (
                <li>
                  Tindak lanjuti {overdueCustomers.length} pelanggan dengan tagihan jatuh tempo, total senilai{' '}
                  <span className="font-bold text-red-600">Rp {totalOverdueAmount.toLocaleString('id-ID')}</span> guna memperlancar arus kas.
                </li>
              ) : (
                <li>Tidak ada piutang jatuh tempo saat ini — arus kas dari penjualan kredit dalam kondisi aman.</li>
              )}
              {!mostCriticalProduct && overdueCustomers.length === 0 && (
                <li>Belum ada data transaksi yang cukup untuk rekomendasi tambahan. Rekomendasi akan muncul seiring bertambahnya data penjualan.</li>
              )}
            </ul>
          </div>
          <DialogFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => setShowIntelligenceReport(false)}>
              Tutup Laporan
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowIntelligenceReport(false);
                onQuickRestock();
              }}
              className="shadow-md shadow-blue-500/10"
            >
              Eksekusi Restock Cepat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}