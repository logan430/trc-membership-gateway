'use client';

interface GoldCoinsLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Medieval-themed loading indicator
 *
 * Per CONTEXT.md: Gold coins stacking animation
 * Three stacked coins that animate up and down
 */
export function GoldCoinsLoader({ size = 'md', className = '' }: GoldCoinsLoaderProps) {
  const sizes = {
    sm: { container: 'w-6 h-8', coin: 'h-[35%]' },
    md: { container: 'w-10 h-12', coin: 'h-[35%]' },
    lg: { container: 'w-14 h-16', coin: 'h-[35%]' },
  };

  const { container, coin } = sizes[size];

  return (
    <div
      className={`relative ${container} ${className}`}
      role="status"
      aria-label="Loading"
    >
      {/* Three stacking coins */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`
            absolute w-full ${coin}
            rounded-full
            bg-gradient-to-b from-gold-light via-gold to-gold-dark
            border-2 border-gold-dark
            animate-coin-stack
          `}
          style={{
            animationDelay: `${i * 0.15}s`,
            bottom: `${i * 28}%`,
            zIndex: 3 - i,
          }}
        >
          {/* Coin shine effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent" />
        </div>
      ))}
    </div>
  );
}

interface PageLoaderProps {
  message?: string;
}

/**
 * Full-page loading state with centered loader
 */
export function PageLoader({ message = 'Loading your realm...' }: PageLoaderProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <GoldCoinsLoader size="lg" className="mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  );
}

/**
 * Inline loading state for buttons/small areas
 */
export function InlineLoader({ className = '' }: { className?: string }) {
  return <GoldCoinsLoader size="sm" className={className} />;
}
