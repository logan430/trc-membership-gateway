# Phase 41: Stripe Integration - Research

**Researched:** 2026-02-16
**Domain:** Stripe webhook configuration, checkout flows, billing portal -- production deployment of existing code
**Confidence:** HIGH

## Summary

Phase 41 is a **configuration and verification phase**, not a code-writing phase. The entire Stripe integration codebase already exists and is comprehensive: webhook handler with signature verification and idempotency (`src/webhooks/stripe.ts`), checkout session creation for individual and company plans (`src/routes/checkout.ts`, `src/routes/company-checkout.ts`), billing portal sessions (`src/routes/billing.ts`), payment failure handling with grace periods (`src/billing/failure-handler.ts`), payment recovery (`src/billing/recovery-handler.ts`), and a billing scheduler that polls every 5 minutes (`src/billing/scheduler.ts`).

The work is: (1) configure the production webhook endpoint URL in Stripe Dashboard, (2) set the correct `STRIPE_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` env vars in Coolify, (3) ensure `STRIPE_INDIVIDUAL_PRICE_ID` is set, (4) verify the webhook route accepts and processes events correctly at the production URL, and (5) run a test-mode checkout flow end-to-end.

**Primary recommendation:** Configure webhook endpoint in Stripe Dashboard pointing to `https://app.therevenuecouncil.com/webhooks/stripe`, set the webhook signing secret in Coolify env vars, then verify by running a test-mode checkout flow that triggers `checkout.session.completed` and confirms the member becomes ACTIVE.

## Standard Stack

No new libraries needed. Everything is already installed and deployed.

### Core (Already Deployed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| stripe | ^20.2.0 | Stripe SDK for checkout, billing portal, webhook verification | Deployed |
| express | ^5.2.1 | HTTP server with raw body parsing for webhooks | Deployed |
| zod | ^4.3.5 | Env var validation (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) | Deployed |

### No New Libraries Needed

This phase uses entirely existing tools and configuration. No npm install required.

## Architecture Patterns

### Existing Webhook Architecture (Already Built)

The webhook flow is already correctly implemented:

```
Stripe Event
  |
  v
POST /webhooks/stripe (mounted BEFORE express.json() -- line 91 of index.ts)
  |
  v
express.raw({ type: 'application/json' }) -- raw body for signature verification
  |
  v
stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET)
  |
  v
Idempotency check: prisma.stripeEvent.findUnique({ where: { eventId } })
  |
  v
Record event BEFORE processing: prisma.stripeEvent.create(...)
  |
  v
Return 200 immediately (Stripe times out after 10 seconds)
  |
  v
Process event asynchronously (processStripeEvent)
```

**Critical routing order in `src/index.ts`:**
- Line 91: `app.use('/webhooks/stripe', stripeWebhookRouter);` -- BEFORE express.json()
- Line 94: `app.use(express.json());` -- AFTER webhook route

This ordering is already correct and deployed. Do not change it.

### Webhook Events Handled

The code handles these events (from `src/webhooks/stripe.ts`):

| Event | Handler | What It Does |
|-------|---------|-------------|
| `checkout.session.completed` | Full handler | Creates/updates member or team, sets ACTIVE, sends welcome email |
| `customer.subscription.created` | Logger only | Logs event, no processing yet |
| `customer.subscription.updated` | Full handler | Syncs subscription status and seat counts (individual + team) |
| `customer.subscription.deleted` | Full handler | Cancels subscription, removes Discord roles, kicks members |
| `invoice.payment_failed` | Full handler | Starts 48-hour grace period, sends DM + email notifications |
| `invoice.paid` | Full handler | Recovers from payment failure, restores roles |

### Required Stripe Dashboard Webhook Events

Configure these events in the Stripe Dashboard webhook endpoint:

1. `checkout.session.completed`
2. `customer.subscription.created`
3. `customer.subscription.updated`
4. `customer.subscription.deleted`
5. `invoice.payment_failed`
6. `invoice.paid`

### Checkout Flow (Already Built)

```
User signs up (POST /auth/signup)
  |
  v
Stripe customer created (stripe.customers.create in auth.ts:109)
  |
  v
User clicks "Subscribe" -> POST /checkout
  |
  v
Stripe Checkout session created with:
  - mode: 'subscription'
  - customer: member.stripeCustomerId
  - client_reference_id: member.id
  - price: env.STRIPE_INDIVIDUAL_PRICE_ID
  - success_url: ${env.APP_URL}/dashboard?checkout=success
  - cancel_url: ${env.APP_URL}/dashboard?checkout=cancel
  |
  v
User redirected to Stripe hosted checkout page
  |
  v
On success: Stripe fires checkout.session.completed webhook
  |
  v
Webhook handler updates member.subscriptionStatus = 'ACTIVE'
```

