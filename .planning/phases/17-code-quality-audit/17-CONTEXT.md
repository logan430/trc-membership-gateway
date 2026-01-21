# Phase 17: Code Quality Audit - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit the codebase for technical debt: dead code, type issues, console.log statements, outdated dependencies, and circular dependencies. Document findings without making fixes — this is an informational audit that produces a prioritized report for future cleanup.

</domain>

<decisions>
## Implementation Decisions

### Fix vs Document Threshold
- Document only, do not fix during audit
- Produce prioritized list with Critical/High/Medium/Low severity
- Output format: Markdown report in .planning/ AND GitHub issues for actionable items
- Audit is informational only — does not block production deployment

### Type Strictness
- Document all `any` types found, fix none
- Include missing return types on functions in audit
- Document current tsconfig strict mode settings without recommending changes

### Console.log Handling
- Flag console.error and console.warn for awareness but don't recommend removal
- Can recommend a logging library if warranted, but don't implement

### Claude's Discretion
- Whether to flag implicit `any` from untyped parameters (context-dependent)
- How to distinguish server-side vs client-side console.log (determine appropriate handling)
- Console.log goal: Claude recommends "Keep intentional ones" — remove debug logs, keep startup/critical info logs
- Dependency update scope: Claude recommends security vulnerabilities + major versions behind as priority

### Dependency Audit
- Audit only, no updates during this phase
- Flag deprecations (deprecated packages and APIs)
- Flag unused dependencies as low priority/informational

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard audit approaches.

Report should be actionable for a future cleanup phase or sprint planning.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-code-quality-audit*
*Context gathered: 2026-01-21*
