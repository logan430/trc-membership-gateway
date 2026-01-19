---
phase: 08
plan: 02
subsystem: reconciliation
tags: [reconciliation, drift-detection, auto-fix, notifications, stripe, discord]

dependency_graph:
  requires: [08-01-infrastructure]
  provides: [drift-detection, auto-fix, admin-notifications, reconciliation-flow]
  affects: [manual-trigger-endpoint]

tech_stack:
  added: []
  patterns: [three-way-comparison, rate-limited-batch-processing, cron-one-shot]

files:
  key_files:
    created:
      - src/reconciliation/drift-detector.ts
      - src/reconciliation/auto-fixer.ts
      - src/reconciliation/notifications.ts
      - src/reconciliation/reconcile.ts
    modified:
      - src/reconciliation/index.ts
      - src/email/templates.ts
      - src/email/send.ts
      - src/index.ts

decisions:
  - id: "08-02-three-way"
    decision: "Three-way comparison: Stripe vs Database vs Discord"
    rationale: "Stripe is source of truth, detect drift at both data and access layers"
  - id: "08-02-rate-limit"
    decision: "Batch 5 fixes with 2s delays"
    rationale: "Discord rate limits 10 role ops per 10s; conservative batching"
  - id: "08-02-verification-rerun"
    decision: "Schedule one-shot verification 1 hour after fixes"
    rationale: "Confirm fixes applied correctly without daily wait"

metrics:
  duration: 4 min
  completed: 2026-01-19
---

# Phase 8 Plan 02: Drift Detection Logic Summary

Complete reconciliation system with three-way Stripe/Discord/DB comparison, auto-fix, and admin notifications

## What Was Built

### Drift Detection (src/reconciliation/drift-detector.ts)
- `detectMemberDrift()` - Individual member drift detection
- `detectTeamDrift()` - Team-level drift detection
- Three-way comparison: Stripe subscription vs Discord roles vs database state
- Drift types: MISSING_ACCESS, UNAUTHORIZED_ACCESS, ROLE_MISMATCH, DEBTOR_MISMATCH
- Active statuses: active, trialing, past_due (all grant access)
- Team members checked via team.stripeCustomerId
- Skips unclaimed members (no discordId) per CONTEXT.md

### Auto-Fix (src/reconciliation/auto-fixer.ts)
- `applyFixes()` - Apply corrections with rate limiting
- BATCH_SIZE=5, BATCH_DELAY_MS=2000 (respects Discord 10 ops/10s)
- p-retry with 2 retries per operation
- Fix handlers for each drift type:
  - MISSING_ACCESS: Add expected role (Squire/Knight/Lord/Debtor)
  - UNAUTHORIZED_ACCESS: Remove all managed roles
  - ROLE_MISMATCH: Remove current, add correct role
  - DEBTOR_MISMATCH: Remove roles, add Debtor

### Admin Notifications (src/reconciliation/notifications.ts)
- `notifyAdmins()` - Discord channel + email alerts
- Only notifies when issues found (no "all clear" per CONTEXT.md)
- Groups issues by type with example descriptions
- Discord: DISCORD_ADMIN_CHANNEL_ID notification
- Email: ADMIN_EMAIL reconciliation report

### Main Flow (src/reconciliation/reconcile.ts)
- `runReconciliation()` - Orchestration function
- Builds Stripe subscription map (auto-pagination)
- Builds Discord member map (fresh fetch)
- Detects drift for all members and teams
- Deduplicates issues (same member in member+team checks)
- Applies fixes when RECONCILIATION_AUTO_FIX=true
- Schedules verification re-run 1 hour after fixes
- Persists results to ReconciliationRun table

### Integration (src/index.ts)
- `startReconciliationScheduler()` called after bot ready
- Runs alongside billing scheduler

### Email Template (src/email/templates.ts, src/email/send.ts)
- `reconciliationReportEmailTemplate()` - Admin email format
- `sendReconciliationReportEmail()` - Send report to ADMIN_EMAIL
- Groups issues by type, shows first 3 examples per type

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 8fd4263 | feat | Implement drift detection functions |
| d1333ac | feat | Implement auto-fix and admin notifications |
| a790bae | feat | Implement main reconciliation flow and wire to startup |

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Met

- OPS-02: Reconciliation runs daily at configured hour (3 AM default)
- OPS-03: Auto-fix applies corrections when RECONCILIATION_AUTO_FIX=true
- Admin notified via Discord channel AND email when issues found
- ReconciliationRun records persist full audit trail
- Verification re-run scheduled 1 hour after fixes applied

## Drift Scenarios Covered

| Type | Detection | Fix |
|------|-----------|-----|
| MISSING_ACCESS | Stripe active, no Discord role | Add expected role |
| UNAUTHORIZED_ACCESS | Discord role, Stripe inactive | Remove all managed roles |
| ROLE_MISMATCH | Wrong tier role | Swap to correct role |
| DEBTOR_MISMATCH | isInDebtorState but no Debtor role | Add Debtor role |

## Next Phase Readiness

Phase 8 reconciliation is now complete:
- Infrastructure (08-01): ReconciliationRun model, env vars, scheduler scaffold
- Detection logic (08-02): Full drift detection and auto-fix

Remaining operations work (if any) would be manual trigger endpoint.
