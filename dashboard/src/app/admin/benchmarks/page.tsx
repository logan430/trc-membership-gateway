'use client';

import { useState } from 'react';
import { Flag, Check, X, ChevronDown, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { useFlaggedBenchmarks, useBenchmarkStats, useApproveBenchmark, useRejectBenchmark } from '@/hooks/useAdminBenchmarks';
import { FlaggedBenchmark } from '@/lib/admin-api';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminBenchmarksPage() {
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isBulkPending, setIsBulkPending] = useState(false);

  const { data, isLoading } = useFlaggedBenchmarks(category || undefined);
  const { data: stats } = useBenchmarkStats();
  const approveMutation = useApproveBenchmark();
  const rejectMutation = useRejectBenchmark();
  const queryClient = useQueryClient();

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (data?.submissions) {
      setSelected(new Set(data.submissions.map((s) => s.id)));
    }
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Bulk actions with Promise.allSettled for partial failure handling
  const handleBulkApprove = async () => {
    setIsBulkPending(true);
    const results = await Promise.allSettled(
      Array.from(selected).map((id) => approveMutation.mutateAsync(id))
    );
    const failures = results.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      alert(`${failures} of ${selected.size} failed to approve`);
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'benchmarks'] });
    clearSelection();
    setIsBulkPending(false);
  };

  const handleBulkReject = async () => {
    setIsBulkPending(true);
    const results = await Promise.allSettled(
      Array.from(selected).map((id) => rejectMutation.mutateAsync(id))
    );
    const failures = results.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      alert(`${failures} of ${selected.size} failed to reject`);
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'benchmarks'] });
    clearSelection();
    setIsBulkPending(false);
  };

  // Individual row actions
  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id);
  };

  if (isLoading) {
    return <PageLoader message="Loading flagged benchmarks..." />;
  }

  const submissions = data?.submissions ?? [];
  const allSelected = submissions.length > 0 && selected.size === submissions.length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-3 mb-6">
        <Flag size={28} className="text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benchmark Moderation</h1>
          <p className="text-muted-foreground">
            {submissions.length} flagged submission{submissions.length !== 1 ? 's' : ''}
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

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-card border-b border-border p-3 mb-4 rounded-[8px] shadow-lg flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button
              onClick={handleBulkApprove}
              disabled={isBulkPending}
              className="bg-success hover:bg-success/90 text-white"
            >
              {isBulkPending ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Check size={16} className="mr-2" />
              )}
              Approve All
            </Button>
            <Button
              onClick={handleBulkReject}
              disabled={isBulkPending}
              className="bg-error hover:bg-error/90 text-white"
            >
              {isBulkPending ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <X size={16} className="mr-2" />
              )}
              Reject All
            </Button>
            <Button variant="outline" onClick={clearSelection} disabled={isBulkPending}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Benchmarks Table */}
      <Card className="overflow-hidden">
        {submissions.length === 0 ? (
          <div className="p-8">
            <p className="text-muted-foreground text-center">
              No flagged benchmarks to review - all clear!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="py-3 px-4 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => (allSelected ? clearSelection() : selectAll())}
                      className="w-4 h-4 rounded border-2 border-border"
                    />
                  </th>
                  <th className="py-3 px-4 text-left font-semibold text-foreground">Member</th>
                  <th className="py-3 px-4 text-left font-semibold text-foreground">Category</th>
                  <th className="py-3 px-4 text-left font-semibold text-foreground">Outlier Fields</th>
                  <th className="py-3 px-4 text-left font-semibold text-foreground">Submitted</th>
                  <th className="py-3 px-4 text-right font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((benchmark) => (
                  <BenchmarkRow
                    key={benchmark.id}
                    benchmark={benchmark}
                    isSelected={selected.has(benchmark.id)}
                    isExpanded={expandedRows.has(benchmark.id)}
                    onToggleSelect={() => toggleSelect(benchmark.id)}
                    onToggleExpand={() => toggleExpand(benchmark.id)}
                    onApprove={() => handleApprove(benchmark.id)}
                    onReject={() => handleReject(benchmark.id)}
                    isPending={approveMutation.isPending || rejectMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

interface BenchmarkRowProps {
  benchmark: FlaggedBenchmark;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}

function BenchmarkRow({
  benchmark,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onApprove,
  onReject,
  isPending,
}: BenchmarkRowProps) {
  return (
    <>
      <tr className="border-b border-border/50 hover:bg-accent/50">
        <td className="py-3 px-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 rounded border-2 border-border"
          />
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" />
            <div>
              <div className="font-medium text-foreground">
                {benchmark.member.discordUsername || benchmark.member.email}
              </div>
              <div className="text-xs text-muted-foreground">{benchmark.member.email}</div>
            </div>
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="text-xs px-2 py-1 bg-accent rounded">{benchmark.category}</span>
        </td>
        <td className="py-3 px-4">
          {benchmark.outlierFields && benchmark.outlierFields.length > 0 ? (
            <span className="text-xs text-warning">{benchmark.outlierFields.join(', ')}</span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </td>
        <td className="py-3 px-4 text-muted-foreground">
          {formatDistanceToNow(new Date(benchmark.updatedAt), { addSuffix: true })}
        </td>
        <td className="py-3 px-4">
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleExpand}
              className="px-2"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onApprove}
              disabled={isPending}
              className="text-success hover:bg-success/10 px-2"
            >
              <Check size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={isPending}
              className="text-error hover:bg-error/10 px-2"
            >
              <X size={16} />
            </Button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-accent/30">
          <td colSpan={6} className="py-4 px-4">
            <div className="pl-8">
              <h5 className="text-sm font-medium mb-2 text-foreground">Submission Data</h5>
              <pre className="text-xs bg-background p-3 rounded-[8px] overflow-x-auto border border-border">
                {JSON.stringify(benchmark.data, null, 2)}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
