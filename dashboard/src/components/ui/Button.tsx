'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

/**
 * Button component with medieval pixel styling
 *
 * Features per CONTEXT.md:
 * - 8px border-radius
 * - Hard-edge pixel shadows (no blur)
 * - Hover scale effect (1.02x)
 * - Gold accents for secondary variant
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center font-semibold
      rounded-[8px] transition-all duration-150
      focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-background
      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
      hover:scale-[1.02] active:scale-[0.98]
    `;

    // Pixel-style hard shadows per CONTEXT.md (offset, no blur)
    const pixelShadow = 'shadow-[3px_3px_0px_0px_rgba(51,65,85,0.3)]';
    const pixelShadowGold = 'shadow-[3px_3px_0px_0px_rgba(212,160,23,0.4)]';

    const variants = {
      primary: `bg-foreground text-background border-2 border-foreground ${pixelShadow} hover:shadow-[2px_2px_0px_0px_rgba(51,65,85,0.3)]`,
      secondary: `bg-gold text-foreground border-2 border-gold-dark ${pixelShadowGold} hover:bg-gold-light`,
      outline: `border-2 border-foreground bg-transparent text-foreground ${pixelShadow} hover:bg-accent`,
      ghost: 'bg-transparent text-foreground hover:bg-accent border-2 border-transparent',
      destructive: `bg-destructive text-destructive-foreground border-2 border-destructive ${pixelShadow} hover:opacity-90`,
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <LoadingSpinner />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Simple loading spinner for button loading state
 * Uses gold color for medieval theme
 */
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export { Button };
export type { ButtonProps };
