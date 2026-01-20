# Phase 10: Admin System - Research

**Researched:** 2026-01-19
**Domain:** Admin panel with authentication, member management, access control, configuration
**Confidence:** HIGH

## Summary

This phase builds an admin system on top of the existing Express 5.2.1 + Prisma 7 stack. The research confirms that the project's current patterns (Argon2id hashing, JWT with jose, httpOnly cookies) can be extended for admin authentication with minimal new dependencies. The admin UI will use vanilla JavaScript with the established medieval theme, consistent with existing HTML files like team-dashboard.html.

Key findings:
- **Admin authentication**: Use separate Admin model with same auth patterns (Argon2id + JWT), but with 30-day session tokens and separate cookie path
- **Member management**: Server-side pagination with Prisma cursor-based queries, vanilla JS table with select-all pattern for bulk actions
- **Confirmation dialogs**: Native HTML `<dialog>` element provides accessible, stylable confirmation with required reason input
- **Feature flags**: Store in database with simple key-value structure, cache in memory for performance
- **Audit log**: Already has AuditLog model - extend with searchable API and filtering
- **Email templates**: Store in database, use textarea with live preview (CodeMirror overkill for this use case)

**Primary recommendation:** Extend existing patterns rather than introducing new libraries. Use separate Admin model with role field, reuse JWT/Argon2id infrastructure, build vanilla JS admin UI matching medieval theme.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP server | Already in use |
| @prisma/client | 7.2.0 | Database ORM | Already in use |
| argon2 | 0.44.0 | Password hashing | Already in use (OWASP 2025 compliant) |
| jose | 6.1.3 | JWT tokens | Already in use |
| zod | 4.3.5 | Input validation | Already in use |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cookie | 1.1.1 | Cookie parsing | Already in use for refresh tokens |
| pino | 10.2.0 | Logging | Already in use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom admin panel | AdminJS | Heavy dependency (5MB+), would clash with medieval theme |
| Vanilla JS tables | ag-Grid/Tabulator | Overkill for <1000 member dataset, adds complexity |
| Textarea | Monaco/CodeMirror | 2-5MB bundle for simple template editing, not justified |
| Custom dialogs | a11y-dialog library | Native `<dialog>` has sufficient accessibility built-in |

**Installation:**
```bash
# No new packages needed - all requirements met by existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  admin/
    auth.ts             # Admin-specific auth (login, session)
    middleware.ts       # requireAdmin, requireSuperAdmin middleware
  routes/
    admin/
      auth.ts           # POST /admin/login, POST /admin/logout
      members.ts        # GET/PATCH/DELETE /admin/members
      access.ts         # POST /admin/members/:id/revoke, /reset-claim, /grant-role
      config.ts         # GET/PATCH /admin/config, /admin/feature-flags
      audit.ts          # GET /admin/audit-logs
      admins.ts         # GET/POST/DELETE /admin/admins (super admin only)
      templates.ts      # GET/PUT /admin/templates/:name
public/
  admin/
    login.html          # Admin login page
    dashboard.html      # Main admin dashboard
    members.html        # Member management table
    member-detail.html  # Individual member view
    config.html         # Configuration page
    audit.html          # Audit log viewer
    admins.html         # Admin management (super admin only)
    templates.html      # Email template editor
prisma/
  seed.ts               # First admin creation script
```

### Pattern 1: Separate Admin Authentication
**What:** Admins have their own model and authentication flow, separate from Members
**When to use:** Always for admin access
**Example:**
```typescript
// prisma/schema.prisma addition
model Admin {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  role         AdminRole @default(ADMIN)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  createdBy    String?   // Admin ID who created this admin
}

enum AdminRole {
  ADMIN        // Member management only
  SUPER_ADMIN  // Full access including admin management + system config
}
```

### Pattern 2: Admin JWT with Separate Cookie Path
**What:** Admin tokens use same JWT infrastructure but different cookie path to avoid conflicts
**When to use:** All admin authentication
**Example:**
```typescript
// src/admin/auth.ts
export const ADMIN_REFRESH_COOKIE_NAME = 'trc_admin_refresh';
export const ADMIN_REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/admin/auth/refresh',  // Separate from member path
  maxAge: 30 * 24 * 60 * 60,    // 30 days per CONTEXT.md
};

// Token payload includes admin flag
export interface AdminTokenPayload {
  sub: string;
  type?: 'refresh';
  isAdmin: true;
  role: 'ADMIN' | 'SUPER_ADMIN';
}
```

