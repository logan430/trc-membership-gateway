# Phase 15: Security Audit - Research

**Researched:** 2026-01-20
**Domain:** Application Security (Authentication, Authorization, Input Validation, Secrets)
**Confidence:** HIGH (direct code analysis, established security patterns)

## Summary

This research documents the security-critical code locations and provides specific verification criteria for each audit checklist item. The application uses industry-standard security practices including:

- **JWT tokens** via jose library with 15min access / 7-30d refresh tokens stored in httpOnly cookies
- **Password hashing** via Argon2id with OWASP 2025 recommended parameters
- **CSRF protection** via state cookies on all OAuth flows
- **Stripe webhook signature verification** on all webhook events
- **Zod validation** on most API endpoints

**Key concerns identified during research:**
1. **No rate limiting** on authentication endpoints (login, signup, magic-link)
2. **Debug console.log statements** in admin middleware (leaks token info)
3. **.env.example is incomplete** - missing many required env vars
4. **CORS is set to open** (`cors()` with no config)

**Primary recommendation:** Prioritize Critical items first (JWT, password, webhook signature, admin authorization), then address rate limiting gap which is currently missing entirely.

---

## Security-Critical File Inventory

### Authentication Files

| File | Purpose | Audit Priority |
|------|---------|----------------|
| `src/auth/session.ts` | JWT token creation/verification, cookie config | Critical |
| `src/auth/magic-link.ts` | Magic link token creation/verification | High |
| `src/lib/password.ts` | Argon2id password hashing | Critical |
| `src/middleware/session.ts` | Bearer token validation middleware | Critical |
| `src/routes/auth.ts` | Login, signup, refresh, OAuth endpoints | Critical |

### Admin Authentication Files

| File | Purpose | Audit Priority |
|------|---------|----------------|
| `src/admin/auth.ts` | Admin JWT token creation/verification | Critical |
| `src/admin/middleware.ts` | Admin auth middleware (requireAdmin, requireSuperAdmin) | Critical |
| `src/routes/admin/auth.ts` | Admin login, refresh, logout | Critical |
| `src/routes/admin/admins.ts` | Admin account management (super admin only) | Critical |

### Authorization Files

| File | Purpose | Audit Priority |
|------|---------|----------------|
| `src/routes/admin/access.ts` | Member access revocation, role grants | Critical |
| `src/routes/team-dashboard.ts` | Team owner authorization checks | High |
| `src/routes/team-invites.ts` | Team owner authorization checks | High |
| `src/routes/dashboard.ts` | Member data isolation | High |

### Input Validation Files

| File | Purpose | Audit Priority |
|------|---------|----------------|
| `src/routes/auth.ts` | Signup/login Zod schemas | High |
| `src/routes/company-checkout.ts` | Company checkout Zod schema | High |
| `src/routes/team-dashboard.ts` | Add seats Zod schema | High |
| `src/routes/admin/members.ts` | Query params Zod schema | Medium |

### Webhook/Payment Files

| File | Purpose | Audit Priority |
|------|---------|----------------|
| `src/webhooks/stripe.ts` | Stripe webhook signature verification | Critical |
| `src/routes/checkout.ts` | Checkout session creation | High |
| `src/routes/billing.ts` | Billing portal creation | High |

### OAuth Files

| File | Purpose | Audit Priority |
|------|---------|----------------|
| `src/auth/discord-oauth.ts` | Discord OAuth code exchange | High |
| `src/routes/claim.ts` | Discord claim OAuth flow with CSRF | High |
| `src/routes/team-claim.ts` | Team invite claim OAuth flow | High |

### Configuration Files

| File | Purpose | Audit Priority |
|------|---------|----------------|
| `src/config/env.ts` | Environment variable validation | Critical |
| `src/index.ts` | Express middleware configuration (helmet, CORS) | High |
| `.gitignore` | Secrets exclusion patterns | Critical |
| `.env.example` | Environment variable documentation | Medium |

---

## Audit Criteria by Checklist Item

### 1. JWT Token Security [Critical]

**Files to audit:** `src/auth/session.ts`, `src/admin/auth.ts`

