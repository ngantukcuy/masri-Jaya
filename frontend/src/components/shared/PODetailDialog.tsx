import { PO } from '../../types';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';

export const PO_STATUS_LABEL: Record<PO['status'], string> = {
  Draft: 'Draft',
  Approved: 'Disetujui',
  Ordered: 'Dipesan',
  'In Transit': 'Dalam Perjalanan',
  Received: 'Diterima',
};

const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`;

function formatDate(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface PODetailDialogProps {
  po: PO | null;
  onClose: () => void;
}

/**
 * Preview isi bon/PO dari supplier: barang apa saja yang masuk, jumlah,
 * harga, diskon, biaya tambahan, dan total. Dipakai di halaman Stok
 * (Stok Supplier) dan halaman Pembayaran (Pembayaran ke Supplier).
 */
export default function PODetailDialog({ po, onClose }: PODetailDialogProps) {
  const items = po?.items ?? [];
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + (item.bonus ? 0 : Math.max(0, item.price - (item.discountPerUnit || 0)) * item.quantity),
    0
  );
  const additionalCost = po?.additionalCost || 0;

  return (
    <Dialog open={!!po} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        {po && (
          <>
            <DialogHeader>
              <DialogTitle>Isi Bon {po.poNumber}</DialogTitle>
              <DialogDescription>
                {po.supplier} · {formatDate(po.createdDate)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Status</p>
                <div className="mt-1">
                  <Badge variant={po.status === 'Received' ? 'success' : 'warning'}>{PO_STATUS_LABEL[po.status] || po.status}</Badge>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Metode Bayar</p>
                <p className="mt-1 font-semibold">{po.paymentMethod || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">No. Surat Jalan</p>
                <p className="mt-1 font-semibold">{po.deliveryNoteNumber || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Jatuh Tempo</p>
                <p className="mt-1 font-semibold">{po.paymentMethod === 'Tempo' ? formatDate(po.dueDate) : '-'}</p>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Barang</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Diskon</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="p-6 text-center text-muted-foreground">Bon ini belum memiliki rincian barang.</TableCell>
                    </TableRow>
                  ) : items.map((item, index) => {
                    const discount = item.discountPerUnit || 0;
                    const lineTotal = item.bonus ? 0 : Math.max(0, item.price - discount) * item.quantity;
                    return (
                      <TableRow key={`${item.sku}-${index}`}>
                        <TableCell>
                          <p className="font-bold">{item.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {item.sku}
                            {item.bonus && <span className="ml-1.5 text-emerald-600 font-bold">BONUS</span>}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                        <TableCell className="text-right">{rupiah(item.price)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{discount > 0 ? `- ${rupiah(discount)}` : '-'}</TableCell>
                        <TableCell className="text-right font-bold">{item.bonus ? 'Gratis' : rupiah(lineTotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 ml-auto w-full sm:w-72 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>{items.length} jenis barang · {totalQty} unit</span>
                <span>{rupiah(itemsSubtotal)}</span>
              </div>
              {additionalCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{po.additionalCostName || 'Biaya tambahan'}</span>
                  <span>+ {rupiah(additionalCost)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-black">
                <span>Total Bon</span>
                <span>{rupiah(po.total)}</span>
              </div>
            </div>

            {po.logisticsNote && (
              <p className="mt-4 text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3">Catatan: {po.logisticsNote}</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
