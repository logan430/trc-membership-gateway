# Phase 25: Member Self-Service Dashboard - Research

**Researched:** 2026-01-21
**Domain:** Frontend (vanilla JS), Authentication, Stripe billing APIs
**Confidence:** HIGH

## Summary

This phase transforms the minimal dashboard.html status page into a full self-managed membership portal. The current implementation is a single-page view with subscription status, Discord connection, and basic action buttons. The enhancement requires:

1. **Navigation header** - Following the admin dashboard pattern already implemented
2. **Account settings** - New endpoints for email/password changes (not yet implemented)
3. **Billing details** - Stripe API integration for payment method, invoices, next billing date
4. **Activity timeline** - Events from existing Member model fields
5. **Team member experience** - Show team info for TEAM members, team dashboard link for OWNER
6. **Token auto-refresh** - Proactive refresh before token expiry
7. **Admin token validation** - Check expiry before auto-redirect on login page

The existing codebase has established patterns (admin nav, JWT handling, Stripe SDK) that can be directly applied. No frameworks needed - vanilla JS with static HTML matches the existing approach.

**Primary recommendation:** Create multiple HTML pages (dashboard, account, billing) sharing a navigation header via consistent HTML structure, with new backend endpoints for account updates and billing details.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 5.2.1 | Backend routing | Already in use, Stripe docs alignment |
| Stripe SDK | Latest | Billing/invoice data | Already configured, handles all Stripe API |
| jose | 5.x | JWT creation/verification | Already in use for auth tokens |
| Argon2id | OWASP params | Password hashing | Already in use for password management |
| Zod | 4.x | Request validation | Already in use throughout backend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cookie | 0.7.x | Cookie parsing | Already in use for refresh tokens |
| prisma | 7.x | Database access | Already configured |

### No New Dependencies Required
This phase uses only existing dependencies. All functionality can be built with current stack.

## Architecture Patterns

### Recommended Project Structure

No new folders needed. Files integrate into existing structure:

```
public/
  dashboard.html          # Enhance existing (add nav)
  account.html           # NEW - account settings page
  billing.html           # NEW - billing details page
src/routes/
  auth.ts                # Add update-email, update-password endpoints
  billing.ts             # Add billing-details endpoint
  dashboard.ts           # Extend with activity timeline
```

### Pattern 1: Multi-Page with Shared Navigation

**What:** Duplicate navigation header HTML in each authenticated page
**When to use:** Static HTML approach, no build step, no JS framework
**Example:**
```html
<!-- Shared navigation header (copy to each page) -->
<nav class="member-nav">
  <a href="/app/dashboard" class="nav-link">Dashboard</a>
  <a href="/app/account" class="nav-link">Account</a>
  <a href="/app/billing" class="nav-link">Billing</a>
</nav>
```

**Why this pattern:**
- Matches existing admin dashboard approach (see admin/dashboard.html lines 22-29)
- No build step required
- Each page is self-contained
- Simple to maintain with consistent copy-paste

### Pattern 2: Token Auto-Refresh with Interval

**What:** Refresh access token before expiry during active use
**When to use:** When user stays on page for extended periods
**Example:**
```javascript
// Auto-refresh token every 10 minutes (before 15-min expiry)
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

async function setupTokenAutoRefresh() {
  setInterval(async () => {
    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const { accessToken } = await response.json();
        localStorage.setItem('accessToken', accessToken);
      }
    } catch (err) {
      console.warn('Token refresh failed:', err);
    }
  }, REFRESH_INTERVAL);
}
```

### Pattern 3: Stripe Billing Details Retrieval

**What:** Get payment method and invoice history from Stripe
**When to use:** Billing page needs current payment info
**Example:**
```typescript
// Backend endpoint: GET /billing/details
const customer = await stripe.customers.retrieve(member.stripeCustomerId, {
  expand: ['invoice_settings.default_payment_method'],
});

const invoices = await stripe.invoices.list({
  customer: member.stripeCustomerId,
  limit: 10,
});

// Extract card info
const pm = customer.invoice_settings?.default_payment_method;
const card = pm?.card ? {
  brand: pm.card.brand,
  last4: pm.card.last4,
  expMonth: pm.card.exp_month,
  expYear: pm.card.exp_year,
} : null;
```

### Pattern 4: Account Update with Email Verification

