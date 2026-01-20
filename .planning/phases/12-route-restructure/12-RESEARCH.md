# Phase 12: Route Restructure - Research

**Researched:** 2026-01-20
**Domain:** Express.js route reorganization, URL structure refactoring
**Confidence:** HIGH

## Summary

This phase restructures all routes to consolidate user-facing pages under `/app/*` for a consistent URL hierarchy. The existing codebase uses Express 5.2.1 with well-organized route modules. The restructure is a pre-launch refactoring task with no backwards compatibility requirements (old routes will 404, not redirect).

The primary technical challenge is ensuring all URL references are updated consistently across:
1. Backend route definitions in `src/routes/public.ts` and `src/index.ts`
2. Frontend HTML files (119 occurrences of `/admin/`, 21 occurrences of `/auth/`)
3. JavaScript fetch calls and redirects
4. External service configurations (Discord Developer Portal, Stripe Dashboard)

**Primary recommendation:** Execute as a systematic search-and-replace operation with manual verification, organized into 2 plans: (1) backend route changes + external config checklist, (2) frontend HTML/JS updates.

## Standard Stack

This phase uses existing project dependencies only - no new libraries required.

### Core (Already Installed)
| Library | Version | Purpose | Relevance to Phase |
|---------|---------|---------|-------------------|
| express | 5.2.1 | HTTP routing | Route definitions being modified |
| typescript | 5.9.3 | Type safety | Route changes must compile |

### Supporting
No additional libraries needed. This is purely a refactoring phase using existing tools.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual find/replace | AST-based codemods | Overkill for HTML string replacements |
| Individual file edits | Bulk sed/regex | Risk of over-matching; manual review safer |

**Installation:** None required.

## Architecture Patterns

### Current Route Structure
```
/ (GET)                          -> index.html (landing page)
/auth/signup (GET)               -> signup.html
/auth/login (GET)                -> login.html
/auth/* (POST)                   -> API endpoints (login, signup, refresh, etc.)
/admin/login (GET)               -> admin/login.html
/admin/dashboard (GET)           -> admin/dashboard.html
/admin/members (GET)             -> admin/members.html
/admin/members/:id (GET)         -> admin/member-detail.html
/admin/config (GET)              -> admin/config.html
/admin/audit (GET)               -> admin/audit.html
/admin/admins (GET)              -> admin/admins.html
/admin/templates (GET)           -> admin/templates.html
/admin/auth/* (POST)             -> API endpoints (login, logout, refresh)
/api/admin/* (GET/POST/PATCH)    -> Admin API endpoints (unchanged)
/app/dashboard (GET)             -> dashboard.html (already /app)
/app/claim (GET)                 -> claim.html (already /app)
/app/team (GET)                  -> team-dashboard.html (already /app)
```

### Target Route Structure
```
/ (GET)                          -> index.html (landing page - UNCHANGED)
/app/auth/signup (GET)           -> signup.html
/app/auth/login (GET)            -> login.html
/auth/* (POST)                   -> API endpoints (UNCHANGED - APIs stay at /auth/*)
/app/admin/login (GET)           -> admin/login.html
/app/admin/dashboard (GET)       -> admin/dashboard.html
/app/admin/members (GET)         -> admin/members.html
/app/admin/members/:id (GET)     -> admin/member-detail.html
/app/admin/config (GET)          -> admin/config.html
/app/admin/audit (GET)           -> admin/audit.html
/app/admin/admins (GET)          -> admin/admins.html
/app/admin/templates (GET)       -> admin/templates.html
/admin/auth/* (POST)             -> API endpoints (UNCHANGED - APIs stay)
/api/admin/* (GET/POST/PATCH)    -> Admin API endpoints (UNCHANGED)
/app/dashboard (GET)             -> dashboard.html (UNCHANGED - already /app)
/app/claim (GET)                 -> claim.html (UNCHANGED - already /app)
/app/team (GET)                  -> team-dashboard.html (UNCHANGED - already /app)
```

