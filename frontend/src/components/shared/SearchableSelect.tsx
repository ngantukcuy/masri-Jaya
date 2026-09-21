import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional secondary line under the label (e.g. SKU code) shown in the list only. */
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Shown on the closed trigger when nothing is selected yet. */
  placeholder?: string;
  /** Shown inside the search field once the list is open. Defaults to "Cari...". */
  searchPlaceholder?: string;
  /** Shown in the list when the search query matches nothing. */
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

/**
 * A search-as-you-type dropdown for pickers with many options (products,
 * categories, suppliers, ...). Unlike <Select>, it never auto-selects the
 * first option — with no value it shows only the placeholder — and typing
 * while the list is open filters the options instead of jumping to a
 * matching item by first letter.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyText = 'Tidak ada hasil.',
  className,
  triggerClassName,
  disabled,
  id,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find((opt) => opt.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.sublabel?.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    // Autofocus the search field the moment the list opens.
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      clearTimeout(focusTimer);
    };
  }, [open]);

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
          triggerClassName
        )}
      >
        <span className={cn('line-clamp-1 text-left', !selected && 'text-muted-foreground font-normal')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-[200] mt-1 w-full min-w-[10rem] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">{emptyText}</p>
            )}
            {filtered.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left text-xs font-semibold outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer',
                  opt.value === value && 'bg-accent/60'
                )}
              >
                <span className="line-clamp-1">{opt.label}</span>
                {opt.sublabel && <span className="text-[10px] font-normal text-muted-foreground line-clamp-1">{opt.sublabel}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
