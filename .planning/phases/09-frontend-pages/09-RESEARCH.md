# Phase 9: Frontend Pages - Research

**Researched:** 2026-01-19
**Domain:** Static HTML pages with vanilla JavaScript for auth/dashboard flows
**Confidence:** HIGH

## Summary

This phase creates the browser-facing HTML pages that complete the membership journey. The backend APIs are fully complete. Research focused on: (1) existing frontend code patterns, (2) route structure and conflicts, (3) CSS theme variables, (4) token handling approach, and (5) CSP considerations with Helmet.

Key finding: The existing codebase already has working frontend patterns in `team-dashboard.html` and `team-claim.html`. These pages demonstrate the exact patterns needed: localStorage for access tokens, inline `<style>` blocks extending the base theme, and JavaScript `fetch()` calls to API endpoints. The new pages should follow these established patterns for consistency.

**Primary recommendation:** Create vanilla HTML pages with inline JS, matching the team-dashboard.html pattern. Use `/app/dashboard` and `/app/claim` paths for HTML to avoid API route conflicts. Extend the existing `styles.css` with form-specific classes. Handle CSP by keeping all JavaScript inline and using Helmet defaults.

## Standard Stack

The established approach for this domain (already in use):

### Core
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Vanilla HTML | N/A | Page structure | No framework overhead for simple forms |
| Vanilla JS | ES6+ | Form handling, API calls | Already used in team-dashboard.html |
| CSS Variables | N/A | Theme consistency | Already defined in styles.css |
| Helmet | 8.1.0 | Security headers (CSP) | Already configured in index.ts |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| Google Fonts | Cinzel + Crimson Text | Already loaded via CDN |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS | React/Vue | Framework adds complexity for 4 simple pages |
| Inline styles | Separate CSS files | Inline matches existing team-dashboard.html pattern |
| fetch() | Axios | fetch() is native, no dependency needed |

**Installation:** No new dependencies needed - all tooling exists.

## Architecture Patterns

### Existing Route Structure

**Current API routes (in index.ts mount order):**
```
POST /auth/signup          -> JSON response with accessToken
POST /auth/login           -> JSON response with accessToken
POST /auth/refresh         -> JSON response with new accessToken
POST /auth/logout          -> Clears cookie
GET  /checkout             -> Returns { checkoutUrl }
POST /checkout             -> Creates Stripe session
GET  /dashboard            -> JSON with member/claim status (requires auth)
GET  /claim/discord        -> Redirects to Discord OAuth
GET  /claim/callback       -> Discord OAuth callback
GET  /team/dashboard       -> Team dashboard JSON (requires auth)
GET  /team/claim/info      -> Invite info JSON
GET  /team/claim           -> Discord OAuth for team claim
```

**Route Conflict:** The draft plans proposed serving HTML at `/dashboard` but the API already uses that path. The `requireAuth` middleware returns 401 for requests without Bearer token, so direct browser navigation fails.

### Recommended URL Structure

**HTML pages (add to publicRouter BEFORE root `/` route):**
```
GET /auth/signup    -> public/signup.html
GET /auth/login     -> public/login.html
GET /app/dashboard  -> public/dashboard.html
GET /app/claim      -> public/claim.html
```

**Why `/app/` prefix:**
- Avoids conflict with `/dashboard` API route
- `/auth/*` doesn't conflict because signup/login are POST-only APIs
- Matches team dashboard pattern which exists at `/team-dashboard.html`

### Page Structure Pattern

Based on team-dashboard.html (working example):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Page Title] - The Revenue Council</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    /* Page-specific styles here */
  </style>
</head>
<body>
  <!-- Page content -->

  <script>
    // All JavaScript inline, no external files
  </script>
</body>
</html>
```

### Token Handling Pattern

**Established approach (from team-dashboard.html):**

```javascript
// Store token in localStorage
function getAccessToken() {
  return localStorage.getItem('accessToken');
}

// Use in API calls
const response = await fetch('/dashboard', {
  headers: {
    'Authorization': `Bearer ${getAccessToken()}`,
  },
});

