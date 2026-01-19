# Phase 2: Discord Integration - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can link their Discord account via OAuth, maintain persistent sessions, and the bot can manage roles on the Discord server. This phase establishes the authentication and role management foundation that subscription flows (Phase 3+) will build on.

</domain>

<decisions>
## Implementation Decisions

### OAuth Flow Experience
- **Entry points:** Both dedicated login page (returning users) AND inline on claim page (new claims)
- **Post-OAuth destination:** Member dashboard showing subscription/Discord status
- **OAuth failure:** Redirect to support/FAQ page with explanation
- **Discord scopes:** Identity only (no email) — email comes from Stripe
- **Duplicate Discord:** One Discord account per membership — block if already linked
- **Relink policy:**
  - Owners/admins CANNOT unlink themselves (prevents gaming owner-tier access)
  - Admins CAN manage team member Discord links
  - Team members CANNOT manage their own links — admin controls this
- **Dashboard detail:** Show username, avatar, server join status, role status (detailed view)

### Session & Token Strategy
- **Multi-device:** Unlimited concurrent sessions allowed
- **Remember me:** Yes, checkbox for longer vs shorter session duration
- **Lapsed subscription:** Keep session active but restrict access to billing/status pages only
- **Session duration:** Claude's discretion (recommend 30 days default, 7 days without "remember me")

### Bot Permissions & Role Setup
- **Role naming:** Medieval/Council-themed titles where applicable, professional fallback
  - Examples: "Squire" (unintroduced), "Knight" (member), "Lord/Lady" (owner), "Debtor" (billing issue)
- **Existing roles:** Use roles with matching names if they exist
- **Missing roles:** Bot auto-creates any missing roles on startup
- **Role failure handling:** Log failure AND alert admin (via channel or DM)
- **Bot visibility:** Claude's discretion

### Claude's Discretion
- Server join method (auto-join vs invite link)
- Exact session durations
- Bot visible presence vs background operation
- Role colors and display order
- Admin alert mechanism (DM vs dedicated channel)

</decisions>

<specifics>
## Specific Ideas

- Role names should evoke a medieval council aesthetic — "The Revenue Council" suggests royalty/nobility themes
- Professional fallback for roles that don't map well to medieval titles
- Dashboard should feel informative, showing the user their complete status at a glance

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-discord-integration*
*Context gathered: 2026-01-18*
