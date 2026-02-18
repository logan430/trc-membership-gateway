---
phase: 42-discord-integration
verified: 2026-02-17T15:00:00Z
status: human_needed
score: 3/5 must-haves verified
human_verification:
  - test: Complete OAuth claim flow in browser
    expected: Navigate to /claim/discord then Discord authorize then callback routes to /claim/callback then discordId saved then redirect to invite URL or /dashboard
    why_human: Browser-based OAuth flow with Discord redirect cannot be verified programmatically
  - test: Verify Squire role assigned after claim
    expected: After completing claim flow, test member receives Squire role in Discord server
    why_human: Requires real Discord API interaction and server state inspection
  - test: Post 100+ char introduction in #introductions
    expected: Bot detects message, reacts with party emoji, removes Squire role, adds Knight or Lord role, sends welcome DM, sets introCompleted=true
    why_human: Requires real Discord interaction and message posting
  - test: Verify Discord Developer Portal has production redirect URI
    expected: https://app.therevenuecouncil.com/auth/callback listed under OAuth2 Redirects
    why_human: Developer Portal is a browser-only interface
  - test: Verify bot role hierarchy in Discord server
    expected: Bot role is positioned ABOVE Squire, Knight, Lord, Debtor roles
    why_human: Discord server settings are browser-only
---

# Phase 42: Discord Integration Verification Report

**Phase Goal:** Discord OAuth and bot role assignment work in production.
**Verified:** 2026-02-17
**Status:** HUMAN_NEEDED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OAuth callback handler dispatches claim-flow users to claim callback logic | VERIFIED | src/routes/auth.ts lines 391-408: checks claim_state and team_claim_state cookies before oauth_state, redirects to /claim/callback and /team/claim/callback respectively. Commit 05156c7 adds exactly this logic (21 lines). |
| 2 | Discord bot connects and shows online in production | VERIFIED | Per 42-02-SUMMARY: health check returns discord:true. Bot logged in as TRC DEV App#0949. Startup logs confirm role sync, introduction handlers registered, bot startup complete. |
| 3 | Bot assigns Squire role when member links Discord (code exists and is wired) | VERIFIED | src/routes/claim.ts:133 calls assignRoleAsync(discordUser.id, ROLE_CONFIG.SQUIRE.name) after successful claim. src/routes/team-claim.ts:249 does the same. Full chain verified through role-assignment.ts to bot/roles.ts. |
| 4 | Introduction detection code exists, is wired, and promotes Squire to Knight/Lord | VERIFIED | src/bot/events/introduction.ts (227 lines): setupIntroductionHandlers() registers messageCreate and messageUpdate listeners. processIntroduction() validates 100+ char length, checks Squire role, calls swapRoleAsync based on seatTier, updates introCompleted=true in DB, awards intro points, sends welcome DM. Called from src/bot/client.ts:45 during bot startup. |
| 5 | OAuth claim flow completes end-to-end in production browser | ? UNCERTAIN | Code path is fully wired but browser-based OAuth flow with real Discord authorization has NOT been tested. 42-02-SUMMARY explicitly defers this to Phase 43 E2E testing. |

