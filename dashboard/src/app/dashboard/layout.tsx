'use client';

import { useState } from 'react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: points } = usePointsSummary();
  const { data: profile } = useProfile();

  const goldCount = points?.totalPoints ?? 0;
  const memberName = profile?.member?.discordUsername || profile?.member?.email?.split('@')[0] || 'Member';

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
