'use client';

/**
 * Billing Data Hooks
 *
 * React Query hooks for fetching billing data and managing
 * Stripe billing portal access.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';

/**
 * Hook to fetch member's billing details
 * Returns subscription status, payment method, and invoices
 */
export function useBilling() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.getDetails(),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook to create Stripe billing portal session
 * Opens portal in new tab on success
 */
export function useBillingPortal() {
  return useMutation({
    mutationFn: () => billingApi.createPortal(),
    onSuccess: (data) => {
      // Open Stripe portal in new tab
      window.open(data.portalUrl, '_blank');
    },
  });
}
