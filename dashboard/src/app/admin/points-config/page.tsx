'use client';

import { useState } from 'react';
import { Coins, Save, Edit } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { usePointConfigs, useUpdatePointConfig } from '@/hooks/useAdminPointsConfig';
import { PointConfig } from '@/lib/admin-api';

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

      <div className="space-y-4 max-w-2xl">
        {data?.configs.map((config) => (
          <PointConfigCard key={config.action} config={config} />
        ))}
        {data?.configs.length === 0 && (
          <Card className="p-8">
            <p className="text-muted-foreground text-center">
              No point configs found. Contact a super admin to seed defaults.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function PointConfigCard({ config }: { config: PointConfig }) {
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState(config.points);
  const [enabled, setEnabled] = useState(config.enabled);
  const [label, setLabel] = useState(config.label);
  const [description, setDescription] = useState(config.description || '');

  const { mutate, isPending, isSuccess, error } = useUpdatePointConfig();

  const handleSave = () => {
    mutate(
      {
        action: config.action,
        data: { points, enabled, label, description: description || null },
      },
      {
        onSuccess: () => {
          setEditing(false);
        },
      }
    );
  };

  const handleCancel = () => {
    setPoints(config.points);
    setEnabled(config.enabled);
    setLabel(config.label);
    setDescription(config.description || '');
    setEditing(false);
  };

  return (
    <Card className="p-4">
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <Input value={config.action} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Points</label>
              <Input
                type="number"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm">Enabled</span>
          </label>
          {error && (
            <div className="p-3 bg-error/10 text-error text-sm rounded-[8px]">
              {(error as Error).message}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isPending}>
              <Save size={16} className="mr-2" />
              {isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-foreground">{config.label}</h4>
              {!config.enabled && (
                <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {config.action} | {config.points} points
            </p>
            {config.description && (
              <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-gold">{config.points}</span>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit size={16} className="mr-1" />
              Edit
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