### Billing Portal Flow (Already Built)

```
User clicks "Manage Billing" -> POST /billing/portal
  |
  v
stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${env.APP_URL}/app/dashboard`
})
  |
  v
User redirected to Stripe billing portal
  |
  v
User updates payment method / cancels subscription
  |
  v
Stripe fires appropriate webhooks (subscription.updated, subscription.deleted)
```

### Environment Variables Required

All Stripe-related env vars from `src/config/env.ts`:

| Env Var | Zod Validation | Required | Current Status |
|---------|---------------|----------|---------------|
| `STRIPE_SECRET_KEY` | `.string().startsWith('sk_')` | YES | Must be set (sk_test_... for test, sk_live_... for live) |
| `STRIPE_WEBHOOK_SECRET` | `.string().startsWith('whsec_')` | YES | Must be set from Dashboard webhook endpoint |
| `STRIPE_INDIVIDUAL_PRICE_ID` | `.string().startsWith('price_').optional()` | For checkout | Must be set for individual checkout to work |
| `STRIPE_OWNER_SEAT_PRICE_ID` | `.string().startsWith('price_').optional()` | For company checkout | Optional if company plans not needed yet |
| `STRIPE_TEAM_SEAT_PRICE_ID` | `.string().startsWith('price_').optional()` | For company checkout | Optional if company plans not needed yet |
| `APP_URL` | `.string().url()` | YES | Must be `https://app.therevenuecouncil.com` |

**Important:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are REQUIRED (not optional in Zod schema). The app will crash on startup if they are missing or malformed. They must start with `sk_` and `whsec_` respectively.

### URL References in Code

These URLs are constructed from `env.APP_URL` and used in Stripe API calls:

| Code Location | URL Pattern | Purpose |
|--------------|-------------|---------|
| checkout.ts:39 | `${env.APP_URL}/dashboard?checkout=success` | Checkout success redirect |
| checkout.ts:40 | `${env.APP_URL}/dashboard?checkout=cancel` | Checkout cancel redirect |
| company-checkout.ts:104 | `${env.APP_URL}/team/dashboard?checkout=success` | Company checkout success |
| company-checkout.ts:105 | `${env.APP_URL}/company?checkout=cancel` | Company checkout cancel |
| billing.ts:44 | `${env.APP_URL}/app/dashboard` | Billing portal return URL |
| failure-handler.ts:100 | `${env.APP_URL}/dashboard` | Payment failure portal return |
| stripe.ts:194 | `${env.APP_URL}/claim` | Welcome email claim link |
| stripe.ts:224 | `${env.APP_URL}/claim` | Welcome email claim link |

All of these depend on `APP_URL` being set to `https://app.therevenuecouncil.com`. This should already be configured from Phase 39/40 deployment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC comparison | `stripe.webhooks.constructEvent()` | Already implemented; handles timestamp validation, replay attack prevention |
| Idempotency | Custom dedup logic | `StripeEvent` table with unique `eventId` constraint | Already implemented; prevents double-processing |
| Checkout session creation | Custom payment form | `stripe.checkout.sessions.create()` | Already implemented; PCI-compliant hosted page |
| Billing portal | Custom subscription management UI | `stripe.billingPortal.sessions.create()` | Already implemented; Stripe-hosted portal |
| Payment failure handling | Custom retry logic | Stripe's built-in retry + `invoice.payment_failed` webhook | Already implemented; 48-hour grace period with notifications |

**Key insight:** ALL of this is already built. This phase is purely configuration and verification.

## Common Pitfalls

### Pitfall 1: Test Mode vs Live Mode Webhook Secrets Are Different
**What goes wrong:** Using the test mode webhook signing secret in production (or vice versa). Webhook signature verification fails on every event.
**Why it happens:** Stripe generates separate `whsec_` secrets for test and live mode endpoints. The same endpoint URL can have two different secrets.
**How to avoid:** When configuring the webhook endpoint in Stripe Dashboard, note which mode you are in (toggle at top-right). For Phase 41, start in TEST MODE. Copy the `whsec_` secret from the test mode endpoint and set it in Coolify as `STRIPE_WEBHOOK_SECRET`. When switching to live mode later (STRIPE-08 / Phase 43), you must update the secret.
**Warning signs:** All webhook events return 400 with "Webhook signature verification failed" in logs.

