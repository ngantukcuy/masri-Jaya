import React, { useState, useEffect, useRef } from 'react';
import {
  Tags,
  Award,
  Ruler,
  PackagePlus,
  Plus,
  Trash2,
  PackageSearch,
  Scale,
  Barcode as BarcodeIcon,
  ImagePlus,
  Upload,
  ScanLine,
  Loader2,
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
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

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

// Class dasar buat NumberInput (komponen kustom, bukan bawaan shadcn) supaya
// tampilannya tetap konsisten dengan <Input> shadcn di sekitarnya.
const numberInputCls = 'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20';

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

  // Satu-satunya tombol generate yang dipakai di form ini (baik Induk
  // maupun Eceran): formatnya "SKU-" diikuti angka acak, contoh "SKU-482913".
  const generateBarcode = () => {
    const randomDigits = String(Math.floor(100000 + Math.random() * 900000));
    return `SKU-${randomDigits}`;
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <Tags className="w-5 h-5 text-primary" />
          Products
        </h2>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">Sku Master, kategori, brand, satuan, dan paket (bundle) produk.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-muted rounded-xl p-1 border-none gap-0 w-fit flex-wrap h-auto">
          {[
            { id: 'sku-master', label: 'Sku Master', icon: PackageSearch },
            { id: 'kategori', label: 'Kategori', icon: Tags },
            { id: 'brand', label: 'Brand', icon: Award },
            { id: 'unit', label: 'Unit', icon: Ruler },
            { id: 'bundle', label: 'Bundle', icon: PackagePlus },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-none data-[state=active]:bg-background data-[state=active]:shadow data-[state=active]:text-primary uppercase tracking-wider"
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* SKU MASTER */}
      {activeTab === 'sku-master' && (
        <div className="space-y-4">
          <Tabs value={skuMode} onValueChange={(v) => setSkuMode(v as any)}>
            <TabsList className="bg-muted rounded-xl p-1 border-none gap-0 w-fit h-auto">
              <TabsTrigger value="induk" className="px-4 py-2 rounded-lg border-none data-[state=active]:bg-background data-[state=active]:shadow data-[state=active]:text-primary uppercase tracking-wider">
                Produk Induk
              </TabsTrigger>
              <TabsTrigger value="eceran" className="px-4 py-2 rounded-lg border-none data-[state=active]:bg-background data-[state=active]:shadow data-[state=active]:text-primary uppercase tracking-wider">
                Produk Eceran
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {skuMode === 'induk' && can('manage_product_add') && (
            <form onSubmit={handleSubmitInduk} className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4 max-w-2xl text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label><ImagePlus className="inline w-3 h-3 mr-1" />Foto Produk</Label>
                  <div className="flex gap-2">
                    <Input type="text" value={skuForm.image} onChange={(e) => setSkuForm({ ...skuForm, image: e.target.value })} placeholder="Tempel URL gambar..." />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => imageFileInputRef.current?.click()}
                      disabled={imageUploading}
                      className="bg-gray-900 hover:bg-black text-white whitespace-nowrap"
                    >
                      {imageUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                    </Button>
                    <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
                  </div>
                  {imageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{imageUploadError}</p>}
                  {skuForm.image && (
                    <img src={skuForm.image} alt="Preview produk" className="mt-2 w-16 h-16 object-cover rounded-lg border border-border" />
                  )}
                </div>
                <div>
                  <Label>Nama Alias Produk</Label>
                  <Input type="text" value={skuForm.alias} onChange={(e) => setSkuForm({ ...skuForm, alias: e.target.value })} placeholder="Nama singkat / alias..." />
                </div>
              </div>

              <div>
                <Label><BarcodeIcon className="inline w-3 h-3 mr-1" />Kode SKU (otomatis)</Label>
                <Input type="text" readOnly value={skuForm.sku} className="bg-muted text-muted-foreground cursor-not-allowed" />
              </div>

              <div>
                <Label>Nama Produk</Label>
                <Input type="text" required value={skuForm.name} onChange={(e) => setSkuForm({ ...skuForm, name: e.target.value })} placeholder="Contoh: Semen Portland 50kg" />
              </div>

              <div>
                <Label>Pilih Satuan</Label>
                <Select value={skuForm.unit} onValueChange={(v) => setSkuForm({ ...skuForm, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-muted rounded-xl p-3 border border-border">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-bold text-foreground/80 cursor-pointer">
                    <Checkbox checked={skuForm.showLowStockAlert} onCheckedChange={(v) => setSkuForm({ ...skuForm, showLowStockAlert: v === true })} />
                    Tampilkan saat stok menipis
                  </label>
                  {skuForm.showLowStockAlert && (
                    <div>
                      <Label>Qty Stok Minimum</Label>
                      <NumberInput min={0} value={skuForm.minStockQty} onChange={(v) => setSkuForm({ ...skuForm, minStockQty: v })} className={numberInputCls} placeholder="0" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-bold text-foreground/80 cursor-pointer">
                    <Checkbox checked={skuForm.showInDeadstock} onCheckedChange={(v) => setSkuForm({ ...skuForm, showInDeadstock: v === true })} />
                    Tampilkan di laporan deadstock
                  </label>
                  {skuForm.showInDeadstock && (
                    <div>
                      <Label>Periode (Bulan)</Label>
                      <NumberInput min={1} value={skuForm.deadstockPeriodMonths} onChange={(v) => setSkuForm({ ...skuForm, deadstockPeriodMonths: v })} className={numberInputCls} placeholder="0" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Kategori 1</Label>
                  <Select value={skuForm.category1} onValueChange={(v) => setSkuForm({ ...skuForm, category1: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {kategori1List.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sub Kategori 2</Label>
                  <Select value={skuForm.category2} onValueChange={(v) => setSkuForm({ ...skuForm, category2: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {kategori2List.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sub Kategori 3</Label>
                  <Select value={skuForm.category3} onValueChange={(v) => setSkuForm({ ...skuForm, category3: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {kategori3List.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label><BarcodeIcon className="inline w-3 h-3 mr-1" />Barcode</Label>
                <div className="flex gap-2">
                  <Input type="text" value={skuForm.barcode} onChange={(e) => setSkuForm({ ...skuForm, barcode: e.target.value })} placeholder="Scan atau generate barcode..." />
                  <Button type="button" onClick={() => setScannerTarget('induk')} className="whitespace-nowrap">
                    <ScanLine className="w-3 h-3" /> Scan
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setSkuForm({ ...skuForm, barcode: generateBarcode() })} className="bg-gray-900 hover:bg-black text-white whitespace-nowrap">
                    Generate
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {can('view_cost_price') && (
                <div>
                  <Label>Harga Modal</Label>
                  <NumberInput min={0} value={skuForm.costPrice} onChange={(v) => setSkuForm({ ...skuForm, costPrice: v })} className={numberInputCls} placeholder="0" />
                </div>
                )}
                <div>
                  <Label>Harga Jual Minimum</Label>
                  <NumberInput min={0} value={skuForm.minSellPrice} onChange={(v) => setSkuForm({ ...skuForm, minSellPrice: v })} className={numberInputCls} placeholder="0" />
                </div>
                <div>
                  <Label>Harga Jual Standard</Label>
                  <NumberInput min={0} value={skuForm.standardSellPrice} onChange={(v) => setSkuForm({ ...skuForm, standardSellPrice: v })} className={numberInputCls} placeholder="0" />
                </div>
              </div>

              <div>
                <Label>Pilih Lokasi SKU</Label>
                <Select value={skuForm.skuLocationId} onValueChange={(v) => setSkuForm({ ...skuForm, skuLocationId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih lokasi..." /></SelectTrigger>
                  <SelectContent>
                    {skuLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" size="lg" className="w-full">
                Simpan Produk Induk
              </Button>
            </form>
          )}

          {skuMode === 'eceran' && can('manage_product_add') && (
            <form onSubmit={handleSubmitEceran} className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4 max-w-2xl text-xs">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                {/* --- Kolom kiri: Produk Induk --- */}
                <div className="border border-border rounded-xl p-3 space-y-2">
                  <p className="font-black text-[10px] uppercase text-muted-foreground text-center">Produk Induk</p>
                  <div>
                    <Label>Pilih produk induk <span className="text-red-500">*</span></Label>
                    <Select value={eceranForm.parentSku} onValueChange={(v) => setEceranForm({ ...eceranForm, parentSku: v })}>
                      <SelectTrigger><SelectValue placeholder="Pilih produk induk..." /></SelectTrigger>
                      <SelectContent>
                        {indukProducts.map(p => <SelectItem key={p.sku} value={p.sku}>{p.name} ({p.unit})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Preview produk induk yang lagi dipilih — buat konfirmasi visual
                      sebelum lanjut isi nilai konversi, sama kayak referensi desain. */}
                  <div className="border border-border rounded-lg p-2.5 space-y-1.5 bg-muted/60">
                    <div className="w-full aspect-square bg-card border border-border rounded-lg flex items-center justify-center overflow-hidden">
                      {selectedIndukForEceran?.image ? (
                        <img src={selectedIndukForEceran.image} alt={selectedIndukForEceran.name} className="w-full h-full object-cover" />
                      ) : (
                        <PackageOpen className="w-10 h-10 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <Label className="mb-0">Satuan</Label>
                      <p className="font-bold text-foreground/80">{selectedIndukForEceran?.unit || '-'}</p>
                    </div>
                    <div>
                      <Label className="mb-0">Spesifikasi</Label>
                      <p className="font-bold text-foreground/80">{selectedIndukForEceran?.category1 || '-'}</p>
                    </div>
                    <div>
                      <Label className="mb-0">Nama Alias</Label>
                      <p className="font-bold text-foreground/80">{selectedIndukForEceran?.alias || selectedIndukForEceran?.name || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* --- Panah penghubung --- */}
                <div className="flex items-center justify-center h-full pt-16">
                  <div className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

                {/* --- Kolom kanan: Produk Eceran --- */}
                <div className="border border-border rounded-xl p-3 space-y-2">
                  <p className="font-black text-[10px] uppercase text-muted-foreground text-center">Produk Eceran</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Nilai konversi</Label>
                      <NumberInput min={1} value={eceranForm.conversionValue} onChange={(v) => setEceranForm({ ...eceranForm, conversionValue: v })} className={numberInputCls} placeholder="Contoh: 40" />
                    </div>
                    <div>
                      <Label>Pilih Satuan <span className="text-red-500">*</span></Label>
                      <Select value={eceranForm.unit} onValueChange={(v) => setEceranForm({ ...eceranForm, unit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {units.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Foto produk eceran — opsional, kalau tidak diisi ikut pakai
                      foto produk induknya (lihat handleSubmitEceran). */}
                  <div>
                    <Label>Foto Produk Eceran</Label>
                    <button
                      type="button"
                      onClick={() => eceranImageFileInputRef.current?.click()}
                      disabled={eceranImageUploading}
                      className="w-full border-2 border-dashed border-border rounded-xl py-4 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors disabled:opacity-60"
                    >
                      {eceranImageUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : eceranForm.image ? (
                        <img src={eceranForm.image} alt="Preview produk eceran" className="w-12 h-12 object-cover rounded-lg border border-border" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                      <span className="text-[10px] font-bold">
                        {eceranForm.image ? 'Ganti Foto' : 'Upload Foto (Optional)'}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Ukuran maksimal foto 5MB</span>
                    </button>
                    <input ref={eceranImageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEceranImageFileSelect} />
                    {eceranImageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{eceranImageUploadError}</p>}
                    {!eceranForm.image && (
                      <p className="text-[9px] text-muted-foreground mt-1">Kosongkan untuk pakai foto produk induk.</p>
                    )}
                  </div>

                  <div>
                    <Label className="mb-0">Satuan</Label>
                    <p className="font-bold text-foreground/80">{eceranForm.unit || '-'}</p>
                  </div>

                  <div>
                    <Label>Nama Alias <span className="text-red-500">*</span></Label>
                    <Input type="text" required value={eceranForm.alias} onChange={(e) => setEceranForm({ ...eceranForm, alias: e.target.value })} placeholder="Isi nama alias di sini" />
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-center gap-2 text-primary font-bold">
                <Scale className="w-4 h-4 shrink-0" />
                Jumlah produk pecahan / 1 produk = {eceranForm.conversionValue || 0} {eceranForm.unit}
              </div>

              <div>
                <Label><BarcodeIcon className="inline w-3 h-3 mr-1" />Kode SKU (otomatis)</Label>
                <Input type="text" readOnly value={eceranForm.sku} className="bg-muted text-muted-foreground cursor-not-allowed" />
              </div>

              <div className="grid grid-cols-2 gap-4 bg-muted rounded-xl p-3 border border-border">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-bold text-foreground/80 cursor-pointer">
                    <Checkbox checked={eceranForm.showLowStockAlert} onCheckedChange={(v) => setEceranForm({ ...eceranForm, showLowStockAlert: v === true })} />
                    Tampilkan saat stok menipis
                  </label>
                  {eceranForm.showLowStockAlert && (
                    <div>
                      <Label>Qty Stok Minimum</Label>
                      <NumberInput min={0} value={eceranForm.minStockQty} onChange={(v) => setEceranForm({ ...eceranForm, minStockQty: v })} className={numberInputCls} placeholder="0" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 font-bold text-foreground/80 cursor-pointer">
                    <Checkbox checked={eceranForm.showInDeadstock} onCheckedChange={(v) => setEceranForm({ ...eceranForm, showInDeadstock: v === true })} />
                    Tampilkan produk di laporan deadstock
                  </label>
                  {eceranForm.showInDeadstock && (
                    <div>
                      <Label>Periode (Bulan)</Label>
                      <NumberInput min={1} value={eceranForm.deadstockPeriodMonths} onChange={(v) => setEceranForm({ ...eceranForm, deadstockPeriodMonths: v })} className={numberInputCls} placeholder="0" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label><BarcodeIcon className="inline w-3 h-3 mr-1" />Barcode Number</Label>
                <div className="flex gap-2">
                  <Input type="text" value={eceranForm.barcode} onChange={(e) => setEceranForm({ ...eceranForm, barcode: e.target.value })} placeholder="Scan atau generate barcode..." />
                  <Button type="button" onClick={() => setScannerTarget('eceran')} className="whitespace-nowrap">
                    <ScanLine className="w-3 h-3" /> Scan
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEceranForm({ ...eceranForm, barcode: generateBarcode() })} className="bg-gray-900 hover:bg-black text-white whitespace-nowrap">
                    Generate
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {can('view_cost_price') && (
                <div>
                  <Label>Harga Modal</Label>
                  <NumberInput min={0} value={eceranForm.costPrice} onChange={(v) => setEceranForm({ ...eceranForm, costPrice: v })} className={numberInputCls} placeholder="0" />
                </div>
                )}
                <div>
                  <Label>Harga Minimum</Label>
                  <NumberInput min={0} value={eceranForm.minSellPrice} onChange={(v) => setEceranForm({ ...eceranForm, minSellPrice: v })} className={numberInputCls} placeholder="0" />
                </div>
                <div>
                  <Label>Harga Standard</Label>
                  <NumberInput min={0} value={eceranForm.standardSellPrice} onChange={(v) => setEceranForm({ ...eceranForm, standardSellPrice: v })} className={numberInputCls} placeholder="0" />
                </div>
              </div>

              <div>
                <Label>Pilih Lokasi SKU</Label>
                <Select value={eceranForm.skuLocationId} onValueChange={(v) => setEceranForm({ ...eceranForm, skuLocationId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih lokasi..." /></SelectTrigger>
                  <SelectContent>
                    {skuLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" size="lg" className="w-full">
                Simpan Produk Eceran
              </Button>
            </form>
          )}

          {/* List of Sku Master products */}
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Daftar Produk Sku Master</p>
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
              {products.filter(p => p.productType).length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">Belum ada produk Sku Master ditambahkan.</p>
              ) : (
                products.filter(p => p.productType).map((p) => (
                  <div key={p.sku} className="flex justify-between items-center p-3 text-xs">
                    <div>
                      <p className="font-bold text-foreground/80">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.productType === 'Induk' ? 'Produk Induk' : `Produk Eceran • 1 : ${p.conversionValue} ${p.unit}`} • {p.sku}
                      </p>
                    </div>
                    {can('manage_product_delete') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSkuProduct(p.sku)} className="text-red-400 hover:text-red-600 h-7 w-7">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4 max-w-xl">
          {can('manage_product_add') && (
          <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nama kategori..."
              className="flex-1"
            />
            <Select value={String(newCategoryLevel)} onValueChange={(v) => setNewCategoryLevel(Number(v) as 1 | 2 | 3)}>
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Kategori 1 (Umum)</SelectItem>
                <SelectItem value="2">Kategori 2</SelectItem>
                <SelectItem value="3">Kategori 3 (Spesifik)</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </Button>
          </form>
          )}

          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {categories.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Belum ada kategori.</p>
            ) : (
              categories.sort((a, b) => a.level - b.level).map((c) => (
                <div key={c.id} className="flex justify-between items-center p-3 text-xs">
                  <div>
                    <p className="font-bold text-foreground/80">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{levelLabel[c.level]}</p>
                  </div>
                  {can('manage_product_delete') && (
                    <Button variant="ghost" size="icon" onClick={() => persistCategories(categories.filter(x => x.id !== c.id))} className="text-red-400 hover:text-red-600 h-7 w-7">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BRAND */}
      {activeTab === 'brand' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4 max-w-xl">
          {can('manage_product_add') && (
          <form onSubmit={handleAddBrand} className="flex gap-2">
            <Input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="Nama brand..."
              className="flex-1"
            />
            <Button type="submit">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </Button>
          </form>
          )}
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {brands.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Belum ada brand.</p>
            ) : (
              brands.map((b) => (
                <div key={b.id} className="flex justify-between items-center p-3 text-xs">
                  <p className="font-bold text-foreground/80">{b.name}</p>
                  {can('manage_product_delete') && (
                    <Button variant="ghost" size="icon" onClick={() => persistBrands(brands.filter(x => x.id !== b.id))} className="text-red-400 hover:text-red-600 h-7 w-7">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* UNIT */}
      {activeTab === 'unit' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4 max-w-xl">
          {can('manage_product_add') && (
          <form onSubmit={handleAddUnit} className="flex gap-2">
            <Input
              type="text"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              placeholder="Nama satuan (contoh: Sak, Batang, Galon)..."
              className="flex-1"
            />
            <Button type="submit">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </Button>
          </form>
          )}
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {units.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Belum ada satuan.</p>
            ) : (
              units.map((u) => (
                <div key={u.id} className="flex justify-between items-center p-3 text-xs">
                  <p className="font-bold text-foreground/80">{u.name}</p>
                  {can('manage_product_delete') && (
                    <Button variant="ghost" size="icon" onClick={() => persistUnits(units.filter(x => x.id !== u.id))} className="text-red-400 hover:text-red-600 h-7 w-7">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
          <Button onClick={() => setShowBundleModal(true)}>
            <Plus className="w-4 h-4" /> Buat Paket Baru
          </Button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bundles.length === 0 ? (
              <p className="col-span-full text-center text-xs text-muted-foreground py-8">Belum ada paket barang dibuat.</p>
            ) : (
              bundles.map((b) => (
                <div key={b.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <PackagePlus className="w-4 h-4" />
                      </div>
                      <p className="font-extrabold text-xs text-foreground/80">{b.name}</p>
                    </div>
                    {can('manage_product_delete') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteBundle(b.id)} className="text-red-400 hover:text-red-600 h-7 w-7">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    {b.items.map((i) => (
                      <p key={i.sku}>• {i.name} x{i.quantity}</p>
                    ))}
                  </div>
                  <p className="text-sm font-black text-foreground pt-1 border-t border-border">Rp {b.bundlePrice.toLocaleString('id-ID')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bundle Creation Modal */}
      <Dialog open={showBundleModal} onOpenChange={(open) => !open && resetBundleForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm text-foreground normal-case tracking-normal">Buat Paket Barang</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nama Paket</Label>
              <Input
                type="text"
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder="Contoh: Paket Renovasi Kamar Mandi"
              />
            </div>

            <div className="border border-border rounded-xl p-3 space-y-2">
              <Label className="mb-0">Tambah Produk ke Paket</Label>
              <div className="flex gap-2">
                <Select value={pickSku} onValueChange={setPickSku}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih produk..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.sku} value={p.sku}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <NumberInput
                  min={1}
                  value={pickQty}
                  onChange={setPickQty}
                  placeholder="0"
                  className={`w-16 text-center ${numberInputCls}`}
                />
                <Button type="button" onClick={handleAddItemToBundle} className="bg-gray-900 hover:bg-black">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {bundleItems.map((i) => (
                  <div key={i.sku} className="flex justify-between items-center bg-muted rounded-lg p-2 text-[11px]">
                    <span className="font-semibold text-foreground/80">{i.name} x{i.quantity}</span>
                    <button onClick={() => handleRemoveItemFromBundle(i.sku)} className="text-red-400 hover:text-red-600 cursor-pointer">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Harga Paket (IDR)</Label>
              <NumberInput
                value={bundlePrice}
                onChange={setBundlePrice}
                className={numberInputCls}
                placeholder="0"
              />
            </div>

            <Button onClick={handleSaveBundle} size="lg" className="w-full">
              Simpan Paket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
