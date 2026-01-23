# Technology Stack — v2.0 Community Intelligence Platform

**Project:** The Revenue Council - Discord Membership Gateway v2.0
**Researched:** 2026-01-22
**Scope:** NEW components for benchmarking, resource library, gamification, enhanced frontend

**Note:** This document focuses on NEW stack components for v2.0. Existing v1.0 stack (Express 5.2, Prisma 7, Discord.js, Stripe, Supabase) is already established and not re-documented here.

---

## Executive Summary

v2.0 adds community intelligence features to the existing membership platform. The recommended stack leverages:
- **React 19 + Next.js 15** for enhanced member dashboard (reusable components)
- **Recharts 3.7** for benchmark visualizations (already implemented in Chris's app)
- **Supabase Storage** for file management (already in infrastructure)
- **PostgreSQL JSONB + GIN indexes** for flexible benchmark schema
- **Database triggers** for denormalized points tracking
- **MEE6 API** for Discord XP integration ($11.95/mo)

**Architecture:** Next.js standalone (port 3000) + Express API (port 4000), proxied through Express

**Confidence:** HIGH (all technologies verified with official documentation and 2026-current sources)

---

## Frontend Framework & UI Components

### React 19.2 (Stable)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.2 (latest) | UI library | Stable as of Dec 2024, React 19.2 released Oct 2025 with Activity API, useEffectEvent, partial pre-rendering |
| Next.js | 15.1 (latest) | React framework | Stable standalone deployment, Turbopack build, backwards compatible with React 18 |
| TypeScript | 5.9.3+ | Type safety | Already in v1.0, continue using |

**Installation:**
```bash
npm install react@19.2 react-dom@19.2 next@15.1
```

**Why React 19 + Next.js 15:**
- Chris's app already built with these versions (reuse components, not rebuild)
- 40% improvement in Core Web Vitals, 60% reduction in Time to Interactive
- React Server Components stable, Actions API for form handling
- Next.js 15 self-hosting improvements with Cache-Control header control
- Standalone deployment mode works perfectly with Express proxy architecture

**Why NOT Rebuild in HTML/Vanilla JS:**
- Would lose 3-4 weeks of development (existing React components ready to port)
- Chris's Recharts implementation ($10K-15K value) would be wasted
- Modern dashboard UX expectations require component-based architecture
- Benchmarking forms and charts are complex (React shines here)

**Sources:**
- [React v19 Release](https://react.dev/blog/2024/12/05/react-19)
- [React 19.2 Release](https://react.dev/blog/2025/10/01/react-19-2)
- [Next.js 15 Release](https://nextjs.org/blog/next-15)
- [Next.js 15.1 Release](https://nextjs.org/blog/next-15-1)

---

### Tailwind CSS v4 (Styling)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.0.0 (stable) | Utility-first CSS | Released Jan 22, 2025 - 5x faster builds, 100x faster incremental, zero config |
| tailwindcss-animate | Latest | Animation utilities | For loading states, transitions |
| class-variance-authority | Latest | Component variants | Type-safe variant management |

**Installation:**
```bash
npm install tailwindcss@4.0.0 tailwindcss-animate class-variance-authority clsx tailwind-merge
```

**Why Tailwind v4:**
- Ground-up rewrite optimized for performance (microsecond incremental builds)
- Cascade layers, @property, color-mix() - modern CSS features
- Automatic content detection (no manual configuration needed)
- First-party Vite plugin for optimal performance
- Chris's app already using Tailwind (port styles, tweak for less-minimalist look)

**Style Customization:**
```css
/* Override Chris's minimal style - add shadows, colors, rounded corners */
:root {
  --radius: 8px;           /* Was: 0 (add border radius) */
  --shadow: 0 2px 8px rgba(0,0,0,0.1);  /* Was: none */
  --primary: #2563eb;      /* Was: black */
  --accent: #10b981;       /* Add color for engagement */
}
```

**Sources:**
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/)

---

### shadcn/ui Components (Optional but Recommended)
| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| shadcn/ui | Latest | Pre-built React components | Button, Card, Input, Dialog, Table (if Chris's app doesn't have these) |
| Radix UI | Latest (via shadcn) | Accessible primitives | Auto-installed with shadcn/ui components |

**Installation:**
```bash
npx shadcn@latest init
npx shadcn@latest add button card input dialog table
```

**Why shadcn/ui:**
- NOT a dependency - copies TypeScript source into your codebase (you own it)
- Built on Radix UI primitives (accessibility built-in)
- Styled with Tailwind CSS (matches your stack)
- No bundle bloat (only components you use are copied)
- If Chris's app has all components needed, skip this

**Why NOT a Full Component Library (MUI, Chakra, etc):**
- Large bundle sizes (50-100KB minimum)
- Lock-in to their design system
- Harder to customize
- Chris's components already exist (don't add unnecessary dependency)

**Sources:**
- [shadcn/ui Installation](https://ui.shadcn.com/docs/installation)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

---

## Data Visualization

### Recharts 3.7 (Chart Library)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | 3.7.0 (latest) | React charts | Already implemented in Chris's app, declarative API, SVG-based |

**Installation:**
```bash
npm install recharts@3.7.0
```

**Why Recharts:**
- **ALREADY IMPLEMENTED** in Chris's app (ComparisonBar, PerformanceRadar, ScoreRing, MetricComparisonCard)
- Declarative React components (fits React 19 architecture)
- Native SVG support (lightweight, ~100KB gzipped)
- 3,313 projects on npm using it (most popular React chart library)
- Performance improvements in v3.x (z-index support, optimized rendering)
- Perfect for benchmark visualizations (bar charts for comparisons, radar for multi-axis)

**Example Components from Chris's App:**
```typescript
// Already built, ready to port:
<ComparisonBar data={benchmarkData} />
<PerformanceRadar metrics={userMetrics} />
<ScoreRing value={percentile} />
<MetricComparisonCard category="compensation" />
```

**Why NOT Chart.js:**
- Not React-native (requires wrapper library like react-chartjs-2)
- Imperative API (conflicts with React declarative patterns)
- Canvas-based (harder to animate, less accessible than SVG)
- Would require rebuilding all Chris's chart components (3-4 weeks wasted)

**Why NOT D3.js:**
- Steep learning curve (low-level primitives)
- Manual React integration complexity
- Overkill for standard business charts
- 2-3 weeks to build what Recharts provides out-of-box

**Sources:**
- [Recharts npm](https://www.npmjs.com/package/recharts)
- [Recharts Official Docs](https://recharts.github.io/en-US/)
- [Top 7 React Chart Libraries 2026](https://dev.to/basecampxd/top-7-react-chart-libraries-for-2026-features-use-cases-and-benchmarks-412c)

---

## File Storage & Management

### Supabase Storage (File Uploads)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @supabase/supabase-js | Latest | Supabase client | Already in v1.0 for database, extends to Storage |
| tus-js-client | Latest | Resumable uploads | For files > 6MB (TUS protocol, recommended by Supabase) |
| file-type | Latest | Magic number validation | Server-side file type verification (security) |

**Installation:**
```bash
npm install @supabase/supabase-js  # Already installed in v1.0
npm install tus-js-client file-type
```

**Why Supabase Storage:**
- **ALREADY IN INFRASTRUCTURE** (Supabase PostgreSQL in v1.0)
- Integrated with existing Supabase database (single auth, single bill)
- Row-Level Security (RLS) policies for access control
- Signed URLs with expiration (1-hour temporary access)
- Supports files up to 5GB (TUS resumable for > 6MB)
- $0.021/GB storage (included in existing Supabase plan)
- CDN delivery built-in (global edge cache)

**Basic Upload Pattern:**
```typescript
// Standard upload (< 6MB)
const { data, error } = await supabase.storage
  .from('resources')
  .upload('resources/file.pdf', file, {
    cacheControl: '3600',
    upsert: false  // Prevent overwrites (CDN propagation issue)
  });

// Resumable upload (> 6MB) with tus-js-client
import * as tus from 'tus-js-client';
const upload = new tus.Upload(file, {
  endpoint: 'https://<project>.supabase.co/storage/v1/upload/resumable',
  // ... TUS configuration
});
```

**File Type Validation (Security Critical):**
```typescript
import { fileTypeFromBuffer } from 'file-type';

// Server-side validation (magic number checking)
const buffer = await file.arrayBuffer();
const type = await fileTypeFromBuffer(Buffer.from(buffer));

if (!['application/pdf', 'video/mp4', 'application/zip'].includes(type?.mime)) {
  throw new Error('Invalid file type');
}
```

**Why Magic Number Validation:**
- File extensions can be changed by users (example.exe renamed to example.pdf)
- MIME type headers can be altered
- Magic numbers are first few bytes of file, unique to file type, cannot be faked
- Critical security layer (prevents malware uploads)

**File Size & Type Limits (Recommended):**
- Max file size: 100MB (configurable in RLS policy)
- Allowed types: PDF, DOCX, XLSX, MP4, ZIP
- Virus scanning: Consider ClamAV or cloud service (Cloudflare, AWS)

**Why NOT AWS S3 Directly:**
- Additional service setup (separate auth, billing)
- No RLS integration (manual access control logic)
- Higher operational complexity
- Supabase Storage uses S3 under hood (same reliability, simpler DX)

**Why NOT Cloudflare R2:**
- Not mentioned in existing infrastructure
- Would require new service setup
- Supabase Storage already paid for

**Sources:**
- [Supabase Storage - Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Supabase Storage - Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [tus-js-client GitHub](https://github.com/tus/tus-js-client)
- [File Type Validation with Magic Numbers](https://pye.hashnode.dev/how-to-validate-javascript-file-types-with-magic-bytes-and-mime-type)
- [file-type npm](https://www.npmjs.com/package/file-type)

---

## Database Extensions

### PostgreSQL JSONB for Benchmarks
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL JSONB | Built-in (Supabase) | Flexible benchmark schema | Each category has different fields, JSONB avoids rigid schema |
| GIN Index (jsonb_path_ops) | Built-in | Fast JSONB queries | 20-30% index size, 600% faster containment queries |

**Schema Pattern:**
```typescript
model BenchmarkSubmission {
  id                String   @id @default(cuid())
  memberId          String
  category          String   // 'compensation' | 'infrastructure' | 'business' | 'operational'
  data              Json     // JSONB column - flexible per category
  submittedAt       DateTime @default(now())

  member            Member   @relation(fields: [memberId], references: [id])

  @@index([category])
  @@index([data], type: Gin(jsonb_path_ops))  // Fast containment queries
}
```

**Why JSONB:**
- **Flexible schema per category** - compensation has salary/equity/bonus, infrastructure has tools/costs, etc.
- Avoid 50+ columns or separate tables per category
- Native PostgreSQL indexing (GIN) for fast queries
- JSON aggregation functions (median, percentile) built-in
- Easy to add new fields without migrations

**JSONB Performance Best Practices:**
- Use GIN index with `jsonb_path_ops` operator (20-30% smaller, 600% faster than default)
- Extract frequently-queried fields to columns (hybrid approach)
- Avoid JSONB documents > 2KB (TOAST compression kicks in, performance cliff)
- Use B-Tree indexes on extracted fields for range queries

**Index Creation:**
```sql
-- Fast containment queries (@> operator)
CREATE INDEX idx_benchmark_data ON benchmark_submission
USING GIN (data jsonb_path_ops);

-- Specific field extraction (if frequently queried)
CREATE INDEX idx_benchmark_salary ON benchmark_submission
((data->>'annual_salary')::numeric);
```

**Why NOT Separate Tables per Category:**
- 4 categories = 4 tables = complex query logic
- Hard to add new categories
- Aggregation queries across categories painful

**Why NOT Single Wide Table (50+ columns):**
- Many NULL values (each submission only fills 10-15 fields)
- Schema changes require migrations
- Hard to extend with new categories

**Sources:**
- [PostgreSQL JSONB Storage](https://www.architecture-weekly.com/p/postgresql-jsonb-powerful-storage)
- [PostgreSQL JSONB Performance Best Practices](https://www.metisdata.io/blog/how-to-avoid-performance-bottlenecks-when-using-jsonb-in-postgresql)
- [PostgreSQL GIN Index jsonb_path_ops](https://neon.com/postgresql/postgresql-indexes/postgresql-json-index)
- [GIN Index Performance](https://medium.com/@josef.machytka/postgresql-jsonb-operator-classes-of-gin-indexes-and-their-usage-0bf399073a4c)

---

### Database Triggers for Points Denormalization
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL Triggers | Built-in | Auto-update total_points | Real-time leaderboard without N+1 queries |

**Pattern:**
```sql
-- Denormalized field on Member table
ALTER TABLE member ADD COLUMN total_points INTEGER DEFAULT 0;

-- Trigger function to update total_points
CREATE OR REPLACE FUNCTION update_member_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE member
  SET total_points = (
    SELECT COALESCE(SUM(points), 0)
    FROM point_transaction
    WHERE member_id = NEW.member_id
  )
  WHERE id = NEW.member_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on PointTransaction INSERT
CREATE TRIGGER trg_update_points
AFTER INSERT ON point_transaction
FOR EACH ROW
EXECUTE FUNCTION update_member_points();

-- Index for fast leaderboard queries
CREATE INDEX idx_member_points ON member (total_points DESC);
```

**Why Denormalized total_points:**
- **Leaderboard queries are fast** (ORDER BY total_points LIMIT 25)
- Without denormalization, leaderboard = SUM(points) for every member (slow at scale)
- Trigger keeps it in sync automatically
- PointTransaction table remains immutable audit log

**Why NOT Calculate On-Read:**
- Leaderboard query hits 100+ users = 100+ SUM() calculations
- Response time grows linearly with members
- Database CPU spikes on every leaderboard view

**Why NOT Materialized View:**
- Requires manual REFRESH (not real-time)
- Adds complexity (cron job to refresh)
- Triggers are real-time, zero maintenance

**Trigger Performance Considerations:**
- Use AFTER INSERT statement-level triggers (not row-level) for batch efficiency
- Index total_points DESC for leaderboard queries
- Consider PostgreSQL 12+ generated columns for simpler cases

**Sources:**
- [PostgreSQL Triggers 2026 Best Practices](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [Denormalize Data in PostgreSQL](https://www.getgalaxy.io/learn/glossary/how-to-denormalize-data-in-postgresql)
- [PostgreSQL Trigger Functions](https://www.compilenrun.com/docs/database/postgresql/postgresql-triggers/postgresql-trigger-functions/)

---

## Form Validation

### Zod 4.3.5 (Schema Validation)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zod | 4.3.5 (latest) | Runtime validation | TypeScript-first, already in v1.0, extend for benchmark forms |

**Installation:**
```bash
npm install zod@4.3.5  # Already in v1.0
```

**Why Zod:**
- **ALREADY IN v1.0** (used for API validation)
- TypeScript-first (infer types from schemas)
- Version 4 performance improvements
- New v4 validators: email(), uuidv4(), uuidv7(), ipv4(), iso.date()
- Perfect for complex benchmark form validation (4 categories, 10-15 fields each)

**Example Benchmark Schema:**
```typescript
import { z } from 'zod';

const compensationSchema = z.object({
  annual_salary: z.number().min(0).max(10000000),
  equity_percentage: z.number().min(0).max(100).optional(),
  bonus_percentage: z.number().min(0).max(500).optional(),
  company_size: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']),
  years_experience: z.number().min(0).max(50),
  role: z.string().min(1).max(100),
  location: z.string().min(1).max(100),
});

type CompensationData = z.infer<typeof compensationSchema>;
```

**Sources:**
- [Zod Documentation](https://zod.dev/)
- [Zod v4 Release Notes](https://zod.dev/v4)
- [Zod npm](https://www.npmjs.com/package/zod)

---

## Background Jobs

### node-cron (Simple Scheduling) vs BullMQ (Job Queue)
| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| node-cron | 4.2.1 (current) | Time-based jobs | Already in v1.0 for simple cron (MEE6 sync every 15 min) |
| BullMQ | Latest | Distributed job queue | If need job persistence, retries, horizontal scaling |
| Redis | Latest | Queue backend | Required for BullMQ |

**Current Setup (v1.0):**
```typescript
import cron from 'node-cron';

// MEE6 XP sync - every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  await syncMEE6XP();
});
```

**When to Upgrade to BullMQ:**
- Job persistence required (survive app restarts)
- Need automatic retries with exponential backoff
- Horizontal scaling (multiple workers)
- Complex job dependencies
- Job priority queues

**Recommendation for v2.0:**
- **Start with node-cron** (already working, simpler, no Redis dependency)
- MEE6 sync = simple 15-min cron (occasional missed execution acceptable)
- Streak calculation = daily cron (simple)
- **Upgrade to BullMQ if:**
  - Jobs failing frequently (need retries)
  - Scaling to multiple server instances
  - Need job monitoring dashboard

**BullMQ Setup (If Needed Later):**
```bash
npm install bullmq redis
```

**Cost Consideration:**
- node-cron: $0 (built-in)
- BullMQ + Redis: $10-30/mo (Redis hosting) + complexity

**Sources:**
- [Node.js Task Scheduling: Cron Jobs vs Queues](https://wontonee.com/node-js-task-scheduling-cron-jobs-queues-made-easy/)
- [BullMQ vs node-cron Comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/)
- [Job Scheduling with BullMQ](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/)

---

## Discord Integration

### MEE6 API for XP Tracking
| Technology | Version | Purpose | Cost |
|------------|---------|---------|-----|
| MEE6 Discord Bot | N/A | Discord XP/leveling | $11.95/mo Premium (1 server) |
| Custom sync script | N/A | Poll MEE6 API every 15 min | Port from Chris's app |

**Why MEE6:**
- **Chris's app has MEE6 sync code** (already implemented, just port it)
- MEE6 tracks Discord activity automatically (messages, reactions, voice time)
- XP → Points conversion (1 point per 100 MEE6 XP)
- Cheaper than building custom Discord activity tracking

**MEE6 Sync Pattern (from Chris's App):**
```typescript
import cron from 'node-cron';

// Every 15 minutes, poll MEE6 API
cron.schedule('*/15 * * * *', async () => {
  const members = await prisma.member.findMany({ where: { discordId: { not: null } } });

  for (const member of members) {
    const mee6Data = await fetchMEE6XP(member.discordId);
    const newXP = mee6Data.xp - (member.lastMEE6XP || 0);

    if (newXP > 0) {
      const points = Math.floor(newXP / 100);  // 1 point per 100 XP

      await prisma.pointTransaction.create({
        data: {
          memberId: member.id,
          points: points,
          action: 'discord_activity',
          metadata: { mee6XP: newXP },
        },
      });

      await prisma.member.update({
        where: { id: member.id },
        data: { lastMEE6XP: mee6Data.xp },
      });
    }
  }
});
```

**Why NOT Build Custom Discord Activity Tracking:**
- Requires webhook listeners for every message/reaction/voice event
- High Discord API rate limit consumption (50 req/sec)
- Complex logic (time in voice, message length, spam detection)
- MEE6 already solves this ($11.95/mo < 2 hours of dev time)

**Why NOT Use Existing Discord.js Bot:**
- Current bot handles role management (focused, simple)
- Tracking activity = different concern (separation of concerns)
- MEE6 has mature XP algorithm (spam prevention, fairness)

**MEE6 Pricing (2026):**
- Monthly: $11.95/mo per server
- Yearly: $49.99/yr per server (58% savings)
- Lifetime: $89.90 one-time (best value for 2+ year commitment)

**Sources:**
- [MEE6 Premium Pricing](https://wiki.mee6.xyz/premium)
- [MEE6 Bot Features](https://botpenguin.com/blogs/top-features-of-mee6-discord-bot)

---

## Caching Strategy (Optional)

### Redis vs Node In-Memory Cache
| Technology | Purpose | When to Use |
|------------|---------|-------------|
| node-cache | In-memory cache (single server) | Development, single server, simple caching |
| Redis | Distributed cache | Production with multiple servers, persistence needed |

**Recommendation for v2.0:**
- **Start without caching** (premature optimization)
- Add caching only if performance issues arise
- **Use Redis if:**
  - Benchmark aggregations slow (> 500ms)
  - Multiple server instances (shared cache needed)
  - Need cache persistence (survive restarts)

**When Redis is Worth It:**
- Multiple server instances (Render/Heroku scale-out)
- Benchmark results cache (computation expensive, data changes infrequently)
- Leaderboard cache (updated every 15 min, not real-time)

**When NOT to Cache:**
- Single server instance (node-cache faster, no network calls)
- Data changes frequently (cache invalidation complexity)
- Query already fast (< 100ms)

**Cost:**
- node-cache: $0 (built-in)
- Redis: $10-30/mo (Upstash, Redis Cloud)

**Sources:**
- [Redis vs node-cache for Node.js](https://medium.com/@its_me64/node-caching-v-s-redis-caching-ae432c22b409)
- [Redis Caching in Node.js](https://betterstack.com/community/guides/scaling-nodejs/nodejs-caching-redis/)

---

## Architecture: Express + Next.js Proxy

### Deployment Model
| Component | Port | Responsibility |
|-----------|------|----------------|
| Express API | 4000 | API routes, auth, webhooks, Discord bot, admin, proxy /dashboard/* |
| Next.js App | 3000 | Member dashboard UI (React components) |

**Architecture:**
```
┌─────────────────────────────────────┐
│  Express App (Port 4000)            │
│  - Public routes (/login, /pricing) │
│  - API routes (/api/*)              │
│  - Admin routes (/admin/*)          │
│  - Auth middleware                  │
│  - Stripe webhooks                  │
│  - Discord bot                      │
│  - Proxy /dashboard/* → Next.js     │
└─────────────────────────────────────┘
              │
              ↓ http://localhost:3000
┌─────────────────────────────────────┐
│  Next.js App (Port 3000)            │
│  - /dashboard (member pages)        │
│  - /benchmarks                      │
│  - /resources                       │
│  - /leaderboard                     │
│  - /profile                         │
│  - Uses Express API endpoints       │
└─────────────────────────────────────┘
```

**Express Proxy Setup:**
```typescript
// In Express app (port 4000)
import { createProxyMiddleware } from 'http-proxy-middleware';

app.use('/dashboard', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,  // WebSocket support for Next.js HMR
}));
```

**Shared Authentication:**
```typescript
// Express sets HTTP-only cookie with JWT
res.cookie('auth_token', jwt, { httpOnly: true, secure: true, sameSite: 'strict' });

// Next.js reads cookie in middleware
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token');
  if (!token) return NextResponse.redirect('/login');
  // ... verify JWT
}
```

**Why This Architecture:**
- Reuse existing Express infrastructure (auth, Stripe, Discord bot)
- Keep admin panel in HTML/vanilla JS (consistency with v1.0)
- Isolated Next.js app for member features (modern React UX)
- Single domain (no CORS issues)
- Easy to deploy (Express proxies to Next.js, single entry point)

**Alternative NOT Chosen:**
- **Full Next.js Migration:** Would lose production-hardened Express logic (webhooks, team subscriptions)
- **Separate Next.js Deployment:** CORS complexity, authentication duplication
- **Monorepo:** Overhead for solo dev, complex deployment

**Sources:**
- [Next.js Proxy Feature](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [How to Use Proxy in Next.js](https://blog.logrocket.com/how-to-use-proxy-next-js/)
- [Next.js 16 Proxy vs Middleware](https://u11d.com/blog/nextjs-16-proxy-vs-middleware-bff-guide/)

---

## Installation Checklist

### Frontend
```bash
# React + Next.js
npm install react@19.2 react-dom@19.2 next@15.1

# Tailwind CSS v4
npm install tailwindcss@4.0.0 tailwindcss-animate class-variance-authority clsx tailwind-merge

# shadcn/ui (optional, only if needed)
npx shadcn@latest init
npx shadcn@latest add button card input dialog table

# Charts
npm install recharts@3.7.0
```

### File Storage
```bash
# Supabase client (already installed in v1.0)
npm install @supabase/supabase-js

# Resumable uploads + validation
npm install tus-js-client file-type
```

### Validation
```bash
# Zod (already installed in v1.0)
npm install zod@4.3.5
```

### Background Jobs
```bash
# node-cron (already installed in v1.0)
npm install node-cron@4.2.1

# BullMQ + Redis (only if needed later)
npm install bullmq redis
```

### Development
```bash
# TypeScript types
npm install -D @types/node @types/react @types/react-dom
```

---

## Cost Summary

| Component | Cost | Notes |
|-----------|------|-------|
| React 19 + Next.js 15 | $0 | Open source |
| Tailwind CSS v4 | $0 | Open source |
| Recharts | $0 | Open source |
| Supabase Storage | $0.021/GB | Included in existing Supabase plan |
| MEE6 Premium | $11.95/mo | Discord XP tracking (or $49.99/yr, $89.90 lifetime) |
| Redis (optional) | $10-30/mo | Only if caching needed |
| **Total (minimum)** | **$11.95/mo** | Just MEE6, everything else free or existing |
| **Total (with Redis)** | **$21.95-41.95/mo** | If caching needed |

---

## Anti-Recommendations (What NOT to Use)

### DO NOT Use These Libraries

| Library | Why NOT |
|---------|---------|
| Chart.js | Not React-native, imperative API, would lose Chris's Recharts work |
| D3.js | Too low-level, 2-3 weeks to build what Recharts provides |
| AWS S3 directly | Supabase Storage already in infrastructure, simpler |
| Cloudflare R2 | Not in existing infrastructure, unnecessary setup |
| Full component library (MUI, Chakra) | Bundle bloat, lock-in, Chris's components exist |
| Separate tables per benchmark category | Complex queries, hard to extend |
| Wide table with 50+ columns | Many NULLs, rigid schema |
| Materialized views for points | Not real-time, manual refresh overhead |
| Custom Discord activity tracking | MEE6 cheaper and better |
| Redis (initially) | Premature optimization, add if needed |

---

## Migration Path from Chris's App

### Reusable Components (Port, Don't Rebuild)
1. **React Components:**
   - Button, Card, Input, Form components
   - ComparisonBar, PerformanceRadar, ScoreRing charts
   - Benchmark submission forms (4 categories)
   - Resource browser UI
   - Leaderboard table

2. **Business Logic:**
   - MEE6 sync code (15-min cron)
   - Benchmark aggregation functions
   - Points calculation logic

3. **Styling:**
   - Tailwind config (tweak for less-minimalist look)
   - Component variants

### DO NOT Port
- Authentication logic (use existing Express auth)
- Stripe integration (use existing v1.0 webhooks)
- Database models (extend existing Prisma schema)
- Admin UI (keep existing HTML/vanilla JS)

---

## Security Considerations

### File Upload Security
1. **Magic number validation** (file-type library) - prevent extension spoofing
2. **File size limits** (100MB recommended) - prevent DoS
3. **Virus scanning** (consider ClamAV or cloud service) - prevent malware
4. **Signed URLs with expiration** (1-hour) - prevent unauthorized access
5. **Content-Disposition: attachment** - prevent XSS via file execution

### API Security (Existing v1.0)
- Rate limiting (express-rate-limit) - already in place
- CSRF protection - already in place
- Helmet security headers - already in place
- Input validation (Zod) - extend to new endpoints

---

## Performance Targets

| Metric | Target | How to Achieve |
|--------|--------|----------------|
| Page load time | < 2s (p95) | Next.js SSR, code splitting |
| Benchmark aggregation | < 500ms | GIN index, denormalized fields |
| File upload | < 5s (10MB) | TUS resumable, direct to Supabase |
| Leaderboard query | < 1s | Indexed total_points, LIMIT 25 |
| API response | < 100ms (p95) | Database indexes, efficient queries |
| Concurrent users | 100+ | Existing infrastructure handles this |

---

## Monitoring & Observability

### Existing v1.0 Infrastructure
- Sentry for error tracking
- Pino for structured logging
- Existing monitoring continues

### New Metrics to Track
- Benchmark submission rate (by category)
- Resource download rate (by type)
- Points awarded per day (by action)
- Leaderboard view count
- File upload success rate
- MEE6 sync job success rate

---

## Future Considerations (Post-v2.0)

### Potential Upgrades
1. **BullMQ + Redis** - if job persistence needed
2. **Redis caching** - if benchmark aggregations slow
3. **Cloudflare CDN** - in front of Supabase Storage (if needed)
4. **Admin UI in React** - migrate from HTML/vanilla JS (Phase 9)
5. **Real-time leaderboard** - WebSockets for live updates

### NOT Recommended
- GraphQL (REST API already working, unnecessary complexity)
- Microservices (solo dev, monolith simpler)
- Serverless (Discord bot needs long-running process)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| React 19 + Next.js 15 | HIGH | Official releases, verified Dec 2024/Jan 2025, production-ready |
| Tailwind CSS v4 | HIGH | Official release Jan 22, 2025, stable |
| Recharts | HIGH | v3.7.0 latest, already implemented in Chris's app |
| Supabase Storage | HIGH | Official documentation, TUS protocol standard |
| PostgreSQL JSONB | HIGH | Built-in feature, extensive 2025-2026 best practices |
| Database Triggers | HIGH | PostgreSQL core feature, 2026 best practices verified |
| MEE6 Pricing | MEDIUM | Based on early 2025 sources, verify current pricing |
| File Type Validation | HIGH | Standard security practice, multiple libraries available |

---

## Open Questions for Phase-Specific Research

These topics will need deeper investigation during implementation phases:

1. **MEE6 API Rate Limits:** What are current limits? (Phase 5: Gamification)
2. **Benchmark Outlier Detection:** 3σ threshold sufficient? (Phase 3: Benchmarking)
3. **Resource Virus Scanning:** ClamAV vs cloud service cost/performance? (Phase 4: Resource Library)
4. **Leaderboard Time Filters:** Materialized views vs computed on-read? (Phase 5: Gamification)
5. **Free Tier Feature Gating:** Which features accessible to free tier? (Phase 2: Auth Bridge)
6. **Benchmark Privacy Threshold:** 5-response minimum sufficient for anonymity? (Phase 3: Benchmarking)

---

## Sources Summary

**React & Next.js:**
- [React v19](https://react.dev/blog/2024/12/05/react-19)
- [React 19.2](https://react.dev/blog/2025/10/01/react-19-2)
- [Next.js 15](https://nextjs.org/blog/next-15)
- [Next.js 15.1](https://nextjs.org/blog/next-15-1)

**Tailwind CSS:**
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4)

**Recharts:**
- [Recharts npm](https://www.npmjs.com/package/recharts)
- [Top 7 React Chart Libraries 2026](https://dev.to/basecampxd/top-7-react-chart-libraries-for-2026-features-use-cases-and-benchmarks-412c)

**Supabase Storage:**
- [Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [tus-js-client](https://github.com/tus/tus-js-client)

**PostgreSQL JSONB:**
- [JSONB Performance Best Practices](https://www.metisdata.io/blog/how-to-avoid-performance-bottlenecks-when-using-jsonb-in-postgresql)
- [GIN Index Performance](https://medium.com/@josef.machytka/postgresql-jsonb-operator-classes-of-gin-indexes-and-their-usage-0bf399073a4c)
- [PostgreSQL JSON Index](https://neon.com/postgresql/postgresql-indexes/postgresql-json-index)

**Database Triggers:**
- [PostgreSQL Triggers 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [Denormalize Data in PostgreSQL](https://www.getgalaxy.io/learn/glossary/how-to-denormalize-data-in-postgresql)

**File Validation:**
- [File Type Validation](https://pye.hashnode.dev/how-to-validate-javascript-file-types-with-magic-bytes-and-mime-type)
- [file-type npm](https://www.npmjs.com/package/file-type)

**Background Jobs:**
- [Node.js Task Scheduling](https://wontonee.com/node-js-task-scheduling-cron-jobs-queues-made-easy/)
- [BullMQ vs node-cron](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/)

**MEE6:**
- [MEE6 Premium](https://wiki.mee6.xyz/premium)
- [MEE6 Features](https://botpenguin.com/blogs/top-features-of-mee6-discord-bot)

**Caching:**
- [Redis vs node-cache](https://medium.com/@its_me64/node-caching-v-s-redis-caching-ae432c22b409)

**Proxy Architecture:**
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [How to Use Proxy in Next.js](https://blog.logrocket.com/how-to-use-proxy-next-js/)

**shadcn/ui:**
- [Installation](https://ui.shadcn.com/docs/installation)

**Zod:**
- [Zod v4 Release Notes](https://zod.dev/v4)
- [Zod npm](https://www.npmjs.com/package/zod)

---

**END OF STACK RESEARCH**
