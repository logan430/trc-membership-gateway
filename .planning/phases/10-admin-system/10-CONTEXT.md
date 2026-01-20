# Phase 10: Admin System - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin interface for managing members, access, and system configuration. Admins can login at a separate endpoint, view and manage all members, perform access control actions, and configure system behavior. This phase delivers the admin panel — user-facing flows (signup, login, dashboard, claim) are already complete in Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Authentication approach
- Individual admin accounts stored in database (not shared credentials, not Discord-based)
- First admin created via seed script; subsequent admins invited from UI by existing admins
- Two permission levels: super admin (can manage other admins + system config) and regular admin (member management only)
- Admin sessions last 30 days before requiring re-login

### Member management UI
- Rich table with inline actions — status badges, action buttons per row, expandable details
- Advanced filtering — multiple filters with AND/OR logic, saved filter presets
- Full bulk actions — select multiple members and revoke, reset claims, change roles, send emails, export CSV
- Minimal list, full detail view — list shows name, email, status; click to see subscription dates, Discord status, role, team, history/logs

### Access control actions
- "Revoke access" means remove Discord roles only — keep subscription and member record, don't kick from server
- Admins CAN grant any role directly — bypassing normal subscription/claim flow when needed
- "Reset claim" means unlink Discord but keep subscription — member must re-claim with Discord OAuth, introduction status preserved
- All destructive actions require confirmation dialog + admin must provide a reason that gets logged

### Configuration scope
- Discord channel IDs: view only — admins can see current channel IDs but changes require env vars/deploy
- Feature flags: comprehensive — many granular toggles for system behaviors (require introduction, send claim reminders, enable billing emails, etc.)
- Email templates: full template editor — admins can edit HTML/markdown templates with preview
- Audit log: full system audit log — all events (admin actions, member changes, webhook events) with search and filters

### Claude's Discretion
- Admin table column arrangement and default sort
- Feature flag categorization and grouping in UI
- Audit log retention period and pagination approach
- Email template editor implementation (CodeMirror vs textarea vs other)
- Exact confirmation dialog design and UX

</decisions>

<specifics>
## Specific Ideas

- Two-tier admin system mirrors the owner/team member pattern already in the app
- Feature flags should cover all the behavioral switches mentioned throughout previous phases (introduction requirement, claim reminders, billing emails, etc.)
- Audit log should capture enough detail to investigate "what happened to member X" questions
- Bulk actions need safeguards — especially for actions like role changes across many members

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-admin-system*
*Context gathered: 2026-01-19*
