'use client';

/**
 * Admin Analytics Dashboard
 *
 * Tabbed sections: Overview, Members, Engagement, Benchmarks, Resources
 * Per CONTEXT.md: Landing tab is Overview with KPI summary cards + mini-charts
 * ANALYTICS-10: Real-time updates via React Query polling
 */

import { useState } from 'react';
import { Download, Grid3X3, List } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  KpiCard,
  TimeSeriesChart,
  ComparisonBarChart,
  RetentionHeatmap,
  AtRiskMemberList,
  DateRangePicker,
} from '@/components/admin';
import {
  useOverview,
  useEngagement,
  useEngagementComparison,
  useBenchmarkStats,
  useResourceStats,
  usePopularResources,
  useTrendingResources,
  useCohorts,
  useAtRisk,
} from '@/hooks/useAnalytics';
import { adminAnalyticsApi } from '@/lib/admin-api';

type Tab = 'overview' | 'members' | 'engagement' | 'benchmarks' | 'resources';

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [retentionView, setRetentionView] = useState<'heatmap' | 'table'>('heatmap');

  // Date range state (default: last 30 days)
  const defaultEnd = new Date().toISOString().split('T')[0];
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ start: defaultStart, end: defaultEnd });

  // Data hooks
  const { data: overview, isLoading: loadingOverview } = useOverview();
  const { data: engagement, isLoading: loadingEngagement } = useEngagement(dateRange.start, dateRange.end);
  const { data: comparison } = useEngagementComparison(dateRange.start, dateRange.end);
  const { data: benchmarks, isLoading: loadingBenchmarks } = useBenchmarkStats();
  const { data: resources, isLoading: loadingResources } = useResourceStats(dateRange.start, dateRange.end);
  const { data: popularResources } = usePopularResources(10);
  const { data: trendingResources } = useTrendingResources(10);
  const { data: cohorts, isLoading: loadingCohorts } = useCohorts();
  const { data: atRisk, isLoading: loadingAtRisk } = useAtRisk(30, 20);

  // Export handlers
  const handleExportCsv = () => {
    const url = adminAnalyticsApi.exportCsv();
    window.open(url, '_blank');
  };

  const handleExportJson = () => {
    const url = adminAnalyticsApi.exportJson();
    window.open(url, '_blank');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'benchmarks', label: 'Benchmarks' },
    { id: 'resources', label: 'Resources' },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Real-time community insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson}>
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-gold text-gold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Range Picker (shared across tabs) */}
      {activeTab !== 'overview' && (
        <div className="mb-6">
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={(start, end) => setDateRange({ start, end })}
          />
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Total Members"
              value={overview?.totalMembers ?? 0}
              onClick={() => setActiveTab('members')}
              isLoading={loadingOverview}
            />
            <KpiCard
              title="Active Members"
              value={overview?.activeMembers ?? 0}
              change={comparison?.change.total}
              onClick={() => setActiveTab('members')}
              isLoading={loadingOverview}
            />
            <KpiCard
              title="MRR"
              value={overview?.mrr ?? 0}
              prefix="$"
              isLoading={loadingOverview}
            />
            <KpiCard
              title="New (30d)"
              value={overview?.newMembers30d ?? 0}
              isLoading={loadingOverview}
            />
          </div>

          {/* Engagement Mini-Chart */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">Engagement Trend</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('engagement')}>
                View Details
              </Button>
            </div>
            {engagement?.data && engagement.data.length > 0 ? (
              <TimeSeriesChart
                data={engagement.data}
                lines={[
                  { key: 'total', label: 'Total Activity', color: 'var(--gold)' },
                ]}
                height={200}
                showLegend={false}
              />
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                {loadingEngagement ? 'Loading...' : 'No engagement data'}
              </div>
            )}
          </Card>

          {/* At-Risk Members */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">At-Risk Members</h3>
              <span className="text-sm text-muted-foreground">
                {atRisk?.count ?? 0} members
              </span>
            </div>
            <AtRiskMemberList members={atRisk?.members ?? []} isLoading={loadingAtRisk} />
          </Card>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Member Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Total" value={overview?.totalMembers ?? 0} isLoading={loadingOverview} />
            <KpiCard title="Active" value={overview?.activeMembers ?? 0} isLoading={loadingOverview} />
            <KpiCard title="Inactive" value={overview?.inactiveMembers ?? 0} isLoading={loadingOverview} />
            <KpiCard title="At-Risk" value={atRisk?.count ?? 0} isLoading={loadingAtRisk} />
          </div>

          {/* Cohort Retention */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">Cohort Retention</h3>
              <div className="flex gap-2">
                <Button
                  variant={retentionView === 'heatmap' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setRetentionView('heatmap')}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={retentionView === 'table' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setRetentionView('table')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {cohorts?.cohorts && cohorts.cohorts.length > 0 ? (
              <RetentionHeatmap cohorts={cohorts.cohorts} viewMode={retentionView} />
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                {loadingCohorts ? 'Loading...' : 'No cohort data'}
              </div>
            )}
          </Card>

          {/* At-Risk Full List */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4">At-Risk Members</h3>
            <AtRiskMemberList members={atRisk?.members ?? []} isLoading={loadingAtRisk} />
          </Card>
        </div>
      )}

      {activeTab === 'engagement' && (
        <div className="space-y-6">
          {/* Engagement Chart */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Activity Over Time</h3>
            {engagement?.data && engagement.data.length > 0 ? (
              <TimeSeriesChart
                data={engagement.data}
                lines={[
                  { key: 'benchmarks', label: 'Benchmarks', color: 'var(--gold)' },
                  { key: 'downloads', label: 'Downloads', color: 'var(--success)' },
                  { key: 'discordActivity', label: 'Discord', color: 'var(--info)' },
                ]}
                height={350}
              />
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                {loadingEngagement ? 'Loading...' : 'No engagement data'}
              </div>
            )}
          </Card>

          {/* Period Comparison */}
          {comparison && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                title="Total Activity"
                value={comparison.current.data.reduce((s, d) => s + d.total, 0)}
                change={comparison.change.total}
              />
              <KpiCard
                title="Benchmarks"
                value={comparison.current.data.reduce((s, d) => s + d.benchmarks, 0)}
                change={comparison.change.benchmarks}
              />
              <KpiCard
                title="Downloads"
                value={comparison.current.data.reduce((s, d) => s + d.downloads, 0)}
                change={comparison.change.downloads}
              />
              <KpiCard
                title="Discord"
                value={comparison.current.data.reduce((s, d) => s + d.discordActivity, 0)}
                change={comparison.change.discordActivity}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'benchmarks' && (
        <div className="space-y-6">
          {/* Benchmark Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Total Submissions" value={benchmarks?.total.submissions ?? 0} isLoading={loadingBenchmarks} />
            <KpiCard title="Valid" value={benchmarks?.total.validSubmissions ?? 0} isLoading={loadingBenchmarks} />
            <KpiCard title="Flagged" value={benchmarks?.total.flaggedSubmissions ?? 0} isLoading={loadingBenchmarks} />
            <KpiCard title="Unique Members" value={benchmarks?.total.uniqueMembers ?? 0} isLoading={loadingBenchmarks} />
          </div>

          {/* By Category Chart */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Submissions by Category</h3>
            {benchmarks?.byCategory && benchmarks.byCategory.length > 0 ? (
              <ComparisonBarChart
                data={benchmarks.byCategory.map((c) => ({
                  name: c.category.charAt(0) + c.category.slice(1).toLowerCase(),
                  value: c.submissionCount,
                  color: c.flaggedCount > 0 ? 'var(--warning)' : 'var(--gold)',
                }))}
                layout="horizontal"
                height={250}
              />
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground">
                {loadingBenchmarks ? 'Loading...' : 'No benchmark data'}
              </div>
            )}
          </Card>

          {/* Category Details Table */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Category Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Submissions</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valid</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Flagged</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks?.byCategory.map((cat) => (
                    <tr key={cat.category} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{cat.category}</td>
                      <td className="py-2 px-3 text-right">{cat.submissionCount}</td>
                      <td className="py-2 px-3 text-right">{cat.validCount}</td>
                      <td className="py-2 px-3 text-right text-warning">{cat.flaggedCount}</td>
                      <td className="py-2 px-3 text-right">{cat.uniqueMembers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'resources' && (
        <div className="space-y-6">
          {/* Resource Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Total Resources" value={resources?.totalResources ?? 0} isLoading={loadingResources} />
            <KpiCard title="Total Downloads" value={resources?.totalDownloads ?? 0} isLoading={loadingResources} />
            <KpiCard title="Unique Downloaders" value={resources?.uniqueDownloaders ?? 0} isLoading={loadingResources} />
            <KpiCard title="Downloads (Period)" value={resources?.downloadsThisPeriod ?? 0} isLoading={loadingResources} />
          </div>

          {/* Popular & Trending Side by Side */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-4">
              <h3 className="font-semibold text-foreground mb-4">Most Popular</h3>
              {popularResources?.resources && popularResources.resources.length > 0 ? (
                <div className="space-y-2">
                  {popularResources.resources.slice(0, 5).map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground w-6">{i + 1}.</span>
                        <div>
                          <p className="font-medium text-foreground text-sm">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{r.type}</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{r.downloadCount} downloads</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No resources yet</p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-foreground mb-4">Trending</h3>
              {trendingResources?.resources && trendingResources.resources.length > 0 ? (
                <div className="space-y-2">
                  {trendingResources.resources.slice(0, 5).map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground w-6">{i + 1}.</span>
                        <div>
                          <p className="font-medium text-foreground text-sm">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{r.recentDownloads} this week</p>
                        </div>
                      </div>
                      <span className={`text-sm ${r.growthPercent > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                        {r.growthPercent > 0 ? '+' : ''}{r.growthPercent}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No trending resources</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
