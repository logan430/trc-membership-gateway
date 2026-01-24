'use client';

/**
 * KAnonymityGate - Blurred preview with unlock message
 *
 * Shown when a benchmark category has fewer than K_ANONYMITY_THRESHOLD (5)
 * submissions. Per BENCH-06, results are only shown when enough data exists
 * to protect individual privacy.
 *
 * Per CONTEXT.md: Uses gold accents, pixel-style borders
 */

import { Lock } from 'lucide-react';
import { Card, Button } from '@/components/ui';

interface KAnonymityGateProps {
  needed: number;
  current: number;
  category: string;
  onSubmit?: () => void;
}

export function KAnonymityGate({
  needed,
  current,
  category,
  onSubmit,
}: KAnonymityGateProps) {
  const remaining = needed - current;

  return (
    <div className="relative">
      {/* Blurred placeholder chart */}
      <div className="blur-sm opacity-50 pointer-events-none select-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-24 sm:h-32 bg-accent">
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Overlay message */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="p-4 sm:p-6 text-center max-w-md pixel-border border-gold/30 bg-card/95 backdrop-blur-sm">
          <Lock className="mx-auto mb-4 text-gold" size={32} />
          <h3 className="font-semibold text-lg mb-2 text-foreground">
            {remaining} more submission{remaining !== 1 ? 's' : ''} needed
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            To protect privacy, {category} results require at least {needed} submissions.
            Currently there {current === 1 ? 'is' : 'are'} {current}.
          </p>
          {onSubmit && (
            <Button onClick={onSubmit} variant="secondary" className="w-full sm:w-auto">
              Submit Your Data
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
