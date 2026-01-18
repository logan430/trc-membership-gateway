# Domain Pitfalls: Stripe + Discord Membership Gateway

**Project:** The Revenue Council Membership Application
**Domain:** Stripe subscription + Discord role-based access control
**Researched:** 2026-01-18
**Confidence:** HIGH (multiple authoritative sources cross-referenced)

---

## Critical Pitfalls

Mistakes that cause rewrites, security breaches, or catastrophic data inconsistency.

---

### Pitfall 1: Missing Webhook Signature Verification

**What goes wrong:** Attackers forge webhook payloads to grant themselves premium access or trigger malicious actions. Any HTTP client that knows the webhook URL can send fake Stripe events.

**Why it happens:** Stripe's documentation historically showed example code without signature verification. Developers copy-paste and ship insecure code. The n8n automation platform had this exact vulnerability (CVE in 2025) where the Stripe Trigger node accepted unsigned webhooks.

**Consequences:**
- Unauthorized users gain paid membership roles
- Financial fraud (fake "payment successful" events)
- Data corruption in membership database
- Reputation damage and potential legal liability

**Warning signs:**
- Webhook handler doesn't import Stripe's signature verification library
- No `STRIPE_WEBHOOK_SECRET` environment variable
- Handler parses JSON directly without verification step
- Tests don't include signature validation scenarios

**Prevention:**
```typescript
// ALWAYS verify signature before processing
const event = stripe.webhooks.constructEvent(
  request.body,
  request.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);
```
- Use `crypto.timingSafeEqual` (not `===`) to prevent timing attacks
- Verify timestamp is within 5 minutes to prevent replay attacks
- Reject requests missing `stripe-signature` header entirely

**Detection:** Code review checklist item; automated security scan for unverified webhook handlers

**Phase to address:** Phase 1 (webhook infrastructure) - MUST be present from first webhook handler

