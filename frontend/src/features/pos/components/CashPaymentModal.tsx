import { useState, useMemo } from 'react';
import { Coins } from 'lucide-react';
import NumberInput from '../../../components/shared/NumberInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <Coins className="w-4 h-4" /> Pembayaran Tunai
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Belanja</p>
          <p className="text-2xl font-black text-foreground">Rp {totalAmount.toLocaleString('id-ID')}</p>
        </div>

        <div className="space-y-1.5 mt-4">
          <Label>Uang Diterima Dari Pelanggan</Label>
          <NumberInput
            value={cashReceived}
            onChange={setCashReceived}
            autoFocus
            placeholder="0"
            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-right font-black text-lg text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {suggestions.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setCashReceived(amount)}
              className="py-2 px-1 rounded-lg text-[11px] font-bold border border-border bg-muted/50 hover:bg-primary/5 hover:border-primary hover:text-primary cursor-pointer transition-colors"
            >
              {amount === totalAmount ? 'Uang Pas' : `Rp ${amount.toLocaleString('id-ID')}`}
            </button>
          ))}
        </div>

        <div className={`rounded-xl p-3 text-center mt-3 border ${isSufficient ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          {cashReceived === 0 ? (
            <p className="text-[11px] text-muted-foreground font-bold">Masukkan jumlah uang tunai yang diterima.</p>
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

        <DialogFooter>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" disabled={!isSufficient} className="w-full" onClick={() => onConfirm(cashReceived)}>
            Selesaikan Transaksi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
