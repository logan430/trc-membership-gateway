'use client';

import { usePathname } from 'next/navigation';
import { AdminAuthGuard, AdminSidebar } from '@/components/admin';
import { Header } from '@/components/layout';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Admin dashboard layout
 * Wraps all /admin/* pages with auth guard, sidebar, and header
 * Exception: /admin/login bypasses auth guard
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  // Auth pages (login) should render without the auth guard and layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

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
