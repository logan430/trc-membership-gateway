'use client';

import { useState, useEffect, useRef } from 'react';
import { Coins, Check } from 'lucide-react';
import { Card } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { usePointConfigs, useUpdatePointConfig } from '@/hooks/useAdminPointsConfig';
import { PointConfig } from '@/lib/admin-api';
import { formatDistanceToNow } from 'date-fns';

export default function AdminPointsConfigPage() {
  const { data, isLoading } = usePointConfigs();

  if (isLoading) {
    return <PageLoader message="Loading points config..." />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-3 mb-6">
        <Coins size={28} className="text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Points Configuration</h1>
          <p className="text-muted-foreground">Configure point values for member actions</p>
        </div>
      </div>

      {data?.configs.length === 0 ? (
        <Card className="p-8">
          <p className="text-muted-foreground text-center">
            No point configs found. Contact a super admin to seed defaults.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-4 font-semibold text-foreground">Action</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Label</th>
                <th className="text-right py-3 px-4 font-semibold text-foreground">Points</th>
                <th className="text-center py-3 px-4 font-semibold text-foreground">Enabled</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Description</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {data?.configs.map((config) => (
                <PointConfigRow key={config.action} config={config} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PointConfigRow({ config }: { config: PointConfig }) {
  return (
    <tr className="border-b border-border/50 hover:bg-accent/50">
      <td className="py-3 px-4">
        <code className="text-xs bg-muted px-2 py-1 rounded">{config.action}</code>
      </td>
      <td className="py-3 px-4 text-foreground">{config.label}</td>
      <td className="py-3 px-4 text-right">
        <InlineEditableValue config={config} field="points" />
      </td>
      <td className="py-3 px-4 text-center">
        <InlineToggle config={config} />
      </td>
      <td className="py-3 px-4 text-muted-foreground text-sm">
        {config.description || '-'}
      </td>
      <td className="py-3 px-4 text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(config.updatedAt), { addSuffix: true })}
      </td>
    </tr>
  );
}

function InlineEditableValue({
  config,
  field,
}: {
  config: PointConfig;
  field: 'points';
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(String(config.points));
  const [showCheck, setShowCheck] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutate, isPending } = useUpdatePointConfig();

  // Update tempValue when config changes (after successful mutation)
  useEffect(() => {
    if (!editing) {
      setTempValue(String(config.points));
    }
  }, [config.points, editing]);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const newValue = parseInt(tempValue, 10);
    if (isNaN(newValue)) {
      setTempValue(String(config.points));
      setEditing(false);
      return;
    }

    if (newValue === config.points) {
      setEditing(false);
      return;
    }

    mutate(
      {
        action: config.action,
        data: {
          points: newValue,
          enabled: config.enabled,
          label: config.label,
          description: config.description,
        },
      },
      {
        onSuccess: () => {
          setEditing(false);
          setShowCheck(true);
          setTimeout(() => setShowCheck(false), 2000);
        },
        onError: () => {
          setTempValue(String(config.points));
          setEditing(false);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setTempValue(String(config.points));
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        className="w-20 px-2 py-1 border border-border rounded text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-gold"
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-2 justify-end">
      <span
        onClick={() => setEditing(true)}
        className="cursor-pointer hover:bg-accent px-2 py-1 rounded font-medium text-gold-dark transition-colors"
        title="Click to edit"
      >
        {config.points}
      </span>
      {showCheck && (
        <Check
          size={16}
          className="text-success transition-opacity duration-1000"
          style={{ opacity: showCheck ? 1 : 0 }}
        />
      )}
    </span>
  );
}

function InlineToggle({ config }: { config: PointConfig }) {
  const [showCheck, setShowCheck] = useState(false);
  const { mutate, isPending } = useUpdatePointConfig();

  const handleToggle = () => {
    mutate(
      {
        action: config.action,
        data: {
          points: config.points,
          enabled: !config.enabled,
          label: config.label,
          description: config.description,
        },
      },
      {
        onSuccess: () => {
          setShowCheck(true);
          setTimeout(() => setShowCheck(false), 2000);
        },
      }
    );
  };

  return (
    <span className="inline-flex items-center gap-2 justify-center">
      <input
        type="checkbox"
        checked={config.enabled}
        onChange={handleToggle}
        disabled={isPending}
        className="rounded border-border cursor-pointer"
      />
      {showCheck && (
        <Check
          size={16}
          className="text-success transition-opacity duration-1000"
          style={{ opacity: showCheck ? 1 : 0 }}
        />
      )}
    </span>
  );
}
