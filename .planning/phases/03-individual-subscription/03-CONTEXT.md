# Phase 3: Individual Subscription - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Individual users can pay via Stripe Checkout, claim their subscription, and receive their initial Discord role. This phase covers: The Gatekeeper landing page, account creation, Stripe Checkout flow, claiming/linking Discord, and initial role assignment ("Paid (Unintroduced)"). Introduction detection and role promotion are Phase 4. Company/team subscriptions are Phase 5.

</domain>

<decisions>
## Implementation Decisions

### The Gatekeeper Page
- Information-focused landing page (not hard-sell, not minimal)
- Content includes: what The Revenue Council is, community value proposition, membership tiers with pricing
- Prominent side-by-side pricing cards for Individual and Company tiers
- Medieval/guild visual theme matching "The Revenue Council" branding

### Account Creation & Checkout Flow
- Account creation required BEFORE Stripe Checkout (user exists in DB before payment)
- Two signup options: Email + Password OR Magic Link (user's choice)
- After payment success → redirect to user dashboard with "Claim your access" prompt
- Checkout cancel → return to dashboard with "Complete payment" prompt

### Claim Experience
- Single-step OAuth flow: Click "Connect Discord" → Discord OAuth → role assigned automatically
- After successful claim → auto-redirect to Discord invite URL
- Discord invite link also shown on dashboard for later access
- Changing linked Discord account requires admin intervention (no self-service unlinking)

### Error Handling
- Missing/failed payment → block claim with clear message + link to retry checkout
- Discord already linked to another account → block with explanation
- Discord OAuth failure → return to dashboard with error message and "Try again" button
- Bot can't assign role → silent retry with admin alert; user sees success, role assignment async

### Claude's Discretion
- Exact medieval theme styling (colors, fonts, imagery)
- Dashboard layout and component structure
- Retry mechanism for failed role assignments
- Loading states and micro-interactions

</decisions>

<specifics>
## Specific Ideas

- Medieval/guild aesthetic for The Gatekeeper — lean into "The Revenue Council" naming
- Pricing cards should clearly show Individual vs Company options side-by-side
- Flow should feel smooth: account → pay → claim → join Discord in one session ideally

</specifics>

<deferred>
## Deferred Ideas

- Team member upgrading to owner seat — Phase 5 (seat management)
- Introduction detection and role promotion — Phase 4

</deferred>

---

*Phase: 03-individual-subscription*
*Context gathered: 2026-01-18*
