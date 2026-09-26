import { useState } from 'react';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../ui/select';

/** Pilihan bawaan untuk kolom "Sebagai" pelanggan. Selain ini, user bebas mengetik sendiri. */
export const SEBAGAI_PRESETS = [
  'Pelanggan Umum',
  'Tukang',
  'Mandor',
  'Kontraktor',
  'Toko / Reseller',
  'Proyek / Developer',
  'Perusahaan',
];

/** Label tampilan untuk nilai lama (dulu "Level Loyalitas") agar data lama tetap terbaca. */
export const LEGACY_SEBAGAI_LABELS: Record<string, string> = {
  'Platinum Member': 'Anggota Platinum (VIP)',
  'Premium Builder': 'Kontraktor Utama (Premium)',
  'Loyal General Contractor': 'Kontraktor Umum Loyal',
  'Local Retail Builder': 'Pembangun Retail Lokal',
  'Pelanggan Retail': 'Pelanggan Retail Eceran',
};

export const sebagaiLabel = (value: string) => LEGACY_SEBAGAI_LABELS[value] || value;

const CUSTOM = '__custom__';

interface SebagaiInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Nilai "Sebagai" yang sudah dipakai pelanggan lain, ikut jadi pilihan dropdown. */
  extraOptions?: string[];
}

/** Dropdown pilihan "Sebagai" + opsi "Isi sendiri…" yang memunculkan kolom ketik bebas. */
export default function SebagaiInput({ value, onChange, extraOptions = [] }: SebagaiInputProps) {
  const options = Array.from(new Set([...SEBAGAI_PRESETS, ...extraOptions.filter(Boolean)]));
  const [customMode, setCustomMode] = useState(false);
  const isCustom = customMode || (!!value && !options.includes(value));

  return (
    <div className="space-y-2">
      <Select
        value={isCustom ? CUSTOM : value}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            setCustomMode(true);
            // Pindah dari salah satu pilihan dropdown ke isian bebas — kosongkan
            // dulu supaya yang tampil placeholder-nya, bukan pilihan sebelumnya.
            if (options.includes(value)) onChange('');
            return;
          }
          setCustomMode(false);
          onChange(v);
        }}
      >
        <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{sebagaiLabel(opt)}</SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Isi sendiri…</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && (
        <Input
          type="text"
          autoFocus
          placeholder="Contoh: Pemilik Kos, Supir, Arsitek"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
