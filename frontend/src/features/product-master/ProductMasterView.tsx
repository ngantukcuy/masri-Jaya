import React, { useState, useEffect, useRef } from 'react';
import {
  Tags,
  Award,
  Ruler,
  PackagePlus,
  Plus,
  Trash2,
  X,
  PackageSearch,
  Scale,
  Barcode as BarcodeIcon,
  ImagePlus,
  Upload,
  ScanLine,
  Loader2,
  RefreshCw,
  ArrowRight,
  PackageOpen
} from 'lucide-react';
import { Product, Bundle, BundleItem, SkuLocation } from '../../types';
import { useSupabaseTable } from '../../lib/useSupabaseTable';
import { uploadProductImage } from '../../lib/uploadProductImage';
import BarcodeScannerModal from '../../components/shared/BarcodeScannerModal';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import NumberInput from '../../components/shared/NumberInput';
import { generateSkuCode } from '../../lib/generateSku';

interface CategoryEntry {
  id: string;
  name: string;
  level: 1 | 2 | 3;
}

interface SimpleEntry {
  id: string;
  name: string;
}

interface ProductMasterViewProps {
  products: Product[];
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  onUpdateProducts?: (updatedProducts: Product[]) => void;
  skuLocations?: SkuLocation[];
  initialTab?: 'sku-master' | 'kategori' | 'brand' | 'unit' | 'bundle';
  currentUser?: CurrentUser;
}

function useLocalList<T extends { id: string }>(table: string, defaults: T[]) {
  const [list, setList] = useSupabaseTable<T>(table, defaults, (item) => item.id);
  return { list, persist: setList };
}

