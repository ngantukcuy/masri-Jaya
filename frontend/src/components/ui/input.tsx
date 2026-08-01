import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold outline-none transition-colors placeholder:text-muted-foreground placeholder:font-normal focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
