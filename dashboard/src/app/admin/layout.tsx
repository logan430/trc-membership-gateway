'use client';

import { AdminAuthGuard, AdminSidebar } from '@/components/admin';
import { Header } from '@/components/layout';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Admin dashboard layout
 * Wraps all /admin/* pages with auth guard, sidebar, and header
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminAuthGuard>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <AdminSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header
            memberName="Admin"
          />

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