**Current implementation (verified):**
```typescript
// src/auth/session.ts
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,                    // PASS: Prevents XSS access
  secure: env.NODE_ENV === 'production',  // PASS: HTTPS only in prod
  sameSite: 'strict' as const,       // PASS: CSRF protection
  path: '/auth/refresh',             // PASS: Scoped to refresh endpoint
  maxAge: 30 * 24 * 60 * 60,         // 30 days
};

// Access token: 15 minutes
.setExpirationTime('15m')

// Refresh token: 7 or 30 days based on rememberMe
.setExpirationTime(rememberMe ? '30d' : '7d')
```

**Pass criteria:**
- [x] httpOnly: true on refresh cookies
- [x] secure: true in production
- [x] sameSite: 'strict' or 'lax'
- [x] Access token expiry <= 15 minutes
- [x] Refresh token expiry <= 30 days
- [x] Token uses HS256 algorithm
- [x] JWT_SECRET minimum 32 characters (validated in env.ts)

**Fail criteria:**
- [ ] Tokens stored in localStorage (access token IS in localStorage - acceptable for short-lived access tokens)
- [ ] httpOnly: false on refresh tokens
- [ ] No expiration set
- [ ] Weak algorithm (none, HS1)

**Verification commands:**
```bash
# Check cookie configuration
grep -n "httpOnly" src/auth/session.ts src/admin/auth.ts
grep -n "secure" src/auth/session.ts src/admin/auth.ts
grep -n "sameSite" src/auth/session.ts src/admin/auth.ts

# Check expiration times
grep -n "setExpirationTime" src/auth/session.ts src/admin/auth.ts src/auth/magic-link.ts
```

---

### 2. Password Hashing [Critical]

**Files to audit:** `src/lib/password.ts`

**Current implementation (verified):**
```typescript
// OWASP 2025 recommended parameters for Argon2id
const ARGON2_OPTIONS = {
  type: argon2.argon2id,    // PASS: Most secure variant
  memoryCost: 19456,        // PASS: 19 MiB (OWASP minimum)
  timeCost: 2,              // PASS: 2 iterations (OWASP minimum)
  parallelism: 1,           // PASS: Single thread
};
```

**Pass criteria:**
- [x] Uses Argon2id (not bcrypt, sha256, md5)
- [x] memoryCost >= 19456 (19 MiB)
- [x] timeCost >= 2
- [x] parallelism = 1

**Fail criteria:**
- [ ] Uses bcrypt, scrypt, sha256, md5
- [ ] Uses Argon2i or Argon2d instead of Argon2id
- [ ] memoryCost < 19456
- [ ] timeCost < 2

**OWASP 2025 Reference:** https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

---

### 3. CSRF Protection [High]

**Files to audit:** `src/routes/auth.ts`, `src/routes/claim.ts`, `src/routes/team-claim.ts`

**Current implementation (verified):**
```typescript
// src/routes/auth.ts - Discord OAuth
const OAUTH_STATE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60, // 10 minutes
};

// State generation
const state = randomUUID();

// State validation
if (!state || state !== storedState) {
  res.redirect('/auth/error?reason=invalid_state');
  return;
}
```

**Pass criteria:**
- [x] State cookie on OAuth initiation
- [x] State validated on OAuth callback
- [x] State cookie httpOnly
- [x] State cookie expires (10 min)
- [x] Uses cryptographic randomness (randomUUID)
- [ ] Form submissions use CSRF tokens (N/A - no traditional forms, API-based)

**OAuth flows to verify:**
1. `/auth/discord` -> `/auth/callback` - PASS
2. `/claim/discord` -> `/claim/callback` - PASS
3. `/team/claim` -> `/team/claim/callback` - PASS

---

### 4. XSS Prevention [High]

**Files to audit:** `src/index.ts` (helmet CSP), static HTML files

**Current implementation (verified):**
```typescript
// src/index.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
      scriptSrcAttr: ["'unsafe-inline'"], // onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
```

**Pass criteria:**
- [x] Helmet middleware enabled
- [x] CSP headers configured
- [x] No `eval()` or `new Function()` in code
- [ ] No `unsafe-inline` for scripts (FAIL - currently allows inline scripts)
- [x] User input not rendered with innerHTML without sanitization

**Note:** `'unsafe-inline'` for scripts is allowed per Phase 9 decisions for static HTML simplicity. This is acceptable for the current architecture but should be documented as a known tradeoff.

