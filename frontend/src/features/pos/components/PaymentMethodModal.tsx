import { ReactNode } from 'react';
import { Coins, QrCode, CreditCard, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../../../types';

interface PaymentMethodModalProps {
  onClose: () => void;
  onSelect: (method: 'Cash' | 'QRIS' | 'Split' | 'Deposit') => void;
  totalAmount: number;
  customer: Customer;
  /** True kalau customer yang dipilih masih pelanggan umum "Customer"
   * (bukan baris pelanggan asli) — opsi "Split" (cicil) ditahan karena
   * sisa hutangnya tidak ada pelanggan tujuannya. */
  isGenericCustomer?: boolean;
}

/**
 * Langkah pertama saat klik "Bayar & Cetak Struk": kasir memilih metode
 * pembayaran dulu di sini, baru diarahkan ke alur yang sesuai
 * (CashPaymentModal / QRISModal / SplitPaymentModal / langsung untuk
 * Deposit) — menggantikan tombol toggle metode yang dulu terpisah di atas
 * tombol Bayar.
 */
export default function PaymentMethodModal({ onClose, onSelect, totalAmount, customer, isGenericCustomer }: PaymentMethodModalProps) {
  const depositBalance = customer.depositBalance || 0;

  const options: {
    method: 'Cash' | 'QRIS' | 'Split' | 'Deposit';
    label: string;
    desc: string;
    icon: ReactNode;
  }[] = [
    {
      method: 'Cash',
      label: 'Tunai',
      desc: 'Bayar cash, hitung kembalian otomatis',
      icon: <Coins className="w-5 h-5" />,
    },
    {
      method: 'QRIS',
      label: 'QRIS',
      desc: 'Pindai kode QR, bayar lewat e-wallet/m-banking',
      icon: <QrCode className="w-5 h-5" />,
    },
    {
      method: 'Split',
      label: 'Kartu / Cicil',
      desc: isGenericCustomer
        ? 'Pilih pelanggan asli dulu — "Customer" umum tidak bisa punya piutang'
        : 'Bayar sebagian sekarang, sisanya jadi piutang',
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      method: 'Deposit',
      label: 'Deposit',
      desc: `Saldo deposit pelanggan: Rp ${depositBalance.toLocaleString('id-ID')}`,
      icon: <Wallet className="w-5 h-5" />,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4"
      >
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <span className="font-extrabold text-xs uppercase tracking-widest text-blue-600">
            PILIH METODE PEMBAYARAN
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer">✕</button>
        </div>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Belanja</p>
          <p className="text-2xl font-black text-gray-900">Rp {totalAmount.toLocaleString('id-ID')}</p>
        </div>

        <div className="space-y-2">
          {options.map((opt) => {
            const disabled = opt.method === 'Split' && isGenericCustomer;
            return (
              <button
                key={opt.method}
                type="button"
                onClick={() => !disabled && onSelect(opt.method)}
                disabled={disabled}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  disabled
                    ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-600 cursor-pointer'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${disabled ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>
                  {opt.icon}
                </div>
                <div className="min-w-0">
                  <p className={`font-black text-xs ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>{opt.label}</p>
                  <p className="text-[10px] text-gray-400 truncate">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
        >
          Batal
        </button>
      </motion.div>
    </div>
  );
}
