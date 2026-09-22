import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { Customer } from '../../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

interface PiutangDueDateModalProps {
  onClose: () => void;
  onConfirm: (dueDate: string) => void;
  totalAmount: number;
  customer: Customer;
}

/**
 * Sama seperti SplitPaymentModal tapi untuk metode "Piutang" (bayar
 * belakangan penuh, bukan cicilan): tidak ada input jumlah dibayar
 * sekarang karena seluruh total langsung jadi piutang, kasir cuma perlu
 * pastikan/ubah tanggal jatuh temponya sebelum transaksi disimpan.
 */
export default function PiutangDueDateModal({ onClose, onConfirm, totalAmount, customer }: PiutangDueDateModalProps) {
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + (customer.tempoDays || 30));
    return date.toISOString().split('T')[0];
  });

  const currentDebt = customer.currentDebt || 0;
  const creditLimit = customer.creditLimit || 0;
  const nextDebt = currentDebt + totalAmount;
  const exceedsLimit = creditLimit > 0 && nextDebt > creditLimit;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <Landmark className="w-4 h-4" /> Bayar Piutang
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Belanja</p>
          <p className="text-2xl font-black text-foreground">Rp {totalAmount.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-muted-foreground">Pelanggan: <span className="font-bold text-foreground/80">{customer.name}</span></p>
        </div>

        <div className="rounded-xl p-3 text-center bg-amber-50 border border-amber-100 mt-3">
          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Seluruhnya Menjadi Piutang</p>
          <p className="text-lg font-black text-amber-600">Rp {totalAmount.toLocaleString('id-ID')}</p>
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
          <div className="flex items-center justify-between gap-3 pt-1">
            <Label htmlFor="piutang-due-date">Jatuh Tempo</Label>
            <input
              id="piutang-due-date"
              type="date"
              value={dueDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 font-bold text-foreground/80"
            />
          </div>
        </div>

        {exceedsLimit && (
          <div className="rounded-xl p-3 text-center bg-red-50 border border-red-100 mt-3">
            <p className="text-[10px] text-red-500 font-bold">Peringatan: transaksi ini akan membuat piutang pelanggan melebihi limit yang ditetapkan.</p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" disabled={!dueDate} className="w-full" onClick={() => onConfirm(dueDate)}>
            Selesaikan Transaksi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
