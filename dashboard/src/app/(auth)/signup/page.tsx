'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Card, Input, Button, PasswordInput, PasswordStrength, PasswordRequirements } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

/**
 * Signup Page
 *
 * Features:
 * - Email/password/confirm registration
 * - Client-side password validation
 * - Inline password mismatch feedback
 * - Terms of Service acceptance required
 */
export default function SignupPage() {
  const { signup, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }

    // Validate terms acceptance
    if (!termsAccepted) {
      setValidationError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }

    await signup(email, password);
  };

  const displayError = validationError || error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground font-heading">
          Join The Council
        </h1>
        <p className="text-muted-foreground mt-1">
          Create your account to begin
        </p>
      </div>

      {/* Signup Card */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError && (
            <div className="p-3 rounded-[8px] bg-destructive/10 border-2 border-destructive text-destructive text-sm">
              {displayError}
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

          <div className="space-y-2">
            <PasswordInput
              id="password"
              label="Password"
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
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isLoading}
            error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
          />

          {/* Terms acceptance checkbox */}
          <div className="flex items-start gap-3">
            <input
              id="terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              disabled={isLoading}
              className="mt-1 h-4 w-4 rounded border-2 border-border bg-background text-gold focus:ring-gold focus:ring-offset-background accent-gold cursor-pointer"
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
              I agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-gold-dark underline underline-offset-2"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-gold-dark underline underline-offset-2"
              >
                Privacy Policy
              </a>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            className="w-full"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>
      </Card>

      {/* Footer link */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
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
