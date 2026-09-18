import { ReactNode, useState } from 'react';
import { Coins, QrCode, CreditCard, Wallet, Landmark } from 'lucide-react';
import { BankAccount, Customer } from '../../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';

interface PaymentMethodModalProps {
  onClose: () => void;
  onSelect: (method: 'Cash' | 'QRIS' | 'Transfer' | 'Split' | 'Deposit' | 'Piutang', account?: BankAccount) => void;
  totalAmount: number;
  customer: Customer;
  /** True kalau customer yang dipilih masih pelanggan umum "Customer"
   * (bukan baris pelanggan asli) — opsi "Split" (cicil) ditahan karena
   * sisa hutangnya tidak ada pelanggan tujuannya. */
  isGenericCustomer?: boolean;
  bankAccounts: BankAccount[];
}

/**
 * Langkah pertama saat klik "Bayar & Cetak Struk": kasir memilih metode
 * pembayaran dulu di sini, baru diarahkan ke alur yang sesuai
 * (CashPaymentModal / QRISModal / SplitPaymentModal / langsung untuk
 * Deposit) — menggantikan tombol toggle metode yang dulu terpisah di atas
 * tombol Bayar.
 */
export default function PaymentMethodModal({ onClose, onSelect, totalAmount, customer, isGenericCustomer, bankAccounts }: PaymentMethodModalProps) {
  const depositBalance = customer.depositBalance || 0;
  const transferAccounts = bankAccounts.filter((account) => account.type === 'Bank' || account.type === 'E-Wallet');
  const [showTransferAccounts, setShowTransferAccounts] = useState(false);

  const options: {
    method: 'Cash' | 'QRIS' | 'Transfer' | 'Split' | 'Deposit' | 'Piutang';
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
      method: 'Transfer',
      label: 'Transfer',
      desc: transferAccounts.length > 0 ? 'Pilih rekening toko untuk pembayaran transfer' : 'Belum ada rekening Bank/E-Wallet di Pengaturan',
      icon: <Landmark className="w-5 h-5" />,
    },
    {
      method: 'Piutang',
      label: 'Piutang',
      desc: isGenericCustomer 
        ? 'Pilih pelanggan asli dulu — "Customer" umum tidak bisa punya piutang' 
        : 'Bayar sebelum tempo, catat sebagai hutang pelanggan (piutang)',
      icon: <Landmark className="w-5 h-5" />,
    },
    {
      method: 'Split',
      label: 'Cicil',
      desc: isGenericCustomer
        ? 'Pilih pelanggan asli dulu — "Customer" umum tidak bisa cicil'
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
            const disabled = ((opt.method === 'Split' || opt.method === 'Piutang') && isGenericCustomer) || (opt.method === 'Transfer' && transferAccounts.length === 0);
            if (opt.method === 'Transfer' && transferAccounts.length > 0 && !showTransferAccounts) {
              return (
                <button
                  key={opt.method}
                  type="button"
                  onClick={() => setShowTransferAccounts(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-primary/5 hover:border-primary text-left cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">{opt.icon}</div>
                  <div className="min-w-0">
                    <p className="font-black text-xs text-foreground">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{opt.desc}</p>
                  </div>
                </button>
              );
            }
            if (opt.method === 'Transfer' && transferAccounts.length > 0 && showTransferAccounts) {
              return (
                <div key={opt.method} className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-primary" />
                      <p className="font-black text-xs text-foreground">Pilih Rekening Transfer</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowTransferAccounts(false)} className="h-6 px-2 text-[10px]">
                      Kembali
                    </Button>
                  </div>
                  {transferAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => onSelect('Transfer', account)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-primary/5 hover:border-primary cursor-pointer"
                    >
                      <p className="text-xs font-bold text-foreground">{account.name}</p>
                      <p className="text-[10px] text-muted-foreground">{account.type} • {account.accountNumber || 'Nomor rekening belum diisi'}{account.holderName ? ` • ${account.holderName}` : ''}</p>
                    </button>
                  ))}
                </div>
              );
            }
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
