import { QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';

interface QRISModalProps {
  onClose: () => void;
  onConfirm: () => void;
  totalAmount: number;
  /** Public URL of the store's real QRIS code image, set once in
   * Pengaturan > Daftar Rekening (tipe QRIS). Falls back to a placeholder
   * icon when the store hasn't uploaded one yet. */
  qrisImageUrl?: string;
}

export default function QRISModal({ onClose, onConfirm, totalAmount, qrisImageUrl }: QRISModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="text-left">
          <DialogTitle>Pembayaran QRIS Otomatis</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <h4 className="font-black text-foreground text-sm">Pindai kode QR untuk membayar</h4>
          <p className="text-xs text-primary font-bold">Total: Rp {totalAmount.toLocaleString('id-ID')}</p>
        </div>

        {/* QR Code graphic — real store QRIS if uploaded in Pengaturan, otherwise placeholder */}
        {qrisImageUrl ? (
          <div className="w-52 h-52 bg-white border border-border rounded-2xl mx-auto mt-4 flex items-center justify-center overflow-hidden p-2">
            <img src={qrisImageUrl} alt="QRIS Toko" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-44 h-44 bg-muted border border-border rounded-2xl mx-auto mt-4 flex items-center justify-center relative overflow-hidden">
            <QrCode className="w-36 h-36 text-foreground" />
          </div>
        )}

        <p className="text-[10px] text-muted-foreground max-w-[220px] mx-auto mt-3">
          {qrisImageUrl
            ? 'Minta pelanggan memindai kode QRIS di atas dari aplikasi e-wallet/m-banking. Klik tombol otorisasi setelah pembayaran diterima.'
            : 'Belum ada kode QRIS toko. Tambahkan gambar QRIS di Pengaturan > Daftar Rekening. Klik tombol otorisasi untuk menyelesaikan transaksi.'}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            Otorisasi Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
