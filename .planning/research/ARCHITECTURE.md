# Architecture Patterns

**Domain:** Community Intelligence Platform Integration
**Researched:** 2026-01-22
**Confidence:** HIGH

---

## Executive Summary

This document defines the architecture for integrating benchmarking, resource library, and gamification features into The Revenue Council's existing Express + Prisma + Discord.js v1.0 platform.

**Architectural Decision:** Feature migration into existing Express app using Next.js standalone frontend, preserving production-hardened backend infrastructure while adding React-based member dashboard.

**Core Architecture:**
- **Backend:** Express 5.2 API (port 4000) - extend with new feature endpoints
- **Frontend:** Next.js 16 standalone (port 3000) - proxied from Express
- **Database:** Prisma 7 with Supabase Postgres - additive schema extensions
- **Storage:** Supabase Storage with signed URLs - file upload/download
- **Background Jobs:** node-cron - MEE6 sync, leaderboard refresh, point calculations
- **Discord:** Existing discord.js bot + MEE6 XP tracking

---

## Recommended Architecture

### High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│  ┌────────────────────┐  ┌────────────────────┐             │
│  │  Public Pages      │  │  Member Dashboard  │             │
│  │  (HTML/Vanilla JS) │  │  (React/Next.js)   │             │
│  └────────────────────┘  └────────────────────┘             │
└─────────────┬────────────────────┬───────────────────────────┘
              │                    │
              ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│              Express API Server (Port 4000)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Public Routes: /login, /pricing, /checkout             │ │
