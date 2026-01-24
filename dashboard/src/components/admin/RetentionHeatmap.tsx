'use client';

import type { CohortRow } from '@/lib/admin-api';

interface RetentionHeatmapProps {
  cohorts: CohortRow[];
  viewMode: 'heatmap' | 'table';
}

export function RetentionHeatmap({ cohorts, viewMode }: RetentionHeatmapProps) {
  // Color scale for heatmap (0-100%)
  const getColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500/80';
    if (pct >= 60) return 'bg-green-500/60';
    if (pct >= 40) return 'bg-yellow-500/60';
    if (pct >= 20) return 'bg-orange-500/60';
    return 'bg-red-500/40';
  };

  const months = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5'];

  if (viewMode === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cohort</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Size</th>
              {months.slice(1).map((m) => (
                <th key={m} className="text-center py-2 px-3 font-medium text-muted-foreground">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.cohort} className="border-b border-border/50">
                <td className="py-2 px-3 font-medium">{cohort.cohort}</td>
                <td className="py-2 px-3">{cohort.month0}</td>
                <td className="text-center py-2 px-3">{cohort.month1Pct}%</td>
                <td className="text-center py-2 px-3">{cohort.month2Pct}%</td>
                <td className="text-center py-2 px-3">{cohort.month3Pct}%</td>
                <td className="text-center py-2 px-3">{cohort.month4Pct}%</td>
                <td className="text-center py-2 px-3">{cohort.month5Pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Heatmap view
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 px-2 font-medium text-muted-foreground w-20">Cohort</th>
            {months.map((m) => (
              <th key={m} className="text-center py-2 px-2 font-medium text-muted-foreground w-16">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohort}>
              <td className="py-1 px-2 font-medium text-xs">{cohort.cohort}</td>
              <td className={`py-1 px-2 text-center text-xs ${getColor(100)}`}>{cohort.month0}</td>
              <td className={`py-1 px-2 text-center text-xs ${getColor(cohort.month1Pct)}`}>{cohort.month1Pct}%</td>
              <td className={`py-1 px-2 text-center text-xs ${getColor(cohort.month2Pct)}`}>{cohort.month2Pct}%</td>
              <td className={`py-1 px-2 text-center text-xs ${getColor(cohort.month3Pct)}`}>{cohort.month3Pct}%</td>
              <td className={`py-1 px-2 text-center text-xs ${getColor(cohort.month4Pct)}`}>{cohort.month4Pct}%</td>
              <td className={`py-1 px-2 text-center text-xs ${getColor(cohort.month5Pct)}`}>{cohort.month5Pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
