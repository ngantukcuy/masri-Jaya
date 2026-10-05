import React from 'react';
import { Plus, RefreshCw, ScanLine, Loader2, Upload } from 'lucide-react';
import SearchableSelect from '../../../components/shared/SearchableSelect';
import NumberInput from '../../../components/shared/NumberInput';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import BarcodePreview from '../../../components/shared/BarcodePreview';

interface CreateProductModalProps {
  showCreateModal: boolean;
  setShowCreateModal: (open: boolean) => void;
  handleCreateSubmit: (e: React.FormEvent) => void;
  generateSkuCode: () => string;
  generateBarcodeCode: () => string;
  setShowSkuScanner: (open: boolean) => void;
  categoryNames: string[];
  unitNames: string[];

  formName: string;
  setFormName: (v: string) => void;
  formSku: string;
  setFormSku: (v: string) => void;
  formCategory: string;
  setFormCategory: (v: string) => void;
  formUnit: string;
  setFormUnit: (v: string) => void;
  formRetailPrice: number;
  setFormRetailPrice: (v: number) => void;
  formWholesalePrice: number;
  setFormWholesalePrice: (v: number) => void;
  formProjectPrice: number;
  setFormProjectPrice: (v: number) => void;
  formStock: number;
  setFormStock: (v: number) => void;
  formLocation: string;
  setFormLocation: (v: string) => void;
  formImage: string;
  setFormImage: (v: string) => void;

  imageUploading: boolean;
  imageUploadError: string | null;
  imageFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function CreateProductModal({
  showCreateModal,
  setShowCreateModal,
  handleCreateSubmit,
  generateSkuCode,
  generateBarcodeCode,
  setShowSkuScanner,
  categoryNames,
  unitNames,
  formName,
  setFormName,
  formSku,
  setFormSku,
  formCategory,
  setFormCategory,
  formUnit,
  setFormUnit,
  formRetailPrice,
  setFormRetailPrice,
  formWholesalePrice,
  setFormWholesalePrice,
  formProjectPrice,
  setFormProjectPrice,
  formStock,
  setFormStock,
  formLocation,
  setFormLocation,
  formImage,
  setFormImage,
  imageUploading,
  imageUploadError,
  imageFileInputRef,
  handleImageFileSelect,
}: CreateProductModalProps) {
  return (
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <Plus className="w-4 h-4" /> REGISTRASI PRODUK / MATERIAL BARU
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <Label>Kode Batang (Barcode)</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="text"
                    required
                    placeholder="Scan atau generate kode batang..."
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="font-mono flex-1 min-w-0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    title="Generate kode batang acak"
                    onClick={() => setFormSku(generateBarcodeCode())}
                    className="bg-gray-900 hover:bg-black text-white px-2.5 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    title="Scan kode batang dengan kamera"
                    onClick={() => setShowSkuScanner(true)}
                    className="px-2.5 shrink-0"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="mt-2">
                  <BarcodePreview value={formSku} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategori</Label>
                <SearchableSelect
                  value={formCategory}
                  onChange={setFormCategory}
                  options={categoryNames.map((category) => ({ value: category, label: category }))}
                  placeholder="Pilih kategori..."
                  searchPlaceholder="Cari kategori..."
                />
              </div>
              <div>
                <Label>Satuan Unit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {unitNames.map((formUnit) => (
                      <SelectItem key={formUnit} value={formUnit}>{formUnit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label>Harga Standard</Label>
                <NumberInput
                  required
                  value={formWholesalePrice}
                  onChange={setFormWholesalePrice}
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stok Awal</Label>
                <NumberInput
                  required
                  value={formStock}
                  onChange={setFormStock}
                  placeholder="0"
                  className="w-full bg-background border border-input rounded-lg p-2.5 font-bold text-foreground outline-none"
                />
              </div>
              <div>
                <Label>Lokasi Gudang / Rak</Label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: Section A - Row 02"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
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
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowCreateModal(false)}>
                Batal
              </Button>
              <Button type="submit" className="w-full">
                Simpan Produk
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  );
}
