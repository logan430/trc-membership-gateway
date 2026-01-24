'use client';

/**
 * MetricComparisonCard - Visual range bar showing position relative to peers
 *
 * Shows the member's value as a marker on a range from min to max,
 * with the median highlighted. Color indicates if value is favorable.
 *
 * Per CONTEXT.md: Uses gold for member position, green/orange for comparison
 */

import { Card } from '@/components/ui';

interface MetricComparisonCardProps {
  label: string;
  yourValue: number;
  median: number;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  higherIsBetter?: boolean; // Default true - higher values are better
}

export function MetricComparisonCard({
  label,
  yourValue,
  median,
  min,
  max,
  prefix = '',
  suffix = '',
  higherIsBetter = true,
}: MetricComparisonCardProps) {
  // Calculate positions as percentages
  const range = max - min;
  const yourPosition = range > 0 ? ((yourValue - min) / range) * 100 : 50;
  const medianPosition = range > 0 ? ((median - min) / range) * 100 : 50;

  // Determine comparison status
  const isBetter = higherIsBetter
    ? yourValue >= median
    : yourValue <= median;

  const formatValue = (value: number) => {
    if (prefix === '$') {
      if (value >= 1_000_000) {
        return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
      }
      if (value >= 1_000) {
        return `${prefix}${(value / 1_000).toFixed(0)}K`;
      }
      return `${prefix}${value.toLocaleString()}`;
    }
    return `${prefix}${value.toLocaleString()}${suffix}`;
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Header - stacked on mobile */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
          <h4 className="font-medium text-foreground text-sm">{label}</h4>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">
              {formatValue(yourValue)}
            </span>
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                isBetter
                  ? 'bg-success/10 text-success'
                  : 'bg-gold/10 text-gold-dark'
              }`}
            >
              {isBetter ? 'Above Median' : 'Below Median'}
            </span>
          </div>
        </div>

        {/* Visual range bar */}
        <div className="relative h-6 bg-accent rounded-[4px] overflow-hidden">
          {/* Range fill */}
          <div
            className="absolute top-0 left-0 h-full bg-muted-foreground/20 rounded-[4px]"
            style={{ width: '100%' }}
          />

          {/* Median marker line */}
          <div
            className="absolute top-0 h-full w-0.5 bg-success"
            style={{ left: `${Math.min(Math.max(medianPosition, 0), 100)}%` }}
          />

          {/* Your value marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-background"
            style={{
              left: `calc(${Math.min(Math.max(yourPosition, 2), 98)}% - 8px)`,
              backgroundColor: 'var(--gold)',
            }}
          />
        </div>

        {/* Range labels */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatValue(min)}</span>
          <span className="text-success">Median: {formatValue(median)}</span>
          <span>{formatValue(max)}</span>
        </div>
      </div>
    </Card>
  );
}