### Key Design Decisions (from CONTEXT.md)
1. **Pages at `/app/*`, APIs at `/api/*` and `/auth/*`** - Clear separation between HTML pages and JSON endpoints
2. **No redirects** - Pre-launch, old routes simply 404
3. **Landing page stays at `/`** - Root remains homepage
4. **Webhooks stay at `/webhooks/*`** - Stability for external integrations
5. **Static assets stay at `/public/*`** - Express static file serving unchanged

### Pattern: Centralized Page Routes
The codebase already uses `src/routes/public.ts` as a centralized location for all HTML page routes. This pattern should be maintained:

```typescript
// src/routes/public.ts - current pattern
publicRouter.get('/auth/signup', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/signup.html'));
});

// After restructure:
publicRouter.get('/app/auth/signup', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/signup.html'));
});
```

### Anti-Patterns to Avoid
- **Partial migration:** Don't leave some routes at old paths. All or nothing.
- **Forgetting JavaScript redirects:** HTML `href` is obvious, but `window.location.href` in `<script>` tags is easy to miss.
- **Breaking API paths:** Only page routes move; `/auth/login` API stays, `/app/auth/login` page is new.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route versioning/prefixing | Custom middleware | Express Router mounting | `app.use('/app/admin', adminPageRouter)` is cleaner |
| URL path constants | Hardcoded strings everywhere | Centralized constants object | Single source of truth for all route paths |

**Key insight:** The restructure is mechanical - no custom tooling needed. The complexity is in completeness, not technique.

## Common Pitfalls

### Pitfall 1: API vs Page Route Confusion
**What goes wrong:** Accidentally moving API routes when only page routes should move
**Why it happens:** Both `/auth/login` (API) and `/auth/login` (page) exist - different HTTP methods
**How to avoid:**
- Page routes are in `src/routes/public.ts` and serve HTML files
- API routes are in `src/routes/auth.ts`, `src/routes/admin/*.ts` and return JSON
- Only modify `public.ts` for route path changes
**Warning signs:** If changing files other than `public.ts` and `index.ts` for routing, verify carefully

### Pitfall 2: Incomplete JavaScript Updates
**What goes wrong:** HTML links work but JavaScript redirects still use old paths
**Why it happens:** `window.location.href` buried in `<script>` tags is easy to miss
**How to avoid:**
- Search for `location.href` patterns, not just `href=`
- Search for `fetch('/admin` and `fetch('/auth` patterns
- Test login/logout flows which use JS redirects
**Warning signs:** Links work but auth flows break

### Pitfall 3: CSS/Asset Path Confusion
**What goes wrong:** Moving `/admin/styles.css` reference when it should stay
**Why it happens:** `/admin/styles.css` is a static file, not a route
**How to avoid:**
- Static files in `/public/*` are served by `express.static()`
- These paths don't change - they're not routes
- Only HTML page URLs change, not asset URLs
**Warning signs:** `href="/admin/styles.css"` should NOT become `href="/app/admin/styles.css"`

### Pitfall 4: External Service Config Forgotten
**What goes wrong:** App works locally but OAuth/webhooks fail in production
**Why it happens:** Discord Developer Portal and Stripe Dashboard have hardcoded URLs
**How to avoid:**
- Document all external configs that need updating
- Create a checklist in the plan
- Update DISCORD_REDIRECT_URI env var if OAuth callback moves
**Warning signs:** OAuth state errors, webhook signature failures

### Pitfall 5: Admin Auth API Path Mismatch
**What goes wrong:** Admin login breaks because page fetches wrong API
**Why it happens:** Admin pages fetch `/admin/auth/login` which is an API, not a page route
**How to avoid:**
- `/admin/auth/*` API routes stay at `/admin/auth/*` (mounted in index.ts)
- Only the LOGIN PAGE moves from `/admin/login` to `/app/admin/login`
- The page's fetch call to `/admin/auth/login` API stays unchanged
**Warning signs:** Admin login form works but API call fails

## Code Examples

### Backend Route Changes (src/routes/public.ts)

