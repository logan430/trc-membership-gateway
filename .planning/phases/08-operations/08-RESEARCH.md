# Phase 8: Operations - Research

**Researched:** 2026-01-19
**Domain:** Stripe-Discord reconciliation, drift detection, audit logging, scheduled jobs
**Confidence:** HIGH

## Summary

Phase 8 implements an automated reconciliation system that detects and optionally corrects drift between Stripe subscription state (source of truth) and Discord role state. The reconciliation runs daily at a fixed time, with manual trigger capability, and notifies admins (via Discord channel and email) when issues are detected. Per CONTEXT.md, the system starts in report-only mode with a toggle for future auto-fix.

The implementation leverages the existing billing scheduler pattern (5-minute polling in `src/billing/scheduler.ts`) but adds a separate daily reconciliation job. The system queries Stripe subscriptions via API, compares against local database state and actual Discord roles, then generates a report of drift scenarios. When `RECONCILIATION_AUTO_FIX=true`, it applies corrections silently (users not notified).

**Primary recommendation:** Use `node-cron` for daily scheduling (not database polling) since reconciliation is time-based, not event-based. Build modular drift detection functions that compare three data sources: Stripe subscriptions (source of truth), database Member/Team records (cached state), and Discord guild members (actual roles). Store reconciliation run results in a new ReconciliationRun model for audit trail.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | ^4.0.0 | Daily scheduled job | Lightweight, simple cron syntax, timezone support |
| stripe | ^20.2.0 | Fetch subscription data | Already installed, source of truth |
| discord.js | ^14.25.1 | Fetch guild members, verify roles | Already installed |
| prisma | ^7.2.0 | Database queries, audit logging | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.2.0 | Structured logging | Already installed, log reconciliation details |
| p-retry | ^7.1.1 | Retry failed Discord operations | Already installed, for auto-fix |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron | node-schedule | node-schedule more flexible but heavier; cron syntax sufficient |
| node-cron | setInterval | setInterval doesn't have timezone support or cron-style "at 3 AM" |
| node-cron | Bree | Worker threads overkill for single daily job |
| Manual Stripe query | Stripe webhooks | Webhooks are primary; reconciliation is backup safety net |

**Installation:**
```bash
npm install node-cron
npm install -D @types/node-cron
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  reconciliation/
    index.ts              # startReconciliationScheduler export
    reconcile.ts          # Main reconciliation logic
    drift-detector.ts     # Drift detection functions
    auto-fixer.ts         # Auto-fix functions (conditional)
    notifications.ts      # Admin notification functions
    types.ts              # DriftIssue, ReconciliationResult types
```

### Pattern 1: Three-Way Comparison
**What:** Compare Stripe (source of truth) vs Database (cached) vs Discord (actual) to detect drift
**When to use:** Core reconciliation logic
**Example:**
```typescript
// Source: Best practice for multi-system reconciliation
interface DriftIssue {
  type: 'MISSING_ACCESS' | 'UNAUTHORIZED_ACCESS' | 'ROLE_MISMATCH' | 'DEBTOR_MISMATCH';
  memberId: string;
  discordId: string | null;
  description: string;
  stripeStatus: string | null;
  databaseStatus: string | null;
  discordRoles: string[] | null;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

// For each member with stripeCustomerId:
// 1. Fetch Stripe subscription status
// 2. Compare against database subscriptionStatus
// 3. If discordId exists, verify Discord roles match expected

async function detectDrift(member: Member): Promise<DriftIssue[]> {
  const issues: DriftIssue[] = [];

  // Get Stripe truth
  const stripeStatus = await getStripeSubscriptionStatus(member.stripeCustomerId);

  // Get Discord truth (if linked)
  const discordRoles = member.discordId
    ? await getDiscordMemberRoles(member.discordId)
    : null;

  // Compare: Stripe active but no Discord role
  if (stripeStatus === 'active' && discordRoles && !hasMemberRole(discordRoles)) {
    issues.push({
      type: 'MISSING_ACCESS',
      memberId: member.id,
      discordId: member.discordId,
      description: 'Stripe active but Discord has no member role',
      stripeStatus,
      databaseStatus: member.subscriptionStatus,
      discordRoles,
      severity: 'HIGH',
    });
  }

  // Compare: Discord has role but Stripe inactive
  if ((!stripeStatus || stripeStatus === 'canceled') && discordRoles && hasMemberRole(discordRoles)) {
    issues.push({
      type: 'UNAUTHORIZED_ACCESS',
      memberId: member.id,
      discordId: member.discordId,
      description: 'Discord has member role but Stripe subscription inactive',
      stripeStatus,
      databaseStatus: member.subscriptionStatus,
      discordRoles,
      severity: 'HIGH',
    });
  }

  return issues;
}
```

