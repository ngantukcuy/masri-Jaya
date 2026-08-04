import React, { useState } from 'react';
import {
  Truck,
  Search,
  Plus,
  Phone,
  MapPin,
  User,
  Edit3,
  Trash2,
  Wallet,
  Clock
} from 'lucide-react';
import { Supplier } from '../../types';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import NumberInput from '../../components/shared/NumberInput';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

const numberInputClass =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20';

interface PemasokViewProps {
  suppliers: Supplier[];
  onUpdateSuppliers: (updatedSuppliers: Supplier[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  currentUser?: CurrentUser;
}

interface SalesEntry {
  name: string;
  phone: string;
}

const emptyForm = {
  name: '',
  phone: '',
  address: '',
  salesName: '',
  salesPhone: '',
  additionalSales: [] as SalesEntry[],
  paymentMethod: 'Cash' as 'Cash' | 'Tempo',
  topDays: 30,
};

export default function PemasokView({ suppliers, onUpdateSuppliers, onAddActivity, currentUser }: PemasokViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [extraSalesName, setExtraSalesName] = useState('');
  const [extraSalesPhone, setExtraSalesPhone] = useState('');

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.salesName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreate = () => {
    setEditingName(null);
    setForm({ ...emptyForm });
    setExtraSalesName('');
    setExtraSalesPhone('');
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditingName(s.name);
    setForm({
      name: s.name,
      phone: s.phone || '',
      address: s.address || '',
      salesName: s.salesName || '',
      salesPhone: s.salesPhone || '',
      additionalSales: s.additionalSales || [],
      paymentMethod: s.topDays ? 'Tempo' : 'Cash',
      topDays: s.topDays || 30,
    });
    setShowModal(true);
  };

  const handleAddExtraSales = () => {
    if (!extraSalesName.trim()) {
      dialog.alert('Nama sales tambahan tidak boleh kosong.');
      return;
    }
    setForm({ ...form, additionalSales: [...form.additionalSales, { name: extraSalesName.trim(), phone: extraSalesPhone.trim() }] });
    setExtraSalesName('');
    setExtraSalesPhone('');
  };

  const handleRemoveExtraSales = (idx: number) => {
    setForm({ ...form, additionalSales: form.additionalSales.filter((_, i) => i !== idx) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      dialog.alert('Nama pemasok tidak boleh kosong.');
      return;
    }

    if (editingName) {
      const updated = suppliers.map((s) => s.name === editingName ? {
        ...s,
        name: form.name.trim(),
        phone: form.phone,
        address: form.address,
        salesName: form.salesName,
        salesPhone: form.salesPhone,
        additionalSales: form.additionalSales,
        topDays: form.paymentMethod === 'Tempo' ? Number(form.topDays) : undefined,
        logoLetters: form.name.slice(0, 2).toUpperCase(),
      } : s);
      onUpdateSuppliers(updated);
      onAddActivity('Data Pemasok Diperbarui', form.name, 0, 'quote');
    } else {
      const newSupplier: Supplier = {
        name: form.name.trim(),
        rating: 0,
        recentPO: '-',
        debt: 0,
        leadTimeStability: 100,
        logoLetters: form.name.slice(0, 2).toUpperCase(),
        phone: form.phone,
        address: form.address,
        salesName: form.salesName,
        salesPhone: form.salesPhone,
        additionalSales: form.additionalSales,
        topDays: form.paymentMethod === 'Tempo' ? Number(form.topDays) : undefined,
      };
      onUpdateSuppliers([newSupplier, ...suppliers]);
      onAddActivity('Pemasok Baru Ditambahkan', form.name, 0, 'quote');
    }

    setShowModal(false);
  };

  const handleDelete = async (s: Supplier) => {
    const ok = await dialog.confirm(`Hapus data pemasok "${s.name}"?`);
    if (ok) {
      onUpdateSuppliers(suppliers.filter(x => x.name !== s.name));
      onAddActivity('Pemasok Dihapus', s.name, 0, 'quote');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Pemasok
          </h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Kelola data pemasok / supplier, sales, dan syarat pembayaran.</p>
        </div>
        {can('manage_supplier_add') && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> Tambah Pemasok
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pemasok atau sales..."
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <p className="col-span-full text-center text-xs text-gray-400 py-10">Belum ada data pemasok.</p>
        ) : (
          filtered.map((s) => (
            <div key={s.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                    {s.logoLetters}
                  </div>
                  <div>
                    <p className="font-extrabold text-sm text-gray-900">{s.name}</p>
                    {s.debt > 0 && <p className="text-[10px] text-red-500 font-bold">Utang: Rp {s.debt.toLocaleString('id-ID')}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {can('manage_supplier_update') && (
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="w-7 h-7 text-amber-500 hover:text-amber-700">
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {can('manage_supplier_delete') && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} className="w-7 h-7 text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] text-gray-600">
                {s.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-gray-400" /> {s.phone}</p>}
                {s.address && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-gray-400" /> {s.address}</p>}
                {s.salesName && <p className="flex items-center gap-1.5"><User className="w-3 h-3 text-gray-400" /> {s.salesName} {s.salesPhone && `• ${s.salesPhone}`}</p>}
                {(s.additionalSales || []).map((a, i) => (
                  <p key={i} className="flex items-center gap-1.5 pl-4"><User className="w-3 h-3 text-gray-300" /> {a.name} {a.phone && `• ${a.phone}`}</p>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] font-bold">
                {s.topDays ? (
                  <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3 h-3" /> Tempo {s.topDays} Hari</span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600"><Wallet className="w-3 h-3" /> Cash</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm normal-case tracking-normal">{editingName ? 'Edit Pemasok' : 'Tambah Data Pemasok'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <Label>Nama Pemasok</Label>
              <Input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nomor Telepon</Label>
                <Input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Alamat</Label>
                <Input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50/50">
              <p className="text-[10px] font-black uppercase text-gray-400">Sales Pemasok</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nama Sales</Label>
                  <Input type="text" value={form.salesName} onChange={(e) => setForm({ ...form, salesName: e.target.value })} className="bg-white" />
                </div>
                <div>
                  <Label>Nomor Telepon Sales</Label>
                  <Input type="text" value={form.salesPhone} onChange={(e) => setForm({ ...form, salesPhone: e.target.value })} className="bg-white" />
                </div>
              </div>

              {form.additionalSales.length > 0 && (
                <div className="space-y-1.5">
                  {form.additionalSales.map((a, i) => (
                    <div key={i} className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-100">
                      <span className="font-semibold text-gray-700">{a.name} {a.phone && `• ${a.phone}`}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveExtraSales(i)} className="w-6 h-6 text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>+ Sales Lain</Label>
                  <Input type="text" value={extraSalesName} onChange={(e) => setExtraSalesName(e.target.value)} placeholder="Nama sales..." className="bg-white" />
                </div>
                <div className="flex-1">
                  <Input type="text" value={extraSalesPhone} onChange={(e) => setExtraSalesPhone(e.target.value)} placeholder="No. telepon..." className="bg-white" />
                </div>
                <Button type="button" onClick={handleAddExtraSales} className="bg-gray-900 hover:bg-black shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pilih Pembayaran</Label>
                <Tabs value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v as 'Cash' | 'Tempo' })}>
                  <TabsList className="bg-gray-100 p-1 rounded-xl w-full gap-0">
                    <TabsTrigger value="Cash" className="flex-1 rounded-lg border-0 data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-emerald-600 text-gray-500">Cash</TabsTrigger>
                    <TabsTrigger value="Tempo" className="flex-1 rounded-lg border-0 data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-amber-600 text-gray-500">Tempo</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {form.paymentMethod === 'Tempo' && (
                <div>
                  <Label>Jangka Waktu (Hari)</Label>
                  <NumberInput min={1} value={form.topDays} onChange={(v) => setForm({ ...form, topDays: v })} placeholder="0" className={numberInputClass} />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="w-full">Batal</Button>
              <Button type="submit" className="w-full shadow-md shadow-blue-500/15">Simpan &amp; Konfirmasi</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
