'use client';

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Password Input component with visibility toggle
 *
 * Features:
 * - Show/hide password with eye icon toggle
 * - Accessible button with aria-label
 * - Styled consistently with Input component
 * - Medieval pixel theme
 */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = '', label, error, hint, id, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = () => {
      setShowPassword(!showPassword);
    };

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
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={showPassword ? 'text' : 'password'}
            disabled={disabled}
            className={`
              w-full px-3 py-2 pr-10
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
          <button
            type="button"
            onClick={toggleVisibility}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>
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

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
export type { PasswordInputProps };
