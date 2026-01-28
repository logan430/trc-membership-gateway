# Phase 37: Admin Feature Pages - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the 4 missing admin dashboard pages identified during UI/UX testing: Points Config, Benchmarks Moderation, Analytics Dashboard, and Resource Management. All backend APIs exist (Phases 27-29, 33). This phase builds the admin UI to consume them.

</domain>

<decisions>
## Implementation Decisions

### Points Configuration Page
- Inline editing - click value to edit in place, changes save immediately
- Flat list - all configs in one sortable table, not grouped by type
- Inline save indicator - checkmark next to edited field that fades out
- Show change history - display when each value was last changed and by whom

### Benchmarks Moderation Page
- Table list view - rows with columns, compact and scannable
- No reason required - quick action buttons for approve/reject
- Bulk actions supported - select multiple submissions, approve/reject as batch
- Minimal member context - just member name and submission date shown

### Analytics Dashboard Page
- Metrics cards as primary view - big numbers at top (MRR, active members, growth)
- Both presets and custom date range - quick toggles (7d, 30d, 90d) plus date picker
- CSV and JSON export - both formats available for download
- No comparison to previous period - just show current period data

### Resource Management Page
- Drag and drop zone for uploads - large drop area with click-to-browse fallback
- Both featured and manual ordering - featured flag plus drag-to-reorder
- Version history collapsed by default - expand to see previous versions
- Analytics in detail view only - download counts visible when viewing individual resource

### Claude's Discretion
- Table column order and sorting defaults
- Exact card/table styling within existing admin patterns
- Loading states and error handling
- Pagination limits and infinite scroll decisions

</decisions>

<specifics>
## Specific Ideas

- All 4 pages should follow existing admin dashboard patterns (AdminSidebar, AdminHeader)
- Reuse existing components from Phase 34 migration (tables, cards, filters)
- Backend APIs already exist - this is purely frontend work

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 37-admin-features*
*Context gathered: 2026-01-28*
