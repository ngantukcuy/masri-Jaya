import { QrCode } from 'lucide-react';
import { motion } from 'motion/react';

interface QRISModalProps {
  onClose: () => void;
  onConfirm: () => void;
  totalAmount: number;
}

export default function QRISModal({ onClose, onConfirm, totalAmount }: QRISModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto text-center space-y-4"
      >
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <span className="font-extrabold text-xs uppercase tracking-widest text-blue-600">PEMBAYARAN QRIS OTOMATIS</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
        </div>

        <div className="space-y-1">
          <h4 className="font-black text-gray-800 text-sm">Pindai kode QR untuk membayar</h4>
          <p className="text-xs text-blue-600 font-bold">Total: Rp {totalAmount.toLocaleString('id-ID')}</p>
        </div>

        {/* QR Code graphic */}
        <div className="w-44 h-44 bg-gray-100 border border-gray-200 rounded-2xl mx-auto flex items-center justify-center relative overflow-hidden">
          <QrCode className="w-36 h-36 text-gray-800" />
          <div className="absolute inset-0 bg-white/5 bg-radial-gradient flex items-center justify-center"></div>
        </div>

        <p className="text-[10px] text-gray-400 max-w-[220px] mx-auto">Mensimulasikan pembayaran QRIS elektronik terintegrasi. Klik tombol otorisasi untuk menyelesaikan transaksi.</p>

        <div className="pt-3 border-t border-gray-100 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-md"
          >
            Otorisasi Selesai
          </button>
        </div>
      </motion.div>
    </div>
  );
}
