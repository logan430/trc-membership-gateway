# Phase 23: Email Templates Dashboard - Research

**Researched:** 2026-01-21
**Domain:** Admin dashboard UI, email template management, Handlebars-style variable substitution
**Confidence:** HIGH

## Summary

This phase enhances the existing email templates admin dashboard to match the CONTEXT.md decisions. The codebase already has:
- An `EmailTemplate` Prisma model with `name`, `subject`, `body`, `updatedAt`, `updatedBy` fields
- Admin API routes at `/api/admin/templates` with GET, GET/:name, PUT/:name, GET/:name/preview, POST/seed endpoints
- A basic templates UI at `/public/admin/templates.html` with list, editor, and preview panels
- Default templates defined in `src/routes/admin/templates.ts` with Handlebars-style `{{variable}}` syntax

However, critical gaps exist:
1. **Email sending does NOT use database templates** - `src/email/send.ts` uses hardcoded functions from `templates.ts`, not the database
2. **No reset-to-default functionality** - CONTEXT.md requires a "Reset to default" button
3. **No variable validation** - CONTEXT.md requires warning on unknown variables like `{{typo}}`
4. **No click-to-insert variable chips** - CONTEXT.md requires this UX feature
5. **No category grouping** - Current UI is a flat list; CONTEXT.md wants expandable category sections
6. **No dedicated edit page** - CONTEXT.md wants `/app/admin/templates/:id` for full-page editing
7. **Super admin only** - Current PUT endpoint requires `requireSuperAdmin`; CONTEXT.md says all admins can edit

**Primary recommendation:** Focus implementation on bridging the database-to-email-send gap and enhancing the UI with CONTEXT.md features, reusing the extensive existing admin CSS/patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | Current | Database ORM | Already used for EmailTemplate model |
| Express | Current | API routes | Already used for admin routes |
| Zod | Current | Request validation | Already used in template routes |
| Vanilla JS | - | Frontend logic | Pattern used in all admin pages |

### Supporting (Already in Use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Variables | - | Theming | Medieval theme colors already defined |
| Fetch API | - | HTTP requests | Used in all admin JS |

### No New Dependencies Needed
This phase requires NO new npm packages. All functionality can be implemented with:
- String manipulation for variable detection/substitution
- DOM manipulation for click-to-insert chips
- CSS for category grouping/collapsible sections

## Architecture Patterns

### Existing Project Structure (Relevant Files)
```
src/
├── email/
│   ├── provider.ts      # Email provider interface
│   ├── send.ts          # Email sending functions (NEEDS MODIFICATION)
│   └── templates.ts     # Hardcoded templates (FALLBACK ONLY)
├── routes/admin/
│   └── templates.ts     # Admin API routes (NEEDS ENHANCEMENT)
├── lib/
│   └── audit.ts         # Audit logging (already used)
prisma/
└── schema.prisma        # EmailTemplate model (COMPLETE)
public/admin/
├── templates.html       # Templates list page (NEEDS ENHANCEMENT)
├── styles.css           # Admin CSS (REUSE PATTERNS)
└── member-detail.html   # Pattern for detail page
```

### Pattern 1: Database Template with Fallback
**What:** Email sending should try database first, fall back to hardcoded if not found
**When to use:** All email send functions
**Example:**
```typescript
// Source: Existing pattern in templates.ts + new database lookup
async function getTemplate(name: string): Promise<{ subject: string; body: string }> {
  // Try database first
  const dbTemplate = await prisma.emailTemplate.findUnique({ where: { name } });
  if (dbTemplate) {
    return { subject: dbTemplate.subject, body: dbTemplate.body };
  }

  // Fall back to hardcoded DEFAULT_TEMPLATES
  const hardcoded = DEFAULT_TEMPLATES.find(t => t.name === name);
  if (hardcoded) {
    return { subject: hardcoded.subject, body: hardcoded.body };
  }

  throw new Error(`Template '${name}' not found`);
}
```

### Pattern 2: Variable Substitution (Handlebars-style)
**What:** Replace `{{variableName}}` with actual values
**When to use:** Template preview and email sending
**Example:**
```typescript
// Source: Already implemented in routes/admin/templates.ts lines 390-398
function substituteVariables(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}
```

### Pattern 3: Variable Validation
**What:** Detect unknown variables that don't match expected set
**When to use:** On template save
**Example:**
```typescript
// Extract all {{variables}} from template
const extractVariables = (text: string): string[] => {
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  return matches.map(m => m.replace(/\{\{|\}\}/g, ''));
};

// Known variables per template
const KNOWN_VARIABLES: Record<string, string[]> = {
  welcome: ['claimUrl'],
  claim_reminder: ['claimUrl'],
  payment_failure: ['gracePeriodHours', 'portalUrl'],
  // ... etc
};

// Validate
const unknownVars = extractVariables(body).filter(v => !KNOWN_VARIABLES[templateName]?.includes(v));
if (unknownVars.length > 0) {
  // Return warning (not error) to user
}
```

