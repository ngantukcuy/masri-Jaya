import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Product } from '../../../types';
import NumberInput from '../../../components/shared/NumberInput';
import SearchableSelect from '../../../components/shared/SearchableSelect';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Checkbox } from '../../../components/ui/checkbox';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';

interface StockOpnameModalProps {
  showAdjustmentModal: boolean;
  setShowAdjustmentModal: (open: boolean) => void;
  sortedProducts: Product[];
  handleExecuteAdjustment: (e: React.FormEvent) => void;
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
}

export default function StockOpnameModal({
  showAdjustmentModal,
  setShowAdjustmentModal,
  sortedProducts,
  handleExecuteAdjustment,
  adjustProductSku,
  setAdjustProductSku,
  adjustType,
  setAdjustType,
  adjustValue,
  setAdjustValue,
  adjustNotes,
  setAdjustNotes,
  adjustDirectApply,
  setAdjustDirectApply,
}: StockOpnameModalProps) {
  return (
    <Dialog open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <SlidersHorizontal className="w-4 h-4" /> PENYESUAIAN STOK MANUAL GUDANG
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs">
          <div>
            <Label>Pilih Bahan Bangunan (SKU)</Label>
            <SearchableSelect
              value={adjustProductSku}
              onChange={setAdjustProductSku}
              options={sortedProducts.map((p) => ({ value: p.sku, label: p.name, sublabel: p.sku }))}
              placeholder="Pilih produk..."
              searchPlaceholder="Cari nama atau SKU produk..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipe Penyesuaian</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Tambah Stok (+)</SelectItem>
                  <SelectItem value="remove">Kurangi Stok (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Jumlah Unit</Label>
              <NumberInput
                min={1}
                value={adjustValue}
                onChange={setAdjustValue}
                placeholder="0"
                className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
              />
            </div>
          </div>

          <div>
            <Label>Catatan (opsional)</Label>
            <Textarea
              rows={2}
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="Contoh: sack semen rusak saat bongkar muat"
            />
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-muted p-2.5 text-[10px] font-bold text-foreground cursor-pointer">
            <Checkbox
              checked={adjustDirectApply}
              onCheckedChange={(v) => setAdjustDirectApply(v === true)}
              className="mt-0.5"
            />
            <span>
              Terapkan Langsung (Mode Manajer) — stok langsung berubah tanpa perlu persetujuan. Jika tidak dicentang, pengajuan akan masuk ke daftar Stock Opname untuk disetujui manajer.
            </span>
          </label>

          <p className="text-[10px] text-muted-foreground leading-relaxed bg-primary/5 p-3 rounded-lg border border-primary/10">
            Operasi penyesuaian stok ini akan langsung memengaruhi saldo fisik material di gudang utama. Log aktivitas penyesuaian akan dicatat atas nama operator aktif.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" className="w-full" onClick={() => setShowAdjustmentModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="w-full">
              Terapkan Penyesuaian
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
