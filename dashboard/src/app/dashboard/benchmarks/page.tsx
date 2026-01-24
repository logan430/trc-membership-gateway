'use client';

/**
 * Benchmarks Page - Submit and track peer benchmark data
 *
 * Shows 4 benchmark categories with submission status.
 * Clicking a category opens the conversational wizard.
 * Submissions award +50 gold points.
 */

import { useState } from 'react';
import { GoldCoinsLoader, Card } from '@/components/ui';
import { CategoryCard, ConversationalWizard, type WizardQuestion } from '@/components/benchmarks';
import { useMySubmissions, useSubmitBenchmark, type BenchmarkCategory } from '@/hooks/useBenchmarks';
import { DollarSign, Server, TrendingUp, Users } from 'lucide-react';

// Question definitions matching backend schemas (src/benchmarks/schemas.ts)
const categoryQuestions: Record<BenchmarkCategory, WizardQuestion[]> = {
  COMPENSATION: [
    {
      field: 'gtm_engineer_us',
      question: 'What do you pay a US-based GTM engineer (annual)?',
      type: 'number',
      unit: '$',
      hint: 'Full-time salary for US-based go-to-market engineers',
    },
    {
      field: 'gtm_engineer_offshore',
      question: 'What do you pay an offshore GTM engineer (annual)?',
      type: 'number',
      unit: '$',
      hint: 'Full-time salary for offshore go-to-market engineers',
    },
    {
      field: 'sdr_bdr_us_salary',
      question: 'What is the base salary for a US SDR/BDR?',
      type: 'number',
      unit: '$',
      hint: 'Annual base salary before commission',
    },
    {
      field: 'sdr_bdr_us_commission',
      question: 'What is the commission structure for your SDRs/BDRs?',
      type: 'text',
      hint: 'e.g., "10% of first year ACV" or "$500 per qualified meeting"',
    },
    {
      field: 'sdr_bdr_offshore_salary',
      question: 'What do you pay offshore SDRs/BDRs (annual)?',
      type: 'number',
      unit: '$',
    },
    {
      field: 'account_manager',
      question: 'What is your account manager compensation (annual)?',
      type: 'number',
      unit: '$',
      hint: 'Total compensation including base and expected commission',
    },
    {
      field: 'virtual_assistant_hourly',
      question: 'What hourly rate do you pay virtual assistants?',
      type: 'number',
      unit: '$',
    },
    {
      field: 'copywriter_hourly',
      question: 'What hourly rate do you pay copywriters?',
      type: 'number',
      unit: '$',
    },
  ],
  INFRASTRUCTURE: [
    {
      field: 'cost_per_domain',
      question: 'What do you pay per domain (annual)?',
      type: 'number',
      unit: '$',
      required: true,
      hint: 'Annual cost per sending domain',
    },
    {
      field: 'domain_vendor',
      question: 'Who is your domain vendor?',
      type: 'text',
      hint: 'e.g., Namecheap, GoDaddy, Cloudflare',
    },
    {
      field: 'cost_per_inbox',
      question: 'What do you pay per inbox (monthly)?',
      type: 'number',
      unit: '$',
      hint: 'Monthly cost per email inbox',
    },
    {
      field: 'inbox_provider',
      question: 'Who is your inbox provider?',
      type: 'text',
      hint: 'e.g., Google Workspace, Microsoft 365, custom SMTP',
    },
    {
      field: 'warmup_tool',
      question: 'What warmup tool do you use?',
      type: 'text',
      hint: 'e.g., Instantly, Mailreach, Lemwarm',
    },
    {
      field: 'warmup_cost',
      question: 'What is your monthly warmup tool cost?',
      type: 'number',
      unit: '$',
    },
    {
      field: 'sending_platform',
      question: 'What sending platform do you use?',
      type: 'text',
      hint: 'e.g., Instantly, Smartlead, Apollo',
    },
    {
      field: 'sending_platform_cost',
      question: 'What is your monthly sending platform cost?',
      type: 'number',
      unit: '$',
    },
    {
      field: 'data_enrichment_cost',
      question: 'What is your monthly data enrichment spend?',
      type: 'number',
      unit: '$',
      hint: 'e.g., Apollo, ZoomInfo, Clay',
    },
  ],
  BUSINESS: [
    {
      field: 'annual_revenue_band',
      question: 'What is your annual revenue range?',
      type: 'select',
      required: true,
      options: [
        { value: 'sub_100k', label: 'Under $100K' },
        { value: '100k_250k', label: '$100K - $250K' },
        { value: '250k_500k', label: '$250K - $500K' },
        { value: '500k_1m', label: '$500K - $1M' },
        { value: '1m_2m', label: '$1M - $2M' },
        { value: '2m_5m', label: '$2M - $5M' },
        { value: 'above_5m', label: '$5M+' },
      ],
    },
    {
      field: 'agency_type',
      question: 'What type of agency are you?',
      type: 'select',
      options: [
        { value: 'lead_gen', label: 'Lead Generation' },
        { value: 'appointment_setting', label: 'Appointment Setting' },
        { value: 'full_service', label: 'Full Service (Lead Gen + Closing)' },
        { value: 'consulting', label: 'Consulting/Advisory' },
        { value: 'hybrid', label: 'Hybrid Model' },
      ],
    },
    {
      field: 'average_monthly_retainer',
      question: 'What is your average monthly retainer?',
      type: 'number',
      unit: '$',
      hint: 'Average monthly fee per client',
    },
    {
      field: 'pricing_model',
      question: 'What is your primary pricing model?',
      type: 'select',
      options: [
        { value: 'retainer', label: 'Monthly Retainer' },
        { value: 'per_meeting', label: 'Per Meeting/Appointment' },
        { value: 'performance', label: 'Performance-Based' },
        { value: 'hybrid', label: 'Hybrid (Retainer + Performance)' },
      ],
    },
    {
      field: 'gross_margin_percent',
      question: 'What is your gross margin percentage?',
      type: 'number',
      unit: '%',
      hint: 'Revenue minus direct costs, divided by revenue',
    },
    {
      field: 'monthly_client_churn_percent',
      question: 'What is your monthly client churn rate?',
      type: 'number',
      unit: '%',
      hint: 'Percentage of clients lost per month',
    },
    {
      field: 'revenue_per_employee',
      question: 'What is your revenue per employee?',
      type: 'number',
      unit: '$',
      hint: 'Annual revenue divided by number of employees',
    },
  ],
  OPERATIONAL: [
    {
      field: 'domains_per_client',
      question: 'How many domains do you use per client?',
      type: 'number',
      required: true,
      hint: 'Average number of sending domains per client',
    },
    {
      field: 'inboxes_per_domain',
      question: 'How many inboxes per domain?',
      type: 'number',
      hint: 'Number of email accounts per sending domain',
    },
    {
      field: 'daily_sends_per_inbox',
      question: 'How many emails do you send per inbox per day?',
      type: 'number',
      hint: 'Daily send volume per individual inbox',
    },
    {
      field: 'warmup_period_days',
      question: 'How long is your domain warmup period?',
      type: 'number',
      unit: 'days',
      hint: 'Days before sending at full volume',
    },
    {
      field: 'average_reply_rate_percent',
      question: 'What is your average reply rate?',
      type: 'number',
      unit: '%',
      hint: 'Total replies divided by total emails sent',
    },
    {
      field: 'average_positive_reply_rate_percent',
      question: 'What is your average positive reply rate?',
      type: 'number',
      unit: '%',
      hint: 'Interested/positive replies divided by total emails sent',
    },
    {
      field: 'average_meeting_rate_percent',
      question: 'What is your average meeting booking rate?',
      type: 'number',
      unit: '%',
      hint: 'Meetings booked divided by total emails sent',
    },
  ],
};