### Pattern 3: Server-Side Pagination with Prisma
**What:** Use cursor-based pagination for scalable member listing
**When to use:** Member list API
**Example:**
```typescript
// GET /admin/members?cursor=xxx&limit=50&status=ACTIVE&search=john
const members = await prisma.member.findMany({
  take: limit + 1,  // Fetch one extra to detect hasMore
  skip: cursor ? 1 : 0,
  cursor: cursor ? { id: cursor } : undefined,
  where: {
    AND: [
      status ? { subscriptionStatus: status } : {},
      search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { discordUsername: { contains: search, mode: 'insensitive' } },
        ],
      } : {},
    ],
  },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    email: true,
    discordUsername: true,
    subscriptionStatus: true,
    seatTier: true,
    discordId: true,
    createdAt: true,
  },
});

const hasMore = members.length > limit;
const results = hasMore ? members.slice(0, limit) : members;
const nextCursor = hasMore ? results[results.length - 1].id : null;
```

### Pattern 4: Confirmation Dialog with Reason
**What:** Destructive actions require confirmation + logged reason using native `<dialog>`
**When to use:** Revoke access, reset claim, any destructive action
**Example:**
```html
<dialog id="confirm-dialog">
  <form method="dialog">
    <h3 id="confirm-title">Confirm Action</h3>
    <p id="confirm-message"></p>
    <label>
      Reason (required):
      <textarea id="confirm-reason" required minlength="10"></textarea>
    </label>
    <div class="dialog-buttons">
      <button value="cancel" formmethod="dialog">Cancel</button>
      <button id="confirm-submit" class="btn-danger">Confirm</button>
    </div>
  </form>
</dialog>

<script>
async function showConfirmDialog(title, message, action) {
  const dialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-reason').value = '';

  return new Promise((resolve) => {
    dialog.showModal();
    dialog.querySelector('form').onsubmit = (e) => {
      if (e.submitter?.value === 'cancel') {
        resolve(null);
      } else {
        resolve(document.getElementById('confirm-reason').value);
      }
    };
  });
}
</script>
```

### Pattern 5: Feature Flags in Database
**What:** Store feature flags as database records with in-memory caching
**When to use:** All toggleable behaviors
**Example:**
```typescript
// prisma/schema.prisma
model FeatureFlag {
  id          String   @id @default(cuid())
  key         String   @unique
  enabled     Boolean  @default(false)
  description String?
  category    String   @default("general")  // general, billing, discord, email
  updatedAt   DateTime @updatedAt
  updatedBy   String?  // Admin ID
}

// src/lib/feature-flags.ts
let flagCache: Map<string, boolean> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function isFeatureEnabled(key: string): Promise<boolean> {
  if (!flagCache || Date.now() > cacheExpiry) {
    const flags = await prisma.featureFlag.findMany();
    flagCache = new Map(flags.map(f => [f.key, f.enabled]));
    cacheExpiry = Date.now() + CACHE_TTL;
  }
  return flagCache.get(key) ?? false;
}

export function invalidateFlagCache() {
  flagCache = null;
}
```

### Anti-Patterns to Avoid
- **Shared credentials for admin**: Creates accountability issues, no audit trail for who did what
- **Using Member model for admins**: Conflates member and admin concerns, security risk
- **Client-side filtering of large datasets**: Performance degrades, exposes all data to client
- **Hardcoded feature flags**: Requires deployment to change, defeats purpose of toggles
- **Console-only audit logs**: No searchability, lost on restart, not queryable

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password verification timing | Custom comparison | Argon2's built-in verify (already in project) | Timing attacks are subtle |
| JWT token creation | Manual string building | jose library (already in project) | Easy to get wrong |
| Confirmation dialogs | Custom modal JS | Native `<dialog>` element | Built-in accessibility, focus trap |
| CSRF for forms | Custom token system | SameSite=Strict cookies + origin check | Browser handles most of it |
| HTML entity escaping | Manual replace | textContent assignment or Zod | XSS prevention |

**Key insight:** The existing codebase already has robust patterns for auth, validation, and security. Extend them rather than introducing alternatives.

## Common Pitfalls

