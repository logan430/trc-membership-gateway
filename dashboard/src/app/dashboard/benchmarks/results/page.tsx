'use client';

/**
 * Benchmark Results Page
 *
 * Displays benchmark comparison charts for members who have submitted data.
 * Shows:
 * - Category tabs for switching between benchmark types
 * - Comparison bars (your value vs median/average)
 * - Metric cards with position on range
 * - K-anonymity gate when insufficient data
 * - Segment filters for company size and industry
 *
 * Per CONTEXT.md: Mobile responsive with touch-friendly filters
 * Per BENCH-06: K-anonymity threshold (5 submissions minimum)
 */

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoldCoinsLoader, Card, Button } from '@/components/ui';
import {
  ComparisonBar,
  MetricComparisonCard,
  KAnonymityGate,
} from '@/components/benchmarks';
import {
  useAggregates,
  useMySubmissions,
  BenchmarkCategory,
} from '@/hooks/useBenchmarks';
import { ChevronLeft, Filter, BarChart3 } from 'lucide-react';

const categoryLabels: Record<BenchmarkCategory, string> = {
  COMPENSATION: 'Compensation',
  INFRASTRUCTURE: 'Infrastructure',
  BUSINESS: 'Business Metrics',
  OPERATIONAL: 'Operational',
};

// Field display configuration with formatting options
const fieldFormats: Record<
  string,
  { prefix?: string; suffix?: string; label: string; higherIsBetter?: boolean }
> = {
  // Compensation fields
  base_salary: { prefix: '$', label: 'Base Salary' },
  equity_percent: { suffix: '%', label: 'Equity Percentage' },
  bonus_target: { suffix: '%', label: 'Bonus Target' },
  total_comp: { prefix: '$', label: 'Total Compensation' },
  years_experience: { label: 'Years Experience' },

  // Infrastructure fields
  monthly_hosting: { prefix: '$', label: 'Monthly Hosting', higherIsBetter: false },
  tool_count: { label: 'Tool Count' },
  monthly_tooling: { prefix: '$', label: 'Monthly Tooling', higherIsBetter: false },
  infra_spend: { prefix: '$', label: 'Infrastructure Spend', higherIsBetter: false },

  // Business fields
  annual_revenue: { prefix: '$', label: 'Annual Revenue' },
  growth_rate: { suffix: '%', label: 'Growth Rate' },
  cac: { prefix: '$', label: 'Customer Acquisition Cost', higherIsBetter: false },
  ltv: { prefix: '$', label: 'Customer Lifetime Value' },
  ltv_cac_ratio: { label: 'LTV:CAC Ratio' },
  churn_rate: { suffix: '%', label: 'Churn Rate', higherIsBetter: false },
  nrr: { suffix: '%', label: 'Net Revenue Retention' },

  // Operational fields
  team_size: { label: 'Team Size' },
  eng_percent: { suffix: '%', label: 'Engineering %' },
  remote_percent: { suffix: '%', label: 'Remote %' },
  revenue_per_employee: { prefix: '$', label: 'Revenue per Employee' },
};

function BenchmarkResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') as BenchmarkCategory | null;

  const [category, setCategory] = useState<BenchmarkCategory>(
    categoryParam || 'COMPENSATION'
  );
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    companySize?: string;
    industry?: string;
  }>({});

  const { data: submissions } = useMySubmissions();
  const { data: aggregates, isLoading, error } = useAggregates(category, filters);

  const hasSubmitted = submissions?.submissions?.some(
    (s: { category: string }) => s.category === category
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GoldCoinsLoader />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Failed to load benchmark results</p>
        <Button
          onClick={() => router.refresh()}
          variant="outline"
          className="mt-4"
        >
          Try Again
        </Button>
      </Card>
    );
  }

  const hasInsufficientData =
    !aggregates?.available?.length && aggregates?.insufficient?.length;

  const fieldsWithYourValue =
    aggregates?.available?.filter((a) => a.yourValue !== undefined) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/benchmarks')}
          className="p-2 hover:bg-accent rounded-[8px] transition-colors"
          aria-label="Back to benchmarks"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {categoryLabels[category]} Results
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            See how you compare to your peers
          </p>
        </div>
      </div>

      {/* Category tabs - horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        {(Object.keys(categoryLabels) as BenchmarkCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap rounded-[8px] transition-colors flex-shrink-0 ${
              category === cat
                ? 'bg-gold/10 text-gold-dark border-2 border-gold/30'
                : 'bg-accent text-muted-foreground hover:text-foreground border-2 border-transparent'
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Filters toggle and clear */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Filter size={16} />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        {Object.keys(filters).filter((k) => filters[k as keyof typeof filters])
          .length > 0 && (
          <button
            onClick={() => setFilters({})}
            className="text-sm text-gold-dark hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={filters.companySize || ''}
              onChange={(e) =>
                setFilters({ ...filters, companySize: e.target.value || undefined })
              }
              className="px-3 py-2 border border-input bg-background rounded-[8px] w-full sm:w-auto min-h-[44px] text-sm"
            >
              <option value="">All Company Sizes</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201+">201+ employees</option>
            </select>
            <select
              value={filters.industry || ''}
              onChange={(e) =>
                setFilters({ ...filters, industry: e.target.value || undefined })
              }
              className="px-3 py-2 border border-input bg-background rounded-[8px] w-full sm:w-auto min-h-[44px] text-sm"
            >
              <option value="">All Industries</option>
              <option value="saas">SaaS</option>
              <option value="agency">Agency</option>
              <option value="ecommerce">E-commerce</option>
              <option value="services">Services</option>
              <option value="fintech">Fintech</option>
              <option value="healthcare">Healthcare</option>
            </select>
          </div>
        </Card>
      )}

      {/* Results content */}
      {hasInsufficientData ? (
        <KAnonymityGate
          needed={5}
          current={aggregates?.insufficient[0]?.count || 0}
          category={categoryLabels[category]}
          onSubmit={
            !hasSubmitted ? () => router.push('/dashboard/benchmarks') : undefined
          }
        />
      ) : fieldsWithYourValue.length === 0 ? (
        // No submission from this member yet
        <Card className="p-6 sm:p-8 text-center">
          <BarChart3 className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="font-semibold text-lg mb-2">Submit Your Data First</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Submit your {categoryLabels[category].toLowerCase()} data to see how
            you compare to your peers.
          </p>
          <Button
            onClick={() => router.push('/dashboard/benchmarks')}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            Submit Benchmark
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Comparison bars section */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Your Values vs Peers</h2>
            <div className="space-y-6">
              {fieldsWithYourValue.slice(0, 4).map((field) => {
                const format = fieldFormats[field.field] || { label: field.field };
                return (
                  <Card key={field.field} className="p-4 sm:p-6">
                    <ComparisonBar
                      label={format.label}
                      yourValue={field.yourValue!}
                      median={field.median}
                      average={field.average}
                      prefix={format.prefix}
                      suffix={format.suffix}
                    />
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Metric comparison cards section */}
          {fieldsWithYourValue.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Position in Range</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldsWithYourValue.map((field) => {
                  const format = fieldFormats[field.field] || { label: field.field };
                  return (
                    <MetricComparisonCard
                      key={field.field}
                      label={format.label}
                      yourValue={field.yourValue!}
                      median={field.median}
                      min={field.min}
                      max={field.max}
                      prefix={format.prefix}
                      suffix={format.suffix}
                      higherIsBetter={format.higherIsBetter}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Aggregate info */}
          {aggregates?.available?.[0]?.count && (
            <p className="text-xs text-muted-foreground text-center">
              Based on {aggregates.available[0].count} submission
              {aggregates.available[0].count !== 1 ? 's' : ''}
              {filters.companySize || filters.industry
                ? ' matching your filters'
                : ' from the community'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BenchmarkResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <GoldCoinsLoader />
        </div>
      }
    >
      <BenchmarkResultsContent />
    </Suspense>
  );
}
