import { FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { motion } from 'motion/react';

interface AddProductModalProps {
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  categories: string[];
  name: string;
  onNameChange: (v: string) => void;
  sku: string;
  onSkuChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  unit: string;
  onUnitChange: (v: string) => void;
  retailPrice: string;
  onRetailPriceChange: (v: string) => void;
  wholesalePrice: string;
  onWholesalePriceChange: (v: string) => void;
  projectPrice: string;
  onProjectPriceChange: (v: string) => void;
  stock: string;
  onStockChange: (v: string) => void;
}

export default function AddProductModal({
  onClose,
  onSubmit,
  categories,
  name, onNameChange,
  sku, onSkuChange,
  category, onCategoryChange,
  unit, onUnitChange,
  retailPrice, onRetailPriceChange,
  wholesalePrice, onWholesalePriceChange,
  projectPrice, onProjectPriceChange,
  stock, onStockChange
}: AddProductModalProps) {
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
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 p-6 shadow-2xl max-h-[85vh] overflow-y-auto relative z-10 space-y-4 font-sans text-xs"
      >
        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <Plus className="w-5 h-5" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-800">Tambah Barang Baru ke POS</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Nama Barang</label>
              <input
                type="text"
                required
                placeholder="Contoh: Semen Tiga Roda"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-600/15 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">SKU</label>
              <input
                type="text"
                required
                placeholder="Contoh: SEMEN-TR"
                value={sku}
                onChange={(e) => onSkuChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-600/15 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-600/15 text-gray-800"
              >
                {categories.filter((cat) => cat !== 'Semua Kategori').map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Satuan</label>
              <input
                type="text"
                placeholder="pcs / zak / meter"
                value={unit}
                onChange={(e) => onUnitChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-600/15 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Harga Modal</label>
              <input
                type="number"
                min="0"
                value={retailPrice}
                onChange={(e) => onRetailPriceChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-600/15 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Harga Standard</label>
              <input
                type="number"
                min="0"
                value={wholesalePrice}
                onChange={(e) => onWholesalePriceChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-600/15 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Harga Minimum</label>
              <input
                type="number"
                min="0"
                value={projectPrice}
                onChange={(e) => onProjectPriceChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-600/15 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Stok Awal</label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => onStockChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-600/15 text-gray-800"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold py-2 rounded-lg cursor-pointer uppercase"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-lg cursor-pointer uppercase shadow-sm"
            >
              Simpan &amp; Masukkan ke Keranjang
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
