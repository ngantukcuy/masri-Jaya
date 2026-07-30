import { useEffect, useRef, useState, ChangeEvent, FocusEvent } from 'react';

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
}

const formatThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const toDisplay = (value: number | undefined) =>
  value ? formatThousands(String(Math.trunc(Math.abs(value)))) : '';

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
}: NumberInputProps) {
  const [text, setText] = useState(() => toDisplay(value));
  const isFocused = useRef(false);

  // Stay in sync with external value changes (form reset, editing a
  // different row, etc.) as long as the user isn't actively typing here.
  useEffect(() => {
    if (!isFocused.current) {
      setText(toDisplay(value));
    }
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
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
      setText(toDisplay(min));
    } else {
      setText(toDisplay(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
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
      className={className}
    />
  );
}
