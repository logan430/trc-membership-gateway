# Phase 17: Code Quality Audit - Research

**Researched:** 2026-01-21
**Domain:** TypeScript/Node.js code quality analysis and technical debt identification
**Confidence:** HIGH

## Summary

This research identifies the standard tools and approaches for auditing code quality in a TypeScript/Node.js Express application. The phase goal is to produce a prioritized technical debt report without making fixes.

The established approach uses **Knip** for dead code detection (replacing the now-deprecated ts-prune), **TypeScript compiler** with strict settings for type analysis, **dpdm** or **madge** for circular dependency detection, **npm audit** for security vulnerabilities, and **grep/search** for console statement discovery. ESLint with `@typescript-eslint/no-explicit-any` provides explicit `any` detection.

**Primary recommendation:** Use Knip as the primary dead code analyzer (handles unused exports, files, and dependencies in one tool), combine with TypeScript strict compilation for type issues, and dpdm for circular dependencies. Output results in JSON format where possible for structured reporting.

## Standard Stack

The established tools for code quality auditing:

### Core Audit Tools
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| [Knip](https://knip.dev) | 5.x | Dead code detection | Successor to ts-prune, actively maintained, comprehensive coverage |
| TypeScript | 5.9+ | Type checking with strict mode | Already in project, detects implicit `any` via `noImplicitAny` |
| dpdm | 3.x | Circular dependency detection | TypeScript-native, fast, simple output |
| npm audit | Built-in | Security vulnerability scanning | Built into npm, authoritative security database |

### Supporting Tools
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| madge | 8.x | Circular deps + visualization | If visual dependency graph needed |
| ESLint + @typescript-eslint | 8.x | Explicit `any` detection | If ESLint config exists, use `no-explicit-any` rule |
| depcheck | N/A | Unused dependencies | Not recommended - use Knip instead (more maintained) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Knip | ts-prune | ts-prune is archived/deprecated, Knip is successor |
| dpdm | madge | madge requires Graphviz for visuals, dpdm simpler for CLI |
| npm audit | Snyk | Snyk has broader coverage but requires account/setup |

**Installation (audit tools only, do not add to project permanently):**
```bash
# Run without installing (recommended for one-time audit)
npx knip
npx dpdm ./src/index.ts
npm audit

# If permanent installation desired:
npm install -D knip dpdm
```

## Architecture Patterns

### Audit Output Structure
```
.planning/
├── CODE-QUALITY-AUDIT.md      # Main audit report
├── issues/                    # If creating GitHub issues
│   ├── dead-code-issues.json
│   ├── type-issues.json
│   └── dependency-issues.json
```

### Pattern 1: Knip Configuration for Express Project
**What:** Configure Knip to understand the project's entry points
**When to use:** Before running Knip to avoid false positives

**Example:**
```json
// knip.json (create in project root)
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/index.ts"],
  "project": ["src/**/*.ts"],
  "ignore": ["**/*.test.ts", "**/*.spec.ts"],
  "ignoreDependencies": [
    "pino-pretty"  // Used at runtime via transport
  ]
}
```

### Pattern 2: Running Comprehensive Audit
**What:** Execute all audit tools and capture output
**When to use:** During the audit phase

**Example:**
```bash
# 1. Dead code analysis (Knip)
npx knip --reporter json > .planning/knip-output.json
npx knip  # Human-readable summary

# 2. TypeScript strict check (already in project)
npx tsc --noEmit --strict  # Check for type errors

# 3. Circular dependencies
npx dpdm --no-warning --no-tree ./src/index.ts
npx dpdm --exit-code circular:1 ./src/index.ts  # Returns 1 if circular deps exist

# 4. Security audit
npm audit --json > .planning/npm-audit.json
npm audit  # Human-readable summary

# 5. Find console statements (grep)
# Use Grep tool to search for console.log, console.warn, etc.
```

### Pattern 3: Severity Classification
**What:** Categorize findings by business impact
**When to use:** When organizing audit results

| Severity | Definition | Examples |
|----------|------------|----------|
| Critical | Security risk or data loss potential | npm audit critical, explicit `any` in auth code |
| High | Blocks or degrades functionality | Circular dependencies, unused exports in public API |
| Medium | Tech debt affecting maintainability | Unused files, implicit `any` types |
| Low | Cleanup items, informational | Unused devDependencies, console.log in dev paths |

### Anti-Patterns to Avoid
- **Fixing during audit:** The phase goal is documentation only - resist fixing
- **Including test files in dead code analysis:** Tests often have unused exports intentionally
- **Treating all npm audit findings equally:** Focus on production dependencies first

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Find unused exports | Manual file-by-file review | Knip | Project-wide graph analysis catches cross-file issues |
| Find circular deps | AST parsing scripts | dpdm/madge | Complex import resolution already solved |
| Security scanning | Grep for known CVEs | npm audit | Authoritative database, auto-updated |
| Find `any` types | Grep for `: any` | TypeScript + ESLint | Catches implicit any, type inference |
| Find console.log | Manual code review | Grep tool or ESLint | Comprehensive, repeatable |

**Key insight:** Code quality tools build project-wide dependency graphs that manual review cannot replicate efficiently.

## Common Pitfalls

### Pitfall 1: False Positives in Dead Code Detection
**What goes wrong:** Knip reports exports as unused when they're dynamically imported or used by external consumers
**Why it happens:** Static analysis cannot trace runtime dynamic imports or external package usage
**How to avoid:**
- Configure `ignoreDependencies` for runtime-only packages (like `pino-pretty`)
- Review findings before acting - audit phase is for documentation, not deletion
**Warning signs:** Utility libraries, configuration exports, or provider patterns flagged as unused

### Pitfall 2: Implicit vs Explicit `any` Confusion
**What goes wrong:** Searching only for explicit `: any` misses implicit `any` from missing type annotations
**Why it happens:** TypeScript's `noImplicitAny` catches implicit, but not explicit `any`
**How to avoid:**
- Run `tsc --noEmit --strict` to catch implicit `any`
- Use ESLint `@typescript-eslint/no-explicit-any` to catch explicit `any`
- Document both categories separately in audit
**Warning signs:** Clean grep results but TypeScript errors when enabling strict mode

### Pitfall 3: npm audit Noise
**What goes wrong:** Hundreds of moderate/low findings overwhelm actual security issues
**Why it happens:** Transitive dependencies, dev-only vulnerabilities, theoretical exploits
**How to avoid:**
- Prioritize Critical and High severity in production dependencies
- Use `npm audit --omit=dev` to focus on production deps
- Check if vulnerability is exploitable in your context
**Warning signs:** Audit report too long to be actionable

### Pitfall 4: Console.log in Server-Side Code
**What goes wrong:** Removing all console statements breaks intentional logging
**Why it happens:** Server apps legitimately use console for startup messages, structured logging
**How to avoid:**
- Note: This project uses Pino logger, not console - verify this during audit
- Flag `console.log` only, note `console.error`/`console.warn` for awareness
- Check context: startup messages are legitimate, debug statements are not
**Warning signs:** Console statements in catch blocks or startup sequences

### Pitfall 5: Circular Dependencies That Aren't Problems
**What goes wrong:** Flagging type-only circular imports as issues
**Why it happens:** TypeScript type imports don't cause runtime circular dependency issues
**How to avoid:**
- Use `dpdm -T` to transform/ignore type-only dependencies
- Check if circular path involves only type imports
- Focus on runtime circular imports that could cause undefined behavior
**Warning signs:** Circular deps involving only interface/type files

## Code Examples

Verified patterns from official sources:

### Running Knip
```bash
# Source: https://knip.dev/overview/getting-started

# Basic run (human-readable output)
npx knip

# JSON output for processing
npx knip --reporter json

# Limit output for large codebases
npx knip --max-show-issues 10

# Include entry file exports (normally excluded)
npx knip --include-entry-exports
```

### Running dpdm for Circular Dependencies
```bash
# Source: https://github.com/acrazing/dpdm

# Basic usage
npx dpdm ./src/index.ts

# Show only circular deps (no tree, no warnings)
npx dpdm --no-warning --no-tree ./src/index.ts

# Exit with error if circular deps found (for CI)
npx dpdm --exit-code circular:1 ./src/index.ts

# Ignore type-only imports
npx dpdm -T ./src/index.ts

# Specify tsconfig for path aliases
npx dpdm --tsconfig ./tsconfig.json ./src/index.ts
```

### npm audit Commands
```bash
# Source: https://docs.npmjs.com/cli/v10/commands/npm-audit

# Basic audit (human-readable)
npm audit

# JSON output for processing
npm audit --json

# Production dependencies only
npm audit --omit=dev

# Set minimum severity for non-zero exit
npm audit --audit-level=high

# Combined: production deps, high+ severity, JSON
npm audit --omit=dev --audit-level=high --json
```

### TypeScript Strict Mode Check
```bash
# Source: TypeScript documentation

# Check for type errors without emitting
npx tsc --noEmit

# Force strict mode check (even if tsconfig has different settings)
npx tsc --noEmit --strict

# Check specific strict flags
npx tsc --noEmit --noImplicitAny --strictNullChecks
```

### ESLint Check for Explicit Any (if ESLint configured)
```bash
# Source: https://typescript-eslint.io/rules/no-explicit-any/

# Run ESLint with specific rule (if not in config)
npx eslint --rule '@typescript-eslint/no-explicit-any: error' 'src/**/*.ts'

# Or if configured, just run
npx eslint src/
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-prune for dead code | Knip | 2023 | ts-prune archived, Knip is official successor |
| Manual dependency review | Knip (includes deps) | 2023 | One tool handles exports, files, and dependencies |
| depcheck for unused deps | Knip | 2024 | depcheck maintenance mode, recommends Knip |
| eslint-plugin-import | ESLint + typescript-eslint | 2024 | Better TypeScript integration |

**Deprecated/outdated:**
- **ts-prune:** Archived, use Knip instead
- **depcheck:** Maintenance mode, Knip recommended
- **tslint:** Deprecated years ago, use ESLint

## Open Questions

Things that couldn't be fully resolved:

1. **ESLint Configuration Status**
   - What we know: No `.eslintrc.json` found in project root
   - What's unclear: Is ESLint configured elsewhere? Via package.json?
   - Recommendation: Check if ESLint is set up; if not, use TypeScript compiler for type checking

2. **Logging Library Usage**
   - What we know: Project uses Pino logger (seen in src/index.ts)
   - What's unclear: Is Pino used consistently everywhere? Any console.log remnants?
   - Recommendation: Verify no console.log exists (initial grep showed 0 matches)

3. **Test File Coverage**
   - What we know: vitest is in devDependencies
   - What's unclear: Are there test files? How many?
   - Recommendation: Exclude test files from dead code analysis; document test coverage separately

## Sources

### Primary (HIGH confidence)
- [Knip Official Documentation](https://knip.dev) - Getting started, configuration, entry files
- [TypeScript-ESLint no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any/) - Rule options, detection patterns
- [dpdm GitHub](https://github.com/acrazing/dpdm) - CLI usage, options
- [npm audit documentation](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/) - Command options, severity levels

### Secondary (MEDIUM confidence)
- [Effective TypeScript - Knip recommendation](https://effectivetypescript.com/2023/07/29/knip/) - ts-prune to Knip migration
- [npm security best practices](https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html) - OWASP guidance
- [TypeScript strict mode guide](https://learntypescript.dev/11/l6-strictness/) - Strict options explained

### Tertiary (LOW confidence)
- Various Medium/Dev.to articles on audit workflows - community patterns only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation verified for Knip, dpdm, npm audit
- Architecture: HIGH - Based on official tool documentation and established patterns
- Pitfalls: MEDIUM - Based on community reports and documentation warnings

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable tools, well-documented)

---

## Appendix: Quick Reference Commands

For the planner to reference when creating tasks:

```bash
# Dead code (Knip)
npx knip
npx knip --reporter json > knip-output.json

# Circular dependencies (dpdm)
npx dpdm --no-warning --no-tree ./src/index.ts
npx dpdm -T ./src/index.ts  # Ignore type-only imports

# Security audit (npm)
npm audit
npm audit --json > npm-audit.json
npm audit --omit=dev --audit-level=high

# Type checking (TypeScript)
npx tsc --noEmit --strict

# Console statements (Grep tool)
# Search for: console\.(log|warn|error|debug|info)
# Path: src/
```

## Appendix: Audit Report Template

Recommended structure for the final audit report:

```markdown
# Code Quality Audit Report

**Date:** YYYY-MM-DD
**Scope:** [files/directories audited]

## Executive Summary
- X critical issues found
- Y high priority items
- Z medium/low items

## Critical Issues
| ID | Type | Location | Description | Remediation |
|----|------|----------|-------------|-------------|
| C1 | [type] | file:line | description | fix guidance |

## High Priority Items
[Same table format]

## Medium Priority Items
[Same table format]

## Low Priority / Informational
[Same table format]

## Tool Outputs
### Knip Summary
[Paste or summarize knip output]

### npm audit Summary
[Paste or summarize audit output]

### Circular Dependencies
[List any found]

## Recommendations
1. [Prioritized recommendation]
2. [Prioritized recommendation]

## GitHub Issues Created
- [Issue #X: Title](link)
- [Issue #Y: Title](link)
```
