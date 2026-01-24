# Phase 33: Admin Analytics Dashboard - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Analytics dashboard for admins to analyze member behavior, industry patterns, and make community decisions. Includes member overview, engagement metrics, benchmark insights, resource analytics, CRM export, cohort retention, and churn prediction. This is an admin-only feature — no member-facing analytics in this phase.

</domain>

<decisions>
## Implementation Decisions

### Dashboard structure
- Tabbed sections: Overview, Members, Engagement, Benchmarks, Resources
- Landing tab is Overview with KPI summary cards + mini-charts
- Clicking a KPI card navigates to the relevant detailed tab
- Tab bar for switching between sections

### Visualization approach
- Line charts for time-series trends (engagement over time, activity trends)
- Side-by-side bar charts for comparison data (segment comparisons, category breakdowns)
- Hover tooltips show values; clicking data points navigates to filtered detail views
- Up/down arrows with neutral colors for trend indicators (no red/green color coding)

### Time & filtering
- Default time range: Last 30 days
- Custom comparison: Admin can select any two date ranges to compare
- Full segment filters available: company size, industry, role, region
- No k-anonymity threshold for admin views — admins see all data regardless of segment size

### Export & alerts
- Export formats: CSV + JSON (both available)
- Churn prediction: "At-risk" section on Overview tab + optional weekly email digest
- Multi-factor risk criteria: inactivity duration + declining engagement trend + payment issues
- Cohort retention: toggle between heatmap grid and line chart views

### Claude's Discretion
- Where analytics lives (dedicated /admin/analytics page vs integrated into existing admin)
- Exact tab naming and ordering
- Chart library choice (Recharts already in project from Phase 32)
- Email digest frequency and content structure
- Specific thresholds for "at-risk" classification

</decisions>

<specifics>
## Specific Ideas

- KPI cards should be clickable to drill into relevant tab (e.g., click "Active Members" → Members tab)
- Retention analysis should support both visual styles — some admins prefer heatmaps, others prefer line charts
- Trend indicators using arrows (up/down) rather than color coding keeps it neutral and accessible

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-admin-analytics*
*Context gathered: 2026-01-24*
