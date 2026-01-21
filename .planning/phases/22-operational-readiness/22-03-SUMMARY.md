---
phase: 22
plan: 03
title: "Incident Runbook and Rollback Documentation"
completed: 2026-01-21
duration: 3 min
status: complete

subsystem: operations/documentation
tags: [runbook, deployment, rollback, incident-response, operations]

dependency-graph:
  requires:
    - "22-01"  # Graceful shutdown (referenced in runbook recovery)
    - "22-02"  # Sentry monitoring (referenced in runbook)
  provides:
    - "Incident response procedures"
    - "Pre-deployment checklist"
    - "Rollback procedures"
  affects:
    - "Production operations"
    - "On-call procedures"

key-files:
  created:
    - docs/RUNBOOK.md
  modified:
    - docs/DEPLOYMENT.md

decisions:
  - decision: "Symptom-based runbook organization"
    rationale: "Operators diagnose by symptom first, then drill down"
  - decision: "7 incident scenarios"
    rationale: "Cover all critical and degraded service paths"
  - decision: "Cross-reference RUNBOOK and DEPLOYMENT"
    rationale: "Avoid duplication while maintaining discoverability"
---

# Phase 22 Plan 03: Incident Runbook and Rollback Documentation Summary

Comprehensive incident runbook created with symptom-based troubleshooting for 7 scenarios, plus enhanced pre-deployment checklist and rollback procedures in DEPLOYMENT.md.

## What Was Built

### Incident Runbook (docs/RUNBOOK.md)

Created 599-line incident runbook covering:

**Critical Incidents (Service Down):**
1. Application Won't Start - env vars, build failures, port conflicts
2. Discord Bot Offline - token issues, intents, rate limits
3. Stripe Webhooks Failing - signature verification, replay procedures
4. Email Delivery Failing - Resend API, domain verification
5. Database Connection Issues - Supabase pooler, project pausing

**Degraded Service Scenarios:**
6. Reconciliation Job Not Running - scheduler config, manual triggers
7. High Memory Usage - leak detection, PM2 auto-restart

**Recovery Procedures:**
- Quick rollback (no schema changes)
- Full rollback with database restore
- Stripe event replay instructions
- Emergency database restore

**Operational Support:**
- Quick reference commands (PM2, health check)
- External service status pages
- Escalation contacts template
- Incident response checklist

### Enhanced Rollback Documentation (docs/DEPLOYMENT.md)

Updated Section 9 with:

**Pre-Deployment Checklist (6 items):**
- Tag current release
- Note current commit hash
- Backup dist folder
- Note Supabase backup timestamp
- Check pending Stripe webhooks
- Verify health check

**Rollback Procedures:**
- Immediate rollback (~2 min) - code bugs, no schema changes
- Full rollback (5-15 min) - with database PITR restore

**Post-Rollback Recovery:**
- Stripe webhook replay steps
- Data reconciliation check
- User notification guidance
- Incident documentation template

**Zero-Downtime Deployment:**
- Expanded instructions with port swapping
- Load balancer/proxy configuration guidance

## Verification Results

| Check | Result |
|-------|--------|
| RUNBOOK.md exists | PASS |
| RUNBOOK.md lines | 599 (requirement: 200+) |
| 7 incident scenarios | PASS |
| Symptoms/Diagnosis/Recovery pattern | PASS (25 occurrences) |
| Pre-Deployment Checklist | PASS |
| Immediate rollback procedure | PASS |
| Full rollback procedure | PASS |
| Post-rollback recovery | PASS |
| Cross-reference to DEPLOYMENT.md | PASS |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Symptom-based organization | Operators start with what they observe, not what's broken |
| 7 scenarios (5 critical, 2 degraded) | Covers all major failure modes without overwhelming |
| Separate rollback types | Schema changes require database work; code-only is faster |
| 6-item pre-deployment checklist | Minimum needed for safe rollback capability |
| Cross-reference vs duplicate | RUNBOOK references DEPLOYMENT for rollback; avoids drift |

## Commits

| Hash | Description |
|------|-------------|
| b443f83 | docs(22-03): create incident runbook |
| a11e566 | docs(22-03): enhance rollback documentation |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 22 Plan 04 can proceed. This plan provides:
- Incident response procedures for operators
- Clear rollback capability for deployments
- Foundation for on-call rotation

No blockers identified.
