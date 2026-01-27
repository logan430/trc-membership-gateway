'use client';

import Link from 'next/link';
import { AdminMember } from '@/lib/admin-api';
import { formatDistanceToNow } from 'date-fns';

interface MembersTableProps {
  members: AdminMember[];
  isLoading?: boolean;
}

export function MembersTable({ members, isLoading }: MembersTableProps) {
  if (isLoading) {
    return <div className="text-muted-foreground p-4">Loading members...</div>;
  }

  if (members.length === 0) {
    return <div className="text-muted-foreground p-4 text-center">No members found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="text-left py-3 px-4 font-semibold text-foreground">Member</th>
            <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
            <th className="text-left py-3 px-4 font-semibold text-foreground">Tier</th>
            <th className="text-right py-3 px-4 font-semibold text-foreground">Points</th>
            <th className="text-left py-3 px-4 font-semibold text-foreground">Last Active</th>
            <th className="text-left py-3 px-4 font-semibold text-foreground">Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b border-border/50 hover:bg-accent/50">
              <td className="py-3 px-4">
                <Link
                  href={`/admin/members/${member.id}`}
                  className="hover:text-gold transition-colors"
                >
                  <div className="font-medium text-foreground">
                    {member.discordUsername || member.email}
                  </div>
                  <div className="text-xs text-muted-foreground">{member.email}</div>
                </Link>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={member.subscriptionStatus} />
              </td>
              <td className="py-3 px-4">
                <span className="text-muted-foreground">{member.seatTier || '-'}</span>
              </td>
              <td className="py-3 px-4 text-right font-medium text-gold-dark">
                {member.totalPoints}
              </td>
              <td className="py-3 px-4 text-muted-foreground">
                {member.lastActiveAt
                  ? formatDistanceToNow(new Date(member.lastActiveAt), { addSuffix: true })
                  : 'Never'}
              </td>
              <td className="py-3 px-4 text-muted-foreground">
                {formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-success/10 text-success',
    TRIALING: 'bg-info/10 text-info',
    PAST_DUE: 'bg-warning/10 text-warning',
    CANCELED: 'bg-muted text-muted-foreground',
    CANCELLED: 'bg-muted text-muted-foreground',
    NONE: 'bg-muted text-muted-foreground',
  };

  return (
    <span className={`text-xs px-2 py-1 rounded ${colors[status] || colors.NONE}`}>
      {status}
    </span>
  );
}
