# Requirements: The Revenue Council v2.0

**Defined:** 2026-01-22
**Core Value:** Paid members can access the community, and we always know who everyone is. Intelligence platform provides admins actionable data while members get peer insights.

## v2.0 Requirements

Requirements for v2.0 Community Intelligence Platform release. Each maps to roadmap phases.

### Authentication & Session Management

- [ ] **AUTH-01**: Member session works across Express (port 4000) and Next.js (port 3000) apps
- [ ] **AUTH-02**: JWT tokens validate consistently in both Express and Next.js middleware
- [ ] **AUTH-03**: httpOnly cookies forwarded correctly through Express proxy to Next.js
- [ ] **AUTH-04**: Member can access new React dashboard pages after logging in via existing auth flow

### Database Schema

- [ ] **DB-01**: BenchmarkSubmission table stores submissions with JSONB data column
- [ ] **DB-02**: Resource table stores file metadata with category taxonomy
- [ ] **DB-03**: ResourceDownload table tracks all download events with timestamps
- [ ] **DB-04**: PointTransaction table maintains immutable ledger of all point awards
- [ ] **DB-05**: DiscordActivity table tracks MEE6 XP sync history
- [ ] **DB-06**: Member table extended with totalPoints (denormalized), currentStreak, lastActiveAt
- [ ] **DB-07**: Database trigger auto-updates Member.totalPoints when PointTransaction inserted
- [ ] **DB-08**: GIN indexes created on BenchmarkSubmission.data for fast JSONB queries
- [ ] **DB-09**: All new tables have proper foreign key relationships to Member table
- [ ] **DB-10**: Migration runs without downtime using concurrent index creation

### Points System

- [ ] **GAME-01**: Member earns +50 points for submitting a benchmark
- [ ] **GAME-02**: Member earns +5 points for downloading a resource
- [ ] **GAME-03**: Member earns +1 point per 100 Discord XP (MEE6 integration)
- [ ] **GAME-04**: Member earns +25 points for completing introduction (one-time)
- [ ] **GAME-05**: Point values are transparent and visible to members
- [ ] **GAME-06**: Member can view point history showing all transactions
- [ ] **GAME-07**: Admin can manually adjust member points (with audit log entry)
- [ ] **GAME-08**: Points cannot be awarded twice for same action (duplicate prevention)
- [ ] **GAME-09**: Leaderboard shows top 25 members ranked by total points
- [ ] **GAME-10**: Leaderboard shows current member's rank even if outside top 25
- [ ] **GAME-11**: Member can opt out of leaderboard visibility (privacy setting)
- [ ] **GAME-12**: Leaderboard has monthly reset with separate all-time hall of fame
- [ ] **GAME-13**: Member's current streak shown (consecutive days active)
- [ ] **GAME-14**: Streak increments when member performs any point-earning action
- [ ] **GAME-15**: Discord role assigned at 500+ points ("Top Contributor" or similar)

### Peer Benchmarking

- [ ] **BENCH-01**: Member can submit compensation benchmark (salary, equity, bonus structure)
- [ ] **BENCH-02**: Member can submit infrastructure benchmark (tools, tech stack, hosting)
- [ ] **BENCH-03**: Member can submit business metrics benchmark (revenue, growth, CAC, LTV)
- [ ] **BENCH-04**: Member can submit operational benchmark (team size, processes, workflows)
- [ ] **BENCH-05**: Benchmark data stored as JSONB for flexible schema per category
- [ ] **BENCH-06**: Benchmark results hidden until 5+ submissions received (k-anonymity)
- [ ] **BENCH-07**: Member sees comparison of their data vs. peer aggregates (median, percentiles)
- [ ] **BENCH-08**: Benchmark visualizations use Recharts (ComparisonBar, PerformanceRadar)
- [ ] **BENCH-09**: Member can filter benchmark results by segment (company size, industry, role)
- [ ] **BENCH-10**: Outlier detection flags submissions >3σ from median
- [ ] **BENCH-11**: Admin can review flagged benchmark submissions in admin panel
- [ ] **BENCH-12**: Admin can approve or reject flagged submissions
- [ ] **BENCH-13**: Rejected submissions excluded from aggregates but preserved for audit
- [ ] **BENCH-14**: Member receives +50 points upon successful benchmark submission
- [ ] **BENCH-15**: Member can update existing benchmark submission (quarterly refresh)

