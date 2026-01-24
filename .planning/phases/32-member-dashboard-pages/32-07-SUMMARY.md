---
phase: 32-member-dashboard-pages
plan: 07
subsystem: dashboard-frontend
tags: [billing, navigation, stripe, react-query]

dependency_graph:
  requires: ["32-01", "32-06"]
  provides: ["UI-09", "UI-10", "UI-11"]
  affects: []

tech_stack:
  added: []
  patterns:
    - "useBilling hook for subscription data"
    - "useBillingPortal mutation for Stripe portal access"
    - "Real data in layout from usePointsSummary and useProfile"

key_files:
  created:
    - dashboard/src/hooks/useBilling.ts
    - dashboard/src/app/dashboard/billing/page.tsx
  modified:
    - dashboard/src/lib/api.ts
    - dashboard/src/app/dashboard/layout.tsx
    - dashboard/src/app/dashboard/benchmarks/page.tsx

decisions:
  - decision: "Invoice amount from backend is already in dollars"
    rationale: "Backend billing.ts divides by 100 before sending"
    context: "Billing page format"
  - decision: "View Results button only shows when member has submissions"
    rationale: "No point showing results link before submitting data"
    context: "Benchmarks navigation UX"

metrics:
  duration: "3 minutes"
  completed: "2026-01-24"
---

# Phase 32 Plan 07: Billing Page and Final Navigation Summary

Billing page with subscription status, payment method, and invoice history. Navigation polish with real data in layout.

## What Was Built

### 1. Billing Hooks and API Client
- Added `BillingDetails` and `Invoice` interfaces to api.ts
- Added `billingApi` with `getDetails()` and `createPortal()` methods
- Created `useBilling` hook for fetching subscription/invoice data (60s stale time)
- Created `useBillingPortal` mutation that opens Stripe portal in new tab

### 2. Billing Page (/dashboard/billing)
- Subscription status card with plan name, status badge, and renewal date
- Payment method card showing card brand, last 4 digits, expiry
- Invoice history list with date, amount, status, and view links
- "Manage Billing in Stripe" button that opens portal
- Team member view: shows managed-by message when billing is handled by team owner
- Cancellation notice when subscription is set to end at period end
- 242 lines, responsive design with mobile-first approach

### 3. Layout Updates
- Sidebar now shows real gold count from `usePointsSummary()` hook
- Header now shows real member name (Discord username or email prefix)
- Mobile menu displays updated gold count
- Graceful handling when data is loading (defaults to 0 gold, "Member" name)

### 4. Benchmarks Navigation
- Added "View Results" button on benchmarks page when member has submissions
- Links to `/dashboard/benchmarks/results` for easy result access
- Button hidden until member submits at least one benchmark

## All Navigation Routes Working

| Route | Description |
|-------|-------------|
| /dashboard | Overview with points and activity |
| /dashboard/benchmarks | Category cards for submission |
| /dashboard/benchmarks/results | Comparison charts and metrics |
| /dashboard/resources | Resource library browser |
| /dashboard/leaderboard | Guild rankings with period tabs |
| /dashboard/profile | Point history and activity timeline |
| /dashboard/account | Email, password, privacy settings |
| /dashboard/billing | Subscription and invoice management |

## Success Criteria Met

- [x] UI-09: Billing page with subscription and invoices
- [x] UI-10: Navigation works between all dashboard pages
- [x] UI-11: Responsive on mobile (verified with menu and cards)
- [x] All sidebar links functional
- [x] Real data displayed in layout (gold count, member name)

## Deviations from Plan

None - plan executed exactly as written.

## Commits

1. `aadf1b1`: feat(32-07): add billing hooks and API client methods
2. `c1332d8`: feat(32-07): create billing page with subscription and invoices
3. `1b2b7a3`: feat(32-07): update layout with real data and add results navigation

## Next Phase Readiness

Phase 32 (Member Dashboard Pages) is now complete. All 7 plans executed:

- 32-01: React Query setup and points integration
- 32-02: Resources page with browser UI
- 32-03: Benchmarks submission with conversational wizard
- 32-04: Benchmark results with comparison charts
- 32-05: Leaderboard page with rankings
- 32-06: Profile and account settings pages
- 32-07: Billing page and final navigation polish

Ready for Phase 33 (Testing and Polish).
