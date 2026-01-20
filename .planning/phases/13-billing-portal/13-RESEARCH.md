# Phase 13: Billing Portal - Research

**Researched:** 2026-01-20
**Domain:** Stripe Billing Portal Integration
**Confidence:** HIGH

## Summary

This phase implements a missing `/billing/portal` endpoint that the dashboard frontend already calls. The frontend code exists in `public/dashboard.html` lines 608-630 and expects a POST endpoint returning `{ portalUrl: string }`. The Stripe Customer Portal API is well-documented and the codebase already has working examples of `stripe.billingPortal.sessions.create()` in `src/billing/failure-handler.ts`.

The implementation is straightforward: a single authenticated route that determines the correct Stripe customer ID (individual vs team member), creates a billing portal session, and returns the URL.

**Primary recommendation:** Follow the existing pattern in `failure-handler.ts` and create a new route file `src/routes/billing.ts` with a POST `/billing/portal` endpoint that uses the `requireAuth` middleware and determines customer ID based on member's team membership status.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | 20.2.0 | Stripe API client | Already installed and used throughout codebase |
| express | 5.2.1 | HTTP router | Already the framework in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | - | No additional libraries needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stripe.billingPortal.sessions.create | Direct API call via fetch | stripe-node provides TypeScript types, error handling; use it |

**Installation:**
```bash
# No new dependencies required - stripe@20.2.0 already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/
│   ├── billing.ts        # NEW: Billing portal endpoint
│   ├── checkout.ts       # Existing pattern to follow
│   └── dashboard.ts      # Existing pattern to follow
```

### Pattern 1: Authenticated Stripe Route
**What:** Route that requires auth, looks up member, makes Stripe API call
**When to use:** Any endpoint that needs user context for Stripe operations
**Example:**
```typescript
// Source: src/routes/checkout.ts (existing pattern)
import { Router, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
export const billingRouter = Router();

billingRouter.post('/portal', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Implementation here
});
```

### Pattern 2: Individual vs Team Customer Resolution
**What:** Determining the correct Stripe customer ID based on member's team status
**When to use:** When billing operations differ between individual and team members
**Example:**
```typescript
// Source: src/billing/failure-handler.ts pattern
// For team members, use team.stripeCustomerId
// For individuals, use member.stripeCustomerId

const member = await prisma.member.findUnique({
  where: { id: req.memberId },
  include: { team: true },
});

// Determine correct customer ID
let stripeCustomerId: string | null = null;
if (member.teamId && member.team) {
  // Team member - billing is at team level
  stripeCustomerId = member.team.stripeCustomerId;
} else {
  // Individual member - billing is at member level
  stripeCustomerId = member.stripeCustomerId;
}
```

### Pattern 3: Billing Portal Session Creation
**What:** Creating a Stripe billing portal session and returning URL
**When to use:** When users need self-service billing access
**Example:**
```typescript
// Source: src/billing/failure-handler.ts:96-109 (existing pattern)
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${env.APP_URL}/dashboard`,
});

