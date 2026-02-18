'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoldCoinsLoader, Card, Button } from '@/components/ui';
import { useProfile } from '@/hooks/useProfile';
import { usePointsHistory } from '@/hooks/usePoints';
import { Coins, User, LogOut } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'points' | 'activity'>('points');
  const [loggingOut, setLoggingOut] = useState(false);

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: history, isLoading: historyLoading } = usePointsHistory(20);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue with client-side cleanup even if server call fails
    }
    localStorage.removeItem('accessToken');
    router.push('/login');
  };

  const isLoading = profileLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GoldCoinsLoader />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  // Find the join date from timeline
  const joinEvent = profile?.timeline?.find(t => t.type === 'joined');
  const joinDate = joinEvent?.date ? formatDate(joinEvent.date) : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Your Profile</h1>
        <p className="text-muted-foreground">
          View your activity history and achievements.
        </p>
      </div>

      {/* Profile summary card */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
            <User size={32} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">
              {profile?.member.discordUsername || profile?.member.email}
            </h2>
            <p className="text-muted-foreground text-sm">
              Member since {joinDate}
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-gold" />
                <span className="font-medium">Member</span>
              </div>
              {profile?.member.discordUsername && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Discord: {profile.member.discordUsername}</span>
                </div>
              )}
            </div>
          </div>
          {profile?.team && (
            <div className="text-left sm:text-right">
              <span className="text-xs text-muted-foreground uppercase">Team</span>
              <p className="font-medium">{profile.team.name}</p>
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-border flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            loading={loggingOut}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <LogOut size={16} className="mr-2" />
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('points')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'points'
              ? 'border-gold text-gold-dark'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Point History
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'activity'
              ? 'border-gold text-gold-dark'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Activity Timeline
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'points' ? (
        <Card>
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Recent Point Transactions</h3>
          </div>
          <div className="divide-y divide-border">
            {history?.transactions?.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No point transactions yet. Start earning by submitting benchmarks!
              </div>
            ) : (
              history?.transactions?.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.actionLabel}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatRelativeTime(t.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ml-4 ${
                      t.points > 0 ? 'text-gold-dark' : 'text-muted-foreground'
                    }`}
                  >
                    {t.points > 0 ? '+' : ''}{t.points}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Activity Timeline</h3>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {profile?.timeline?.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  No activity recorded yet.
                </div>
              ) : (
                profile?.timeline?.map((event, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-2 h-2 mt-2 bg-gold rounded-full flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{event.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(event.date)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
