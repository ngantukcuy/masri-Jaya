import React, { useState } from 'react';
import { 
  ShoppingCart, 
  CheckCircle2, 
  Truck, 
  Plus, 
  PackageCheck,
  ChevronRight,
  Edit3,
  Trash2
} from 'lucide-react';
import { PO, Supplier, Product } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';

interface PurchaseViewProps {
  pos: PO[];
  suppliers: Supplier[];
  products: Product[];
  onUpdatePOs: (updatedPOs: PO[]) => void;
  onUpdateProducts: (updatedProducts: Product[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote') => void;
  onUpdateSuppliers: (updatedSuppliers: Supplier[]) => void;
  currentUser?: CurrentUser | null;
}

export default function PurchaseView({ 
  pos, 
  suppliers, 
  products, 
  onUpdatePOs, 
  onUpdateProducts, 
  onAddActivity,
  onUpdateSuppliers,
  currentUser
}: PurchaseViewProps) {
  const dialog = useDialog();
  // Approving a PO commits the store to spending money with a supplier —
  // gate it separately from "can open the Purchasing tab" so warehouse
  // staff (Stoker) can still receive goods without being able to approve
  // new spend. See lib/permissions.ts.
  const canApprovePO = hasPermission(currentUser, 'manage_purchase_approve');
  const [selectedPO, setSelectedPO] = useState<PO | null>(pos[0] || null);
  const [filterSupplier, setFilterSupplier] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditPOModal, setShowEditPOModal] = useState(false);

  // Form states for new PO
  const [newPOSupplier, setNewPOSupplier] = useState(suppliers[0]?.name || '');
  const [newPOItemName, setNewPOItemName] = useState('');
  const [newPOItemQuantity, setNewPOItemQuantity] = useState(10);
  const [newPOItemPrice, setNewPOItemPrice] = useState(100000);
  const [newPOLogistics, setNewPOLogistics] = useState('');

  // Form states for editing PO
  const [editPOSupplier, setEditPOSupplier] = useState('');
  const [editPOItemName, setEditPOItemName] = useState('');
  const [editPOItemQuantity, setEditPOItemQuantity] = useState(10);
  const [editPOItemPrice, setEditPOItemPrice] = useState(100000);
  const [editPOLogistics, setEditPOLogistics] = useState('');

  // Status mapper to Indonesian
  const statusTranslationMap: Record<string, { label: string, color: string }> = {
    'Draft': { label: 'RANCANGAN', color: 'bg-gray-100 text-gray-700' },
    'Ordered': { label: 'DIPESAN', color: 'bg-blue-50 text-blue-700' },
    'In Transit': { label: 'DIKIRIM', color: 'bg-amber-50 text-amber-700' },
    'Received': { label: 'DITERIMA GUDANG', color: 'bg-emerald-50 text-emerald-700 font-bold' }
  };

  // Handle receiving of goods
  const handleReceiveGoods = (po: PO) => {
    if (po.status !== 'Ordered' && po.status !== 'In Transit') return;

    // Transition status
    const updatedPOs = pos.map((p) => {
      if (p.poNumber === po.poNumber) {
        return { ...p, status: 'Received' as const };
      }
      return p;
    });

    onUpdatePOs(updatedPOs);
    const refreshedSelected = updatedPOs.find(p => p.poNumber === po.poNumber) || null;
    setSelectedPO(refreshedSelected);

    // Dynamic stock adjustment
    const updatedProducts = [...products];
    po.items.forEach((item) => {
      // Find matching product
      const match = updatedProducts.find(
        (p) => p.name.toLowerCase().includes(item.name.toLowerCase()) || 
               item.name.toLowerCase().includes(p.name.toLowerCase())
      );
      if (match) {
        match.stock += item.quantity;
        match.stockStatus = match.stock > 15 ? 'Healthy' : 'Low Stock';
      }
    });
    onUpdateProducts(updatedProducts);

    // Update supplier's outstanding debt (payable) and latest PO reference
    const updatedSuppliers = suppliers.map((s) =>
      s.name === po.supplier
        ? { ...s, debt: s.debt + po.total, recentPO: po.poNumber }
        : s
    );
    onUpdateSuppliers(updatedSuppliers);

    // Add activity stream event
    onAddActivity(
      `Penerimaan Barang PO: ${po.poNumber}`,
      `Menambah ${po.items.reduce((acc, i) => acc + i.quantity, 0)} unit bahan bangunan dari ${po.supplier}`,
      0,
      'arrival'
    );

    dialog.alert(`Barang untuk nomor PO ${po.poNumber} berhasil diterima! Stok fisik di gudang telah bertambah.`);
  };

  const handleApprovePO = (po: PO) => {
    if (po.status !== 'Draft') return;
    if (!canApprovePO) {
      dialog.alert('Anda tidak memiliki izin untuk menyetujui pesanan pembelian ini. Hubungi Owner atau Admin.');
      return;
    }
    const updated = pos.map(p => p.poNumber === po.poNumber ? { ...p, status: 'Ordered' as const } : p);
    onUpdatePOs(updated);
    setSelectedPO(updated.find(p => p.poNumber === po.poNumber) || null);
    onAddActivity(
      `PO Disetujui: ${po.poNumber}`,
      `Disetujui oleh ${currentUser?.name || 'staf'} — supplier ${po.supplier}`,
      po.total,
      'quote'
    );
    dialog.alert(`Nomor PO ${po.poNumber} disetujui! Status diperbarui ke Dipesan.`);
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPOItemName.trim()) {
      dialog.alert("Silakan masukkan nama material pesanan!");
      return;
    }

    const nextPoNum = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPO: PO = {
      poNumber: nextPoNum,
      supplier: newPOSupplier,
      items: [{
        sku: `SKU-PO-${Math.floor(100 + Math.random() * 900)}`,
        name: newPOItemName,
        quantity: newPOItemQuantity,
        price: newPOItemPrice
      }],
      total: newPOItemQuantity * newPOItemPrice,
      status: 'Draft',
      createdDate: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
      logisticsNote: newPOLogistics || 'Pengiriman logistik armada darat utama'
    };

    onUpdatePOs([newPO, ...pos]);
    setSelectedPO(newPO);
    setShowCreateModal(false);

    onAddActivity(
      `Draft PO Dibuat: ${nextPoNum}`,
      `Menunggu persetujuan owner untuk supplier ${newPOSupplier}`,
      newPO.total,
      'quote'
    );

    // Reset forms
    setNewPOItemName('');
    setNewPOItemQuantity(10);
    setNewPOItemPrice(100000);
    setNewPOLogistics('');
    dialog.alert(`Draft PO ${nextPoNum} berhasil dibuat! Silakan klik tombol 'Setujui Pesanan PO' pada rincian kanan.`);
  };