### Pitfall 2: Webhook Endpoint Must Be HTTPS
**What goes wrong:** Stripe rejects webhook endpoint URLs that are HTTP in production.
**Why it happens:** Stripe enforces TLS for production webhook endpoints.
**How to avoid:** The production URL `https://app.therevenuecouncil.com/webhooks/stripe` uses HTTPS. This should already be working from Phase 39 SSL configuration. Verify the SSL certificate is valid before configuring the webhook.
**Warning signs:** Stripe Dashboard shows endpoint as invalid or events fail to deliver.

### Pitfall 3: Wrong Webhook Path
**What goes wrong:** Configuring webhook URL as `/webhook` or `/stripe/webhook` instead of `/webhooks/stripe`.
**Why it happens:** Common conventions differ between projects.
**How to avoid:** The exact route is `app.use('/webhooks/stripe', stripeWebhookRouter)` in `src/index.ts` line 91. The full production URL must be: `https://app.therevenuecouncil.com/webhooks/stripe`
**Warning signs:** Stripe shows 404 responses for webhook deliveries.

### Pitfall 4: STRIPE_INDIVIDUAL_PRICE_ID Not Set
**What goes wrong:** Checkout session creation fails because the price ID is undefined, passed to Stripe as null.
**Why it happens:** The env var is optional in Zod schema (`.optional()`), so the app starts fine without it. But the checkout route uses it directly: `price: env.STRIPE_INDIVIDUAL_PRICE_ID`.
**How to avoid:** Set `STRIPE_INDIVIDUAL_PRICE_ID` in Coolify env vars. Get the price ID from Stripe Dashboard -> Products -> Individual Monthly -> Pricing section. It will look like `price_1Abc123...`.
**Warning signs:** POST /checkout returns 500 error. Stripe error: "Invalid price".

### Pitfall 5: Zod Crash on Empty String Env Vars
**What goes wrong:** Setting `STRIPE_INDIVIDUAL_PRICE_ID=""` in Coolify causes Zod to try validating empty string against `.startsWith('price_')`, which fails and crashes the app.
**Why it happens:** Coolify may set env vars to empty string instead of leaving them unset.
**How to avoid:** Only set env vars that have actual values. Leave optional Stripe price IDs unset in Coolify if not needed yet. This is the same pitfall documented in Phase 40 research.
**Warning signs:** App crashes on startup with Zod validation error.

### Pitfall 6: Stripe API Keys Mode Mismatch
**What goes wrong:** Using `sk_test_` key but `whsec_` from a live mode webhook endpoint (or vice versa). The webhook signature verification uses the secret key mode's signing, and mismatches cause failures.
**Why it happens:** Stripe accounts have separate test/live API keys and separate test/live webhook secrets.
**How to avoid:** Ensure BOTH `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are from the SAME mode. For test mode: `sk_test_...` + `whsec_...` from test mode endpoint. For live mode: `sk_live_...` + `whsec_...` from live mode endpoint.
**Warning signs:** Checkout sessions create fine (they use the secret key) but webhooks fail (they use the webhook secret).

### Pitfall 7: Missing Stripe Products/Prices
**What goes wrong:** The Stripe account doesn't have a product with the correct price ID configured.
**Why it happens:** Products may only exist in test mode, or price IDs from development may not match production.
**How to avoid:** Verify in Stripe Dashboard that the Individual Monthly product exists with a recurring price. Copy the exact `price_...` ID from the Dashboard.
**Warning signs:** Checkout returns "No such price: price_..." error.

### Pitfall 8: Billing Portal Not Configured
**What goes wrong:** Creating a billing portal session fails because the portal hasn't been configured in Stripe Dashboard.
**Why it happens:** The Stripe billing portal requires initial configuration in Dashboard -> Settings -> Billing -> Customer portal before it can be used via API.
**How to avoid:** Configure the customer portal in Stripe Dashboard: enable subscription cancellation, payment method updates, and set the default return URL to `https://app.therevenuecouncil.com/app/dashboard`.
**Warning signs:** POST /billing/portal returns 500 with "No portal configuration found" error.

## Code Examples

### Setting Coolify Env Vars for Stripe