### Pattern 2: node-cron Daily Schedule
**What:** Schedule reconciliation at a fixed time daily with timezone support
**When to use:** Daily reconciliation job, re-run verification
**Example:**
```typescript
// Source: node-cron documentation
import cron from 'node-cron';

// Run daily at 3:00 AM in America/New_York timezone
// Chosen for low traffic period
cron.schedule('0 3 * * *', async () => {
  if (env.RECONCILIATION_PAUSED === 'true') {
    logger.info('Reconciliation paused via environment variable');
    return;
  }

  await runReconciliation();
}, {
  timezone: 'America/New_York',
});

// Re-run verification 1 hour after fixes applied
async function scheduleVerificationRerun(): Promise<void> {
  const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
  const minute = oneHourLater.getMinutes();
  const hour = oneHourLater.getHours();

  // Create one-time job
  const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
    await runReconciliation({ isVerificationRerun: true });
    job.stop(); // One-time execution
  });
}
```

### Pattern 3: Stripe Subscription Pagination
**What:** Iterate all subscriptions with pagination, respecting rate limits
**When to use:** Building full subscription state from Stripe
**Example:**
```typescript
// Source: Stripe API pagination docs
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

async function* iterateAllSubscriptions(): AsyncGenerator<Stripe.Subscription> {
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const page = await stripe.subscriptions.list({
      limit: 100, // Max allowed
      status: 'all', // Include active, past_due, canceled
      starting_after: startingAfter,
    });

    for (const subscription of page.data) {
      yield subscription;
    }

    hasMore = page.has_more;
    if (page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    }
  }
}

// Build lookup map from Stripe
async function buildStripeSubscriptionMap(): Promise<Map<string, Stripe.Subscription>> {
  const map = new Map<string, Stripe.Subscription>();

  for await (const subscription of iterateAllSubscriptions()) {
    const customerId = subscription.customer as string;
    map.set(customerId, subscription);
  }

  return map;
}
```

### Pattern 4: Discord Guild Members Fetch
**What:** Fetch all guild members with roles for comparison
**When to use:** Building Discord role state for reconciliation
**Example:**
```typescript
// Source: discord.js documentation
import { discordClient } from '../bot/client.js';
import { env } from '../config/env.js';
import { MANAGED_ROLES } from '../config/discord.js';

async function buildDiscordMemberMap(): Promise<Map<string, string[]>> {
  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) throw new Error('Guild not found');

  // Fetch all members (use cache for smaller guilds, fetch for accuracy)
  // For guilds under 1000 members, this is fast
  const members = await guild.members.fetch();

  const map = new Map<string, string[]>();

  for (const [discordId, member] of members) {
    const managedRoles = member.roles.cache
      .filter(r => (MANAGED_ROLES as readonly string[]).includes(r.name))
      .map(r => r.name);

    map.set(discordId, managedRoles);
  }

  return map;
}
```

### Pattern 5: ReconciliationRun Audit Model
**What:** Store reconciliation run results for audit trail
**When to use:** Every reconciliation run, admin review
**Example:**
```prisma
// Add to schema.prisma
model ReconciliationRun {
  id                String   @id @default(cuid())
  startedAt         DateTime @default(now())
  completedAt       DateTime?

  // Counts
  membersChecked    Int      @default(0)
  teamsChecked      Int      @default(0)
  issuesFound       Int      @default(0)
  issuesFixed       Int      @default(0)

  // Mode
  autoFixEnabled    Boolean  @default(false)
  isVerificationRun Boolean  @default(false)
  triggeredBy       String   // 'scheduled' | 'manual' | 'verification'

  // Results stored as JSON
  issues            Json[]   @default([])

  @@index([startedAt])
}
```

