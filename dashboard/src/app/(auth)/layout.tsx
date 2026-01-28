import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'The Revenue Council - Sign In',
  description: 'Access your membership in The Revenue Council',
};

/**
 * Auth layout - centered design for login/signup pages
 * Matches dashboard styling patterns with medieval theme
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Logo & Title */}
      <Link
        href="/"
        className="mb-8 text-center hover:opacity-80 transition-opacity group"
      >
        <div className="flex flex-col items-center justify-center gap-3 mb-2">
          <Image
            src="/images/shield-logo.svg"
            alt="The Revenue Council"
            width={64}
            height={77}
            className="group-hover:scale-105 transition-transform"
            priority
          />
          <h1 className="text-3xl font-bold text-foreground tracking-wide font-heading">
            The Revenue Council
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          A Guild of Prosperity
        </p>
      </Link>

      {/* Main content */}
      <main className="w-full max-w-md">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} The Revenue Council. All rights reserved.</p>
      </footer>
    </div>
  );
}
