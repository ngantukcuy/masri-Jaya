import { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import NumberInput from '../../../components/shared/NumberInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../../components/ui/select';

interface AddProductModalProps {
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  categories: string[];
  name: string;
  onNameChange: (v: string) => void;
  sku: string;
  onSkuChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  unit: string;
  onUnitChange: (v: string) => void;
  retailPrice: number;
  onRetailPriceChange: (v: number) => void;
  wholesalePrice: number;
  onWholesalePriceChange: (v: number) => void;
  projectPrice: number;
  onProjectPriceChange: (v: number) => void;
  stock: number;
  onStockChange: (v: number) => void;
}

const numberInputClass =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20';

export default function AddProductModal({
  onClose,
  onSubmit,
  categories,
  name, onNameChange,
  sku, onSkuChange,
  category, onCategoryChange,
  unit, onUnitChange,
  retailPrice, onRetailPriceChange,
  wholesalePrice, onWholesalePriceChange,
  projectPrice, onProjectPriceChange,
  stock, onStockChange
}: AddProductModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm text-foreground normal-case tracking-normal">
            <Plus className="w-5 h-5" /> Tambah Barang Baru ke POS
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nama Barang</Label>
              <Input
                type="text"
                required
                placeholder="Contoh: Semen Tiga Roda"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
              />
            </div>
            <div>
              <Label>SKU</Label>
              <Input
                type="text"
                required
                placeholder="Contoh: SEMEN-TR"
                value={sku}
                onChange={(e) => onSkuChange(e.target.value)}
              />
            </div>
            <div>
              <Label>Kategori</Label>
              <Select value={category} onValueChange={onCategoryChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.filter((cat) => cat !== 'Semua Kategori').map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Satuan</Label>
              <Input
                type="text"
                placeholder="pcs / zak / meter"
                value={unit}
                onChange={(e) => onUnitChange(e.target.value)}
              />
            </div>
            <div>
              <Label>Harga Standard</Label>
              <NumberInput
                value={wholesalePrice}
                onChange={onWholesalePriceChange}
                placeholder="0"
                className={numberInputClass}
              />
            </div>
            <div>
              <Label>Harga Minimum</Label>
              <NumberInput
                value={projectPrice}
                max={wholesalePrice || undefined}
                onChange={onProjectPriceChange}
                placeholder="0"
                className={numberInputClass}
              />
            </div>
            <div>
              <Label>Stok Awal</Label>
              <NumberInput
                value={stock}
                onChange={onStockChange}
                placeholder="0"
                className={numberInputClass}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" className="flex-1">
              Simpan &amp; Masukkan ke Keranjang
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
