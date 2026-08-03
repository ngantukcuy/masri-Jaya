import { ReactNode } from 'react';
import { Coins, QrCode, CreditCard, Wallet } from 'lucide-react';
import { Customer } from '../../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pilih Metode Pembayaran</DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Belanja</p>
          <p className="text-2xl font-black text-foreground">Rp {totalAmount.toLocaleString('id-ID')}</p>
        </div>

        <div className="space-y-2 mt-4">
          {options.map((opt) => {
            const disabled = opt.method === 'Split' && isGenericCustomer;
            return (
              <button
                key={opt.method}
                type="button"
                onClick={() => !disabled && onSelect(opt.method)}
                disabled={disabled}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  disabled
                    ? 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                    : 'border-border bg-background hover:bg-primary/5 hover:border-primary'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                  {opt.icon}
                </div>
                <div className="min-w-0">
                  <p className={`font-black text-xs ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}>{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Batal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
