import { Plus, Trash2 } from 'lucide-react';
import NumberInput from './NumberInput';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import type { SellUnit } from '../../types';

interface SellUnitsFieldProps {
  /** Satuan dasar produk (kg, batang, dst) — harga & stok selalu dalam satuan ini. */
  unit: string;
  allow: boolean;
  onAllowChange: (v: boolean) => void;
  sellUnits: SellUnit[];
  onSellUnitsChange: (v: SellUnit[]) => void;
}

/** Buang baris kosong/tidak valid sebelum disimpan ke produk. */
export const cleanSellUnits = (list: SellUnit[]): SellUnit[] =>
  list
    .map((u) => ({
      label: u.label.trim(),
      factor: Number(u.factor),
      ...(Number(u.price) > 0 ? { price: Math.round(Number(u.price)) } : {}),
    }))
    .filter((u) => u.label && u.factor > 0);

/**
 * Pengaturan "jual pecahan" satu SKU: di kasir produk ini muncul pop-up
 * "mau beli berapa" (½, ¼, 1 ons, per meter, dst) — tidak perlu bikin SKU
 * terpisah untuk tiap ukuran.
 */
export default function SellUnitsField({ unit, allow, onAllowChange, sellUnits, onSellUnitsChange }: SellUnitsFieldProps) {
  const baseLabel = unit || 'satuan';
  const update = (idx: number, patch: Partial<SellUnit>) =>
    onSellUnitsChange(sellUnits.map((u, i) => (i === idx ? { ...u, ...patch } : u)));

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div>
        <label className="flex items-center gap-2 font-bold text-foreground cursor-pointer text-xs">
          <Checkbox checked={allow} onCheckedChange={(v) => onAllowChange(v === true)} />
          Boleh dijual pecahan di kasir
        </label>
        <p className="text-[10px] text-muted-foreground mt-1">
          Saat produk diklik di kasir muncul pilihan jumlah (¼, ½, 1, atau ketik sendiri, mis. 1,5 {baseLabel}). Harga tetap per {baseLabel}, stok terpotong sesuai jumlah yang dibeli.
        </p>
      </div>

      {allow && (
        <div className="space-y-2">
          <div>
            <Label>Satuan jual tambahan (opsional)</Label>
            <p className="text-[10px] text-muted-foreground">
              Contoh: satuan dasar kg → 1 ons = 0,1 kg. Satuan dasar batang (1 batang = 4 m) → 1 meter = 0,25 batang.
              Harga boleh diisi kalau eceran lebih mahal dari harga proporsional; kosongkan kalau mau ikut harga per {baseLabel}.
            </p>
          </div>

          {sellUnits.map((u, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">1</span>
              <Input
                value={u.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="ons / meter"
                className="h-9 text-xs font-bold w-28"
              />
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">=</span>
              <NumberInput
                allowDecimal
                value={u.factor}
                onChange={(v) => update(idx, { factor: v })}
                placeholder="0,1"
                className="flex h-9 w-24 rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none"
              />
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">{baseLabel}</span>
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">• Rp</span>
              <NumberInput
                value={u.price || 0}
                onChange={(v) => update(idx, { price: v })}
                placeholder="Harga (opsional)"
                className="flex h-9 w-32 rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none"
              />
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">/ {u.label.trim() || 'satuan'}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-600 shrink-0"
                onClick={() => onSellUnitsChange(sellUnits.filter((_, i) => i !== idx))}
                aria-label="Hapus satuan jual"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onSellUnitsChange([...sellUnits, { label: '', factor: 0 }])}
          >
            <Plus className="w-3.5 h-3.5" /> Tambah satuan jual
          </Button>
        </div>
      )}
    </div>
  );
}
