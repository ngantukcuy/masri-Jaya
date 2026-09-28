import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import NumberInput from '../../../components/shared/NumberInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Product } from '../../../types';
import { fractionLabel, formatQty, lineAmount, roundQty } from '../../../lib/quantity';

interface QuantityPickerModalProps {
  product: Product;
  /** Harga per satuan dasar (`product.unit`) yang akan dipakai untuk baris baru. */
  price: number;
  /** Sisa stok yang masih bisa dijual (satuan dasar), sudah dikurangi isi keranjang. */
  available: number;
  /** Jumlah produk ini yang sudah ada di keranjang (satuan dasar) — hanya info. */
  inCart: number;
  onClose: () => void;
  /** Dipanggil dengan jumlah dalam SATUAN DASAR (mis. 0,25 batang untuk "1 meter")
   * dan total harga untuk jumlah itu (sudah memakai harga satuan jual kalau ada). */
  onConfirm: (qtyInBaseUnit: number, total: number) => void;
}

const BASE_PRESETS = [0.25, 0.5, 0.75, 1, 2, 5];
const OTHER_PRESETS = [1, 2, 3, 5, 10];

/**
 * Pop-up "mau beli berapa" untuk produk yang boleh dijual pecahan
 * (product.allowDecimalQty). Satu SKU bisa dijual ½ kg, ¼ kg, 1 ons,
 * ½ batang, per meter, dst — tanpa bikin SKU terpisah per ukuran.
 */
export default function QuantityPickerModal({
  product,
  price,
  available,
  inCart,
  onClose,
  onConfirm,
}: QuantityPickerModalProps) {
  const options = useMemo(
    () => [
      { label: product.unit, factor: 1, price: 0 },
      ...(product.sellUnits || [])
        .filter((u) => u.label.trim() && u.factor > 0)
        .map((u) => ({ label: u.label.trim(), factor: u.factor, price: u.price || 0 })),
    ],
    [product.unit, product.sellUnits]
  );

  const [unitIdx, setUnitIdx] = useState(0);
  const [amount, setAmount] = useState<number>(0);

  const current = options[unitIdx] || options[0];
  const presets = unitIdx === 0 ? BASE_PRESETS : OTHER_PRESETS;

  // Jumlah dalam satuan dasar — inilah yang masuk keranjang & memotong stok.
  const qtyBase = roundQty(amount * current.factor);
  // Satuan jual dengan harga sendiri (mis. 1 ons = Rp 3.500) dihitung dari
  // harganya; selain itu proporsional dari harga per satuan dasar.
  const hasOwnPrice = unitIdx !== 0 && current.price > 0;
  const total = hasOwnPrice ? Math.round(amount * current.price) : lineAmount(price, qtyBase);
  const remaining = roundQty(available - qtyBase);
  const overStock = qtyBase > available + 1e-9;
  const canSubmit = qtyBase > 0 && !overStock;

  const submit = () => {
    if (canSubmit) onConfirm(qtyBase, total);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <Scale className="w-4 h-4" /> Mau beli berapa?
          </DialogTitle>
        </DialogHeader>

        <div
          className="space-y-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        >
          <div className="text-center space-y-0.5">
            <p className="text-sm font-black text-foreground">{product.name}</p>
            <p className="text-[11px] text-muted-foreground font-bold">
              Rp {price.toLocaleString('id-ID')} / {product.unit} • Stok tersedia {formatQty(available)} {product.unit}
            </p>
            {inCart > 0 && (
              <p className="text-[10px] text-amber-600 font-bold">
                Sudah di keranjang: {formatQty(inCart)} {product.unit} (jumlah baru akan ditambahkan)
              </p>
            )}
          </div>

          {options.length > 1 && (
            <div className="space-y-1.5">
              <Label>Beli dalam satuan</Label>
              <div className="flex flex-wrap gap-1.5">
                {options.map((opt, idx) => (
                  <button
                    key={`${opt.label}-${idx}`}
                    type="button"
                    onClick={() => {
                      setUnitIdx(idx);
                      setAmount(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                      idx === unitIdx
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-muted/50 hover:bg-primary/5 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {opt.label}
                    {opt.price > 0 && (
                      <span className="block text-[9px] font-semibold opacity-80">Rp {opt.price.toLocaleString('id-ID')}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className={`py-2 px-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                  amount === p
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border bg-muted/50 hover:bg-primary/5 hover:border-primary hover:text-primary'
                }`}
              >
                {fractionLabel(p)} {current.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Atau ketik jumlah ({current.label})</Label>
            <NumberInput
              allowDecimal
              autoFocus
              value={amount}
              onChange={setAmount}
              placeholder="Contoh: 1,5"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-right font-black text-lg text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
            />
          </div>

          <div
            className={`rounded-xl p-3 text-center border ${
              overStock ? 'bg-red-50 border-red-100' : 'bg-muted/50 border-border'
            }`}
          >
            {qtyBase <= 0 ? (
              <p className="text-[11px] text-muted-foreground font-bold">Pilih atau ketik jumlah yang mau dibeli.</p>
            ) : overStock ? (
              <p className="text-[11px] text-red-500 font-bold">
                Melebihi stok. Maksimal {formatQty(available)} {product.unit}.
              </p>
            ) : (
              <>
                {unitIdx !== 0 && (
                  <p className="text-[10px] text-muted-foreground font-bold">
                    {formatQty(amount)} {current.label} = {formatQty(qtyBase)} {product.unit}
                  </p>
                )}
                {hasOwnPrice && (
                  <p className="text-[10px] text-muted-foreground font-bold">
                    Rp {current.price.toLocaleString('id-ID')} / {current.label}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Harga</p>
                <p className="text-lg font-black text-foreground">Rp {total.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-muted-foreground">
                  Sisa stok setelah ini: {formatQty(remaining)} {product.unit}
                </p>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" disabled={!canSubmit} className="w-full" onClick={submit}>
            Tambah ke Keranjang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
