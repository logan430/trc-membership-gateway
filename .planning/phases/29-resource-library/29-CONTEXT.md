# Phase 29: Resource Library & File Storage - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend for admin-curated file library with secure storage. Admin uploads files (PDF, DOCX, XLSX, MP4, ZIP) with validation. Files stored in Supabase Storage with signed URLs. Member browses resources with filtering/search and downloads via tracked signed URLs. Admin sees analytics and can update files with version history.

</domain>

<decisions>
## Implementation Decisions

### Resource Organization
- Flat tags only (no hierarchical categories)
- Admin-managed tag list: admins can add new tags to master list, then select from it when uploading
- Multiple tags per resource allowed
- Featured/pinned resources: admin can mark certain resources as featured for prominent display

### Metadata Model
- Standard fields: title, description, tags, author (attribution), date added, file size
- Track uploader internally (which admin uploaded) plus optional public attribution field for original creator
- Plain text descriptions (no markdown/rich text)
- Three publishing states: Draft, Published, Scheduled
- Scheduled publishing: admin can set future publish date

### Versioning Model
- Keep version history (admin-only access to old versions)
- Optional changelog notes when uploading new version
- Metadata edits (title, description, tags) don't create new file version — independent updates

### Claude's Discretion
- Version retention policy (how many old versions to keep)
- Download point rules (first download only vs every download)
- Preview behavior (if any preview without downloading)
- File type icons and display formatting
- Search ranking algorithm

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 29-resource-library*
*Context gathered: 2026-01-23*
