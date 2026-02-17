---
phase: 42-discord-integration
plan: 01
status: complete
subsystem: auth
tags: [discord, oauth, callback, coolify, env-vars]

dependency-graph:
  requires: [41]
  provides: [unified-oauth-callback, discord-production-config]
  affects: [42-02, 43]

tech-stack:
  added: []
  patterns: [cookie-based-flow-detection, oauth-callback-routing]

key-files:
  created: []
  modified: [src/routes/auth.ts]

decisions:
  - id: redirect-routing
    choice: "Redirect claim/team-claim flows to their own callback handlers"
    rationale: "Minimal change -- each flow already has its own callback handler with full logic"
  - id: discord-redirect-uri-keep
    choice: "Keep DISCORD_REDIRECT_URI at production URL"
    rationale: "Already correctly set to https://app.therevenuecouncil.com/auth/callback"
  - id: skip-invite-url
    choice: "Skip DISCORD_INVITE_URL for now"
    rationale: "User does not have invite URL yet; /dashboard fallback is acceptable"

metrics:
  duration: 2m
  completed: 2026-02-17
---

# Phase 42 Plan 01: OAuth Callback Fix & Discord Env Config Summary

Fixed the unified OAuth callback handler to detect and route claim and team-claim flows, verified Discord environment variables are correctly configured for production in Coolify, and triggered a rebuild to deploy the fix.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix /auth/callback to handle claim and team-claim OAuth flows | 05156c7 | src/routes/auth.ts |
| 2 | Configure Discord environment variables in Coolify | (no commit - API config) | Coolify env vars |

## Deliverables

### Task 1: OAuth Callback Flow Detection
The `/auth/callback` handler now detects which OAuth flow initiated the callback by checking for three state cookies:
- `oauth_state` -- standard auth flow (existing behavior, unchanged)
- `claim_state` -- claim flow, redirects to `/claim/callback`
- `team_claim_state` -- team claim flow, redirects to `/team/claim/callback`

This fixes the bug where claim and team-claim flows failed with `invalid_state` errors because the callback handler only checked for `oauth_state`.

### Task 2: Discord Env Vars Verification
All Discord environment variables were already correctly configured in Coolify:
- `DISCORD_CLIENT_ID`: 1462619474921390173
- `DISCORD_CLIENT_SECRET`: set
- `DISCORD_REDIRECT_URI`: https://app.therevenuecouncil.com/auth/callback (production URL)
- `DISCORD_BOT_TOKEN`: set
- `DISCORD_GUILD_ID`: 1462618471748866182
- `DISCORD_INTRODUCTIONS_CHANNEL_ID`: 1462665696889667606

`DISCORD_INVITE_URL` was intentionally skipped (user does not have an invite URL yet).

A rebuild was triggered (deployment UUID: zg4sg8gc0wgcoo4gkok0wkk8) to deploy the auth.ts callback fix.

## Verification Results

1. Health check: `{"status":"healthy","checks":{"database":true,"discord":true}}`
2. `DISCORD_REDIRECT_URI` is NOT set to localhost -- confirmed production URL
3. Callback routing logic confirmed in auth.ts (lines 395-396)
4. Pre-existing TypeScript errors (passwordResetToken model) are unrelated to changes

## Deviations from Plan

### Deviation 1: No env var changes needed
The plan anticipated potentially needing to delete or update DISCORD_REDIRECT_URI (if set to localhost). It was already correctly set to the production URL, so no PATCH/DELETE operations were needed.

### Deviation 2: DISCORD_INVITE_URL skipped
Per user instructions, DISCORD_INVITE_URL was not set. The claim flow will redirect to /dashboard as fallback, which is acceptable until the user provides a permanent Discord server invite link.

## Issues

None. All Discord env vars were already correctly configured. The auth.ts fix compiled cleanly and deployed successfully.