// Handle 401 by redirecting to login
if (response.status === 401) {
  localStorage.removeItem('accessToken');
  window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
  return;
}
```

**Receiving token from login:**
```javascript
// After successful login/signup API call
const { accessToken } = await response.json();
localStorage.setItem('accessToken', accessToken);
window.location.href = '/app/dashboard';
```

**Token from URL fragment (magic link / OAuth callback):**
```javascript
// Extract token from hash
const hash = window.location.hash;
if (hash.startsWith('#token=')) {
  const token = hash.slice(7);
  localStorage.setItem('accessToken', token);
  // Clear hash from URL
  window.history.replaceState(null, '', window.location.pathname);
}
```

### Anti-Patterns to Avoid
- **Storing tokens in cookies from JS:** The refresh token is httpOnly for security. Access token goes in localStorage only.
- **Calling `/auth/refresh` from JS:** The refresh endpoint reads from httpOnly cookie, not localStorage. JS cannot access it - only the browser sends it automatically.
- **Using different token storage per page:** All pages must use the same localStorage key `accessToken`.

## Don't Hand-Roll

Problems with existing solutions in the codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token storage | Custom storage abstraction | localStorage directly | Consistent with team-dashboard.html |
| API error handling | Custom error parser | Check response.ok + status | Standard fetch pattern already used |
| Theme colors | New color values | CSS variables in styles.css | Consistency, single source of truth |
| Form validation | Full validation library | Native HTML5 + minimal JS | Only need email/password validation |
| Password hashing | Client-side hashing | Send plaintext over HTTPS | Backend handles Argon2id hashing |

**Key insight:** The existing team pages provide working patterns. Replicating their approach ensures consistency and avoids introducing new patterns that might conflict.

## Common Pitfalls

### Pitfall 1: Route Conflict with API
**What goes wrong:** Adding HTML route at `/dashboard` conflicts with API route. Express serves whichever is mounted first.
**Why it happens:** publicRouter is mounted last but same path as dashboardRouter.
**How to avoid:** Use `/app/dashboard` for HTML, keep `/dashboard` for JSON API.
**Warning signs:** Page shows JSON instead of HTML, or 401 when navigating directly.

### Pitfall 2: CSP Blocking Inline Scripts
**What goes wrong:** Helmet's default CSP blocks inline `<script>` tags.
**Why it happens:** Helmet 8.x enables strict CSP by default.
**How to avoid:** Either use nonce-based CSP or configure Helmet to allow inline scripts (less secure but simpler for static pages).
**Warning signs:** Console shows "Refused to execute inline script because it violates CSP".

### Pitfall 3: Token Refresh Loop
**What goes wrong:** Access token expires, page tries to refresh, fails, redirects to login, user logs in, redirects back, token expires again.
**Why it happens:** Refresh endpoint uses httpOnly cookie. If cookie is missing/expired, refresh fails.
**How to avoid:** On 401, redirect to login rather than attempting refresh. Let login establish new session.
**Warning signs:** Rapid redirect loops, user keeps getting sent to login.

### Pitfall 4: CORS on Static Pages
**What goes wrong:** API calls from HTML pages fail with CORS errors.
**Why it happens:** Pages served from different origin than API, or mismatched credentials handling.
**How to avoid:** Pages and API are same origin (both from Express), so no CORS issues. Keep it that way.
**Warning signs:** "CORS policy" errors in console.

### Pitfall 5: Form Double-Submit
**What goes wrong:** User clicks submit twice, creates duplicate accounts or sessions.
**Why it happens:** No disable-on-submit, slow network.
**How to avoid:** Disable button on submit, show loading state, re-enable on error.
**Warning signs:** Duplicate member records, "email already exists" after first success.

## Code Examples

Verified patterns from existing codebase:

### API Response from Login (src/routes/auth.ts)
```javascript
// Response format
{
  accessToken: "eyJhbGciOiJIUzI1NiIs...",
  expiresIn: 900  // 15 minutes in seconds
}
```

### API Response from Dashboard (src/routes/dashboard.ts)
```javascript
// Response format
{
  member: {
    id: "uuid",
    email: "user@example.com",
    subscriptionStatus: "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELED",
    seatTier: "INDIVIDUAL" | "OWNER" | "TEAM",
    currentPeriodEnd: "2026-02-19T00:00:00.000Z",
    discordUsername: "User#1234" | null,
    introCompleted: false
  },
  claim: {
    canClaim: true | false,
    hasClaimed: true | false,
    discordInviteUrl: "https://discord.gg/..." | null
  }
}
```

### API Response from Checkout (src/routes/checkout.ts)
```javascript
// Response format (on success)
{ checkoutUrl: "https://checkout.stripe.com/..." }