### Pattern 6: Admin Notification (Discord + Email)
**What:** Notify admins via both Discord channel and email when issues found
**When to use:** After reconciliation detects drift
**Example:**
```typescript
// Source: Existing alertAdmin pattern in roles.ts, CONTEXT.md decisions
import { TextChannel } from 'discord.js';

interface ReconciliationResult {
  runId: string;
  issuesFound: number;
  issuesFixed: number;
  issues: DriftIssue[];
  autoFixEnabled: boolean;
}

async function notifyAdmins(result: ReconciliationResult): Promise<void> {
  // Per CONTEXT.md: Only notify when issues found, not "all clear"
  if (result.issuesFound === 0) {
    logger.info('Reconciliation complete: no issues found');
    return;
  }

  // Build summary message
  const summary = formatReconciliationSummary(result);

  // 1. Discord admin channel notification
  if (env.DISCORD_ADMIN_CHANNEL_ID) {
    try {
      const channel = await discordClient.channels.fetch(env.DISCORD_ADMIN_CHANNEL_ID);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send({
          content: `**[Reconciliation Alert]**\n\n${summary}`,
        });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to send reconciliation alert to Discord');
    }
  }

  // 2. Email notification to admin(s)
  // Per CONTEXT.md: Email reports when issues found
  await sendReconciliationReportEmail(result);
}

function formatReconciliationSummary(result: ReconciliationResult): string {
  const lines: string[] = [
    `**Issues Found:** ${result.issuesFound}`,
    `**Auto-Fix:** ${result.autoFixEnabled ? 'Enabled' : 'Disabled (report only)'}`,
  ];

  if (result.autoFixEnabled && result.issuesFixed > 0) {
    lines.push(`**Issues Fixed:** ${result.issuesFixed}`);
  }

  // Group by type
  const byType = groupBy(result.issues, 'type');
  for (const [type, issues] of Object.entries(byType)) {
    lines.push(`\n**${type}:** ${issues.length}`);
    // Show first 5 examples
    for (const issue of issues.slice(0, 5)) {
      lines.push(`- ${issue.description}`);
    }
    if (issues.length > 5) {
      lines.push(`- ... and ${issues.length - 5} more`);
    }
  }

  lines.push(`\nRun ID: ${result.runId}`);

  return lines.join('\n');
}
```

### Anti-Patterns to Avoid
- **Polling Stripe continuously:** Reconciliation is a daily safety net, not real-time sync. Use webhooks for real-time.
- **Querying Stripe for each member individually:** Build a single lookup map, iterate locally.
- **Auto-fixing without toggle:** Start report-only, add `RECONCILIATION_AUTO_FIX` env var.
- **Notifying affected users:** Per CONTEXT.md, silent fixes - users not notified.
- **Flagging unclaimed subscriptions:** Per CONTEXT.md, supporting without claiming is valid.
- **Notifying on "all clear":** Only send reports when issues found.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Daily scheduling | setInterval with date math | node-cron with timezone | Handles DST, cron syntax |
| Stripe pagination | Manual has_more loop | Stripe SDK auto-pagination | Built-in, handles edge cases |
| Role comparison | String matching | Set operations | Handles order, duplicates |
| Report formatting | Template strings | Structured JSON + formatter | Audit trail, parseable |
| Rate limit handling | Manual delays | Stripe SDK / discord.js built-in | Automatic retry with backoff |

**Key insight:** The reconciliation job is a batch comparison, not real-time sync. Build efficient lookup maps once, then iterate locally. Stripe rate limits (100 req/s live) are generous for batch operations.

## Common Pitfalls

### Pitfall 1: Rate Limits When Fixing Many Issues
**What goes wrong:** Auto-fix tries to update Discord roles for many members quickly, hits rate limits
**Why it happens:** Discord role updates are limited to 10 per 10s per guild
**How to avoid:**
```typescript
// Process fixes in batches with delays
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000; // 2 seconds between batches

async function applyFixes(issues: DriftIssue[]): Promise<number> {
  let fixed = 0;

  for (let i = 0; i < issues.length; i += BATCH_SIZE) {
    const batch = issues.slice(i, i + BATCH_SIZE);

    for (const issue of batch) {
      if (await applyFix(issue)) fixed++;
    }

    // Delay between batches (except last)
    if (i + BATCH_SIZE < issues.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return fixed;
}
```
**Warning signs:** 429 errors from Discord, rate limit events in logs

