import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
} from 'lucide-react';
import { useDialog } from '../../components/shared/DialogProvider';

export default function ReportsView() {
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

  // W1 - W6 Weekly trend performance in local IDR terms
  const weeklyReportTrend = [
    { week: 'M1', lastYear: 180000000, thisYear: 245000000 },
    { week: 'M2', lastYear: 220000000, thisYear: 310000000 },
    { week: 'M3', lastYear: 195000000, thisYear: 142000000 },
    { week: 'M4', lastYear: 280000000, thisYear: 450000000 },
    { week: 'M5', lastYear: 324000000, thisYear: 382100000 },
    { week: 'M6', lastYear: 240000000, thisYear: 290000000 },
  ];

  const brandContribution = [
    { name: 'SteelCorp Int. (Besi Ulir)', value: 842500000, percent: '35%', change: '▲ +12%' },
    { name: 'Cemex Tiga Roda (Semen)', value: 612400000, percent: '22%', change: '▲ +8.1%' },
    { name: 'Nippon Paint (Cat)', value: 420900000, percent: '15%', change: '▼ -2%' },
    { name: 'Dulux Coating HQ (Dinding)', value: 360000000, percent: '13%', change: '▲ +14%' },
  ];

  const triggerExport = (format: string) => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      dialog.alert(`Berhasil! Laporan analisis ekspor format ${format} telah disimpan dengan nama: LAPORAN_ANALISIS_KINERJA_SINARMAJU_${new Date().getFullYear()}.${format.toLowerCase()}`);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Pusat Laporan &amp; Analisis</h2>
          <p className="text-gray-500 text-sm">Analisis kinerja mendalam, laporan keuangan fiskal bulanan, dan kontribusi laba produk pemasok.</p>
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
        
        {/* Weekly Trend Bar Chart */}
        <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <div>
              <h4 className="text-sm font-black text-gray-800 tracking-tight">Perbandingan Pendapatan Mingguan</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Analisis komparatif target tahun lalu vs perolehan riil tahun ini</p>
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

          {/* Graphical rendering */}
          {chartType === 'bar' ? (
            <div className="h-56 mt-6 flex items-end justify-between px-4 relative">
              {weeklyReportTrend.map((d) => {
                const maxVal = 500000000;
                const lastYearHeight = (d.lastYear / maxVal) * 140;
                const thisYearHeight = (d.thisYear / maxVal) * 140;

                return (
                  <div key={d.week} className="flex flex-col items-center flex-1 group">
                    <div className="flex items-end gap-1.5 h-36">
                      <div 
                        style={{ height: `${lastYearHeight}px` }} 
                        className="w-3.5 bg-gray-200 rounded-t transition-all group-hover:brightness-95" 
                        title={`Tahun Lalu: Rp ${d.lastYear.toLocaleString('id-ID')}`}
                      />
                      <div 
                        style={{ height: `${thisYearHeight}px` }} 
                        className="w-3.5 bg-blue-600 rounded-t transition-all group-hover:brightness-110" 
                        title={`Tahun Ini: Rp ${d.thisYear.toLocaleString('id-ID')}`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 mt-2">{d.week}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-56 mt-6 relative">
              {/* Simple illustrative multi-line SVG tracker */}
              <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160">
                {/* Last year line */}
                <path 
                  d="M 50 120 L 150 100 L 250 110 L 350 80 L 450 60 L 550 90" 
                  fill="none" 
                  stroke="#E2E8F0" 
                  strokeWidth="3" 
                  strokeDasharray="4,4"
                />
                {/* This year line */}
                <path 
                  d="M 50 100 L 150 70 L 250 115 L 350 40 L 450 65 L 550 80" 
                  fill="none" 
                  stroke="#2563EB" 
                  strokeWidth="3"
                />
                {/* Nodes circles */}
                <circle cx="350" cy="40" r="5" fill="#2563EB" stroke="white" strokeWidth="2" />
                <circle cx="450" cy="65" r="5" fill="#2563EB" stroke="white" strokeWidth="2" />
              </svg>
              <div className="flex justify-between text-[10px] text-gray-400 font-bold px-4">
                <span>Minggu 1</span>
                <span>Minggu 2</span>
                <span>Minggu 3</span>
                <span>Minggu 4</span>
                <span>Minggu 5</span>
                <span>Minggu 6</span>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-gray-200 rounded-full" />
              <span>Target Finansial (Tahun Lalu)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
              <span>Realisasi Penjualan (Tahun Ini)</span>
            </div>
          </div>
        </div>

        {/* Brand Contribution Ledger */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Kontribusi Merk &amp; Pemasok</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Daftar pabrikan penyuplai bahan bangunan dengan volume penjualan tertinggi.</p>
          </div>

          <div className="space-y-4 pt-2">
            {brandContribution.map((brand, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-gray-800">
                  <span className="truncate">{brand.name}</span>
                  <span className="text-blue-600">{brand.percent}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full" 
                    style={{ width: brand.percent }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-gray-400">
                  <span>Rp {brand.value.toLocaleString('id-ID')}</span>
                  <span className={brand.change.includes('+') ? 'text-emerald-500' : 'text-red-500'}>
                    {brand.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Intelligence Insights Summary block */}
      <div className="bg-[#1A1A1A] text-white border-2 border-[#333] p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 relative">
          <div className="space-y-1">
            <span className="text-[9px] bg-emerald-600/20 text-[#00FF66] font-bold px-2 py-0.5 rounded uppercase font-mono tracking-widest">Saran Manajemen AI</span>
            <h4 className="text-sm font-black uppercase tracking-wider text-white">Target Optimalisasi Sektor Gudang</h4>
            <p className="text-xs text-gray-400">Tingkatkan efisiensi omset dengan memesan besi beton langsung dari pabrik utama guna memotong margin distributor.</p>
          </div>
          <button 
            onClick={() => dialog.alert("Menghubungkan ke pusat server logistik...")}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-black font-black text-[10px] uppercase tracking-widest transition-colors cursor-pointer shrink-0"
          >
            Hubungkan Distribusi
          </button>
        </div>
      </div>
    </div>
  );
}