### Pitfall 1: Mixing Admin and Member Sessions
**What goes wrong:** Admin cookie overwrites member cookie or vice versa
**Why it happens:** Using same cookie name for both
**How to avoid:** Use separate cookie names (`trc_refresh` vs `trc_admin_refresh`) and different paths (`/auth/refresh` vs `/admin/auth/refresh`)
**Warning signs:** Users getting logged out unexpectedly, "Invalid token" errors after admin login

### Pitfall 2: Forgetting to Log Audit Events
**What goes wrong:** Actions happen but can't be traced
**Why it happens:** Audit logging added as afterthought, not in core patterns
**How to avoid:** Create helper function `logAuditEvent(action, entityType, entityId, details, performedBy)` and use it consistently
**Warning signs:** "What happened to member X?" questions can't be answered

### Pitfall 3: Destructive Actions Without Reason
**What goes wrong:** Admin revokes member, no record of why
**Why it happens:** Reason field made optional or skipped in UI
**How to avoid:** Make reason required in both API (Zod validation) and UI (required attribute)
**Warning signs:** Audit log entries with null/empty reasons

### Pitfall 4: Offset Pagination Performance
**What goes wrong:** Member list gets slower as database grows
**Why it happens:** Using `skip: (page - 1) * limit` - database still scans skipped rows
**How to avoid:** Use cursor-based pagination with Prisma's `cursor` option
**Warning signs:** Slow response times for later pages, increasing with dataset

### Pitfall 5: Feature Flag Cache Stale After Update
**What goes wrong:** Admin toggles flag but effect not immediate
**Why it happens:** In-memory cache not invalidated after update
**How to avoid:** Call `invalidateFlagCache()` in the flag update endpoint
**Warning signs:** Flag changes take random time to take effect

### Pitfall 6: Super Admin Self-Demotion
**What goes wrong:** Only super admin demotes themselves, no one can manage admins
**Why it happens:** No guard against self-role-change
**How to avoid:** Check if requester is changing their own role, require another super admin exists
**Warning signs:** "No super admin exists" state

## Code Examples

Verified patterns from official sources and existing codebase:

### Admin Seed Script
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  // Check if any admin exists
  const existingAdmin = await prisma.admin.findFirst();

  if (existingAdmin) {
    console.log('Admin already exists, skipping seed');
    return;
  }

  // Get credentials from environment or prompt
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set for first admin'
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.admin.create({
    data: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Created super admin: ${email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Bulk Actions with Select All
```javascript
// public/admin/members.html - Bulk selection pattern
let selectedIds = new Set();

function toggleSelectAll(checkbox) {
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');
  rowCheckboxes.forEach(cb => {
    cb.checked = checkbox.checked;
    const id = cb.dataset.id;
    if (checkbox.checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
  });
  updateBulkActionBar();
}

function toggleRow(checkbox) {
  const id = checkbox.dataset.id;
  if (checkbox.checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  updateSelectAllState();
  updateBulkActionBar();
}

function updateSelectAllState() {
  const selectAll = document.getElementById('select-all');
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');
  const checkedCount = document.querySelectorAll('.row-checkbox:checked').length;

  selectAll.checked = checkedCount === rowCheckboxes.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulk-action-bar');
  const count = document.getElementById('selected-count');
  if (selectedIds.size > 0) {
    bar.style.display = 'flex';
    count.textContent = `${selectedIds.size} selected`;
  } else {
    bar.style.display = 'none';
  }
}

async function bulkRevoke() {
  const reason = await showConfirmDialog(
    'Bulk Revoke Access',
    `Revoke Discord access for ${selectedIds.size} member(s)?`,
  );
  if (!reason) return;

  const response = await fetch('/admin/members/bulk-revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      memberIds: Array.from(selectedIds),
      reason,
    }),
  });

  if (response.ok) {
    showNotification(`Revoked ${selectedIds.size} member(s)`);
    selectedIds.clear();
    loadMembers();
  }
}
```

### Audit Log Query with Filters
```typescript
// src/routes/admin/audit.ts
const auditQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  performedBy: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
});

adminAuditRouter.get('/', requireAdmin, async (req, res) => {
  const query = auditQuerySchema.parse(req.query);

  const where: Prisma.AuditLogWhereInput = {
    AND: [
      query.action ? { action: query.action } : {},
      query.entityType ? { entityType: query.entityType } : {},
      query.entityId ? { entityId: query.entityId } : {},
      query.performedBy ? { performedBy: query.performedBy } : {},
      query.startDate ? { createdAt: { gte: query.startDate } } : {},
      query.endDate ? { createdAt: { lte: query.endDate } } : {},
    ],
  };

  const logs = await prisma.auditLog.findMany({
    take: query.limit + 1,
    skip: query.cursor ? 1 : 0,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    where,
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = logs.length > query.limit;
  const results = hasMore ? logs.slice(0, query.limit) : logs;

  res.json({
    logs: results,
    nextCursor: hasMore ? results[results.length - 1].id : null,
    hasMore,
  });
});
```

### Email Template Editor with Preview
```html
<!-- Simple textarea with live preview - no heavy editor needed -->
<div class="template-editor">
  <div class="editor-panel">
    <label for="template-content">Template (Plain Text):</label>
    <textarea
      id="template-content"
      rows="20"
      oninput="updatePreview()"
    ></textarea>
    <p class="help-text">
      Variables: {{claimUrl}}, {{memberName}}, {{teamName}}, {{portalUrl}}
    </p>
  </div>
  <div class="preview-panel">
    <h4>Preview:</h4>
    <pre id="template-preview"></pre>
  </div>
</div>

<script>
const sampleData = {
  claimUrl: 'https://example.com/claim/abc123',
  memberName: 'John Doe',
  teamName: 'Acme Corp',
  portalUrl: 'https://billing.stripe.com/...',
};

function updatePreview() {
  const content = document.getElementById('template-content').value;
  let preview = content;

  for (const [key, value] of Object.entries(sampleData)) {
    preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  document.getElementById('template-preview').textContent = preview;
}
</script>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Offset pagination | Cursor-based pagination | Best practice ~2022 | Consistent performance at scale |
| Custom modal JS | Native `<dialog>` element | Chrome 37+, full support 2022 | Built-in accessibility |
| bcrypt for passwords | Argon2id | OWASP 2024-2025 recommendation | Memory-hard, GPU-resistant |
| Session cookies only | JWT + httpOnly refresh cookie | JWT adoption | Stateless access, secure refresh |

**Deprecated/outdated:**
- Global admin credentials: Security risk, no accountability
- Client-side only filtering: Exposes full dataset, performance issues
- CodeMirror 5: Development stopped, use CodeMirror 6 or simpler solutions

## Open Questions

Things that couldn't be fully resolved:

1. **Email template HTML vs Plain Text**
   - What we know: Current templates are plain text in templates.ts
   - What's unclear: Should admin be able to edit HTML or just plain text?
   - Recommendation: Start with plain text editor (simpler), add HTML later if needed

2. **Audit log retention**
   - What we know: GDPR suggests 5-7 years, HIPAA 6 years
   - What's unclear: TRC's specific compliance requirements
   - Recommendation: Keep all logs for now, add cleanup job later if needed

3. **Bulk action batch size**
   - What we know: Discord rate limit is 10 ops per 10 seconds
   - What's unclear: Optimal batch size for bulk revocations
   - Recommendation: Use existing 5-item batches with 2-second delays (from reconciliation)

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns (auth.ts, session.ts, team-dashboard.ts, team-dashboard.html)
- Prisma schema and documentation for cursor pagination
- Native HTML `<dialog>` element MDN documentation

### Secondary (MEDIUM confidence)
- [Express.js Security Best Practices 2025](https://corgea.com/Learn/express-js-security-best-practices-2025)
- [Prisma Seeding Documentation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)
- [PatternFly Bulk Selection Pattern](https://www.patternfly.org/patterns/bulk-selection/)
- [MDN Dialog Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)
- [Audit Logging Best Practices](https://middleware.io/blog/audit-logs/)
- [Feature Toggles (Martin Fowler)](https://martinfowler.com/articles/feature-toggles.html)
- [11 Principles for Feature Flag Systems](https://docs.getunleash.io/guides/feature-flag-best-practices)

### Tertiary (LOW confidence)
- Community blog posts on admin panel patterns
- General JavaScript table library comparisons

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project dependencies, no new libraries
- Architecture: HIGH - Extending proven patterns from existing codebase
- Admin auth: HIGH - Same patterns as member auth, well-established
- Pagination: HIGH - Prisma cursor pagination is documented, straightforward
- Feature flags: MEDIUM - Simple implementation, may need refinement at scale
- Audit log search: MEDIUM - Basic implementation clear, advanced filtering may need iteration
- Pitfalls: HIGH - Based on actual patterns observed in codebase

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (30 days - stable stack, no fast-moving dependencies)