### Pitfall 2: Stale Discord Cache
**What goes wrong:** Discord member cache doesn't reflect recent role changes
**Why it happens:** Gateway events may be delayed or missed
**How to avoid:** Use `guild.members.fetch()` with `force: true` for reconciliation, not cache
**Warning signs:** Reconciliation keeps detecting same "issues" that are already correct

### Pitfall 3: Stripe Subscription Status Mapping
**What goes wrong:** Treating `past_due` as "unauthorized" when it's still valid access
**Why it happens:** Misunderstanding Stripe status semantics
**How to avoid:**
```typescript
// Active statuses that should have Discord access
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

function isActiveSubscription(status: string): boolean {
  return ACTIVE_STATUSES.includes(status);
}
```
**Warning signs:** Users in grace period flagged as unauthorized

### Pitfall 4: Team vs Individual Confusion
**What goes wrong:** Checking individual stripeCustomerId when member is on a team
**Why it happens:** Team members may have their own stripeCustomerId from before joining team
**How to avoid:** For team members, check team.stripeSubscriptionId, not member.stripeCustomerId
```typescript
if (member.teamId) {
  // Team member - check team subscription
  const team = await prisma.team.findUnique({ where: { id: member.teamId }});
  stripeStatus = await getTeamSubscriptionStatus(team.stripeSubscriptionId);
} else {
  // Individual - check member's customer
  stripeStatus = await getStripeSubscriptionStatus(member.stripeCustomerId);
}
```
**Warning signs:** Team members flagged incorrectly

### Pitfall 5: Knight vs Lord Role Mismatch Detection
**What goes wrong:** Flagging Lord with Lord role as "mismatch" when comparing against Knight
**Why it happens:** Not considering seatTier when determining expected role
**How to avoid:**
```typescript
function getExpectedRole(member: Member): string {
  if (member.isInDebtorState) return 'Debtor';
  if (!member.introCompleted) return 'Squire';
  if (member.seatTier === 'OWNER' || member.seatTier === 'INDIVIDUAL') return 'Lord';
  return 'Knight';
}
```
**Warning signs:** Many "role mismatch" issues for correctly-roled members

### Pitfall 6: Reconciliation During Maintenance
**What goes wrong:** Auto-fixes while admin is doing manual corrections
**Why it happens:** No pause mechanism
**How to avoid:** Per CONTEXT.md, implement `RECONCILIATION_PAUSED` env var check at start of reconciliation
**Warning signs:** Admin fixes get reverted by reconciliation

### Pitfall 7: Large Guild Member Fetch Timeout
**What goes wrong:** `guild.members.fetch()` times out for large guilds
**Why it happens:** Discord rate limits guild member requests
**How to avoid:** For guilds over 1000 members, use chunked fetch with `guild.members.list()` paginated
**Warning signs:** Reconciliation fails with timeout errors (unlikely for TRC scale)

## Code Examples

Verified patterns from official sources:

