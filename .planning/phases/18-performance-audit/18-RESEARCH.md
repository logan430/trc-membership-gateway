# Phase 18: Performance Audit - Research

**Researched:** 2026-01-21
**Domain:** Node.js/Express/Prisma performance auditing
**Confidence:** HIGH

## Summary

This research investigates tools and patterns for auditing performance in the existing TRC Membership Gateway application. The codebase uses Express 5.2.1, Prisma 7 with Supabase PostgreSQL (via Supavisor pooler), and Discord.js. The audit focuses on five areas: N+1 query detection, API response time measurement, connection pooling verification, Discord rate limit compliance, and memory leak detection.

The application already implements several performance best practices:
- Prisma `include` for eager loading (prevents most N+1 issues)
- Supabase pooler connection on port 6543 (transaction mode)
- Batch processing with 2-second delays for Discord operations
- Pino logger instead of console.log
- Fire-and-forget patterns for non-critical async operations

**Primary recommendation:** Use Prisma query logging and autocannon for baseline measurements. Static code analysis can verify N+1 patterns and connection pooling configuration without requiring load testing infrastructure.

## Standard Stack

The established tools for Node.js performance auditing:

### Core Tools

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Prisma Query Logging | Built-in | N+1 detection, query timing | Native, zero dependencies |
| autocannon | ^8.x | API response time benchmarks | Node.js native, percentile stats |
| process.memoryUsage() | Node.js built-in | Memory baseline measurement | Zero dependencies |
| clinic.js | ^14.x | CPU/memory profiling suite | Comprehensive, NearForm maintained |

### Supporting Tools

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| prom-client | ^15.x | Prometheus metrics | Production monitoring |
| express-prom-bundle | ^8.x | Express metrics middleware | Production dashboards |
| heapdump | ^0.3.x | Heap snapshot capture | Deep memory analysis |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| autocannon | wrk/wrk2 | wrk is C-based, faster but harder to integrate programmatically |
| clinic.js | 0x | 0x focuses only on CPU flames, clinic.js is more comprehensive |
| Manual logging | APM (Datadog/NewRelic) | APM adds cost, manual is sufficient for audit |

**Installation (for audit only):**
```bash
npm install -D autocannon clinic
```

## Architecture Patterns

### Prisma Query Logging Pattern

Configure Prisma to log queries with timing for audit:

```typescript
// src/lib/prisma.ts - Temporary audit configuration
const prisma = new PrismaClient({
  adapter,
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    { emit: 'stdout', level: 'error' },
  ],
});

// Subscribe to query events
prisma.$on('query', (e) => {
  if (e.duration > 100) { // Flag slow queries (>100ms)
    logger.warn({ query: e.query, duration: e.duration }, 'Slow query detected');
  }
});
```

**Source:** [Prisma Logging Documentation](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/logging)

### N+1 Detection Pattern

N+1 queries occur when code fetches a list then queries each item separately. In Prisma, this happens when NOT using `include`:

```typescript
// BAD: N+1 pattern (1 query for users + N queries for posts)
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { userId: user.id } });
}

// GOOD: Single query with eager loading
const users = await prisma.user.findMany({
  include: { posts: true }  // One query with JOIN
});
```

**Detection approach:** Grep for `findMany`/`findUnique` inside loops, or enable query logging and count queries per endpoint.

### Response Time Measurement Pattern

```typescript
// Middleware to log response times
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (duration > 200) {
      logger.warn({ path: req.path, duration }, 'Slow endpoint');
    }
  });
  next();
});
```

### Anti-Patterns to Avoid

- **Query inside loop:** Never call `prisma.x.findUnique` inside a `for` loop
- **Unbounded queries:** Always use pagination (`take`/`skip`) for list endpoints
- **Missing indexes:** Queries on non-indexed fields slow down over time
- **Global singleton without pooling:** Direct Postgres connections without pooler

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query timing | Manual timestamps | Prisma query events | Built-in, accurate, includes query text |
| Load testing | Custom scripts | autocannon | Handles connection management, percentiles |
| Memory profiling | setInterval + memoryUsage | clinic.js heapprofiler | Tracks allocations, not just totals |
| Response time tracking | Manual middleware | express-prom-bundle | Production-ready, Prometheus compatible |
| Rate limit tracking | Console logs | Discord.js built-in events | `client.rest.on('rateLimited', ...)` |