**Verification commands:**
```bash
# Check for innerHTML usage
grep -rn "innerHTML" public/
grep -rn "outerHTML" public/

# Check for eval
grep -rn "eval(" src/
```

---

### 5. SQL Injection Prevention [High]

**Files to audit:** All Prisma queries

**Current implementation:**
- Uses Prisma ORM with parameterized queries
- No raw SQL queries found

**Pass criteria:**
- [x] All database queries use Prisma ORM
- [x] No `$queryRaw` or `$executeRaw` with string interpolation
- [x] User input not concatenated into queries

**Verification commands:**
```bash
# Check for raw queries
grep -rn "\$queryRaw" src/
grep -rn "\$executeRaw" src/
grep -rn "prisma.\$" src/
```

---

### 6. Rate Limiting [High] - MISSING

**Files to audit:** `src/routes/auth.ts`, `src/routes/admin/auth.ts`

**Current implementation:** NONE

**FAIL:** No rate limiting middleware found on:
- `/auth/login` - Brute force vulnerable
- `/auth/signup` - Account enumeration/spam
- `/auth/magic-link/request` - Email bombing
- `/admin/auth/login` - Admin brute force vulnerable
- `/auth/refresh` - Token exhaustion

**Required implementation:**
```typescript
// Example using express-rate-limit
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth/login', authLimiter);
app.use('/auth/signup', authLimiter);
app.use('/admin/auth/login', authLimiter);
```

**Pass criteria:**
- [ ] Rate limiter on /auth/login
- [ ] Rate limiter on /auth/signup
- [ ] Rate limiter on /auth/magic-link/request
- [ ] Rate limiter on /admin/auth/login
- [ ] Rate limiter returns 429 status

---

### 7. Stripe Webhook Signature [Critical]

**Files to audit:** `src/webhooks/stripe.ts`

**Current implementation (verified):**
```typescript
// Step 1: Verify signature
try {
  event = stripe.webhooks.constructEvent(
    req.body,           // Raw body
    signature,          // stripe-signature header
    env.STRIPE_WEBHOOK_SECRET
  );
} catch (err) {
  return res.status(400).json({ error: `Webhook signature verification failed` });
}
```

**Pass criteria:**
- [x] `stripe.webhooks.constructEvent` called
- [x] Uses `req.body` (raw body, not parsed JSON)
- [x] Uses `env.STRIPE_WEBHOOK_SECRET` from env
- [x] Returns 400 on signature failure
- [x] Raw body parser used (`raw({ type: 'application/json' })`)
- [x] Webhook route mounted BEFORE `express.json()` middleware

**Verification:**
```typescript
// src/index.ts - correct order
app.use('/webhooks/stripe', stripeWebhookRouter);  // BEFORE json parser
app.use(express.json());                            // AFTER webhook route
```

---

### 8. CORS Configuration [Medium] - NEEDS REVIEW

**Files to audit:** `src/index.ts`

**Current implementation:**
```typescript
app.use(cors());  // No configuration - allows all origins
```

**CONCERN:** Open CORS allows any origin to make requests. Should restrict in production.

**Pass criteria:**
- [ ] CORS restricts to known origins in production
- [x] CORS allows localhost in development

**Recommended fix:**
```typescript
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? [env.APP_URL]  // Only allow app origin
    : true,          // Allow all in development
  credentials: true,
}));
```

---

### 9. Secrets Management [Critical]

**Files to audit:** `.gitignore`, all `.ts` files

**Current implementation (verified):**
```
# .gitignore
.env
.env.local
.env.*.local
```

**Pass criteria:**
- [x] `.env` in `.gitignore`
- [x] No hardcoded secrets in source code (verified by grep)
- [x] Environment variables validated at startup (env.ts)
- [x] JWT_SECRET minimum length enforced (32 chars)
- [ ] `.env.example` documents all required variables (INCOMPLETE)

**Secrets locations verified:**
- STRIPE_SECRET_KEY: env only
- STRIPE_WEBHOOK_SECRET: env only
- JWT_SECRET: env only
- DISCORD_CLIENT_SECRET: env only
- DISCORD_BOT_TOKEN: env only
- DATABASE_URL: env only

