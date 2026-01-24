'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DataItem {
  name: string;
  value: number;
  color?: string;
}

interface ComparisonBarChartProps {
  data: DataItem[];
  height?: number;
  layout?: 'horizontal' | 'vertical';
  defaultColor?: string;
}

export function ComparisonBarChart({
  data,
  height = 200,
  layout = 'vertical',
  defaultColor = 'var(--gold)',
}: ComparisonBarChartProps) {
  const isVertical = layout === 'vertical';

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isVertical ? 'vertical' : 'horizontal'}
          margin={isVertical ? { top: 5, right: 30, left: 80, bottom: 5 } : { top: 5, right: 20, left: 10, bottom: 30 }}
        >
          {isVertical ? (
            <>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: 'var(--foreground)' }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: 'var(--foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={24}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || defaultColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