  const handleOpenEditPOModal = (po: PO) => {
    setSelectedPO(po);
    setEditPOSupplier(po.supplier);
    setEditPOItemName(po.items[0]?.name || '');
    setEditPOItemQuantity(po.items[0]?.quantity || 1);
    setEditPOItemPrice(po.items[0]?.price || 100000);
    setEditPOLogistics(po.logisticsNote || '');
    setShowEditPOModal(true);
  };

  const handleDeletePO = async (po: PO) => {
    const ok = await dialog.confirm(`Apakah Anda yakin ingin menghapus/membatalkan Pesanan Pembelian ${po.poNumber}?`);
    if (!ok) return;

    const updated = pos.filter(p => p.poNumber !== po.poNumber);
    onUpdatePOs(updated);
    setSelectedPO(null);

    onAddActivity(
      `PO Dibatalkan / Dihapus`,
      `Membatalkan nomor transaksi ${po.poNumber}`,
      0,
      'overdue'
    );

    dialog.alert(`Pesanan Pembelian ${po.poNumber} berhasil dihapus.`);
  };

  const handleEditPOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    if (!editPOItemName.trim()) {
      dialog.alert("Silakan masukkan nama material pesanan!");
      return;
    }

    const updated = pos.map((p) => {
      if (p.poNumber === selectedPO.poNumber) {
        const updatedItems = [{
          sku: p.items[0]?.sku || `SKU-PO-${Math.floor(100 + Math.random() * 900)}`,
          name: editPOItemName.trim(),
          quantity: Number(editPOItemQuantity),
          price: Number(editPOItemPrice)
        }];
        const nextPO = {
          ...p,
          supplier: editPOSupplier,
          items: updatedItems,
          total: Number(editPOItemQuantity) * Number(editPOItemPrice),
          logisticsNote: editPOLogistics
        };
        setSelectedPO(nextPO);
        return nextPO;
      }
      return p;
    });

    onUpdatePOs(updated);
    setShowEditPOModal(false);

    onAddActivity(
      `Pembaruan PO: ${selectedPO.poNumber}`,
      `Rincian pengadaan supplier ${editPOSupplier} diperbarui`,
      Number(editPOItemQuantity) * Number(editPOItemPrice),
      'quote'
    );

