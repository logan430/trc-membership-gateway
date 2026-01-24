'use client';

import { useState } from 'react';
import { Sidebar, Header } from '@/components/layout';

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
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <div className="hidden lg:flex">
        <Sidebar goldCount={150} />
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
            <Sidebar goldCount={150} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          memberName="Guild Member"
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
