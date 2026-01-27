'use client';

import { AdminMember } from '@/lib/admin-api';
import { Card } from '@/components/ui';
import { User, Mail, MessageSquare, Calendar, Trophy, Flame } from 'lucide-react';
import { format } from 'date-fns';

interface MemberInfoCardProps {
  member: AdminMember;
}

export function MemberInfoCard({ member }: MemberInfoCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center">
          <User size={32} className="text-gold" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {member.discordUsername || member.name || 'Member'}
          </h2>
          <p className="text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InfoRow icon={<Mail size={16} />} label="Email" value={member.email} />
        <InfoRow
          icon={<MessageSquare size={16} />}
          label="Discord"
          value={member.discordUsername || 'Not linked'}
        />
        <InfoRow
          icon={<Calendar size={16} />}
          label="Joined"
          value={format(new Date(member.createdAt), 'MMM d, yyyy')}
        />
        <InfoRow
          icon={<Calendar size={16} />}
          label="Last Active"
          value={member.lastActiveAt ? format(new Date(member.lastActiveAt), 'MMM d, yyyy') : 'Never'}
        />
        <InfoRow
          icon={<Trophy size={16} />}
          label="Points"
          value={member.totalPoints.toString()}
          highlight
        />
        <InfoRow
          icon={<Flame size={16} />}
          label="Streak"
          value={`${member.currentStreak} days`}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={member.subscriptionStatus} />
          {member.seatTier && (
            <span className="text-xs px-2 py-1 rounded bg-gold/10 text-gold-dark">
              {member.seatTier}
            </span>
          )}
          {member.introCompleted && (
            <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">
              Intro Complete
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function InfoRow({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground text-sm">{label}:</span>
      <span className={`font-medium ${highlight ? 'text-gold-dark' : 'text-foreground'}`}>
        {value}
      </span>
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
  };

  return (
    <span className={`text-xs px-2 py-1 rounded ${colors[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}
