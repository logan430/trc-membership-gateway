'use client';

/**
 * Billing Page
 *
 * Displays member subscription status, payment method, and invoice history.
 * Provides access to Stripe billing portal for self-service changes.
 *
 * Features:
 * - Subscription status with plan and renewal date
 * - Payment method details (card brand, last 4, expiry)
 * - Invoice history with view links
 * - Team member view shows managed-by message
 * - Stripe portal button for billing management
 */

import { GoldCoinsLoader, Card, Button } from '@/components/ui';
import { useBilling, useBillingPortal } from '@/hooks/useBilling';
import {
  CreditCard,
  FileText,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

export default function BillingPage() {
  const { data, isLoading, error } = useBilling();
  const portalMutation = useBillingPortal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GoldCoinsLoader />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Failed to load billing details</p>
      </Card>
    );
  }

  // Team member view - billing managed by owner
  if (data?.managedBy === 'team') {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Billing</h1>
          <p className="text-muted-foreground">
            Your subscription is managed by your team.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent rounded-[8px]">
              <CreditCard size={24} className="text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Team Subscription</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Billing for your account is managed by <strong>{data.teamName}</strong>.
                Contact your team owner for billing questions.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-success/10 text-success',
      past_due: 'bg-orange-100 text-orange-600',
      canceled: 'bg-red-100 text-red-600',
      trialing: 'bg-blue-100 text-blue-600',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and payment details.
        </p>
      </div>

      {/* Subscription status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Subscription</h2>
          {data?.subscription && (
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadge(
                data.subscription.status
              )}`}
            >
              {data.subscription.status.replace('_', ' ')}
            </span>
          )}
        </div>

        {data?.subscription ? (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{data.subscription.planName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {data.subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}
              </span>
              <span className="font-medium">
                {formatDate(data.subscription.currentPeriodEnd)}
              </span>
            </div>
            {data.subscription.cancelAtPeriodEnd && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-[8px] text-sm">
                <AlertCircle size={16} className="text-orange-600" />
                <span className="text-orange-700">
                  Your subscription will end on {formatDate(data.subscription.currentPeriodEnd)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No active subscription</p>
        )}
      </Card>

      {/* Payment method */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Payment Method</h2>

        {data?.paymentMethod ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-[8px]">
                <CreditCard size={20} />
              </div>
              <div>
                <p className="font-medium capitalize">
                  {data.paymentMethod.brand} ending in {data.paymentMethod.last4}
                </p>
                <p className="text-sm text-muted-foreground">
                  Expires {data.paymentMethod.expMonth}/{data.paymentMethod.expYear}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No payment method on file</p>
        )}
      </Card>

      {/* Manage in Stripe button */}
      {data?.canManageBilling && (
        <Button
          onClick={() => portalMutation.mutate()}
          loading={portalMutation.isPending}
          variant="outline"
          className="w-full"
        >
          <ExternalLink size={16} className="mr-2" />
          Manage Billing in Stripe
        </Button>
      )}

      {/* Invoice history */}
      <Card>
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Invoice History</h2>
        </div>

        {data?.invoices && data.invoices.length > 0 ? (
          <div className="divide-y divide-border">
            {data.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-muted-foreground" />
                  <div>
                    <p className="font-medium">{formatDate(invoice.date)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatAmount(invoice.amount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full capitalize ${
                      invoice.status === 'paid'
                        ? 'bg-success/10 text-success'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {invoice.status || 'pending'}
                  </span>
                  {invoice.hostedUrl && (
                    <a
                      href={invoice.hostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gold-dark hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            No invoices yet
          </div>
        )}
      </Card>
    </div>
  );
}
