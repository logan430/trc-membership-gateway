# Phase 12: Route Restructure - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning (DEFERRED phase)

<domain>
## Phase Boundary

Consolidate all routes under `/app/*` for consistent URL structure. Admin routes move from `/admin/*` to `/app/admin/*`, auth routes from `/auth/*` to `/app/auth/*`. All internal links updated. No backwards compatibility needed (pre-launch).

</domain>

<decisions>
## Implementation Decisions

### Redirect Strategy
- No redirects — clean full switch since we're pre-launch
- Old routes simply don't exist after restructure (return 404)
- No logging for legacy route patterns

### URL Hierarchy
- Auth pages at `/app/auth/*` (e.g., `/app/auth/login`, `/app/auth/signup`)
- Admin pages at `/app/admin/*` (e.g., `/app/admin/login`, `/app/admin/members`)
- 301 permanent redirects would be used IF we were post-launch (noted for future reference)

### Breaking Change Handling
- Update everything in same phase: code, tests, docs, READMEs
- External service configs need updating (Stripe Dashboard, Discord Developer Portal)
- Include a checklist/guide documenting what external configs to update

### Route Mapping (from earlier analysis)
- `/admin/login` → `/app/admin/login`
- `/admin/dashboard` → `/app/admin/dashboard`
- `/admin/members` → `/app/admin/members`
- `/admin/members/:id` → `/app/admin/members/:id`
- `/admin/config` → `/app/admin/config`
- `/admin/audit` → `/app/admin/audit`
- `/admin/admins` → `/app/admin/admins`
- `/admin/templates` → `/app/admin/templates`
- `/auth/signup` → `/app/auth/signup`
- `/auth/login` → `/app/auth/login`

### Claude's Discretion
- Whether `/app` is for pages only or includes APIs (recommend: pages at `/app/*`, APIs at `/api/*`)
- Landing page location (recommend: keep root `/` as homepage)
- Webhook endpoint location (recommend: keep at `/webhooks/*` for stability)
- OAuth callback location (recommend: move to `/app/auth/discord/callback` for consistency)
- Static asset location (recommend: keep at `/public/*` per Express conventions)

</decisions>

<specifics>
## Specific Ideas

- "Cleaner code practice to just map everything properly as we are still pre-launch"
- Full switch preferred over gradual migration with redirects
- Consistency across the codebase is the primary goal

### Scope Estimate (from earlier analysis)
- ~119 occurrences of `/admin/` in 8 admin HTML files
- ~9 occurrences of `/auth/login` in 6 files
- ~5 occurrences of `/auth/signup` in 3 files
- Estimated 2 plans: 1 for route changes, 1 for HTML updates

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-route-restructure*
*Context gathered: 2026-01-20*
*Status: Deferred to future milestone*
