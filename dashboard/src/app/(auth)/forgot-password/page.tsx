'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Card, Input, Button } from '@/components/ui';
import { ArrowLeft, CheckCircle } from 'lucide-react';

/**
 * Forgot Password Page
 *
 * Features:
 * - Email input for reset request
 * - Shows success message after submission (regardless of email existence)
 * - Link back to login page
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email.');
        return;
      }

      // Show success state
      setIsSubmitted(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground font-heading">
            Check Thy Email
          </h1>
          <p className="text-muted-foreground mt-1">
            A message is on its way
          </p>
        </div>

        {/* Success Card */}
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle className="text-green-500" size={32} />
              </div>
            </div>
            <p className="text-muted-foreground">
              If an account exists with <span className="text-foreground font-medium">{email}</span>,
              thou shalt receive a password reset link shortly.
            </p>
            <p className="text-sm text-muted-foreground">
              Check thy spam folder if thou dost not see it within a few minutes.
            </p>
          </div>
        </Card>

        {/* Back to login */}
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-gold hover:text-gold-dark font-medium"
        >
          <ArrowLeft size={16} />
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground font-heading">
          Forgot Thy Password?
        </h1>
        <p className="text-muted-foreground mt-1">
          Enter thy email to receive a reset link
        </p>
      </div>

      {/* Form Card */}
      <Card className="p-6">
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

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            className="w-full"
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
      </Card>

      {/* Back to login link */}
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