**Sources:**
- [Stripe Webhook Security Documentation](https://docs.stripe.com/webhooks)
- [n8n Security Advisory GHSA-jf52-3f2h-h9j5](https://github.com/n8n-io/n8n/security/advisories/GHSA-jf52-3f2h-h9j5)
- [Lightning Security - Bypassing Payments Using Webhooks](https://lightningsecurity.io/blog/bypassing-payments-using-webhooks/)

---

### Pitfall 2: Non-Idempotent Webhook Processing

**What goes wrong:** Stripe delivers the same webhook multiple times (network issues, retries). Without idempotency, you get duplicate role assignments, duplicate database records, or duplicate welcome emails.

**Why it happens:** Stripe webhooks are delivered with at-least-once guarantee, not exactly-once. Developers assume single delivery. AI-generated code is particularly prone to this error.

**Consequences:**
- Duplicate charges if processing triggers billing actions
- Database constraint violations
- Corrupted membership state (user appears subscribed twice)
- Duplicate notifications annoying users

**Warning signs:**
- No `webhook_events` table tracking processed event IDs
- Handler processes event without checking if already seen
- No optimistic locking on subscription state updates
- Race conditions when multiple webhook retries arrive simultaneously

**Prevention:**
```sql
-- Create webhook events tracking table
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

-- In handler: INSERT ... ON CONFLICT DO NOTHING
-- If insert succeeds, process. If conflict, skip.
```
- Store Stripe event ID before processing
- Use database transactions with optimistic locking
- Design all webhook handlers to be safely re-runnable

**Detection:** Load testing with duplicate events; monitoring for duplicate database entries

**Phase to address:** Phase 1 (webhook infrastructure) - architectural decision from start

**Sources:**
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [Building Reliable Stripe Subscriptions with Webhook Idempotency](https://dev.to/aniefon_umanah_ac5f21311c/building-reliable-stripe-subscriptions-in-nestjs-webhook-idempotency-and-optimistic-locking-3o91)
- [Stigg - Best Practices for Stripe Webhooks](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)

---

### Pitfall 3: Webhook Event Order Assumption

**What goes wrong:** Stripe does NOT guarantee event delivery order. You might receive `subscription.updated` before `subscription.created`, causing your handler to fail or corrupt state.

**Why it happens:** Network conditions, retry timing, and Stripe's internal processing can reorder events. Developers write sequential state machines that break on out-of-order delivery.

**Consequences:**
- Subscriptions stuck in "incomplete" state when actually active
- Role assignment fails because subscription record doesn't exist yet
- State machine transitions to invalid states
- Silent failures that only surface as user complaints

**Warning signs:**
- Handler assumes `customer.created` always arrives before `subscription.created`
- State transitions that only work in one direction
- No timestamp-based ordering logic
- Error logs showing "subscription not found" during webhook processing

**Prevention:**
```typescript
// Use event timestamp, not arrival order
const eventTimestamp = event.created;
const existingRecord = await db.subscriptions.findOne({ stripeId: subscription.id });

if (existingRecord && existingRecord.lastEventTimestamp > eventTimestamp) {
  // This is an older event arriving late - skip it
  return;
}

// If subscription doesn't exist yet, fetch current state from Stripe API
const currentSubscription = await stripe.subscriptions.retrieve(subscription.id);
```
- Store `lastEventTimestamp` and reject older events
- Fetch current object state from Stripe API when in doubt
- Design state updates to be convergent (final state same regardless of order)
- Use async queue to serialize processing per customer/subscription

**Detection:** Integration tests with shuffled event order; monitoring for "not found" errors

**Phase to address:** Phase 1 (webhook infrastructure) - architectural pattern

**Sources:**
- [Stripe Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Laravel Cashier Issue #1201 - Webhook Order](https://github.com/laravel/cashier-stripe/issues/1201)
- [Stripe CLI Issue #418 - Incorrect Order](https://github.com/stripe/stripe-cli/issues/418)

---

### Pitfall 4: Discord Bot Token Exposure

**What goes wrong:** Bot token committed to repo, exposed in logs, or stored insecurely. Attackers gain full control of your bot.

**Why it happens:** New developers put tokens directly in code. CI/CD logs expose environment variables. Public repos accidentally include `.env` files.

**Consequences:**
- Attacker controls your bot with full permissions
- Mass role assignment/removal across all servers
- Spam/abuse sent from your bot's identity
- Data exfiltration from accessible channels
- In 2025, 600+ bot tokens were leaked on CodeSandbox alone, compromising 2,150+ servers

**Warning signs:**
- Token visible in source code (not `.env`)
- `.env` not in `.gitignore`
- Token logged during debugging
- No token rotation capability built in
- Bot has more permissions than needed

**Prevention:**
- Store token in `.env`, add `.env` to `.gitignore`
- Use secret management (Supabase Vault, environment variables)
- Principle of least privilege - only request needed permissions
- GitHub secret scanning is enabled by default and will auto-reset exposed tokens
- Build token rotation into deployment process

**Detection:** Pre-commit hooks scanning for tokens; GitHub secret scanning alerts

**Phase to address:** Phase 1 (project setup) - before writing any bot code

**Sources:**
- [GitGuardian - Remediating Discord Bot Token Leaks](https://www.gitguardian.com/remediation/discord-bot-token)
- [Medium - How I Owned 2150 Discord Servers](https://mrsheepsheep.medium.com/how-i-owned-2150-discord-servers-at-once-1aec65def8f4)
- [Medium - How to Prevent Leaking Your Discord Bot's Token](https://medium.com/on-discord/how-to-prevent-leaking-your-discord-bots-token-6125118e1222)

---

### Pitfall 5: Discord Role Hierarchy Misconfiguration

**What goes wrong:** Bot's role is below the roles it needs to manage. Discord silently fails or returns 403 errors. Users pay but never get access.

**Why it happens:** Discord's permission system requires bot role to be ABOVE any role it assigns. Server admins don't understand hierarchy. Permissions look correct but hierarchy prevents action.

**Consequences:**
- Paid members don't receive their roles
- Support tickets flood in
- Refund requests
- Churn from frustrated customers

**Warning signs:**
- Role assignment works for some roles but not others
- 403 "Missing Permissions" errors in logs
- Bot has "Manage Roles" permission but still fails
- Role assignment works in test server but not production

**Prevention:**
```
Server Settings > Roles:
1. Drag bot's role ABOVE all membership roles
2. Bot role must have "Manage Roles" permission
3. Document required hierarchy in setup guide
4. Add startup check that validates hierarchy
```
- Implement role hierarchy validation on bot startup
- Log clear error messages when hierarchy is wrong
- Provide admin-facing setup verification command (`/verify-setup`)

**Detection:** Startup validation check; monitoring role assignment success rate

**Phase to address:** Phase 2 (Discord integration) - bot setup and documentation

**Sources:**
- [MEE6 - Role Too Low in Hierarchy](https://help.mee6.xyz/support/solutions/articles/101000385404-role-too-low-in-hierarchy)
- [Patreon - Discord Isn't Working for Members](https://support.patreon.com/hc/en-us/articles/360037465012-Discord-isn-t-working-for-my-members)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

---

### Pitfall 6: Seat Count vs. Active Members Desync

**What goes wrong:** Company purchases 5 seats, invites 5 members. Admin removes a seat in Stripe portal. Now you have 5 active members but only 4 seats paid. Who loses access?

**Why it happens:** Stripe subscription quantity and your member count are separate systems. Webhooks notify of seat changes, but application must decide what to do with excess members.

**Consequences:**
- Paying customers lose access unexpectedly
- Support confusion about who should have access
- Data integrity issues (members > seats)
- Edge case: quantity = 0 but members still exist

**Warning signs:**
- No validation preventing seats < current members
- Seat quantity stored in Stripe only, not synced to local DB
- Downgrade flow doesn't handle excess members
- No UI showing "X of Y seats used"

**Prevention:**
```typescript
// Before allowing seat reduction
const currentMembers = await db.getActiveMemberCount(companyId);
const newSeatCount = event.data.object.quantity;

if (newSeatCount < currentMembers) {
  // Option A: Reject the change
  // Option B: Notify admin to remove members first
  // Option C: Auto-remove most recently added members
  // Option D: Grace period with warning
}
```
- Sync seat count to local database (source of truth)
- Enforce minimum seats >= current members in UI
- Webhook handler validates seat changes
- Clear policy: "Remove members before reducing seats"

**Detection:** Assertion checking seats >= members; alert on desync

**Phase to address:** Phase 3 (company seat management)

**Sources:**
- [Medium - Implementing Per-Seat Team Billing with Stripe](https://medium.com/@anand_14490/implementing-per-seat-team-billing-with-stripe-7af55422a1b1)
- [MakerKit - Per-Seat Stripe Subscriptions](https://makerkit.dev/recipes/per-seat-stripe-subscriptions)

---

### Pitfall 7: Billing Failure Grace Period Mishandling

**What goes wrong:** Payment fails. You immediately revoke access. Customer churns, even though they would have fixed their card. Or: you never revoke access, customer gets free service indefinitely.

**Why it happens:** No grace period strategy. Stripe's Smart Retries run for days, but your system doesn't track "past_due" state. 50% of subscriber churn comes from payment failures (involuntary churn).

**Consequences:**
- Aggressive: Lose customers who would have paid
- Passive: Give away free service to non-payers
- Either way: revenue loss and support burden

**Warning signs:**
- No handling of `invoice.payment_failed` webhook
- No "past_due" state in membership model
- No customer notification on payment failure
- Immediate role revocation on first failure

**Prevention:**
```typescript
// Define grace period policy
const GRACE_PERIOD_DAYS = 7;

switch (subscription.status) {
  case 'past_due':
    // Keep access but notify customer
    await notifyPaymentFailed(customer);
    await scheduleGracePeriodExpiry(subscription, GRACE_PERIOD_DAYS);
    break;
  case 'unpaid':
    // Grace period expired - revoke access
    await revokeAccess(customer);
    break;
  case 'canceled':
    // Subscription ended - revoke access
    await revokeAccess(customer);
    break;
}
```
- Enable Stripe Smart Retries (uses ML to optimize retry timing)
- Track subscription status locally, not just active/inactive
- Send dunning emails with payment update link
- Consider "pause subscription" instead of cancel option

**Detection:** Monitor involuntary churn rate; track payment failure -> recovery rate

**Phase to address:** Phase 4 (billing failure handling)

**Sources:**
- [Stripe - Passive Churn 101](https://stripe.com/resources/more/passive-churn-101-what-it-is-why-it-happens-and-eight-ways-to-prevent-it)
- [Stripe - Involuntary Churn 101](https://stripe.com/resources/more/involuntary-churn-101-what-it-is-why-it-happens-and-seven-ways-to-reduce-it)
- [Stripe - What is Dunning?](https://stripe.com/resources/more/dunning-what-subscription-based-businesses-need-to-know)

---

### Pitfall 8: Discord API Rate Limiting

**What goes wrong:** Bulk operations (role sync, initial setup, monthly renewal wave) hit Discord's rate limits. Bot gets temporarily banned. Members don't get roles.

**Why it happens:** Discord limits role modifications to ~10 per 10 seconds per guild, 50 requests/second globally. First-of-month subscription renewals create spikes.

**Consequences:**
- 429 errors during peak times
- Delayed role assignments (minutes to hours)
- Potential temporary IP ban from Discord API
- Users complain they paid but have no access

**Warning signs:**
- 429 errors in logs
- Role assignments work individually but fail in batches
- Problems at predictable times (month start)
- No rate limit handling in code

**Prevention:**
```typescript
// Use queue with rate limiting
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 10000 // 10 seconds
});

async function assignRole(memberId: string, roleId: string) {
  await limiter.removeTokens(1);
  await guild.members.cache.get(memberId).roles.add(roleId);
}
```
- Use Discord.js built-in rate limit handling
- Implement queue for role operations
- Spread bulk operations over time
- Monitor `X-RateLimit-Remaining` headers
- Have retry logic with exponential backoff

**Detection:** Monitor 429 error rate; alert on rate limit hits

**Phase to address:** Phase 2 (Discord integration) - implement from start

**Sources:**
- [Discord Developer Portal - Rate Limits](https://discord.com/developers/docs/topics/rate-limits)
- [Discord Developer Support - Rate Limiting](https://support-dev.discord.com/hc/en-us/articles/6223003921559-My-Bot-is-Being-Rate-Limited)

---

### Pitfall 9: Test/Live Mode Confusion

**What goes wrong:** Production webhook endpoint receives test mode events. Test webhook secret used in production. Live customer data processed by test handlers.

**Why it happens:** Stripe sends both test and live webhooks to production URLs for Connect apps. Webhook signing secrets differ between modes. Environment variable mixup during deployment.

**Consequences:**
- Test events trigger production role assignments
- Production events fail signature verification
- Debugging nightmare with mixed data
- Potential data leakage between environments

**Warning signs:**
- Webhook signature verification fails intermittently
- `livemode: false` events in production logs
- Different behavior between staging and production
- "It works locally but not in production"

**Prevention:**
```typescript
// Always check livemode
const event = stripe.webhooks.constructEvent(...);

if (process.env.NODE_ENV === 'production' && !event.livemode) {
  console.log('Ignoring test mode event in production');
  return res.status(200).send('OK');
}
```
- Use separate webhook endpoints for test/live
- Different signing secrets for each environment
- Check `event.livemode` in handler
- CI/CD validates environment variables match expected mode

**Detection:** Log analysis for livemode mismatches; environment variable audit

**Phase to address:** Phase 1 (webhook infrastructure) - environment setup

**Sources:**
- [Stripe - Handle Different Modes](https://docs.stripe.com/stripe-apps/handling-modes)
- [Stripe - Testing Billing](https://docs.stripe.com/billing/testing)

---

### Pitfall 10: Invite Token Security Vulnerabilities

**What goes wrong:** Invite tokens are predictable, reusable after claimed, or don't expire. Attackers share/sell tokens, bypass seat limits, or claim invites intended for others.

**Why it happens:** Tokens generated with weak randomness. No single-use enforcement. No expiration. Token not bound to intended recipient's email.

**Consequences:**
- Seat limit bypass (unlimited people join with shared token)
- Unauthorized access to paid community
- Token markets selling your invite links
- Loss of control over membership

**Warning signs:**
- Tokens are sequential or predictable
- Same token can be used multiple times
- Tokens never expire
- Token not validated against intended email
- No audit log of token usage

**Prevention:**
```typescript
// Generate secure token
const token = crypto.randomBytes(32).toString('hex');

// Store with constraints
await db.invite_tokens.insert({
  token: hashToken(token), // Store hash, not plaintext
  company_id: companyId,
  intended_email: recipientEmail, // Optional: bind to email
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  claimed_at: null,
  claimed_by: null
});

// On claim
const invitation = await db.invite_tokens.findOne({ token: hashToken(token) });
if (!invitation) throw new Error('Invalid token');
if (invitation.claimed_at) throw new Error('Token already used');
if (invitation.expires_at < new Date()) throw new Error('Token expired');
if (invitation.intended_email && invitation.intended_email !== userEmail) {
  throw new Error('Token not valid for this email');
}
```
- Use cryptographically secure random tokens (32+ bytes)
- Mark token as claimed immediately (single-use)
- Set reasonable expiration (7 days typical)
- Optionally bind to intended recipient email
- Audit log all token creation and claims

**Detection:** Monitor token claim rate per company; alert on unusual patterns

**Phase to address:** Phase 3 (company seat management - invite system)

**Sources:**
- [Authentik Security Advisory GHSA-9qwp-jf7p-vr7h](https://github.com/goauthentik/authentik/security/advisories/GHSA-9qwp-jf7p-vr7h)
- [CQR - Insecure Token Generation](https://cqr.company/web-vulnerabilities/insecure-token-generation-2/)

---

## Minor Pitfalls

Mistakes that cause annoyance, increased support, or minor technical debt.

---

### Pitfall 11: Missing User Left Server Handling

**What goes wrong:** User leaves Discord server but subscription remains active. They rejoin later and don't automatically get their role back.

**Why it happens:** `guildMemberRemove` event not handled. No reconciliation between Discord membership and subscription state.

**Prevention:**
- Listen to `guildMemberRemove` event
- On rejoin (`guildMemberAdd`), check for active subscription and restore role
- Consider: should leaving server cancel subscription? (Policy decision)
- Periodic reconciliation job comparing Discord members vs. active subscriptions

**Phase to address:** Phase 2 (Discord integration)

---

### Pitfall 12: Proration Invoice Confusion

**What goes wrong:** Customer upgrades seats mid-cycle. Proration invoice is confusing. Customer disputes charge. Support burden increases.

**Why it happens:** Stripe proration line items are technically correct but not human-readable. Customers don't understand why they're charged odd amounts.

**Prevention:**
- Preview upcoming charges before seat changes
- Use `stripe.invoices.retrieveUpcoming()` to show customer what they'll pay
- Consider using `proration_behavior: 'none'` for simplicity
- Clear documentation explaining billing behavior
- Friendly notification emails explaining charges

**Phase to address:** Phase 3 (company seat management)

**Sources:**
- [Dev.to - Seat-based Billing with Stripe](https://dev.to/chideraao/how-to-implement-seat-based-billing-with-checkout-1jlk)

---

### Pitfall 13: Supabase Webhook Race Conditions

**What goes wrong:** Multiple concurrent webhook requests create race conditions when updating the same membership record. One update overwrites another.

**Why it happens:** Supabase database webhooks (pg_net) are asynchronous. Multiple Stripe events for same customer arrive simultaneously. No locking on membership updates.

**Prevention:**
```sql
-- Use SERIALIZABLE isolation for critical updates
CREATE OR REPLACE FUNCTION update_membership_status(
  p_subscription_id TEXT,
  p_status TEXT,
  p_event_timestamp BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE memberships
  SET status = p_status, updated_at = NOW()
  WHERE stripe_subscription_id = p_subscription_id
    AND last_event_timestamp < p_event_timestamp;
END;
$$ LANGUAGE plpgsql;
```
- Use optimistic locking with version/timestamp
- Process webhooks through async queue (one at a time per customer)
- Use database transactions appropriately
- Idempotency key prevents duplicate processing

**Phase to address:** Phase 1 (webhook infrastructure)

**Sources:**
- [Supabase Discussion #30334 - SERIALIZABLE Isolation](https://github.com/orgs/supabase/discussions/30334)
- [pg_net Issue #86 - Multiple Inserts](https://github.com/supabase/pg_net/issues/86)

---

### Pitfall 14: No Reconciliation Process

**What goes wrong:** Webhook missed (network issue, server down). State drifts between Stripe/Discord/database. Users stuck in wrong state indefinitely.

**Why it happens:** Webhooks are at-least-once but not guaranteed. Server downtime during webhook delivery. No background sync to catch misses.

**Prevention:**
- Implement periodic reconciliation job (every 6 hours)
- Compare Stripe subscriptions vs. database vs. Discord roles
- Fix discrepancies automatically or flag for review
- Monitor reconciliation for frequent mismatches (indicates webhook problems)

```typescript
// Reconciliation pseudocode
async function reconcile() {
  const stripeSubscriptions = await stripe.subscriptions.list({ status: 'active' });

  for (const sub of stripeSubscriptions.data) {
    const dbRecord = await db.memberships.findByStripeId(sub.id);

    if (!dbRecord || dbRecord.status !== 'active') {
      // Stripe says active but DB doesn't - fix it
      await syncSubscriptionToDb(sub);
    }

    const hasDiscordRole = await checkDiscordRole(dbRecord.discord_user_id);
    if (!hasDiscordRole) {
      // DB says active but Discord doesn't have role - fix it
      await assignDiscordRole(dbRecord.discord_user_id);
    }
  }
}
```

**Phase to address:** Phase 5 (operational hardening)

**Sources:**
- [Stripe - Process Undelivered Events](https://docs.stripe.com/webhooks/process-undelivered-events)

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| 1 | Webhook infrastructure | Signature verification, idempotency, event order | Follow patterns in pitfalls 1-3 |
| 1 | Environment setup | Token exposure, test/live mode | Secrets management, mode checking |
| 2 | Discord integration | Role hierarchy, rate limits | Startup validation, queuing |
| 2 | Discord integration | User left server | Event handlers, reconciliation |
| 3 | Seat management | Seats vs. members desync | Local seat count, validation |
| 3 | Invite tokens | Token security | Secure generation, single-use |
| 4 | Billing failures | Grace period policy | State machine, dunning emails |
| 5 | Operations | State drift | Reconciliation jobs |

---

## Pre-Development Checklist

Before writing code, ensure you have answers for:

- [ ] How will we verify webhook signatures?
- [ ] How will we handle duplicate webhook deliveries?
- [ ] How will we handle out-of-order webhook events?
- [ ] Where is the bot token stored securely?
- [ ] How will we validate role hierarchy on startup?
- [ ] What happens when seats < active members?
- [ ] What is our billing failure grace period policy?
- [ ] How will invite tokens be secured?
- [ ] What is our reconciliation strategy?
- [ ] How do we separate test/live environments?

---

## Summary

**The three most critical pitfalls to prevent from day one:**

1. **Webhook signature verification** - Security fundamental, cannot be retrofitted
2. **Idempotent processing** - Architectural decision that affects all webhook handlers
3. **Event order independence** - Requires careful state management design

**The pitfall most likely to cause customer complaints:**
- Billing failure mishandling (involuntary churn causes 50% of subscription losses)

**The pitfall most likely to be discovered late:**
- Seat count desync (only appears when customers downgrade)

---

## Sources Summary

**Stripe Official:**
- [Webhook Security](https://docs.stripe.com/webhooks)
- [Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries)

**Discord Official:**
- [Rate Limits](https://discord.com/developers/docs/topics/rate-limits)
- [OAuth2](https://discord.com/developers/docs/topics/oauth2)

**Community/Industry:**
- [Stigg - Stripe Webhook Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Building Solid Stripe Integrations](https://stripe.dev/blog/building-solid-stripe-integrations-developers-guide-success)
- [MakerKit - Per-Seat Subscriptions](https://makerkit.dev/recipes/per-seat-stripe-subscriptions)

**Security Advisories:**
- [n8n Webhook Vulnerability](https://github.com/n8n-io/n8n/security/advisories/GHSA-jf52-3f2h-h9j5)
- [Authentik Token Reuse](https://github.com/goauthentik/authentik/security/advisories/GHSA-9qwp-jf7p-vr7h)