// Response format (on error)
{ error: "Already subscribed" }
```

### Loading State Pattern (from team-dashboard.html)
```javascript
document.getElementById('loading').style.display = 'none';
document.getElementById('dashboard-content').style.display = 'block';
```

### Error Display Pattern (from team-dashboard.html)
```javascript
function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('dashboard-content').style.display = 'none';
  document.getElementById('error').style.display = 'block';
  document.getElementById('error-message').textContent = message;
}
```

## CSS Variables (from styles.css)

The theme is already defined:

```css
:root {
  --bg-dark: #1a1a2e;
  --bg-card: #16213e;
  --bg-section: #0f0f1a;
  --gold: #d4af37;
  --gold-light: #f1c40f;
  --gold-dark: #b8960c;
  --cream: #f5f0e1;
  --text: #e8e8e8;
  --text-muted: #a0a0a0;
  --border-subtle: rgba(212, 175, 55, 0.3);
}
```

Fonts:
- **Cinzel:** Headers, buttons, labels (serif, medieval feel)
- **Crimson Text:** Body text, inputs (readable serif)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jQuery | Vanilla JS + fetch | Standard now | No dependency needed |
| Cookie tokens | localStorage (access) + httpOnly (refresh) | Security best practice | Matches existing pattern |
| External JS files | Inline `<script>` | Per existing pages | Simpler, CSP compatible with config |

**Note on Helmet 8.x CSP:**
Helmet 8.x defaults enable `contentSecurityPolicy: true`. For inline scripts to work:

Option A (recommended for this project): Keep scripts inline, configure CSP to allow:
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Allow inline scripts
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));
```

Option B: Use external JS files with strict CSP (more work, higher security).

Current index.ts uses `app.use(helmet())` with defaults. **This needs modification for inline scripts.**

## Open Questions

Things that need validation during implementation:

1. **Helmet CSP Configuration**
   - What we know: Helmet is used with defaults. Team pages have inline scripts.
   - What's unclear: Whether current CSP is blocking inline scripts (need to test in browser)
   - Recommendation: Add CSP configuration to allow inline scripts + Google Fonts

2. **Token Refresh Strategy**
   - What we know: Access tokens expire in 15min. Refresh cookie is httpOnly.
   - What's unclear: Whether JS can trigger refresh via fetch (cookie should send automatically)
   - Recommendation: Test refresh endpoint behavior. May need to redirect to login on 401 rather than attempting silent refresh.

3. **Login Redirect Handling**
   - What we know: Pages should support `?redirect=` for post-login navigation
   - What's unclear: Exact redirect validation needed (open redirect vulnerability)
   - Recommendation: Only allow relative paths starting with `/app/` or `/team-` for redirect

## Sources

### Primary (HIGH confidence)
- **Codebase files:** Direct reading of existing source files
  - `src/index.ts` - Route structure and middleware order
  - `src/routes/auth.ts` - Auth API response formats
  - `src/routes/dashboard.ts` - Dashboard API response format
  - `src/routes/claim.ts` - Claim flow and redirect patterns
  - `src/routes/checkout.ts` - Checkout API response format
  - `src/auth/session.ts` - Token creation, cookie config
  - `src/middleware/session.ts` - Auth middleware behavior
  - `public/styles.css` - CSS variables and theme
  - `public/team-dashboard.html` - Working frontend pattern (900+ lines)
  - `public/team-claim.html` - Working claim page pattern

### Secondary (MEDIUM confidence)
- **Helmet 8.x behavior:** Based on npm version check and general knowledge of Helmet defaults

### Tertiary (LOW confidence)
- **CSP interaction:** Need to verify by testing in browser whether current config blocks inline scripts

## Metadata

**Confidence breakdown:**
- Route structure: HIGH - Direct code reading
- Token handling: HIGH - Existing patterns in team pages
- CSS theme: HIGH - styles.css defines all variables
- API formats: HIGH - Direct code reading of route handlers
- CSP behavior: MEDIUM - Helmet version confirmed, CSP defaults assumed

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (stable, no external dependencies changing)
