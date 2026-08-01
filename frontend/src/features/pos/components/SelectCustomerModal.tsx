import { useMemo, useState } from 'react';
import { ArrowLeft, Search, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../../../types';

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
      />
      <motion.div
        initial={{ scale: 0.97, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: 15 }}
        className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-2xl max-h-[85vh] flex flex-col relative z-10 font-sans text-xs overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 shrink-0">
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h3 className="font-extrabold text-sm text-gray-900">Pilih Pelanggan</h3>
        </div>

        {/* Search + Tambah baru */}
        <div className="px-4 pt-3 pb-2 flex gap-2 shrink-0">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pembeli"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2.5 font-semibold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={onAddNew}
            className="flex items-center gap-1.5 px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Pelanggan baru
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider pt-2 pb-1">Terakhir Dipilih</p>

          {/* Baris "Pelanggan" umum / walk-in */}
          <button
            type="button"
            onClick={() => onSelect(genericCustomer)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
              selectedCustomerId === genericCustomer.id
                ? 'border-blue-300 bg-blue-50/60'
                : 'border-gray-100 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[11px] shrink-0">
              PI
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-gray-800">Pelanggan</p>
              <p className="text-gray-400 text-[10px]">Pilih jika tidak ingin menyertakan nama</p>
            </div>
            <span
              className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                selectedCustomerId === genericCustomer.id
                  ? 'border-blue-600 bg-blue-600 ring-2 ring-blue-100'
                  : 'border-gray-300'
              }`}
            />
          </button>

          {filteredCustomers.length === 0 ? (
            <p className="text-center text-gray-400 py-8 font-semibold">Pelanggan tidak ditemukan.</p>
          ) : (
            filteredCustomers.map((c) => {
              const isActive = selectedCustomerId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    isActive ? 'border-blue-300 bg-blue-50/60' : 'border-gray-100 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[11px] shrink-0">
                    {initialsOf(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-gray-800 truncate">
                      {c.name}
                      {c.phone ? <span className="text-gray-400 font-semibold"> · {c.phone}</span> : null}
                    </p>
                    <p className="text-gray-400 text-[10px] mt-0.5">
                      Sisa limit piutang <span className="text-gray-600 font-bold">Rp {remainingLimit(c).toLocaleString('id-ID')}</span>
                    </p>
                    {c.customerType && (
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-gray-800 text-white text-[9px] font-bold">
                        {c.customerType}
                      </span>
                    )}
                  </div>
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                      isActive ? 'border-blue-600 bg-blue-600 ring-2 ring-blue-100' : 'border-gray-300'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
