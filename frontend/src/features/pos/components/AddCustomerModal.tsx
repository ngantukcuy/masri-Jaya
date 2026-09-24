import { useState, FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import SebagaiInput from '../../../components/shared/SebagaiInput';

interface AddCustomerModalProps {
  onClose: () => void;
  onSubmit: (name: string, loyaltyTier: string, phone?: string) => void;
}

export default function AddCustomerModal({ onClose, onSubmit }: AddCustomerModalProps) {
  const [name, setName] = useState('');
  const [loyaltyTier, setLoyaltyTier] = useState('Pelanggan Umum');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), loyaltyTier, phone.trim() || undefined);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm text-foreground normal-case tracking-normal">
            <UserPlus className="w-5 h-5" /> Tambah Pelanggan Baru
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nama Lengkap Pelanggan</Label>
            <Input
              type="text"
              required
              placeholder="Contoh: CV. Berkah Abadi, Ahmad"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label>Nomor HP <span className="text-muted-foreground font-normal normal-case">(opsional)</span></Label>
            <Input
              type="tel"
              placeholder="Contoh: 0812-3456-7890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <Label>Sebagai</Label>
            <SebagaiInput value={loyaltyTier} onChange={setLoyaltyTier} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" className="flex-1">
              Simpan Pelanggan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
