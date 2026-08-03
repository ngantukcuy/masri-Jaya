import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Customer } from '../../../types';
import NumberInput from '../../../components/shared/NumberInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <Wallet className="w-4 h-4" /> Bayar Sebagian (DP)
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Belanja</p>
          <p className="text-2xl font-black text-foreground">Rp {totalAmount.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-muted-foreground">Pelanggan: <span className="font-bold text-foreground/80">{customer.name}</span></p>
        </div>

        <div className="space-y-1.5 mt-4">
          <Label>Jumlah Dibayar Sekarang</Label>
          <NumberInput
            value={paidNow}
            onChange={setPaidNow}
            max={totalAmount}
            autoFocus
            placeholder="0"
            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-right font-black text-lg text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>

        <div className="rounded-xl p-3 text-center bg-amber-50 border border-amber-100 mt-3">
          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Sisa Menjadi Piutang</p>
          <p className="text-lg font-black text-amber-600">Rp {remaining.toLocaleString('id-ID')}</p>
        </div>

        <div className="text-[10px] text-muted-foreground space-y-0.5 px-1 mt-3">
          <div className="flex justify-between">
            <span>Piutang saat ini</span>
            <span className="font-bold text-foreground/80">Rp {currentDebt.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between">
            <span>Piutang setelah transaksi ini</span>
            <span className="font-bold text-foreground/80">Rp {nextDebt.toLocaleString('id-ID')}</span>
          </div>
          {creditLimit > 0 && (
            <div className="flex justify-between">
              <span>Limit piutang pelanggan</span>
              <span className="font-bold text-foreground/80">Rp {creditLimit.toLocaleString('id-ID')}</span>
            </div>
          )}
          {remaining > 0 && (
            <div className="flex justify-between">
              <span>Jatuh tempo otomatis</span>
              <span className="font-bold text-foreground/80">{effectiveDueDateLabel} ({customer.tempoDays || 30} hari)</span>
            </div>
          )}
        </div>

        {exceedsLimit && (
          <div className="rounded-xl p-3 text-center bg-red-50 border border-red-100 mt-3">
            <p className="text-[10px] text-red-500 font-bold">Peringatan: transaksi ini akan membuat piutang pelanggan melebihi limit yang ditetapkan.</p>
          </div>
        )}

        {!isValid && paidNow > 0 && (
          <p className="text-[10px] text-red-500 font-bold text-center mt-3">Jumlah dibayar harus lebih kecil dari total belanja. Gunakan metode Tunai/QRIS jika membayar lunas.</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" disabled={!isValid} className="w-full" onClick={() => onConfirm(paidNow)}>
            Selesaikan Transaksi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