// Category metadata for cards
const categoryMeta: Record<
  BenchmarkCategory,
  { title: string; description: string; icon: React.ReactNode }
> = {
  COMPENSATION: {
    title: 'Compensation',
    description: 'Salaries and rates for SDRs, engineers, VAs, and more',
    icon: <DollarSign size={24} />,
  },
  INFRASTRUCTURE: {
    title: 'Infrastructure',
    description: 'Domain, inbox, warmup, and tooling costs',
    icon: <Server size={24} />,
  },
  BUSINESS: {
    title: 'Business Metrics',
    description: 'Revenue, margins, churn, and pricing models',
    icon: <TrendingUp size={24} />,
  },
  OPERATIONAL: {
    title: 'Operational',
    description: 'Send volumes, reply rates, and campaign metrics',
    icon: <Users size={24} />,
  },
};

export default function BenchmarksPage() {
  const [selectedCategory, setSelectedCategory] = useState<BenchmarkCategory | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(0);

  const { data: submissions, isLoading } = useMySubmissions();
  const submitMutation = useSubmitBenchmark();

  // Check if member has submitted for a category
  const hasSubmitted = (category: BenchmarkCategory) =>
    submissions?.submissions?.some((s) => s.category === category) ?? false;

  // Handle benchmark submission
  const handleSubmit = async (data: Record<string, unknown>) => {
    if (!selectedCategory) return;

    const result = await submitMutation.mutateAsync({
      category: selectedCategory,
      data,
    });

    setPointsAwarded(result.pointsAwarded);
    setShowSuccess(true);

    // Return to category list after showing success
    setTimeout(() => {
      setShowSuccess(false);
      setSelectedCategory(null);
    }, 2500);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GoldCoinsLoader />
      </div>
    );
  }

  // Success state after submission
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 animate-in fade-in duration-300">
        <div className="text-5xl sm:text-6xl font-bold text-gold-dark">
          +{pointsAwarded}
        </div>
        <div className="text-xl sm:text-2xl font-semibold text-foreground">
          Gold Earned!
        </div>
        <p className="text-muted-foreground text-center max-w-sm">
          Your benchmark has been submitted. Thank you for contributing to our peer data!
        </p>
      </div>
    );
  }

  // Wizard state - show questionnaire
  if (selectedCategory) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-0">
        <ConversationalWizard
          category={selectedCategory}
          questions={categoryQuestions[selectedCategory]}
          onSubmit={handleSubmit}
          onCancel={() => setSelectedCategory(null)}
          isSubmitting={submitMutation.isPending}
        />
      </div>
    );
  }

  // Default state - show category selection
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Peer Benchmarks
        </h1>
        <p className="text-muted-foreground">
          Share your data anonymously and see how you compare to peers.
          Earn +50 gold per submission.
        </p>
      </div>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(categoryMeta) as BenchmarkCategory[]).map((category) => (
          <CategoryCard
            key={category}
            title={categoryMeta[category].title}
            description={categoryMeta[category].description}
            icon={categoryMeta[category].icon}
            hasSubmitted={hasSubmitted(category)}
            onStart={() => setSelectedCategory(category)}
          />
        ))}
      </div>

      {/* Privacy notice */}
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          All benchmark data is anonymized and aggregated. Individual submissions
          are never shared. Results require 5+ submissions per category to protect
          privacy.
        </p>
      </Card>
    </div>
  );
}
