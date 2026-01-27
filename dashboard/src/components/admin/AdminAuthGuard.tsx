'use client';

import { useAdminAuth } from '@/lib/admin-auth';
import { PageLoader } from '@/components/ui';

interface AdminAuthGuardProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

/**
 * Auth guard for admin pages
 * Redirects to login if not authenticated
 * Shows loading state while checking auth
 */
export function AdminAuthGuard({ children, requireSuperAdmin = false }: AdminAuthGuardProps) {
  const { isLoading, isAuthenticated, isSuperAdmin } = useAdminAuth();

  // Show loading while checking auth
  if (isLoading) {
    return <PageLoader message="Verifying credentials..." />;
  }

  // Redirect handled by useAdminAuth, but render nothing if not authenticated
  if (!isAuthenticated) {
    return <PageLoader message="Redirecting to login..." />;
  }

  // Check super admin requirement
  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Super admin privileges required.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
