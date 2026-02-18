'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, Header } from '@/components/layout';
import { usePointsSummary } from '@/hooks/usePoints';
import { useProfile } from '@/hooks/useProfile';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Dashboard shell layout
 *
 * Provides the common structure for all dashboard pages:
 * - Sidebar navigation (collapsible)
 * - Header with user info
 * - Main content area
 * - Subscription guard (redirects unpaid users to /checkout)
 *
 * Per CONTEXT.md:
 * - Light mode only
 * - Parchment background
 * - Medieval pixel aesthetic
 *
 * Data integration:
 * - Real gold count from points summary API
 * - Real member name from profile API
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: points } = usePointsSummary();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const goldCount = points?.totalPoints ?? 0;
  const memberName = profile?.member?.discordUsername || profile?.member?.email?.split('@')[0] || 'Member';

  // Subscription guard: redirect unpaid users to checkout
  useEffect(() => {
    if (!profileLoading && profile?.member?.subscriptionStatus === 'NONE') {
      router.replace('/checkout');
    }
  }, [profileLoading, profile, router]);

  // Show loading state while checking subscription
  if (profileLoading || profile?.member?.subscriptionStatus === 'NONE') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-coin-stack inline-block text-4xl mb-4">🪙</div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <div className="hidden lg:flex">
        <Sidebar goldCount={goldCount} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-foreground/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sidebar */}
          <div className="absolute left-0 top-0 h-full w-64 bg-card shadow-lg">
            <Sidebar goldCount={goldCount} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          memberName={memberName}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
