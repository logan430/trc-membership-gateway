'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Filter, X } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { AuditTable } from '@/components/admin/AuditTable';
import { useAuditLogs, useAuditActions, useAuditEntityTypes } from '@/hooks/useAdminConfig';
import { AuditLogEntry } from '@/lib/admin-api';

export default function AdminAuditPage() {
  // Filter state
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Accumulated logs for pagination
  const [allLogs, setAllLogs] = useState<AuditLogEntry[]>([]);

  // Fetch filter options
  const { data: actionsData } = useAuditActions();
  const { data: entityTypesData } = useAuditEntityTypes();

  // Fetch audit logs
  const { data, isLoading, isFetching } = useAuditLogs({
    cursor,
    limit: 25,
    action: action || undefined,
    entityType: entityType || undefined,
    entityId: entityId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // Update accumulated logs when data changes
  useEffect(() => {
    if (data?.logs) {
      if (cursor) {
        // Append for "Load More"
        setAllLogs((prev) => [...prev, ...data.logs]);
      } else {
        // Replace for new filter
        setAllLogs(data.logs);
      }
    }
  }, [data, cursor]);

  const handleApplyFilters = () => {
    setCursor(undefined);
    setAllLogs([]);
  };

  const handleClearFilters = () => {
    setAction('');
    setEntityType('');
    setEntityId('');
    setStartDate('');
    setEndDate('');
    setCursor(undefined);
    setAllLogs([]);
  };

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  const hasFilters = action || entityType || entityId || startDate || endDate;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList size={28} className="text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground">
            {data ? `${allLogs.length}${data.hasMore ? '+' : ''} entries` : 'Loading...'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-muted-foreground" />
          <span className="font-medium text-foreground">Filters</span>
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="ml-auto text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X size={14} />
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background text-foreground focus:border-gold focus:outline-none"
            >
              <option value="">All Actions</option>
              {actionsData?.actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background text-foreground focus:border-gold focus:outline-none"
            >
              <option value="">All Types</option>
              {entityTypesData?.entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Entity ID</label>
            <Input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="UUID..."
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background text-foreground focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background text-foreground focus:border-gold focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleApplyFilters} className="w-full">
              Apply Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <AuditTable entries={allLogs} isLoading={isLoading && allLogs.length === 0} />

        {/* Pagination */}
        {allLogs.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t-2 border-border">
            <span className="text-sm text-muted-foreground">
              Showing {allLogs.length} entries
            </span>
            {data?.hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isFetching}
              >
                {isFetching ? 'Loading...' : 'Load More'}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