### Resource Library

- [ ] **RES-01**: Admin can upload files to resource library (PDF, DOCX, XLSX, MP4, ZIP)
- [ ] **RES-02**: Files validated via magic number checking (not just extension)
- [ ] **RES-03**: Files stored in Supabase Storage with signed URLs (1-hour expiration)
- [ ] **RES-04**: Resources organized by hierarchical taxonomy (category > type > tags)
- [ ] **RES-05**: Resource types supported: template, SOP, playbook, course, video
- [ ] **RES-06**: Member can browse resources with faceted filtering (category, type, search)
- [ ] **RES-07**: Member can preview resource details before downloading
- [ ] **RES-08**: Member can download resource via signed URL
- [ ] **RES-09**: Download tracked in ResourceDownload table with timestamp
- [ ] **RES-10**: Member receives +5 points per resource download
- [ ] **RES-11**: Admin sees resource analytics (total downloads, unique downloaders, trending)
- [ ] **RES-12**: Admin can update resource metadata (title, description, category)
- [ ] **RES-13**: Admin can replace resource file (version history maintained)
- [ ] **RES-14**: Admin can delete resource (soft delete with audit trail)
- [ ] **RES-15**: Member sees contextual resource recommendations based on profile

### MEE6 Discord Integration

- [ ] **DISCORD-01**: Background job syncs MEE6 XP data every 15 minutes
- [ ] **DISCORD-02**: MEE6 XP delta calculated (current XP - last recorded XP)
- [ ] **DISCORD-03**: Points awarded based on XP delta (1 point per 100 XP)
- [ ] **DISCORD-04**: DiscordActivity table records each sync event
- [ ] **DISCORD-05**: MEE6 sync errors logged to Sentry without blocking point awards
- [ ] **DISCORD-06**: Historical XP backfilled for existing members on first sync

### Member Dashboard (React/Next.js)

- [ ] **UI-01**: Member dashboard overview shows points, streak, recent activity
- [ ] **UI-02**: Benchmark submission page with forms for all 4 categories
- [ ] **UI-03**: Benchmark results page with Recharts visualizations
- [ ] **UI-04**: Resource library browser with filtering and search
- [ ] **UI-05**: Resource detail page with download button
- [ ] **UI-06**: Leaderboard page showing rankings and current member position
- [ ] **UI-07**: Profile page showing point history and download history
- [ ] **UI-08**: Account settings page (email, password management - from v1.0)
- [ ] **UI-09**: Billing page (subscription, invoices - from v1.0)
- [ ] **UI-10**: Navigation works between all dashboard pages
- [ ] **UI-11**: All pages responsive on mobile devices
- [ ] **UI-12**: Loading states prevent user confusion during data fetching
- [ ] **UI-13**: Form validation shows helpful error messages
- [ ] **UI-14**: CSS theme less minimalist than Chris's app (shadows, colors, 8px border-radius)

### Admin Analytics Dashboard

- [ ] **ANALYTICS-01**: Admin sees member overview (total, active, inactive counts)
- [ ] **ANALYTICS-02**: Admin sees engagement metrics (submissions, downloads, Discord activity)
- [ ] **ANALYTICS-03**: Admin sees benchmark submission rate by category
- [ ] **ANALYTICS-04**: Admin sees resource download analytics (most popular, trending)
- [ ] **ANALYTICS-05**: Admin sees industry insights dashboard (aggregate benchmark patterns)
- [ ] **ANALYTICS-06**: Admin can segment members by behavior (cohort analysis)
- [ ] **ANALYTICS-07**: Admin sees churn prediction alerts based on engagement score
- [ ] **ANALYTICS-08**: Admin can export data for CRM sync (CSV or JSON)
- [ ] **ANALYTICS-09**: Admin sees trend analysis (month-over-month comparisons)
- [ ] **ANALYTICS-10**: Analytics update in real-time (no manual refresh needed)