res.json({ portalUrl: session.url });
```

### Anti-Patterns to Avoid
- **Hardcoded return URLs:** Always use `env.APP_URL` for return URLs
- **Missing team check:** Individual members have `member.stripeCustomerId`, team members use `team.stripeCustomerId`
- **Not handling missing customer ID:** Member may exist without Stripe setup (edge case during signup flow)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Portal URL generation | Custom Stripe API calls | `stripe.billingPortal.sessions.create()` | Already typed, handles errors |
| Customer ID lookup | SQL joins | Prisma include | Already have pattern in codebase |
| Auth middleware | Custom header parsing | `requireAuth` from `middleware/session.ts` | Reuse existing tested code |

**Key insight:** This phase requires almost no new patterns - everything needed already exists in the codebase.

## Common Pitfalls

### Pitfall 1: Team vs Individual Customer ID Mismatch
**What goes wrong:** Using `member.stripeCustomerId` for a team member results in "customer not found" or showing wrong billing info
**Why it happens:** Team members don't own their subscription - the team does
**How to avoid:** Always check `member.teamId` first; if team member, use `team.stripeCustomerId`
**Warning signs:** 404 errors from Stripe, billing portal showing empty subscriptions

### Pitfall 2: Missing Portal Configuration in Stripe Dashboard
**What goes wrong:** API returns error "You can't create a portal session in test mode until you save your customer portal settings"
**Why it happens:** Stripe requires dashboard configuration before API works
**How to avoid:** Document that Stripe Dashboard portal config is required before testing
**Warning signs:** `StripeInvalidRequestError` mentioning portal settings

### Pitfall 3: Return URL Mismatch
**What goes wrong:** User lands on wrong page after leaving portal, or URL is invalid
**Why it happens:** Hardcoded URL doesn't match environment
**How to avoid:** Always use `${env.APP_URL}/dashboard` pattern
**Warning signs:** Users confused after portal exit, broken redirects

### Pitfall 4: No Stripe Customer ID
**What goes wrong:** Endpoint crashes or returns unclear error
**Why it happens:** Edge case where member exists but hasn't completed checkout
**How to avoid:** Check for null/undefined customer ID before Stripe call, return appropriate error
**Warning signs:** 500 errors from billing portal endpoint

## Code Examples

Verified patterns from existing codebase:

### Complete Route Pattern (from checkout.ts)
```typescript
// Source: src/routes/checkout.ts
import { Router, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
export const checkoutRouter = Router();

checkoutRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member?.stripeCustomerId) {
    res.status(400).json({ error: 'Account not configured for payment' });
    return;
  }

  // ... Stripe operation ...

  logger.info({ memberId: member.id }, 'Operation completed');
  res.json({ /* response */ });
});
```

### Billing Portal Session (from failure-handler.ts)
```typescript
// Source: src/billing/failure-handler.ts:96-109
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
stripe.billingPortal.sessions
  .create({
    customer: member.stripeCustomerId,
    return_url: `${env.APP_URL}/dashboard`,
  })
  .then((portalSession) => {
    // portalSession.url is the billing portal URL
  })
  .catch((err) => {
    logger.error({ memberId: member.id, err }, 'Failed to create billing portal session');
  });
```

### Team Billing Portal Session (from failure-handler.ts)
```typescript
// Source: src/billing/failure-handler.ts:177-197
stripe.billingPortal.sessions
  .create({
    customer: team.stripeCustomerId,
    return_url: `${env.APP_URL}/dashboard`,
  })
  .then((portalSession) => {
    // Use portalSession.url
  })
```

### Frontend Call Pattern (existing, not to be modified)
```javascript
// Source: public/dashboard.html:608-630
async function openBillingPortal() {
  const response = await fetch('/billing/portal', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
    },
  });

  const { portalUrl } = await response.json();
  window.location.href = portalUrl;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | Stripe Customer Portal | 2020+ | Built-in hosted solution, no custom UI needed |

**Deprecated/outdated:**
- N/A - Stripe billing portal is the current recommended approach

## Open Questions

Things that couldn't be fully resolved:

1. **Portal Configuration Verification**
   - What we know: Stripe Dashboard must have portal configured before API works
   - What's unclear: Whether this is already configured for the project
   - Recommendation: Document as manual verification step; will fail clearly if not configured

2. **Team Member Access to Billing Portal**
   - What we know: Non-owner team members have no `stripeCustomerId` of their own
   - What's unclear: Should non-owner team members be able to access billing portal at all?
   - Recommendation: Allow it using team's customer ID (consistent with what they'd see), but billing changes still require owner auth in Stripe

## Sources

### Primary (HIGH confidence)
- Codebase: `src/routes/checkout.ts` - existing route pattern
- Codebase: `src/routes/dashboard.ts` - existing route pattern
- Codebase: `src/billing/failure-handler.ts:96-109, 177-197` - existing billingPortal.sessions.create() usage
- Codebase: `public/dashboard.html:608-630` - frontend contract
- Codebase: `src/middleware/session.ts` - requireAuth middleware

### Secondary (MEDIUM confidence)
- [Stripe API - Create portal session](https://docs.stripe.com/api/customer_portal/sessions/create?lang=node) - Official API reference
- [Stripe Customer Portal Integration Guide](https://docs.stripe.com/customer-management/integrate-customer-portal) - Configuration requirements

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using existing installed dependencies
- Architecture: HIGH - copying existing patterns from same codebase
- Pitfalls: HIGH - documented from official Stripe docs + codebase analysis

**Research date:** 2026-01-20
**Valid until:** 90 days (stable API, no breaking changes expected)

---

## Implementation Checklist (for planner)

Based on research, the implementation requires:

1. **Create route file:** `src/routes/billing.ts`
2. **Implement endpoint:** POST `/portal` with `requireAuth`
3. **Handle both cases:** Individual (member.stripeCustomerId) and Team (team.stripeCustomerId)
4. **Register route:** Add to `src/index.ts` with `app.use('/billing', billingRouter)`
5. **Return format:** `{ portalUrl: string }` to match frontend expectation

**No frontend changes needed** - `public/dashboard.html` already has the correct code.
