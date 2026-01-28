'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Input, Button, GoldCoinsLoader, PasswordInput } from '@/components/ui';
import { useAuth, handleMagicLinkToken } from '@/hooks/useAuth';

/**
 * Login form with search params handling
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const { login, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Get redirect URL from query params
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  // Check for magic link token on mount
  useEffect(() => {
    handleMagicLinkToken(redirectUrl);
  }, [redirectUrl]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password, redirectUrl);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-[8px] bg-destructive/10 border-2 border-destructive text-destructive text-sm">
          {error}
        </div>
      )}

      <Input
        id="email"
        type="email"
        label="Email Address"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        disabled={isLoading}
      />

      <PasswordInput
        id="password"
        label="Password"
        placeholder="Your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        disabled={isLoading}
      />

      {/* Forgot password link */}
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-gold hover:text-gold-dark font-medium underline underline-offset-2"
        >
          Forgot thy password?
        </Link>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isLoading}
        className="w-full"
      >
        {isLoading ? 'Signing In...' : 'Sign In'}
      </Button>
    </form>
  );
}

/**
 * Loading fallback
 */
function FormFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <GoldCoinsLoader />
    </div>
  );
}

/**
 * Login Page
 *
 * Features:
 * - Email/password authentication
 * - Magic link token handling
 * - Redirect URL support
 */
export default function LoginPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground font-heading">
          Welcome Back
        </h1>
        <p className="text-muted-foreground mt-1">
          Sign in to The Revenue Council
        </p>
      </div>

      {/* Login Card */}
      <Card className="p-6">
        <Suspense fallback={<FormFallback />}>
          <LoginForm />
        </Suspense>
      </Card>

      {/* Footer link */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="text-gold hover:text-gold-dark font-medium underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
