---
phase: 05-team-management
plan: 03
subsystem: invites
tags: [api, crypto, team, tokens, security]

dependency-graph:
  requires:
    - 05-01 (team schema, PendingInvite model)
  provides:
    - invite-token-generation
    - invite-management-api
    - timing-safe-validation
  affects:
    - 05-04 (invite claim uses generated tokens)
    - 05-06 (seat additions may generate new invites)

tech-stack:
  added: []
  patterns:
    - crypto-randomBytes-token-generation
    - timing-safe-token-comparison
    - seat-availability-checking

file-tracking:
  key-files:
    created:
      - src/lib/invite-tokens.ts
      - src/routes/team-invites.ts
    modified:
      - src/index.ts (already had teamInvitesRouter from 05-02)

decisions:
  - id: crypto-randomBytes
    choice: Use Node.js crypto.randomBytes over uuid/nanoid
    why: Built-in CSPRNG, no external dependencies, full entropy control
  - id: base64url-encoding
    choice: Encode tokens as base64url (43 chars from 32 bytes)
    why: URL-safe without escaping, compact representation
  - id: timing-safe-validation
    choice: Use crypto.timingSafeEqual for token comparison
    why: Prevents timing attacks that could leak token information
  - id: seat-check-before-invite
    choice: Check seat availability before creating invite
    why: Prevents creating invites when no seats available

metrics:
  duration: 5 min
  completed: 2026-01-19
---

# Phase 5 Plan 3: Invite Token Generation Summary

**One-liner:** Secure invite token generation with crypto.randomBytes and timing-safe validation for team seat allocation

## What Was Built

### Invite Token Utilities
`src/lib/invite-tokens.ts`:
- `generateInviteToken()`: Creates 32-byte cryptographically secure token, base64url encoded (43 chars)
- `validateToken()`: Timing-safe comparison to prevent timing attacks
- Uses Node.js built-in crypto module (no external dependencies)

### Invite Management API Routes
`src/routes/team-invites.ts`:

**POST /team/invites** - Create invite:
- Requires authentication (Bearer token)
- Request body: `{ seatTier: 'OWNER' | 'TEAM_MEMBER' }`
- Validates user is team owner (403 for non-owners)
- Checks seat availability before creating invite
- Returns invite with full claim URL

**GET /team/invites** - List invites:
- Requires authentication
- Returns all pending invites for the team
- Shows acceptedAt/acceptedBy for tracking

**DELETE /team/invites/:inviteId** - Revoke invite:
- Requires authentication
- Validates invite belongs to user's team
- Returns 204 No Content on success

### Authorization Flow
```
User Request -> requireAuth middleware -> Check seatTier === 'OWNER' -> Operation
```

## API Response Examples

**Create Invite (201):**
```json
{
  "invite": {
    "id": "clm...",
    "seatTier": "TEAM_MEMBER",
    "token": "kdr4PeVnqd0...",
    "inviteUrl": "https://app.example.com/team/claim?token=kdr4PeVnqd0...",
    "createdAt": "2026-01-19T..."
  }
}
```

**Seat Unavailable (400):**
```json
{
  "error": "No team member seats available",
  "claimed": 10,
  "total": 10
}
```

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Token generation | crypto.randomBytes(32) | 256 bits of entropy, CSPRNG |
| Token encoding | base64url | URL-safe, no escaping needed |
| Token validation | timingSafeEqual | Prevents timing side-channel attacks |
| Seat check | Before invite creation | Fail fast, clear error message |
| Authorization | seatTier check | Only OWNER can manage invites |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 7762e26 | feat | Invite token generation utilities |
| a4e3e8c | feat | Team invite management API routes |

## Next Phase Readiness

**Ready for 05-04 (Invite Claim Flow):**
- Tokens are generated and stored in PendingInvite
- validateToken() available for claim verification
- inviteUrl points to /team/claim endpoint (to be built)

**Pre-existing issues (documented in STATE.md):**
- TypeScript errors in discord-oauth.ts and claim.ts remain unaddressed
- public/team-dashboard.html from 05-02 is untracked (leftover)

## Files Changed

```
src/lib/invite-tokens.ts    | NEW - Token generation and validation utilities
src/routes/team-invites.ts  | NEW - POST/GET/DELETE /team/invites endpoints
src/index.ts                | (Already had teamInvitesRouter mount from 05-02)
```
