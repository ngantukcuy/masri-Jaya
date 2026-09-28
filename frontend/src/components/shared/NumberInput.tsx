import { useEffect, useRef, useState, ChangeEvent, FocusEvent } from 'react';
import { cn } from '../../lib/utils';

interface NumberInputProps {
  /** 0 (or undefined) renders as an empty field instead of showing "0". */
  value: number | undefined;
  onChange: (value: number) => void;
  /** Clamped on blur (lets the user keep typing digits without being cut off mid-entry). */
  min?: number;
  /** Clamped immediately as the user types. */
  max?: number;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  name?: string;
  /** Izinkan desimal (pakai koma, mis. "9,6") — untuk stok bersatuan kubik/ton. Maks 3 angka di belakang koma. */
  allowDecimal?: boolean;
}

const formatThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const toDisplay = (value: number | undefined, allowDecimal = false) => {
  if (!value) return '';
  if (!allowDecimal) return formatThousands(String(Math.trunc(Math.abs(value))));
  const fixed = String(Math.round(Math.abs(value) * 1000) / 1000);
  const [intPart, decPart] = fixed.split('.');
  return formatThousands(intPart) + (decPart ? ',' + decPart : '');
};

/** Ubah teks ketikan ("1.234,56") jadi angka + teks yang sudah dirapikan. */
const parseDecimalText = (raw: string) => {
  const cleaned = raw.replace(/[^\d,]/g, '');
  const commaIdx = cleaned.indexOf(',');
  const intDigits = (commaIdx === -1 ? cleaned : cleaned.slice(0, commaIdx)).replace(/^0+(?=\d)/, '');
  const decDigits = commaIdx === -1 ? '' : cleaned.slice(commaIdx + 1).replace(/,/g, '').slice(0, 3);
  const hasComma = commaIdx !== -1;
  const text = formatThousands(intDigits || (hasComma ? '0' : '')) + (hasComma ? ',' + decDigits : '');
  const num = Number((intDigits || '0') + (decDigits ? '.' + decDigits : ''));
  return { text, num };
};

/**
 * Drop-in replacement for `<input type="number">` for Rupiah / quantity
 * fields: starts blank instead of forcing a "0" the user has to delete
 * first, and shows "." thousand separators live while typing (e.g.
 * "12.500" as soon as the 3rd digit is entered) instead of only after the
 * field loses focus.
 */
export default function NumberInput({
  value,
  onChange,
  min,
  max,
  placeholder,
  className,
  required,
  disabled,
  autoFocus,
  id,
  name,
  allowDecimal = false,
}: NumberInputProps) {
  const [text, setText] = useState(() => toDisplay(value, allowDecimal));
  const isFocused = useRef(false);

  // Stay in sync with external value changes (form reset, editing a
  // different row, etc.) as long as the user isn't actively typing here.
  useEffect(() => {
    if (!isFocused.current) {
      setText(toDisplay(value, allowDecimal));
    }
  }, [value, allowDecimal]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (allowDecimal) {
      const { text: nextText, num } = parseDecimalText(e.target.value);
      const clamped = typeof max === 'number' && num > max ? max : num;
      setText(clamped === num ? nextText : toDisplay(clamped, true));
      onChange(clamped);
      return;
    }

    const digitsOnly = e.target.value.replace(/[^\d]/g, '');

    if (digitsOnly === '') {
      setText('');
      onChange(0);
      return;
    }

    let next = Number(digitsOnly);
    if (typeof max === 'number' && next > max) next = max;

    setText(formatThousands(String(next)));
    onChange(next);
  };

  const handleFocus = () => {
    isFocused.current = true;
  };

  const handleBlur = (_e: FocusEvent<HTMLInputElement>) => {
    isFocused.current = false;
    if (typeof min === 'number' && value !== undefined && value > 0 && value < min) {
      onChange(min);
      setText(toDisplay(min, allowDecimal));
    } else {
      setText(toDisplay(value, allowDecimal));
    }
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(
        'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold outline-none transition-colors placeholder:text-muted-foreground placeholder:font-normal focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    />
  );
}
