import { Printer, FileDown, Sparkles, Truck, Store } from 'lucide-react';
import { motion } from 'motion/react';

interface StoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
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
    <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-[150] p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4 font-mono text-xs text-gray-700 relative overflow-hidden print:p-0 print:shadow-none print:border-none print:static"
      >
        {/* Printing paper feed animation wrapper */}
        <div className={`transition-all duration-500 ${isPrintingAnim ? 'animate-pulse scale-[0.99] border-t-4 border-blue-600' : ''}`}>
          <div className="text-center border-b border-dashed border-gray-300 pb-4">
            <span className="text-lg font-black text-gray-900 tracking-tight block">{storeName}</span>
            {storeProfile?.address && <span className="text-[10px] text-gray-400 block mt-0.5">{storeProfile.address}</span>}
            {storeProfile?.phone && <span className="text-[10px] text-gray-400 block mt-1">Tel: {storeProfile.phone}</span>}
          </div>

          <div className="space-y-1.5 text-[10px] py-3">
            <div className="flex justify-between">
              <span>INVOICE:</span>
              <span className="font-bold text-gray-900">{lastOrderDetails.invoice}</span>
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
              <span className="font-bold uppercase text-blue-600">{lastOrderDetails.paymentMethod === 'Cash' ? 'TUNAI' : lastOrderDetails.paymentMethod}</span>
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
          <div className="border-t border-b border-dashed border-gray-300 py-3 space-y-2">
            {lastOrderDetails.items.map((item: any, idx: number) => {
              const price = item.selectedPriceType === 'retail' ? item.product.retailPrice :
                            item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice :
                            item.product.projectPrice;
              return (
                <div key={idx} className="flex justify-between text-[11px]">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-[9px] text-gray-400 font-mono">
                      {item.quantity} x Rp {price.toLocaleString('id-ID')} ({item.product.unit})
                    </p>
                  </div>
                  <span className="font-bold text-gray-900">Rp {(price * item.quantity).toLocaleString('id-ID')}</span>
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
            <div className="flex justify-between font-black text-xs text-gray-900 pt-2 border-t border-dashed border-gray-200 mt-1">
              <span>TOTAL AKHIR:</span>
              <span>Rp {lastOrderDetails.total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Loyalty Reward Information */}
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-center text-[10px] space-y-1 print:hidden">
            <p className="font-extrabold text-blue-600 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> POIN LOYALITAS PELANGGAN
            </p>
            <p className="text-gray-600">Pelanggan mendapatkan <span className="font-bold text-blue-600">+{lastOrderDetails.pointsEarned} poin</span> baru.</p>
          </div>

          <div className="text-center pt-3 text-[9px] text-gray-400 border-t border-dashed border-gray-200 mt-3">
            <p>{storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`}</p>
            <p className="mt-1">Kasir: {cashierName || 'Staff Aktif'}</p>
          </div>
        </div>

        {/* Actions Footer - Hidden during print */}
        <div className="pt-4 border-t border-gray-100 space-y-1.5 font-sans print:hidden">
          {isPrintingAnim && activePrinterName && (
            <p className="text-center text-[9px] text-gray-400">Mengirim ke {activePrinterName}...</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onPrint}
              disabled={isPrintingAnim}
              className="w-full flex items-center justify-center gap-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrintingAnim ? "Mencetak..." : "Cetak Thermal"}</span>
            </button>
            <button
              onClick={onPrintPDF}
              disabled={isGeneratingPDF}
              className="w-full flex items-center justify-center gap-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{isGeneratingPDF ? "Membuat..." : "Cetak PDF"}</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-md"
          >
            Selesai
          </button>
        </div>
      </motion.div>
    </div>
  );
}
