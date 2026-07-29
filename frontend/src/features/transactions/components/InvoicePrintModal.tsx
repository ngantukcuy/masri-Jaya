import { useState } from 'react';
import { Printer, FileDown, Truck, Store, X } from 'lucide-react';
import { motion } from 'motion/react';
import { SalesInvoice } from '../../../types';
import { generateInvoiceReceiptPDF, generateDeliveryNotePDF } from '../../pos/lib/receiptPdf';
import { getSupabaseTableCache } from '../../../lib/supabaseCache';

interface StoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
  taxId?: string;
}

interface PrinterLite {
  id: string;
  name: string;
}

interface InvoicePrintModalProps {
  invoice: SalesInvoice;
  docType: 'invoice' | 'delivery';
  onClose: () => void;
  storeProfile?: StoreProfileLite;
  cashierName?: string;
}

export default function InvoicePrintModal({ invoice, docType, onClose, storeProfile, cashierName }: InvoicePrintModalProps) {
  const [isPrintingAnim, setIsPrintingAnim] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [activePrinterName, setActivePrinterName] = useState('');
  const storeName = storeProfile?.storeName || 'Toko Saya';

  const subtotal = invoice.subtotal ?? invoice.items.reduce((acc, it) => acc + it.price * it.quantity, 0);

  const handlePrintThermal = () => {
    const registeredPrinters = getSupabaseTableCache<PrinterLite>('printers');
    const connectedPrinterName = registeredPrinters[0]?.name || 'Printer Kasir';
    setIsPrintingAnim(true);
    setActivePrinterName(connectedPrinterName);
    setTimeout(() => {
      setIsPrintingAnim(false);
      window.print();
    }, 1400);
  };

  const handlePrintPDF = () => {
    setIsGeneratingPDF(true);
    try {
      if (docType === 'invoice') {
        generateInvoiceReceiptPDF(invoice, storeProfile, cashierName);
      } else {
        generateDeliveryNotePDF(invoice, storeProfile);
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-[150] p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl space-y-4 font-mono text-xs text-gray-700 relative overflow-hidden print:p-0 print:shadow-none print:border-none print:static"
      >
        <div className={`transition-all duration-500 ${isPrintingAnim ? 'animate-pulse scale-[0.99] border-t-4 border-blue-600' : ''}`}>
          <div className="text-center border-b border-dashed border-gray-300 pb-4">
            <span className="text-lg font-black text-gray-900 tracking-tight block">{storeName}</span>
            {storeProfile?.address && <span className="text-[10px] text-gray-400 block mt-0.5">{storeProfile.address}</span>}
            {storeProfile?.phone && <span className="text-[10px] text-gray-400 block mt-1">Tel: {storeProfile.phone}</span>}
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mt-2">
              {docType === 'invoice' ? 'Struk Pembelian' : 'Struk Surat Jalan'}
            </span>
          </div>

          <div className="space-y-1.5 text-[10px] py-3">
            <div className="flex justify-between">
              <span>INVOICE:</span>
              <span className="font-bold text-gray-900">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>TANGGAL:</span>
              <span>{invoice.date}</span>
            </div>
            <div className="flex justify-between">
              <span>PELANGGAN:</span>
              <span className="font-bold">{invoice.customerName}</span>
            </div>
            {docType === 'invoice' && (
              <div className="flex justify-between">
                <span>METODE:</span>
                <span className="font-bold uppercase text-blue-600">{invoice.paymentMethod === 'Cash' ? 'TUNAI' : invoice.paymentMethod}</span>
              </div>
            )}
            {invoice.fulfillmentMethod && (
              <div className="flex justify-between">
                <span>PENGAMBILAN:</span>
                <span className="font-bold uppercase flex items-center gap-1">
                  {invoice.fulfillmentMethod === 'Delivery' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                  {invoice.fulfillmentMethod === 'Delivery' ? 'DIANTAR' : 'AMBIL SENDIRI'}
                </span>
              </div>
            )}
            {invoice.fulfillmentMethod === 'Delivery' && invoice.deliveryAddress && (
              <div className="flex justify-between gap-2">
                <span className="shrink-0">ALAMAT:</span>
                <span className="text-right">{invoice.deliveryAddress}</span>
              </div>
            )}
          </div>

          {/* Items list — struk pembelian shows harga, surat jalan only shows jumlah barang */}
          <div className="border-t border-b border-dashed border-gray-300 py-3 space-y-2">
            {invoice.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-bold text-gray-900 truncate">{item.name}</p>
                  <p className="text-[9px] text-gray-400 font-mono">
                    {item.quantity} {item.unit || ''}
                    {docType === 'invoice' && ` x Rp ${item.price.toLocaleString('id-ID')}`}
                  </p>
                </div>
                {docType === 'invoice' && (
                  <span className="font-bold text-gray-900">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                )}
              </div>
            ))}
          </div>

          {docType === 'invoice' ? (
            <div className="space-y-1 text-right text-[11px] py-3">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              {!!invoice.discountAmount && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>DISKON {invoice.discountType === 'fixed' ? '(Rp)' : `(${invoice.discountValue || 0}%)`}:</span>
                  <span>-Rp {invoice.discountAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs text-gray-900 pt-2 border-t border-dashed border-gray-200 mt-1">
                <span>TOTAL AKHIR:</span>
                <span>Rp {invoice.total.toLocaleString('id-ID')}</span>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-3 text-[10px] text-gray-600">
              <p>Barang di atas telah diperiksa dan diterima dalam kondisi baik serta sesuai jumlah.</p>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center space-y-8">
                  <p className="font-bold text-gray-800">Pengirim</p>
                  <p className="border-t border-gray-300 pt-1 text-[8px] text-gray-400">( Nama &amp; Tanggal )</p>
                </div>
                <div className="text-center space-y-8">
                  <p className="font-bold text-gray-800">Penerima</p>
                  <p className="border-t border-gray-300 pt-1 text-[8px] text-gray-400">( Nama &amp; Tanggal )</p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center pt-3 text-[9px] text-gray-400 border-t border-dashed border-gray-200 mt-3">
            {docType === 'invoice' ? (
              <>
                <p>{storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`}</p>
                <p className="mt-1">Kasir: {cashierName || 'Staff Aktif'}</p>
              </>
            ) : (
              <p>No: SJ-{invoice.invoiceNumber}</p>
            )}
            <p className="mt-1">(Cetak ulang dari Riwayat Transaksi)</p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="pt-4 border-t border-gray-100 space-y-1.5 font-sans print:hidden">
          {isPrintingAnim && activePrinterName && (
            <p className="text-center text-[9px] text-gray-400">Mengirim ke {activePrinterName}...</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrintThermal}
              disabled={isPrintingAnim}
              className="w-full flex items-center justify-center gap-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrintingAnim ? 'Mencetak...' : 'Cetak Thermal'}</span>
            </button>
            <button
              onClick={handlePrintPDF}
              disabled={isGeneratingPDF}
              className="w-full flex items-center justify-center gap-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{isGeneratingPDF ? 'Membuat...' : 'Cetak PDF'}</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-md"
          >
            <X className="w-3.5 h-3.5" />
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
}
