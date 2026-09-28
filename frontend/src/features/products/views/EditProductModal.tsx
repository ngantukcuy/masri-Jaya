import React from 'react';
import { Edit3, Loader2, Upload } from 'lucide-react';
import { Supplier, SkuLocation, Product, SellUnit } from '../../../types';
import SearchableSelect from '../../../components/shared/SearchableSelect';
import SellUnitsField from '../../../components/shared/SellUnitsField';
import NumberInput from '../../../components/shared/NumberInput';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Checkbox } from '../../../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';

interface CategoryOption {
  name: string;
}

interface EditProductModalProps {
  showEditModal: boolean;
  setShowEditModal: (open: boolean) => void;
  handleEditSubmit: (e: React.FormEvent) => void;

  suppliers: Supplier[];
  productBrands: { id: string; name: string }[];
  unitNames: string[];
  kategori1List: CategoryOption[];
  kategori2List: CategoryOption[];
  kategori3List: CategoryOption[];
  skuLocations: SkuLocation[];

  formAlias: string;
  setFormAlias: (v: string) => void;
  formSku: string;
  formName: string;
  setFormName: (v: string) => void;
  formSupplier: string;
  setFormSupplier: (v: string) => void;
  formBrand: string;
  setFormBrand: (v: string) => void;
  formUnit: string;
  setFormUnit: (v: string) => void;
  formShowLowStockAlert: boolean;
  setFormShowLowStockAlert: (v: boolean) => void;
  formMinStockQty: number;
  setFormMinStockQty: (v: number) => void;
  formShowInDeadstock: boolean;
  setFormShowInDeadstock: (v: boolean) => void;
  formDeadstockPeriodMonths: number;
  setFormDeadstockPeriodMonths: (v: number) => void;
  formCategory: string;
  setFormCategory: (v: string) => void;
  formCategory2: string;
  setFormCategory2: (v: string) => void;
  formCategory3: string;
  setFormCategory3: (v: string) => void;
  formRetailPrice: number;
  setFormRetailPrice: (v: number) => void;
  formWholesalePrice: number;
  setFormWholesalePrice: (v: number) => void;
  formProjectPrice: number;
  setFormProjectPrice: (v: number) => void;
  formStock: number;
  setFormStock: (v: number) => void;
  /** Daftar produk — dipakai memilih "stok diambil dari" untuk varian takaran (pickup besar/kecil). */
  products: Product[];
  formStockSourceSku: string;
  setFormStockSourceSku: (v: string) => void;
  formStockPerUnit: number;
  setFormStockPerUnit: (v: number) => void;
  formAllowDecimalQty: boolean;
  setFormAllowDecimalQty: (v: boolean) => void;
  formSellUnits: SellUnit[];
  setFormSellUnits: (v: SellUnit[]) => void;
  formLocation: string;
  setFormLocation: (v: string) => void;
  formImage: string;
  setFormImage: (v: string) => void;

