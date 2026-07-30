import React, { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  PackageX,
  PackageMinus,
  Boxes,
} from 'lucide-react';
import { SalesInvoice, Product, PO, Expense } from '../../types';

interface ReportsViewProps {
  salesInvoices: SalesInvoice[];
  products: Product[];
  pos?: PO[];
  expenses?: Expense[];
}

type ReportCategory = 'Sales' | 'Inventory' | 'Purchase' | 'Finance';

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

/** Builds a CSV Blob from header + rows and triggers a real browser download. Escapes commas/quotes so no library is needed for a simple tabular export. */
function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((row) => row.map(escape).join(','));
  // Prepend a BOM so Excel opens UTF-8 (Rupiah, Indonesian text) correctly.
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsView({ salesInvoices, products, pos = [], expenses = [] }: ReportsViewProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [selectedFolder, setSelectedFolder] = useState<ReportCategory>('Sales');

  // Map category displays to Indonesian
  const folderTranslationMap: Record<ReportCategory, string> = {
    'Sales': 'Penjualan',
    'Inventory': 'Inventori & Stok',
    'Purchase': 'Pembelian PO',
    'Finance': 'Keuangan & Jurnal'
  };

  // Real record counts per category (was: hardcoded fake counts like "12 templat tersedia").
  const reportFolders: { name: ReportCategory; count: number }[] = [
    { name: 'Sales', count: salesInvoices.length },
    { name: 'Inventory', count: products.length },
    { name: 'Purchase', count: pos.length },
    { name: 'Finance', count: expenses.length },
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
  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stockStatus === 'Low Stock'),
    [products]
  );
  const outOfStockProducts = useMemo(
    () => products.filter((p) => p.stockStatus === 'Out of Stock'),
    [products]
  );
  const inventoryValue = useMemo(
    () => products.reduce((sum, p) => sum + (p.costPrice ?? p.retailPrice ?? 0) * p.stock, 0),
    [products]
  );

  // Purchase (PO) summary — real, from the pos prop.
  const poSummary = useMemo(() => {
    const totalSpend = pos.reduce((sum, p) => sum + p.total, 0);
    const byStatus = pos.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});
    return { totalSpend, byStatus };
  }, [pos]);

  // Finance (expense) summary — real, from the expenses prop.
  const financeSummary = useMemo(() => {
    const totalApproved = expenses.filter((e) => e.status === 'Approved').reduce((sum, e) => sum + e.amount, 0);
    const totalPending = expenses.filter((e) => e.status === 'Pending').reduce((sum, e) => sum + e.amount, 0);
    const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});
    return { totalApproved, totalPending, byCategory };
  }, [expenses]);

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
    if (lowStockProducts.length + outOfStockProducts.length > 0) {
      parts.push(`${lowStockProducts.length + outOfStockProducts.length} produk perlu restock.`);
    }
    return parts.join(' ');
  }, [weeklyRevenueTrend, topProducts, lowStockProducts, outOfStockProducts]);

  // Real export: writes an actual CSV of whichever category is currently
  // selected (was: a setTimeout + fake "export succeeded" alert that never
  // touched a real file). XLSX opens CSV natively, so one honest format
  // covers the "Excel" button without pulling in a spreadsheet library.
  const exportCSV = () => {
    if (selectedFolder === 'Sales') {
      downloadCSV(
        `laporan-penjualan-${Date.now()}.csv`,
        ['No. Invoice', 'Tanggal', 'Pelanggan', 'Metode Bayar', 'Total'],
        salesInvoices.map((inv) => [inv.invoiceNumber, inv.date, inv.customerName, inv.paymentMethod, inv.total])
      );
    } else if (selectedFolder === 'Inventory') {
      downloadCSV(
        `laporan-inventori-${Date.now()}.csv`,
        ['SKU', 'Nama', 'Kategori', 'Stok', 'Status', 'Harga Modal', 'Harga Jual'],
        products.map((p) => [p.sku, p.name, p.category, p.stock, p.stockStatus, p.costPrice ?? 0, p.retailPrice])
      );
    } else if (selectedFolder === 'Purchase') {
      downloadCSV(
        `laporan-pembelian-${Date.now()}.csv`,
        ['No. PO', 'Supplier', 'Status', 'Tanggal', 'Total'],
        pos.map((p) => [p.poNumber, p.supplier, p.status, p.createdDate, p.total])
      );
    } else {
      downloadCSV(
        `laporan-keuangan-${Date.now()}.csv`,
        ['Tanggal', 'Kategori', 'Deskripsi', 'Diajukan Oleh', 'Status', 'Jumlah'],
        expenses.map((e) => [e.date, e.category, e.description, e.submittedBy, e.status, e.amount])
      );
    }
  };

  // Real print: hands off to the browser's native print dialog on the
  // current report view, which can be saved as PDF from there — an honest
  // substitute for a fake "PDF exported" message with no client-side PDF
  // library in play.
  const printReport = () => {
    window.print();
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
            onClick={printReport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            <span>Cetak / Simpan PDF</span>
          </button>
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-md shadow-blue-500/10"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Folders and Categories Grid — clicking actually switches the real content shown below */}
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
              <span className="text-[10px] text-gray-400 mt-0.5 block">{f.count} data tercatat</span>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selectedFolder === f.name ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {selectedFolder === 'Sales' && (
        <>
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
        </>
      )}

      {selectedFolder === 'Inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Boxes className="w-5 h-5" /></div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Nilai Inventori (Modal)</p>
                <p className="text-sm font-black text-gray-900">Rp {inventoryValue.toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><PackageMinus className="w-5 h-5" /></div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Stok Menipis</p>
                <p className="text-sm font-black text-gray-900">{lowStockProducts.length} produk</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><PackageX className="w-5 h-5" /></div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Stok Habis</p>
                <p className="text-sm font-black text-gray-900">{outOfStockProducts.length} produk</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-x-auto">
            <div className="p-4 border-b border-gray-100">
              <h4 className="text-sm font-black text-gray-800">Produk Perlu Perhatian</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Stok menipis atau habis, diurutkan dari yang paling kritis.</p>
            </div>
            <table className="w-full text-xs min-w-[480px]">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold">
                <tr>
                  <th className="text-left p-3">SKU</th>
                  <th className="text-left p-3">Nama Produk</th>
                  <th className="text-left p-3">Kategori</th>
                  <th className="text-right p-3">Sisa Stok</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...outOfStockProducts, ...lowStockProducts].length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400">Semua stok dalam kondisi sehat.</td></tr>
                ) : (
                  [...outOfStockProducts, ...lowStockProducts].map((p) => (
                    <tr key={p.sku} className="hover:bg-gray-50">
                      <td className="p-3 font-mono text-gray-500">{p.sku}</td>
                      <td className="p-3 font-bold text-gray-800">{p.name}</td>
                      <td className="p-3 text-gray-500">{p.category}</td>
                      <td className="p-3 text-right font-bold text-gray-900">{p.stock}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${p.stockStatus === 'Out of Stock' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          {p.stockStatus === 'Out of Stock' ? 'Habis' : 'Menipis'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedFolder === 'Purchase' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Total Nilai PO</p>
              <p className="text-sm font-black text-gray-900 mt-1">Rp {poSummary.totalSpend.toLocaleString('id-ID')}</p>
            </div>
            {(['Draft', 'Ordered', 'In Transit', 'Received'] as const).map((status) => (
              <div key={status} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs sm:col-span-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase">{status}</p>
                <p className="text-sm font-black text-gray-900 mt-1">{poSummary.byStatus[status] || 0} PO</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-x-auto">
            <div className="p-4 border-b border-gray-100">
              <h4 className="text-sm font-black text-gray-800">Daftar Pesanan Pembelian</h4>
            </div>
            <table className="w-full text-xs min-w-[480px]">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold">
                <tr>
                  <th className="text-left p-3">No. PO</th>
                  <th className="text-left p-3">Supplier</th>
                  <th className="text-left p-3">Tanggal</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pos.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400">Belum ada PO tercatat.</td></tr>
                ) : (
                  pos.map((p) => (
                    <tr key={p.poNumber} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-800">{p.poNumber}</td>
                      <td className="p-3 text-gray-600">{p.supplier}</td>
                      <td className="p-3 text-gray-500">{p.createdDate}</td>
                      <td className="p-3 text-center">
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{p.status}</span>
                      </td>
                      <td className="p-3 text-right font-bold text-gray-900">Rp {p.total.toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedFolder === 'Finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Total Disetujui</p>
              <p className="text-sm font-black text-emerald-600 mt-1">Rp {financeSummary.totalApproved.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Menunggu Persetujuan</p>
              <p className="text-sm font-black text-amber-600 mt-1">Rp {financeSummary.totalPending.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-x-auto">
            <div className="p-4 border-b border-gray-100">
              <h4 className="text-sm font-black text-gray-800">Klaim &amp; Pengeluaran</h4>
            </div>
            <table className="w-full text-xs min-w-[520px]">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold">
                <tr>
                  <th className="text-left p-3">Tanggal</th>
                  <th className="text-left p-3">Kategori</th>
                  <th className="text-left p-3">Deskripsi</th>
                  <th className="text-left p-3">Diajukan Oleh</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-400">Belum ada pengeluaran tercatat.</td></tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{e.date}</td>
                      <td className="p-3 text-gray-600">{e.category}</td>
                      <td className="p-3 text-gray-800">{e.description}</td>
                      <td className="p-3 text-gray-500">{e.submittedBy}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          e.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : e.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>{e.status}</span>
                      </td>
                      <td className="p-3 text-right font-bold text-gray-900">Rp {e.amount.toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