**Before:**
```typescript
// Auth page routes
publicRouter.get('/auth/signup', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/signup.html'));
});

publicRouter.get('/auth/login', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/login.html'));
});

// Admin page routes
publicRouter.get('/admin/login', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/admin/login.html'));
});

publicRouter.get('/admin/dashboard', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/admin/dashboard.html'));
});
```

**After:**
```typescript
// Auth page routes (now under /app/auth/*)
publicRouter.get('/app/auth/signup', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/signup.html'));
});

publicRouter.get('/app/auth/login', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/login.html'));
});

// Admin page routes (now under /app/admin/*)
publicRouter.get('/app/admin/login', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/admin/login.html'));
});

publicRouter.get('/app/admin/dashboard', (_req, res) => {
  res.sendFile(join(__dirname, '../../public/admin/dashboard.html'));
});
```

### Frontend HTML Updates

**Navigation links (admin pages):**
```html
<!-- Before -->
<a href="/admin/dashboard">Dashboard</a>
<a href="/admin/members">Members</a>

<!-- After -->
<a href="/app/admin/dashboard">Dashboard</a>
<a href="/app/admin/members">Members</a>
```

**JavaScript redirects:**
```javascript
// Before
window.location.href = '/admin/login';

// After
window.location.href = '/app/admin/login';
```

**Auth page links:**
```html
<!-- Before -->
<a href="/auth/signup">Create one</a>

<!-- After -->
<a href="/app/auth/signup">Create one</a>
```

### What Stays Unchanged

**API fetch calls - NO CHANGE:**
```javascript
// These API endpoints stay at their current paths
fetch('/admin/auth/login', { method: 'POST', ... })  // Admin login API
fetch('/admin/auth/logout', { method: 'POST', ... }) // Admin logout API
fetch('/api/admin/members', { ... })                 // Admin API
fetch('/auth/login', { method: 'POST', ... })        // User login API
fetch('/auth/signup', { method: 'POST', ... })       // User signup API
```

**Static asset references - NO CHANGE:**
```html
<!-- Static files served by express.static() don't change -->
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/admin/styles.css">
```

## Change Inventory

### Files Requiring Route Path Changes

**Backend (2 files):**
1. `src/routes/public.ts` - All page route definitions
2. `src/index.ts` - Verify no page routes defined here (only API mounts)

**Frontend - Admin Pages (8 files, ~119 occurrences of `/admin/`):**
1. `public/admin/dashboard.html` - 22 occurrences
2. `public/admin/members.html` - 14 occurrences
3. `public/admin/member-detail.html` - 16 occurrences
4. `public/admin/config.html` - 16 occurrences
5. `public/admin/audit.html` - 14 occurrences
6. `public/admin/admins.html` - 17 occurrences
7. `public/admin/templates.html` - 16 occurrences
8. `public/admin/login.html` - 4 occurrences

**Frontend - User Pages (6 files, ~21 occurrences of `/auth/`):**
1. `public/login.html` - 2 occurrences
2. `public/signup.html` - 2 occurrences
3. `public/index.html` - 3 occurrences
4. `public/dashboard.html` - 2 occurrences
5. `public/claim.html` - 2 occurrences
6. `public/team-dashboard.html` - 2 occurrences

### Specific URL Mappings

**Auth Pages:**
| Old Path | New Path | Files Affected |
|----------|----------|----------------|
| `/auth/signup` | `/app/auth/signup` | index.html, login.html |
| `/auth/login` | `/app/auth/login` | signup.html, admin pages |

**Admin Pages:**
| Old Path | New Path |
|----------|----------|
| `/admin/login` | `/app/admin/login` |
| `/admin/dashboard` | `/app/admin/dashboard` |
| `/admin/members` | `/app/admin/members` |
| `/admin/members/:id` | `/app/admin/members/:id` |
| `/admin/config` | `/app/admin/config` |
| `/admin/audit` | `/app/admin/audit` |
| `/admin/admins` | `/app/admin/admins` |
| `/admin/templates` | `/app/admin/templates` |

