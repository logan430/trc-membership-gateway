'use client';

import { LayoutDashboard, Users, FileText, BarChart3, Flag, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui';
import { KpiCard } from '@/components/admin';
import { useOverview, useAtRisk, useBenchmarkStats } from '@/hooks/useAnalytics';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { data: overview, isLoading: loadingOverview } = useOverview();
  const { data: atRisk, isLoading: loadingAtRisk } = useAtRisk(30, 5);
  const { data: benchmarks, isLoading: loadingBenchmarks } = useBenchmarkStats();

  const quickLinks = [
    { label: 'View All Members', href: '/admin/members', icon: <Users size={16} /> },
    { label: 'Flagged Benchmarks', href: '/admin/benchmarks', icon: <Flag size={16} /> },
    { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 size={16} /> },
    { label: 'Resources', href: '/admin/resources', icon: <FileText size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard size={28} className="text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-foreground font-cinzel">Admin Dashboard</h1>
          <p className="text-muted-foreground">Overview of community metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Members"
          value={overview?.totalMembers ?? 0}
          isLoading={loadingOverview}
        />
        <KpiCard
          title="Active Members"
          value={overview?.activeMembers ?? 0}
          isLoading={loadingOverview}
        />
        <KpiCard
          title="New (30d)"
          value={overview?.newMembers30d ?? 0}
          isLoading={loadingOverview}
        />
        <KpiCard
          title="MRR"
          value={overview?.mrr ?? 0}
          prefix="$"
          isLoading={loadingOverview}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Links */}
        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 p-3 rounded-[8px] hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              >
                {link.icon}
                <span className="text-sm font-medium">{link.label}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* At-Risk Members */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle size={16} className="text-warning" />
              At-Risk Members
            </h3>
            <span className="text-sm text-muted-foreground">
              {atRisk?.count ?? 0} total
            </span>
          </div>
          {loadingAtRisk ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : atRisk?.members && atRisk.members.length > 0 ? (
            <div className="space-y-2">
              {atRisk.members.slice(0, 5).map((member) => (
                <Link
                  key={member.memberId}
                  href={`/admin/members/${member.memberId}`}
                  className="flex items-center justify-between p-2 rounded-[8px] hover:bg-accent"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {member.discordUsername || member.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Risk score: {member.score}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    member.riskLevel === 'high' ? 'bg-error/10 text-error' :
                    member.riskLevel === 'medium' ? 'bg-warning/10 text-warning' :
                    'bg-success/10 text-success'
                  }`}>
                    {member.riskLevel}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No at-risk members</p>
          )}
        </Card>
      </div>

      {/* Benchmark Stats */}
      <Card className="p-4 mt-6">
        <h3 className="font-semibold text-foreground mb-4">Benchmark Activity</h3>
        {loadingBenchmarks ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{benchmarks?.total.submissions ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total Submissions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{benchmarks?.total.validSubmissions ?? 0}</p>
              <p className="text-sm text-muted-foreground">Valid</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">{benchmarks?.total.flaggedSubmissions ?? 0}</p>
              <p className="text-sm text-muted-foreground">Flagged</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{benchmarks?.total.uniqueMembers ?? 0}</p>
              <p className="text-sm text-muted-foreground">Unique Members</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
