'use client';

import { Settings, Hash } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { FeatureFlagCard } from '@/components/admin/FeatureFlagCard';
import { useFeatureFlags, useDiscordChannels, useSeedFlags, useSeedTemplates } from '@/hooks/useAdminConfig';
import { useAdminAuth } from '@/lib/admin-auth';

export default function AdminConfigPage() {
  const { isSuperAdmin } = useAdminAuth();
  const { data: flagsData, isLoading: flagsLoading } = useFeatureFlags();
  const { data: channelsData, isLoading: channelsLoading } = useDiscordChannels();
  const seedFlagsMutation = useSeedFlags();
  const seedTemplatesMutation = useSeedTemplates();

  const isLoading = flagsLoading || channelsLoading;

  const handleSeedFlags = async () => {
    try {
      await seedFlagsMutation.mutateAsync();
      alert('Default feature flags created successfully.');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to seed flags'}`);
    }
  };

  const handleSeedTemplates = async () => {
    try {
      await seedTemplatesMutation.mutateAsync();
      alert('Default email templates created successfully.');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to seed templates'}`);
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading configuration..." />;
  }

  const flags = flagsData?.flags || [];
  const channels = channelsData?.channels;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings size={28} className="text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Configuration</h1>
          <p className="text-muted-foreground">Toggle features and view system configuration</p>
        </div>
      </div>

      {/* Feature Flags Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Feature Flags</h2>
          {isSuperAdmin && flags.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedFlags}
              disabled={seedFlagsMutation.isPending}
            >
              {seedFlagsMutation.isPending ? 'Seeding...' : 'Seed Default Flags'}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Toggle system behaviors. Changes take effect immediately.
          {!isSuperAdmin && ' (Super Admin required to toggle flags)'}
        </p>

        <div className="space-y-4 max-w-2xl">
          {flags.map((flag) => (
            <FeatureFlagCard key={flag.key} flag={flag} canToggle={isSuperAdmin} />
          ))}
          {flags.length === 0 && (
            <Card className="p-4">
              <p className="text-muted-foreground">
                No feature flags configured.
                {isSuperAdmin && ' Click "Seed Default Flags" to create them.'}
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* Discord Channels Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Hash size={20} className="text-gold" />
          <h2 className="text-lg font-semibold text-foreground">Discord Channels</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Channel IDs are configured via environment variables and cannot be changed here.
        </p>

        <Card className="max-w-2xl">
          <div className="divide-y divide-border">
            <div className="p-4 flex justify-between items-center">
              <span className="text-foreground font-medium">Introductions Channel</span>
              <code className="text-sm text-muted-foreground font-mono">
                {channels?.introductions || 'Not configured'}
              </code>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-foreground font-medium">Billing Support Channel</span>
              <code className="text-sm text-muted-foreground font-mono">
                {channels?.billingSupport || 'Not configured'}
              </code>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-foreground font-medium">Admin Alerts Channel</span>
              <code className="text-sm text-muted-foreground font-mono">
                {channels?.adminAlerts || 'Not configured'}
              </code>
            </div>
          </div>
        </Card>
      </section>

      {/* Data Seeding Section (Super Admin Only) */}
      {isSuperAdmin && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Data Seeding</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Initialize default data for the system.
          </p>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={handleSeedFlags}
              disabled={seedFlagsMutation.isPending}
            >
              {seedFlagsMutation.isPending ? 'Seeding...' : 'Seed Default Flags'}
            </Button>
            <Button
              variant="outline"
              onClick={handleSeedTemplates}
              disabled={seedTemplatesMutation.isPending}
            >
              {seedTemplatesMutation.isPending ? 'Seeding...' : 'Seed Default Templates'}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
