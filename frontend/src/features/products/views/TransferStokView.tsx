import { ChevronRight } from 'lucide-react';
import { Product, SkuLocation } from '../../../types';
import SearchableSelect from '../../../components/shared/SearchableSelect';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../../components/ui/select';

interface TransferStokViewProps {
  products: Product[];
  sortedProducts: Product[];
  skuLocations: SkuLocation[];
  transferSku: string;
  setTransferSku: (sku: string) => void;
  transferTargetLocationId: string;
  setTransferTargetLocationId: (id: string) => void;
  handleTransferStock: () => void;
  onBack: () => void;
}

export default function TransferStokView({
  products,
  sortedProducts,
  skuLocations,
  transferSku,
  setTransferSku,
  transferTargetLocationId,
  setTransferTargetLocationId,
  handleTransferStock,
  onBack,
}: TransferStokViewProps) {
  const currentProd = products.find((p) => p.sku === transferSku);
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground -ml-2">
        <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Kembali ke Stok
      </Button>
      <Card className="p-5 max-w-md space-y-4">
        <div>
          <Label>Pilih Produk</Label>
          <SearchableSelect
            value={transferSku}
            onChange={setTransferSku}
            options={sortedProducts.map((p) => ({ value: p.sku, label: p.name, sublabel: p.sku }))}
            placeholder="Pilih produk..."
            searchPlaceholder="Cari nama atau SKU produk..."
          />
        </div>
        {currentProd && (
          <p className="text-xs text-muted-foreground">Lokasi saat ini: <span className="font-bold text-foreground/80">{currentProd.warehouseLocation || '-'}</span> &middot; Stok: <span className="font-bold text-foreground/80">{currentProd.stock} {currentProd.unit}</span></p>
        )}
        <div>
          <Label>Lokasi Tujuan</Label>
          <Select value={transferTargetLocationId} onValueChange={setTransferTargetLocationId}>
            <SelectTrigger><SelectValue placeholder="Pilih lokasi tujuan..." /></SelectTrigger>
            <SelectContent>
              {skuLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {skuLocations.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-1">Belum ada data Lokasi SKU. Tambahkan dulu di menu Products &gt; Sku Master.</p>
          )}
        </div>
        <Button onClick={handleTransferStock} className="w-full" size="lg">
          Transfer Stok
        </Button>
      </Card>
    </div>
  );
}
