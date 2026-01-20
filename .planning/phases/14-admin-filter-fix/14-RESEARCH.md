# Phase 14: Admin Filter Fix - Research

**Researched:** 2026-01-20
**Domain:** Frontend-Backend API Parameter Alignment
**Confidence:** HIGH

## Summary

This phase addresses a minor integration gap identified in the v1 milestone audit: the admin subscription status filter silently fails because the frontend sends a different parameter name than the backend expects.

The root cause is straightforward: the frontend members page sends `subscriptionStatus` as the query parameter, while the backend Zod schema expects `status`. This causes the filter to be silently ignored (Zod strips unknown fields by default), resulting in all members being shown regardless of the selected filter.

**Primary recommendation:** Change the backend parameter name from `status` to `subscriptionStatus` to match the frontend, preserving semantic consistency with the database field name.

## Standard Stack

This fix involves minimal changes to existing code:

### Core Files
| File | Location | Purpose |
|------|----------|---------|
| `members.ts` | `src/routes/admin/members.ts` | Backend members API with Zod validation |
| `members.html` | `public/admin/members.html` | Admin members list with filter UI |

### Supporting Libraries (Already in Use)
| Library | Purpose | Notes |
|---------|---------|-------|
| Zod | Query parameter validation | Already configured, just need to rename field |
| Prisma | Database queries | Field already named `subscriptionStatus` |

## Architecture Patterns

### Current Code Structure

**Backend Query Schema (src/routes/admin/members.ts:11-19):**
```typescript
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  status: z.enum(['NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED']).optional(),  // <-- PROBLEM
  seatTier: z.enum(['INDIVIDUAL', 'OWNER', 'TEAM_MEMBER']).optional(),
  hasDiscord: z.enum(['true', 'false']).optional(),
  introCompleted: z.enum(['true', 'false']).optional(),
});
```

**Frontend Filter Logic (public/admin/members.html:242-256):**
```javascript
function getFilters() {
  const filters = {};
  const search = document.getElementById('search').value.trim();
  const status = document.getElementById('status').value;
  // ...
  if (status) filters.subscriptionStatus = status;  // <-- SENDS subscriptionStatus
  // ...
  return filters;
}
```

### Recommended Fix Pattern

Change the backend to match the frontend (and database field name):

```typescript
const listQuerySchema = z.object({
  // ... other fields ...
  subscriptionStatus: z.enum(['NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED']).optional(),
  // ... other fields ...
});
```

And update the usage in the filter logic:

```typescript
if (query.subscriptionStatus) {
  conditions.push({ subscriptionStatus: query.subscriptionStatus });
}
```

### Why Backend Change vs Frontend Change

| Approach | Pros | Cons |
|----------|------|------|
| **Change backend** | Matches database field name; Frontend already correct | Minor backend change |
| Change frontend | No backend change | Inconsistent naming (API param differs from DB field) |

**Recommendation:** Change backend. The frontend is already semantically correct by using `subscriptionStatus`, which matches the Prisma model field name.

## Don't Hand-Roll

No libraries or custom solutions needed for this fix. This is a simple parameter rename.

## Common Pitfalls

### Pitfall 1: Zod Silent Stripping
**What goes wrong:** Zod's default behavior is to strip unknown fields rather than error
**Why it happened here:** `subscriptionStatus` wasn't in the schema, so it was silently dropped
**How to avoid in future:** Consider using `z.object().strict()` for API schemas to catch mismatches during development

### Pitfall 2: Incomplete Filter Options
**What we found:** The frontend dropdown is missing the `TRIALING` status option
**Current frontend options (members.html:40-46):**
- All Statuses, ACTIVE, PAST_DUE, CANCELLED, NONE

**Backend accepts (members.ts:15):**
- NONE, TRIALING, ACTIVE, PAST_DUE, CANCELLED

**Impact:** Admins cannot filter by TRIALING status
**Recommendation:** Add TRIALING option to the dropdown (low priority, but completes the fix)

### Pitfall 3: Dashboard Uses Correct Parameter
**Note:** The dashboard.html (lines 212, 215) already uses `subscriptionStatus` correctly:
```javascript
fetch('/api/admin/members?limit=1&subscriptionStatus=ACTIVE', ...)
fetch('/api/admin/members?limit=1&subscriptionStatus=PAST_DUE', ...)
```
These calls are also silently failing. Fixing the backend will fix both pages simultaneously.

## Code Examples

### Backend Fix (src/routes/admin/members.ts)

**Before (line 15):**
```typescript
status: z.enum(['NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED']).optional(),
```

**After:**
```typescript
subscriptionStatus: z.enum(['NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED']).optional(),
```

**Before (line 43-44):**
```typescript
if (query.status) {
  conditions.push({ subscriptionStatus: query.status });
}
```

**After:**
```typescript
if (query.subscriptionStatus) {
  conditions.push({ subscriptionStatus: query.subscriptionStatus });
}
```

### Frontend Enhancement (optional - public/admin/members.html)

**Before (lines 40-46):**
```html
<select id="status">
  <option value="">All Statuses</option>
  <option value="ACTIVE">Active</option>
  <option value="PAST_DUE">Past Due</option>
  <option value="CANCELLED">Cancelled</option>
  <option value="NONE">None</option>
</select>
```

**After (add TRIALING):**
```html
<select id="status">
  <option value="">All Statuses</option>
  <option value="ACTIVE">Active</option>
  <option value="TRIALING">Trialing</option>
  <option value="PAST_DUE">Past Due</option>
  <option value="CANCELLED">Cancelled</option>
  <option value="NONE">None</option>
</select>
```

## State of the Art

No external libraries or patterns needed - this is a simple bug fix.

## Open Questions

None. The fix is straightforward.

## Verification Strategy

After applying the fix:

1. **Manual test in admin members page:**
   - Select "Active" from Status dropdown
   - Verify only members with ACTIVE status are shown
   - Repeat for each status option

2. **Test dashboard stat counts:**
   - Verify "Active Subscriptions" count matches actual active members
   - Verify "Billing Issues" count matches PAST_DUE members

3. **API test:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     "/api/admin/members?subscriptionStatus=ACTIVE"
   ```
   Should return only members with ACTIVE subscriptionStatus

## Sources

### Primary (HIGH confidence)
- `src/routes/admin/members.ts` - Direct code inspection
- `public/admin/members.html` - Direct code inspection
- `public/admin/dashboard.html` - Direct code inspection
- `prisma/schema.prisma` - SubscriptionStatus enum definition
- `.planning/v1-MILESTONE-AUDIT.md` - Gap identification

## Metadata

**Confidence breakdown:**
- Problem identification: HIGH - Direct code inspection confirms mismatch
- Fix approach: HIGH - Simple parameter rename with clear rationale
- Impact assessment: HIGH - No breaking changes, additive fix

**Research date:** 2026-01-20
**Valid until:** Indefinite (this is a one-time bug fix)

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/routes/admin/members.ts` | Edit | Rename `status` to `subscriptionStatus` in schema and usage |
| `public/admin/members.html` | Edit (optional) | Add TRIALING option to dropdown |

## Success Criteria Alignment

From phase definition:
1. Admin dashboard filter parameter matches backend expectation - **Fix backend parameter name**
2. Filtering by subscription status returns correct results - **Verified by testing each status**
3. All filter states work: active, past_due, canceled, none - **Add TRIALING for completeness**
