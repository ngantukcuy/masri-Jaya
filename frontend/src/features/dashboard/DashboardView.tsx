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
  Download,
  CreditCard,
  ArrowRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Activity, SalesInvoice, Customer, Expense, PO } from '../../types';
import { timeAgo } from '../../lib/timeAgo';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
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
  expenses: Expense[];
  pos: PO[];
  totalSales: number;
  totalOrdersCount: number;
  onTabChange: (tab: string) => void;
  onQuickRestock: () => void;
}

/** Cek apakah tanggal ISO string masuk dalam rentang [fromDate, toDate] */
function inRange(isoStr: string | undefined, fromDate: Date, toDate: Date): boolean {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return false;
  // toDate diset sampai akhir hari
  const endOfDay = new Date(toDate);
  endOfDay.setHours(23, 59, 59, 999);
  return d >= fromDate && d <= endOfDay;
}

const isPOPaid = (po: PO): boolean => {
  if (po.paidAt) return true;
  if (po.paidHistory && po.paidHistory.length > 0) {
    const totalPaid = po.paidHistory.reduce((s, h) => s + h.amount, 0);
    if (totalPaid >= po.total) return true;
  }
  return po.paymentMethod === 'Cash' || po.paymentMethod === 'Transfer';
};

export default function DashboardView({ 
  products, 
  activities, 
  salesInvoices,
  customers,
  expenses,
  pos,
  totalSales, 
  totalOrdersCount, 
  onTabChange, 
  onQuickRestock 
}: DashboardViewProps) {
  const [activeChartTab, setActiveChartTab] = useState<'sales' | 'profit'>('sales');
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

  // Estimasi profit per invoice: pakai Harga Modal (costPrice) produk kalau ada,
  // fallback ke asumsi margin 35% untuk item yang belum diisi harga modalnya.
  const productCostBySku = new Map(products.map((p) => [p.sku, p.costPrice]));
  const fallbackMarginRate = 0.35;
  const estimateInvoiceProfit = (inv: SalesInvoice) =>
    inv.items.reduce((sum, item) => {
      const cost = productCostBySku.get(item.sku);
      const itemProfit = cost && cost > 0
        ? (item.price - cost) * item.quantity
        : item.price * item.quantity * fallbackMarginRate;
      return sum + itemProfit;
    }, 0);

  // Parse filter dates
  const filterFrom = useMemo(() => {
    const d = new Date(chartDateFrom);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [chartDateFrom]);
  const filterTo = useMemo(() => {
    const d = new Date(chartDateTo);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [chartDateTo]);

  // ---- KPI computations berdasarkan filter tanggal ----
  const filteredInvoices = useMemo(
    () => salesInvoices.filter((inv) => inRange(inv.createdAt, filterFrom, filterTo)),
    [salesInvoices, filterFrom, filterTo]
  );

  // Card 1: Total Pendapatan (semua invoice dalam rentang)
  const totalRevenue = filteredInvoices.reduce((s, inv) => s + inv.total, 0);

  // Card 2: Total Pengeluaran (expenses approved + bon supplier yang diterima dalam rentang)
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => {
      const dateStr = e.expenseDate || e.date;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d >= filterFrom && d <= filterTo;
    }),
    [expenses, filterFrom, filterTo]
  );
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  // Bon supplier yang sudah diterima/lunas dalam rentang (bayar tempo dihitung dari tanggal dibayar)
  const filteredPOExpenses = useMemo(
    () => pos.filter((po) => {
      if (po.status !== 'Received') return false;
      const dateStr = po.paidAt || po.receivedAt || po.createdDate;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d >= filterFrom && d <= filterTo;
    }),
    [pos, filterFrom, filterTo]
  );
  const totalPOExpenses = filteredPOExpenses.reduce((s, po) => s + po.total, 0);
  const totalAllExpenses = totalExpenses + totalPOExpenses;

  // Card 3: Estimasi Untung Bersih = Pendapatan - Pengeluaran
  const estimatedNetProfit = totalRevenue - totalAllExpenses;

  // Card 4: Hutang & Piutang — semua hutang bon belum lunas + piutang customer aktif
  const unpaidPOs = pos.filter((po) => (po.status === 'Received' || po.status === 'In Transit') && !isPOPaid(po));
  const totalUnpaidPOs = unpaidPOs.reduce((s, po) => s + po.total, 0);
  const activeCustomerDebts = customers.filter((c) => c.currentDebt > 0);
  const totalCustomerDebts = activeCustomerDebts.reduce((s, c) => s + c.currentDebt, 0);
  const totalDebtAndReceivable = totalUnpaidPOs + totalCustomerDebts;

  // ---- KPI trend helpers ----
  const pctChange = (current: number, previous: number) => {
    if (previous > 0) return ((current - previous) / previous) * 100;
    return current > 0 ? 100 : 0;
  };

  // Data grafik tren pendapatan pada rentang tanggal terpilih
  const monthlyData = useMemo(() => {
    const buckets = buildDateBuckets(chartDateFrom, chartDateTo);
    return buckets.map((b) => {
      const bucketInvoices = salesInvoices.filter((inv) => {
        if (!inv.createdAt) return false;
        const d = new Date(inv.createdAt);
        return d >= b.start && d < b.endExclusive;
      });
      return {
        name: b.label,
        start: b.start,
        sales: bucketInvoices.reduce((s, inv) => s + inv.total, 0),
        profit: bucketInvoices.reduce((s, inv) => s + estimateInvoiceProfit(inv), 0),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesInvoices, chartDateFrom, chartDateTo]);

  const handleExportReport = () => downloadSalesCSV(salesInvoices);

  // Peringatan stok kritis
  const criticalStockProducts = [...products]
    .filter((p) => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock')
    .sort((a, b) => a.stock - b.stock);
  const mostCriticalProduct = criticalStockProducts[0];

  // Kontribusi penjualan per kategori
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
        {onClick && (
          <div className="absolute bottom-3 right-3 text-slate-300 hover:text-slate-500 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        )}
      </motion.div>
    );
  };

  // SVG Line Chart coordinates calculation
  const maxSalesValue = Math.max(1, ...monthlyData.map((d) => d.sales));
  const maxProfitValue = Math.max(1, ...monthlyData.map((d) => d.profit));
  const maxVal = (activeChartTab === 'sales' ? maxSalesValue : maxProfitValue) * 1.15;
  const points = monthlyData.map((d, i) => {
    const val = activeChartTab === 'sales' ? d.sales : d.profit;
    const stepX = 610 / Math.max(monthlyData.length - 1, 1);
    const x = 30 + (i * stepX);
    const y = 170 - (val / maxVal) * 130;
    return { x, y };
  });

  const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;

  // Overdue customers untuk modal
  const overdueCustomers = customers.filter((c) => c.debtStatus === 'Overdue');
  const totalOverdueAmount = overdueCustomers.reduce(
    (s, c) => s + (c.overdueAmount ?? c.currentDebt ?? 0),
    0
  );

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

      {/* Bento Grid 4 KPI Cards — semua dipengaruhi filter tanggal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {renderKpiCard(
          "Total Pendapatan",
          `Rp ${totalRevenue.toLocaleString('id-ID')}`,
          `${filteredInvoices.length} transaksi dalam periode`,
          filteredInvoices.length > 0 ? "up" : "neutral",
          <DollarSign className="w-4.5 h-4.5" />,
          "bg-emerald-500/10",
          "text-emerald-600"
        )}
        {renderKpiCard(
          "Total Pengeluaran",
          `Rp ${totalAllExpenses.toLocaleString('id-ID')}`,
          `${filteredExpenses.length} pengeluaran + ${filteredPOExpenses.length} bon`,
          totalAllExpenses > 0 ? "down" : "neutral",
          <TrendingDown className="w-4.5 h-4.5" />,
          "bg-red-500/10",
          "text-red-600"
        )}
        {renderKpiCard(
          "Estimasi Untung Bersih",
          `Rp ${estimatedNetProfit.toLocaleString('id-ID')}`,
          estimatedNetProfit >= 0 ? "Pendapatan melebihi pengeluaran" : "Pengeluaran melebihi pendapatan",
          estimatedNetProfit >= 0 ? "up" : "down",
          <TrendingUp className="w-4.5 h-4.5" />,
          "bg-blue-500/10",
          "text-blue-600"
        )}
        {renderKpiCard(
          "Hutang & Piutang",
          `Rp ${totalDebtAndReceivable.toLocaleString('id-ID')}`,
          `${unpaidPOs.length} bon supplier · ${activeCustomerDebts.length} customer`,
          totalDebtAndReceivable > 0 ? "down" : "neutral",
          <CreditCard className="w-4.5 h-4.5" />,
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
                <h4 className="text-sm font-black text-slate-800 tracking-tight">Tren Kinerja Penjualan</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Statistik finansial pendapatan dan laba bersih pada rentang tanggal terpilih</p>
              </div>

              {/* Chart toggle (shadcn Tabs, styled as a pill switcher) */}
              <Tabs value={activeChartTab} onValueChange={(v) => setActiveChartTab(v as 'sales' | 'profit')} className="self-start sm:self-auto">
                <TabsList className="bg-slate-100/70 p-1 rounded-xl border border-slate-200/40 gap-0">
                  <TabsTrigger
                    value="sales"
                    className="px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-wider border-0 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/30 text-slate-500 hover:text-slate-800"
                  >
                    Pendapatan
                  </TabsTrigger>
                  <TabsTrigger
                    value="profit"
                    className="px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-wider border-0 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/30 text-slate-500 hover:text-slate-800"
                  >
                    Keuntungan
                  </TabsTrigger>
                </TabsList>
              </Tabs>
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

                {/* Smooth Gradient Fill path */}
                <path 
                  d={`${pathD} L ${points[points.length-1].x} 170 L 30 170 Z`}
                  fill={activeChartTab === 'sales' ? 'url(#salesGrad)' : 'url(#profitGrad)'}
                  className="opacity-15"
                />

                {/* Define Gradients */}
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#D1FAE5" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Core Line path */}
                <motion.path 
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  d={pathD}
                  fill="none"
                  stroke={activeChartTab === 'sales' ? '#2563EB' : '#10B981'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Monthly Interactive Bars/Circles */}
                {points.map((pt, i) => {
                  const isHovered = hoveredMonth === i;
                  const barHeight = 170 - pt.y;
                  return (
                    <g key={i}>
                      {/* Glowing point on line */}
                      <circle 
                        cx={pt.x} 
                        cy={pt.y} 
                        r={isHovered ? 6 : 3.5} 
                        fill={activeChartTab === 'sales' ? '#2563EB' : '#10B981'}
                        stroke="white"
                        strokeWidth={isHovered ? 2.5 : 1}
                        className="transition-all"
                      />
                      {/* Interactive background bar */}
                      <rect 
                        x={pt.x - 4}
                        y={pt.y}
                        width="8"
                        height={barHeight}
                        rx="1.5"
                        fill={activeChartTab === 'sales' ? '#60A5FA' : '#34D399'}
                        className={`transition-all duration-300 ${
                          hoveredMonth === i 
                            ? 'opacity-100 filter brightness-110' 
                            : 'opacity-15'
                        }`}
                      />
                      {/* Tooltip trigger hotspot */}
                      <rect
                        x={pt.x - 25}
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
                      <span className="text-slate-400">Pendapatan:</span>
                      <span className="font-bold text-white">Rp {monthlyData[hoveredMonth].sales.toLocaleString('id-ID')}</span>
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
                      {estimatedNetProfit >= 0
                        ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />}
                      <p className="text-[11px] text-slate-300 uppercase tracking-wide leading-normal">
                        Periode ini pendapatan <span className={`font-bold ${estimatedNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Rp {totalRevenue.toLocaleString('id-ID')}</span> dengan pengeluaran <span className="font-bold text-red-400">Rp {totalAllExpenses.toLocaleString('id-ID')}</span>.
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

      {/* ====== Modal Preview Hutang & Piutang ====== */}
      <Dialog open={showDebtPreview} onOpenChange={setShowDebtPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="w-4 h-4 text-amber-500" />
              Ringkasan Hutang &amp; Piutang
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {/* Hutang Bon Supplier */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">Bon Supplier Belum Lunas</h5>
                <span className="text-xs font-black text-amber-600">Rp {totalUnpaidPOs.toLocaleString('id-ID')}</span>
              </div>
              {unpaidPOs.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic px-3 py-4 bg-gray-50 rounded-xl">Semua bon supplier sudah lunas.</p>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] text-gray-400 font-bold uppercase">
                      <tr>
                        <th className="py-2 px-3 text-left">Supplier</th>
                        <th className="py-2 px-3 text-left">No. PO</th>
                        <th className="py-2 px-3 text-right">Total Bon</th>
                        <th className="py-2 px-3 text-right">Sisa Bayar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {unpaidPOs.slice(0, 10).map((po) => {
                        const paid = po.paidHistory?.reduce((s, h) => s + h.amount, 0) ?? 0;
                        const remaining = po.total - paid;
                        return (
                          <tr key={po.poNumber} className="hover:bg-amber-50/30">
                            <td className="py-2 px-3 font-semibold text-gray-800">{po.supplier}</td>
                            <td className="py-2 px-3 font-mono text-gray-500">{po.poNumber}</td>
                            <td className="py-2 px-3 text-right text-gray-700">Rp {po.total.toLocaleString('id-ID')}</td>
                            <td className="py-2 px-3 text-right font-bold text-amber-600">Rp {remaining.toLocaleString('id-ID')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {unpaidPOs.length > 10 && (
                    <p className="text-[10px] text-gray-400 px-3 py-2 text-center">+{unpaidPOs.length - 10} bon lainnya</p>
                  )}
                </div>
              )}
            </div>

            {/* Piutang Customer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">Piutang Customer Aktif</h5>
                <span className="text-xs font-black text-red-600">Rp {totalCustomerDebts.toLocaleString('id-ID')}</span>
              </div>
              {activeCustomerDebts.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic px-3 py-4 bg-gray-50 rounded-xl">Tidak ada piutang customer yang aktif.</p>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] text-gray-400 font-bold uppercase">
                      <tr>
                        <th className="py-2 px-3 text-left">Customer</th>
                        <th className="py-2 px-3 text-left">Status</th>
                        <th className="py-2 px-3 text-right">Sisa Hutang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeCustomerDebts.slice(0, 10).map((c) => (
                        <tr key={c.id} className="hover:bg-red-50/30">
                          <td className="py-2 px-3 font-semibold text-gray-800">{c.name}</td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              c.debtStatus === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {c.debtStatus === 'Overdue' ? 'Jatuh Tempo' : 'Berjalan'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-red-600">Rp {c.currentDebt.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {activeCustomerDebts.length > 10 && (
                    <p className="text-[10px] text-gray-400 px-3 py-2 text-center">+{activeCustomerDebts.length - 10} customer lainnya</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDebtPreview(false)}>Tutup</Button>
            <Button onClick={() => { setShowDebtPreview(false); onTabChange('finance'); }} className="gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> Ke Halaman Pembayaran
            </Button>
            <Button variant="outline" onClick={() => { setShowDebtPreview(false); onTabChange('debts'); }} className="gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> Ke Utang-Piutang
            </Button>
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
              Total pendapatan periode ini Rp {totalRevenue.toLocaleString('id-ID')} dari {filteredInvoices.length} transaksi. Total pengeluaran Rp {totalAllExpenses.toLocaleString('id-ID')}. Estimasi untung bersih Rp {estimatedNetProfit.toLocaleString('id-ID')}.
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
              {unpaidPOs.length > 0 && (
                <li>
                  Ada {unpaidPOs.length} bon supplier senilai <span className="font-bold text-amber-600">Rp {totalUnpaidPOs.toLocaleString('id-ID')}</span> yang belum dibayar. Segera selesaikan agar hubungan supplier tetap baik.
                </li>
              )}
              {!mostCriticalProduct && overdueCustomers.length === 0 && unpaidPOs.length === 0 && (
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
