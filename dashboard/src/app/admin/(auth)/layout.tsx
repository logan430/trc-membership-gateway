/**
 * Admin Auth Pages Layout
 *
 * Simple layout for admin auth pages (login).
 * Does NOT include AdminAuthGuard or sidebar - just renders children.
 */

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AdminAuthLayout({ children }: AuthLayoutProps) {
  return <>{children}</>;
}
