# Phase 11: Frontend Cleanup - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete frontend coverage so all user flows work end-to-end without dead links, missing pages, or route inconsistencies. Fix route structure to consolidate under /app, add error pages, and complete checkout flow.

</domain>

<decisions>
## Implementation Decisions

### Route Structure
- Admin routes move from `/admin/*` to `/app/admin/*` for consistency
- Auth pages move from `/auth/*` to `/app/auth/*` for consistency
- Team pages move from `/team-dashboard.html` to `/app/team` and `/app/team/claim`
- Old `.html` routes should redirect to new clean routes (backwards compatibility)
- Team pages keep separate navigation (don't share nav with member dashboard)
- Checkout success at `/checkout/success`

### Error Pages
- 404 page uses medieval theme to match Gatekeeper aesthetic
- 404 page has single "Return to the Kingdom" home link only
- Errors should log to console for debugging

### Checkout Success
- Page shows celebration + next steps ("Welcome to the Council!")
- Primary CTA is "Go to dashboard"
- Same page for both individual and company purchases
- Keep minimal - no order/subscription details shown

### Legal Pages
- Terms and privacy links point to `#` for now (external site coming later)
- Minimal footer with copyright and placeholder links
- No actual terms/privacy content needed - will link externally in future

### Claude's Discretion
- Checkout cancel behavior (redirect vs dedicated page)
- Team invite token URL format (path vs query param)
- Whether to include custom 500 error page
- Exact medieval copy for error pages
- Exact route for old redirects

</decisions>

<specifics>
## Specific Ideas

- Medieval themed 404: "The scroll ye seek does not exist" style messaging
- Checkout success should feel welcoming - "Welcome to the Council!"
- Keep the Gatekeeper aesthetic consistent across all pages

</specifics>

<deferred>
## Deferred Ideas

- Terms of service content - external website handles this
- Privacy policy content - external website handles this
- Unified navigation between member/team sections - keep separate for now

</deferred>

---

*Phase: 11-frontend-cleanup*
*Context gathered: 2026-01-20*