    dialog.alert(`Pesanan Pembelian ${selectedPO.poNumber} berhasil diperbarui!`);
  };

  // Filtered POs
  const filteredPOs = pos.filter((po) => {
    if (filterSupplier && po.supplier !== filterSupplier) return false;
    return true;
  });

  // Calculate PO values
  const totalPOAmount = pos.reduce((acc, p) => acc + (p.status !== 'Received' ? p.total : 0), 0);
  const pendingIncomingCount = pos.filter(p => p.status === 'Ordered' || p.status === 'In Transit').length;

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Pesanan Pembelian (PO) &amp; Supplier</h2>
          <p className="text-gray-500 text-sm">Kelola pasokan supplier, rincian pengiriman barang masuk, dan kontrol pembayaran penyuplai.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Pesanan PO Baru</span>
        </button>
      </div>

      {/* Procurements KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">OUTSTANDING PO BERJALAN</p>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">Rp {totalPOAmount.toLocaleString('id-ID')}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">KLOTER DALAM PERJALANAN</p>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{pendingIncomingCount} Pengiriman Kargo</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">SUPPLIER AKTIF TERHUBUNG</p>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{suppliers.length} Pabrikan Industri</h4>
          </div>
        </div>
      </div>

      {/* Main Procurement Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: PO Tables list */}
        <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
          
          {/* Supplier select tags */}
          <div className="p-4 border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterSupplier(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterSupplier === null ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Semua Penyuplai
            </button>
            {suppliers.map(s => (
              <button
                key={s.name}
                onClick={() => setFilterSupplier(s.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterSupplier === s.name ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] text-gray-400 font-bold uppercase border-b border-gray-100">
                  <th className="py-3 px-4">Nomor PO</th>
                  <th className="py-3 px-4">Nama Supplier</th>
                  <th className="py-3 px-4">Tanggal Pengajuan</th>
                  <th className="py-3 px-4 text-right">Nilai Tagihan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 font-bold">Tidak ada rincian transaksi PO untuk supplier terpilih.</td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => (
                    <tr
                      key={po.poNumber}
                      onClick={() => setSelectedPO(po)}
                      className={`hover:bg-gray-50/50 cursor-pointer transition-all ${
                        selectedPO?.poNumber === po.poNumber ? 'bg-blue-50/40 hover:bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-800">{po.poNumber}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-extrabold text-gray-800">{po.supplier}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{po.items[0]?.name} (+{po.items.length - 1} item)</p>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 font-medium">{po.createdDate}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-950">Rp {po.total.toLocaleString('id-ID')}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          statusTranslationMap[po.status]?.color || 'bg-gray-100 text-gray-600'
                        }`}>
                          {statusTranslationMap[po.status]?.label || po.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: PO Details Inspection Panel */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-5">
          {selectedPO ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <span className="text-[10px] bg-zinc-100 font-mono text-zinc-600 px-2 py-0.5 rounded">
                    PROSES LOGISTIK
                  </span>
                  <h4 className="font-black text-sm text-gray-900 mt-1.5">{selectedPO.poNumber}</h4>
                  <span className="text-[10px] text-gray-400 block mt-0.5">Supplier: {selectedPO.supplier}</span>
                </div>
                <button 
                  onClick={() => setSelectedPO(null)}
                  className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"
                >✕</button>
              </div>

              {/* Status Action Workflow CTAs */}
              <div className="p-3 border rounded-xl bg-gray-50 text-xs space-y-2.5">
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest block">Proses Persetujuan &amp; Terima</span>
                
                <div className="flex justify-between items-center text-gray-500 text-[11px]">
                  <span>Status Terkini:</span>
                  <span className="font-bold uppercase text-gray-700">{statusTranslationMap[selectedPO.status]?.label}</span>
                </div>

                {selectedPO.status === 'Draft' && canApprovePO && (
                  <button
                    onClick={() => handleApprovePO(selectedPO)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-center cursor-pointer transition-colors"
                  >
                    Setujui &amp; Kirim Pesanan PO
                  </button>
                )}

                {selectedPO.status === 'Draft' && !canApprovePO && (
                  <div className="w-full py-2.5 bg-gray-100 text-gray-500 rounded-lg font-semibold text-center text-[11px]">
                    Menunggu persetujuan Owner/Admin
                  </div>
                )}

                {(selectedPO.status === 'Ordered' || selectedPO.status === 'In Transit') && (
                  <button
                    onClick={() => handleReceiveGoods(selectedPO)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Konfirmasi Barang Diterima</span>
                  </button>
                )}

                {selectedPO.status === 'Received' && (
                  <div className="text-center text-emerald-700 bg-emerald-100/50 p-2 rounded-lg border border-emerald-150 font-bold text-[11px]">
                    ✓ Barang Diterima Gudang Utama
                  </div>
                )}

                <div className="flex gap-2 border-t border-gray-200 pt-2.5 mt-1">
                  <button
                    onClick={() => handleOpenEditPOModal(selectedPO)}
                    className="w-full py-1.5 border border-amber-200 hover:bg-amber-50 text-amber-800 rounded-lg font-bold text-center text-[10px] cursor-pointer transition-colors flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit PO</span>
                  </button>
                  <button
                    onClick={() => handleDeletePO(selectedPO)}
                    className="w-full py-1.5 border border-red-200 hover:bg-red-50 text-red-800 rounded-lg font-bold text-center text-[10px] cursor-pointer transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus PO</span>
                  </button>
                </div>
              </div>

              {/* Items Breakdown list */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest block">Daftar Bahan Bangunan</span>
                <div className="p-3.5 border border-gray-150 rounded-xl space-y-3 bg-gray-50/20">
                  {selectedPO.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <div>
                        <p className="font-extrabold text-gray-800">{item.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Jumlah: {item.quantity} Unit</p>
                      </div>
                      <span className="font-bold text-gray-900">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-black text-gray-950 border-t border-dashed border-gray-200 pt-2.5 mt-1">
                    <span>Total Pembelian</span>
                    <span>Rp {selectedPO.total.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Transport logistics data */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest block">Informasi Armada Logistik</span>
                <div className="p-3.5 border border-gray-150 rounded-xl space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Metode Pengiriman</span>
                    <span className="font-bold text-gray-700">{selectedPO.logisticsNote || 'Truk Cargo Darat'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimasi Tiba</span>
                    <span className="font-bold text-gray-700">1-2 Hari Kerja</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center text-gray-400">
              <ShoppingCart className="w-8 h-8 text-gray-300 mb-1" />
              <p className="font-bold text-xs uppercase tracking-wider text-gray-500">Rincian Cargo PO</p>
              <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">Pilih salah satu nomor pesanan PO di sebelah kiri untuk melihat status bongkar muat.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-black text-xs uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> FORMULIR PENGAJUAN PESANAN PO BARU
                </span>
                <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Pilih Supplier Resmi</label>
                  <select 
                    value={newPOSupplier}
                    onChange={(e) => setNewPOSupplier(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-700 outline-none"
                  >
                    {suppliers.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Nama Bahan Bangunan yang Dipesan</label>
                  <input 
                    type="text"
                    required
                    placeholder="Contoh: Semen Portland Tiga Roda 50kg..."
                    value={newPOItemName}
                    onChange={(e) => setNewPOItemName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Jumlah Pasokan (Unit/Zak)</label>
                    <input 
                      type="number"
                      min={1}
                      value={newPOItemQuantity}
                      onChange={(e) => setNewPOItemQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-850 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Harga Beli per Unit (IDR)</label>
                    <input 
                      type="number"
                      min={1}
                      value={newPOItemPrice}
                      onChange={(e) => setNewPOItemPrice(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-850 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Instruksi Logistik Cargo</label>
                  <input 
                    type="text"
                    placeholder="Contoh: Bongkar muat malam hari dengan truk tronton..."
                    value={newPOLogistics}
                    onChange={(e) => setNewPOLogistics(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-medium text-gray-750 outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-gray-100 flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)}
                    className="w-full py-2.5 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/15 cursor-pointer"
                  >
                    Simpan Draft PO
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit PO Modal */}
        {showEditPOModal && selectedPO && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 text-xs"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="font-black text-xs uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" /> EDIT RINCIAN PESANAN PEMBELIAN ({selectedPO.poNumber})
                </span>
                <button onClick={() => setShowEditPOModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleEditPOSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Pemasok Bahan (Supplier)</label>
                  <select 
                    value={editPOSupplier}
                    onChange={(e) => setEditPOSupplier(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-750 outline-none"
                  >
                    {suppliers.map((sup, idx) => (
                      <option key={idx} value={sup.name}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Nama Bahan Bangunan / Material</label>
                  <input 
                    type="text"
                    required
                    placeholder="Contoh: Semen Portland Tiga Roda 50kg..."
                    value={editPOItemName}
                    onChange={(e) => setEditPOItemName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800 outline-none focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Jumlah Pasokan (Unit/Zak)</label>
                    <input 
                      type="number"
                      min={1}
                      value={editPOItemQuantity}
                      onChange={(e) => setEditPOItemQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-850 outline-none focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Harga Beli per Unit (IDR)</label>
                    <input 
                      type="number"
                      min={1}
                      value={editPOItemPrice}
                      onChange={(e) => setEditPOItemPrice(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-850 outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Instruksi Logistik Cargo</label>
                  <input 
                    type="text"
                    placeholder="Contoh: Bongkar muat malam hari dengan truk tronton..."
                    value={editPOLogistics}
                    onChange={(e) => setEditPOLogistics(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-medium text-gray-750 outline-none focus:bg-white"
                  />
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed bg-blue-50/40 p-3 rounded-lg border border-blue-100">
                  Perubahan rincian jumlah barang akan diakumulasikan ke total nilai transaksi, dan stok barang di gudang baru akan bertambah secara otomatis setelah Anda mengklik tombol <b>Konfirmasi Barang Diterima</b>.
                </p>

                <div className="pt-3 border-t border-gray-100 flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowEditPOModal(false)}
                    className="w-full py-2.5 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-500/15 cursor-pointer"
                  >
                    Simpan Perubahan PO
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