```bash
# Set STRIPE_SECRET_KEY (test mode)
curl -X PATCH http://82.180.160.120:8000/api/v1/applications/wcssogsgc00o8ocwcg4c0c00/envs \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "STRIPE_SECRET_KEY",
    "value": "sk_test_...",
    "is_build_time": false,
    "is_preview": false
  }'

# Set STRIPE_WEBHOOK_SECRET (from Dashboard webhook endpoint)
curl -X PATCH http://82.180.160.120:8000/api/v1/applications/wcssogsgc00o8ocwcg4c0c00/envs \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "STRIPE_WEBHOOK_SECRET",
    "value": "whsec_...",
    "is_build_time": false,
    "is_preview": false
  }'

# Set STRIPE_INDIVIDUAL_PRICE_ID
curl -X PATCH http://82.180.160.120:8000/api/v1/applications/wcssogsgc00o8ocwcg4c0c00/envs \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "STRIPE_INDIVIDUAL_PRICE_ID",
    "value": "price_...",
    "is_build_time": false,
    "is_preview": false
  }'
```

### Stripe Dashboard Webhook Configuration Steps

1. Go to https://dashboard.stripe.com/test/webhooks (test mode)
2. Click "Add endpoint"
3. Set Endpoint URL: `https://app.therevenuecouncil.com/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
5. Click "Add endpoint"
6. Click the endpoint to view it
7. Under "Signing secret", click "Reveal" to get the `whsec_...` value
8. Set this value as `STRIPE_WEBHOOK_SECRET` in Coolify

### Verifying Webhook Endpoint Works

```bash
# After configuring, send a test event from Stripe CLI (if installed locally)
stripe trigger checkout.session.completed --api-key sk_test_...

# Or use Stripe Dashboard: Webhooks -> Your endpoint -> "Send test webhook"
# Select event: checkout.session.completed -> Send

# Check production logs for the event
ssh root@82.180.160.120
docker logs $(docker ps --format '{{.Names}}' | grep express) --tail 50

# Look for:
# "msg":"Webhook event received","eventId":"evt_...","type":"checkout.session.completed"
```

### Test Mode End-to-End Checkout Verification

1. **Sign up** a test account at `https://app.therevenuecouncil.com/signup`
2. **Login** with the test credentials
3. **Start checkout** (POST /checkout via the dashboard)
4. On Stripe Checkout page, use test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. **Verify webhook received:** Check logs for `checkout.session.completed`
6. **Verify member updated:** Check database for `subscriptionStatus: 'ACTIVE'`

### Stripe Billing Portal Configuration (Dashboard)

Navigate to: https://dashboard.stripe.com/test/settings/billing/portal

Configure:
- **Payment methods:** Allow customers to update payment methods
- **Subscriptions:** Allow customers to cancel subscriptions
- **Default return URL:** `https://app.therevenuecouncil.com/app/dashboard`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe CLI `stripe listen` for dev | Dashboard-configured endpoint for production | Moving to production | Real webhooks hit real server |
| `whsec_` from CLI output | `whsec_` from Dashboard endpoint | Production webhook setup | Different secret per endpoint |
| `sk_test_` for development | `sk_test_` for production testing, `sk_live_` for live | Production deployment | Must switch keys when going live |
| `current_period_end` on Subscription | `current_period_end` on SubscriptionItem | Stripe SDK v20+ | Code already handles this (see stripe.ts line 126-129) |

**Already handled in codebase:**
- Stripe SDK v20 `current_period_end` moved to SubscriptionItem level -- code correctly reads from `firstItem.current_period_end`
- Express v5 `express.raw()` middleware for webhook body parsing -- already in place
- Idempotency via `StripeEvent` table with unique constraint on `eventId` -- already implemented
- Async processing after 200 response to avoid Stripe's 10-second timeout -- already implemented

## Deployment Sequence

The correct order for Phase 41 operations:

### Plan 41-01: Configure Stripe Webhooks

1. **Verify SSL** -- Confirm `https://app.therevenuecouncil.com/health` returns 200 (SSL must work for webhooks)
2. **Verify existing Stripe env vars** -- Check if `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are already set in Coolify
3. **Create webhook endpoint in Stripe Dashboard** (test mode) pointing to `https://app.therevenuecouncil.com/webhooks/stripe`
4. **Select the 6 required events** to listen to
5. **Copy the webhook signing secret** (`whsec_...`) from the new endpoint
6. **Set env vars in Coolify** via API: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_INDIVIDUAL_PRICE_ID`
7. **Restart/redeploy the app** so new env vars take effect
8. **Send test webhook** from Stripe Dashboard to verify signature verification passes
9. **Check logs** for successful webhook receipt

### Plan 41-02: Test Checkout and Billing Portal Flows

1. **Sign up a test user** at the production URL
2. **Complete checkout** using test card `4242 4242 4242 4242`
3. **Verify webhook fires** -- `checkout.session.completed` in logs
4. **Verify member status** -- Database shows `subscriptionStatus: 'ACTIVE'`
5. **Test billing portal** -- Click "Manage Billing", verify redirect to Stripe portal and return to app
6. **Test payment failure** (optional) -- Use declining test card to trigger `invoice.payment_failed`

## Open Questions

1. **Are Stripe credentials already set in Coolify?**
   - What we know: STATE.md lists this as an open question: "Are there existing production Stripe credentials? (currently using test mode)"
   - What's unclear: Whether `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are already set in Coolify env vars from a previous configuration
   - Recommendation: Check existing Coolify env vars first. If they exist, verify they are correct. If not, user must provide them.

