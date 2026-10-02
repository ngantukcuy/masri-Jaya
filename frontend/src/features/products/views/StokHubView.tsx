import React from 'react';
import {
  Boxes,
  Warehouse,
  ChevronRight,
  Truck,
  SlidersHorizontal,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { Product, PO } from '../../../types';
import PODetailDialog from '../../../components/shared/PODetailDialog';
import { useDialog } from '../../../components/shared/DialogProvider';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/table';
import TambahProdukMasukModal from './TambahProdukMasukModal';
import StockOpnameModal from './StockOpnameModal';
import type { IncomingProductForm } from '../ProductsView';

type StokView = 'hub' | 'list' | 'pemasok' | 'transfer' | 'incoming';
type RightPanelTab = 'menipis' | 'opname' | 'terlaris' | 'baru-masuk';

interface StokHubViewProps {
  setStokView: (view: StokView) => void;
  can: (key: string) => boolean;
  dialog: ReturnType<typeof useDialog>;
  pos: PO[];
  pendingOpnameCount: number;

  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;
  lowStockList: Product[];
  sedangOpnameList: Product[];
  terlarisList: { product: Product; qty: number }[];

  incomingTab: 'masuk' | 'eceran';
  setIncomingTab: (tab: 'masuk' | 'eceran') => void;
  openIncomingModal: () => void;
  products: Product[];
  sortedProducts: Product[];
  receivedPOs: PO[];
  previewPO: PO | null;
  setPreviewPO: (po: PO | null) => void;

  showAdjustmentModal: boolean;
  setShowAdjustmentModal: (open: boolean) => void;

  // Tambah Produk Masuk modal (pass-through)
  showIncomingModal: boolean;
  onIncomingOpenChange: (open: boolean) => void;
  suppliers: import('../../../types').Supplier[];
  skuLocations: import('../../../types').SkuLocation[];
  incomingStep: 1 | 2;
  setIncomingStep: (step: 1 | 2) => void;
  handleSaveIncoming: (event: React.FormEvent) => void;
  incomingDate: string;
  setIncomingDate: (value: string) => void;
  incomingPoNumber: string;
  setIncomingPoNumber: (value: string) => void;
  incomingSupplier: string;
  setIncomingSupplier: (value: string) => void;
  incomingPaymentMethod: 'Cash' | 'Transfer' | 'Tempo';
  setIncomingPaymentMethod: (value: 'Cash' | 'Transfer' | 'Tempo') => void;
  incomingDueDate: string;
  setIncomingDueDate: (value: string) => void;
  incomingDeliveryNote: string;
  setIncomingDeliveryNote: (value: string) => void;
  incomingStatus: 'Received' | 'In Transit';
  setIncomingStatus: (value: 'Received' | 'In Transit') => void;
  incomingItems: IncomingProductForm[];
  setIncomingItems: React.Dispatch<React.SetStateAction<IncomingProductForm[]>>;
  getItemDiscount: (item: IncomingProductForm) => number;
  updateIncomingItem: (index: number, changes: Partial<IncomingProductForm>) => void;
  updateIncomingDiscount: (itemIndex: number, discountIndex: number, changes: Partial<IncomingProductForm['discounts'][number]>) => void;
  openItemMenu: number | null;
  setOpenItemMenu: (index: number | null) => void;
  activeProductSearchIndex: number | null;
  setActiveProductSearchIndex: (index: number | null) => void;
  incomingProductSearch: string;
  setIncomingProductSearch: (value: string) => void;
  incomingAdditionalCosts: { name: string; amount: number }[];
  setIncomingAdditionalCosts: React.Dispatch<React.SetStateAction<{ name: string; amount: number }[]>>;
  incomingAdditionalCost: number;
  incomingTotal: number;

  // Stock Opname modal (pass-through)
  adjustProductSku: string;
  setAdjustProductSku: (sku: string) => void;
  adjustType: 'add' | 'remove';
  setAdjustType: (type: 'add' | 'remove') => void;
  adjustValue: number;
  setAdjustValue: (value: number) => void;
  adjustNotes: string;
  setAdjustNotes: (notes: string) => void;
  adjustDirectApply: boolean;
  setAdjustDirectApply: (value: boolean) => void;
  handleExecuteAdjustment: (e: React.FormEvent) => void;
}

export default function StokHubView(props: StokHubViewProps) {
  const {
    setStokView, can, dialog, pos, pendingOpnameCount,
    rightPanelTab, setRightPanelTab, lowStockList, sedangOpnameList, terlarisList,
    incomingTab, setIncomingTab, openIncomingModal, products, sortedProducts, receivedPOs,
    previewPO, setPreviewPO, showAdjustmentModal, setShowAdjustmentModal,
    showIncomingModal, onIncomingOpenChange,
  } = props;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Pengaturan Stok */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <div className="space-y-3">
              <Card
                onClick={() => setStokView('list')}
                className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Warehouse className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-foreground">Stok Produk</p>
                  <p className="text-xs text-muted-foreground">Stok yang ada di lokasi SKU secara keseluruhan</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
              </Card>

              <Card
                onClick={() => setStokView('incoming')}
                className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm text-foreground">Stok Supplier</p>
                  <p className="text-xs text-muted-foreground">Barang yang baru dianter pemasok, 3 hari terakhir</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
              </Card>

              <Card
                onClick={() => setStokView('pemasok')}
                className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5 text-pink-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-foreground">Stok Pemasok &amp; Pesanan PO ({pos.filter((p) => p.status !== 'Received').length})</p>
                  <p className="text-xs text-muted-foreground">Pesanan material ke supplier (ke toko / direct customer)</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
              </Card>

              <Card
                onClick={() => can('manage_product_update') ? setShowAdjustmentModal(true) : dialog.alert('Anda tidak memiliki izin untuk mengajukan Stock Opname.')}
                className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-foreground">Stok Opname ({pendingOpnameCount})</p>
                  <p className="text-xs text-muted-foreground">Stok ketersediaan yang disimpan perusahaan.</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
              </Card>

              <Card
                onClick={() => setStokView('transfer')}
                className="flex-row items-center gap-4 p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
                  <ChevronRight className="w-5 h-5 text-cyan-600 rotate-45" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-foreground">Transfer Stok</p>
                  <p className="text-xs text-muted-foreground">Transfer stok dari lokasi SKU satu ke lokasi SKU lain.</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
              </Card>
            </div>
          </div>

          {pendingOpnameCount > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-3">Menunggu Persetujuan</h3>
              <Card
                onClick={() => setStokView('list')}
                className="flex-row items-center gap-4 p-4 cursor-pointer border-amber-200 hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-foreground">Persetujuan Stok Opname</p>
                  <p className="text-xs text-muted-foreground">Persetujuan atas perubahan stok</p>
                </div>
                <Badge variant="warning" className="ml-auto shrink-0">{pendingOpnameCount} Pending</Badge>
              </Card>
            </div>
          )}
        </div>

        {/* Right: Tabs list */}
        <Card className="lg:col-span-7 p-0 overflow-hidden gap-0">
          <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as any)}>
            <TabsList className="px-4 pt-3 bg-transparent rounded-none h-auto">
              <TabsTrigger value="menipis">Stok Menipis</TabsTrigger>
              <TabsTrigger value="opname">Sedang Stok Opname</TabsTrigger>
              <TabsTrigger value="terlaris">Terlaris di Bulan Ini</TabsTrigger>
            </TabsList>

            <TabsContent value="menipis" className="mt-0">
              <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                {lowStockList.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">Tidak ada produk dengan stok menipis/habis.</p>
                ) : (
                  lowStockList.map((p) => (
                    <div key={p.sku} className="flex items-center gap-3 p-4">
                      <div className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Boxes className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Badge variant="destructive" className="mb-1">{p.stock <= 0 ? 'Stok Habis' : 'Stok Menipis'}</Badge>
                        <p className="font-extrabold text-xs text-foreground truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">Tersisa {p.stock} {p.unit} &middot; {p.warehouseLocation || '-'}</p>
                      </div>
                      <p className="font-black text-xs text-foreground shrink-0">Rp {p.retailPrice.toLocaleString('id-ID')}</p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="baru-masuk" className="mt-0">
              <Tabs value={incomingTab} onValueChange={(value) => setIncomingTab(value as typeof incomingTab)}>
                <div className="flex items-center justify-between gap-3 px-4 pt-3">
                  <TabsList className="bg-muted/60">
                    <TabsTrigger value="masuk">Produk Masuk</TabsTrigger>
                    <TabsTrigger value="eceran">Produk Eceran</TabsTrigger>
                  </TabsList>
                  {incomingTab === 'masuk' && (
                    <Button size="sm" onClick={openIncomingModal}>
                      <Plus className="w-3.5 h-3.5" /> Tambah Produk Masuk
                    </Button>
                  )}
                </div>

                <TabsContent value="masuk" className="mt-3 px-4 pb-4">
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <Table className="min-w-[850px]">
                      <TableHeader><TableRow className="bg-muted/40">
                        <TableHead>Tgl</TableHead><TableHead>Nomor PO</TableHead><TableHead className="text-right">Total Pembelian</TableHead><TableHead>Status</TableHead><TableHead>Pemasok</TableHead><TableHead>Metode Bayar</TableHead><TableHead>No. Surat Jalan</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {receivedPOs.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="p-6 text-center text-xs text-muted-foreground">Belum ada produk masuk.</TableCell></TableRow>
                        ) : receivedPOs.map((po) => (
                          <TableRow key={po.poNumber} onClick={() => setPreviewPO(po)} className="cursor-pointer" title="Klik untuk melihat isi bon">
                            <TableCell className="text-xs whitespace-nowrap">{po.createdDate}</TableCell>
                            <TableCell className="font-mono font-bold text-xs">{po.poNumber}</TableCell>
                            <TableCell className="text-right font-bold text-xs">Rp {po.total.toLocaleString('id-ID')}</TableCell>
                            <TableCell><Badge variant={po.status === 'Received' ? 'success' : 'warning'}>{po.status === 'Received' ? 'Diterima' : 'Dalam Perjalanan'}</Badge></TableCell>
                            <TableCell className="text-xs font-semibold">{po.supplier}</TableCell>
                            <TableCell className="text-xs">{po.paymentMethod || '-'}</TableCell>
                            <TableCell className="text-xs">{po.deliveryNoteNumber || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="eceran" className="mt-3 px-4 pb-4">
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <Table className="min-w-[650px]">
                      <TableHeader><TableRow className="bg-muted/40"><TableHead>Produk</TableHead><TableHead>SKU</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Harga Eceran</TableHead><TableHead className="text-right">Stok</TableHead></TableRow></TableHeader>
                      <TableBody>{sortedProducts.length === 0 ? <TableRow><TableCell colSpan={5} className="p-6 text-center text-xs text-muted-foreground">Belum ada produk.</TableCell></TableRow> : sortedProducts.map((product) => (
                        <TableRow key={product.sku}><TableCell className="font-bold text-xs">{product.name}</TableCell><TableCell className="font-mono text-xs">{product.sku}</TableCell><TableCell className="text-xs">{product.unit}</TableCell><TableCell className="text-right font-bold text-xs">Rp {product.retailPrice.toLocaleString('id-ID')}</TableCell><TableCell className="text-right text-xs">{product.stock}</TableCell></TableRow>
                      ))}</TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="aktual" className="mt-3 px-4 pb-4">
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <Table className="min-w-[700px]">
                      <TableHeader><TableRow className="bg-muted/40"><TableHead>Produk</TableHead><TableHead>SKU</TableHead><TableHead>Lokasi SKU</TableHead><TableHead className="text-right">Stok Aktual</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>{sortedProducts.length === 0 ? <TableRow><TableCell colSpan={5} className="p-6 text-center text-xs text-muted-foreground">Belum ada stok.</TableCell></TableRow> : sortedProducts.map((product) => (
                        <TableRow key={product.sku}><TableCell className="font-bold text-xs">{product.name}</TableCell><TableCell className="font-mono text-xs">{product.sku}</TableCell><TableCell className="text-xs">{product.warehouseLocation || '-'}</TableCell><TableCell className="text-right font-black text-xs">{product.stock} {product.unit}</TableCell><TableCell><Badge variant={product.stockStatus === 'Healthy' ? 'success' : product.stockStatus === 'Low Stock' ? 'warning' : 'destructive'}>{product.stockStatus === 'Healthy' ? 'Aman' : product.stockStatus === 'Low Stock' ? 'Menipis' : 'Habis'}</Badge></TableCell></TableRow>
                      ))}</TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="opname" className="mt-0">
              <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                {sedangOpnameList.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">Tidak ada produk yang sedang diajukan Stock Opname.</p>
                ) : (
                  sedangOpnameList.map((p) => (
                    <div key={p.sku} className="flex items-center gap-3 p-4">
                      <div className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Boxes className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Badge className="mb-1 bg-sky-500">Menunggu Persetujuan</Badge>
                        <p className="font-extrabold text-xs text-foreground truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">Stok saat ini {p.stock} {p.unit} &middot; {p.warehouseLocation || '-'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="terlaris" className="mt-0">
              <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                {terlarisList.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">Belum ada data penjualan bulan ini.</p>
                ) : (
                  terlarisList.map(({ product: p, qty }) => (
                    <div key={p.sku} className="flex items-center gap-3 p-4">
                      <div className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Boxes className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-xs text-foreground truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">Terjual {qty} {p.unit} bulan ini</p>
                      </div>
                      <p className="font-black text-xs text-foreground shrink-0">Rp {p.retailPrice.toLocaleString('id-ID')}</p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <PODetailDialog po={previewPO} onClose={() => setPreviewPO(null)} />

      {/* Penerimaan produk masuk: langkah pertama menyimpan header PO, langkah kedua menyimpan item dan lokasi SKU. */}
      <TambahProdukMasukModal
        showIncomingModal={showIncomingModal}
        onOpenChange={onIncomingOpenChange}
        dialog={dialog}
        products={products}
        suppliers={props.suppliers}
        skuLocations={props.skuLocations}
        incomingStep={props.incomingStep}
        setIncomingStep={props.setIncomingStep}
        handleSaveIncoming={props.handleSaveIncoming}
        incomingDate={props.incomingDate}
        setIncomingDate={props.setIncomingDate}
        incomingPoNumber={props.incomingPoNumber}
        setIncomingPoNumber={props.setIncomingPoNumber}
        incomingSupplier={props.incomingSupplier}
        setIncomingSupplier={props.setIncomingSupplier}
        incomingPaymentMethod={props.incomingPaymentMethod}
        setIncomingPaymentMethod={props.setIncomingPaymentMethod}
        incomingDueDate={props.incomingDueDate}
        setIncomingDueDate={props.setIncomingDueDate}
        incomingDeliveryNote={props.incomingDeliveryNote}
        setIncomingDeliveryNote={props.setIncomingDeliveryNote}
        incomingStatus={props.incomingStatus}
        setIncomingStatus={props.setIncomingStatus}
        incomingItems={props.incomingItems}
        setIncomingItems={props.setIncomingItems}
        getItemDiscount={props.getItemDiscount}
        updateIncomingItem={props.updateIncomingItem}
        updateIncomingDiscount={props.updateIncomingDiscount}
        openItemMenu={props.openItemMenu}
        setOpenItemMenu={props.setOpenItemMenu}
        activeProductSearchIndex={props.activeProductSearchIndex}
        setActiveProductSearchIndex={props.setActiveProductSearchIndex}
        incomingProductSearch={props.incomingProductSearch}
        setIncomingProductSearch={props.setIncomingProductSearch}
        incomingAdditionalCosts={props.incomingAdditionalCosts}
        setIncomingAdditionalCosts={props.setIncomingAdditionalCosts}
        incomingAdditionalCost={props.incomingAdditionalCost}
        incomingTotal={props.incomingTotal}
      />

      {/* Adjustment / Stock Opname Modal (dipakai dari kartu "Stok Opname") */}
      <StockOpnameModal
        showAdjustmentModal={showAdjustmentModal}
        setShowAdjustmentModal={setShowAdjustmentModal}
        sortedProducts={sortedProducts}
        handleExecuteAdjustment={props.handleExecuteAdjustment}
        adjustProductSku={props.adjustProductSku}
        setAdjustProductSku={props.setAdjustProductSku}
        adjustType={props.adjustType}
        setAdjustType={props.setAdjustType}
        adjustValue={props.adjustValue}
        setAdjustValue={props.setAdjustValue}
        adjustNotes={props.adjustNotes}
        setAdjustNotes={props.setAdjustNotes}
        adjustDirectApply={props.adjustDirectApply}
        setAdjustDirectApply={props.setAdjustDirectApply}
      />
    </div>
  );
}
