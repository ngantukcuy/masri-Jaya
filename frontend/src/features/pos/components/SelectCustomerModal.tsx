import { useMemo, useState, type ReactNode } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Customer } from '../../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';

interface SelectCustomerModalProps {
  customers: Customer[];
  /** ID pelanggan yang sedang aktif dipilih di keranjang POS. */
  selectedCustomerId: string;
  /** Pelanggan umum/walk-in "Customer" — ditampilkan selalu di baris teratas
   * sebagai opsi "Pilih jika tidak ingin menyertakan nama". */
  genericCustomer: Customer;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  onAddNew: () => void;
}

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

export default function SelectCustomerModal({
  customers,
  selectedCustomerId,
  genericCustomer,
  onClose,
  onSelect,
  onAddNew,
}: SelectCustomerModalProps) {
  const [search, setSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const remainingLimit = (c: Customer) => {
    const limit = c.creditLimit || 0;
    const sisa = Math.max(0, limit - (c.currentDebt || 0));
    return sisa;
  };

  const Row = ({
    active,
    avatar,
    title,
    subtitle,
    badge,
    onClick,
  }: {
    active: boolean;
    avatar: string;
    title: ReactNode;
    subtitle: ReactNode;
    badge?: ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
        active ? 'border-primary/40 bg-primary/5' : 'border-border bg-background hover:bg-muted'
      }`}
    >
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-[11px] shrink-0">
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-foreground truncate">{title}</p>
        <p className="text-muted-foreground text-[10px] mt-0.5">{subtitle}</p>
        {badge}
      </div>
      <span
        className={`w-4 h-4 rounded-full border-2 shrink-0 ${
          active ? 'border-primary bg-primary ring-2 ring-primary/15' : 'border-border'
        }`}
      />
    </button>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 py-3.5 mb-0 border-b border-border shrink-0 flex-row items-center gap-3 space-y-0">
          <DialogTitle className="text-sm text-foreground normal-case tracking-normal">Pilih Pelanggan</DialogTitle>
        </DialogHeader>

        {/* Search + Tambah baru */}
        <div className="px-4 pt-3 pb-2 flex gap-2 shrink-0">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pembeli"
              className="pl-8"
            />
          </div>
          <Button type="button" onClick={onAddNew} className="bg-gray-900 hover:bg-black whitespace-nowrap">
            <UserPlus className="w-3.5 h-3.5" />
            Pelanggan baru
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider pt-2 pb-1">Terakhir Dipilih</p>

          <Row
            active={selectedCustomerId === genericCustomer.id}
            avatar="PI"
            title="Pelanggan"
            subtitle="Pilih jika tidak ingin menyertakan nama"
            onClick={() => onSelect(genericCustomer)}
          />

          {filteredCustomers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 font-semibold">Pelanggan tidak ditemukan.</p>
          ) : (
            filteredCustomers.map((c) => (
              <Row
                key={c.id}
                active={selectedCustomerId === c.id}
                avatar={initialsOf(c.name)}
                title={
                  <>
                    {c.name}
                    {c.phone ? <span className="text-muted-foreground font-semibold"> · {c.phone}</span> : null}
                  </>
                }
                subtitle={
                  <>
                    Sisa limit piutang <span className="text-foreground/80 font-bold">Rp {remainingLimit(c).toLocaleString('id-ID')}</span>
                  </>
                }
                badge={c.customerType ? <Badge variant="secondary" className="mt-1.5 bg-gray-800 text-white">{c.customerType}</Badge> : undefined}
                onClick={() => onSelect(c)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
