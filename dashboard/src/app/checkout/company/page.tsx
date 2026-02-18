'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, Button, Input } from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Company Checkout Page
 *
 * Collects company name and seat counts, then creates a Stripe Checkout session.
 */
export default function CompanyCheckoutPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [ownerSeats, setOwnerSeats] = useState(1);
  const [teamSeats, setTeamSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  };

  const monthlyCost = (ownerSeats * 59) + (teamSeats * 29);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE}/company/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ companyName, ownerSeats, teamSeats }),
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

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
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

      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground font-heading">
            Company Plan
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure your team seats
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-[8px] bg-destructive/10 border-2 border-destructive text-destructive text-sm">
                {error}
              </div>
            )}

            <Input
              id="companyName"
              label="Company Name"
              placeholder="Your company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              minLength={3}
              disabled={loading}
            />

            <div>
              <label className="block text-sm font-medium mb-1">Owner Seats ($59/month each)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={ownerSeats}
                onChange={(e) => setOwnerSeats(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={loading}
                className="w-full px-3 py-2 rounded-[8px] border-2 border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-gold focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Team Seats ($29/month each)</label>
              <input
                type="number"
                min={0}
                max={50}
                value={teamSeats}
                onChange={(e) => setTeamSeats(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={loading}
                className="w-full px-3 py-2 rounded-[8px] border-2 border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-gold focus:border-gold"
              />
            </div>

            {/* Price summary */}
            <div className="p-3 bg-muted rounded-[8px] text-center">
              <p className="text-sm text-muted-foreground">Estimated Monthly Total</p>
              <p className="text-2xl font-bold text-foreground">${monthlyCost}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
              <p className="text-xs text-muted-foreground mt-1">
                {ownerSeats} owner{ownerSeats > 1 ? 's' : ''} + {teamSeats} team seat{teamSeats !== 1 ? 's' : ''}
              </p>
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="w-full"
              loading={loading}
            >
              Continue to Payment
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/checkout"
            className="text-gold hover:text-gold-dark font-medium underline underline-offset-4"
          >
            Back to plan selection
          </Link>
        </p>
      </div>
    </div>
  );
}
