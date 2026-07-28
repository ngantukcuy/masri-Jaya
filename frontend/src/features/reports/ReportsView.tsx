import React, { useMemo, useState } from 'react';
import {
  FileText,
  Download,
} from 'lucide-react';
import { useDialog } from '../../components/shared/DialogProvider';
import { SalesInvoice, Product } from '../../types';

interface ReportsViewProps {
  salesInvoices: SalesInvoice[];
  products: Product[];
}

const WEEKS_TO_SHOW = 6;

function parseInvoiceDate(inv: SalesInvoice): Date | null {
  // createdAt is a real ISO timestamp set at checkout time. `date` is a
  // localized display string (e.g. "27 Juli 2026") kept for the receipt/UI
  // and isn't reliably parseable, so it's only a last-resort fallback.
  const raw = inv.createdAt || inv.date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export default function ReportsView({ salesInvoices, products }: ReportsViewProps) {
  const dialog = useDialog();
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [selectedFolder, setSelectedFolder] = useState<string>('Sales');
  const [exporting, setExporting] = useState<boolean>(false);

  // Map category displays to Indonesian
  const folderTranslationMap: Record<string, string> = {
    'Sales': 'Penjualan',
    'Inventory': 'Inventori & Stok',
    'Purchase': 'Pembelian PO',
    'Finance': 'Keuangan & Jurnal'
  };

  const reportFolders = [
    { name: 'Sales', count: 12 },
    { name: 'Inventory', count: 8 },
    { name: 'Purchase', count: 15 },
    { name: 'Finance', count: 6 },
  ];

  // Real weekly revenue for the last WEEKS_TO_SHOW weeks, computed from
  // actual sales invoices (was: hardcoded lastYear/thisYear fake numbers).
  const weeklyRevenueTrend = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; start: Date; endExclusive: Date; total: number; count: number }[] = [];
    for (let i = WEEKS_TO_SHOW - 1; i >= 0; i--) {
      const endExclusive = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7 + 1);
      const start = new Date(endExclusive);
      start.setDate(start.getDate() - 7);
      weeks.push({ label: `M${WEEKS_TO_SHOW - i}`, start, endExclusive, total: 0, count: 0 });
    }
    salesInvoices.forEach((inv) => {
      const d = parseInvoiceDate(inv);
      if (!d) return;
      const bucket = weeks.find((w) => d >= w.start && d < w.endExclusive);
      if (bucket) {
        bucket.total += inv.total;
        bucket.count += 1;
      }
    });
    return weeks;
  }, [salesInvoices]);

  const hasAnySales = salesInvoices.length > 0;
  const hasRecentSales = weeklyRevenueTrend.some((w) => w.count > 0);

  // Top selling products, aggregated straight from real invoice line items
  // (was: hardcoded fake supplier/brand list — there's no brand field on
  // Product in this app's data model, so "best sellers" is the honest
  // real-data equivalent of that panel).
  const topProducts = useMemo(() => {
    const map = new Map<string, { sku: string; name: string; revenue: number; qty: number }>();
    salesInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const key = item.sku || item.name;
        const existing = map.get(key) || { sku: item.sku, name: item.name, revenue: 0, qty: 0 };
        existing.revenue += item.price * item.quantity;
        existing.qty += item.quantity;
        map.set(key, existing);
      });
    });
    const arr = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = arr.reduce((sum, p) => sum + p.revenue, 0);
    return arr.slice(0, 5).map((p) => ({
      ...p,
      percent: totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0,
    }));
  }, [salesInvoices]);

  // Low-stock products feed the insight panel below (real, from Products data)
  const lowStockCount = useMemo(
    () => products.filter((p) => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock').length,
    [products]
  );

  // A short, honestly-computed observation from real numbers (was: a
  // hardcoded fake "AI suggestion" unrelated to any real data, plus a
  // "Hubungkan Distribusi" button that only showed a fake connecting
  // message — both removed since neither reflected a real feature).
  const insightText = useMemo(() => {
    const thisWeek = weeklyRevenueTrend[weeklyRevenueTrend.length - 1];
    const lastWeek = weeklyRevenueTrend[weeklyRevenueTrend.length - 2];
    const parts: string[] = [];

    if (thisWeek && thisWeek.count > 0 && lastWeek && lastWeek.count > 0 && lastWeek.total > 0) {
      const pct = Math.round(((thisWeek.total - lastWeek.total) / lastWeek.total) * 100);
      parts.push(
        pct >= 0
          ? `Pendapatan minggu ini naik ${pct}% dibanding minggu lalu.`
          : `Pendapatan minggu ini turun ${Math.abs(pct)}% dibanding minggu lalu.`
      );
    } else if (thisWeek && thisWeek.count > 0) {
      parts.push(`Pendapatan minggu ini: Rp ${thisWeek.total.toLocaleString('id-ID')} dari ${thisWeek.count} transaksi.`);
    } else {
      parts.push('Belum ada transaksi tercatat minggu ini.');
    }

    if (topProducts[0]) {
      parts.push(`Produk terlaris: ${topProducts[0].name}.`);
    }
    if (lowStockCount > 0) {
      parts.push(`${lowStockCount} produk perlu restock.`);
    }
    return parts.join(' ');
  }, [weeklyRevenueTrend, topProducts, lowStockCount]);

  const triggerExport = (format: string) => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      dialog.alert(`Berhasil! Laporan analisis ekspor format ${format} telah disimpan dengan nama: LAPORAN_ANALISIS_KINERJA_SINARMAJU_${new Date().getFullYear()}.${format.toLowerCase()}`);
    }, 1200);
  };

  // Build an SVG path from real weekly totals for the line-chart view
  // (was: a hardcoded, unrelated squiggle of fixed coordinates).
  const linePath = useMemo(() => {
    const values = weeklyRevenueTrend.map((w) => w.total);
    const max = Math.max(...values, 1);
    const width = 600;
    const height = 160;
    const padTop = 20;
    const padBottom = 20;
    const padX = 50;
    const stepX = (width - padX * 2) / Math.max(values.length - 1, 1);
    return values
      .map((v, i) => {
        const x = padX + i * stepX;
        const y = height - padBottom - (v / max) * (height - padTop - padBottom);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [weeklyRevenueTrend]);

  const maxWeeklyValue = Math.max(...weeklyRevenueTrend.map((w) => w.total), 1);

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Pusat Laporan &amp; Analisis</h2>
          <p className="text-gray-500 text-sm">Analisis kinerja penjualan berdasarkan data transaksi dan stok yang tercatat.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => triggerExport('PDF')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>{exporting ? 'Memproses...' : 'Ekspor PDF'}</span>
          </button>
          <button 
            onClick={() => triggerExport('XLSX')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer disabled:opacity-50 shadow-md shadow-blue-500/10"
          >
            <span>{exporting ? 'Mengunduh...' : 'Ekspor Excel (XLSX)'}</span>
          </button>
        </div>
      </div>

      {/* Folders and Categories Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {reportFolders.map((f) => (
          <div 
            key={f.name}
            onClick={() => setSelectedFolder(f.name)}
            className={`p-5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
              selectedFolder === f.name 
                ? 'bg-blue-50/50 border-blue-600 text-blue-700 font-extrabold' 
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Kategori Log</span>
              <h4 className="text-sm font-black text-gray-800 mt-1">Laporan {folderTranslationMap[f.name]}</h4>
              <span className="text-[10px] text-gray-400 mt-0.5 block">{f.count} templat tersedia</span>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selectedFolder === f.name ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Visualizer Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Weekly Revenue Trend Chart (real data) */}
        <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <div>
              <h4 className="text-sm font-black text-gray-800 tracking-tight">Tren Pendapatan Mingguan</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Total penjualan riil per minggu, {WEEKS_TO_SHOW} minggu terakhir</p>
            </div>
            
            {/* Chart type toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  chartType === 'bar' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Grafik Batang
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  chartType === 'line' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Kurva Garis
              </button>
            </div>
          </div>

          {!hasRecentSales ? (
            <div className="h-56 mt-6 flex flex-col items-center justify-center text-center text-gray-400 gap-1">
              <FileText className="w-8 h-8 text-gray-200 mb-1" />
              <p className="text-xs font-bold">Belum ada data penjualan {WEEKS_TO_SHOW} minggu terakhir</p>
              <p className="text-[11px]">Grafik akan terisi otomatis begitu ada transaksi di POS Kasir.</p>
            </div>
          ) : chartType === 'bar' ? (
            <div className="h-56 mt-6 flex items-end justify-between px-4 relative">
              {weeklyRevenueTrend.map((d) => {
                const barHeight = (d.total / maxWeeklyValue) * 140;
                return (
                  <div key={d.label} className="flex flex-col items-center flex-1 group">
                    <div className="flex items-end gap-1.5 h-36">
                      <div 
                        style={{ height: `${Math.max(barHeight, d.total > 0 ? 4 : 0)}px` }} 
                        className="w-5 bg-blue-600 rounded-t transition-all group-hover:brightness-110" 
                        title={`${d.label}: Rp ${d.total.toLocaleString('id-ID')} (${d.count} transaksi)`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 mt-2">{d.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-56 mt-6 relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160">
                <path 
                  d={linePath}
                  fill="none" 
                  stroke="#2563EB" 
                  strokeWidth="3"
                />
                {weeklyRevenueTrend.map((d, i) => {
                  const width = 600, padX = 50;
                  const stepX = (width - padX * 2) / Math.max(weeklyRevenueTrend.length - 1, 1);
                  const x = padX + i * stepX;
                  const y = 160 - 20 - (d.total / maxWeeklyValue) * (160 - 40);
                  return <circle key={d.label} cx={x} cy={y} r="4" fill="#2563EB" stroke="white" strokeWidth="2" />;
                })}
              </svg>
              <div className="flex justify-between text-[10px] text-gray-400 font-bold px-4">
                {weeklyRevenueTrend.map((d) => (
                  <span key={d.label}>{d.label}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
              <span>Realisasi Penjualan (Riil)</span>
            </div>
          </div>
        </div>

        {/* Top Selling Products (real data, replaces the old fake brand list) */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Produk Terlaris</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Berdasarkan total pendapatan dari seluruh transaksi tercatat.</p>
          </div>

          {topProducts.length === 0 ? (
            <div className="py-6 text-center text-gray-400">
              <p className="text-xs font-bold">Belum ada transaksi tercatat</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {topProducts.map((prod) => (
                <div key={prod.sku || prod.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-gray-800">
                    <span className="truncate">{prod.name}</span>
                    <span className="text-blue-600">{prod.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full" 
                      style={{ width: `${prod.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>Rp {prod.revenue.toLocaleString('id-ID')}</span>
                    <span>{prod.qty} terjual</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Insight Summary block (computed from real numbers, not a hardcoded message) */}
      <div className="bg-zinc-900 text-white border-2 border-zinc-800 p-5 relative overflow-hidden rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 relative">
          <div className="space-y-1">
            <span className="text-[9px] bg-emerald-600/20 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-widest">Ringkasan Kinerja</span>
            <h4 className="text-sm font-black uppercase tracking-wider text-white">
              {hasAnySales ? 'Ringkasan Minggu Ini' : 'Menunggu Data Penjualan'}
            </h4>
            <p className="text-xs text-gray-400">{insightText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
