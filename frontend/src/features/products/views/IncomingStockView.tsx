import { ChevronRight, Plus } from 'lucide-react';
import { Product, PO } from '../../../types';
import PODetailDialog from '../../../components/shared/PODetailDialog';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/table';

interface IncomingStockViewProps {
  products: Product[];
  sortedProducts: Product[];
  receivedPOs: PO[];
  incomingTab: 'masuk' | 'eceran';
  setIncomingTab: (tab: 'masuk' | 'eceran') => void;
  previewPO: PO | null;
  setPreviewPO: (po: PO | null) => void;
  onBack: () => void;
  onTambahProdukMasuk: () => void;
}

export default function IncomingStockView({
  products,
  sortedProducts,
  receivedPOs,
  incomingTab,
  setIncomingTab,
  previewPO,
  setPreviewPO,
  onBack,
  onTambahProdukMasuk,
}: IncomingStockViewProps) {
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground -ml-2">
        <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Kembali ke Stok
      </Button>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground">Stok Supplier</h2>
          <p className="text-xs text-muted-foreground">Kelola produk masuk, harga eceran, dan stok aktual. Klik salah satu bon untuk melihat isinya.</p>
        </div>
        {incomingTab === 'masuk' && (
          <Button onClick={onTambahProdukMasuk} disabled={products.length === 0}>
            <Plus className="w-4 h-4" /> Tambah Produk Masuk
          </Button>
        )}
      </div>
      <Card className="p-0 overflow-hidden">
        <Tabs value={incomingTab} onValueChange={(value) => setIncomingTab(value as typeof incomingTab)}>
          <TabsList className="px-5 pt-4 bg-transparent rounded-none h-auto">
            <TabsTrigger value="masuk">Produk Masuk</TabsTrigger>
            <TabsTrigger value="eceran">Produk Eceran</TabsTrigger>
          </TabsList>
          <TabsContent value="masuk" className="p-5 mt-0">
            <div className="overflow-x-auto border border-border rounded-lg">
              <Table className="min-w-[850px]"><TableHeader><TableRow className="bg-muted/40">
                <TableHead>Tgl</TableHead><TableHead>Nomor PO</TableHead><TableHead className="text-right">Total Pembelian</TableHead><TableHead>Status</TableHead><TableHead>Pemasok</TableHead><TableHead>Metode Bayar</TableHead><TableHead>No. Surat Jalan</TableHead>
              </TableRow></TableHeader><TableBody>
                {receivedPOs.length === 0 ? <TableRow><TableCell colSpan={7} className="p-8 text-center text-xs text-muted-foreground">Belum ada produk masuk.</TableCell></TableRow> : receivedPOs.map((po) => (
                  <TableRow key={po.poNumber} onClick={() => setPreviewPO(po)} className="cursor-pointer" title="Klik untuk melihat isi bon"><TableCell className="text-xs whitespace-nowrap">{po.createdDate}</TableCell><TableCell className="font-mono font-bold text-xs">{po.poNumber}</TableCell><TableCell className="text-right font-bold text-xs">Rp {po.total.toLocaleString('id-ID')}</TableCell><TableCell><Badge variant={po.status === 'Received' ? 'success' : 'warning'}>{po.status === 'Received' ? 'Diterima' : 'Dalam Perjalanan'}</Badge></TableCell><TableCell className="text-xs font-semibold">{po.supplier}</TableCell><TableCell className="text-xs">{po.paymentMethod || '-'}</TableCell><TableCell className="text-xs">{po.deliveryNoteNumber || '-'}</TableCell></TableRow>
                ))}
              </TableBody></Table>
            </div>
          </TabsContent>
          <TabsContent value="eceran" className="p-5 mt-0">
            <div className="overflow-x-auto border border-border rounded-lg"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Produk</TableHead><TableHead>SKU</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Harga Eceran</TableHead><TableHead className="text-right">Stok</TableHead></TableRow></TableHeader><TableBody>
              {sortedProducts.map((product) => <TableRow key={product.sku}><TableCell className="font-bold text-xs">{product.name}</TableCell><TableCell className="font-mono text-xs">{product.sku}</TableCell><TableCell className="text-xs">{product.unit}</TableCell><TableCell className="text-right font-bold text-xs">Rp {product.retailPrice.toLocaleString('id-ID')}</TableCell><TableCell className="text-right text-xs">{product.stock}</TableCell></TableRow>)}
            </TableBody></Table></div>
          </TabsContent>
        </Tabs>
      </Card>
      <PODetailDialog po={previewPO} onClose={() => setPreviewPO(null)} />
    </div>
  );
}
