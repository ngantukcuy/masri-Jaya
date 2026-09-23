import React, { useMemo, useState } from 'react';
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
  Clock,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { PO, Supplier } from '../../types';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import NumberInput from '../../components/shared/NumberInput';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import PODetailDialog, { PO_STATUS_LABEL } from '../../components/shared/PODetailDialog';
import { buildSupplierStats, isPOPaid, normalizeSupplierName, poRemaining } from '../../lib/supplierBons';

const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`;

function fmtDate(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const numberInputClass =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20';

interface PemasokViewProps {
  suppliers: Supplier[];
  /** Daftar bon/PO — dipakai untuk menghitung total belanja & utang tiap pemasok. */
  pos?: PO[];
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

export default function PemasokView({ suppliers, pos = [], onUpdateSuppliers, onAddActivity, currentUser }: PemasokViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [extraSalesName, setExtraSalesName] = useState('');
  const [extraSalesPhone, setExtraSalesPhone] = useState('');
  const [detailSupplierName, setDetailSupplierName] = useState<string | null>(null);
  const [previewPO, setPreviewPO] = useState<PO | null>(null);

  // Total belanja & utang dihitung langsung dari bon (PO) tiap pemasok, dengan
  // aturan yang sama seperti halaman Pembayaran ke Supplier.
  const supplierStats = useMemo(() => buildSupplierStats(pos), [pos]);
  const getStats = (name: string) =>
    supplierStats.get(normalizeSupplierName(name)) ?? { bons: [] as PO[], totalBelanja: 0, totalUtang: 0, unpaidCount: 0 };
  const detailSupplier = detailSupplierName ? suppliers.find((x) => x.name === detailSupplierName) ?? null : null;
  const detailStats = detailSupplier ? getStats(detailSupplier.name) : null;

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <p className="col-span-full text-center text-xs text-gray-400 py-10">Belum ada data pemasok.</p>
        ) : (
          filtered.map((s) => {
            const stats = getStats(s.name);
            return (
              <div
                key={s.name}
                role="button"
                tabIndex={0}
                onClick={() => setDetailSupplierName(s.name)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDetailSupplierName(s.name);
                  }
                }}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-blue-600 transition-all cursor-pointer flex flex-col justify-between space-y-4 outline-none focus-visible:border-blue-600"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-sm shadow-xs shrink-0">
                      {s.logoLetters}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-gray-900 leading-snug">{s.name}</h4>
                      {s.phone && <p className="text-[10px] text-gray-500 font-semibold mt-0.5">📞 {s.phone}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {can('manage_supplier_update') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                        className="w-6 h-6 text-amber-600 hover:bg-amber-50"
                        title="Edit Pemasok"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {can('manage_supplier_delete') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                        className="w-6 h-6 text-red-600 hover:bg-red-50"
                        title="Hapus Pemasok"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {(s.address || s.salesName || (s.additionalSales || []).length > 0) && (
                  <div className="space-y-1.5 text-[10px] text-gray-500 bg-gray-50 p-2 rounded border border-gray-100/50">
                    {s.address && <p className="flex items-center gap-1.5 line-clamp-1"><MapPin className="w-3 h-3 text-gray-400 shrink-0" /> {s.address}</p>}
                    {s.salesName && <p className="flex items-center gap-1.5"><User className="w-3 h-3 text-gray-400 shrink-0" /> {s.salesName} {s.salesPhone && `• ${s.salesPhone}`}</p>}
                    {(s.additionalSales || []).map((a, i) => (
                      <p key={i} className="flex items-center gap-1.5 pl-4"><User className="w-3 h-3 text-gray-300 shrink-0" /> {a.name} {a.phone && `• ${a.phone}`}</p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-150 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] block mb-0.5">TOTAL BELANJA</span>
                    <span className="font-black text-gray-800">{rupiah(stats.totalBelanja)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block mb-0.5">JUMLAH BON</span>
                    <span className="font-black text-blue-600">{stats.bons.length} Bon</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block mb-0.5">PEMBAYARAN</span>
                    {s.topDays ? (
                      <span className="font-black text-amber-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Tempo {s.topDays} Hari</span>
                    ) : (
                      <span className="font-black text-emerald-600 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Cash</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] block mb-0.5">TOTAL UTANG</span>
                    <span className={`font-black ${stats.totalUtang > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {rupiah(stats.totalUtang)}
                    </span>
                    {stats.unpaidCount > 0 && (
                      <span className="text-[9px] text-gray-400 block">{stats.unpaidCount} bon belum lunas</span>
                    )}
                  </div>
                  {stats.totalUtang > 0 ? (
                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                      Lihat Bon <ChevronRight className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black flex items-center gap-1 uppercase">
                      <CheckCircle2 className="w-3 h-3" /> Lunas
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preview bon pemasok */}
      <Dialog open={!!detailSupplier} onOpenChange={(open) => { if (!open) setDetailSupplierName(null); }}>
        <DialogContent className="max-w-2xl">
          {detailSupplier && detailStats && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm normal-case tracking-normal">Bon {detailSupplier.name}</DialogTitle>
                <DialogDescription>Klik salah satu bon untuk melihat isi barangnya.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Jumlah Bon</p>
                  <p className="mt-1 font-black text-blue-600">{detailStats.bons.length} Bon</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Total Belanja</p>
                  <p className="mt-1 font-black text-gray-800">{rupiah(detailStats.totalBelanja)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Total Utang</p>
                  <p className={`mt-1 font-black ${detailStats.totalUtang > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rupiah(detailStats.totalUtang)}</p>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
                {detailStats.bons.length === 0 ? (
                  <p className="p-6 text-center text-xs text-gray-400">Belum ada bon dari pemasok ini.</p>
                ) : (
                  detailStats.bons.map((po) => {
                    const paid = isPOPaid(po);
                    return (
                      <button
                        key={po.poNumber}
                        type="button"
                        onClick={() => setPreviewPO(po)}
                        className="w-full flex items-center justify-between gap-3 p-3 text-left text-xs hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-gray-900">{po.poNumber}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {fmtDate(po.receivedAt || po.createdDate)} · {po.paymentMethod || '-'}
                            {po.paymentMethod === 'Tempo' && po.dueDate ? ` · Jatuh tempo ${fmtDate(po.dueDate)}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-800">{rupiah(po.total)}</p>
                          <div className="mt-1 flex justify-end gap-1">
                            <Badge variant="outline">{PO_STATUS_LABEL[po.status] || po.status}</Badge>
                            {paid ? (
                              <Badge variant="success">Lunas</Badge>
                            ) : (
                              <Badge variant="warning">Sisa {rupiah(poRemaining(po))}</Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PODetailDialog po={previewPO} onClose={() => setPreviewPO(null)} />

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