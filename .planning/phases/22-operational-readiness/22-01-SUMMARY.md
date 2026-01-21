---
phase: 22
plan: 01
subsystem: operations
tags: [graceful-shutdown, pm2, production, process-management]

dependency_graph:
  requires:
    - 01-foundation (Express server)
    - 02-discord (Discord bot client)
    - 01-database (Prisma client)
  provides:
    - graceful-shutdown-handlers
    - pm2-ecosystem-config
  affects:
    - 22-02 (Sentry may use shutdown hooks)
    - 22-03 (Runbook references shutdown behavior)

tech_stack:
  added: []
  patterns:
    - Signal handler pattern for SIGTERM/SIGINT
    - Timeout-based forced shutdown
    - PM2 ecosystem configuration

key_files:
  created:
    - ecosystem.config.cjs
  modified:
    - src/index.ts

decisions:
  - id: 22-01-01
    choice: 10-second app timeout, 15-second PM2 kill_timeout
    reason: PM2 needs longer timeout than app to allow graceful completion before SIGKILL
  - id: 22-01-02
    choice: isShuttingDown flag to prevent multiple triggers
    reason: Multiple SIGTERM signals during shutdown can cause race conditions
  - id: 22-01-03
    choice: HTTP -> Discord -> Prisma shutdown order
    reason: Stop new connections first, then cleanup stateful resources in dependency order

metrics:
  duration: 4 min
  completed: 2026-01-21
---

# Phase 22 Plan 01: Graceful Shutdown Summary

Graceful shutdown handlers with PM2 ecosystem configuration for production deployments

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Implement graceful shutdown in src/index.ts | 926ec0c | src/index.ts |
| 2 | Create PM2 ecosystem config | 07d1da8 | ecosystem.config.cjs |

## What Was Built

### Task 1: Graceful Shutdown Handlers

Added comprehensive shutdown handling to `src/index.ts`:

**Signal Handlers:**
- `SIGTERM` handler for PM2/container orchestrators
- `SIGINT` handler for Ctrl+C during development

**Shutdown Sequence:**
1. Stop accepting new HTTP connections via `server.close()`
2. Disconnect Discord bot via `discordClient.destroy()`
3. Close database connections via `prisma.$disconnect()`
4. Exit with code 0 on success

**Safety Features:**
- `isShuttingDown` flag prevents multiple shutdown triggers
- 10-second forced shutdown timeout with `process.exit(1)`
- Error handling with logged stack traces

### Task 2: PM2 Ecosystem Configuration

Created `ecosystem.config.cjs` with production-ready settings:

```javascript
{
  name: 'trc-gateway',
  script: 'dist/index.js',
  kill_timeout: 15000,        // 15s before SIGKILL
  max_memory_restart: '500M', // Restart on memory leak
  error_file: './logs/error.log',
  out_file: './logs/output.log'
}
```

**Key Settings:**
- `kill_timeout: 15000` - 5 seconds longer than app timeout for graceful completion
- `max_memory_restart: '500M'` - Protection against memory leaks
- Logging to `./logs/` directory with timestamps

## Verification Results

All verifications passed:

| Check | Result |
|-------|--------|
| `process.on('SIGTERM'` in index.ts | Found at line 203 |
| `process.on('SIGINT'` in index.ts | Found at line 204 |
| `gracefulShutdown` function | Implemented with timeout |
| `server.close()` | Called to stop new connections |
| `discordClient.destroy()` | Called for Discord cleanup |
| `prisma.$disconnect()` | Called for database cleanup |
| ecosystem.config.cjs exists | Created |
| ecosystem.config.cjs valid JavaScript | Syntax OK |
| kill_timeout is 15000 | Confirmed |

**Note:** TypeScript build has 6 pre-existing strict mode errors (documented in STATE.md). These are unrelated to this plan and do not affect the shutdown implementation.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| App timeout | 10 seconds | Sufficient for in-flight requests; PM2 SIGKILL at 15s provides buffer |
| PM2 kill_timeout | 15 seconds | Must be longer than app timeout (15s > 10s) |
| Shutdown order | HTTP -> Discord -> Prisma | Stop new work first, then cleanup dependencies |
| Multiple signal handling | isShuttingDown flag | Prevents race conditions from repeated signals |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**For Phase 22-02 (Sentry):**
- Server reference (`const server = app.listen(...)`) now captured for Sentry shutdown hooks if needed
- Shutdown handlers demonstrate the pattern for adding Sentry flush before exit

**For Phase 22-03 (Runbook):**
- Graceful shutdown behavior documented here for runbook reference
- PM2 configuration provides restart/stop commands for runbook
