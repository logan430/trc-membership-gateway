# Phase 11: Frontend Cleanup - Context

**Gathered:** 2026-01-20
**Status:** Ready for execution
**Updated:** 2026-01-20 - Scope refinement

<domain>
## Phase Boundary

Add missing pages and clean routes for team flows. Focus on completing the checkout flow, error handling, and team access paths.

**In scope:**
- Team route aliases (`/app/team`, `/team/invite`)
- Checkout success page
- 404 error page

**Out of scope (deferred to Phase 12):**
- Route restructure (moving /admin/*, /auth/* under /app/*)
- Terms/privacy pages (will link to external site)

</domain>

<decisions>
## Implementation Decisions

### Route Structure (Phase 11)
- Team pages get clean routes: `/app/team` and `/team/invite`
- Checkout success at `/checkout/success`
- Keep existing /admin/* and /auth/* routes as-is
- Route restructure deferred to Phase 12 (~130 file references to update)

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
- Terms and privacy links stay as `#` for now
- External site will handle actual legal content
- No pages created in this phase

### Claude's Discretion
- Checkout cancel behavior (redirect vs dedicated page)
- Team invite token URL format (path vs query param)
- Whether to include custom 500 error page
- Exact medieval copy for error pages

</decisions>

<specifics>
## Specific Ideas

- Medieval themed 404: "The scroll ye seek does not exist" style messaging
- Checkout success should feel welcoming - "Welcome to the Council!"
- Keep the Gatekeeper aesthetic consistent across all pages

</specifics>

<deferred>
## Deferred Ideas

- Terms of service pages - external website handles this
- Privacy policy pages - external website handles this
- Route restructure under /app/* - Phase 12
- Unified navigation between member/team sections - keep separate for now

</deferred>

---

*Phase: 11-frontend-cleanup*
*Context gathered: 2026-01-20*
*Updated: 2026-01-20 - Scope refinement after review*