### Main Reconciliation Flow
```typescript
// Source: Pattern synthesis from codebase
export async function runReconciliation(options: {
  isVerificationRerun?: boolean;
  triggeredBy?: 'scheduled' | 'manual' | 'verification';
} = {}): Promise<ReconciliationResult> {
  const startedAt = new Date();
  const triggeredBy = options.triggeredBy ?? 'scheduled';
  const autoFixEnabled = env.RECONCILIATION_AUTO_FIX === 'true';

  logger.info({ triggeredBy, autoFixEnabled }, 'Starting reconciliation');

  // Create run record
  const run = await prisma.reconciliationRun.create({
    data: {
      triggeredBy,
      autoFixEnabled,
      isVerificationRun: options.isVerificationRerun ?? false,
    },
  });

  try {
    // Build data maps (parallel)
    const [stripeMap, discordMap] = await Promise.all([
      buildStripeSubscriptionMap(),
      buildDiscordMemberMap(),
    ]);

    // Get all members with Discord linked
    const members = await prisma.member.findMany({
      where: { discordId: { not: null }},
      include: { team: true },
    });

    // Detect drift for each member
    const allIssues: DriftIssue[] = [];
    for (const member of members) {
      const issues = await detectDrift(member, stripeMap, discordMap);
      allIssues.push(...issues);
    }

    // Check teams
    const teams = await prisma.team.findMany({
      where: { stripeSubscriptionId: { not: null }},
      include: { members: true },
    });

    for (const team of teams) {
      const issues = await detectTeamDrift(team, stripeMap, discordMap);
      allIssues.push(...issues);
    }

    // Apply fixes if enabled
    let issuesFixed = 0;
    if (autoFixEnabled && allIssues.length > 0) {
      issuesFixed = await applyFixes(allIssues);

      // Schedule verification re-run
      if (issuesFixed > 0 && !options.isVerificationRerun) {
        scheduleVerificationRerun();
      }
    }

    // Update run record
    const completedAt = new Date();
    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        completedAt,
        membersChecked: members.length,
        teamsChecked: teams.length,
        issuesFound: allIssues.length,
        issuesFixed,
        issues: allIssues as any,
      },
    });

    const result: ReconciliationResult = {
      runId: run.id,
      issuesFound: allIssues.length,
      issuesFixed,
      issues: allIssues,
      autoFixEnabled,
    };

    // Notify admins (only if issues found)
    await notifyAdmins(result);

    logger.info({
      runId: run.id,
      duration: completedAt.getTime() - startedAt.getTime(),
      membersChecked: members.length,
      issuesFound: allIssues.length,
      issuesFixed,
    }, 'Reconciliation complete');

    return result;
  } catch (error) {
    logger.error({ runId: run.id, error }, 'Reconciliation failed');

    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: { completedAt: new Date() },
    });

    throw error;
  }
}
```

### Drift Detection Function
```typescript
// Source: CONTEXT.md drift scenarios
async function detectDrift(
  member: Member & { team: Team | null },
  stripeMap: Map<string, Stripe.Subscription>,
  discordMap: Map<string, string[]>
): Promise<DriftIssue[]> {
  const issues: DriftIssue[] = [];

  if (!member.discordId) return issues;

  // Get expected state from Stripe
  let stripeActive = false;
  let stripeStatus: string | null = null;

  if (member.teamId && member.team?.stripeSubscriptionId) {
    // Team member - check team subscription
    const sub = stripeMap.get(member.team.stripeCustomerId);
    stripeStatus = sub?.status ?? null;
    stripeActive = sub ? ['active', 'trialing', 'past_due'].includes(sub.status) : false;
  } else if (member.stripeCustomerId) {
    // Individual - check member subscription
    const sub = stripeMap.get(member.stripeCustomerId);
    stripeStatus = sub?.status ?? null;
    stripeActive = sub ? ['active', 'trialing', 'past_due'].includes(sub.status) : false;
  }

  // Get actual Discord roles
  const discordRoles = discordMap.get(member.discordId) ?? [];
  const hasAnyMemberRole = discordRoles.some(r => ['Knight', 'Lord', 'Squire'].includes(r));
  const hasDebtorRole = discordRoles.includes('Debtor');

  // Scenario 1: Stripe active but Discord has no role (missing access)
  if (stripeActive && !hasAnyMemberRole && !hasDebtorRole) {
    issues.push({
      type: 'MISSING_ACCESS',
      memberId: member.id,
      discordId: member.discordId,
      description: `Stripe ${stripeStatus} but Discord has no member role`,
      stripeStatus,
      databaseStatus: member.subscriptionStatus,
      discordRoles,
      severity: 'HIGH',
    });
  }

  // Scenario 2: Discord has role but Stripe inactive (unauthorized access)
  if (!stripeActive && hasAnyMemberRole && !member.isInDebtorState) {
    issues.push({
      type: 'UNAUTHORIZED_ACCESS',
      memberId: member.id,
      discordId: member.discordId,
      description: `Discord has ${discordRoles.join(', ')} but Stripe ${stripeStatus ?? 'no subscription'}`,
      stripeStatus,
      databaseStatus: member.subscriptionStatus,
      discordRoles,
      severity: 'HIGH',
    });
  }

  // Scenario 3: Debtor state mismatch (Stripe past_due should align with Debtor role)
  if (stripeStatus === 'past_due' && member.isInDebtorState && !hasDebtorRole) {
    issues.push({
      type: 'DEBTOR_MISMATCH',
      memberId: member.id,
      discordId: member.discordId,
      description: `Member in Debtor state but Discord missing Debtor role`,
      stripeStatus,
      databaseStatus: member.subscriptionStatus,
      discordRoles,
      severity: 'MEDIUM',
    });
  }

  return issues;
}
```