  imageUploading: boolean;
  imageUploadError: string | null;
  imageFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function EditProductModal({
  showEditModal,
  setShowEditModal,
  handleEditSubmit,
  suppliers,
  productBrands,
  unitNames,
  kategori1List,
  kategori2List,
  kategori3List,
  skuLocations,
  formAlias,
  setFormAlias,
  formSku,
  formName,
  setFormName,
  formSupplier,
  setFormSupplier,
  formBrand,
  setFormBrand,
  formUnit,
  setFormUnit,
  formShowLowStockAlert,
  setFormShowLowStockAlert,
  formMinStockQty,
  setFormMinStockQty,
  formShowInDeadstock,
  setFormShowInDeadstock,
  formDeadstockPeriodMonths,
  setFormDeadstockPeriodMonths,
  formCategory,
  setFormCategory,
  formCategory2,
  setFormCategory2,
  formCategory3,
  setFormCategory3,
  formRetailPrice,
  setFormRetailPrice,
  formWholesalePrice,
  setFormWholesalePrice,
  formProjectPrice,
  setFormProjectPrice,
  formStock,
  setFormStock,
  products,
  formStockSourceSku,
  setFormStockSourceSku,
  formStockPerUnit,
  setFormStockPerUnit,
  formAllowDecimalQty,
  setFormAllowDecimalQty,
  formSellUnits,
  setFormSellUnits,
  formLocation,
  setFormLocation,
  formImage,
  setFormImage,
  imageUploading,
  imageUploadError,
  imageFileInputRef,
  handleImageFileSelect,
}: EditProductModalProps) {
  return (
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-600">
              <Edit3 className="w-4 h-4" /> EDIT INFORMASI MATERIAL / PRODUK
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nama Alias Produk</Label>
                <Input type="text" placeholder="Nama singkat / alias..." value={formAlias} onChange={(e) => setFormAlias(e.target.value)} />
              </div>
              <div>
                <Label>Kode SKU (Tidak Dapat Diubah)</Label>
                <Input type="text" disabled value={formSku} className="font-mono bg-muted text-muted-foreground cursor-not-allowed" />
              </div>
            </div>

            <div>
              <Label>Nama Produk / Material</Label>
              <Input
                type="text"
                required
                placeholder="Contoh: Semen Gresik 50kg..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Supplier</Label>
                <SearchableSelect
                  value={formSupplier}
                  onChange={setFormSupplier}
                  options={suppliers.map((s) => ({ value: s.name, label: s.name }))}
                  placeholder="Pilih Supplier..."
                  searchPlaceholder="Cari supplier..."
                />
              </div>
              <div>
                <Label>Brand Produk</Label>
                <SearchableSelect
                  value={formBrand}
                  onChange={setFormBrand}
                  options={productBrands.map((b) => ({ value: b.name, label: b.name }))}
                  placeholder="Pilih Brand..."
                  searchPlaceholder="Cari brand..."
                />
              </div>
            </div>

            <div>
              <Label>Satuan Unit</Label>
              <SearchableSelect
                value={formUnit}
                onChange={setFormUnit}
                options={unitNames.map((u) => ({ value: u, label: u }))}
                placeholder="Pilih satuan..."
                searchPlaceholder="Cari satuan..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4 bg-muted rounded-xl p-3 border border-border">
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-bold text-foreground/80 cursor-pointer">
                  <Checkbox checked={formShowLowStockAlert} onCheckedChange={(v) => setFormShowLowStockAlert(v === true)} />
                  Tampilkan saat stok menipis
                </label>
                {formShowLowStockAlert && (
                  <div>
                    <Label>Qty Stok Minimum</Label>
                    <NumberInput min={0} value={formMinStockQty} onChange={setFormMinStockQty} placeholder="0" className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-bold text-foreground/80 cursor-pointer">
                  <Checkbox checked={formShowInDeadstock} onCheckedChange={(v) => setFormShowInDeadstock(v === true)} />
                  Tampilkan di laporan deadstock
                </label>
                {formShowInDeadstock && (
                  <div>
                    <Label>Periode (Bulan)</Label>
                    <NumberInput min={1} value={formDeadstockPeriodMonths} onChange={setFormDeadstockPeriodMonths} placeholder="0" className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none" />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Kategori 1</Label>
                <SearchableSelect
                  value={formCategory}
                  onChange={setFormCategory}
                  options={kategori1List.map((c) => ({ value: c.name, label: c.name }))}
                  placeholder="Pilih..."
                  searchPlaceholder="Cari kategori..."
                />
              </div>
              <div>
                <Label>Sub Kategori 2</Label>
                <SearchableSelect
                  value={formCategory2}
                  onChange={setFormCategory2}
                  options={kategori2List.map((c) => ({ value: c.name, label: c.name }))}
                  placeholder="Pilih..."
                  searchPlaceholder="Cari sub kategori..."
                />
              </div>
              <div>
                <Label>Sub Kategori 3</Label>
                <SearchableSelect
                  value={formCategory3}
                  onChange={setFormCategory3}
                  options={kategori3List.map((c) => ({ value: c.name, label: c.name }))}
                  placeholder="Pilih..."
                  searchPlaceholder="Cari sub kategori..."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Harga Modal</Label>
                <NumberInput
                  required
                  value={formRetailPrice}
                  onChange={setFormRetailPrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Harga Minimum</Label>
                <NumberInput
                  required
                  max={formWholesalePrice || undefined}
                  value={formProjectPrice}
                  onChange={setFormProjectPrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Harga Standard</Label>
                <NumberInput
                  required
                  value={formWholesalePrice}
                  onChange={setFormWholesalePrice}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div>
                <p className="text-xs font-black text-foreground">Varian Takaran (pickup besar / kecil)</p>
                <p className="text-[10px] text-muted-foreground">Kosongkan kalau produk ini punya stok sendiri. Isi kalau produk ini hanya takaran jual dari tumpukan stok lain (mis. &quot;Pasir Pickup Besar&quot; diambil dari &quot;Pasir&quot; yang stoknya dalam kubik).</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stok Diambil Dari</Label>
                  <SearchableSelect
                    value={formStockSourceSku}
                    onChange={setFormStockSourceSku}
                    options={[{ value: '', label: '— Stok sendiri —' }, ...products.filter((p) => p.sku !== formSku && !p.stockSourceSku).map((p) => ({ value: p.sku, label: `${p.name} (${p.unit})` }))]}
                    placeholder="Pilih produk sumber..."
                    searchPlaceholder="Cari produk..."
                  />
                </div>
                <div>
                  <Label>Pemakaian per 1 Unit Terjual</Label>
                  <NumberInput
                    allowDecimal
                    disabled={!formStockSourceSku}
                    value={formStockPerUnit}
                    onChange={setFormStockPerUnit}
                    placeholder="Contoh: 1,2"
                    className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Pickup besar = 1,2 • pickup kecil = 0,5 (satuan sumber, mis. kubik)</p>
                </div>
              </div>
            </div>

            <SellUnitsField
              unit={formUnit}
              allow={formAllowDecimalQty}
              onAllowChange={setFormAllowDecimalQty}
              sellUnits={formSellUnits}
              onSellUnitsChange={setFormSellUnits}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{formStockSourceSku ? 'Stok Tersedia (otomatis dari sumber)' : 'Stok Gudang'}</Label>
                <NumberInput
                  required={!formStockSourceSku}
                  disabled={!!formStockSourceSku}
                  allowDecimal
                  value={formStock}
                  onChange={setFormStock}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Untuk pasir/kerikil/tanah isi dalam kubik, boleh desimal (contoh: 9,6).</p>
              </div>
              <div>
                <Label>Lokasi Gudang / Rak</Label>
                <SearchableSelect
                  value={formLocation}
                  onChange={setFormLocation}
                  options={skuLocations.map((l) => ({ value: l.name, label: l.name }))}
                  placeholder="Pilih lokasi..."
                  searchPlaceholder="Cari lokasi..."
                />
              </div>
            </div>

            <div>
              <Label>Foto Produk</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Tempel URL gambar produk..."
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                />
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
              {formImage && (
                <img src={formImage} alt="Preview produk" className="mt-2 w-14 h-14 object-cover rounded-lg border border-border" />
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowEditModal(false)}>
                Batal
              </Button>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  );
}
