'use client';

import { useState } from 'react';
import { AuditLogEntry } from '@/lib/admin-api';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AuditTableProps {
  entries: AuditLogEntry[];
  isLoading?: boolean;
}

export function AuditTable({ entries, isLoading }: AuditTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Loading audit logs...</div>;
  }

  if (entries.length === 0) {
    return <div className="text-muted-foreground p-4">No audit logs found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="w-8"></th>
            <th className="text-left py-3 px-4 font-semibold text-foreground">Action</th>
            <th className="text-left py-3 px-4 font-semibold text-foreground">Entity</th>
            <th className="text-left py-3 px-4 font-semibold text-foreground">Performed By</th>
            <th className="text-left py-3 px-4 font-semibold text-foreground">When</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <AuditTableRow
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTableRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: AuditLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-accent/50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-3 px-2 text-muted-foreground">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td className="py-3 px-4">
          <ActionBadge action={entry.action} />
        </td>
        <td className="py-3 px-4">
          <span className="text-muted-foreground">{entry.entityType}</span>
          <span className="text-foreground ml-1 font-mono text-xs">
            #{entry.entityId.slice(0, 8)}
          </span>
        </td>
        <td className="py-3 px-4 text-muted-foreground">
          {entry.performedBy ? 'Admin' : 'System'}
        </td>
        <td className="py-3 px-4 text-muted-foreground">
          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="bg-accent/30 p-4">
            <h5 className="font-medium text-foreground mb-2">Details</h5>
            <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
              <div>
                <span className="text-muted-foreground">Full ID: </span>
                <span className="font-mono text-foreground">{entry.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Entity ID: </span>
                <span className="font-mono text-foreground">{entry.entityId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Timestamp: </span>
                <span className="text-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Performed By: </span>
                <span className="text-foreground">
                  {entry.performedBy || 'System'}
                </span>
              </div>
            </div>
            <h6 className="font-medium text-foreground mb-1 text-sm">Payload</h6>
            <pre className="text-xs text-muted-foreground bg-background p-3 rounded-[8px] overflow-x-auto">
              {JSON.stringify(entry.details, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function ActionBadge({ action }: { action: string }) {
  // Determine color based on action prefix
  const actionType = action.split('_')[0];

  const colors: Record<string, string> = {
    CREATE: 'bg-success/10 text-success border-success/30',
    CREATED: 'bg-success/10 text-success border-success/30',
    UPDATE: 'bg-info/10 text-info border-info/30',
    UPDATED: 'bg-info/10 text-info border-info/30',
    DELETE: 'bg-destructive/10 text-destructive border-destructive/30',
    DELETED: 'bg-destructive/10 text-destructive border-destructive/30',
    ADMIN: 'bg-gold/10 text-gold border-gold/30',
    MEMBER: 'bg-accent text-foreground border-border',
    FEATURE: 'bg-accent text-foreground border-border',
    EMAIL: 'bg-accent text-foreground border-border',
  };

  const colorClass = colors[actionType] || 'bg-muted text-muted-foreground border-border';

  return (
    <span className={`text-xs px-2 py-1 rounded border ${colorClass}`}>
      {action}
    </span>
  );
}
