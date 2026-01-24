'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui';

interface KpiCardProps {
  title: string;
  value: number | string;
  change?: number; // Percentage change
  prefix?: string;
  suffix?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

export function KpiCard({
  title,
  value,
  change,
  prefix = '',
  suffix = '',
  onClick,
  isLoading,
}: KpiCardProps) {
  const formatValue = (v: number | string) => {
    if (typeof v === 'string') return v;
    if (prefix === '$') {
      if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}K`;
      return `${prefix}${v.toLocaleString()}`;
    }
    return `${prefix}${v.toLocaleString()}${suffix}`;
  };

  const TrendIcon = change === undefined || change === 0
    ? Minus
    : change > 0
      ? ArrowUp
      : ArrowDown;

  return (
    <Card
      className={`p-4 ${onClick ? 'cursor-pointer hover:border-gold transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        {isLoading ? (
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        ) : (
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-foreground">
              {formatValue(value)}
            </span>
            {change !== undefined && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <TrendIcon className="w-4 h-4" />
                <span>{Math.abs(change)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
