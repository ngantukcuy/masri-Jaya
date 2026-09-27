import React from 'react';
import {
  Boxes,
  ChevronRight,
  Truck,
  Search,
  Plus,
  ShoppingCart,
  Edit3,
  Trash2,
  CheckCircle2,
  Eye,
  Check,
  Warehouse,
} from 'lucide-react';
import { PO, Supplier, Product } from '../../../types';
import PODetailDialog from '../../../components/shared/PODetailDialog';
import NumberInput from '../../../components/shared/NumberInput';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';

interface StokPemasokViewProps {
  pos: PO[];
  products: Product[];
  suppliers: Supplier[];
  previewPO: PO | null;
  setPreviewPO: (po: PO | null) => void;
  onBack: () => void;

  filterPOSupplier: string | null;
  setFilterPOSupplier: (supplier: string | null) => void;
  filterPODirect: 'all' | 'store' | 'customer';
  setFilterPODirect: (value: 'all' | 'store' | 'customer') => void;
  filterPOStatus: string;
  setFilterPOStatus: (value: string) => void;
  searchPOQuery: string;
  setSearchPOQuery: (value: string) => void;

  showCreatePOModal: boolean;
  setShowCreatePOModal: (open: boolean) => void;
  showEditPOModal: boolean;
  setShowEditPOModal: (open: boolean) => void;
  editingPO: PO | null;

  newPOSupplier: string;
  setNewPOSupplier: (value: string) => void;
  newPOItemName: string;
  setNewPOItemName: (value: string) => void;
  newPOItemQuantity: number;
  setNewPOItemQuantity: (value: number) => void;
  newPOItemPrice: number;
  setNewPOItemPrice: (value: number) => void;
  newPOLogistics: string;
  setNewPOLogistics: (value: string) => void;
  newPODirectToCustomer: boolean;
  setNewPODirectToCustomer: (value: boolean) => void;
  newPODirectCustomerName: string;
  setNewPODirectCustomerName: (value: string) => void;

  editPOSupplier: string;
  setEditPOSupplier: (value: string) => void;
  editPOItemName: string;
  setEditPOItemName: (value: string) => void;
  editPOItemQuantity: number;
  setEditPOItemQuantity: (value: number) => void;
  editPOItemPrice: number;
  setEditPOItemPrice: (value: number) => void;
  editPOLogistics: string;
  setEditPOLogistics: (value: string) => void;
  editPODirectToCustomer: boolean;
  setEditPODirectToCustomer: (value: boolean) => void;
  editPODirectCustomerName: string;
  setEditPODirectCustomerName: (value: string) => void;

  handleApprovePO: (po: PO) => void;
  handleReceiveGoodsPO: (po: PO) => void;
  handleDeletePO: (po: PO) => void;
  handleCreatePO: (e: React.FormEvent) => void;
  handleOpenEditPOModal: (po: PO) => void;
  handleEditPOSubmit: (e: React.FormEvent) => void;
}