**Git verification:**
```bash
git ls-files --cached | grep -E "\.env|secret|credential|password"
# Output: .env.example (expected), src/lib/password.ts (file name, not secret)
```

**.env.example gaps:** Missing several required env vars:
- DISCORD_REDIRECT_URI
- DISCORD_INVITE_URL
- DISCORD_INTRODUCTIONS_CHANNEL_ID
- STRIPE_INDIVIDUAL_PRICE_ID
- STRIPE_OWNER_SEAT_PRICE_ID
- STRIPE_TEAM_SEAT_PRICE_ID
- EMAIL_PROVIDER
- RESEND_API_KEY
- APP_URL

---

### 10. Session Management [High]

**Files to audit:** `src/auth/session.ts`, `src/routes/auth.ts`

**Current implementation (verified):**
```typescript
// Token rotation on refresh
authRouter.post('/refresh', async (req, res) => {
  // ... verify old token
  const accessToken = await createAccessToken(member.id);
  const newRefreshToken = await createRefreshToken(member.id, true);
  // New refresh token issued each time
});

// Logout clears cookie
authRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie',
    serializeCookie(REFRESH_COOKIE_NAME, '', { ...OPTIONS, maxAge: 0 })
  );
});
```

**Pass criteria:**
- [x] Token rotation on every refresh
- [x] Logout clears refresh cookie
- [x] Refresh token different from access token (type: 'refresh')
- [x] Cannot use refresh token as access token (validated in middleware)
- [ ] Token revocation list (not implemented - acceptable for this scale)

---

### 11. Authorization Checks [Critical]

**Files to audit:** All protected routes

**Admin route protection verified:**
```typescript
// src/routes/admin/members.ts
adminMembersRouter.get('/', requireAdmin, async (req, res) => { ... });

// src/routes/admin/admins.ts
adminAdminsRouter.use(requireAdmin, requireSuperAdmin);
```

**User isolation verified:**
```typescript
// src/routes/dashboard.ts - only returns own data
const member = await prisma.member.findUnique({
  where: { id: req.memberId },  // From verified token
});

// src/routes/team-dashboard.ts - team owner check
if (member.seatTier !== 'OWNER') {
  res.status(403).json({ error: 'Only team owners can access the dashboard' });
  return;
}

// Cannot access other team's data
if (targetMember.teamId !== requester.teamId) {
  res.status(403).json({ error: 'Cannot revoke member from another team' });
  return;
}
```

**Pass criteria:**
- [x] All `/api/admin/*` routes use requireAdmin middleware
- [x] Admin management routes use requireSuperAdmin
- [x] User can only access own data
- [x] Team owners can only manage own team
- [x] Primary owner cannot be revoked
- [x] Cannot revoke self

---

### 12. Input Validation [High]

**Files to audit:** All route files with request bodies

**Zod validation usage:**

| Route | Schema | Validated Fields |
|-------|--------|------------------|
| POST /auth/signup | signupSchema | email, password (8-128 chars) |
| POST /auth/login | loginSchema | email, password |
| POST /admin/auth/login | loginSchema | email, password |
| POST /company/checkout | companyCheckoutSchema | ownerSeats (int >=1), teamSeats (int >=0), companyName (3-100) |
| POST /team/seats | addSeatsSchema | seatType (enum), quantity (1-50) |
| POST /team/invites | createInviteSchema | seatTier (enum), email (optional) |
| GET /api/admin/members | listQuerySchema | cursor, limit (1-100), filters |
| POST /api/admin/members/:id/grant-role | grantRoleSchema | role (enum), reason (10+ chars) |

**Pass criteria:**
- [x] Request bodies validated before processing
- [x] Email format validated
- [x] Password minimum length (8 chars)
- [x] Enum values validated for known options
- [x] Number bounds enforced (min/max)

**Potential gaps:**
- Magic link request only checks `typeof email === 'string'` (should use Zod)
- Some query parameters not validated

---

### 13. Dependency Vulnerabilities [Medium]

**Verification command:**
```bash
npm audit
```

**Current status:** Run during audit, no output (likely no vulnerabilities or audit failed)

**Pass criteria:**
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities
- [ ] Medium vulnerabilities documented

---

### 14. Admin Privilege Escalation [Critical]

