'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Input component with medieval pixel styling
 *
 * Features per CONTEXT.md:
 * - Thick pixel-style borders (2px)
 * - Gold/bronze accent border on focus
 * - Inline error messages (no toasts)
 * - 8px border-radius
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`
            w-full px-3 py-2
            bg-background text-foreground
            border-2 rounded-[8px]
            placeholder:text-muted-foreground
            transition-colors duration-150
            focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted
            ${error ? 'border-destructive' : 'border-input'}
            ${className}
          `}
          {...props}
        />
        {hint && !error && (
          <p className="text-sm text-muted-foreground">{hint}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export type { InputProps };