**Key insight:** Performance measurement tools have subtle requirements (high-resolution timing, GC awareness, percentile calculation) that are easy to get wrong.

## Common Pitfalls

### Pitfall 1: Measuring Development Performance
**What goes wrong:** Drawing conclusions from development machine benchmarks
**Why it happens:** Dev machines have different I/O, memory, and network characteristics
**How to avoid:** Document measurements as "baseline only," note environment
**Warning signs:** Extremely fast or slow results compared to production expectations

### Pitfall 2: N+1 Hidden by Small Data
**What goes wrong:** N+1 queries seem fine with test data (10 records), catastrophic with production data (10,000 records)
**Why it happens:** Query count scales with data volume
**How to avoid:** Test with realistic data volumes or extrapolate (10 queries for 10 records = 1000 queries for 1000 records)
**Warning signs:** Multiple similar queries in quick succession in query logs

### Pitfall 3: Connection Pool Exhaustion
**What goes wrong:** Pool configured but connections still exhaust under load
**Why it happens:** Pool size too small, or pool mode wrong (session vs transaction)
**How to avoid:** Verify Supabase pooler is on port 6543 (transaction mode), check pool size in dashboard
**Warning signs:** "connection timeout" errors, increasing latency under load

### Pitfall 4: Discord Rate Limit Bypass Claims
**What goes wrong:** Assuming rate limits are handled because discord.js doesn't error
**Why it happens:** Discord.js queues requests, doesn't reject them
**How to avoid:** Monitor `client.rest.on('rateLimited')` events, verify batch delays work
**Warning signs:** Operations taking longer than expected, 429 status codes in Discord logs

### Pitfall 5: Memory "Leak" vs Normal GC
**What goes wrong:** Flagging normal memory growth as a leak
**Why it happens:** Node.js GC is lazy, memory rises until threshold triggers collection
**How to avoid:** Measure over extended period (minutes, not seconds), trigger manual GC for baseline
**Warning signs:** Memory that grows forever vs memory that stabilizes after GC

## Code Examples

### Current Codebase Patterns (Verified)

The application already uses proper patterns:

**Eager loading with include (prevents N+1):**
```typescript
// src/routes/team-dashboard.ts:55-75
const team = await prisma.team.findUnique({
  where: { id: member.teamId },
  include: {
    members: {
      select: { /* specific fields */ },
      orderBy: [/* sorting */],
    },
  },
});
```

**Batch processing with rate limit protection:**
```typescript
// src/reconciliation/auto-fixer.ts:7-9
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000; // 2 seconds between batches (Discord: 10 role ops per 10s)
```

**Connection pooling via adapter:**
```typescript
// src/lib/prisma.ts:12-14
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // Uses Supabase pooler (port 6543)
});
const adapter = new PrismaPg(pool);
```

### Audit Query Logging Setup

```typescript
// Temporary: Enable for audit phase only
const prisma = new PrismaClient({
  adapter,
  log: process.env.AUDIT_QUERY_LOG === 'true'
    ? [{ emit: 'event', level: 'query' }]
    : [{ emit: 'stdout', level: 'error' }],
});

if (process.env.AUDIT_QUERY_LOG === 'true') {
  prisma.$on('query', (e) => {
    logger.info({
      query: e.query.slice(0, 200), // Truncate for readability
      duration: e.duration,
      params: e.params
    }, 'Query executed');
  });
}
```

### Autocannon Benchmark Example

```bash
# Basic endpoint benchmark (10 seconds, 10 connections)
npx autocannon -d 10 -c 10 http://localhost:3000/health

# Authenticated endpoint (requires token)
npx autocannon -d 10 -c 10 -H "Authorization: Bearer <token>" http://localhost:3000/dashboard

# POST endpoint with body
npx autocannon -d 10 -c 10 -m POST -H "Content-Type: application/json" \
  -b '{"email":"test@example.com"}' http://localhost:3000/auth/login
```

