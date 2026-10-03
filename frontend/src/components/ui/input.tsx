import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, onClear, value, ...props }, ref) => {
  const input = (
    <input
      type={type}
      ref={ref}
      data-search-input={type === 'search' ? '' : undefined}
      value={value}
      className={cn(
        'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold outline-none transition-colors placeholder:text-muted-foreground placeholder:font-normal focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
        type === 'search' && 'appearance-none pr-9 [&::-webkit-search-cancel-button]:hidden',
        className
      )}
      {...props}
    />
  );

  if (type !== 'search') return input;

  return (
    <div className="relative w-full min-w-0">
      {input}
      {String(value ?? '').length > 0 && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Hapus pencarian"
          title="Hapus pencarian"
          className="absolute right-2 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});
Input.displayName = 'Input';

export { Input };
