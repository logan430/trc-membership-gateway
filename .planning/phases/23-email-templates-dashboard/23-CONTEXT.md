# Phase 23: Email Templates Dashboard - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin UI for viewing and editing email templates used by the notification system. Admins can edit subject lines and body content, preview rendered templates, and reset to defaults. Creating new template types or managing recipients is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Template Editing Experience
- Plain text editor with HTML — admin writes HTML directly in a textarea
- Preview via button click — opens modal or separate view showing rendered template
- Dedicated edit page at `/app/admin/templates/:id` for full-page editing
- Both subject line and body are editable per template

### Variable System
- Handlebars-style syntax: `{{memberName}}`, `{{claimLink}}`, etc.
- Click-to-insert variable chips — clicking inserts at cursor position
- Validate on save — warn if unknown variables like `{{typo}}` are detected
- Preview shows sample data with realistic example values (e.g., "Hello John Doe")

### Template Organization
- Group templates by category: Welcome, Billing, Team, Reminders (expandable sections)
- No search needed — list is small enough to browse by category
- Templates cannot be disabled — all templates always active

### Version Control & Audit
- No version history — just save current state (simpler)
- Template edits logged in audit log — record who edited which template and when
- Reset to default button — admin can restore template to original content
- All admins can edit templates (not super admin only)

### Claude's Discretion
- List column layout (name, description, last edited)
- Exact category groupings based on existing email types
- Sample data values for preview
- Editor styling and layout details

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches matching existing admin dashboard patterns.

</specifics>

<deferred>
## Deferred Ideas

- **Pre-written email template content** — User wants actual template text ready to use. This is content creation, not UI. Could be part of Phase 24 (Seed Data) or a separate phase.

</deferred>

---

*Phase: 23-email-templates-dashboard*
*Context gathered: 2026-01-21*
