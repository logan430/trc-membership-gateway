import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Coins, Trophy, BarChart3, FolderOpen, Flame } from 'lucide-react';

/**
 * Dashboard Overview Page
 *
 * Landing page for authenticated members showing:
 * - Welcome message
 * - Quick stats (gold, rank, streak)
 * - Quick action cards
 */
export default function DashboardOverview() {
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Coins className="text-gold" size={24} />}
          label="Gold Earned"
          value="150"
          subtext="+25 this week"
        />
        <StatCard
          icon={<Trophy className="text-gold-dark" size={24} />}
          label="Guild Rank"
          value="#42"
          subtext="Top 15%"
        />
        <StatCard
          icon={<Flame className="text-orange-500" size={24} />}
          label="Current Streak"
          value="7 days"
          subtext="Keep it going!"
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

      {/* Recent Activity Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest actions in the guild</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <ActivityItem
              action="Earned gold from Discord activity"
              points="+12"
              time="2 hours ago"
            />
            <ActivityItem
              action="Downloaded 'Revenue Operations Playbook'"
              points="+5"
              time="Yesterday"
            />
            <ActivityItem
              action="Submitted compensation benchmark"
              points="+50"
              time="3 days ago"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
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
