'use client';

import { useState } from 'react';
import { Card } from '@/components/ui';
import { FeatureFlag } from '@/lib/admin-api';
import { useToggleFlag } from '@/hooks/useAdminConfig';
import { Check, X } from 'lucide-react';

interface FeatureFlagCardProps {
  flag: FeatureFlag;
  canToggle: boolean;
}

export function FeatureFlagCard({ flag, canToggle }: FeatureFlagCardProps) {
  const [enabled, setEnabled] = useState(flag.enabled);
  const { mutate, isPending } = useToggleFlag();

  const handleToggle = () => {
    if (!canToggle) return;

    const newValue = !enabled;
    setEnabled(newValue);
    mutate(
      { key: flag.key, enabled: newValue },
      {
        onError: () => setEnabled(flag.enabled), // Revert on error
      }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-gold font-mono text-sm">{flag.key}</code>
            {flag.category && (
              <span className="text-xs px-2 py-0.5 rounded bg-accent text-muted-foreground">
                {flag.category}
              </span>
            )}
          </div>
          {flag.description && (
            <p className="text-sm text-muted-foreground mt-1">{flag.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Updated: {formatDate(flag.updatedAt)}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={isPending || !canToggle}
          className={`
            relative w-14 h-8 rounded-full transition-colors flex-shrink-0
            ${enabled ? 'bg-success' : 'bg-muted'}
            ${isPending || !canToggle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          title={!canToggle ? 'Super Admin required to toggle flags' : undefined}
        >
          <span
            className={`
              absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform
              flex items-center justify-center
              ${enabled ? 'translate-x-7' : 'translate-x-1'}
            `}
          >
            {enabled ? (
              <Check size={14} className="text-success" />
            ) : (
              <X size={14} className="text-muted-foreground" />
            )}
          </span>
        </button>
      </div>
    </Card>
  );
}