**What:** Update email with timing-safe verification
**When to use:** Email change endpoint
**Example:**
```typescript
// POST /auth/update-email
const updateEmailSchema = z.object({
  newEmail: z.string().email(),
  password: z.string().min(1), // Require password confirmation
});

// Verify current password before allowing email change
const isValid = await verifyPassword(member.passwordHash, password);
if (!isValid) {
  return res.status(401).json({ error: 'Invalid password' });
}

// Check new email not in use
const existing = await prisma.member.findUnique({ where: { email: newEmail } });
if (existing) {
  return res.status(409).json({ error: 'Email already in use' });
}

// Update email in both database and Stripe
await prisma.member.update({ where: { id: memberId }, data: { email: newEmail } });
await stripe.customers.update(member.stripeCustomerId, { email: newEmail });
```

### Anti-Patterns to Avoid

- **Single shared JS file for all pages:** Don't create a shared nav.js that injects HTML. Each page should be self-contained for simplicity.
- **Client-side routing (hash-based SPA):** The existing app uses real URL paths. Don't introduce client-side routing.
- **Polling for data changes:** Use one-time fetch on page load. Real-time updates not needed for this use case.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token refresh | Custom retry logic | Existing /auth/refresh endpoint | Already handles rotation, cookies |
| Password hashing | Custom hash | Argon2id via lib/password.ts | OWASP compliant, constant-time |
| Stripe billing portal | Custom UI for payment changes | stripe.billingPortal.sessions | Stripe handles PCI compliance |
| Invoice PDF download | Custom PDF generation | Stripe hosted invoices | stripe.invoices have hosted_invoice_url |
| Date formatting | Custom locale logic | toLocaleDateString | Built-in browser API |

**Key insight:** Stripe billing portal handles payment method updates, subscription changes, and invoice downloads. The member dashboard only needs to DISPLAY current info, not edit it directly.

## Common Pitfalls

### Pitfall 1: Token Expiry Race Condition on Page Load

**What goes wrong:** Page loads, token is about to expire, API call fails before refresh happens
**Why it happens:** 15-minute expiry means tokens can expire mid-session
**How to avoid:**
1. Check token expiry BEFORE making API calls
2. Parse JWT to get `exp` claim
3. Proactively refresh if <2 minutes until expiry
**Warning signs:** Intermittent 401 errors, especially after user returns to tab

### Pitfall 2: Stripe Customer ID Mismatch for Team Members

**What goes wrong:** Team member tries to get billing info using their own stripeCustomerId (null for team members)
**Why it happens:** Team members don't have their own Stripe customer - the Team has the stripeCustomerId
**How to avoid:**
1. Check if member.teamId exists
2. Use team.stripeCustomerId for team members
3. Show "Managed by team owner" message instead of billing details for TEAM_MEMBER tier
**Warning signs:** "No billing account" errors for team members

### Pitfall 3: Admin Token Validation Without Expiry Check

**What goes wrong:** Admin login page auto-redirects even with expired token
**Why it happens:** Current checkAuth() only checks if token EXISTS, not if it's valid
**How to avoid:**
1. Parse JWT and check `exp` claim
2. If `exp < Date.now() / 1000`, treat as no token
3. Attempt silent refresh before redirect
**Warning signs:** Redirect loop to dashboard then back to login

### Pitfall 4: Email Update Without Stripe Sync

