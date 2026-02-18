'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, Button } from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Checkout Page
 *
 * Shown after signup. Lets user choose Individual or Company plan,
 * then creates a Stripe Checkout session and redirects to Stripe.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<'individual' | 'company' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  };

  const handleIndividualCheckout = async () => {
    setError(null);
    setLoading('individual');

    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login?reason=session_expired');
          return;
        }
        setError(data.error || 'Failed to create checkout session');
        return;
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleCompanyCheckout = () => {
    // For company, we need additional info (company name, seat counts)
    // Redirect to a company checkout form
    router.push('/checkout/company');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link href="/" className="mb-8 text-center hover:opacity-80 transition-opacity">
        <Image
          src="/images/shield-logo.svg"
          alt="The Revenue Council"
          width={64}
          height={77}
          priority
        />
      </Link>

      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground font-heading">
            Choose Your Path
          </h1>
          <p className="text-muted-foreground mt-1">
            Select a plan to activate your membership
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-[8px] bg-destructive/10 border-2 border-destructive text-destructive text-sm text-center">
            {error}
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Individual Plan */}
          <Card className="p-6 flex flex-col">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-foreground font-heading">Individual</h2>
              <p className="text-sm text-muted-foreground italic mt-1">For the Solo Practitioner</p>
            </div>
            <div className="text-center mb-4">
              <span className="text-3xl font-bold text-foreground">$59</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1 text-sm">
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Full community access</li>
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Member discussions</li>
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Resource library</li>
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Private channels</li>
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Weekly roundtables</li>
            </ul>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handleIndividualCheckout}
              loading={loading === 'individual'}
              disabled={loading !== null}
            >
              Begin Your Journey
            </Button>
          </Card>

          {/* Company Plan */}
          <Card className="p-6 flex flex-col relative border-gold">
            <span className="absolute -top-3 right-4 bg-gold text-foreground text-xs font-bold px-3 py-1 rounded-[6px] border-2 border-gold-dark">
              Best Value
            </span>
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-foreground font-heading">Company</h2>
              <p className="text-sm text-muted-foreground italic mt-1">For Teams of Champions</p>
            </div>
            <div className="text-center mb-4">
              <span className="text-3xl font-bold text-foreground">$59</span>
              <span className="text-muted-foreground text-sm">/month + $29/seat</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1 text-sm">
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Everything in Individual</li>
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Add team members at $29/seat</li>
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Owner-only channels</li>
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Team management dashboard</li>
              <li className="flex items-start gap-2"><span className="text-gold">&#10022;</span> Flexible seat scaling</li>
            </ul>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handleCompanyCheckout}
              disabled={loading !== null}
            >
              Enlist Your Team
            </Button>
          </Card>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Already subscribed?{' '}
          <Link
            href="/dashboard"
            className="text-gold hover:text-gold-dark font-medium underline underline-offset-4"
          >
            Go to Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