export default function ProductMasterView({ products, onAddActivity, onUpdateProducts, skuLocations = [], initialTab, currentUser }: ProductMasterViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
  const [activeTab, setActiveTab] = useState<'sku-master' | 'kategori' | 'brand' | 'unit' | 'bundle'>(initialTab || 'sku-master');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const { list: categories, persist: persistCategories } = useLocalList<CategoryEntry>('product_categories', []);
  const { list: brands, persist: persistBrands } = useLocalList<SimpleEntry>('product_brands', []);
  const { list: units, persist: persistUnits } = useLocalList<SimpleEntry>('product_units', []);
  const { list: bundles, persist: persistBundles } = useLocalList<Bundle>('product_bundles', []);

  // Category form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryLevel, setNewCategoryLevel] = useState<1 | 2 | 3>(1);

  // Brand / Unit forms
  const [newBrandName, setNewBrandName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');

  // Bundle form
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleName, setBundleName] = useState('');
  const [bundlePrice, setBundlePrice] = useState<number>(0);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [pickSku, setPickSku] = useState('');
  const [pickQty, setPickQty] = useState<number>(1);

  // ---- SKU MASTER (Produk Induk & Produk Eceran) ----
  const [skuMode, setSkuMode] = useState<'induk' | 'eceran'>('induk');

  const emptySkuForm = {
    // Kode SKU digenerate SEKALI di sini (bukan pas submit lagi) supaya bisa
    // ditampilkan ke admin & dipakai sebagai awalan barcode di bawah — SKU
    // dan barcode jadi nyambung, bukan dua angka acak yang nggak berhubungan.
    sku: generateSkuCode(),
    image: '',
    name: '',
    alias: '',
    unit: units[0]?.name || '',
    showLowStockAlert: false,
    minStockQty: 0,
    showInDeadstock: false,
    deadstockPeriodMonths: 3,
    category1: '',
    category2: '',
    category3: '',
    barcode: '',
    costPrice: 0,
    minSellPrice: 0,
    standardSellPrice: 0,
    skuLocationId: skuLocations[0]?.id || '',
  };
  const [skuForm, setSkuForm] = useState({ ...emptySkuForm });

  const emptyEceranForm = {
    sku: generateSkuCode(),
    parentSku: '',
    conversionValue: 1,
    unit: units[0]?.name || '',
    alias: '',
    /** Optional — kalau kosong, produk eceran ikut pakai foto produk induknya
     * (lihat handleSubmitEceran). */
    image: '',
    showLowStockAlert: false,
    minStockQty: 0,
    showInDeadstock: false,
    deadstockPeriodMonths: 3,
    barcode: '',
    costPrice: 0,
    minSellPrice: 0,
    standardSellPrice: 0,
    skuLocationId: skuLocations[0]?.id || '',
  };
  const [eceranForm, setEceranForm] = useState({ ...emptyEceranForm });

  const indukProducts = products.filter(p => p.productType === 'Induk' || !p.productType);
  const selectedIndukForEceran = indukProducts.find(p => p.sku === eceranForm.parentSku) || null;
  const kategori1List = categories.filter(c => c.level === 1);
  const kategori2List = categories.filter(c => c.level === 2);
  const kategori3List = categories.filter(c => c.level === 3);

  // Barcode sekarang SENGAJA dibangun dari kode SKU produknya (awalan),
  // bukan 13 digit murni acak yang nggak ada hubungannya sama sekali —
  // supaya begitu lihat barcode-nya, kelihatan itu barcode punya SKU yang
  // mana. Contoh: SKU "SKU-7K2F9A" -> barcode "SKU7K2F9A482913".
  const generateBarcode = (sku: string) => {
    const skuPart = (sku || 'SKU').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const randomDigits = String(Math.floor(100000 + Math.random() * 900000));
    return `${skuPart}${randomDigits}`;
  };

  // ---- Scan barcode langsung pakai kamera (mengisi form induk/eceran) ----
  const [scannerTarget, setScannerTarget] = useState<'induk' | 'eceran' | null>(null);
  const handleBarcodeDetected = (code: string) => {
    if (scannerTarget === 'induk') setSkuForm((prev) => ({ ...prev, barcode: code }));
    if (scannerTarget === 'eceran') setEceranForm((prev) => ({ ...prev, barcode: code }));
    setScannerTarget(null);
  };

  // ---- Upload foto produk dari perangkat (alternatif dari URL) ----
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageUploadError(null);
    setImageUploading(true);
    try {
      const url = await uploadProductImage(file);
      setSkuForm((prev) => ({ ...prev, image: url }));
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Gagal mengunggah gambar.');
    } finally {
      setImageUploading(false);
    }
  };

  // ---- Sama seperti di atas, tapi buat foto produk Eceran sendiri (Optional
  // — kalau tidak diisi, produk eceran ikut pakai foto produk induknya). ----
  const [eceranImageUploading, setEceranImageUploading] = useState(false);
  const [eceranImageUploadError, setEceranImageUploadError] = useState<string | null>(null);
  const eceranImageFileInputRef = useRef<HTMLInputElement>(null);
  const handleEceranImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEceranImageUploadError(null);
    setEceranImageUploading(true);
    try {
      const url = await uploadProductImage(file);
      setEceranForm((prev) => ({ ...prev, image: url }));
    } catch (err) {
      setEceranImageUploadError(err instanceof Error ? err.message : 'Gagal mengunggah gambar.');
    } finally {
      setEceranImageUploading(false);
    }
  };

  const handleSubmitInduk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuForm.name.trim()) {
      dialog.alert('Nama produk tidak boleh kosong.');
      return;
    }
    if (!onUpdateProducts) return;

    const sku = skuForm.sku || generateSkuCode();
    const locationName = skuLocations.find(l => l.id === skuForm.skuLocationId)?.name || '';

    const newProduct: Product = {
      name: skuForm.name.trim(),
      sku,
      category: skuForm.category1 || 'Umum',
      unit: skuForm.unit,
      retailPrice: skuForm.standardSellPrice,
      wholesalePrice: skuForm.standardSellPrice,
      projectPrice: skuForm.minSellPrice,
      stock: 0,
      stockStatus: 'Out of Stock',
      lastRestock: new Date().toISOString().slice(0, 10),
      leadTime: '-',
      warehouseLocation: locationName,
      image: skuForm.image,
      productType: 'Induk',
      alias: skuForm.alias,
      category1: skuForm.category1,
      category2: skuForm.category2,
      category3: skuForm.category3,
      barcode: skuForm.barcode,
      costPrice: skuForm.costPrice,
      minSellPrice: skuForm.minSellPrice,
      standardSellPrice: skuForm.standardSellPrice,
      showLowStockAlert: skuForm.showLowStockAlert,
      minStockQty: skuForm.minStockQty,
      showInDeadstock: skuForm.showInDeadstock,
      deadstockPeriodMonths: skuForm.deadstockPeriodMonths,
      skuLocationId: skuForm.skuLocationId,
    };

    onUpdateProducts([newProduct, ...products]);
    onAddActivity('Produk Induk Baru', `${newProduct.name} (${sku})`, 0, 'quote');
    setSkuForm({ ...emptySkuForm, sku: generateSkuCode(), unit: units[0]?.name || '', skuLocationId: skuLocations[0]?.id || '' });
    dialog.alert(`Produk induk "${newProduct.name}" berhasil disimpan dengan SKU ${sku}.`);
  };

  const handleSubmitEceran = (e: React.FormEvent) => {
    e.preventDefault();
    const parent = products.find(p => p.sku === eceranForm.parentSku);
    if (!parent) {
      dialog.alert('Pilih produk induk terlebih dahulu.');
      return;
    }
    if (!eceranForm.conversionValue || eceranForm.conversionValue <= 0) {
      dialog.alert('Nilai konversi harus lebih dari 0.');
      return;
    }
    if (!onUpdateProducts) return;

    const sku = eceranForm.sku || generateSkuCode();
    const locationName = skuLocations.find(l => l.id === eceranForm.skuLocationId)?.name || '';

    const newProduct: Product = {
      name: `${parent.name} (${eceranForm.alias || eceranForm.unit})`,
      sku,
      category: parent.category,
      unit: eceranForm.unit,
      retailPrice: eceranForm.standardSellPrice,
      wholesalePrice: eceranForm.standardSellPrice,
      projectPrice: eceranForm.minSellPrice,
      stock: 0,
      stockStatus: 'Out of Stock',
      lastRestock: new Date().toISOString().slice(0, 10),
      leadTime: '-',
      warehouseLocation: locationName,
      image: eceranForm.image || parent.image,
      productType: 'Eceran',
      alias: eceranForm.alias,
      parentSku: parent.sku,
      conversionValue: eceranForm.conversionValue,
      barcode: eceranForm.barcode,
      costPrice: eceranForm.costPrice,
      minSellPrice: eceranForm.minSellPrice,
      standardSellPrice: eceranForm.standardSellPrice,
      showLowStockAlert: eceranForm.showLowStockAlert,
      minStockQty: eceranForm.minStockQty,
      showInDeadstock: eceranForm.showInDeadstock,
      deadstockPeriodMonths: eceranForm.deadstockPeriodMonths,
      skuLocationId: eceranForm.skuLocationId,
    };

    onUpdateProducts([newProduct, ...products]);
    onAddActivity('Produk Eceran Baru', `${newProduct.name} - konversi 1 : ${eceranForm.conversionValue} ${eceranForm.unit}`, 0, 'quote');
    setEceranForm({ ...emptyEceranForm, sku: generateSkuCode(), unit: units[0]?.name || '', skuLocationId: skuLocations[0]?.id || '' });
    dialog.alert(`Produk eceran "${newProduct.name}" berhasil disimpan dengan SKU ${sku}.`);
  };

  const handleDeleteSkuProduct = async (sku: string) => {
    if (!onUpdateProducts) return;
    const prod = products.find(p => p.sku === sku);
    const ok = await dialog.confirm('Hapus produk ini dari Sku Master?');
    if (ok) {
      onUpdateProducts(products.filter(p => p.sku !== sku));
      onAddActivity('Produk SKU Dihapus', prod ? `${prod.name} (${sku})` : sku, 0, 'overdue');
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      dialog.alert('Nama kategori tidak boleh kosong.');
      return;
    }
    const entry: CategoryEntry = { id: `CAT-${Math.floor(100 + Math.random() * 900)}`, name: newCategoryName.trim(), level: newCategoryLevel };
    persistCategories([...categories, entry]);
    onAddActivity('Kategori Produk Baru', `${entry.name} (Level ${entry.level})`, 0, 'quote');
    setNewCategoryName('');
  };

  const handleAddBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) {
      dialog.alert('Nama brand tidak boleh kosong.');
      return;
    }
    const entry: SimpleEntry = { id: `BRD-${Math.floor(100 + Math.random() * 900)}`, name: newBrandName.trim() };
    persistBrands([...brands, entry]);
    onAddActivity('Brand Baru Ditambahkan', entry.name, 0, 'quote');
    setNewBrandName('');
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) {
      dialog.alert('Nama satuan tidak boleh kosong.');
      return;
    }
    const entry: SimpleEntry = { id: `UNT-${Math.floor(100 + Math.random() * 900)}`, name: newUnitName.trim() };
    persistUnits([...units, entry]);
    onAddActivity('Satuan Baru Ditambahkan', entry.name, 0, 'quote');
    setNewUnitName('');
  };

  const handleAddItemToBundle = () => {
    const prod = products.find(p => p.sku === pickSku);
    if (!prod) {
      dialog.alert('Pilih produk terlebih dahulu.');
      return;
    }
    if (bundleItems.find(i => i.sku === prod.sku)) {
      dialog.alert('Produk ini sudah ada di dalam paket.');
      return;
    }
    setBundleItems([...bundleItems, { sku: prod.sku, name: prod.name, quantity: pickQty }]);
    setPickSku('');
    setPickQty(1);
  };

  const handleRemoveItemFromBundle = (sku: string) => {
    setBundleItems(bundleItems.filter(i => i.sku !== sku));
  };

  const resetBundleForm = () => {
    setBundleName('');
    setBundlePrice(0);
    setBundleItems([]);
    setPickSku('');
    setPickQty(1);
    setShowBundleModal(false);
  };

  const handleSaveBundle = () => {
    if (!bundleName.trim() || bundleItems.length === 0) {
      dialog.alert('Nama paket dan minimal 1 produk wajib diisi.');
      return;
    }
    const bundle: Bundle = {
      id: `BDL-${Math.floor(1000 + Math.random() * 9000)}`,
      name: bundleName.trim(),
      items: bundleItems,
      bundlePrice
    };
    persistBundles([bundle, ...bundles]);
    onAddActivity('Paket Barang Baru', `${bundle.name} (${bundle.items.length} produk)`, 0, 'quote');
    resetBundleForm();
  };

  const handleDeleteBundle = async (id: string) => {
    const b = bundles.find(x => x.id === id);
    if (!b) return;
    const ok = await dialog.confirm(`Hapus paket "${b.name}"?`);
    if (ok) {
      persistBundles(bundles.filter(x => x.id !== id));
      onAddActivity('Paket Barang Dihapus', b.name, 0, 'overdue');
    }
  };

  const levelLabel: Record<number, string> = { 1: 'Kategori 1 (Umum)', 2: 'Kategori 2', 3: 'Kategori 3 (Spesifik)' };

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-semibold text-gray-800 outline-none focus:bg-white focus:border-blue-500";
  const labelCls = "block text-[10px] text-gray-400 font-bold uppercase mb-1";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Tags className="w-5 h-5 text-blue-600" />
          Products
        </h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Sku Master, kategori, brand, satuan, dan paket (bundle) produk.</p>
      </div>

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {[
          { id: 'sku-master', label: 'Sku Master', icon: PackageSearch },
          { id: 'kategori', label: 'Kategori', icon: Tags },
          { id: 'brand', label: 'Brand', icon: Award },
          { id: 'unit', label: 'Unit', icon: Ruler },
          { id: 'bundle', label: 'Bundle', icon: PackagePlus },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === t.id ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* SKU MASTER */}
      {activeTab === 'sku-master' && (
        <div className="space-y-4">
          <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setSkuMode('induk')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${skuMode === 'induk' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              Produk Induk
            </button>
            <button
              onClick={() => setSkuMode('eceran')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${skuMode === 'eceran' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              Produk Eceran
            </button>
          </div>

          {skuMode === 'induk' && can('manage_product_add') && (
            <form onSubmit={handleSubmitInduk} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-2xl text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}><ImagePlus className="inline w-3 h-3 mr-1" />Foto Produk</label>
                  <div className="flex gap-2">
                    <input type="text" value={skuForm.image} onChange={(e) => setSkuForm({ ...skuForm, image: e.target.value })} placeholder="Tempel URL gambar..." className={inputCls} />
                    <button
                      type="button"
                      onClick={() => imageFileInputRef.current?.click()}
                      disabled={imageUploading}
                      className="px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap flex items-center gap-1 disabled:opacity-60"
                    >
                      {imageUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                    </button>
                    <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
                  </div>
                  {imageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{imageUploadError}</p>}
                  {skuForm.image && (
                    <img src={skuForm.image} alt="Preview produk" className="mt-2 w-16 h-16 object-cover rounded-lg border border-gray-200" />
                  )}
                </div>
                <div>
                  <label className={labelCls}>Nama Alias Produk</label>
                  <input type="text" value={skuForm.alias} onChange={(e) => setSkuForm({ ...skuForm, alias: e.target.value })} placeholder="Nama singkat / alias..." className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}><BarcodeIcon className="inline w-3 h-3 mr-1" />Kode SKU (otomatis)</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={skuForm.sku} className={`${inputCls} bg-gray-100 text-gray-500 cursor-not-allowed`} />
                  <button
                    type="button"
                    title="Acak ulang kode SKU"
                    onClick={() => setSkuForm({ ...skuForm, sku: generateSkuCode() })}
                    className="px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Nama Produk</label>
                <input type="text" required value={skuForm.name} onChange={(e) => setSkuForm({ ...skuForm, name: e.target.value })} placeholder="Contoh: Semen Portland 50kg" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Pilih Satuan</label>
                <select value={skuForm.unit} onChange={(e) => setSkuForm({ ...skuForm, unit: e.target.value })} className={inputCls}>
                  {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={skuForm.showLowStockAlert} onChange={(e) => setSkuForm({ ...skuForm, showLowStockAlert: e.target.checked })} />
                    Tampilkan saat stok menipis
                  </label>
                  {skuForm.showLowStockAlert && (
                    <div>
                      <label className={labelCls}>Qty Stok Minimum</label>
                      <NumberInput min={0} value={skuForm.minStockQty} onChange={(v) => setSkuForm({ ...skuForm, minStockQty: v })} className={inputCls} placeholder="0" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={skuForm.showInDeadstock} onChange={(e) => setSkuForm({ ...skuForm, showInDeadstock: e.target.checked })} />
                    Tampilkan di laporan deadstock
                  </label>
                  {skuForm.showInDeadstock && (
                    <div>
                      <label className={labelCls}>Periode (Bulan)</label>
                      <NumberInput min={1} value={skuForm.deadstockPeriodMonths} onChange={(v) => setSkuForm({ ...skuForm, deadstockPeriodMonths: v })} className={inputCls} placeholder="0" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Kategori 1</label>
                  <select value={skuForm.category1} onChange={(e) => setSkuForm({ ...skuForm, category1: e.target.value })} className={inputCls}>
                    <option value="">Pilih...</option>
                    {kategori1List.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sub Kategori 2</label>
                  <select value={skuForm.category2} onChange={(e) => setSkuForm({ ...skuForm, category2: e.target.value })} className={inputCls}>
                    <option value="">Pilih...</option>
                    {kategori2List.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sub Kategori 3</label>
                  <select value={skuForm.category3} onChange={(e) => setSkuForm({ ...skuForm, category3: e.target.value })} className={inputCls}>
                    <option value="">Pilih...</option>
                    {kategori3List.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}><BarcodeIcon className="inline w-3 h-3 mr-1" />Barcode</label>
                <div className="flex gap-2">
                  <input type="text" value={skuForm.barcode} onChange={(e) => setSkuForm({ ...skuForm, barcode: e.target.value })} placeholder="Scan atau generate barcode..." className={inputCls} />
                  <button type="button" onClick={() => setScannerTarget('induk')} className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap flex items-center gap-1">
                    <ScanLine className="w-3 h-3" /> Scan
                  </button>
                  <button type="button" onClick={() => setSkuForm({ ...skuForm, barcode: generateBarcode(skuForm.sku) })} className="px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap">
                    Generate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {can('view_cost_price') && (
                <div>
                  <label className={labelCls}>Harga Modal</label>
                  <NumberInput min={0} value={skuForm.costPrice} onChange={(v) => setSkuForm({ ...skuForm, costPrice: v })} className={inputCls} placeholder="0" />
                </div>
                )}
                <div>
                  <label className={labelCls}>Harga Jual Minimum</label>
                  <NumberInput min={0} value={skuForm.minSellPrice} onChange={(v) => setSkuForm({ ...skuForm, minSellPrice: v })} className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>Harga Jual Standard</label>
                  <NumberInput min={0} value={skuForm.standardSellPrice} onChange={(v) => setSkuForm({ ...skuForm, standardSellPrice: v })} className={inputCls} placeholder="0" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Pilih Lokasi SKU</label>
                <select value={skuForm.skuLocationId} onChange={(e) => setSkuForm({ ...skuForm, skuLocationId: e.target.value })} className={inputCls}>
                  <option value="">Pilih lokasi...</option>
                  {skuLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/15 cursor-pointer">
                Simpan Produk Induk
              </button>
            </form>
          )}

          {skuMode === 'eceran' && can('manage_product_add') && (
            <form onSubmit={handleSubmitEceran} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-2xl text-xs">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                {/* --- Kolom kiri: Produk Induk --- */}
                <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <p className="font-black text-[10px] uppercase text-gray-400 text-center">Produk Induk</p>
                  <div>
                    <label className={labelCls}>Pilih produk induk <span className="text-red-500">*</span></label>
                    <select value={eceranForm.parentSku} onChange={(e) => setEceranForm({ ...eceranForm, parentSku: e.target.value })} className={inputCls}>
                      <option value="">Pilih produk induk...</option>
                      {indukProducts.map(p => <option key={p.sku} value={p.sku}>{p.name} ({p.unit})</option>)}
                    </select>
                  </div>
                  {/* Preview produk induk yang lagi dipilih — buat konfirmasi visual
                      sebelum lanjut isi nilai konversi, sama kayak referensi desain. */}
                  <div className="border border-gray-100 rounded-lg p-2.5 space-y-1.5 bg-gray-50/60">
                    <div className="w-full aspect-square bg-white border border-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                      {selectedIndukForEceran?.image ? (
                        <img src={selectedIndukForEceran.image} alt={selectedIndukForEceran.name} className="w-full h-full object-cover" />
                      ) : (
                        <PackageOpen className="w-10 h-10 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <p className={labelCls}>Satuan</p>
                      <p className="font-bold text-gray-700">{selectedIndukForEceran?.unit || '-'}</p>
                    </div>
                    <div>
                      <p className={labelCls}>Spesifikasi</p>
                      <p className="font-bold text-gray-700">{selectedIndukForEceran?.category1 || '-'}</p>
                    </div>
                    <div>
                      <p className={labelCls}>Nama Alias</p>
                      <p className="font-bold text-gray-700">{selectedIndukForEceran?.alias || selectedIndukForEceran?.name || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* --- Panah penghubung --- */}
                <div className="flex items-center justify-center h-full pt-16">
                  <div className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

                {/* --- Kolom kanan: Produk Eceran --- */}
                <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <p className="font-black text-[10px] uppercase text-gray-400 text-center">Produk Eceran</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Nilai konversi</label>
                      <NumberInput min={1} value={eceranForm.conversionValue} onChange={(v) => setEceranForm({ ...eceranForm, conversionValue: v })} className={inputCls} placeholder="Contoh: 40" />
                    </div>
                    <div>
                      <label className={labelCls}>Pilih Satuan <span className="text-red-500">*</span></label>
                      <select value={eceranForm.unit} onChange={(e) => setEceranForm({ ...eceranForm, unit: e.target.value })} className={inputCls}>
                        {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Foto produk eceran — opsional, kalau tidak diisi ikut pakai
                      foto produk induknya (lihat handleSubmitEceran). */}
                  <div>
                    <label className={labelCls}>Foto Produk Eceran</label>
                    <button
                      type="button"
                      onClick={() => eceranImageFileInputRef.current?.click()}
                      disabled={eceranImageUploading}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors disabled:opacity-60"
                    >
                      {eceranImageUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : eceranForm.image ? (
                        <img src={eceranForm.image} alt="Preview produk eceran" className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                      <span className="text-[10px] font-bold">
                        {eceranForm.image ? 'Ganti Foto' : 'Upload Foto (Optional)'}
                      </span>
                      <span className="text-[9px] text-gray-400">Ukuran maksimal foto 5MB</span>
                    </button>
                    <input ref={eceranImageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEceranImageFileSelect} />
                    {eceranImageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{eceranImageUploadError}</p>}
                    {!eceranForm.image && (
                      <p className="text-[9px] text-gray-400 mt-1">Kosongkan untuk pakai foto produk induk.</p>
                    )}
                  </div>

                  <div>
                    <p className={labelCls}>Satuan</p>
                    <p className="font-bold text-gray-700">{eceranForm.unit || '-'}</p>
                  </div>

                  <div>
                    <label className={labelCls}>Nama Alias <span className="text-red-500">*</span></label>
                    <input type="text" required value={eceranForm.alias} onChange={(e) => setEceranForm({ ...eceranForm, alias: e.target.value })} placeholder="Isi nama alias di sini" className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-2 text-blue-700 font-bold">
                <Scale className="w-4 h-4 shrink-0" />
                Jumlah produk pecahan / 1 produk = {eceranForm.conversionValue || 0} {eceranForm.unit}
              </div>

              <div>
                <label className={labelCls}><BarcodeIcon className="inline w-3 h-3 mr-1" />Kode SKU (otomatis)</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={eceranForm.sku} className={`${inputCls} bg-gray-100 text-gray-500 cursor-not-allowed`} />
                  <button
                    type="button"
                    title="Acak ulang kode SKU"
                    onClick={() => setEceranForm({ ...eceranForm, sku: generateSkuCode() })}
                    className="px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={eceranForm.showLowStockAlert} onChange={(e) => setEceranForm({ ...eceranForm, showLowStockAlert: e.target.checked })} />
                    Tampilkan saat stok menipis
                  </label>
                  {eceranForm.showLowStockAlert && (
                    <div>
                      <label className={labelCls}>Qty Stok Minimum</label>
                      <NumberInput min={0} value={eceranForm.minStockQty} onChange={(v) => setEceranForm({ ...eceranForm, minStockQty: v })} className={inputCls} placeholder="0" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={eceranForm.showInDeadstock} onChange={(e) => setEceranForm({ ...eceranForm, showInDeadstock: e.target.checked })} />
                    Tampilkan produk di laporan deadstock
                  </label>
                  {eceranForm.showInDeadstock && (
                    <div>
                      <label className={labelCls}>Periode (Bulan)</label>
                      <NumberInput min={1} value={eceranForm.deadstockPeriodMonths} onChange={(v) => setEceranForm({ ...eceranForm, deadstockPeriodMonths: v })} className={inputCls} placeholder="0" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className={labelCls}><BarcodeIcon className="inline w-3 h-3 mr-1" />Barcode Number</label>
                <div className="flex gap-2">
                  <input type="text" value={eceranForm.barcode} onChange={(e) => setEceranForm({ ...eceranForm, barcode: e.target.value })} placeholder="Scan atau generate barcode..." className={inputCls} />
                  <button type="button" onClick={() => setScannerTarget('eceran')} className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap flex items-center gap-1">
                    <ScanLine className="w-3 h-3" /> Scan
                  </button>
                  <button type="button" onClick={() => setEceranForm({ ...eceranForm, barcode: generateBarcode(eceranForm.sku) })} className="px-3 bg-gray-900 hover:bg-black text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap">
                    Generate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {can('view_cost_price') && (
                <div>
                  <label className={labelCls}>Harga Modal</label>
                  <NumberInput min={0} value={eceranForm.costPrice} onChange={(v) => setEceranForm({ ...eceranForm, costPrice: v })} className={inputCls} placeholder="0" />
                </div>
                )}
                <div>
                  <label className={labelCls}>Harga Minimum</label>
                  <NumberInput min={0} value={eceranForm.minSellPrice} onChange={(v) => setEceranForm({ ...eceranForm, minSellPrice: v })} className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>Harga Standard</label>
                  <NumberInput min={0} value={eceranForm.standardSellPrice} onChange={(v) => setEceranForm({ ...eceranForm, standardSellPrice: v })} className={inputCls} placeholder="0" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Pilih Lokasi SKU</label>
                <select value={eceranForm.skuLocationId} onChange={(e) => setEceranForm({ ...eceranForm, skuLocationId: e.target.value })} className={inputCls}>
                  <option value="">Pilih lokasi...</option>
                  {skuLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/15 cursor-pointer">
                Simpan Produk Eceran
              </button>
            </form>
          )}

          {/* List of Sku Master products */}
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Daftar Produk Sku Master</p>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-white">
              {products.filter(p => p.productType).length === 0 ? (
                <p className="p-4 text-center text-xs text-gray-400">Belum ada produk Sku Master ditambahkan.</p>
              ) : (
                products.filter(p => p.productType).map((p) => (
                  <div key={p.sku} className="flex justify-between items-center p-3 text-xs">
                    <div>
                      <p className="font-bold text-gray-800">{p.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {p.productType === 'Induk' ? 'Produk Induk' : `Produk Eceran • 1 : ${p.conversionValue} ${p.unit}`} • {p.sku}
                      </p>
                    </div>
                    {can('manage_product_delete') && (
                      <button onClick={() => handleDeleteSkuProduct(p.sku)} className="p-1.5 text-red-400 hover:text-red-600 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* KATEGORI */}
      {activeTab === 'kategori' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-xl">
          {can('manage_product_add') && (
          <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nama kategori..."
              className="flex-1 border border-gray-200 rounded-lg p-2.5 text-xs outline-none"
            />
            <select
              value={newCategoryLevel}
              onChange={(e) => setNewCategoryLevel(Number(e.target.value) as 1 | 2 | 3)}
              className="border border-gray-200 rounded-lg p-2.5 text-xs font-bold outline-none"
            >
              <option value={1}>Kategori 1 (Umum)</option>
              <option value={2}>Kategori 2</option>
              <option value={3}>Kategori 3 (Spesifik)</option>
            </select>
            <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </form>
          )}

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {categories.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-400">Belum ada kategori.</p>
            ) : (
              categories.sort((a, b) => a.level - b.level).map((c) => (
                <div key={c.id} className="flex justify-between items-center p-3 text-xs">
                  <div>
                    <p className="font-bold text-gray-800">{c.name}</p>
                    <p className="text-[10px] text-gray-400">{levelLabel[c.level]}</p>
                  </div>
                  {can('manage_product_delete') && (
                    <button onClick={() => persistCategories(categories.filter(x => x.id !== c.id))} className="p-1.5 text-red-400 hover:text-red-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BRAND */}
      {activeTab === 'brand' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-xl">
          {can('manage_product_add') && (
          <form onSubmit={handleAddBrand} className="flex gap-2">
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="Nama brand..."
              className="flex-1 border border-gray-200 rounded-lg p-2.5 text-xs outline-none"
            />
            <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </form>
          )}
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {brands.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-400">Belum ada brand.</p>
            ) : (
              brands.map((b) => (
                <div key={b.id} className="flex justify-between items-center p-3 text-xs">
                  <p className="font-bold text-gray-800">{b.name}</p>
                  {can('manage_product_delete') && (
                    <button onClick={() => persistBrands(brands.filter(x => x.id !== b.id))} className="p-1.5 text-red-400 hover:text-red-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* UNIT */}
      {activeTab === 'unit' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-xl">
          {can('manage_product_add') && (
          <form onSubmit={handleAddUnit} className="flex gap-2">
            <input
              type="text"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              placeholder="Nama satuan (contoh: Sak, Batang, Galon)..."
              className="flex-1 border border-gray-200 rounded-lg p-2.5 text-xs outline-none"
            />
            <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </form>
          )}
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {units.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-400">Belum ada satuan.</p>
            ) : (
              units.map((u) => (
                <div key={u.id} className="flex justify-between items-center p-3 text-xs">
                  <p className="font-bold text-gray-800">{u.name}</p>
                  {can('manage_product_delete') && (
                    <button onClick={() => persistUnits(units.filter(x => x.id !== u.id))} className="p-1.5 text-red-400 hover:text-red-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BUNDLE */}
      {activeTab === 'bundle' && (
        <div className="space-y-4">
          {can('manage_product_add') && (
          <button
            onClick={() => setShowBundleModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Buat Paket Baru
          </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bundles.length === 0 ? (
              <p className="col-span-full text-center text-xs text-gray-400 py-8">Belum ada paket barang dibuat.</p>
            ) : (
              bundles.map((b) => (
                <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <PackagePlus className="w-4 h-4" />
                      </div>
                      <p className="font-extrabold text-xs text-gray-800">{b.name}</p>
                    </div>
                    {can('manage_product_delete') && (
                      <button onClick={() => handleDeleteBundle(b.id)} className="text-red-400 hover:text-red-600 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    {b.items.map((i) => (
                      <p key={i.sku}>• {i.name} x{i.quantity}</p>
                    ))}
                  </div>
                  <p className="text-sm font-black text-gray-900 pt-1 border-t border-gray-100">Rp {b.bundlePrice.toLocaleString('id-ID')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bundle Creation Modal */}
      {showBundleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-gray-900">Buat Paket Barang</h4>
              <button onClick={resetBundleForm} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Nama Paket</label>
              <input
                type="text"
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder="Contoh: Paket Renovasi Kamar Mandi"
                className="w-full border border-gray-200 rounded-lg p-2.5 text-xs font-bold outline-none"
              />
            </div>

            <div className="border border-gray-100 rounded-xl p-3 space-y-2">
              <label className="block text-[10px] text-gray-400 font-bold uppercase">Tambah Produk ke Paket</label>
              <div className="flex gap-2">
                <select
                  value={pickSku}
                  onChange={(e) => setPickSku(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg p-2 text-xs outline-none"
                >
                  <option value="">Pilih produk...</option>
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>{p.name}</option>
                  ))}
                </select>
                <NumberInput
                  min={1}
                  value={pickQty}
                  onChange={setPickQty}
                  placeholder="0"
                  className="w-16 border border-gray-200 rounded-lg p-2 text-xs text-center outline-none"
                />
                <button onClick={handleAddItemToBundle} className="px-3 bg-gray-900 hover:bg-black text-white rounded-lg cursor-pointer">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {bundleItems.map((i) => (
                  <div key={i.sku} className="flex justify-between items-center bg-gray-50 rounded-lg p-2 text-[11px]">
                    <span className="font-semibold text-gray-700">{i.name} x{i.quantity}</span>
                    <button onClick={() => handleRemoveItemFromBundle(i.sku)} className="text-red-400 hover:text-red-600 cursor-pointer">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Harga Paket (IDR)</label>
              <NumberInput
                value={bundlePrice}
                onChange={setBundlePrice}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-bold outline-none"
                placeholder="0"
              />
            </div>

            <button
              onClick={handleSaveBundle}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs cursor-pointer"
            >
              Simpan Paket
            </button>
          </div>
        </div>
      )}

      {scannerTarget && (
        <BarcodeScannerModal
          title="Scan Barcode Produk"
          onClose={() => setScannerTarget(null)}
          onDetected={handleBarcodeDetected}
        />
      )}
    </div>
  );
}
