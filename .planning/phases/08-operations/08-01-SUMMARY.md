---
phase: 08
plan: 01
subsystem: reconciliation
tags: [reconciliation, cron, scheduler, infrastructure]

dependency_graph:
  requires: [06-billing, 07-email]
  provides: [reconciliation-infrastructure, reconciliation-scheduler]
  affects: [08-02-detection, 08-03-autofix]

tech_stack:
  added: [node-cron@4.2.1, "@types/node-cron@3.0.11"]
  patterns: [cron-scheduler, type-safe-drift-detection]

files:
  key_files:
    created:
      - src/reconciliation/types.ts
      - src/reconciliation/index.ts
    modified:
      - prisma/schema.prisma
      - src/config/env.ts
      - package.json

decisions:
  - id: "08-01-cron"
    decision: "node-cron for scheduling"
    rationale: "Lightweight, timezone-aware, consistent with billing scheduler pattern"

metrics:
  duration: 3 min
  completed: 2026-01-19
---

# Phase 8 Plan 01: Reconciliation Infrastructure Summary

ReconciliationRun model with node-cron scheduler scaffold and configurable env vars

## What Was Built

### ReconciliationRun Model (prisma/schema.prisma)
- Audit trail for reconciliation runs with timestamps
- Counts: membersChecked, teamsChecked, issuesFound, issuesFixed
- Mode flags: autoFixEnabled, isVerificationRun, triggeredBy
- JSON issues field for drift issue storage
- Index on startedAt for time-based queries

### Environment Configuration (src/config/env.ts)
- RECONCILIATION_AUTO_FIX: Enable/disable auto-fix mode (default: false)
- RECONCILIATION_PAUSED: Pause scheduled runs (default: false)
- RECONCILIATION_TIMEZONE: Cron timezone (default: America/New_York)
- RECONCILIATION_HOUR: Hour of day to run (default: 3 AM)
- ADMIN_EMAIL: Optional email for reconciliation reports

### Type Definitions (src/reconciliation/types.ts)
- DriftType: MISSING_ACCESS, UNAUTHORIZED_ACCESS, ROLE_MISMATCH, DEBTOR_MISMATCH
- DriftSeverity: HIGH, MEDIUM, LOW
- DriftIssue interface for individual drift detections
- ReconciliationResult for run outcomes
- ReconciliationOptions for triggering reconciliation

### Scheduler Scaffold (src/reconciliation/index.ts)
- startReconciliationScheduler() function using node-cron
- Daily schedule at configured hour/timezone
- Pause support via RECONCILIATION_PAUSED env var
- Placeholder for runReconciliation() (08-02)
- Re-exports types for consumers

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 935fd6a | feat | Add ReconciliationRun model and install node-cron |
| 6a1b7ac | feat | Add reconciliation env vars |
| 873bdc5 | feat | Create reconciliation types and scheduler scaffold |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 08-02 (Drift Detection Logic):
- ReconciliationRun model ready to store run results
- Types defined for drift detection
- Scheduler infrastructure in place
- Configuration env vars available

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| node-cron | 4.2.1 | Daily scheduled reconciliation runs |
| @types/node-cron | 3.0.11 | TypeScript definitions |
