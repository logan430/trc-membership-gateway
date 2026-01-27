'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Card } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { FlaggedBenchmarkCard } from '@/components/admin/FlaggedBenchmarkCard';
import { useFlaggedBenchmarks, useBenchmarkStats } from '@/hooks/useAdminBenchmarks';

export default function AdminBenchmarksPage() {
  const [category, setCategory] = useState('');
  const { data, isLoading } = useFlaggedBenchmarks(category || undefined);
  const { data: stats } = useBenchmarkStats();

  if (isLoading) {
    return <PageLoader message="Loading flagged benchmarks..." />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-3 mb-6">
        <Flag size={28} className="text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benchmark Moderation</h1>
          <p className="text-muted-foreground">
            {data?.submissions.length ?? 0} flagged submissions
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totals.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">{stats.totals.flagged}</p>
            <p className="text-sm text-muted-foreground">Flagged</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.totals.valid}</p>
            <p className="text-sm text-muted-foreground">Valid</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-gold">
              {stats.totals.total > 0
                ? Math.round((stats.totals.valid / stats.totals.total) * 100)
                : 0}
              %
            </p>
            <p className="text-sm text-muted-foreground">Valid Rate</p>
          </Card>
        </div>
      )}

      {/* Category breakdown */}
      {stats && stats.stats.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="font-semibold text-foreground mb-3">By Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.stats.map((cat) => (
              <div key={cat.category} className="text-center">
                <p className="text-sm font-medium">{cat.category}</p>
                <p className="text-xs text-muted-foreground">
                  {cat.total} total | {cat.flagged} flagged
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4 mb-6">
        <label className="block text-sm font-medium mb-2">Filter by Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-[8px] border-2 border-border bg-background"
        >
          <option value="">All Categories</option>
          <option value="COMPENSATION">Compensation</option>
          <option value="INFRASTRUCTURE">Infrastructure</option>
          <option value="BUSINESS">Business</option>
          <option value="OPERATIONAL">Operational</option>
        </select>
      </Card>

      {/* Flagged List */}
      <div className="space-y-4">
        {data?.submissions.map((benchmark) => (
          <FlaggedBenchmarkCard key={benchmark.id} benchmark={benchmark} />
        ))}
        {data?.submissions.length === 0 && (
          <Card className="p-8">
            <p className="text-muted-foreground text-center">
              No flagged benchmarks to review - all clear!
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
