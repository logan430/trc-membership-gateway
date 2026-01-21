# Phase 16: Data Integrity Audit - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify data constraints and transaction safety across the membership system. Audit Prisma schema constraints, cascade delete behavior, transaction atomicity, webhook idempotency, and Stripe source-of-truth alignment. This is a verification audit — document findings, don't fix during the audit phase.

</domain>

<decisions>
## Implementation Decisions

### Constraint verification approach
- Schema review PLUS edge case queries to verify constraints work in practice
- Check schema.prisma for missing/incorrect unique and foreign key constraints
- Run test queries to confirm constraints reject invalid data
- Document findings only — do not create migrations during audit
- Trust schema constraints to prevent orphans (no data queries for orphaned records)
- Claude's discretion on cascade delete verification method (schema review vs code path tracing)

### Transaction boundaries
- Review all $transaction usages and verify they are correct
- Document current partial failure behavior (DB + Discord) without changing it
- Fire-and-forget Discord pattern is expected — document but don't flag as issue
- Only verify existing transactions are correct — don't flag missing transactions
- Claude identifies which operations need transaction review based on risk

### Idempotency scope
- Verify all external event handlers: Stripe webhooks, Discord events, scheduled jobs
- Document findings only — don't add missing idempotency checks during audit
- Verify Stripe is source of truth both ways:
  - Data flow direction: DB only mirrors Stripe, never leads
  - Schema alignment: DB fields match what Stripe provides
- Claude determines if stripeEventId dedup logic needs explicit verification

### Claude's Discretion
- Verification method for cascade delete behavior
- Which operations need transaction safety review
- Depth of stripeEventId deduplication verification
- Classification of finding severity (informational, low, medium, high)

</decisions>

<specifics>
## Specific Ideas

- This is a documentation audit, not a fix-it phase — findings get documented for future work
- Focus on verifying what's implemented works correctly, not expanding scope
- Phase 15 (Security Audit) verified security controls — this phase is about data correctness

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-data-integrity-audit*
*Context gathered: 2026-01-20*
