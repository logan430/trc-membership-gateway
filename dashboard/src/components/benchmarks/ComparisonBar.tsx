'use client';

/**
 * ComparisonBar - Horizontal bar chart comparing member value vs peers
 *
 * Displays three bars: Your Value (gold), Median (green), Average (muted)
 * Uses Recharts BarChart with horizontal layout for easy comparison.
 *
 * Per CONTEXT.md: Uses theme colors (gold, success, muted)
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

interface ComparisonBarProps {
  label: string;
  yourValue: number;
  median: number;
  average: number;
  prefix?: string;
  suffix?: string;
}

export function ComparisonBar({
  label,
  yourValue,
  median,
  average,
  prefix = '',
  suffix = '',
}: ComparisonBarProps) {
  const data = [
    { name: 'You', value: yourValue, color: 'var(--gold)' },
    { name: 'Median', value: median, color: 'var(--success)' },
    { name: 'Average', value: average, color: 'var(--muted-foreground)' },
  ];

  const formatValue = (value: number) => {
    if (prefix === '$') {
      // Format currency with K/M suffixes for readability
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
    <div className="space-y-2">
      <h4 className="font-semibold text-foreground text-sm sm:text-base">{label}</h4>
      <div className="h-28 sm:h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 5, right: 50, left: 60, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--foreground)' }}
              width={50}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              barSize={24}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: number) => formatValue(value)}
                style={{ fontSize: 12, fill: 'var(--foreground)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--gold)' }} />
          <span>Your Value</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--success)' }} />
          <span>Peer Median</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--muted-foreground)' }} />
          <span>Peer Average</span>
        </div>
      </div>
    </div>
  );
}
