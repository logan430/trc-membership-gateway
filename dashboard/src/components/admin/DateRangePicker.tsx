'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  const presets = [
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
  ];

  const applyPreset = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    setStart(startStr);
    setEnd(endStr);
    onChange(startStr, endStr);
  };

  const handleApply = () => {
    onChange(start, end);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.days}
          variant="outline"
          size="sm"
          onClick={() => applyPreset(preset.days)}
        >
          {preset.label}
        </Button>
      ))}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-36 text-sm"
        />
        <span className="text-muted-foreground">to</span>
        <Input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-36 text-sm"
        />
        <Button size="sm" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