│  │ Auth Routes: /auth/*, /claim/*                         │ │
│  │ API Routes (Protected):                                │ │
│  │   /api/benchmarks/* (submit, results, categories)      │ │
│  │   /api/resources/* (upload, download, list)            │ │
│  │   /api/points/* (award, history, leaderboard)          │ │
│  │   /api/discord/* (activity sync, stats)                │ │
│  │ Admin Routes: /admin/*, /api/admin/*                   │ │
│  │ Webhook Routes: /webhooks/stripe (raw body)            │ │
│  │                                                         │ │
│  │ Proxy: /dashboard/* → Next.js (Port 3000)              │ │
│  └────────────────────────────────────────────────────────┘ │
│                             │                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Middleware Layer:                                      │ │
│  │  • JWT token validation (15min access, 7d refresh)     │ │
│  │  • Rate limiting (auth endpoints)                      │ │
│  │  • CORS (credentials: true)                            │ │
│  │  • Helmet CSP headers                                  │ │
│  │  • Admin role authorization                            │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────┬──────────────┬──────────────┬─────────────────┘
               │              │              │
               ▼              ▼              ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│ Next.js Frontend │ │ Background Jobs │ │  Discord Bot     │
│   (Port 3000)    │ │  (node-cron)    │ │  (discord.js)    │
├──────────────────┤ ├─────────────────┤ ├──────────────────┤
│ /dashboard       │ │ MEE6 XP Sync    │ │ Role Management  │
│ /benchmarks      │ │   (15 min)      │ │ Intro Monitoring │
│ /resources       │ │ Leaderboard     │ │ Welcome Messages │
│ /leaderboard     │ │   Refresh       │ │ Onboarding Flow  │
│ /profile         │ │   (5 min)       │ │ Fire-and-forget  │
│ /account         │ │ Billing Checks  │ │   with p-retry   │
│ /billing         │ │   (daily)       │ │                  │
└──────────────────┘ └─────────────────┘ └──────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────────┐
        │       Prisma ORM → Supabase Postgres         │
        │  (PgBouncer pooling, transaction mode)       │
        ├──────────────────────────────────────────────┤
        │  Existing Tables:                            │
        │   • Member (extended with points fields)     │
        │   • Team, PendingInvite                      │
        │   • Admin, FeatureFlag, EmailTemplate        │
        │   • StripeEvent, AuditLog, ReconciliationRun │
        │                                              │
        │  New Tables (v2.0):                          │
        │   • BenchmarkSubmission (JSONB data)         │
        │   • Resource (file metadata)                 │
        │   • ResourceDownload (tracking)              │
        │   • PointTransaction (immutable ledger)      │
        │   • DiscordActivity (MEE6 sync)              │
        └──────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
     ┌─────────────────────┐     ┌─────────────────────┐
     │  Supabase Storage   │     │  Stripe API         │
     │  (File Storage)     │     │  (Webhooks)         │
     ├─────────────────────┤     ├─────────────────────┤
     │ Bucket: resources   │     │ Idempotency via     │
     │ Signed URLs (1hr)   │     │   StripeEvent table │
     │ RLS policies        │     │ Webhook handlers    │
     │ Access control      │     │   with retries      │
     └─────────────────────┘     └─────────────────────┘
                    │
                    ▼
          ┌──────────────────┐
          │  Sentry          │
          │  (Error Tracking)│
          └──────────────────┘
```

---

## Component Boundaries

### 1. Express API Server (Backend Core)

**Responsibility:**
- Authentication and authorization (JWT tokens)
- Business logic enforcement
- Database operations via Prisma
- Stripe webhook processing
- Discord bot coordination
- Admin operations
- API endpoints for frontend consumption

**Communicates With:**
- Next.js Frontend (HTTP proxy for /dashboard/*)
- Prisma/Database (all CRUD operations)
- Discord Bot (role assignment, intro monitoring)
- Supabase Storage (signed URL generation)
- Stripe API (webhooks, billing portal)
- Background Jobs (shared Prisma client)

**Key Patterns:**
- Route handlers with Express Router
- Middleware-based auth (`req.member`, `req.adminUser`)
- Fire-and-forget Discord operations with p-retry
- Webhook idempotency via StripeEvent deduplication
- Audit logging for admin actions

**New Routes (v2.0):**

```typescript
// Benchmarking
POST   /api/benchmarks/submit      // Submit benchmark data
GET    /api/benchmarks/results     // Get aggregated results
GET    /api/benchmarks/categories  // List available categories
GET    /api/benchmarks/my-submissions // User's submissions

// Resource Library
POST   /api/resources/upload       // Admin: Upload new resource
GET    /api/resources              // List all resources (filtered)
GET    /api/resources/:id          // Get resource metadata
GET    /api/resources/:id/download // Generate signed download URL
DELETE /api/resources/:id          // Admin: Delete resource
PATCH  /api/resources/:id          // Admin: Update metadata

// Points & Gamification
POST   /api/points/award           // System: Award points (internal)
GET    /api/points/history         // User's point history
GET    /api/points/leaderboard     // Top 25 + current user
GET    /api/points/stats           // User's point statistics

// Discord Activity
GET    /api/discord/activity       // User's Discord activity
GET    /api/discord/stats          // Server-wide stats
```

---

### 2. Next.js Frontend (Member Dashboard)

**Responsibility:**
- Member-facing UI (benchmarks, resources, leaderboard)
- Form validation and submission
- Data visualization (Recharts)
- Session management (shared with Express)
- Client-side routing

**Communicates With:**
- Express API (all data fetching via HTTP)
- Browser LocalStorage (UI preferences, not auth)

**Key Patterns:**
- Server Components for initial data fetching
- Client Components for interactive forms
- Recharts for data visualization
- Tailwind CSS for styling (less minimalist theme)
- React 19 features (useActionState, useOptimistic)

**Pages:**
```
/dashboard              // Overview with feature cards
/benchmarks             // Submit benchmark (4 categories)
/benchmarks/results     // View aggregated data + charts
/resources              // Browse resource library
/resources/:id          // Resource detail + download
/leaderboard            // Rankings with filters
/profile                // Points history, streak, downloads
/account                // Email/password management
/billing                // Subscription + invoices
```

**Component Library (Reused from Chris's app):**
- `Button`, `Card`, `Input`, `Select`, `Textarea`
- `ComparisonBar`, `PerformanceRadar`, `ScoreRing`
- `MetricComparisonCard`, `LeaderboardTable`

---

### 3. Prisma ORM (Database Layer)

**Responsibility:**
- Type-safe database queries
- Schema migrations
- Connection pooling (via PgBouncer adapter)
- Transaction management
- Query optimization

**Communicates With:**
- Express API (primary consumer)
- Background Jobs (cron tasks)
- Supabase Postgres (database connection)

**Key Patterns:**
- Shared `prisma` client singleton
- Transaction mode for pooling (short-lived queries)
- Additive-only migrations (no destructive changes)
- Indexes on foreign keys and query-heavy columns

**Schema Extensions (v2.0):**

```prisma
// Extended Member model
model Member {
  // ... existing fields ...

  // Gamification (NEW)
  totalPoints           Int                 @default(0)
  currentStreak         Int                 @default(0)
  lastActiveAt          DateTime?

  // Relationships (NEW)
  benchmarkSubmissions  BenchmarkSubmission[]
  resourceDownloads     ResourceDownload[]
  pointTransactions     PointTransaction[]
  discordActivities     DiscordActivity[]
}

// New model: BenchmarkSubmission
model BenchmarkSubmission {
  id          String           @id @default(cuid())
  member      Member           @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId    String
  category    BenchmarkCategory
  data        Json             // JSONB for flexible schema
  isValid     Boolean          @default(true)
  submittedAt DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@unique([memberId, category]) // One per category per member
  @@index([category])
  @@index([memberId])
}

enum BenchmarkCategory {
  COMPENSATION
  INFRASTRUCTURE
  BUSINESS
  OPERATIONAL
}

// New model: Resource
model Resource {
  id              String             @id @default(cuid())
  title           String
  description     String
  category        ResourceCategory
  type            ResourceType
  fileUrl         String             // Supabase Storage URL
  thumbnailUrl    String?
  isFeatured      Boolean            @default(false)
  downloadCount   Int                @default(0)
  downloads       ResourceDownload[]
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@index([category])
  @@index([type])
  @@index([isFeatured])
}

enum ResourceCategory {
  COLD_EMAIL
  SALES_GTM
  CUSTOMER_SERVICE
  OPERATIONS
  AGENCY_GROWTH
}

enum ResourceType {
  TEMPLATE
  SOP
  PLAYBOOK
  COURSE
  VIDEO
}

// New model: ResourceDownload
model ResourceDownload {
  id           String   @id @default(cuid())
  member       Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId     String
  resource     Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  resourceId   String
  downloadedAt DateTime @default(now())

  @@index([memberId])
  @@index([resourceId])
}

// New model: PointTransaction
model PointTransaction {
  id        String   @id @default(cuid())
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId  String
  action    String   // "benchmark_submission", "resource_download", "discord_activity"
  points    Int      // Can be negative for penalties
  metadata  Json?    // Context: category, resource_id, etc.
  createdAt DateTime @default(now())

  @@index([memberId])
  @@index([createdAt])
}

// New model: DiscordActivity
model DiscordActivity {
  id           String               @id @default(cuid())
  member       Member               @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId     String
  discordId    String
  activityType DiscordActivityType
  channelId    String
  messageId    String?
  recordedAt   DateTime             @default(now())

  @@index([memberId])
  @@index([discordId])
  @@index([recordedAt])
}

enum DiscordActivityType {
  MESSAGE
  REACTION_GIVEN
  REACTION_RECEIVED
}
```

---

### 4. Background Jobs (node-cron)

**Responsibility:**
- Scheduled task execution
- MEE6 XP sync (15 min)
- Leaderboard refresh (5 min)
- Billing failure checks (daily)
- Streak calculation (daily)
- Point aggregation

**Communicates With:**
- Prisma/Database (read/write operations)
- Discord Bot (role updates based on points)
- MEE6 API (XP polling)

**Key Patterns:**
- node-cron for scheduling
- Shared Prisma client with Express
- Error handling with Sentry integration
- Graceful shutdown on SIGTERM/SIGINT

**Cron Jobs (v2.0):**

```typescript
import cron from 'node-cron';
import { prisma } from './lib/prisma.js';
import { syncMEE6XP } from './jobs/mee6-sync.js';
import { refreshLeaderboard } from './jobs/leaderboard-refresh.js';
import { checkStreaks } from './jobs/streak-check.js';

// MEE6 XP Sync - Every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    await syncMEE6XP();
  } catch (error) {
    logger.error({ error }, 'MEE6 sync failed');
  }
});

// Leaderboard Refresh - Every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await refreshLeaderboard();
  } catch (error) {
    logger.error({ error }, 'Leaderboard refresh failed');
  }
});

// Streak Check - Daily at 00:05 UTC
cron.schedule('5 0 * * *', async () => {
  try {
    await checkStreaks();
  } catch (error) {
    logger.error({ error }, 'Streak check failed');
  }
});

// Existing: Billing failure checks (already implemented)
// Existing: Reconciliation runs (already implemented)
```

---

### 5. Discord Bot (discord.js)

**Responsibility:**
- Role assignment (subscription-based)
- Intro message monitoring
- Welcome messages
- Onboarding guidance DMs
- Real-time event handling

**Communicates With:**
- Express API (queries Member data)
- Prisma/Database (intro completion tracking)
- Discord API (guild/member/role operations)

**Key Patterns:**
- Fire-and-forget with p-retry (3 attempts)
- Event-driven architecture
- Graceful shutdown on disconnect
- Rate limit handling

**Integration with Points System:**

```typescript
// Award points when intro completed
client.on('messageCreate', async (message) => {
  if (message.channel.id === INTRODUCTIONS_CHANNEL_ID) {
    const member = await prisma.member.findUnique({
      where: { discordId: message.author.id }
    });

    if (member && !member.introCompleted) {
      // Mark intro complete
      await prisma.member.update({
        where: { id: member.id },
        data: {
          introCompleted: true,
          introCompletedAt: new Date(),
          introMessageId: message.id
        }
      });

      // Award points (NEW)
      await awardPoints(member.id, 25, 'intro_completed', {
        messageId: message.id
      });
    }
  }
});
```

---

### 6. Supabase Storage (File Storage)

**Responsibility:**
- File upload/download
- Access control (RLS policies)
- Signed URL generation (1-hour expiration)
- Storage bucket management

**Communicates With:**
- Express API (signed URL requests)
- Client browsers (direct upload/download)

**Key Patterns:**
- Server-side signed URL generation
- Client-side direct upload (bypasses Express body limits)
- RLS policies for access control
- Content-Disposition headers for safe downloads

**Implementation:**

```typescript
// Express route: Generate signed upload URL
app.post('/api/resources/upload-url', requireAdmin, async (req, res) => {
  const { fileName, fileType } = req.body;

  // Validate file type
  const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'video/mp4'];
  if (!allowedTypes.includes(fileType)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  // Generate signed upload URL (valid for 1 hour)
  const { data, error } = await supabase.storage
    .from('resources')
    .createSignedUploadUrl(`${Date.now()}-${fileName}`);

  if (error) {
    logger.error({ error }, 'Failed to create signed upload URL');
    return res.status(500).json({ error: 'Upload URL generation failed' });
  }

  res.json({ uploadUrl: data.signedUrl, path: data.path });
});

// Express route: Generate signed download URL
app.get('/api/resources/:id/download', requireAuth, async (req, res) => {
  const resource = await prisma.resource.findUnique({
    where: { id: req.params.id }
  });

  if (!resource) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  // Generate signed download URL (valid for 1 hour)
  const { data, error } = await supabase.storage
    .from('resources')
    .createSignedUrl(resource.fileUrl, 3600);

  if (error) {
    logger.error({ error }, 'Failed to create signed download URL');
    return res.status(500).json({ error: 'Download URL generation failed' });
  }

  // Track download
  await prisma.resourceDownload.create({
    data: {
      memberId: req.member.id,
      resourceId: resource.id
    }
  });

  // Award points (NEW)
  await awardPoints(req.member.id, 5, 'resource_download', {
    resourceId: resource.id,
    resourceTitle: resource.title
  });

  // Increment download count
  await prisma.resource.update({
    where: { id: resource.id },
    data: { downloadCount: { increment: 1 } }
  });

  res.json({ downloadUrl: data.signedUrl });
});
```

---

## Data Flow Diagrams

### 1. Benchmark Submission Flow

```
Member Browser
    │
    │ 1. Navigate to /benchmarks
    ▼
Next.js Frontend
    │ 2. Render form (compensation/infrastructure/business/operational)
    │ 3. Validate input (client-side)
    │ 4. POST /api/benchmarks/submit
    ▼
Express API
    │ 5. Authenticate JWT token
    │ 6. Validate JSONB schema
    │ 7. Check for duplicate (UNIQUE constraint: memberId + category)
    ▼
Prisma/Database
    │ 8. INSERT BenchmarkSubmission
    │ 9. Check if first submission (award points)
    ▼
Points System
    │ 10. CREATE PointTransaction (+50 points)
    │ 11. UPDATE Member.totalPoints via trigger
    │ 12. Check for point milestone (trigger role update)
    ▼
Discord Bot
    │ 13. Assign "Top Contributor" role if points >= 500
    │
    ▼
Express Response → Next.js → Member Browser
    │ 14. Success message + redirect to /benchmarks/results
```

### 2. Resource Download Flow

```
Member Browser
    │
    │ 1. Click "Download" on resource
    ▼
Next.js Frontend
    │ 2. GET /api/resources/:id/download
    ▼
Express API
    │ 3. Authenticate JWT token
    │ 4. Check subscription status (ACTIVE required)
    │ 5. Fetch resource metadata
    ▼
Supabase Storage
    │ 6. Generate signed download URL (1-hour expiration)
    ▼
Express API
    │ 7. CREATE ResourceDownload record
    │ 8. CREATE PointTransaction (+5 points)
    │ 9. UPDATE Resource.downloadCount
    │ 10. UPDATE Member.totalPoints
    │ 11. Return signed URL
    ▼
Next.js Frontend
    │ 12. Redirect browser to signed URL
    ▼
Supabase Storage → Member Browser
    │ 13. Direct download (bypasses Express)
```

### 3. MEE6 XP Sync Flow

```
node-cron (Every 15 minutes)
    │
    │ 1. Trigger MEE6 sync job
    ▼
Background Job
    │ 2. Fetch all members with discordId
    ▼
Prisma/Database
    │ 3. Return member list
    ▼
Background Job
    │ 4. For each member: GET MEE6 API /leaderboard/:guildId/members/:userId
    ▼
MEE6 API
    │ 5. Return XP and level data
    ▼
Background Job
    │ 6. Calculate XP delta since last sync
    │ 7. CREATE DiscordActivity record
    │ 8. CREATE PointTransaction (+1 per 100 XP)
    │ 9. UPDATE Member.totalPoints
    │ 10. UPDATE Member.lastActiveAt
    │ 11. Check streak (consecutive days)
    ▼
Prisma/Database
    │ 12. Commit transactions
    │ 13. Update Member.currentStreak if applicable
    ▼
Discord Bot (optional)
    │ 14. Assign engagement role if XP threshold crossed
```

---

## Patterns to Follow

### Pattern 1: Denormalized Points with Immutable Ledger

**What:** Store total points on Member model for fast reads, maintain immutable transaction log for audit trail.

**When:** All point-awarding operations.

**Example:**
```typescript
async function awardPoints(
  memberId: string,
  points: number,
  action: string,
  metadata?: Record<string, any>
) {
  await prisma.$transaction([
    // 1. Create immutable transaction record
    prisma.pointTransaction.create({
      data: {
        memberId,
        action,
        points,
        metadata
      }
    }),

    // 2. Update denormalized total
    prisma.member.update({
      where: { id: memberId },
      data: {
        totalPoints: { increment: points },
        lastActiveAt: new Date()
      }
    })
  ]);

  logger.info({ memberId, points, action }, 'Points awarded');
}
```

**Why denormalized over materialized view:**
- **Write pattern:** Points awarded infrequently (user actions)
- **Read pattern:** Leaderboard queried frequently
- **Performance:** `SELECT * FROM Member ORDER BY totalPoints DESC LIMIT 25` with index is O(log n)
- **Consistency:** Real-time updates, no refresh lag
- **Simplicity:** No cron job to maintain materialized view

**Source:** [Materialized Views: A Clear-Cut Definition and Guide | Databricks](https://www.databricks.com/glossary/materialized-views), [PostgreSQL View vs Materialized View: A Guide](https://www.dbvis.com/thetable/view-vs-materialized-view-in-databases-differences-and-use-cases/)

### Pattern 2: Signed URLs for File Access

**What:** Generate time-limited signed URLs for file upload/download, avoiding proxy through Express.

**When:** All file operations (upload resources, download resources).

**Example:**
```typescript
// Admin uploads resource
async function uploadResource(file: File, metadata: ResourceMetadata) {
  // 1. Request signed upload URL from Express
  const { uploadUrl, path } = await fetch('/api/resources/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type
    })
  }).then(r => r.json());

  // 2. Upload directly to Supabase Storage (client-side)
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  });

  // 3. Create resource record with file path
  await fetch('/api/resources', {
    method: 'POST',
    body: JSON.stringify({
      ...metadata,
      fileUrl: path
    })
  });
}
```

**Benefits:**
- Bypasses Express body size limits
- Reduces server bandwidth usage
- Leverages Supabase CDN for fast delivery
- Secure with time-limited URLs

**Source:** [Supabase Storage: Create signed upload URL](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [Signed URL file uploads with NextJs and Supabase](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0)

### Pattern 3: Express Proxy to Next.js

**What:** Route /dashboard/* paths from Express to Next.js standalone server, maintaining single public domain.

**When:** All member dashboard routes.

**Example:**
```typescript
import { createProxyMiddleware } from 'http-proxy-middleware';

// Proxy /dashboard/* to Next.js
app.use('/dashboard', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true, // Proxy WebSocket connections (HMR in dev)
  onProxyReq: (proxyReq, req, res) => {
    // Forward auth cookies
    if (req.headers.cookie) {
      proxyReq.setHeader('Cookie', req.headers.cookie);
    }
  }
}));
```

**Architecture benefits:**
- Single domain (no CORS complexity)
- Shared auth cookies (httpOnly, secure)
- Express handles all API routes
- Next.js handles only UI rendering
- Independent deployment of frontend/backend

**Source:** [Next.js 16 Proxy Architecture: API Gateway Patterns](https://learnwebcraft.com/learn/nextjs/nextjs-16-proxy-ts-changes-everything), [Building a Secure & Scalable BFF Architecture with Next.js](https://vishal-vishal-gupta48.medium.com/building-a-secure-scalable-bff-backend-for-frontend-architecture-with-next-js-api-routes-cbc8c101bff0)

### Pattern 4: Fire-and-Forget Discord Operations

**What:** Perform Discord operations asynchronously with retries, never blocking HTTP responses.

**When:** Role assignments, DMs, channel operations triggered by API calls.

**Example:**
```typescript
import pRetry from 'p-retry';

async function assignRoleWithRetry(memberId: string, roleName: string) {
  // Don't await - fire and forget
  pRetry(
    async () => {
      const guild = await discordClient.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(memberId);
      const role = guild.roles.cache.find(r => r.name === roleName);

      if (!role) {
        throw new Error(`Role ${roleName} not found`);
      }

      await member.roles.add(role);
      logger.info({ memberId, roleName }, 'Role assigned');
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        logger.warn({ error, memberId, roleName, attempt: error.attemptNumber }, 'Role assignment attempt failed');
      }
    }
  ).catch((error) => {
    logger.error({ error, memberId, roleName }, 'Role assignment failed after retries');
  });
}
```

### Pattern 5: JSONB for Flexible Schemas

**What:** Use JSONB columns for data structures that vary by category or evolve over time.

**When:** Benchmark submissions (different fields per category), point transaction metadata.

**Example:**
```typescript
// Benchmark submission with flexible schema
await prisma.benchmarkSubmission.create({
  data: {
    memberId: req.member.id,
    category: 'COMPENSATION',
    data: {
      role: 'Sales Manager',
      base_salary: 75000,
      commission_rate: 0.15,
      ote: 120000,
      region: 'North America',
      team_size: 5
    }
  }
});

// Query JSONB data
const avgSalary = await prisma.$queryRaw`
  SELECT AVG((data->>'base_salary')::INTEGER) as avg_salary
  FROM "BenchmarkSubmission"
  WHERE category = 'COMPENSATION'
    AND data->>'role' = 'Sales Manager'
`;
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous Discord Operations Blocking HTTP Responses

**What goes wrong:** Discord API rate limits or timeouts cause HTTP 500 errors for users.

**Why bad:** User experience degraded by Discord infrastructure issues unrelated to their action.

**Instead:** Use fire-and-forget pattern with p-retry (Pattern 4).

### Anti-Pattern 2: Proxying File Downloads Through Express

**What goes wrong:** Large files (50MB+) consume Express memory, slow downloads, hit body size limits.

**Why bad:** Server resource exhaustion, poor download performance, request timeouts.

**Instead:** Generate signed URLs for direct client-to-storage downloads (Pattern 2).

### Anti-Pattern 3: Calculating Points on Every Leaderboard Request

**What goes wrong:** Expensive SUM() aggregation on PointTransaction table for every user on every request.

**Why bad:** Slow leaderboard queries (1-2 seconds), database CPU spikes, poor user experience.

**Instead:** Denormalize total_points on Member model, update on point award (Pattern 1).

### Anti-Pattern 4: Processing Stripe Webhooks Without Idempotency

**What goes wrong:** Stripe retries webhooks, causing duplicate point awards or database records.

**Why bad:** Financial discrepancies, duplicate point awards, confused members.

**Instead:** Check StripeEvent table before processing (existing v1.0 pattern, reuse).

---

## Scalability Considerations

### At 100 Users (MVP)

| Concern | Approach | Infrastructure |
|---------|----------|---------------|
| **Database connections** | Prisma with PgBouncer (100 connection pool) | Current setup sufficient |
| **File storage** | Supabase Storage (100GB included) | Current plan sufficient |
| **Background jobs** | Single node-cron process | Run on same server as Express |
| **Leaderboard performance** | Indexed query on Member.totalPoints | <100ms with index |
| **Discord rate limits** | Fire-and-forget with 3 retries | No issues at this scale |
| **Stripe webhook volume** | ~10-20 events/day | Current idempotency sufficient |

### At 10K Users (Growth)

| Concern | Approach | Infrastructure |
|---------|----------|---------------|
| **Database connections** | Increase PgBouncer pool to 500 | Supabase Pro plan |
| **File storage** | ~1TB usage (10MB avg * 10K users) | Add storage tier ($0.021/GB) |
| **Background jobs** | Separate cron server (avoid Express contention) | Dedicated worker dyno/container |
| **Leaderboard caching** | Redis cache (5-min TTL) | Add Redis (Upstash or Supabase Cache) |
| **Discord rate limits** | Queue-based processing (BullMQ) | Redis-backed job queue |
| **Stripe webhook volume** | ~200-400 events/day | Current setup scales |
| **API rate limiting** | Per-user rate limits (100 req/min) | Express rate-limit with Redis store |

### At 1M Users (Scale)

| Concern | Approach | Infrastructure |
|---------|----------|---------------|
| **Database sharding** | Separate read replicas for analytics | Supabase Enterprise or AWS RDS |
| **File storage** | CDN in front of Supabase Storage | Cloudflare CDN |
| **Background jobs** | Distributed cron with leader election | Kubernetes CronJobs or Temporal |
| **Leaderboard** | Materialized view + Redis cache | Refresh every 15 min, cache 5 min |
| **Discord operations** | Dedicated bot cluster (sharding) | discord.js sharding across 4+ nodes |
| **API autoscaling** | Horizontal scaling (4-8 Express instances) | Kubernetes or AWS ECS |
| **Database queries** | Query optimization, connection pooling | Database performance tuning |

---

## Integration Points with v1.0 Infrastructure

### 1. Authentication System (No Changes Required)

**v1.0 Pattern:**
- JWT tokens (15min access, 7-30d refresh)
- httpOnly, secure cookies
- Separate Admin and Member tokens

**v2.0 Integration:**
- Reuse existing middleware (`requireAuth`, `requireAdmin`)
- Next.js receives cookies via Express proxy
- No Supabase Auth migration needed (dual auth deferred)

### 2. Stripe Webhooks (Extend Handlers)

**v1.0 Pattern:**
- Idempotency via StripeEvent table
- Webhook handlers in `src/webhooks/stripe.ts`
- Updates Member.subscriptionStatus

**v2.0 Extension:**
```typescript
// Add to existing webhook handler
case 'customer.subscription.updated':
  const subscription = event.data.object;
  const member = await prisma.member.findUnique({
    where: { stripeCustomerId: subscription.customer }
  });

  // Existing: Update subscription status
  await prisma.member.update({
    where: { id: member.id },
    data: {
      subscriptionStatus: mapStripeStatus(subscription.status),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    }
  });

  // NEW: Award points for subscription renewal
  if (subscription.status === 'active') {
    await awardPoints(member.id, 10, 'subscription_renewed', {
      subscriptionId: subscription.id
    });
  }
  break;
```

### 3. Discord Bot (Extend Event Handlers)

**v1.0 Pattern:**
- Role assignment based on subscription tier
- Intro monitoring for onboarding
- Welcome messages

**v2.0 Extension:**
```typescript
// Add to existing intro monitoring
client.on('messageCreate', async (message) => {
  if (message.channel.id === INTRODUCTIONS_CHANNEL_ID) {
    const member = await prisma.member.findUnique({
      where: { discordId: message.author.id }
    });

    if (member && !member.introCompleted) {
      // Existing: Mark intro complete
      await prisma.member.update({
        where: { id: member.id },
        data: {
          introCompleted: true,
          introCompletedAt: new Date()
        }
      });

      // NEW: Award points
      await awardPoints(member.id, 25, 'intro_completed', {
        messageId: message.id
      });
    }
  }
});
```

### 4. Admin Pages (Extend HTML/Vanilla JS)

**v1.0 Pattern:**
- HTML pages at `/admin/*.html`
- Vanilla JS with fetch() for API calls
- Plain CSS styling

**v2.0 Extension:**
```html
<!-- Add to admin/members.html -->
<section id="points-management">
  <h2>Points & Gamification</h2>
  <div class="admin-card">
    <h3>Adjust Member Points</h3>
    <form id="adjust-points-form">
      <input type="text" id="member-search" placeholder="Search member..." />
      <input type="number" id="points-amount" placeholder="Points (+ or -)" />
      <input type="text" id="points-reason" placeholder="Reason" />
      <button type="submit">Adjust Points</button>
    </form>
  </div>

  <div class="admin-card">
    <h3>Leaderboard</h3>
    <button onclick="refreshLeaderboard()">Refresh Now</button>
    <table id="leaderboard-table">
      <!-- Populated via fetch /api/points/leaderboard -->
    </table>
  </div>
</section>
```

### 5. Feature Flags (Add New Flags)

**v1.0 Pattern:**
- FeatureFlag table with key/enabled/category
- Admin UI to toggle flags

**v2.0 New Flags:**
```typescript
// Seed new feature flags
await prisma.featureFlag.createMany({
  data: [
    {
      key: 'features.benchmarking.enabled',
      enabled: true,
      description: 'Enable benchmarking submission and results',
      category: 'features'
    },
    {
      key: 'features.resources.enabled',
      enabled: true,
      description: 'Enable resource library',
      category: 'features'
    },
    {
      key: 'features.gamification.enabled',
      enabled: true,
      description: 'Enable points and leaderboard',
      category: 'features'
    },
    {
      key: 'features.mee6_sync.enabled',
      enabled: true,
      description: 'Enable MEE6 XP sync cron job',
      category: 'integrations'
    }
  ]
});
```

---

## Suggested Build Order

### Phase 1: Database Schema Extension (Week 1-3)

**Dependencies:** None (additive only)

**Tasks:**
1. Add 5 new Prisma models (BenchmarkSubmission, Resource, ResourceDownload, PointTransaction, DiscordActivity)
2. Extend Member model with gamification fields (totalPoints, currentStreak, lastActiveAt)
3. Create migrations with rollback scripts
4. Add indexes on foreign keys and query columns
5. Seed initial data (categories, test resources)

**Deliverables:**
- `prisma/schema.prisma` updated
- `prisma/migrations/` with new migration
- Seed script with test data
- Database ERD diagram

**Verification:**
- `npm run db:migrate` succeeds
- Prisma Client regenerates types
- Seed script populates test data

---

### Phase 2: Points System Backend (Week 4-5)

**Dependencies:** Phase 1 (database schema)

**Tasks:**
1. Create `awardPoints()` function with transaction support
2. Create Express routes: POST /api/points/award (internal), GET /api/points/history, GET /api/points/leaderboard
3. Implement leaderboard query with ranking
4. Add point award triggers (intro completion, benchmark submission)
5. Add audit logging for point adjustments

**Deliverables:**
- `src/services/points.ts` (business logic)
- `src/routes/points.ts` (API routes)
- Updated Discord bot event handlers
- Unit tests for point calculations

**Verification:**
- Award points via API, verify PointTransaction created
- Check Member.totalPoints updates
- Query leaderboard, verify ranking correct
- Test with 100 mock users for performance

---

### Phase 3: Benchmarking System (Week 6-8)

**Dependencies:** Phase 1 (database schema)

**Tasks:**
1. Create Express routes: POST /api/benchmarks/submit, GET /api/benchmarks/results
2. Implement JSONB validation schemas for 4 categories
3. Build aggregation queries (median, average, percentiles)
4. Enforce 5-response minimum for privacy
5. Add outlier detection (3σ flagging)
6. Create admin review queue
7. Award points on submission

**Deliverables:**
- `src/routes/benchmarks.ts` (API routes)
- `src/services/benchmarks.ts` (aggregation logic)
- `src/validation/benchmark-schemas.ts` (Zod schemas)
- Admin HTML extension for review queue

**Verification:**
- Submit benchmark in each category
- Verify < 5 responses hides data
- Test outlier detection with extreme values
- Admin can review flagged submissions
- Points awarded correctly

---

### Phase 4: Resource Library & File Storage (Week 9-10)

**Dependencies:** Phase 1 (database schema)

**Tasks:**
1. Configure Supabase Storage bucket (`resources`)
2. Create Express routes: POST /api/resources/upload-url, POST /api/resources, GET /api/resources, GET /api/resources/:id/download
3. Implement signed URL generation (upload and download)
4. Add file type validation (PDF, DOCX, XLSX, MP4, ZIP)
5. Track downloads (ResourceDownload table)
6. Award points on download
7. Create admin resource management UI (HTML)

**Deliverables:**
- Supabase Storage bucket configured
- `src/routes/resources.ts` (API routes)
- `src/services/storage.ts` (signed URL helpers)
- Admin HTML extension for resource CRUD

**Verification:**
- Admin uploads file via signed URL
- File appears in resource list
- Member downloads file (tracked)
- Download count increments
- Points awarded

---

### Phase 5: Background Jobs (Week 11-12)

**Dependencies:** Phase 2 (points system), Phase 1 (database schema)

**Tasks:**
1. Create MEE6 XP sync job (15-min cron)
2. Create leaderboard refresh job (5-min cron)
3. Create streak check job (daily cron)
4. Implement MEE6 API client
5. Add Discord activity tracking
6. Award points based on XP delta
7. Integrate with existing billing scheduler

**Deliverables:**
- `src/jobs/mee6-sync.ts` (MEE6 integration)
- `src/jobs/leaderboard-refresh.ts` (cached rankings)
- `src/jobs/streak-check.ts` (daily activity)
- `src/lib/mee6-client.ts` (API wrapper)

**Verification:**
- MEE6 sync runs every 15 min
- Discord activity recorded
- Points awarded based on XP
- Streak increments on consecutive days
- Leaderboard cache updates

---

### Phase 6: Next.js Frontend Setup (Week 13-14)

**Dependencies:** Phase 2-5 (backend APIs ready)

**Tasks:**
1. Create Next.js 16 app in `/frontend` directory
2. Configure Express proxy for /dashboard/*
3. Set up shared authentication (cookie forwarding)
4. Install dependencies (Recharts, Tailwind CSS v4)
5. Port Chris's component library (Button, Card, Input, etc.)
6. Adjust CSS theme (add shadows, colors, 8px border-radius)
7. Create layout with navigation

**Deliverables:**
- `/frontend` directory with Next.js app
- Express proxy configured in `src/index.ts`
- Component library in `/frontend/components`
- Tailwind config with custom theme
- Layout with navigation

**Verification:**
- Next.js runs on port 3000
- Express proxies /dashboard/* correctly
- Auth cookies forwarded
- Navigation renders
- Components styled correctly

---

### Phase 7: Frontend Pages (Week 15-17)

**Dependencies:** Phase 6 (Next.js setup), Phase 2-5 (backend APIs)

**Tasks:**
1. Build /dashboard (overview with feature cards)
2. Build /benchmarks (4 category forms with validation)
3. Build /benchmarks/results (charts with Recharts)
4. Build /resources (list with filters)
5. Build /resources/:id (detail with download)
6. Build /leaderboard (rankings with animations)
7. Build /profile (points history, streak, downloads)
8. Build /account (email/password management)
9. Build /billing (subscription + invoices)
10. Add loading states and error handling

**Deliverables:**
- 9 Next.js pages (app/dashboard/, app/benchmarks/, etc.)
- Form validation with Zod
- Data fetching with React Server Components
- Recharts visualizations
- Responsive mobile layouts

**Verification:**
- All pages render correctly
- Forms validate and submit
- Charts display data accurately
- Mobile layout responsive
- Loading states prevent confusion
- Error handling graceful

---

### Phase 8: Testing & Deployment (Week 18)

**Dependencies:** Phase 1-7 (all features complete)

**Tasks:**
1. E2E testing (signup → benchmark → download → leaderboard)
2. Load testing (100 concurrent users)
3. Security testing (auth, file uploads, SQL injection)
4. Performance optimization (query indexes, image optimization)
5. Deploy to staging
6. User acceptance testing (UAT)
7. Production deployment
8. Monitoring setup (Sentry, database metrics)

**Deliverables:**
- E2E test suite (Playwright or Cypress)
- Load test results (k6 or Artillery)
- Security audit report
- Staging deployment
- Production deployment checklist
- Monitoring dashboards

**Verification:**
- All E2E flows pass
- Load tests show <2s response times
- No critical security issues
- Staging environment stable
- Production deployment successful
- Monitoring shows healthy metrics

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| **Express + Prisma Architecture** | HIGH | Existing v1.0 codebase provides proven patterns (webhook idempotency, audit logging, Discord bot integration). Additive schema extensions are low-risk. |
| **Next.js Proxy Pattern** | HIGH | Industry-standard BFF pattern with clear documentation and examples. Express proxy middleware is battle-tested. |
| **Supabase Storage Integration** | HIGH | Official SDK with signed URL support. Pattern well-documented in Supabase docs and Medium tutorials. |
| **Points System (Denormalized)** | HIGH | Denormalized approach proven superior to materialized views for this read/write pattern. Database triggers ensure consistency. |
| **Background Jobs (node-cron)** | MEDIUM | Simple scheduler works for solo developer setup. May need migration to BullMQ at 10K+ users for distributed processing. |
| **MEE6 Integration** | MEDIUM | Unofficial API, no official SDK. Chris's code provides working implementation but rate limits and API changes are risks. |
| **React Component Reuse** | MEDIUM | Components proven in Chris's app but may need styling adjustments. Less minimalist theme requires CSS tweaks. |
| **Timeline (16-18 weeks)** | MEDIUM | Conservative estimate assumes solo developer with no blockers. Delays in MEE6 integration or design iteration could extend timeline. |

---

## Gaps & Open Questions

### Technical Gaps

1. **MEE6 API Rate Limits:** Unofficial API documentation unclear on rate limits. May need throttling or fallback strategy if sync job hits limits with large member base.

2. **Benchmark Aggregation Performance:** JSONB queries on large datasets (10K+ submissions) may be slow. Need load testing to determine if caching or materialized view required.

3. **File Virus Scanning:** Supabase Storage has no built-in virus scanning. Should integrate ClamAV or cloud service (AWS S3 + Macie) for production?

4. **Stripe Subscription Tier Mapping:** Existing schema has Individual/Team seat model. Chris's schema has Monthly/Annual plan model. Need decision: extend Member model with both fields or unify models?

5. **Admin UI Component Library:** Admin pages are HTML/vanilla JS. Resource management and benchmark review need new UI components. Should extract shared components (table, modal, form) into reusable library?

### Business Questions

1. **Point Value Configuration:** Who sets point values (50 for benchmark, 5 for download, 1 per 100 XP)? Should these be configurable in FeatureFlag table or hard-coded?

2. **Leaderboard Visibility:** Should leaderboard show all members or only active subscribers? Privacy implications of exposing engagement metrics?

3. **Resource Access Control:** Should free tier have read-only access to resources (no downloads) or complete paywall?

4. **Benchmark Data Retention:** How long to keep benchmark submissions? Archive old data or keep indefinitely for trend analysis?

5. **Discord Role Mapping:** Should points-based roles stack with subscription-based roles (Knight, Lord) or replace them? Separate role categories?

---

## Sources

Architecture patterns and best practices verified with current 2026 documentation:

- [Building a Secure & Scalable BFF Architecture with Next.js](https://vishal-vishal-gupta48.medium.com/building-a-secure-scalable-bff-backend-for-frontend-architecture-with-next-js-api-routes-cbc8c101bff0)
- [Next.js 16 Proxy Architecture: API Gateway Patterns](https://learnwebcraft.com/learn/nextjs/nextjs-16-proxy-ts-changes-everything)
- [Supabase Storage: Create signed upload URL](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Signed URL file uploads with NextJs and Supabase](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0)
- [Job Scheduling in Node.js with Node-cron](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/)
- [Prisma Best Practices for Node.js Developers](https://codeit.mk/home/blog/Prisma-Best-Practices-for-Node.js-Developers--A-Comprehensive-Guide)
- [Materialized Views: A Clear-Cut Definition and Guide | Databricks](https://www.databricks.com/glossary/materialized-views)
- [PostgreSQL View vs Materialized View: A Guide](https://www.dbvis.com/thetable/view-vs-materialized-view-in-databases-differences-and-use-cases/)

---

**END OF ARCHITECTURE DOCUMENT**