### Pattern 4: Admin Page Detail Pattern
**What:** Dedicated edit page at `/app/admin/templates/:name`
**When to use:** Full-page template editing
**Source:** Pattern from `member-detail.html`
- Extract ID from URL path
- Load data with `GET /api/admin/templates/:name`
- Form with subject/body inputs
- Save button calls `PUT /api/admin/templates/:name`
- Back link to list page

### Anti-Patterns to Avoid
- **Client-side template rendering for sending:** Always render templates server-side for security
- **Blocking on missing database template:** Always have fallback to hardcoded defaults
- **Requiring new database migration:** The EmailTemplate model is already complete

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variable extraction | Custom parser | Simple regex `/\{\{(\w+)\}\}/g` | Handlebars syntax is simple enough |
| Collapsible sections | Custom JS accordion | HTML `<details>/<summary>` elements | Native browser support, accessible |
| Click-to-insert | Complex cursor management | `textarea.setRangeText()` API | Modern browser API handles cursor position |
| Audit logging | Custom logging | Existing `logAuditEvent()` function | Already implemented with correct patterns |

**Key insight:** The existing codebase has excellent patterns. Reuse audit logging, CSS classes, and API patterns rather than creating new abstractions.

## Common Pitfalls

### Pitfall 1: Forgetting Fallback to Hardcoded Templates
**What goes wrong:** If database is empty or template is deleted, emails fail to send
**Why it happens:** Over-reliance on database without fallback
**How to avoid:** Always check DEFAULT_TEMPLATES if database lookup fails
**Warning signs:** Empty template list in UI, email send errors in logs

### Pitfall 2: Breaking Existing Email Flow
**What goes wrong:** Modifying `send.ts` incorrectly breaks webhook-triggered emails
**Why it happens:** Email sending is triggered by Stripe webhooks, hard to test manually
**How to avoid:**
- Keep existing template functions as fallback
- Add database lookup as enhancement, not replacement
- Test with `EMAIL_PROVIDER=console` to see output
**Warning signs:** Webhook errors in logs, missing emails

### Pitfall 3: Variable Mismatch Between UI and Backend
**What goes wrong:** UI shows different variables than what backend expects
**Why it happens:** Variables are defined in two places (UI hints and SAMPLE_DATA)
**How to avoid:** Single source of truth - derive UI hints from SAMPLE_DATA constant
**Warning signs:** Preview shows `{{undefined}}`, validation warns about valid variables

### Pitfall 4: Permission Change Breaking Existing Workflow
**What goes wrong:** Current templates require SUPER_ADMIN; changing to ADMIN may expose sensitive operations
**Why it happens:** CONTEXT.md says all admins can edit, but current code requires super admin
**How to avoid:**
- Remove `requireSuperAdmin` from PUT route
- Keep audit logging for accountability
- Consider if seed/reset should remain super-admin only
**Warning signs:** Non-super admins can't edit (expected behavior changes)

### Pitfall 5: Category Assignment Ambiguity
**What goes wrong:** Not clear which category each template belongs to
**Why it happens:** Templates have names like "welcome", "payment_failure" - categories must be derived
**How to avoid:** Define explicit category mapping:
```typescript
const TEMPLATE_CATEGORIES = {
  'Welcome': ['welcome'],
  'Billing': ['payment_failure', 'payment_recovered', 'payment_recovered_debtor'],
  'Team': ['seat_invite'],
  'Reminders': ['claim_reminder', 'claim_reminder_cheeky', 'reconciliation_report'],
};
```
**Warning signs:** Templates appear in wrong category or "Uncategorized"

## Code Examples

Verified patterns from official sources:

### Existing Admin API Pattern (GET list)
```typescript
// Source: src/routes/admin/templates.ts lines 17-22
adminTemplatesRouter.get('/', requireAdmin, async (req, res) => {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ templates });
});
```

### Existing Preview with Variable Substitution
```typescript
// Source: src/routes/admin/templates.ts lines 374-406
adminTemplatesRouter.get('/:name/preview', requireAdmin, async (req, res) => {
  const name = req.params.name as string;
  const template = await prisma.emailTemplate.findUnique({ where: { name } });

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const sampleData = SAMPLE_DATA[name] || {};
  let subject = template.subject;
  let body = template.body;

  for (const [key, value] of Object.entries(sampleData)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  }

  res.json({ preview: { subject, body }, sampleData });
});
```

### Existing Audit Logging Pattern
```typescript
// Source: src/routes/admin/templates.ts lines 86-97
await logAuditEvent({
  action: AuditAction.EMAIL_TEMPLATE_UPDATED,
  entityType: 'EmailTemplate',
  entityId: name,
  details: {
    previousSubject: currentTemplate?.subject || null,
    newSubject: subject,
    previousBodyPreview: currentTemplate?.body.slice(0, 100) || null,
    newBodyPreview: body.slice(0, 100),
  },
  performedBy: admin.id,
});
```