### File Security & Storage

- [ ] **SEC-01**: File upload limited to 100MB per file
- [ ] **SEC-02**: File types restricted to allowed list (PDF, DOCX, XLSX, MP4, ZIP)
- [ ] **SEC-03**: SVG files blocked (XSS prevention)
- [ ] **SEC-04**: File content scanned for malware before storage
- [ ] **SEC-05**: Signed URLs expire after 1 hour
- [ ] **SEC-06**: Download URLs include Content-Disposition: attachment headers
- [ ] **SEC-07**: Upload rate limited to 5 files per hour per member

### Background Jobs & Scheduling

- [ ] **JOBS-01**: MEE6 XP sync runs every 15 minutes via node-cron
- [ ] **JOBS-02**: Streak calculation runs daily at 00:05 UTC
- [ ] **JOBS-03**: Leaderboard refresh runs every 5 minutes (if caching implemented)
- [ ] **JOBS-04**: All background jobs log errors to Sentry
- [ ] **JOBS-05**: Background jobs shut down gracefully on SIGTERM

## v2+ Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Advanced Benchmarking

- **BENCH-16**: Benchmark discussion threads (privacy concerns, moderation burden)
- **BENCH-17**: AI-powered benchmark validation (detect fake/bot submissions)
- **BENCH-18**: Benchmark templates customizable by admin

### Advanced Resources

- **RES-16**: Member-contributed resources (requires approval workflow)
- **RES-17**: Learning paths (curated resource sequences)
- **RES-18**: Resource comments and ratings

### Advanced Gamification

- **GAME-16**: Team challenges for company subscriptions
- **GAME-17**: Achievement badges (beyond point-based roles)
- **GAME-18**: Seasonal leaderboard competitions with prizes

### Advanced Analytics

