import { useState, useMemo } from 'react';
import { Coins } from 'lucide-react';
import { motion } from 'motion/react';
import NumberInput from '../../../components/shared/NumberInput';

interface CashPaymentModalProps {
  onClose: () => void;
  onConfirm: (cashReceived: number) => void;
  totalAmount: number;
}

/** Rounds `amount` up to the nearest `step` (e.g. roundUpTo(123400, 5000) -> 125000). */
const roundUpTo = (amount: number, step: number) => Math.ceil(amount / step) * step;

export default function CashPaymentModal({ onClose, onConfirm, totalAmount }: CashPaymentModalProps) {
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Quick-tap suggestions: exact amount, then rounded-up "clean" note
  // values a cashier is likely to actually receive from a customer.
  const suggestions = useMemo(() => {
    const raw = [
      totalAmount,
      roundUpTo(totalAmount, 5000),
      roundUpTo(totalAmount, 10000),
      roundUpTo(totalAmount, 50000),
      roundUpTo(totalAmount, 100000),
    ];
    return Array.from(new Set(raw)).slice(0, 5);
  }, [totalAmount]);

  const change = cashReceived - totalAmount;
  const isSufficient = cashReceived >= totalAmount;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4"
      >
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <span className="font-extrabold text-xs uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
            <Coins className="w-4 h-4" /> PEMBAYARAN TUNAI
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
        </div>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Belanja</p>
          <p className="text-2xl font-black text-gray-900">Rp {totalAmount.toLocaleString('id-ID')}</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Uang Diterima Dari Pelanggan</label>
          <NumberInput
            value={cashReceived}
            onChange={setCashReceived}
            autoFocus
            placeholder="0"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-right font-black text-lg text-gray-900"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {suggestions.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setCashReceived(amount)}
              className="py-2 px-1 rounded-lg text-[11px] font-bold border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-600 hover:text-blue-600 cursor-pointer transition-colors"
            >
              {amount === totalAmount ? 'Uang Pas' : `Rp ${amount.toLocaleString('id-ID')}`}
            </button>
          ))}
        </div>

        <div className={`rounded-xl p-3 text-center ${isSufficient ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
          {cashReceived === 0 ? (
            <p className="text-[11px] text-gray-400 font-bold">Masukkan jumlah uang tunai yang diterima.</p>
          ) : isSufficient ? (
            <>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Kembalian</p>
              <p className="text-lg font-black text-emerald-600">Rp {change.toLocaleString('id-ID')}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Uang Tunai Kurang</p>
              <p className="text-lg font-black text-red-500">Rp {Math.abs(change).toLocaleString('id-ID')}</p>
            </>
          )}
        </div>

        <div className="pt-1 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!isSufficient}
            onClick={() => onConfirm(cashReceived)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs cursor-pointer shadow-md"
          >
            Selesaikan Transaksi
          </button>
        </div>
      </motion.div>
    </div>
  );
}