### URLs That Stay Unchanged

| Path Pattern | Reason |
|--------------|--------|
| `/` | Landing page stays at root |
| `/auth/*` (POST) | API endpoints, not pages |
| `/admin/auth/*` | Admin API endpoints |
| `/api/admin/*` | Admin API endpoints |
| `/app/dashboard` | Already under /app |
| `/app/claim` | Already under /app |
| `/app/team` | Already under /app |
| `/webhooks/*` | External integration stability |
| `/checkout/*` | Payment flow paths |
| `/claim/*` | OAuth callback paths |
| `/team/*` | Team management paths |
| `/dashboard` | User API endpoint |
| `/health` | Health check endpoint |

## External Configuration Checklist

These external services need URL updates after deployment:

### Discord Developer Portal
- **OAuth2 Redirect URIs:** If `/auth/callback` moves, update `DISCORD_REDIRECT_URI` env var
- **Note:** Current callback is `/auth/callback` which is an API route, not a page route - likely stays unchanged
- **Action:** Verify `/auth/callback` route location in `src/routes/auth.ts` - it's an API callback, NOT a page

### Stripe Dashboard
- **Webhook Endpoint:** `/webhooks/stripe` - unchanged (not moving)
- **Customer Portal Return URL:** If using Stripe Customer Portal, check return URLs
- **Checkout Success/Cancel URLs:** Check if any Stripe settings reference `/auth/*` or `/admin/*` pages

### Environment Variables
- **DISCORD_REDIRECT_URI:** Currently `http://localhost:3000/auth/callback` - this is an API route, stays unchanged
- **APP_URL:** Base URL used for magic links - unchanged
- **No env changes expected** unless OAuth callback page route moves

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scattered route paths | Centralized in public.ts | Already implemented | Good for this refactor |
| Mixed page/API routes | Clear separation | Already implemented | Reduces confusion |

**Current codebase observations:**
- Routes are well-organized with clear separation between page routes (public.ts) and API routes (other files)
- Some pages already use `/app/*` prefix (dashboard, claim, team)
- This refactor completes the `/app/*` pattern for all user-facing pages

## Open Questions

1. **member-detail.html URL query param:** The file uses `?id=${id}` query param. Does the route use `:id` path param or query? Answer: Route is `/admin/members/:id` (path param), HTML parses from URL path. No issue.

2. **OAuth callback route:** The `/auth/callback` route handles Discord OAuth. Is this considered a "page" or "API"? Answer: It's technically an API (receives code, redirects) but user navigates to it. Per CONTEXT.md recommendation, OAuth callback could move to `/app/auth/discord/callback` for consistency, but this requires updating Discord Developer Portal.

**Recommendation for OAuth callback:** Keep at `/auth/callback` since:
- It's configured in Discord Developer Portal
- Changing requires external config update
- It's more of an API endpoint that redirects than a page users see
- Risk/benefit ratio doesn't favor moving it

## Sources

### Primary (HIGH confidence)
- Codebase analysis of existing route structure
- `src/routes/public.ts` - Page route definitions
- `src/index.ts` - Route mounting
- `public/admin/*.html` - Frontend files with URL references
- CONTEXT.md - User decisions for this phase

### Secondary (MEDIUM confidence)
- [Express.js Routing Guide](https://expressjs.com/en/guide/routing.html) - Official routing documentation
- [Express 5 Setup Guide](https://www.reactsquad.io/blog/how-to-set-up-express-5-in-2025) - Express 5 best practices
- [MDN Express Tutorial](https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs/routes) - Routes and controllers

### Tertiary (LOW confidence)
- Web search results for route migration patterns - general guidance only

## Metadata

**Confidence breakdown:**
- Route structure analysis: HIGH - Direct codebase inspection
- Change inventory: HIGH - Grep counts verified
- External config impact: HIGH - Documented in codebase
- Migration approach: HIGH - Standard refactoring technique

**Research date:** 2026-01-20
**Valid until:** No expiration - refactoring techniques are stable