**What goes wrong:** Email updated in database but Stripe still has old email
**Why it happens:** Forgot to update Stripe customer record
**How to avoid:** Update both in same endpoint, Stripe first (so failure doesn't leave partial update)
**Warning signs:** Stripe invoices go to old email, support confusion

### Pitfall 5: Activity Timeline Shows Too Much

**What goes wrong:** Timeline shows sensitive info or overwhelming detail
**Why it happens:** Logging everything without filtering
**How to avoid:**
1. Curate specific events: joined (createdAt), subscribed (when status changed to ACTIVE), claimed Discord (when discordId set), introduced (introCompletedAt)
2. Use existing Member model fields, not AuditLog
**Warning signs:** User confusion, privacy concerns

## Code Examples

Verified patterns from existing codebase:

### Account Update - Email (NEW Endpoint)
```typescript
// src/routes/auth.ts
const updateEmailSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
  currentPassword: z.string().min(1, 'Password required'),
});

authRouter.post('/update-email', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { newEmail, currentPassword } = parsed.data;

  const member = await prisma.member.findUnique({ where: { id: req.memberId } });
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Verify current password
  const isValid = await verifyPassword(member.passwordHash ?? '', currentPassword);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  // Check email not in use
  const existing = await prisma.member.findUnique({ where: { email: newEmail } });
  if (existing && existing.id !== member.id) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  // Update Stripe first (if fails, don't update DB)
  if (member.stripeCustomerId) {
    await stripe.customers.update(member.stripeCustomerId, { email: newEmail });
  }

  // Update database
  await prisma.member.update({
    where: { id: member.id },
    data: { email: newEmail },
  });

  res.json({ success: true, email: newEmail });
});
```

### Account Update - Password (NEW Endpoint)
```typescript
// src/routes/auth.ts
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

authRouter.post('/update-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const member = await prisma.member.findUnique({ where: { id: req.memberId } });
  if (!member || !member.passwordHash) {
    res.status(404).json({ error: 'Member not found or no password set' });
    return;
  }

  // Verify current password
  const isValid = await verifyPassword(member.passwordHash, currentPassword);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid current password' });
    return;
  }

  // Hash and save new password
  const newHash = await hashPassword(newPassword);
  await prisma.member.update({
    where: { id: member.id },
    data: { passwordHash: newHash },
  });

  res.json({ success: true });
});
```

### Billing Details Endpoint (NEW)
```typescript
// src/routes/billing.ts
billingRouter.get('/details', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
    include: { team: true },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Team members see limited info
  if (member.seatTier === 'TEAM_MEMBER') {
    res.json({
      managedBy: 'team',
      teamName: member.team?.name,
      canManageBilling: false,
    });
    return;
  }

  // Get Stripe customer ID (use team's for OWNER)
  const stripeCustomerId = member.teamId && member.team
    ? member.team.stripeCustomerId
    : member.stripeCustomerId;

  if (!stripeCustomerId) {
    res.json({
      subscription: null,
      paymentMethod: null,
      invoices: [],
      canManageBilling: false,
    });
    return;
  }

  // Retrieve customer with expanded payment method
  const customer = await stripe.customers.retrieve(stripeCustomerId, {
    expand: ['invoice_settings.default_payment_method'],
  });

  // Get subscription details
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 1,
    status: 'all',
    expand: ['data.items.data.price'],
  });
  const subscription = subscriptions.data[0];

  // Get recent invoices
  const invoicesResponse = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 10,
  });

  // Extract payment method
  const pm = customer.invoice_settings?.default_payment_method;
  const paymentMethod = pm && typeof pm !== 'string' && pm.card ? {
    brand: pm.card.brand,
    last4: pm.card.last4,
    expMonth: pm.card.exp_month,
    expYear: pm.card.exp_year,
  } : null;

  res.json({
    subscription: subscription ? {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      planName: subscription.items.data[0]?.price?.nickname || 'Subscription',
    } : null,
    paymentMethod,
    invoices: invoicesResponse.data.map(inv => ({
      id: inv.id,
      date: new Date(inv.created * 1000),
      amount: inv.total / 100,
      status: inv.status,
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
    })),
    canManageBilling: true,
  });
});
```

### Token Auto-Refresh (Frontend)
```javascript
// Add to dashboard.html, account.html, billing.html
const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
let refreshIntervalId = null;

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch (e) {
    return null;
  }
}

function isTokenExpiringSoon(token) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  const expiresIn = payload.exp * 1000 - Date.now();
  return expiresIn < 2 * 60 * 1000; // Less than 2 minutes
}

async function refreshTokenIfNeeded() {
  const token = getAccessToken();
  if (!token || !isTokenExpiringSoon(token)) return;

  try {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (response.ok) {
      const { accessToken } = await response.json();
      localStorage.setItem('accessToken', accessToken);
    }
  } catch (err) {
    console.warn('Token refresh failed:', err);
  }
}

function setupTokenAutoRefresh() {
  // Refresh immediately if needed
  refreshTokenIfNeeded();
  // Then check periodically
  refreshIntervalId = setInterval(refreshTokenIfNeeded, TOKEN_REFRESH_INTERVAL);
}

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
  setupTokenAutoRefresh();
  loadDashboard(); // or loadAccount(), loadBilling()
});
```

### Admin Login Token Validation (Fix)
```javascript
// Update admin/login.html checkAuth function
function checkAuth() {
  const token = localStorage.getItem('adminAccessToken');
  if (!token) return; // No token, stay on login

  // Parse and check expiry
  const payload = parseAdminToken(token);
  if (!payload || !payload.exp) {
    localStorage.removeItem('adminAccessToken');
    return;
  }

  // Check if expired
  if (payload.exp * 1000 < Date.now()) {
    // Token expired, try to refresh
    tryRefreshAndRedirect();
    return;
  }

  // Valid token, redirect
  window.location.href = '/app/admin/dashboard';
}

async function tryRefreshAndRedirect() {
  try {
    const response = await fetch('/admin/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (response.ok) {
      const { accessToken } = await response.json();
      localStorage.setItem('adminAccessToken', accessToken);
      window.location.href = '/app/admin/dashboard';
    } else {
      localStorage.removeItem('adminAccessToken');
    }
  } catch (err) {
    localStorage.removeItem('adminAccessToken');
  }
}
```

### Activity Timeline Data (Extend Dashboard Endpoint)
```typescript
// src/routes/dashboard.ts - extend existing endpoint
dashboardRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
    include: { team: true },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Build activity timeline from member fields
  const timeline = [];

  // Account created
  timeline.push({
    type: 'joined',
    date: member.createdAt,
    description: 'Account created',
  });

  // Subscription started (if active)
  if (member.subscriptionStatus === 'ACTIVE' || member.subscriptionStatus === 'PAST_DUE') {
    // Note: Would need subscriptionStartedAt field or derive from Stripe
    timeline.push({
      type: 'subscribed',
      date: member.createdAt, // Approximate, could enhance
      description: 'Subscription activated',
    });
  }

  // Discord claimed
  if (member.discordId) {
    timeline.push({
      type: 'discord_claimed',
      date: member.updatedAt, // Approximate
      description: `Discord linked: ${member.discordUsername}`,
    });
  }

  // Introduction completed
  if (member.introCompletedAt) {
    timeline.push({
      type: 'introduced',
      date: member.introCompletedAt,
      description: 'Introduction posted',
    });
  }

  // Sort by date descending
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({
    member: {
      id: member.id,
      email: member.email,
      subscriptionStatus: member.subscriptionStatus,
      seatTier: member.seatTier,
      currentPeriodEnd: member.currentPeriodEnd,
      discordUsername: member.discordUsername,
      introCompleted: member.introCompleted,
    },
    claim: {
      canClaim: member.subscriptionStatus === 'ACTIVE' && !member.discordId,
      hasClaimed: !!member.discordId,
      discordInviteUrl: member.discordId ? env.DISCORD_INVITE_URL : null,
    },
    team: member.team ? {
      id: member.team.id,
      name: member.team.name,
      isOwner: member.seatTier === 'OWNER',
    } : null,
    timeline,
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SPA frameworks | Static HTML with vanilla JS | Project decision | Simple, no build step |
| Client-side routing | Server-side page routes | Project decision | Real URLs, better SEO |
| Real-time updates | Fetch on page load | Project decision | Simple, sufficient for use case |

**Deprecated/outdated:**
- Nothing deprecated; this phase uses established patterns from existing codebase

## Open Questions

Things that couldn't be fully resolved:

1. **Subscription start date for timeline**
   - What we know: Member.createdAt exists, but subscription might start later
   - What's unclear: No subscriptionStartedAt field in schema
   - Recommendation: Use createdAt as approximation, or add subscriptionStartedAt to schema if precision needed

2. **Team member billing visibility**
   - What we know: Team members can't manage billing, only owners can
   - What's unclear: Should team members see ANY billing info (plan name, next billing date)?
   - Recommendation: Show plan name and "Billing managed by team owner" message

3. **Navigation active state styling**
   - What we know: Admin dashboard uses `class="active"` for current page
   - What's unclear: Best way to determine current page in static HTML
   - Recommendation: Set active class in HTML for each page (hardcode, not dynamic)

## Sources

### Primary (HIGH confidence)
- Existing codebase: src/routes/auth.ts, billing.ts, dashboard.ts
- Existing codebase: public/admin/dashboard.html (navigation pattern)
- Existing codebase: public/dashboard.html (current state)
- Existing codebase: prisma/schema.prisma (Member model)

### Secondary (MEDIUM confidence)
- [Stripe API - List invoices](https://docs.stripe.com/api/invoices/list?lang=node) - Invoice listing parameters and response
- [Stripe API - Customer retrieve with expand](https://docs.stripe.com/upgrades/manage-payment-methods) - Default payment method
- [Stripe API - PaymentMethod object](https://docs.stripe.com/api/payment_methods/retrieve) - Card fields (last4, brand)

### Tertiary (LOW confidence)
- General SPA patterns for vanilla JS navigation (not specific to this project)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using only existing dependencies
- Architecture: HIGH - Following established patterns from admin dashboard
- Pitfalls: HIGH - Based on direct codebase analysis
- Code examples: HIGH - Adapted from existing working code

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable patterns)