- **ANALYTICS-11**: Predictive ML models for member LTV
- **ANALYTICS-12**: Automated industry reports generated weekly
- **ANALYTICS-13**: Real-time dashboard with live updates

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Public benchmark data | Community is private, members-only - no public exposure |
| Cryptocurrency/blockchain points | Unnecessary complexity, no business justification |
| Mobile native app | Web-first, mobile responsive sufficient for v2.0 |
| Video streaming infrastructure | Use external platforms (YouTube, Vimeo) linked in resources |
| Real-time collaboration tools | Discord provides this, don't duplicate |
| Member-to-member messaging | Discord DMs exist, avoid building duplicate chat |
| Automated content generation (AI writing templates) | Curation is differentiator, not automation |
| Multi-language support | English-only community for now |
| White-label / multi-tenant | Single community focus |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 31 | Pending |
| AUTH-02 | Phase 31 | Pending |
| AUTH-03 | Phase 31 | Pending |
| AUTH-04 | Phase 31 | Pending |
| DB-01 | Phase 26 | Complete |
| DB-02 | Phase 26 | Complete |
| DB-03 | Phase 26 | Complete |
| DB-04 | Phase 26 | Complete |
| DB-05 | Phase 26 | Complete |
| DB-06 | Phase 26 | Complete |
| DB-07 | Phase 26 | Complete |
| DB-08 | Phase 26 | Complete |
| DB-09 | Phase 26 | Complete |
| DB-10 | Phase 26 | Complete |
| GAME-01 | Phase 27 | Complete |
| GAME-02 | Phase 27 | Complete |
| GAME-03 | Phase 27 | Complete |
| GAME-04 | Phase 27 | Complete |
| GAME-05 | Phase 27 | Complete |
| GAME-06 | Phase 27 | Complete |
| GAME-07 | Phase 27 | Complete |
| GAME-08 | Phase 27 | Complete |
| GAME-09 | Phase 32 | Pending |
| GAME-10 | Phase 32 | Pending |
| GAME-11 | Phase 32 | Pending |
| GAME-12 | Phase 32 | Pending |
| GAME-13 | Phase 32 | Pending |
| GAME-14 | Phase 32 | Pending |
| GAME-15 | Phase 32 | Pending |
| BENCH-01 | Phase 28 | Complete |
| BENCH-02 | Phase 28 | Complete |
| BENCH-03 | Phase 28 | Complete |
| BENCH-04 | Phase 28 | Complete |
| BENCH-05 | Phase 28 | Complete |
| BENCH-06 | Phase 28 | Complete |
| BENCH-07 | Phase 28 | Complete |
| BENCH-08 | Phase 32 | Pending |
| BENCH-09 | Phase 28 | Complete |
| BENCH-10 | Phase 28 | Complete |
| BENCH-11 | Phase 28 | Complete |
| BENCH-12 | Phase 28 | Complete |
| BENCH-13 | Phase 28 | Complete |
| BENCH-14 | Phase 28 | Complete |
| BENCH-15 | Phase 28 | Complete |
| RES-01 | Phase 29 | Complete |
| RES-02 | Phase 29 | Complete |
| RES-03 | Phase 29 | Complete |
| RES-04 | Phase 29 | Complete |
| RES-05 | Phase 29 | Complete |
| RES-06 | Phase 29 | Complete |
| RES-07 | Phase 29 | Complete |
| RES-08 | Phase 29 | Complete |
| RES-09 | Phase 29 | Complete |
| RES-10 | Phase 29 | Complete |
| RES-11 | Phase 29 | Complete |
| RES-12 | Phase 29 | Complete |
| RES-13 | Phase 29 | Complete |
| RES-14 | Phase 29 | Complete |
| RES-15 | Phase 29 | Complete |
| DISCORD-01 | Phase 30 | Complete |
| DISCORD-02 | Phase 30 | Complete |
| DISCORD-03 | Phase 30 | Complete |
| DISCORD-04 | Phase 30 | Complete |
| DISCORD-05 | Phase 30 | Complete |
| DISCORD-06 | Phase 30 | Deferred (no backfill by design) |
| UI-01 | Phase 32 | Pending |
| UI-02 | Phase 32 | Pending |
| UI-03 | Phase 32 | Pending |
| UI-04 | Phase 32 | Pending |
| UI-05 | Phase 32 | Pending |
| UI-06 | Phase 32 | Pending |
| UI-07 | Phase 32 | Pending |
| UI-08 | Phase 32 | Pending |
| UI-09 | Phase 32 | Pending |
| UI-10 | Phase 32 | Pending |
| UI-11 | Phase 32 | Pending |
| UI-12 | Phase 32 | Pending |
| UI-13 | Phase 32 | Pending |
| UI-14 | Phase 32 | Pending |
| ANALYTICS-01 | Phase 33 | Pending |
| ANALYTICS-02 | Phase 33 | Pending |
| ANALYTICS-03 | Phase 33 | Pending |
| ANALYTICS-04 | Phase 33 | Pending |
| ANALYTICS-05 | Phase 33 | Pending |
| ANALYTICS-06 | Phase 33 | Pending |
| ANALYTICS-07 | Phase 33 | Pending |
| ANALYTICS-08 | Phase 33 | Pending |
| ANALYTICS-09 | Phase 33 | Pending |
| ANALYTICS-10 | Phase 33 | Pending |
| SEC-01 | Phase 29 | Complete |
| SEC-02 | Phase 29 | Complete |
| SEC-03 | Phase 29 | Complete |
| SEC-04 | Phase 29 | Complete |
| SEC-05 | Phase 29 | Complete |
| SEC-06 | Phase 29 | Complete |
| SEC-07 | Phase 29 | Complete |
| JOBS-01 | Phase 30 | Complete |
| JOBS-02 | Phase 30 | Complete |
| JOBS-03 | Phase 32 | Pending |
| JOBS-04 | Phase 30 | Complete |
| JOBS-05 | Phase 30 | Complete |

**Coverage:**
- v2.0 requirements: 101 total
- Mapped to phases: 101 (100% ✓)
- Unmapped: 0

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-01-23 after Phase 30 completion*