**Score:** 3/5 truths verified programmatically, 2 need human verification

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/routes/auth.ts | Unified OAuth callback with claim/team-claim flow detection | VERIFIED | 737 lines, substantive, exported as authRouter, mounted at /auth in src/index.ts. Cookie-based flow detection at lines 391-408. No stubs or TODOs. |
| src/auth/discord-oauth.ts | OAuth URL generation and token exchange | VERIFIED | 86 lines, substantive, exports generateAuthUrl, exchangeCode, fetchDiscordUser. Used by auth.ts, claim.ts, team-claim.ts. |
| src/routes/claim.ts | Claim flow with Squire role assignment | VERIFIED | 147 lines, substantive, exports claimRouter, mounted at /claim in src/index.ts:226. Requires auth + active subscription. Calls assignRoleAsync after Discord link. |
| src/routes/team-claim.ts | Team claim flow with Squire role assignment | VERIFIED | 274 lines, substantive, exports teamClaimRouter, mounted at /team in src/index.ts:223. Atomic seat claim with Prisma transaction. |
| src/bot/client.ts | Discord bot client with startup logic | VERIFIED | 68 lines, substantive, exports discordClient and startBot. Configured with GuildMembers, GuildMessages, MessageContent intents. Called from src/index.ts:340. |
| src/bot/events/introduction.ts | Introduction detection and promotion | VERIFIED | 227 lines, substantive. Handles messageCreate and messageUpdate events. Validates 100+ chars, top-level messages only. Promotes INDIVIDUAL/OWNER to Lord, TEAM_MEMBER to Knight. |
| src/bot/roles.ts | Role sync and management | VERIFIED | 213 lines, substantive. Exports syncRoles, addRoleToMember, removeRoleFromMember, removeAllManagedRoles. |
| src/lib/role-assignment.ts | Async role operations with retry | VERIFIED | 226 lines, substantive. Exports assignRoleAsync, swapRoleAsync, removeAndKickAsync, revokeAndKickAsync. Uses p-retry with 5 retries. |
| src/config/discord.ts | Role configuration | VERIFIED | 27 lines, substantive. Defines SQUIRE, KNIGHT, LORD, DEBTOR roles with names, colors, descriptions. |
| src/config/env.ts | Discord env var validation | VERIFIED | 77 lines, substantive. All Discord vars defined with Zod schemas. |
| Coolify env vars | Production Discord configuration | VERIFIED | Per 42-01-SUMMARY: all Discord vars confirmed set in Coolify. DISCORD_REDIRECT_URI set to production URL. |
| Discord Developer Portal | Production redirect URI registered | ? UNCERTAIN | User reported configured per 42-02-SUMMARY. Cannot verify programmatically. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| /claim/discord route | Discord OAuth | generateAuthUrl(state) | WIRED | claim.ts:57 calls generateAuthUrl which returns Discord authorize URL with redirect_uri |
| /auth/callback | /claim/callback | claim_state cookie detection | WIRED | auth.ts:395-401: checks claim_state cookie, if matches state, redirects to /claim/callback |
| /auth/callback | /team/claim/callback | team_claim_state cookie detection | WIRED | auth.ts:405-407: checks team_claim_state cookie, if matches state, redirects to /team/claim/callback |
| Claim callback success | Squire role assignment | assignRoleAsync | WIRED | claim.ts:133 calls assignRoleAsync(discordUser.id, ROLE_CONFIG.SQUIRE.name) |
| Team claim callback success | Squire role assignment | assignRoleAsync | WIRED | team-claim.ts:249 calls assignRoleAsync(discordUser.id, ROLE_CONFIG.SQUIRE.name) |
| Introduction message | Knight/Lord promotion | swapRoleAsync via messageCreate | WIRED | introduction.ts:177 calls swapRoleAsync with correct role logic |
| Bot startup | Introduction handlers | setupIntroductionHandlers() | WIRED | client.ts:45 calls setupIntroductionHandlers in ClientReady handler |
| App startup | Bot startup | startBot() | WIRED | index.ts:340 calls startBot() after HTTP server starts |
| Claim callback | Database update | prisma.member.update | WIRED | claim.ts:123-129 updates member with discordId, discordUsername, discordAvatar |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| DISCORD-01: OAuth redirect URI updated in Developer Portal | HUMAN_NEEDED | User claims configured. Cannot verify Developer Portal programmatically. |
| DISCORD-02: OAuth flow completes successfully | HUMAN_NEEDED | Code path verified as wired. Browser end-to-end test deferred to Phase 43. |
| DISCORD-03: Member discordId and discordUsername saved after OAuth | VERIFIED (code) | claim.ts:123-129 saves discordId, discordUsername, discordAvatar. team-claim.ts:217-233 does same via upsert. |
| DISCORD-04: Discord bot is online and connected | VERIFIED | Health check returns discord: true. Bot logs show login as TRC DEV App#0949. |
| DISCORD-05: Bot assigns Squire role when member links Discord | VERIFIED (code) | assignRoleAsync called in both claim.ts:133 and team-claim.ts:249. Full chain verified. |
| DISCORD-06: Bot promotes Squire to Knight/Lord after intro | VERIFIED (code) | introduction.ts:177 calls swapRoleAsync with correct role logic. |
| DISCORD-07: Bot assigns Debtor role on payment failure | DEFERRED | Deferred to Phase 43 per plan. Code exists in billing/debtor-state.ts:71. |
| DISCORD-08: Introduction detection works in #introductions | VERIFIED (code) | introduction.ts registers messageCreate/messageUpdate handlers for configured channel ID. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns found in Phase 42 modified files |

