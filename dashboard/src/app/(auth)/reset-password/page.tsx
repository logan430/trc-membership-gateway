'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, GoldCoinsLoader, PasswordInput, PasswordStrength, PasswordRequirements } from '@/components/ui';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

/**
 * Reset Password Form component
 * Handles token from URL and password reset submission
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // No token provided
  if (!token) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground font-heading">
            Invalid Reset Link
          </h1>
        </div>

        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-destructive/10 rounded-full">
                <XCircle className="text-destructive" size={32} />
              </div>
            </div>
            <p className="text-muted-foreground">
              This password reset link appears to be invalid or incomplete.
            </p>
            <p className="text-sm text-muted-foreground">
              Please request a new password reset link.
            </p>
          </div>
        </Card>

        <Link
          href="/forgot-password"
          className="flex items-center justify-center gap-2 text-gold hover:text-gold-dark font-medium"
        >
          <ArrowLeft size={16} />
          Request New Reset Link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError('');
    setIsLoading(true);

    // Validate passwords match
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password.');
        return;
      }

      // Show success state
      setIsSuccess(true);

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login?message=password_reset');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground font-heading">
            Password Reset!
          </h1>
          <p className="text-muted-foreground mt-1">
            Thy password hath been changed
          </p>
        </div>

        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle className="text-green-500" size={32} />
              </div>
            </div>
            <p className="text-muted-foreground">
              Thy password hath been reset successfully. Redirecting thee to sign in...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const displayError = validationError || error;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground font-heading">
          Set New Password
        </h1>
        <p className="text-muted-foreground mt-1">
          Choose a new password for thy account
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError && (
            <div className="p-3 rounded-[8px] bg-destructive/10 border-2 border-destructive text-destructive text-sm">
              {displayError}
            </div>
          )}

          <div className="space-y-2">
            <PasswordInput
              id="password"
              label="New Password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isLoading}
            />
            <PasswordStrength password={password} />
            <PasswordRequirements password={password} />
          </div>

          <PasswordInput
            id="confirm-password"
            label="Confirm Password"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isLoading}
            error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            className="w-full"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Remember thy password?{' '}
        <Link
          href="/login"
          className="text-gold hover:text-gold-dark font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
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
 * Reset Password Page
 *
 * Features:
 * - Reads token from URL query params
 * - New password and confirm password inputs
 * - Validates password requirements
 * - Shows success message and redirects to login
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FormFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
