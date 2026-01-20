# Phase 9: Frontend Pages - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver HTML pages for signup, login, dashboard, and claim flows. Users complete the full membership journey through the browser. All backend APIs already exist — this phase creates the user-facing interface that calls them.

</domain>

<decisions>
## Implementation Decisions

### Form UX
- Validation triggers on blur (when user leaves field)
- Error messages appear directly below each problematic field
- Password fields include visual strength meter with weak/medium/strong indicator plus requirements checklist
- Password fields have eye icon toggle for show/hide visibility

### Visual Continuity
- Exact match to The Gatekeeper theme: dark (#1a1a2e) + gold (#d4af37) palette, Cinzel + Crimson Text fonts
- Full ornate decorative border with corner flourishes on signup/login pages (same framing as Gatekeeper)
- Form inputs are neutral/clean styling — contrast from the ornate page decoration
- Buttons use same gold gradient style as The Gatekeeper

### Dashboard Layout
- Subscription status displayed as large prominent card with plan name, renewal date, and status badge
- Unclaimed subscriptions show claim action within the status card (balanced prominence, not full-width CTA)
- Team owner seat list displayed as structured table with columns: name, email, role, status, actions
- Billing portal access tucked into settings/dropdown menu, not prominent on main dashboard

### Claim Flow Experience
- Discord OAuth window style: Claude's discretion based on best practices
- Successful claim shows clean confirmation: simple checkmark + "You're in!" message with Discord invite link
- Conflict errors (Discord already linked elsewhere) appear as modal dialog with explanation and support contact
- Next steps (introduction requirement) explained after successful claim, not before

### Claude's Discretion
- OAuth popup vs redirect implementation choice
- Exact password strength algorithm and thresholds
- Form input styling details within "neutral" constraint
- Settings menu/dropdown design and placement
- Loading states and transitions between pages

</decisions>

<specifics>
## Specific Ideas

- Pages should feel like they belong with The Gatekeeper — same medieval guild aesthetic
- Forms should be clean and usable despite ornate surroundings — the inputs themselves shouldn't fight with the decoration
- Dashboard is functional first — team owners need to quickly see who's claimed, who's pending

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-frontend-pages*
*Context gathered: 2026-01-19*
