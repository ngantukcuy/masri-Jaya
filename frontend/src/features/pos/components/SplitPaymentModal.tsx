import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../../../types';
import NumberInput from '../../../components/shared/NumberInput';

interface SplitPaymentModalProps {
  onClose: () => void;
  onConfirm: (paidNow: number) => void;
  totalAmount: number;
  customer: Customer;
}

export default function SplitPaymentModal({ onClose, onConfirm, totalAmount, customer }: SplitPaymentModalProps) {
  const [paidNow, setPaidNow] = useState<number>(0);

  const remaining = Math.max(0, totalAmount - paidNow);
  const currentDebt = customer.currentDebt || 0;
  const creditLimit = customer.creditLimit || 0;
  const nextDebt = currentDebt + remaining;
  const exceedsLimit = creditLimit > 0 && nextDebt > creditLimit;
  const isValid = paidNow > 0 && paidNow < totalAmount;

  // Mirrors the due-date logic in POSView.executeFinalCheckout: today +
  // this customer's tempo terms, unless they already have an earlier
  // outstanding due date (which takes priority).
  const computedDueDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (customer.tempoDays || 30));
    return d.toISOString().split('T')[0];
  })();
  const effectiveDueDate = customer.nextDueDate && customer.nextDueDate < computedDueDate ? customer.nextDueDate : computedDueDate;
  const effectiveDueDateLabel = new Date(effectiveDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

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
            <Wallet className="w-4 h-4" /> BAYAR SEBAGIAN (DP)
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
        </div>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Belanja</p>
          <p className="text-2xl font-black text-gray-900">Rp {totalAmount.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-gray-400">Pelanggan: <span className="font-bold text-gray-600">{customer.name}</span></p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Jumlah Dibayar Sekarang</label>
          <NumberInput
            value={paidNow}
            onChange={setPaidNow}
            max={totalAmount}
            autoFocus
            placeholder="0"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-right font-black text-lg text-gray-900"
          />
        </div>

        <div className="rounded-xl p-3 text-center bg-amber-50 border border-amber-100">
          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Sisa Menjadi Piutang</p>
          <p className="text-lg font-black text-amber-600">Rp {remaining.toLocaleString('id-ID')}</p>
        </div>

        <div className="text-[10px] text-gray-400 space-y-0.5 px-1">
          <div className="flex justify-between">
            <span>Piutang saat ini</span>
            <span className="font-bold text-gray-600">Rp {currentDebt.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between">
            <span>Piutang setelah transaksi ini</span>
            <span className="font-bold text-gray-600">Rp {nextDebt.toLocaleString('id-ID')}</span>
          </div>
          {creditLimit > 0 && (
            <div className="flex justify-between">
              <span>Limit piutang pelanggan</span>
              <span className="font-bold text-gray-600">Rp {creditLimit.toLocaleString('id-ID')}</span>
            </div>
          )}
          {remaining > 0 && (
            <div className="flex justify-between">
              <span>Jatuh tempo otomatis</span>
              <span className="font-bold text-gray-600">{effectiveDueDateLabel} ({customer.tempoDays || 30} hari)</span>
            </div>
          )}
        </div>

        {exceedsLimit && (
          <div className="rounded-xl p-3 text-center bg-red-50 border border-red-100">
            <p className="text-[10px] text-red-500 font-bold">Peringatan: transaksi ini akan membuat piutang pelanggan melebihi limit yang ditetapkan.</p>
          </div>
        )}

        {!isValid && paidNow > 0 && (
          <p className="text-[10px] text-red-500 font-bold text-center">Jumlah dibayar harus lebih kecil dari total belanja. Gunakan metode Tunai/QRIS jika membayar lunas.</p>
        )}

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
            disabled={!isValid}
            onClick={() => onConfirm(paidNow)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs cursor-pointer shadow-md"
          >
            Selesaikan Transaksi
          </button>
        </div>
      </motion.div>
    </div>
  );
}