**Files to audit:** `src/routes/admin/admins.ts`

**Current implementation (verified):**
```typescript
// Only super admins can manage other admins
adminAdminsRouter.use(requireAdmin, requireSuperAdmin);

// Self-demotion blocked if only super admin
if (id === currentAdmin.id && newRole === 'ADMIN') {
  const superAdminCount = await prisma.admin.count({
    where: { role: 'SUPER_ADMIN' },
  });
  if (superAdminCount === 1) {
    res.status(400).json({ error: 'Cannot demote the only super admin' });
    return;
  }
}

// Self-deletion blocked
if (id === currentAdmin.id) {
  res.status(400).json({ error: 'Cannot delete your own account' });
  return;
}
```

**Pass criteria:**
- [x] Admin cannot create other admins (only super admin)
- [x] Admin cannot change roles (only super admin)
- [x] Cannot demote only super admin
- [x] Cannot delete own account
- [x] Admin token includes isAdmin: true flag
- [x] Regular member tokens cannot access admin routes

---

## Security Concerns Identified

### Critical

1. **No rate limiting on auth endpoints** - Brute force attacks possible
   - Location: All `/auth/*` and `/admin/auth/*` routes
   - Impact: Account takeover via brute force
   - Fix: Add express-rate-limit middleware

### High

2. **Debug console.log in admin middleware**
   - Location: `src/admin/middleware.ts` lines 24, 27, 33, 37, 41
   - Impact: Token fragments logged, security information disclosure
   - Fix: Remove console.log or use logger with appropriate level

3. **CORS allows all origins**
   - Location: `src/index.ts` line 58
   - Impact: Any site can make authenticated requests
   - Fix: Restrict to APP_URL in production

### Medium

4. **.env.example incomplete**
   - Missing many required environment variables
   - Impact: Deployment confusion, potential misconfigurations
   - Fix: Document all required variables

5. **CSP allows unsafe-inline scripts**
   - Already documented as intentional tradeoff
   - Impact: Reduced XSS protection
   - Mitigation: Static HTML files are controlled

---

## Recommended Audit Order

1. **Critical - Authentication/Authorization** (blocks deployment)
   - JWT token security
   - Password hashing
   - Admin route protection
   - Stripe webhook signature

2. **Critical - Missing Controls** (security gaps)
   - Rate limiting (ADD)
   - Remove debug logging

3. **High - Input/Output** (data integrity)
   - CSRF protection
   - Input validation coverage
   - XSS via user content

4. **High - Configuration**
   - CORS restriction
   - Session management
   - Secrets management

5. **Medium - Maintenance**
   - Dependency vulnerabilities
   - Documentation gaps

---

## Verification Tools

### Automated Checks

```bash
# Run npm audit for dependencies
npm audit

# Search for hardcoded secrets
grep -rn "sk_live\|whsec_\|sk_test" src/
grep -rn "password.*=.*['\"]" src/

# Check for console.log in production code
grep -rn "console\.log" src/

# Find missing rate limiting
grep -rn "rateLimit\|rate-limit" src/

# Verify Zod usage on routes
grep -rn "safeParse\|\.parse" src/routes/
```

### Manual Verification Checklist

- [ ] Attempt login brute force (should be limited)
- [ ] Test expired tokens rejected
- [ ] Test admin token on member routes (should fail)
- [ ] Test member token on admin routes (should fail)
- [ ] Verify webhook rejects invalid signatures
- [ ] Check team member cannot access other team data
- [ ] Verify HTTPS enforced in production

---

## Sources

### Primary (HIGH confidence)
- Direct code analysis of src/auth/*, src/admin/*, src/routes/*
- Prisma schema review (prisma/schema.prisma)
- Package.json dependency analysis

### Standards Referenced
- OWASP Password Storage Cheat Sheet (Argon2id parameters)
- OWASP Session Management Cheat Sheet (token rotation)
- Stripe Webhook Security Documentation

---

## Metadata

**Confidence breakdown:**
- JWT Security: HIGH - direct code verification
- Password Hashing: HIGH - OWASP params verified
- CSRF Protection: HIGH - all OAuth flows checked
- Rate Limiting: HIGH - confirmed missing
- Authorization: HIGH - all admin routes verified

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (security patterns stable)