### Environment Variable Additions
```typescript
// Add to src/config/env.ts
const envSchema = z.object({
  // ... existing ...

  // Reconciliation
  RECONCILIATION_AUTO_FIX: z.enum(['true', 'false']).default('false'),
  RECONCILIATION_PAUSED: z.enum(['true', 'false']).default('false'),
  RECONCILIATION_TIMEZONE: z.string().default('America/New_York'),
  RECONCILIATION_HOUR: z.coerce.number().min(0).max(23).default(3), // 3 AM
  ADMIN_EMAIL: z.string().email().optional(), // For reconciliation reports
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual drift checks | Automated reconciliation | Best practice | Catches issues before users notice |
| Single source sync | Three-way comparison | Best practice | Stripe + DB + Discord all verified |
| Immediate auto-fix | Report-only first | User request | Admin oversight before automated fixes |
| Daily email reports | Issue-only notifications | User request | Reduces noise, highlights problems |

**Deprecated/outdated:**
- Polling Stripe continuously - use webhooks for real-time, reconciliation as safety net
- In-memory scheduling - use node-cron for persistence across restarts

## Open Questions

Things that couldn't be fully resolved:

1. **Admin Email Address**
   - What we know: Need email for reconciliation reports
   - What's unclear: Who should receive? Single address or list?
   - Recommendation: Add `ADMIN_EMAIL` env var, support comma-separated for multiple

2. **Reconciliation Hour**
   - What we know: Daily at fixed time, Claude's discretion per CONTEXT.md
   - What's unclear: Optimal hour for TRC's timezone
   - Recommendation: Default to 3 AM America/New_York (low traffic), configurable via env

3. **Manual Trigger Endpoint**
   - What we know: Admin command or API endpoint per CONTEXT.md
   - What's unclear: Which approach preferred
   - Recommendation: Implement both - Discord slash command and protected API endpoint

4. **Auto-Fix Scope**
   - What we know: RECONCILIATION_AUTO_FIX env var toggles
   - What's unclear: Should some issue types be fix-only while others remain report-only?
   - Recommendation: Start with all-or-nothing toggle, refine if needed

## Sources

### Primary (HIGH confidence)
- [Stripe Rate Limits](https://docs.stripe.com/rate-limits) - 100 req/s live, 25 req/s sandbox
- [Stripe Pagination](https://docs.stripe.com/api/pagination) - auto-pagination, 100 item limit
- [Stripe Subscriptions List API](https://docs.stripe.com/api/subscriptions/list) - Status filters, pagination
- [Discord.js GuildMemberManager](https://discord.js.org/docs/packages/discord.js/main/GuildMemberManager:Class) - fetch methods
- [node-cron npm](https://www.npmjs.com/package/node-cron) - Cron syntax, timezone support
- Existing codebase: `src/billing/scheduler.ts`, `src/bot/roles.ts`, `src/webhooks/stripe.ts`

### Secondary (MEDIUM confidence)
- [Discord Rate Limits](https://discord.com/developers/docs/topics/rate-limits) - 10 role updates per 10s
- [Database Reconciliation Best Practices](https://stripe.dev/blog/database-reconciliation-growing-businesses-part-3) - Multi-system sync patterns
- [Node.js Job Scheduling](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/) - node-cron patterns

### Tertiary (LOW confidence)
- General reconciliation patterns from WebSearch - verify with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - node-cron widely used, other libraries already installed
- Architecture: HIGH - Patterns derived from existing codebase and official docs
- Drift detection: HIGH - CONTEXT.md clearly defines scenarios
- Pitfalls: MEDIUM - Based on common issues, verify during implementation
- Scheduling: HIGH - node-cron documentation clear on timezone/cron syntax

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (30 days - patterns stable, API versions may update)