export default function StokPemasokView({
  pos,
  products,
  suppliers,
  previewPO,
  setPreviewPO,
  onBack,
  filterPOSupplier,
  setFilterPOSupplier,
  filterPODirect,
  setFilterPODirect,
  filterPOStatus,
  setFilterPOStatus,
  searchPOQuery,
  setSearchPOQuery,
  showCreatePOModal,
  setShowCreatePOModal,
  showEditPOModal,
  setShowEditPOModal,
  editingPO,
  newPOSupplier,
  setNewPOSupplier,
  newPOItemName,
  setNewPOItemName,
  newPOItemQuantity,
  setNewPOItemQuantity,
  newPOItemPrice,
  setNewPOItemPrice,
  newPOLogistics,
  setNewPOLogistics,
  newPODirectToCustomer,
  setNewPODirectToCustomer,
  newPODirectCustomerName,
  setNewPODirectCustomerName,
  editPOSupplier,
  setEditPOSupplier,
  editPOItemName,
  setEditPOItemName,
  editPOItemQuantity,
  setEditPOItemQuantity,
  editPOItemPrice,
  setEditPOItemPrice,
  editPOLogistics,
  setEditPOLogistics,
  editPODirectToCustomer,
  setEditPODirectToCustomer,
  editPODirectCustomerName,
  setEditPODirectCustomerName,
  handleApprovePO,
  handleReceiveGoodsPO,
  handleDeletePO,
  handleCreatePO,
  handleOpenEditPOModal,
  handleEditPOSubmit,
}: StokPemasokViewProps) {
    const filteredSupplierPOs = pos.filter((po) => {
      if (filterPOSupplier && po.supplier !== filterPOSupplier) return false;
      if (filterPODirect === 'customer' && !po.directToCustomer) return false;
      if (filterPODirect === 'store' && po.directToCustomer) return false;
      if (filterPOStatus !== 'all' && po.status !== filterPOStatus) return false;
      if (searchPOQuery.trim()) {
        const q = searchPOQuery.toLowerCase();
        const matchNum = po.poNumber.toLowerCase().includes(q);
        const matchSup = po.supplier.toLowerCase().includes(q);
        const matchItem = po.items.some((i) => i.name.toLowerCase().includes(q));
        const matchCust = po.directToCustomerName?.toLowerCase().includes(q);
        if (!matchNum && !matchSup && !matchItem && !matchCust) return false;
      }
      return true;
    });

    const totalOutstandingPOAmount = pos.filter((p) => p.status !== 'Received').reduce((acc, p) => acc + p.total, 0);
    const totalInTransitPOs = pos.filter((p) => p.status === 'Ordered' || p.status === 'In Transit').length;
    const totalDirectPOs = pos.filter((p) => p.directToCustomer).length;

    const poStatusMap: Record<string, { label: string; cls: string }> = {
      Draft: { label: 'DRAFT', cls: 'bg-gray-100 text-gray-700' },
      Ordered: { label: 'DIPESAN', cls: 'bg-blue-50 text-blue-700' },
      'In Transit': { label: 'DIKIRIM', cls: 'bg-amber-50 text-amber-700' },
      Received: { label: 'SELESAI / DITERIMA', cls: 'bg-emerald-50 text-emerald-700 font-bold' },
    };

    return (
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground -ml-2 mb-1">
              <ChevronRight className="w-3.5 h-3.5 rotate-180 mr-1" /> Kembali ke Stok
            </Button>
            <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <Boxes className="w-6 h-6 text-pink-600" />
              Stok Pemasok &amp; Pesanan Pembelian (PO)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kelola pesanan material ke pabrik/pemasok dan tentukan pengiriman (ke toko atau langsung ke customer).
            </p>
          </div>
          <Button onClick={() => setShowCreatePOModal(true)} className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Buat Pesanan PO Baru</span>
          </Button>
        </div>

        {/* Procurements KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Outstanding PO Berjalan</p>
              <h4 className="text-lg font-black text-foreground mt-0.5">Rp {totalOutstandingPOAmount.toLocaleString('id-ID')}</h4>
              <p className="text-[10px] text-muted-foreground">{pos.filter((p) => p.status !== 'Received').length} pesanan belum diterima</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Dalam Perjalanan / Dipesan</p>
              <h4 className="text-lg font-black text-foreground mt-0.5">{totalInTransitPOs} Pesanan</h4>
              <p className="text-[10px] text-muted-foreground">Menunggu pengiriman kargo tiba</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Langsung ke Customer</p>
              <h4 className="text-lg font-black text-indigo-700 mt-0.5">{totalDirectPOs} Pesanan</h4>
              <p className="text-[10px] text-indigo-600/70">Tanpa singgah di gudang toko</p>
            </div>
          </Card>
        </div>

        {/* Toolbar: Search, Supplier Chips, Type Filter, Status Filter */}
        <Card className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nomor PO, supplier, barang, atau customer..."
                value={searchPOQuery}
                onChange={(e) => setSearchPOQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-lg text-xs font-medium outline-none focus:border-primary focus:bg-background"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Filter Tipe Pengiriman */}
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterPODirect('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    filterPODirect === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Semua Tipe
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPODirect('store')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    filterPODirect === 'store' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Gudang Toko
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPODirect('customer')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    filterPODirect === 'customer' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-600 hover:text-indigo-700'
                  }`}
                >
                  🚚 Direct Customer
                </button>
              </div>

              {/* Filter Status */}
              <select
                value={filterPOStatus}
                onChange={(e) => setFilterPOStatus(e.target.value)}
                className="bg-muted/40 border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none text-foreground"
              >
                <option value="all">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="Ordered">Dipesan</option>
                <option value="In Transit">Dikirim</option>
                <option value="Received">Diterima / Selesai</option>
              </select>
            </div>
          </div>

          {/* Supplier quick tabs */}
          <div className="flex gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none border-t border-border/50">
            <button
              onClick={() => setFilterPOSupplier(null)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterPOSupplier === null ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              Semua Penyuplai ({pos.length})
            </button>
            {suppliers.map((s) => {
              const count = pos.filter((p) => p.supplier === s.name).length;
              return (
                <button
                  key={s.name}
                  onClick={() => setFilterPOSupplier(s.name)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterPOSupplier === s.name ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {s.name} ({count})
                </button>
              );
            })}
          </div>
        </Card>

        {/* PO Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-bold">No. PO &amp; Tanggal</TableHead>
                  <TableHead className="text-xs font-bold">Supplier</TableHead>
                  <TableHead className="text-xs font-bold">Rincian Material</TableHead>
                  <TableHead className="text-xs font-bold">Tujuan Pengiriman</TableHead>
                  <TableHead className="text-xs font-bold text-right">Total Nilai</TableHead>
                  <TableHead className="text-xs font-bold text-center">Status</TableHead>
                  <TableHead className="text-xs font-bold text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSupplierPOs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      Tidak ada pesanan pembelian yang sesuai dengan filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSupplierPOs.map((po) => {
                    const st = poStatusMap[po.status] || { label: po.status, cls: 'bg-muted text-foreground' };
                    return (
                      <TableRow
                        key={po.poNumber}
                        onClick={() => setPreviewPO(po)}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        title="Klik untuk melihat rincian bon"
                      >
                        <TableCell className="py-3">
                          <p className="font-mono font-bold text-xs text-foreground">{po.poNumber}</p>
                          <p className="text-[11px] text-muted-foreground">{po.createdDate}</p>
                        </TableCell>
                        <TableCell className="py-3">
                          <p className="font-bold text-xs text-foreground">{po.supplier}</p>
                        </TableCell>
                        <TableCell className="py-3 max-w-xs">
                          {po.items.map((item, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="font-semibold text-foreground">{item.name}</span>
                              <span className="text-muted-foreground text-[11px] ml-1.5 font-mono">
                                ({item.quantity} unit @ Rp {item.price.toLocaleString('id-ID')})
                              </span>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="py-3">
                          {po.directToCustomer ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Truck className="w-3 h-3" /> Langsung ke Customer
                              </span>
                              {po.directToCustomerName && (
                                <p className="text-[11px] font-semibold text-indigo-900 truncate">
                                  {po.directToCustomerName}
                                </p>
                              )}
                              <p className="text-[9px] text-muted-foreground italic">Tidak masuk stok toko</p>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                <Warehouse className="w-3 h-3" /> Gudang Toko
                              </span>
                              <p className="text-[9px] text-muted-foreground">Masuk stok saat diterima</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <span className="font-bold text-xs text-foreground">
                            Rp {po.total.toLocaleString('id-ID')}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${st.cls}`}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Tombol Preview detail */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewPO(po)}
                              title="Lihat detail bon"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {/* Aksi Draft: Setujui, Edit, Hapus */}
                            {po.status === 'Draft' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprovePO(po)}
                                  className="h-7 px-2 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1"
                                >
                                  <Check className="w-3 h-3" /> Setujui
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEditPOModal(po)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  title="Edit draft PO"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePO(po)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Hapus draft PO"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}

                            {/* Aksi Ordered / In Transit: Terima / Selesaikan */}
                            {(po.status === 'Ordered' || po.status === 'In Transit') && (
                              <Button
                                size="sm"
                                onClick={() => handleReceiveGoodsPO(po)}
                                className={`h-7 px-2.5 text-[10px] font-bold gap-1 text-white shadow-xs ${
                                  po.directToCustomer
                                    ? 'bg-indigo-600 hover:bg-indigo-700'
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                                title={
                                  po.directToCustomer
                                    ? 'Selesaikan PO: Langsung diantar ke customer (tanpa masuk stok gudang)'
                                    : 'Terima barang ke stok toko'
                                }
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {po.directToCustomer ? 'Selesai (Diantar)' : 'Terima Gudang'}
                              </Button>
                            )}

                            {/* Aksi Received: status selesai */}
                            {po.status === 'Received' && (
                              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Modal Buat Pesanan Baru */}
        <Dialog open={showCreatePOModal} onOpenChange={setShowCreatePOModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Buat Pesanan Pembelian Baru (PO)
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Pilih Supplier / Penyuplai *
                </label>
                <select
                  required
                  value={newPOSupplier}
                  onChange={(e) => setNewPOSupplier(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg p-2.5 font-bold text-foreground outline-none"
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Nama Barang / Material *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pasir Cor 1 Dam, Semen Gresik 50kg, Bata Merah..."
                  value={newPOItemName}
                  onChange={(e) => setNewPOItemName(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg p-2.5 font-semibold text-foreground outline-none"
                />
                {products.length > 0 && !newPOItemName && (
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    <span className="text-[10px] text-muted-foreground">Pilih cepat:</span>
                    {products.slice(0, 4).map((p) => (
                      <button
                        type="button"
                        key={p.sku}
                        onClick={() => {
                          setNewPOItemName(p.name);
                          setNewPOItemPrice(p.costPrice || p.retailPrice || 100000);
                        }}
                        className="text-[10px] px-2 py-0.5 bg-muted rounded-md text-foreground/80 hover:bg-muted/80 font-medium"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Jumlah (Kuantitas) *
                  </label>
                  <NumberInput
                    min={1}
                    value={newPOItemQuantity}
                    onChange={setNewPOItemQuantity}
                    className="w-full bg-muted/40 border border-border rounded-lg p-2.5 font-bold text-foreground outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Harga Satuan (IDR) *
                  </label>
                  <NumberInput
                    min={100}
                    value={newPOItemPrice}
                    onChange={setNewPOItemPrice}
                    className="w-full bg-muted/40 border border-border rounded-lg p-2.5 font-bold text-foreground outline-none"
                  />
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between">
                <span className="font-bold text-muted-foreground">Total Estimasi Nilai PO:</span>
                <span className="text-sm font-black text-foreground">
                  Rp {(Number(newPOItemQuantity) * Number(newPOItemPrice)).toLocaleString('id-ID')}
                </span>
              </div>

              {/* OPSI PENGIRIMAN: Langsung ke Customer vs Gudang Toko */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-[10px] font-bold uppercase text-muted-foreground">
                  Tujuan Pengiriman Material
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setNewPODirectToCustomer(false)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      !newPODirectToCustomer
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="w-4 h-4 text-primary" />
                      <p className="font-bold text-xs text-foreground">Ke Gudang Toko</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Material masuk stok toko &amp; menambah persediaan saat diterima.
                    </p>
                  </div>

                  <div
                    onClick={() => setNewPODirectToCustomer(true)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      newPODirectToCustomer
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      <p className="font-bold text-xs text-indigo-900">Langsung ke Customer</p>
                    </div>
                    <p className="text-[10px] text-indigo-700/80 leading-tight">
                      Langsung diantar ke pembeli (mis. pasir 1 dam). Tidak menambah stok toko.
                    </p>
                  </div>
                </div>

                {newPODirectToCustomer && (
                  <div className="space-y-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950">
                    <p className="text-[11px] font-bold flex items-center gap-1.5 text-indigo-900">
                      <span>ℹ️</span> Pengiriman Langsung ke Customer
                    </p>
                    <p className="text-[10px] text-indigo-700 leading-relaxed">
                      Barang tidak akan singgah di toko, sehingga jumlah stok barang di toko <strong>tidak akan bertambah</strong>. Transaksi ini hanya mencatat pengeluaran/tagihan untuk membayar supplier.
                    </p>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-indigo-800 mb-1">
                        Nama / Alamat Customer Tujuan:
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Pak Budi (Proyek Perumahan Indah Kav. 12)"
                        value={newPODirectCustomerName}
                        onChange={(e) => setNewPODirectCustomerName(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs font-semibold text-gray-800 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Catatan Logistik / Armada (opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Truk Dam Hino Plat AB 1234 CD, supir Pak Anto..."
                  value={newPOLogistics}
                  onChange={(e) => setNewPOLogistics(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg p-2.5 text-xs text-foreground outline-none"
                />
              </div>

              <DialogFooter className="gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowCreatePOModal(false)}>
                  Batal
                </Button>
                <Button type="submit" className="font-bold">
                  Simpan Draft PO
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Edit PO */}
        <Dialog open={showEditPOModal} onOpenChange={setShowEditPOModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                Edit Pesanan Pembelian ({editingPO?.poNumber})
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditPOSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Pilih Supplier *
                </label>
                <select
                  required
                  value={editPOSupplier}
                  onChange={(e) => setEditPOSupplier(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg p-2.5 font-bold text-foreground outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Nama Barang / Material *
                </label>
                <input
                  type="text"
                  required
                  value={editPOItemName}
                  onChange={(e) => setEditPOItemName(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg p-2.5 font-semibold text-foreground outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Jumlah (Kuantitas) *
                  </label>
                  <NumberInput
                    min={1}
                    value={editPOItemQuantity}
                    onChange={setEditPOItemQuantity}
                    className="w-full bg-muted/40 border border-border rounded-lg p-2.5 font-bold text-foreground outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Harga Satuan (IDR) *
                  </label>
                  <NumberInput
                    min={100}
                    value={editPOItemPrice}
                    onChange={setEditPOItemPrice}
                    className="w-full bg-muted/40 border border-border rounded-lg p-2.5 font-bold text-foreground outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between">
                <span className="font-bold text-muted-foreground">Total Nilai PO:</span>
                <span className="text-sm font-black text-foreground">
                  Rp {(Number(editPOItemQuantity) * Number(editPOItemPrice)).toLocaleString('id-ID')}
                </span>
              </div>

              {/* Opsi Pengiriman Edit */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-[10px] font-bold uppercase text-muted-foreground">
                  Tujuan Pengiriman
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setEditPODirectToCustomer(false)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      !editPODirectToCustomer
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="w-4 h-4 text-primary" />
                      <p className="font-bold text-xs text-foreground">Ke Gudang Toko</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Masuk stok toko saat diterima.</p>
                  </div>

                  <div
                    onClick={() => setEditPODirectToCustomer(true)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      editPODirectToCustomer
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      <p className="font-bold text-xs text-indigo-900">Langsung ke Customer</p>
                    </div>
                    <p className="text-[10px] text-indigo-700/80">Tidak menambah stok toko.</p>
                  </div>
                </div>

                {editPODirectToCustomer && (
                  <div className="space-y-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-indigo-800 mb-1">
                        Nama / Alamat Customer Tujuan:
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Pak Budi (Proyek Melati)"
                        value={editPODirectCustomerName}
                        onChange={(e) => setEditPODirectCustomerName(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs font-semibold text-gray-800 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Catatan Logistik
                </label>
                <input
                  type="text"
                  value={editPOLogistics}
                  onChange={(e) => setEditPOLogistics(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg p-2.5 text-xs text-foreground outline-none"
                />
              </div>

              <DialogFooter className="gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowEditPOModal(false)}>
                  Batal
                </Button>
                <Button type="submit" className="font-bold">
                  Simpan Perubahan
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* PO Detail Dialog */}
        <PODetailDialog po={previewPO} onClose={() => setPreviewPO(null)} />
      </div>
    );
}
