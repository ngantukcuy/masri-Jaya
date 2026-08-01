import { useState } from 'react';
import { Printer, FileDown, Truck, Store, X, CheckSquare, Square, ArrowLeft } from 'lucide-react';
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

  // For surat jalan, let the user pick which items are actually being sent out
  // before printing — a single transaksi is often delivered in more than one trip.
  const [selectedItemIdx, setSelectedItemIdx] = useState<Set<number>>(
    () => new Set(invoice.items.map((_, idx) => idx))
  );
  const [pickerStep, setPickerStep] = useState(docType === 'delivery');

  const toggleItem = (idx: number) => {
    setSelectedItemIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedItemIdx((prev) =>
      prev.size === invoice.items.length ? new Set() : new Set(invoice.items.map((_, idx) => idx))
    );
  };

  const deliveryItems =
    docType === 'delivery' ? invoice.items.filter((_, idx) => selectedItemIdx.has(idx)) : invoice.items;
  const printableInvoice: SalesInvoice = docType === 'delivery' ? { ...invoice, items: deliveryItems } : invoice;

  const subtotal = printableInvoice.subtotal ?? printableInvoice.items.reduce((acc, it) => acc + it.price * it.quantity, 0);

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

  const handlePrintPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      if (docType === 'invoice') {
        await generateInvoiceReceiptPDF(invoice, storeProfile, cashierName);
      } else {
        await generateDeliveryNotePDF(invoice, storeProfile, deliveryItems);
      }
    } catch (err) {
      console.error('[InvoicePrintModal] Gagal membuat/membagikan PDF:', err);
      window.alert('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (pickerStep) {
    return (
      <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-[150] p-4 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl max-w-sm w-full p-5 border border-gray-200 shadow-2xl space-y-4 font-sans text-xs text-gray-700"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h4 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-600" /> Pilih Barang yang Diantar
            </h4>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Centang barang yang benar-benar dibawa dalam pengiriman ini. Berguna kalau satu transaksi diantar bertahap.
          </p>
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 cursor-pointer"
          >
            {selectedItemIdx.size === invoice.items.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            Pilih Semua
          </button>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {invoice.items.map((item, idx) => {
              const checked = selectedItemIdx.has(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleItem(idx)}
                  className="w-full flex items-center gap-2.5 p-2.5 text-left hover:bg-gray-50 cursor-pointer"
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0">
                    <p className={`truncate font-semibold ${checked ? 'text-gray-900' : 'text-gray-400'}`}>{item.name}</p>
                    <p className="text-[10px] text-gray-400">{item.quantity} {item.unit || ''}</p>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPickerStep(false)}
            disabled={selectedItemIdx.size === 0}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            Lanjut ke Cetak ({selectedItemIdx.size} barang)
          </button>
        </motion.div>
      </div>
    );
  }

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
              <span className="font-bold text-gray-900">{printableInvoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>TANGGAL:</span>
              <span>{printableInvoice.date}</span>
            </div>
            <div className="flex justify-between">
              <span>PELANGGAN:</span>
              <span className="font-bold">{printableInvoice.customerName}</span>
            </div>
            {docType === 'invoice' && (
              <div className="flex justify-between">
                <span>METODE:</span>
                <span className="font-bold uppercase text-blue-600">{printableInvoice.paymentMethod === 'Cash' ? 'TUNAI' : printableInvoice.paymentMethod}</span>
              </div>
            )}
            {printableInvoice.fulfillmentMethod && (
              <div className="flex justify-between">
                <span>PENGAMBILAN:</span>
                <span className="font-bold uppercase flex items-center gap-1">
                  {printableInvoice.fulfillmentMethod === 'Delivery' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                  {printableInvoice.fulfillmentMethod === 'Delivery' ? 'DIANTAR' : 'AMBIL SENDIRI'}
                </span>
              </div>
            )}
            {printableInvoice.fulfillmentMethod === 'Delivery' && printableInvoice.deliveryAddress && (
              <div className="flex justify-between gap-2">
                <span className="shrink-0">ALAMAT:</span>
                <span className="text-right">{printableInvoice.deliveryAddress}</span>
              </div>
            )}
          </div>

          {/* Items list — struk pembelian shows harga, surat jalan only shows jumlah barang */}
          <div className="border-t border-b border-dashed border-gray-300 py-3 space-y-2">
            {printableInvoice.items.map((item, idx) => (
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
              {!!printableInvoice.discountAmount && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>DISKON {printableInvoice.discountType === 'fixed' ? '(Rp)' : `(${printableInvoice.discountValue || 0}%)`}:</span>
                  <span>-Rp {printableInvoice.discountAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs text-gray-900 pt-2 border-t border-dashed border-gray-200 mt-1">
                <span>TOTAL AKHIR:</span>
                <span>Rp {printableInvoice.total.toLocaleString('id-ID')}</span>
              </div>
              {printableInvoice.paymentMethod === 'Cash' && typeof printableInvoice.cashReceived === 'number' && (
                <>
                  <div className="flex justify-between pt-1">
                    <span>TUNAI DITERIMA:</span>
                    <span>Rp {printableInvoice.cashReceived.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>KEMBALIAN:</span>
                    <span>Rp {(printableInvoice.changeAmount || 0).toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
              {printableInvoice.paymentMethod === 'Split' && typeof printableInvoice.splitPaidAmount === 'number' && (
                <>
                  <div className="flex justify-between pt-1">
                    <span>DIBAYAR SEKARANG:</span>
                    <span>Rp {printableInvoice.splitPaidAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-600">
                    <span>SISA (PIUTANG):</span>
                    <span>Rp {(printableInvoice.splitRemainingDebt || 0).toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
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
              <p>No: SJ-{printableInvoice.invoiceNumber}</p>
            )}
            <p className="mt-1">(Cetak ulang dari Riwayat Transaksi)</p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="pt-4 border-t border-gray-100 space-y-1.5 font-sans print:hidden">
          {isPrintingAnim && activePrinterName && (
            <p className="text-center text-[9px] text-gray-400">Mengirim ke {activePrinterName}...</p>
          )}
          {docType === 'delivery' && (
            <button
              onClick={() => setPickerStep(true)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-gray-400 hover:text-gray-600 text-[10px] font-bold cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              Ubah Pilihan Barang
            </button>
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
