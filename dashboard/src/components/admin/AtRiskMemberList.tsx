'use client';

import type { ChurnRiskScore } from '@/lib/admin-api';
import { AlertTriangle, User } from 'lucide-react';

interface AtRiskMemberListProps {
  members: ChurnRiskScore[];
  isLoading?: boolean;
}

export function AtRiskMemberList({ members, isLoading }: AtRiskMemberListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No at-risk members found</p>
      </div>
    );
  }

  const getRiskBadge = (level: ChurnRiskScore['riskLevel']) => {
    const styles = {
      high: 'bg-red-500/20 text-red-400 border-red-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    return styles[level];
  };

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div
          key={member.memberId}
          className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-border/80 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {member.email || member.discordUsername || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                Last active: {member.lastActiveAt
                  ? new Date(member.lastActiveAt).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full border ${getRiskBadge(member.riskLevel)}`}>
              {member.score}/100
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
