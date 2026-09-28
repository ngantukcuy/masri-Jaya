import React from 'react';
import { Plus, Trash2, MoreVertical, Percent, CalendarDays } from 'lucide-react';
import { Product, Supplier, SkuLocation } from '../../../types';
import { useDialog } from '../../../components/shared/DialogProvider';
import NumberInput from '../../../components/shared/NumberInput';
import SearchableSelect from '../../../components/shared/SearchableSelect';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Checkbox } from '../../../components/ui/checkbox';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import type { IncomingProductForm } from '../ProductsView';

interface TambahProdukMasukModalProps {
  showIncomingModal: boolean;
  onOpenChange: (open: boolean) => void;
  dialog: ReturnType<typeof useDialog>;
  products: Product[];
  suppliers: Supplier[];
  skuLocations: SkuLocation[];

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
}

export default function TambahProdukMasukModal({
  showIncomingModal,
  onOpenChange,
  dialog,
  products,
  suppliers,
  skuLocations,
  incomingStep,
  setIncomingStep,
  handleSaveIncoming,
  incomingDate,
  setIncomingDate,
  incomingPoNumber,
  setIncomingPoNumber,
  incomingSupplier,
  setIncomingSupplier,
  incomingPaymentMethod,
  setIncomingPaymentMethod,
  incomingDueDate,
  setIncomingDueDate,
  incomingDeliveryNote,
  setIncomingDeliveryNote,
  incomingStatus,
  setIncomingStatus,
  incomingItems,
  setIncomingItems,
  getItemDiscount,
  updateIncomingItem,
  updateIncomingDiscount,
  openItemMenu,
  setOpenItemMenu,
  activeProductSearchIndex,
  setActiveProductSearchIndex,
  incomingProductSearch,
  setIncomingProductSearch,
  incomingAdditionalCosts,
  setIncomingAdditionalCosts,
  incomingAdditionalCost,
  incomingTotal,
}: TambahProdukMasukModalProps) {
  return (
    <Dialog open={showIncomingModal} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle><Plus className="w-4 h-4" /> Tambah Produk Masuk {incomingStep === 1 ? '- Data Pembelian' : '- Detail Produk'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSaveIncoming} className="space-y-4 text-xs">
          {incomingStep === 1 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Tanggal</Label><Input type="date" value={incomingDate} onChange={(event) => setIncomingDate(event.target.value)} required /></div>
                <div><Label>Nomor PO</Label><Input value={incomingPoNumber} onChange={(event) => setIncomingPoNumber(event.target.value)} placeholder="PO-2026-XXXX" required /></div>
                <div><Label>Supplier</Label><SearchableSelect value={incomingSupplier} onChange={setIncomingSupplier} options={suppliers.map((supplier) => ({ value: supplier.name, label: supplier.name }))} placeholder="Pilih pemasok" searchPlaceholder="Cari supplier..." /></div>
                <div><Label>Metode Bayar</Label><Select value={incomingPaymentMethod} onValueChange={(value) => setIncomingPaymentMethod(value as typeof incomingPaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Tunai</SelectItem><SelectItem value="Transfer">Transfer</SelectItem><SelectItem value="Tempo">Tempo</SelectItem></SelectContent></Select>{incomingPaymentMethod === 'Tempo' && <div className="mt-2"><Label htmlFor="incoming-due-date">Jatuh Tempo</Label><div className="relative"><CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input id="incoming-due-date" type="date" value={incomingDueDate} min={incomingDate} onChange={(event) => setIncomingDueDate(event.target.value)} className="pl-9" required /></div></div>}</div>
                <div><Label>No. Surat Jalan</Label><Input value={incomingDeliveryNote} onChange={(event) => setIncomingDeliveryNote(event.target.value)} placeholder="Nomor surat jalan pemasok" /></div>
                <div><Label>Status</Label><Select value={incomingStatus} onValueChange={(value) => setIncomingStatus(value as typeof incomingStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Received">Diterima</SelectItem><SelectItem value="In Transit">Dalam Perjalanan</SelectItem></SelectContent></Select></div>
              </div>
              <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-[10px] text-muted-foreground">Klik Lanjut untuk memasukkan detail produk, jumlah, harga, diskon, dan lokasi SKU.</div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button type="button" onClick={() => { if (!incomingDate || !incomingPoNumber.trim() || !incomingSupplier || (incomingPaymentMethod === 'Tempo' && !incomingDueDate)) { dialog.alert('Lengkapi tanggal, nomor PO, pemasok, dan tanggal jatuh tempo jika memilih Tempo.'); return; } setIncomingStep(2); }}>Lanjut</Button></DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {incomingItems.map((item, index) => {
                  const product = products.find((candidate) => candidate.sku === item.productSku);
                  const itemDiscount = getItemDiscount(item);
                  const discountedUnitPrice = Math.max(0, item.price - itemDiscount);
                  const itemTotal = item.bonus ? 0 : discountedUnitPrice * item.quantity;
                  return (
                    <div key={`${item.productSku}-${index}`} className="rounded-xl border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between"><p className="font-extrabold text-xs">Produk {index + 1}</p><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" title="Tambah diskon atau biaya tambahan" onClick={() => setOpenItemMenu(openItemMenu === index ? null : index)} className="h-7 w-7"><Plus className="w-4 h-4" /></Button><Button type="button" variant="ghost" size="icon" title="Menu produk" onClick={() => setOpenItemMenu(openItemMenu === index ? null : index)} className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>{incomingItems.length > 1 && <Button type="button" variant="ghost" size="icon" title="Hapus produk" onClick={() => setIncomingItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="h-7 w-7 text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>}</div></div>
                      {openItemMenu === index && <div className="flex flex-wrap gap-2 rounded-lg bg-muted/50 p-2"><Button type="button" size="sm" variant="outline" onClick={() => { updateIncomingItem(index, { discounts: [...item.discounts, { type: 'amount', value: 0 }] }); setOpenItemMenu(null); }}><Percent className="w-3 h-3" /> Tambah/Ubah Diskon</Button><Button type="button" size="sm" variant="outline" onClick={() => { setIncomingAdditionalCosts((costs) => [...costs, { name: '', amount: 0 }]); setOpenItemMenu(null); }}><Plus className="w-3 h-3" /> Tambah/Ubah Biaya Tambahan</Button></div>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative"><Label>Nama Produk</Label><Input value={activeProductSearchIndex === index ? incomingProductSearch : product?.name || ''} placeholder="Cari nama atau SKU produk..." onFocus={() => { setActiveProductSearchIndex(index); setIncomingProductSearch(product?.name || ''); }} onChange={(event) => { setActiveProductSearchIndex(index); setIncomingProductSearch(event.target.value); }} />{activeProductSearchIndex === index && incomingProductSearch && <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-44 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">{products.filter((candidate) => `${candidate.name} ${candidate.sku}`.toLowerCase().includes(incomingProductSearch.toLowerCase())).map((productItem) => <button type="button" key={productItem.sku} className="block w-full px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => { updateIncomingItem(index, { productSku: productItem.sku, price: productItem.costPrice ?? productItem.retailPrice ?? 0 }); setIncomingProductSearch(''); setActiveProductSearchIndex(null); }}><span className="font-bold">{productItem.name}</span><span className="block text-[10px] text-muted-foreground">{productItem.sku}</span></button>)}</div>}</div>
                        <div><Label>Qty</Label><NumberInput allowDecimal min={0.001} value={item.quantity} onChange={(value) => setIncomingItems((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: value } : current))} /></div>
                        <div><Label>Harga Modal (Rp)</Label><NumberInput min={0} value={item.price} disabled={item.bonus} onChange={(value) => updateIncomingItem(index, { price: value })} /></div>
                        <div className="sm:col-span-2"><Label>Diskon Satuan</Label>{item.discounts.map((discount, discountIndex) => <div key={discountIndex} className="flex gap-2 mt-1"><Select value={discount.type} onValueChange={(value) => updateIncomingDiscount(index, discountIndex, { type: value as 'percent' | 'amount' })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Persen (%)</SelectItem><SelectItem value="amount">Rupiah (Rp)</SelectItem></SelectContent></Select><NumberInput min={0} max={discount.type === 'percent' ? 100 : undefined} value={discount.value} onChange={(value) => updateIncomingDiscount(index, discountIndex, { value })} /><Button type="button" variant="ghost" size="icon" onClick={() => updateIncomingItem(index, { discounts: item.discounts.filter((_, currentIndex) => currentIndex !== discountIndex) })} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button></div>)}<Button type="button" variant="outline" size="sm" onClick={() => updateIncomingItem(index, { discounts: [...item.discounts, { type: 'amount', value: 0 }] })} className="mt-1"><Plus className="w-3 h-3" /> Tambah Diskon</Button></div>
                        <div><Label>Pilih Lokasi SKU</Label><Select value={item.locationId} onValueChange={(value) => updateIncomingItem(index, { locationId: value })}><SelectTrigger><SelectValue placeholder="Pilih lokasi" /></SelectTrigger><SelectContent>{skuLocations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="flex items-end"><label className="flex items-center gap-2 h-10 cursor-pointer"><Checkbox checked={item.taxIncluded} onCheckedChange={(checked) => updateIncomingItem(index, { taxIncluded: checked === true })} /><span className="font-bold">Sudah PPN</span></label><label className="flex items-center gap-2 h-10 ml-4 cursor-pointer"><Checkbox checked={item.bonus} onCheckedChange={(checked) => updateIncomingItem(index, { bonus: checked === true })} /><span className="font-bold text-amber-700">Bonus (Rp 0)</span></label></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border pt-2 text-[10px]"><div><span className="text-muted-foreground">Total Diskon</span><p className="font-black text-red-600">Rp {(itemDiscount * item.quantity).toLocaleString('id-ID')}</p></div><div><span className="text-muted-foreground">Harga Setelah Diskon</span><p className="font-black">Rp {item.bonus ? '0' : discountedUnitPrice.toLocaleString('id-ID')} / unit</p></div><div className="text-right"><span className="text-muted-foreground">Total Rp</span><p className="font-black text-primary">Rp {itemTotal.toLocaleString('id-ID')}</p></div></div>
                      {!product && <p className="text-[10px] text-red-500">Produk belum dipilih.</p>}
                    </div>
                  );
                })}
              </div>
              <Button type="button" variant="outline" onClick={() => setIncomingItems((items) => [...items, { productSku: '', quantity: 1, price: 0, taxIncluded: false, discounts: [], bonus: false, locationId: '' }])} className="w-full"><Plus className="w-3.5 h-3.5" /> Tambah Produk Lain</Button>
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"><div className="flex items-center justify-between"><p className="font-extrabold text-xs">Ringkasan Biaya Tambahan</p><Button type="button" variant="outline" size="sm" onClick={() => setIncomingAdditionalCosts((costs) => [...costs, { name: '', amount: 0 }])}><Plus className="w-3 h-3" /> Tambah Biaya</Button></div>{incomingAdditionalCosts.length === 0 && <p className="text-[10px] text-muted-foreground">Belum ada biaya tambahan.</p>}{incomingAdditionalCosts.map((cost, costIndex) => <div key={costIndex} className="flex gap-2"><Input value={cost.name} onChange={(event) => setIncomingAdditionalCosts((costs) => costs.map((current, index) => index === costIndex ? { ...current, name: event.target.value } : current))} placeholder="Label biaya, contoh: Ongkir" /><NumberInput min={0} value={cost.amount} onChange={(value) => setIncomingAdditionalCosts((costs) => costs.map((current, index) => index === costIndex ? { ...current, amount: value } : current))} /><Button type="button" variant="ghost" size="icon" onClick={() => setIncomingAdditionalCosts((costs) => costs.filter((_, index) => index !== costIndex))} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button></div>)}<div className="flex justify-between border-t border-border pt-2 font-black text-[11px]"><span>Total Biaya Tambahan</span><span>Rp {incomingAdditionalCost.toLocaleString('id-ID')}</span></div></div>
              <div className="flex justify-between rounded-lg bg-primary/5 p-3 font-black text-sm"><span>Total Pembelian</span><span className="text-primary">Rp {incomingTotal.toLocaleString('id-ID')}</span></div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setIncomingStep(1)}>Kembali</Button><Button type="submit">Simpan Produk Masuk</Button></DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
