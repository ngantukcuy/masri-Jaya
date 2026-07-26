import React, { useState } from 'react';
import {
  Truck,
  Search,
  Plus,
  Phone,
  MapPin,
  User,
  X,
  Edit3,
  Trash2,
  Wallet,
  Clock
} from 'lucide-react';
import { Supplier } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useDialog } from '../../components/shared/DialogProvider';

interface PemasokViewProps {
  suppliers: Supplier[];
  onUpdateSuppliers: (updatedSuppliers: Supplier[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote') => void;
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

export default function PemasokView({ suppliers, onUpdateSuppliers, onAddActivity }: PemasokViewProps) {
  const dialog = useDialog();
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
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Tambah Pemasok
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pemasok atau sales..."
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-500"
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
                  <button onClick={() => openEdit(s)} className="p-1.5 text-amber-500 hover:text-amber-700 cursor-pointer">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(s)} className="p-1.5 text-red-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 my-8 text-xs"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="font-extrabold text-sm text-gray-900">{editingName ? 'Edit Pemasok' : 'Tambah Data Pemasok'}</h4>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Nama Pemasok</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold outline-none focus:bg-white focus:border-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Nomor Telepon</label>
                    <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold outline-none focus:bg-white focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Alamat</label>
                    <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold outline-none focus:bg-white focus:border-blue-500" />
                  </div>
                </div>

                <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50/50">
                  <p className="text-[10px] font-black uppercase text-gray-400">Sales Pemasok</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Nama Sales</label>
                      <input type="text" value={form.salesName} onChange={(e) => setForm({ ...form, salesName: e.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Nomor Telepon Sales</label>
                      <input type="text" value={form.salesPhone} onChange={(e) => setForm({ ...form, salesPhone: e.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold outline-none focus:border-blue-500" />
                    </div>
                  </div>

                  {form.additionalSales.length > 0 && (
                    <div className="space-y-1.5">
                      {form.additionalSales.map((a, i) => (
                        <div key={i} className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-100">
                          <span className="font-semibold text-gray-700">{a.name} {a.phone && `• ${a.phone}`}</span>
                          <button type="button" onClick={() => handleRemoveExtraSales(i)} className="text-red-400 hover:text-red-600 cursor-pointer">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">+ Sales Lain</label>
                      <input type="text" value={extraSalesName} onChange={(e) => setExtraSalesName(e.target.value)} placeholder="Nama sales..." className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-semibold outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex-1">
                      <input type="text" value={extraSalesPhone} onChange={(e) => setExtraSalesPhone(e.target.value)} placeholder="No. telepon..." className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-semibold outline-none focus:border-blue-500" />
                    </div>
                    <button type="button" onClick={handleAddExtraSales} className="px-3 py-2.5 bg-gray-900 hover:bg-black text-white rounded-lg cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Pilih Pembayaran</label>
                    <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                      <button type="button" onClick={() => setForm({ ...form, paymentMethod: 'Cash' })} className={`flex-1 py-2 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${form.paymentMethod === 'Cash' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>Cash</button>
                      <button type="button" onClick={() => setForm({ ...form, paymentMethod: 'Tempo' })} className={`flex-1 py-2 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${form.paymentMethod === 'Tempo' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>Tempo</button>
                    </div>
                  </div>
                  {form.paymentMethod === 'Tempo' && (
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Jangka Waktu (Hari)</label>
                      <input type="number" min={1} value={form.topDays} onChange={(e) => setForm({ ...form, topDays: Number(e.target.value) })} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold outline-none focus:bg-white focus:border-blue-500" />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="w-full py-2.5 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 cursor-pointer">Batal</button>
                  <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/15 cursor-pointer">Simpan &amp; Konfirmasi</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
