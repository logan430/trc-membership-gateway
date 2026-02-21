'use client';

import { useState } from 'react';
import { Card, Button, Input } from '@/components/ui';
import { useAdjustPoints } from '@/hooks/useAdminMembers';
import { Coins, Plus, Minus } from 'lucide-react';

interface PointsAdjusterProps {
  memberId: string;
  currentPoints: number;
}

export function PointsAdjuster({ memberId, currentPoints }: PointsAdjusterProps) {
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [notifyMember, setNotifyMember] = useState(false);
  const [isAdding, setIsAdding] = useState(true);

  const { mutate, isPending, isSuccess, reset } = useAdjustPoints(memberId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pointValue = parseInt(points, 10);
    if (isNaN(pointValue) || pointValue <= 0) return;

    mutate({
      points: isAdding ? pointValue : -pointValue,
      reason: reason || undefined,
      notifyMember,
    }, {
      onSuccess: () => {
        // Reset form on success
        setPoints('');
        setReason('');
        // Clear success message after 3 seconds
        setTimeout(() => reset(), 3000);
      },
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Coins size={20} className="text-gold" />
        <h3 className="font-semibold text-foreground">Adjust Points</h3>
      </div>

      <div className="mb-4 p-3 bg-accent rounded-[8px]">
        <span className="text-sm text-muted-foreground">Current Balance:</span>
        <span className="ml-2 text-xl font-bold text-gold-dark">{currentPoints}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex rounded-[8px] border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium transition-colors ${
              isAdding
                ? 'bg-foreground text-background'
                : 'bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plus size={14} /> Add
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium transition-colors border-l border-border ${
              !isAdding
                ? 'bg-foreground text-background'
                : 'bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <Minus size={14} /> Deduct
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Points
          </label>
          <Input
            type="number"
            min="1"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Enter amount"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Reason (optional)
          </label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Bonus for contribution"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyMember}
            onChange={(e) => setNotifyMember(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm text-muted-foreground">Notify member via Discord DM</span>
        </label>

        {isSuccess && (
          <div className="p-2 bg-success/10 text-success text-sm rounded-[8px]">
            Points adjusted successfully!
          </div>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Adjusting...' : `${isAdding ? 'Add' : 'Deduct'} Points`}
        </Button>
      </form>
    </Card>
  );
}
