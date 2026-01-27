'use client';

import { useState } from 'react';
import { Card, Button, Input } from '@/components/ui';
import { FlaggedBenchmark } from '@/lib/admin-api';
import { useApproveBenchmark, useRejectBenchmark } from '@/hooks/useAdminBenchmarks';
import { Check, X, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FlaggedBenchmarkCardProps {
  benchmark: FlaggedBenchmark;
}

export function FlaggedBenchmarkCard({ benchmark }: FlaggedBenchmarkCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  const approveMutation = useApproveBenchmark();
  const rejectMutation = useRejectBenchmark();

  const handleApprove = () => {
    approveMutation.mutate(benchmark.id);
  };

  const handleReject = () => {
    rejectMutation.mutate(benchmark.id);
    setShowRejectConfirm(false);
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            <span className="font-medium text-foreground">
              {benchmark.member.discordUsername || benchmark.member.email}
            </span>
            <span className="text-xs px-2 py-1 bg-accent rounded">{benchmark.category}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Flagged submission requires review
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted {formatDistanceToNow(new Date(benchmark.updatedAt), { addSuffix: true })}
          </p>
          {benchmark.outlierFields && benchmark.outlierFields.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-warning">Outlier fields: </span>
              <span className="text-xs text-foreground">{benchmark.outlierFields.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleApprove}
            disabled={isPending}
            className="text-success hover:bg-success/10"
          >
            <Check size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRejectConfirm(true)}
            disabled={isPending}
            className="text-error hover:bg-error/10"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Expanded Data */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <h5 className="text-sm font-medium mb-2">Submission Data</h5>
          <pre className="text-xs bg-accent p-3 rounded-[8px] overflow-x-auto">
            {JSON.stringify(benchmark.data, null, 2)}
          </pre>
        </div>
      )}

      {/* Reject Confirmation */}
      {showRejectConfirm && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Are you sure you want to reject this submission? This will mark the data as invalid.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="bg-error hover:bg-error/90"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
            <Button variant="outline" onClick={() => setShowRejectConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