### Memory Baseline Check

```typescript
// Simple memory check (add to health endpoint for audit)
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma middleware for logging | Query events + extensions | Prisma 6.14+ | Middleware deprecated, use $on('query') |
| Manual connection pooling | Adapter pattern + Supavisor | Prisma 5+/Supabase 2024 | Simpler config, better performance |
| Express 4 async errors | Express 5 native async | Express 5.0 (2024) | No need for express-async-errors |
| wrk for benchmarks | autocannon with workers | autocannon v8 | Better Node.js integration |

**Deprecated/outdated:**
- `prisma.$use()` middleware - Removed in Prisma 6.14+, use `$on('query')` event
- `pg-pool` manual config - Supabase pooler handles this server-side
- Metrics preview feature - Removed in Prisma 7.0, use OpenTelemetry or query logging

## Verification Checklist for Audit

Based on the phase requirements, here's what to verify:

### 1. N+1 Query Detection
- [ ] Enable query logging temporarily
- [ ] Hit each endpoint and count queries
- [ ] Look for repeated similar queries
- [ ] Verify all `findMany` with relations use `include`

### 2. API Response Times (<200ms target)
- [ ] List all API endpoints
- [ ] Benchmark each with autocannon
- [ ] Document p50, p95, p99 latencies
- [ ] Flag any endpoint >200ms p95

### 3. Connection Pooling
- [ ] Verify DATABASE_URL uses port 6543 (Supavisor transaction mode)
- [ ] Check Supabase dashboard for pool settings
- [ ] Document pool size configuration

### 4. Discord Rate Limits
- [ ] Verify BATCH_SIZE=5 and BATCH_DELAY_MS=2000 in auto-fixer.ts
- [ ] Verify p-retry usage in role-assignment.ts
- [ ] Check for `client.rest.on('rateLimited')` listener (add if missing for audit)

### 5. Memory Leak Detection
- [ ] Add memory to /health endpoint
- [ ] Run app for extended period (10+ minutes)
- [ ] Check if heap grows unbounded
- [ ] Document baseline memory usage

## Open Questions

Things that couldn't be fully resolved:

1. **Load Testing Environment**
   - What we know: Can use autocannon locally
   - What's unclear: Whether to benchmark against local, staging, or production
   - Recommendation: Benchmark locally with documented baseline, note it's not production-representative

2. **Supabase Pool Size Optimal Value**
   - What we know: Supabase recommends 40-80% of max connections
   - What's unclear: Current pool size configuration for this project
   - Recommendation: Check Supabase dashboard during audit, document current setting

3. **Memory Leak Threshold**
   - What we know: Node.js GC is lazy, some growth is normal
   - What's unclear: What constitutes "acceptable" growth for this app
   - Recommendation: Establish baseline, flag if heap doubles without GC

## Sources

### Primary (HIGH confidence)
- [Prisma Logging Documentation](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/logging) - Query events and duration tracking
- [Supabase Connection Management](https://supabase.com/docs/guides/database/connection-management) - Pooler configuration
- [autocannon GitHub](https://github.com/mcollina/autocannon) - Benchmarking tool usage

### Secondary (MEDIUM confidence)
- [Discord Rate Limits Documentation](https://discord.com/developers/docs/topics/rate-limits) - Verified 50 req/sec global, 10 role ops/10s
- [Prisma N+1 Best Practices](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries) - Eager loading patterns
- [Clinic.js Documentation](https://clinicjs.org/) - Memory profiling approach

### Tertiary (LOW confidence)
- Blog posts on memory leak patterns - Useful patterns but may vary by Node version
- Performance benchmark comparisons - Environment-specific results

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Tools are well-documented, widely used
- N+1 patterns: HIGH - Prisma documentation is authoritative
- Response time measurement: HIGH - Node.js built-ins, autocannon is standard
- Connection pooling: MEDIUM - Supabase-specific, dashboard verification needed
- Memory leak detection: MEDIUM - Detection is straightforward, thresholds are app-specific
- Discord rate limits: HIGH - Discord.js handles automatically, existing code has correct delays

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable domain, tools don't change frequently)