No TODO, FIXME, placeholder, or stub patterns found in any Discord-related source files.

### Non-Blocking Issues (from Deployment Logs)

Per 42-02-SUMMARY, three non-blocking issues were observed:

1. **Billing support channel creation fails** (Missing Permissions, code 50013): Bot lacks Manage Channels permission. Does not affect claim flow. Can be addressed by granting permission or deferring to Phase 43.

2. **Test seed data with fake Discord IDs**: Two test members have non-snowflake Discord IDs from Phase 40 seed script. Causes repeated errors during billing polls. Cleanup recommended.

3. **express-rate-limit IPv6 warning**: Non-blocking validation warning. Rate limiting works for IPv4.

### Human Verification Required

### 1. Complete OAuth Claim Flow (Browser Test)

**Test:** Log in as a member with active subscription at https://app.therevenuecouncil.com/login, navigate to https://app.therevenuecouncil.com/claim/discord, authorize on Discord, verify redirect back to /dashboard (or invite URL).
**Expected:** User completes OAuth, is NOT shown /auth/error?reason=invalid_state. Member record in database has discordId and discordUsername populated.
**Why human:** Browser-based OAuth flow with Discord redirect cannot be automated without browser tooling.

### 2. Verify Squire Role Assignment

**Test:** After completing the claim flow (test 1), check the test member roles in the Discord server.
**Expected:** Test member has the Squire role (gray) in Discord.
**Why human:** Requires checking Discord server member roles visually.

### 3. Test Introduction Detection and Promotion

**Test:** With Squire role active, post a 100+ character message in #introductions channel.
**Expected:** Bot reacts with party emoji, removes Squire role, adds Knight or Lord role (depending on seatTier), sends welcome DM, introCompleted=true in database.
**Why human:** Requires posting a real message in Discord and observing bot behavior.

### 4. Verify Discord Developer Portal Configuration

**Test:** Open Discord Developer Portal -> Application (1462619474921390173) -> OAuth2 -> Redirects.
**Expected:** https://app.therevenuecouncil.com/auth/callback is listed. Under Bot -> Privileged Gateway Intents, both SERVER MEMBERS INTENT and MESSAGE CONTENT INTENT are enabled.
**Why human:** Developer Portal is a browser-only interface.

### 5. Verify Bot Role Hierarchy

**Test:** Open Discord Server Settings -> Roles.
**Expected:** Bot role is positioned ABOVE Squire, Knight, Lord, and Debtor roles in the hierarchy.
**Why human:** Server role hierarchy is only visible in Discord settings.

### Gaps Summary

No code gaps were found. All artifacts exist, are substantive (no stubs), and are properly wired throughout the codebase. The OAuth callback routing fix (commit 05156c7) correctly addresses the critical cookie-mismatch bug identified during research.

The phase status is HUMAN_NEEDED rather than PASSED because:

1. **The full OAuth claim flow has not been tested in a browser.** The 42-02-SUMMARY explicitly states this was deferred to Phase 43 E2E testing. The code path is verified as correctly wired, but actual Discord OAuth round-trip has not been exercised.

2. **Discord Developer Portal configuration is user-reported** but cannot be verified programmatically. The user stated configured but there is no automated way to confirm the redirect URI was actually added.

3. **Role assignment and introduction detection have not been tested with real Discord interactions.** The code is complete and wired, but production behavior depends on Discord API responses, bot permissions, and server role hierarchy -- all of which require human verification.

The code-level verification confidence is HIGH: all 10+ artifacts pass existence, substantive, and wiring checks. The remaining uncertainty is entirely in the production environment configuration and real Discord API interaction.

---

_Verified: 2026-02-17T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
