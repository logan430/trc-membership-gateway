'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, PageLoader } from '@/components/ui';
import { Coins, Trophy, BarChart3, FolderOpen, Flame } from 'lucide-react';
import { usePointsSummary, usePointsHistory } from '@/hooks/usePoints';
import { useProfile } from '@/hooks/useProfile';
import { DiscordClaimCard } from '@/components/discord/DiscordClaimCard';
import { ClaimErrorBanner } from '@/components/discord/ClaimErrorBanner';

/**
 * Dashboard Overview Page
 *
 * Landing page for authenticated members showing:
 * - Welcome message
 * - Discord claim card (if applicable)
 * - Quick stats (gold, rank, streak)
 * - Quick action cards
 * - Recent activity from points history
 */
export default function DashboardOverview() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardOverviewContent />
    </Suspense>
  );
}

function DashboardOverviewContent() {
  const searchParams = useSearchParams();
  const [showClaimError, setShowClaimError] = useState(true);

  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = usePointsSummary();
  const { data: historyData, isLoading: historyLoading, error: historyError } = usePointsHistory(5);
  const { data: profile, isLoading: profileLoading } = useProfile();

  const isLoading = summaryLoading || historyLoading || profileLoading;
  const error = summaryError || historyError;

  if (isLoading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load dashboard data. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome to The Realm
        </h1>
        <p className="text-muted-foreground">
          Your guild dashboard awaits. Track your progress, compare benchmarks, and access resources.
        </p>
      </div>

      {/* Discord Claim Error Banner */}
      {searchParams.get('claim') === 'error' && showClaimError && (
        <ClaimErrorBanner
          reason={searchParams.get('reason')}
          onDismiss={() => setShowClaimError(false)}
        />
      )}

      {/* Discord Claim Card */}
      {profile && (profile.claim.canClaim || profile.claim.hasClaimed) && (
        <DiscordClaimCard
          canClaim={profile.claim.canClaim}
          hasClaimed={profile.claim.hasClaimed}
          discordInviteUrl={profile.claim.discordInviteUrl}
          discordUsername={profile.member.discordUsername}
          variant="hero"
        />
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Coins className="text-gold" size={24} />}
          label="Gold Earned"
          value={summaryData?.totalPoints.toLocaleString() ?? '0'}
          subtext="Total earned"
        />
        <StatCard
          icon={<Trophy className="text-gold-dark" size={24} />}
          label="Guild Rank"
          value="#--"
          subtext="Coming soon"
        />
        <StatCard
          icon={<Flame className="text-orange-500" size={24} />}
          label="Current Streak"
          value={`${summaryData?.currentStreak ?? 0} days`}
          subtext={summaryData?.currentStreak ? 'Keep it going!' : 'Start your streak!'}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionCard
            href="/dashboard/benchmarks"
            icon={<BarChart3 size={24} />}
            title="Submit Benchmark"
            description="Share your data and see how you compare to peers"
            reward="+50 Gold"
          />
          <ActionCard
            href="/dashboard/resources"
            icon={<FolderOpen size={24} />}
            title="Browse Resources"
            description="Access templates, SOPs, and learning materials"
            reward="+5 Gold per download"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest actions in the guild</CardDescription>
        </CardHeader>
        <CardContent>
          {historyData?.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No activity yet. Start earning gold!
            </p>
          ) : (
            <div className="space-y-3">
              {historyData?.transactions.map((transaction) => (
                <ActivityItem
                  key={transaction.id}
                  action={transaction.actionLabel}
                  points={formatPoints(transaction.points)}
                  time={formatRelativeTime(transaction.createdAt)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Format points with + prefix for positive values
 */
function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  return String(points);
}

/**
 * Format a date string to relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${diffDays >= 14 ? 's' : ''} ago`;
  return then.toLocaleDateString();
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
}

function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{subtext}</p>
          </div>
          <div className="p-2 bg-accent rounded-[8px]">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ActionCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  reward: string;
}

function ActionCard({ href, icon, title, description, reward }: ActionCardProps) {
  return (
    <a href={href} className="block group">
      <Card className="h-full hover-lift">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent rounded-[8px] text-foreground group-hover:bg-gold/10 group-hover:text-gold-dark transition-colors">
              {icon}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-gold-dark transition-colors">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
              <p className="text-sm font-medium text-gold-dark mt-2">{reward}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

interface ActivityItemProps {
  action: string;
  points: string;
  time: string;
}

function ActivityItem({ action, points, time }: ActivityItemProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div>
        <p className="text-sm text-foreground">{action}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
      <span className="text-sm font-semibold text-gold-dark">{points}</span>
    </div>
  );
}
