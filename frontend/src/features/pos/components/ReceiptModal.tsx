import { Printer, FileDown, Sparkles, Truck, Store } from 'lucide-react';
import { Dialog, DialogContent } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';

interface StoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
  taxId?: string;
}

interface ReceiptModalProps {
  onClose: () => void;
  onPrint: () => void;
  onPrintPDF: () => void;
  isPrintingAnim: boolean;
  isGeneratingPDF?: boolean;
  activePrinterName: string;
  // The order summary produced right after checkout. Kept loose (any) to match
  // the shape POSView builds it in — see handleCheckout / executeFinalCheckout.
  lastOrderDetails: any;
  cashierName?: string;
  storeProfile?: StoreProfileLite;
}

export default function ReceiptModal({ onClose, onPrint, onPrintPDF, isPrintingAnim, isGeneratingPDF, activePrinterName, lastOrderDetails, cashierName, storeProfile }: ReceiptModalProps) {
  const storeName = storeProfile?.storeName || 'Toko Saya';
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm p-6 font-mono text-xs text-muted-foreground print:p-0 print:shadow-none print:border-none print:static">
        {/* Printing paper feed animation wrapper */}
        <div className={`transition-all duration-500 ${isPrintingAnim ? 'animate-pulse scale-[0.99] border-t-4 border-primary' : ''}`}>
          <div className="text-center border-b border-dashed border-border pb-4">
            <span className="text-lg font-black text-foreground tracking-tight block">{storeName}</span>
            {storeProfile?.address && <span className="text-[10px] text-muted-foreground block mt-0.5">{storeProfile.address}</span>}
            {storeProfile?.phone && <span className="text-[10px] text-muted-foreground block mt-1">Tel: {storeProfile.phone}</span>}
            {storeProfile?.taxId && <span className="text-[10px] text-muted-foreground block mt-1">NPWP: {storeProfile.taxId}</span>}
          </div>

          <div className="space-y-1.5 text-[10px] py-3">
            <div className="flex justify-between">
              <span>INVOICE:</span>
              <span className="font-bold text-foreground">{lastOrderDetails.invoice}</span>
            </div>
            <div className="flex justify-between">
              <span>TANGGAL:</span>
              <span>{lastOrderDetails.date}</span>
            </div>
            <div className="flex justify-between">
              <span>PELANGGAN:</span>
              <span className="font-bold">{lastOrderDetails.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span>METODE:</span>
              <span className="font-bold uppercase text-primary">{lastOrderDetails.paymentMethod === 'Cash' ? 'TUNAI' : lastOrderDetails.paymentMethod === 'Split' ? 'BAYAR SEBAGIAN' : lastOrderDetails.paymentMethod}</span>
            </div>
            {lastOrderDetails.fulfillmentMethod && (
              <div className="flex justify-between">
                <span>PENGAMBILAN:</span>
                <span className="font-bold uppercase flex items-center gap-1">
                  {lastOrderDetails.fulfillmentMethod === 'Delivery' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                  {lastOrderDetails.fulfillmentMethod === 'Delivery' ? 'DIANTAR' : 'AMBIL SENDIRI'}
                </span>
              </div>
            )}
            {lastOrderDetails.fulfillmentMethod === 'Delivery' && lastOrderDetails.deliveryAddress && (
              <div className="flex justify-between gap-2">
                <span className="shrink-0">ALAMAT:</span>
                <span className="text-right">{lastOrderDetails.deliveryAddress}</span>
              </div>
            )}
          </div>

          {/* Items breaking list */}
          <div className="border-t border-b border-dashed border-border py-3 space-y-2">
            {lastOrderDetails.items.map((item: any, idx: number) => {
              const price = typeof item.customPrice === 'number' && item.customPrice > 0
                ? item.customPrice
                : item.selectedPriceType === 'retail' ? item.product.retailPrice :
                  item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice :
                  item.product.projectPrice;
              return (
                <div key={idx} className="flex justify-between text-[11px]">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-foreground truncate">{item.product.name}</p>
                    <p className="text-[9px] text-muted-foreground font-mono">
                      {item.quantity} x Rp {price.toLocaleString('id-ID')} ({item.product.unit})
                    </p>
                  </div>
                  <span className="font-bold text-foreground">Rp {(price * item.quantity).toLocaleString('id-ID')}</span>
                </div>
              );
            })}
          </div>

          {/* Summary Calculations */}
          <div className="space-y-1 text-right text-[11px] py-3">
            <div className="flex justify-between">
              <span>SUBTOTAL:</span>
              <span>Rp {lastOrderDetails.subtotal.toLocaleString('id-ID')}</span>
            </div>
            {lastOrderDetails.discount > 0 && (
              <div className="flex justify-between text-red-600 font-bold">
                <span>DISKON {lastOrderDetails.discountType === 'fixed' ? '(Rp)' : `(${lastOrderDetails.discountValue || 0}%)`}:</span>
                <span>-Rp {lastOrderDetails.discount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-xs text-foreground pt-2 border-t border-dashed border-border mt-1">
              <span>TOTAL AKHIR:</span>
              <span>Rp {lastOrderDetails.total.toLocaleString('id-ID')}</span>
            </div>
            {lastOrderDetails.paymentMethod === 'Cash' && typeof lastOrderDetails.cashReceived === 'number' && (
              <>
                <div className="flex justify-between pt-1">
                  <span>TUNAI DITERIMA:</span>
                  <span>Rp {lastOrderDetails.cashReceived.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600">
                  <span>KEMBALIAN:</span>
                  <span>Rp {(lastOrderDetails.changeAmount || 0).toLocaleString('id-ID')}</span>
                </div>
              </>
            )}
            {lastOrderDetails.paymentMethod === 'Split' && typeof lastOrderDetails.splitPaidAmount === 'number' && (
              <>
                <div className="flex justify-between pt-1">
                  <span>DIBAYAR SEKARANG:</span>
                  <span>Rp {lastOrderDetails.splitPaidAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-600">
                  <span>SISA (PIUTANG):</span>
                  <span>Rp {(lastOrderDetails.splitRemainingDebt || 0).toLocaleString('id-ID')}</span>
                </div>
              </>
            )}
          </div>

          {/* Loyalty Reward Information */}
          <div className="bg-primary/5 border border-primary/10 p-3 rounded-xl text-center text-[10px] space-y-1 print:hidden">
            <p className="font-extrabold text-primary flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> POIN LOYALITAS PELANGGAN
            </p>
            <p className="text-muted-foreground">Pelanggan mendapatkan <span className="font-bold text-primary">+{lastOrderDetails.pointsEarned} poin</span> baru.</p>
          </div>

          <div className="text-center pt-3 text-[9px] text-muted-foreground border-t border-dashed border-border mt-3">
            <p>{storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`}</p>
            <p className="mt-1">Kasir: {cashierName || 'Staff Aktif'}</p>
          </div>
        </div>

        {/* Actions Footer - Hidden during print */}
        <div className="pt-4 border-t border-border space-y-1.5 font-sans print:hidden">
          {isPrintingAnim && activePrinterName && (
            <p className="text-center text-[9px] text-muted-foreground">Mengirim ke {activePrinterName}...</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={onPrint} disabled={isPrintingAnim} className="w-full">
              <Printer className="w-4 h-4" />
              <span>{isPrintingAnim ? 'Mencetak...' : 'Cetak Thermal'}</span>
            </Button>
            <Button type="button" variant="secondary" onClick={onPrintPDF} disabled={isGeneratingPDF} className="w-full">
              <FileDown className="w-4 h-4" />
              <span>{isGeneratingPDF ? 'Membuat...' : 'Cetak PDF'}</span>
            </Button>
          </div>
          <Button type="button" onClick={onClose} className="w-full">
            Selesai
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