### Admin Page JS Auth Pattern
```javascript
// Source: public/admin/templates.html lines 146-158
function checkAuth() {
  const token = getAdminToken();
  if (!token) {
    window.location.href = '/app/admin/login';
    return false;
  }
  return true;
}
```

### Click-to-Insert at Cursor Position
```javascript
// Native browser API for inserting text at cursor
function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.setRangeText(text, start, end, 'end');
  textarea.focus();
}

// Usage: Variable chip click handler
chipElement.addEventListener('click', () => {
  insertAtCursor(bodyTextarea, `{{${variableName}}}`);
});
```

### Collapsible Category Section (Native HTML)
```html
<!-- Native HTML5 details/summary - no JS needed for expand/collapse -->
<details class="template-category" open>
  <summary class="category-header">Welcome</summary>
  <ul class="template-list-items">
    <li class="template-list-item" onclick="selectTemplate('welcome')">welcome</li>
  </ul>
</details>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded templates only | Database templates with UI | Phase 22+ | Admins can customize |
| Super admin only editing | All admins can edit | Phase 23 | Per CONTEXT.md decision |

**Current state:**
- EmailTemplate model exists and is used by admin API
- Admin API routes exist but require SUPER_ADMIN for PUT
- UI exists but is basic (no categories, no variable chips, no reset)
- Email sending uses hardcoded templates, NOT database

**Deprecated/outdated:**
- None - this is enhancement of existing infrastructure

## Open Questions

Things that couldn't be fully resolved:

1. **Should email sending fail gracefully if template missing from DB AND hardcoded?**
   - What we know: Current hardcoded templates cover all use cases
   - What's unclear: Should we add a generic fallback or error loudly?
   - Recommendation: Error loudly - missing template is a configuration error

2. **Should seed/reset operations remain super-admin only?**
   - What we know: CONTEXT.md says "all admins can edit"
   - What's unclear: Does "edit" include "reset to default" and "seed"?
   - Recommendation: Keep seed super-admin only, allow reset for all admins (it's just a specific edit)

3. **Preview: show unsaved changes or saved version?**
   - What we know: Current preview fetches from database
   - What's unclear: Should preview show current form values before saving?
   - Recommendation: Preview should show current form values (more intuitive UX)

## Integration Architecture

### Critical Gap: Database to Email Send Integration

The email system currently works like this:
```
Webhook fires -> send.ts function -> templates.ts hardcoded function -> emailProvider.send()
```

It should work like this:
```
Webhook fires -> send.ts function -> getTemplate() from DB (fallback to hardcoded) -> emailProvider.send()
```

### Implementation Strategy

1. **Create template fetcher utility** (`src/email/template-fetcher.ts`)
   - `getTemplate(name: string, variables: Record<string, string>)`
   - Returns `{ subject: string; text: string }` with variables already substituted
   - Tries database first, falls back to DEFAULT_TEMPLATES
   - Handles variable substitution

2. **Update send functions** (`src/email/send.ts`)
   - Replace direct calls to `welcomeEmailTemplate()` etc.
   - Call `getTemplate('welcome', { claimUrl })` instead
   - Keep functions async (already are)

3. **Add reset-to-default endpoint** (`src/routes/admin/templates.ts`)
   - `POST /api/admin/templates/:name/reset`
   - Copies from DEFAULT_TEMPLATES to database
   - Logs audit event

4. **Enhance UI** (`public/admin/templates.html` + new detail page)
   - Add category grouping with `<details>` elements
   - Add variable chips with click-to-insert
   - Add validation warning for unknown variables
   - Create dedicated edit page

## Sources

### Primary (HIGH confidence)
- `src/email/templates.ts` - Hardcoded template functions
- `src/email/send.ts` - Email sending implementation
- `src/routes/admin/templates.ts` - Admin API routes with DEFAULT_TEMPLATES
- `public/admin/templates.html` - Current UI implementation
- `prisma/schema.prisma` - EmailTemplate model definition
- `public/admin/styles.css` - Admin CSS patterns

### Secondary (MEDIUM confidence)
- `public/admin/member-detail.html` - Pattern for detail page structure
- `src/lib/audit.ts` - Audit logging patterns

### Tertiary (LOW confidence)
- None - all findings from codebase examination

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists, no new dependencies
- Architecture: HIGH - Clear patterns in existing codebase
- Integration: HIGH - Gap is well-understood, solution is straightforward
- UI enhancements: HIGH - CSS patterns exist, native HTML5 features available

**Research date:** 2026-01-21
**Valid until:** N/A - Project-specific research, valid for this implementation