2. **Does the Stripe account have products/prices configured?**
   - What we know: The code requires `STRIPE_INDIVIDUAL_PRICE_ID` for individual checkout. It also optionally uses `STRIPE_OWNER_SEAT_PRICE_ID` and `STRIPE_TEAM_SEAT_PRICE_ID` for company plans.
   - What's unclear: Whether products exist in the Stripe account with correct recurring prices.
   - Recommendation: User should verify in Stripe Dashboard -> Products. If no products exist, create: "Individual Monthly" with a recurring monthly price.

3. **Is there an existing webhook endpoint configured in Stripe Dashboard?**
   - What we know: The app was previously in development, likely using `stripe listen` CLI for local webhooks.
   - What's unclear: Whether there's already a webhook endpoint configured in the Dashboard (perhaps for a different URL).
   - Recommendation: Check Stripe Dashboard -> Webhooks for existing endpoints. If one exists for a different URL, either update it or create a new one for the production URL.

4. **When to switch from test mode to live mode?**
   - What we know: STRIPE-07 is "Test mode checkout flow completes successfully" and STRIPE-08 is "Live mode checkout flow completes successfully (1-2 test payments)". These are separate requirements.
   - What's unclear: Whether live mode switch happens in this phase or in Phase 43 (E2E & Go-Live).
   - Recommendation: This phase (41) should complete test mode verification (STRIPE-01 through STRIPE-07). Live mode switch (STRIPE-08) can be deferred to Phase 43 (Go-Live) since it involves real money and should be the final step.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Full reading of:
  - `src/webhooks/stripe.ts` (391 lines) -- Complete webhook handler with all event processing
  - `src/routes/checkout.ts` (45 lines) -- Individual checkout session creation
  - `src/routes/company-checkout.ts` (114 lines) -- Company/team checkout session creation
  - `src/routes/billing.ts` (175 lines) -- Billing portal and billing details
  - `src/billing/failure-handler.ts` (204 lines) -- Payment failure with grace period
  - `src/billing/recovery-handler.ts` (271 lines) -- Payment recovery and role restoration
  - `src/billing/scheduler.ts` (337 lines) -- 5-minute billing poll
  - `src/config/env.ts` (77 lines) -- All Stripe env var definitions
  - `src/index.ts` (355 lines) -- Route mounting order (webhook before json parser)
  - `src/routes/auth.ts` -- Stripe customer creation on signup

### Secondary (MEDIUM confidence)
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks) -- Production endpoint requirements, event configuration
- [Stripe Add Webhook Endpoint](https://docs.stripe.com/development/dashboard/webhooks) -- Dashboard configuration steps
- [Stripe CLI Trigger](https://docs.stripe.com/cli/trigger) -- Test event triggering
- [Stripe CLI Listen](https://docs.stripe.com/cli/listen) -- Local development forwarding
- [Stripe Test Cards](https://docs.stripe.com/testing) -- Test card numbers for checkout testing
- [Stripe Billing Portal Integration](https://docs.stripe.com/customer-management/integrate-customer-portal) -- Portal configuration and session creation
- [Stripe Billing Portal Configuration](https://docs.stripe.com/customer-management/configure-portal) -- Dashboard portal setup

### Tertiary (LOW confidence)
- [Hooklistener Stripe Guide](https://www.hooklistener.com/learn/stripe-webhooks-implementation) -- General best practices
- [Hookdeck Stripe Guide](https://hookdeck.com/webhooks/platforms/guide-to-stripe-webhooks-features-and-best-practices) -- Community patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All code already exists and is deployed, no new dependencies
- Architecture: HIGH -- Complete code audit of all Stripe-related files performed
- Webhook configuration: HIGH -- Route path, event types, and env var requirements all verified from source code
- URL references: HIGH -- Every `env.APP_URL` usage catalogued from source code
- Pitfalls: HIGH -- Based on source code analysis of Zod validation, Express middleware order, Stripe API requirements
- Deployment sequence: HIGH -- Logically derived from code requirements and Stripe Dashboard workflow

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain -- Stripe API and existing codebase are not changing)
