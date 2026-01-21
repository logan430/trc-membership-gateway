# API Reference

The Revenue Council Membership Gateway API documentation.

**Base URL:** `http://localhost:3000` (development) or your production domain

**Version:** 1.0.0

---

## Table of Contents

- [Authentication](#authentication)
- [Error Response Format](#error-response-format)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Authentication Routes](#authentication-routes-auth)
  - [Checkout Routes](#checkout-routes-checkout)
  - [Billing Routes](#billing-routes-billing)
  - [Company Routes](#company-routes-company)
  - [Dashboard Routes](#dashboard-routes-dashboard)
  - [Claim Routes](#claim-routes-claim)
  - [Team Routes](#team-routes-team)
  - [Admin Auth Routes](#admin-auth-routes-adminauth)
  - [Admin API Routes](#admin-api-routes-apiadmin)
  - [Webhook Routes](#webhook-routes-webhooks)
  - [Health Routes](#health-routes)

---

## Authentication

The API uses three authentication methods depending on the endpoint:

### 1. JWT Bearer Token (Most Endpoints)

Used for authenticated member and admin API calls.

**How to obtain:**
- `POST /auth/signup` - Create new account
- `POST /auth/login` - Login with email/password
- `GET /auth/magic-link/verify` - Magic link authentication

**How to use:**
```
Authorization: Bearer <access_token>
```

**Token details:**
- **Access token expiry:** 15 minutes
- **Refresh token expiry:** 7 days (standard) or 30 days (remember me / admin)

**Token refresh:**
Call `POST /auth/refresh` with the refresh token cookie to get a new access token.

### 2. Refresh Token Cookie (Token Renewal)

Used for session continuity without re-authentication.

**Automatically set by:**
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/magic-link/verify`
- `GET /auth/callback` (Discord OAuth)

**Cookie details:**
- **Cookie name:** `refreshToken` (member) or `adminRefreshToken` (admin)
- **Attributes:** httpOnly, secure (in production), sameSite: lax
- **Path:** `/auth/refresh` (member) or `/admin/auth/refresh` (admin)

**Renewal endpoint:** `POST /auth/refresh` or `POST /admin/auth/refresh`

### 3. Stripe Webhook Signature (Webhooks Only)

Used to verify webhook requests originate from Stripe.

**Header:** `stripe-signature`

**Verification:** The signature is verified against `STRIPE_WEBHOOK_SECRET` using Stripe's SDK.

**Note:** Webhook endpoint uses raw body parser (not JSON) to preserve signature integrity.

---

## Error Response Format

All error responses follow this structure:

```json
{
  "error": "Error message here"
}
```

For validation errors with details:

```json
{
  "error": "Invalid request",
  "details": [
    {
      "code": "too_small",
      "minimum": 8,
      "path": ["password"],
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

### Common Status Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created successfully |
| 204 | No Content | Successful deletion (no response body) |
| 400 | Bad Request | Validation error, invalid input |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |
| 503 | Service Unavailable | Discord bot offline |

---

## Rate Limiting

Rate limiting is applied to authentication endpoints to prevent brute force attacks:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/login` | 5 requests | 15 minutes |
| `POST /auth/signup` | 5 requests | 15 minutes |
| `POST /auth/magic-link/request` | 5 requests | 15 minutes |
| `POST /admin/auth/login` | 5 requests | 15 minutes |

**Rate limit exceeded response:**
```json
{
  "error": "Too many requests, please try again later"
}
```

Other endpoints do not have rate limiting.

---

## Endpoints

### Authentication Routes (`/auth/*`)

#### POST /auth/signup

Create a new member account with email and password.

**Authentication:** None

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email address |
| password | string | Yes | Password (8-128 characters) |

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

**Also sets:** `refreshToken` cookie

**Errors:**
- 400: Invalid email format or password too short/long
- 429: Rate limit exceeded

**Note:** Returns success even if email exists (anti-enumeration). Existing users receive tokens as if they logged in.

---

#### POST /auth/login

Authenticate with email and password.

**Authentication:** None

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |
| password | string | Yes | User password |

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

**Also sets:** `refreshToken` cookie

**Errors:**
- 400: Invalid email format or missing password
- 401: Invalid credentials
- 429: Rate limit exceeded

---

#### POST /auth/refresh

Exchange refresh token for new access token. Implements token rotation (new refresh token issued each time).

**Authentication:** Refresh token cookie

**Request Body:** None (uses cookie)

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

**Also sets:** New `refreshToken` cookie (rotation)

**Errors:**
- 401: No refresh token or invalid/expired token

---

#### POST /auth/logout

Clear the session by expiring the refresh token cookie.

**Authentication:** None

**Request Body:** None

**Response (200):**

```json
{
  "success": true
}
```

---

#### POST /auth/magic-link/request

Request a magic link for passwordless login.

**Authentication:** None

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |

**Response (200):**

```json
{
  "success": true,
  "message": "If an account exists, a magic link has been sent"
}
```

**Errors:**
- 400: Email is required
- 429: Rate limit exceeded

**Note:** Always returns success (anti-enumeration). Magic link is sent via email if account exists.

---

#### GET /auth/magic-link/verify

Verify magic link token and create session. Redirects to dashboard on success.

**Authentication:** None

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | Magic link token |

**Response (302):** Redirect to `/dashboard#token={accessToken}`

**Errors:**
- 400: Token is required
- 401: Invalid or expired magic link
- 401: Member not found

---

#### GET /auth/discord

Initiate Discord OAuth2 authorization flow.

**Authentication:** None

**Query Parameters:** None

**Response (302):** Redirect to Discord authorization URL

**Also sets:** `oauth_state` cookie (CSRF protection, 10-minute expiry)

---

#### GET /auth/callback

Handle Discord OAuth2 callback. Validates state, exchanges code, creates member, creates session.

**Authentication:** `oauth_state` cookie

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| code | string | OAuth authorization code |
| state | string | CSRF state parameter |

**Response (302):** Redirect to `/dashboard#token={accessToken}`

**Error Redirects:**
- `/auth/error?reason=invalid_state` - CSRF validation failed
- `/auth/error?reason=no_code` - Missing authorization code
- `/auth/error?reason=discord_already_linked` - Discord account linked to another member
- `/auth/error?reason=oauth_failed` - OAuth exchange failed

---

#### GET /auth/error

Display OAuth error information.

**Authentication:** None

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| reason | string | Error reason code |

**Response (400):**

```json
{
  "error": "invalid_state"
}
```

---

### Checkout Routes (`/checkout/*`)

#### POST /checkout

Create a Stripe Checkout session for individual subscription.

**Authentication:** JWT Bearer Token

**Request Body:** None

**Response (200):**

```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_..."
}
```

**Errors:**
- 400: Account not configured for payment (no Stripe customer ID)
- 400: Already subscribed
- 401: Unauthorized

---

### Billing Routes (`/billing/*`)

#### POST /billing/portal

Create a Stripe billing portal session for managing subscription.

**Authentication:** JWT Bearer Token

**Request Body:** None

**Response (200):**

```json
{
  "portalUrl": "https://billing.stripe.com/p/session/..."
}
```

**Errors:**
- 400: No billing account configured
- 401: Unauthorized
- 404: Member not found
- 500: Failed to create billing portal session

**Note:** Team members use their team's Stripe customer ID; individuals use their own.

---

### Company Routes (`/company/*`)

#### POST /company/checkout

Create a team subscription checkout session.

**Authentication:** JWT Bearer Token

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyName | string | Yes | Company name (3-100 characters) |
| ownerSeats | number | Yes | Number of owner seats (minimum 1) |
| teamSeats | number | Yes | Number of team seats (minimum 0) |

**Response (200):**

```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_..."
}
```

**Errors:**
- 400: Invalid request body (validation errors)
- 400: Account not configured for payment
- 400: Already have an active subscription
- 400: Already a member of a team
- 401: Unauthorized
- 500: Company checkout not configured (missing price IDs)

---

### Dashboard Routes (`/dashboard/*`)

#### GET /dashboard

Get current user's subscription status and claim availability.

**Authentication:** JWT Bearer Token

**Request Body:** None

**Response (200):**

```json
{
  "member": {
    "id": "clxyz123...",
    "email": "user@example.com",
    "subscriptionStatus": "ACTIVE",
    "seatTier": "INDIVIDUAL",
    "currentPeriodEnd": "2026-02-21T00:00:00.000Z",
    "discordUsername": "user#1234",
    "introCompleted": true
  },
  "claim": {
    "canClaim": false,
    "hasClaimed": true,
    "discordInviteUrl": "https://discord.gg/invite"
  }
}
```

**Subscription Status Values:**
- `NONE` - No subscription
- `TRIALING` - Trial period
- `ACTIVE` - Active subscription
- `PAST_DUE` - Payment failed, in grace period
- `CANCELLED` - Subscription ended

**Seat Tier Values:**
- `INDIVIDUAL` - Individual subscriber
- `OWNER` - Team owner
- `TEAM_MEMBER` - Team member

**Errors:**
- 401: Unauthorized
- 404: Member not found

---

### Claim Routes (`/claim/*`)

#### GET /claim/discord

Initiate Discord OAuth for claiming Discord access (for paid subscribers).

**Authentication:** JWT Bearer Token

**Request Body:** None

**Response (302):** Redirect to Discord authorization URL

**Also sets:**
- `claim_state` cookie (CSRF protection)
- `claim_member` cookie (member ID for callback)

**Errors:**
- 400: Discord already linked (includes `discordInviteUrl` in response)
- 401: Unauthorized
- 403: Active subscription required to claim Discord access

---

#### GET /claim/callback

Handle Discord OAuth callback for claim flow.

**Authentication:** `claim_state` and `claim_member` cookies

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| code | string | OAuth authorization code |
| state | string | CSRF state parameter |

**Response (302):** Redirect to Discord invite URL on success

**Error Redirects:**
- `/dashboard?claim=error&reason=invalid_state` - CSRF validation failed
- `/dashboard?claim=error&reason=session_expired` - Missing member cookie
- `/dashboard?claim=error&reason=no_code` - Missing authorization code
- `/dashboard?claim=error&reason=discord_already_linked` - Discord linked to another account
- `/dashboard?claim=error&reason=oauth_failed` - OAuth exchange failed

---

### Team Routes (`/team/*`)

#### GET /team/dashboard

Get team seat allocation data. Only accessible by team owners.

**Authentication:** JWT Bearer Token

**Request Body:** None

**Response (200):**

```json
{
  "team": {
    "id": "clxyz123...",
    "name": "Acme Corp",
    "subscriptionStatus": "ACTIVE",
    "paymentFailedAt": null
  },
  "seats": {
    "owner": { "claimed": 2, "total": 3 },
    "team": { "claimed": 5, "total": 10 }
  },
  "members": {
    "owners": [
      {
        "id": "clxyz123...",
        "name": "user#1234",
        "email": "user@example.com",
        "status": "claimed",
        "introCompleted": true,
        "isPrimaryOwner": true
      }
    ],
    "team": [
      {
        "id": "clxyz456...",
        "name": "teammate#5678",
        "email": null,
        "status": "claimed",
        "introCompleted": false
      }
    ]
  },
  "currentUser": {
    "id": "clxyz123...",
    "isPrimaryOwner": true
  }
}
```

**Errors:**
- 401: Unauthorized
- 403: Only team owners can access the dashboard
- 404: Not part of a team
- 404: Member not found

---

#### DELETE /team/members/:memberId

Revoke a team member's seat.

**Authentication:** JWT Bearer Token

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| memberId | string | ID of member to revoke |

**Request Body:** None

**Response (200):**

```json
{
  "success": true,
  "message": "Seat revoked successfully"
}
```

**Errors:**
- 400: Cannot revoke your own seat
- 401: Unauthorized
- 403: Only team owners can revoke seats
- 403: Cannot revoke member from another team
- 403: Primary owner cannot be revoked by other team members
- 404: Not part of a team
- 404: Member not found

---

#### POST /team/seats

Add additional seats mid-subscription with immediate prorated charge.

**Authentication:** JWT Bearer Token

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| seatType | string | Yes | `"owner"` or `"team"` |
| quantity | number | Yes | Number of seats to add (1-50) |

**Response (200):**

```json
{
  "success": true,
  "seatType": "team",
  "previousQuantity": 5,
  "newQuantity": 8,
  "addedQuantity": 3
}
```

**Errors:**
- 400: Invalid request (validation errors)
- 400: No active subscription
- 400: No seat item on subscription for specified type
- 401: Unauthorized
- 403: Only team owners can add seats
- 404: Not part of a team
- 500: Seat pricing not configured
- 500: Failed to add seats

---

#### POST /team/invites

Create a new invite token for a team seat.

**Authentication:** JWT Bearer Token

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| seatTier | string | Yes | `"OWNER"` or `"TEAM_MEMBER"` |
| email | string | No | Email to send invite to |

**Response (201):**

```json
{
  "invite": {
    "id": "clxyz123...",
    "seatTier": "TEAM_MEMBER",
    "token": "abc123...",
    "inviteUrl": "https://example.com/team/claim?token=abc123...",
    "inviteeEmail": "invitee@example.com",
    "emailSent": true,
    "createdAt": "2026-01-21T00:00:00.000Z"
  }
}
```

**Errors:**
- 400: Invalid request body
- 400: You are not part of a team
- 400: No seats available (includes claimed/total counts)
- 401: Unauthorized
- 403: Only team owners can create invites
- 404: Member not found
- 404: Team not found

---

#### GET /team/invites

List all pending invites for the team.

**Authentication:** JWT Bearer Token

**Request Body:** None

**Response (200):**

```json
{
  "invites": [
    {
      "id": "clxyz123...",
      "seatTier": "TEAM_MEMBER",
      "inviteUrl": "https://example.com/team/claim?token=abc123...",
      "inviteeEmail": "invitee@example.com",
      "createdAt": "2026-01-21T00:00:00.000Z",
      "acceptedAt": null,
      "acceptedBy": null
    }
  ]
}
```

**Errors:**
- 400: You are not part of a team
- 401: Unauthorized
- 403: Only team owners can view invites
- 404: Member not found

---

#### DELETE /team/invites/:inviteId

Revoke (delete) a pending invite.

**Authentication:** JWT Bearer Token

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| inviteId | string | ID of invite to revoke |

**Response (204):** No content

**Errors:**
- 400: You are not part of a team
- 401: Unauthorized
- 403: Only team owners can revoke invites
- 403: Invite does not belong to your team
- 404: Member not found
- 404: Invite not found

---

#### GET /team/claim/info

Get invite information for landing page display. Used before claiming.

**Authentication:** None

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | Invite token |

**Response (200):**

```json
{
  "teamName": "Acme Corp",
  "seatTier": "TEAM_MEMBER",
  "seatsAvailable": true
}
```

**Errors:**
- 400: Missing token
- 404: Invalid invite

---

#### GET /team/claim

Initiate team seat claim flow. Validates token and redirects to Discord OAuth.

**Authentication:** None

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | Invite token |

**Response (302):** Redirect to Discord authorization URL

**Also sets:**
- `team_claim_state` cookie (CSRF protection)
- `team_claim_token` cookie (invite token)

**Error Redirects:**
- `/?error=missing_token` - No token provided
- `/?error=invalid_token` - Token not found
- `/?error=no_seats_available` - No seats remaining

---

#### GET /team/claim/callback

Handle Discord OAuth callback for team seat claim.

**Authentication:** `team_claim_state` and `team_claim_token` cookies

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| code | string | OAuth authorization code |
| state | string | CSRF state parameter |

**Response (302):** Redirect to Discord invite URL on success

**Error Redirects:**
- `/?error=invalid_state` - CSRF validation failed
- `/?error=session_expired` - Missing token cookie
- `/?error=no_code` - Missing authorization code
- `/?error=invalid_token` - Token not found
- `/?error=already_subscribed` - User has individual subscription
- `/?error=already_in_team` - User already in different team
- `/?error=no_seats_available` - Race condition, seat taken
- `/?error=team_not_found` - Team deleted
- `/?error=claim_failed` - OAuth exchange failed

---

### Admin Auth Routes (`/admin/auth/*`)

#### POST /admin/auth/login

Authenticate admin with email and password.

**Authentication:** None

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Admin email |
| password | string | Yes | Admin password |

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "admin": {
    "id": "clxyz123...",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN"
  }
}
```

**Also sets:** `adminRefreshToken` cookie

**Errors:**
- 400: Invalid request (validation errors)
- 401: Invalid credentials
- 429: Rate limit exceeded

---

#### POST /admin/auth/refresh

Exchange admin refresh token for new tokens.

**Authentication:** `adminRefreshToken` cookie

**Request Body:** None

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "admin": {
    "id": "clxyz123...",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN"
  }
}
```

**Also sets:** New `adminRefreshToken` cookie (rotation)

**Errors:**
- 401: No refresh token or invalid/expired token
- 401: Admin not found (deleted)

---

#### POST /admin/auth/logout

Clear admin session by expiring refresh token cookie.

**Authentication:** None

**Request Body:** None

**Response (200):**

```json
{
  "success": true
}
```

---

### Admin API Routes (`/api/admin/*`)

All admin API routes require JWT Bearer Token authentication with an admin token.

Admin roles:
- `ADMIN` - Can view data and perform member actions
- `SUPER_ADMIN` - Full access including config and admin management

#### GET /api/admin/members

List all members with pagination, search, and filtering.

**Authentication:** JWT Bearer Token (Admin)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| cursor | string | Pagination cursor (member ID) |
| limit | number | Results per page (1-100, default 50) |
| search | string | Search by email or Discord username |
| subscriptionStatus | string | Filter: NONE, TRIALING, ACTIVE, PAST_DUE, CANCELLED |
| seatTier | string | Filter: INDIVIDUAL, OWNER, TEAM_MEMBER |
| hasDiscord | string | Filter: "true" or "false" |
| introCompleted | string | Filter: "true" or "false" |

**Response (200):**

```json
{
  "members": [
    {
      "id": "clxyz123...",
      "email": "user@example.com",
      "discordId": "123456789",
      "discordUsername": "user#1234",
      "subscriptionStatus": "ACTIVE",
      "seatTier": "INDIVIDUAL",
      "introCompleted": true,
      "createdAt": "2026-01-21T00:00:00.000Z",
      "teamId": null
    }
  ],
  "nextCursor": "clxyz456...",
  "hasMore": true,
  "total": 150
}
```

**Errors:**
- 400: Invalid query parameters
- 401: Unauthorized

---

#### GET /api/admin/members/:id

Get detailed member info including team and audit history.

**Authentication:** JWT Bearer Token (Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Member ID |

**Response (200):**

```json
{
  "member": {
    "id": "clxyz123...",
    "email": "user@example.com",
    "discordId": "123456789",
    "discordUsername": "user#1234",
    "discordAvatar": "abc123...",
    "stripeCustomerId": "cus_...",
    "subscriptionStatus": "ACTIVE",
    "seatTier": "INDIVIDUAL",
    "currentPeriodEnd": "2026-02-21T00:00:00.000Z",
    "introCompleted": true,
    "isPrimaryOwner": false,
    "isTeamAdmin": false,
    "teamId": null,
    "createdAt": "2026-01-21T00:00:00.000Z",
    "updatedAt": "2026-01-21T00:00:00.000Z"
  },
  "team": null,
  "auditLogs": [
    {
      "id": "clxyz...",
      "action": "MEMBER_CREATED",
      "entityType": "Member",
      "entityId": "clxyz123...",
      "details": {},
      "performedBy": null,
      "reason": null,
      "createdAt": "2026-01-21T00:00:00.000Z"
    }
  ]
}
```

**Errors:**
- 401: Unauthorized
- 404: Member not found

---

#### POST /api/admin/members/:id/revoke-access

Remove Discord roles from member (does not kick from server).

**Authentication:** JWT Bearer Token (Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Member ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reason | string | Yes | Reason for action (min 10 chars) |

**Response (200):**

```json
{
  "success": true,
  "message": "Discord access revoked"
}
```

**Errors:**
- 400: Invalid request (reason too short)
- 400: Member has no Discord linked
- 401: Unauthorized
- 404: Member not found
- 500: Failed to remove Discord roles
- 503: Discord bot is not connected

---

#### POST /api/admin/members/:id/reset-claim

Unlink Discord account from member (keeps subscription, resets intro progress).

**Authentication:** JWT Bearer Token (Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Member ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reason | string | Yes | Reason for action (min 10 chars) |

**Response (200):**

```json
{
  "success": true,
  "message": "Discord claim reset"
}
```

**Errors:**
- 400: Invalid request (reason too short)
- 400: Member has no Discord linked
- 401: Unauthorized
- 404: Member not found
- 503: Discord bot is not connected

---

#### POST /api/admin/members/:id/grant-role

Assign a specific Discord role directly, bypassing normal flow.

**Authentication:** JWT Bearer Token (Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Member ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| role | string | Yes | Role name: Squire, Knight, Lord, or Debtor |
| reason | string | Yes | Reason for action (min 10 chars) |

**Response (200):**

```json
{
  "success": true,
  "message": "Granted Knight role"
}
```

**Errors:**
- 400: Invalid request (invalid role or reason too short)
- 400: Member has no Discord linked
- 401: Unauthorized
- 404: Member not found
- 500: Failed to assign Discord role
- 503: Discord bot is not connected

---

#### POST /api/admin/members/bulk-revoke

Revoke access for multiple members with rate limiting.

**Authentication:** JWT Bearer Token (Admin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| memberIds | string[] | Yes | Array of member IDs (1-50) |
| reason | string | Yes | Reason for action (min 10 chars) |

**Response (200):**

```json
{
  "success": true,
  "processed": 8,
  "failed": 2
}
```

**Errors:**
- 400: Invalid request (validation errors)
- 401: Unauthorized
- 503: Discord bot is not connected

---

#### GET /api/admin/config/feature-flags

List all feature flags.

**Authentication:** JWT Bearer Token (Admin)

**Response (200):**

```json
{
  "flags": [
    {
      "key": "intro_validation",
      "enabled": true,
      "description": "Require introductions before Knight role"
    }
  ]
}
```

**Errors:**
- 401: Unauthorized

---

#### PATCH /api/admin/config/feature-flags/:key

Toggle a feature flag.

**Authentication:** JWT Bearer Token (Super Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| key | string | Feature flag key |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| enabled | boolean | Yes | New enabled state |

**Response (200):**

```json
{
  "success": true,
  "flag": {
    "key": "intro_validation",
    "enabled": false
  }
}
```

**Errors:**
- 400: Invalid request
- 401: Unauthorized
- 403: Super admin required

---

#### POST /api/admin/config/feature-flags/seed

Seed default feature flags.

**Authentication:** JWT Bearer Token (Super Admin)

**Request Body:** None

**Response (200):**

```json
{
  "success": true,
  "message": "Default flags seeded"
}
```

**Errors:**
- 401: Unauthorized
- 403: Super admin required

---

#### GET /api/admin/config/discord-channels

View configured Discord channel IDs (read-only).

**Authentication:** JWT Bearer Token (Admin)

**Response (200):**

```json
{
  "channels": {
    "introductions": "123456789012345678",
    "billingSupport": "234567890123456789",
    "adminAlerts": "345678901234567890"
  },
  "note": "Channel IDs are configured via environment variables"
}
```

**Errors:**
- 401: Unauthorized

---

#### GET /api/admin/audit

List audit logs with filtering and pagination.

**Authentication:** JWT Bearer Token (Admin)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| cursor | string | Pagination cursor (log ID) |
| limit | number | Results per page (1-100, default 50) |
| action | string | Filter by action type |
| entityType | string | Filter by entity type |
| entityId | string | Filter by entity ID |
| performedBy | string | Filter by admin ID |
| startDate | date | Filter by start date |
| endDate | date | Filter by end date |

**Response (200):**

```json
{
  "logs": [
    {
      "id": "clxyz123...",
      "action": "MEMBER_ACCESS_REVOKED",
      "entityType": "Member",
      "entityId": "clxyz456...",
      "details": {
        "discordId": "123456789",
        "discordUsername": "user#1234"
      },
      "performedBy": "clxyz789...",
      "reason": "User requested account closure",
      "createdAt": "2026-01-21T00:00:00.000Z"
    }
  ],
  "nextCursor": "clxyz234...",
  "hasMore": true
}
```

**Errors:**
- 400: Invalid query parameters
- 401: Unauthorized

---

#### GET /api/admin/audit/actions

Get distinct action types for filter dropdown.

**Authentication:** JWT Bearer Token (Admin)

**Response (200):**

```json
{
  "actions": [
    "ADMIN_CREATED",
    "ADMIN_LOGIN",
    "MEMBER_ACCESS_REVOKED",
    "MEMBER_CLAIM_RESET"
  ]
}
```

**Errors:**
- 401: Unauthorized

---

#### GET /api/admin/audit/entity-types

Get distinct entity types for filter dropdown.

**Authentication:** JWT Bearer Token (Admin)

**Response (200):**

```json
{
  "entityTypes": [
    "Admin",
    "EmailTemplate",
    "FeatureFlag",
    "Member"
  ]
}
```

**Errors:**
- 401: Unauthorized

---

#### GET /api/admin/templates

List all email templates.

**Authentication:** JWT Bearer Token (Admin)

**Response (200):**

```json
{
  "templates": [
    {
      "name": "welcome",
      "subject": "Welcome to The Revenue Council",
      "body": "Hark! Thy payment hath been received...",
      "updatedBy": "clxyz123...",
      "createdAt": "2026-01-21T00:00:00.000Z",
      "updatedAt": "2026-01-21T00:00:00.000Z"
    }
  ]
}
```

**Errors:**
- 401: Unauthorized

---

#### GET /api/admin/templates/:name

Get a specific template by name.

**Authentication:** JWT Bearer Token (Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Template name |

**Response (200):**

```json
{
  "template": {
    "name": "welcome",
    "subject": "Welcome to The Revenue Council",
    "body": "Hark! Thy payment hath been received...",
    "updatedBy": "clxyz123...",
    "createdAt": "2026-01-21T00:00:00.000Z",
    "updatedAt": "2026-01-21T00:00:00.000Z"
  }
}
```

**Errors:**
- 401: Unauthorized
- 404: Template not found

---

#### PUT /api/admin/templates/:name

Update or create an email template.

**Authentication:** JWT Bearer Token (Super Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Template name |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subject | string | Yes | Email subject (1-200 chars) |
| body | string | Yes | Email body (1-10000 chars) |

**Response (200):**

```json
{
  "success": true,
  "template": {
    "name": "welcome",
    "subject": "Welcome to The Revenue Council",
    "body": "Hark! Thy payment hath been received...",
    "updatedBy": "clxyz123...",
    "createdAt": "2026-01-21T00:00:00.000Z",
    "updatedAt": "2026-01-21T00:00:00.000Z"
  }
}
```

**Errors:**
- 400: Invalid request (validation errors)
- 401: Unauthorized
- 403: Super admin required

---

#### POST /api/admin/templates/seed

Seed default email templates.

**Authentication:** JWT Bearer Token (Super Admin)

**Request Body:** None

**Response (200):**

```json
{
  "success": true,
  "created": 8
}
```

**Errors:**
- 401: Unauthorized
- 403: Super admin required

---

#### GET /api/admin/templates/:name/preview

Preview a template with sample data.

**Authentication:** JWT Bearer Token (Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Template name |

**Response (200):**

```json
{
  "preview": {
    "subject": "Welcome to The Revenue Council",
    "body": "Hark! Thy payment hath been received..."
  },
  "sampleData": {
    "claimUrl": "https://example.com/claim/abc123"
  }
}
```

**Errors:**
- 401: Unauthorized
- 404: Template not found

---

#### GET /api/admin/admins

List all admin accounts.

**Authentication:** JWT Bearer Token (Super Admin)

**Response (200):**

```json
{
  "admins": [
    {
      "id": "clxyz123...",
      "email": "admin@example.com",
      "role": "SUPER_ADMIN",
      "lastLoginAt": "2026-01-21T00:00:00.000Z",
      "createdAt": "2026-01-21T00:00:00.000Z",
      "createdBy": null
    }
  ]
}
```

**Errors:**
- 401: Unauthorized
- 403: Super admin required

---

#### GET /api/admin/admins/:id

Get admin details with audit log of actions performed.

**Authentication:** JWT Bearer Token (Super Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Admin ID |

**Response (200):**

```json
{
  "admin": {
    "id": "clxyz123...",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN",
    "lastLoginAt": "2026-01-21T00:00:00.000Z",
    "createdAt": "2026-01-21T00:00:00.000Z",
    "createdBy": null
  },
  "actionsPerformed": [
    {
      "id": "clxyz...",
      "action": "MEMBER_ACCESS_REVOKED",
      "entityType": "Member",
      "entityId": "clxyz456...",
      "details": {},
      "performedBy": "clxyz123...",
      "reason": "User requested account closure",
      "createdAt": "2026-01-21T00:00:00.000Z"
    }
  ]
}
```

**Errors:**
- 401: Unauthorized
- 403: Super admin required
- 404: Admin not found

---

#### POST /api/admin/admins

Create a new admin account.

**Authentication:** JWT Bearer Token (Super Admin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Admin email |
| password | string | Yes | Password (min 8 chars) |
| role | string | No | ADMIN or SUPER_ADMIN (default: ADMIN) |

**Response (201):**

```json
{
  "admin": {
    "id": "clxyz123...",
    "email": "newadmin@example.com",
    "role": "ADMIN"
  }
}
```

**Errors:**
- 400: Invalid request (validation errors)
- 400: Email already in use
- 401: Unauthorized
- 403: Super admin required

---

#### PATCH /api/admin/admins/:id/role

Change an admin's role.

**Authentication:** JWT Bearer Token (Super Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Admin ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| role | string | Yes | ADMIN or SUPER_ADMIN |

**Response (200):**

```json
{
  "admin": {
    "id": "clxyz123...",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

**Errors:**
- 400: Invalid request
- 400: Cannot demote the only super admin
- 401: Unauthorized
- 403: Super admin required
- 404: Admin not found

---

#### DELETE /api/admin/admins/:id

Delete an admin account.

**Authentication:** JWT Bearer Token (Super Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Admin ID |

**Response (200):**

```json
{
  "success": true
}
```

**Errors:**
- 400: Cannot delete your own account
- 401: Unauthorized
- 403: Super admin required
- 404: Admin not found

---

#### POST /api/admin/admins/:id/reset-password

Reset another admin's password.

**Authentication:** JWT Bearer Token (Super Admin)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Admin ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| password | string | Yes | New password (min 8 chars) |

**Response (200):**

```json
{
  "success": true
}
```

**Errors:**
- 400: Invalid request (password too short)
- 401: Unauthorized
- 403: Super admin required
- 404: Admin not found

---

### Webhook Routes (`/webhooks/*`)

#### POST /webhooks/stripe

Handle Stripe webhook events.

**Authentication:** Stripe signature (`stripe-signature` header)

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| stripe-signature | Yes | Stripe webhook signature |

**Request Body:** Raw JSON (Stripe event payload)

**Response (200):**

```json
{
  "received": true
}
```

Or for duplicate events:

```json
{
  "received": true,
  "duplicate": true
}
```

**Errors:**
- 400: Missing stripe-signature header
- 400: Webhook signature verification failed

**Handled Events:**
- `checkout.session.completed` - Subscription activated
- `customer.subscription.created` - (logged only)
- `customer.subscription.updated` - Seat count and status sync
- `customer.subscription.deleted` - Member removal
- `invoice.payment_failed` - Payment failure handling
- `invoice.paid` - Payment recovery handling

---

### Health Routes

#### GET /health

Health check endpoint for monitoring.

**Authentication:** None

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-21T00:00:00.000Z",
  "environment": "development"
}
```

---

## Quick Reference

### Endpoint Count by Domain

| Domain | Count |
|--------|-------|
| Authentication (`/auth/*`) | 9 |
| Checkout (`/checkout/*`) | 1 |
| Billing (`/billing/*`) | 1 |
| Company (`/company/*`) | 1 |
| Dashboard (`/dashboard/*`) | 1 |
| Claim (`/claim/*`) | 2 |
| Team (`/team/*`) | 9 |
| Admin Auth (`/admin/auth/*`) | 3 |
| Admin API (`/api/admin/*`) | 21 |
| Webhooks (`/webhooks/*`) | 1 |
| Health | 1 |
| **Total** | **50** |

### Authentication Summary

| Endpoint Type | Auth Method |
|---------------|-------------|
| Public (signup, login) | None |
| Member API | JWT Bearer Token |
| Admin API | JWT Bearer Token (admin) |
| OAuth callbacks | State cookies |
| Webhooks | Stripe signature |
