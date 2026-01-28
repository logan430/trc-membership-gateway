# Phase 37: Admin Feature Pages - Research

**Researched:** 2026-01-28
**Domain:** Admin dashboard frontend enhancements
**Confidence:** HIGH

## Summary

This phase involves enhancing 4 existing admin pages to match the UX decisions from CONTEXT.md. All backend APIs exist and are fully functional. All frontend hooks exist. All 4 pages already have working implementations - this phase is about **enhancing** them, not building from scratch.

The key finding is that substantial infrastructure already exists:
- Points Config page exists with card-based editing (needs table conversion + change history)
- Benchmarks page exists with card-based moderation (needs table conversion + bulk actions)
- Analytics page is fully implemented with tabs, KPIs, charts (needs date preset buttons + export fixes)
- Resources page exists with list view and uploader (needs drag-drop reordering + version collapse)

**Primary recommendation:** Each plan should focus on UI enhancements to existing pages rather than building new functionality. The delta between current state and requirements is smaller than expected.

## Current State Analysis

### Points Configuration Page
**Location:** `dashboard/src/app/admin/points-config/page.tsx`
**Current implementation:**
- Card-based layout with each config as a separate card
- Click "Edit" button to enter edit mode on each card
- Form fields: action (disabled), points, label, description, enabled toggle
- Save/Cancel buttons in edit mode
- Uses `usePointConfigs()` and `useUpdatePointConfig()` hooks

**Gap vs CONTEXT.md decisions:**
| Decision | Current | Gap |
|----------|---------|-----|
| Inline editing | Edit mode on card | Need click-to-edit on value directly |
| Flat list table | Card per config | Need table layout |
| Inline save indicator | Full card refresh | Need checkmark animation |
| Change history | Not shown | Need updatedAt/updatedBy display |

**API Data available:**
```typescript
interface PointConfig {
  action: string;
  label: string;
  points: number;
  enabled: boolean;
  description: string | null;
  updatedAt: string;  // Available for change history
}
```
Note: `updatedBy` is in the database but not currently returned by API. May need backend enhancement.

### Benchmarks Moderation Page
**Location:** `dashboard/src/app/admin/benchmarks/page.tsx`
**Current implementation:**
- Stats cards at top (total, flagged, valid, valid rate)
- Category breakdown in a card
- Category filter dropdown
- FlaggedBenchmarkCard component for each submission
- Individual approve/reject buttons per card
- Expandable data view

**Gap vs CONTEXT.md decisions:**
| Decision | Current | Gap |
|----------|---------|-----|
| Table list view | Card per submission | Need table layout |
| Quick action buttons | Per-card buttons | Already have approve/reject |
| Bulk actions | None | Need checkbox selection + batch operations |
| Minimal member context | Shows name + date | Already minimal |

**API Data available:**
```typescript
interface FlaggedBenchmark {
  id: string;
  memberId: string;
  category: string;
  data: Record<string, unknown>;
  outlierFields: string[];
  flagReason: string;
  isValid: boolean;
  updatedAt: string;
  member: {
    id: string;
    email: string;
    discordUsername: string | null;
  };
}
```

### Analytics Dashboard Page
**Location:** `dashboard/src/app/admin/analytics/page.tsx`
**Current implementation:**
- Fully tabbed layout (Overview, Members, Engagement, Benchmarks, Resources)
- KPI cards with MRR, active members, growth metrics
- TimeSeriesChart and ComparisonBarChart components
- RetentionHeatmap and AtRiskMemberList components
- DateRangePicker with presets (7d, 30d, 90d) + custom dates
- CSV and JSON export buttons

**Gap vs CONTEXT.md decisions:**
| Decision | Current | Gap |
|----------|---------|-----|
| Metrics cards primary | KpiCard at top | Already done |
| Presets + custom range | DateRangePicker exists | Already done |
| CSV + JSON export | Both buttons exist | Need to verify functionality |
| No comparison | Has comparison | Need to hide/remove comparison |

**This page is nearly complete.** Main work:
1. Remove period comparison from display (user decided against it)
2. Verify export functionality works correctly

### Resource Management Page
**Location:** `dashboard/src/app/admin/resources/page.tsx`
**Current implementation:**
- Resource list with search and filters (type, status)
- ResourceUploader component with drop zone
- Card per resource with edit/delete links
- Detail page with version history sidebar

**Gap vs CONTEXT.md decisions:**
| Decision | Current | Gap |
|----------|---------|-----|
| Drag and drop upload | Has click-to-browse drop zone | Needs drag-drop events |
| Featured + manual ordering | isFeatured exists | Need drag-to-reorder |
| Version history collapsed | Shown in sidebar | Need collapsible on list |
| Analytics in detail only | Downloads shown in list | Need to move to detail view |

## Standard Stack

Already in use - no new libraries needed:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | 5.x | Data fetching/caching | Project standard |
| lucide-react | 0.x | Icons | Project standard |
| date-fns | 3.x | Date formatting | Project standard |
| recharts | 2.x | Charts (analytics) | Already used in admin |

### UI Components (Already Built)
| Component | Location | Purpose |
|-----------|----------|---------|
| Button | `@/components/ui` | Actions |
| Card | `@/components/ui` | Container |
| Input | `@/components/ui` | Form fields |
| KpiCard | `@/components/admin` | Metric display |
| DateRangePicker | `@/components/admin` | Date filtering |
| MembersTable | `@/components/admin` | Table pattern |

### Potential Addition for Drag-Drop
| Library | Purpose | When |
|---------|---------|------|
| @dnd-kit/core | Drag and drop | If native HTML5 DnD insufficient for resource ordering |

## Architecture Patterns

### Existing Page Structure
All admin pages follow this pattern:
```typescript
'use client';

export default function AdminXxxPage() {
  // 1. State hooks
  const [filters, setFilters] = useState(...);

  // 2. Data hooks
  const { data, isLoading } = useAdminXxx();
  const mutation = useUpdateXxx();

  // 3. Loading state
  if (isLoading) {
    return <PageLoader message="Loading..." />;
  }

  // 4. Main layout
  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header with icon + title */}
      {/* Filters/actions bar */}
      {/* Main content */}
    </div>
  );
}
```

### Inline Edit Pattern (for Points Config)
Pattern from existing edit functionality:
```typescript
function EditableCell({ value, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const mutation = useUpdateMutation();

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className="cursor-pointer hover:bg-accent px-2 py-1 rounded"
      >
        {value}
      </span>
    );
  }

  return (
    <Input
      value={tempValue}
      onChange={(e) => setTempValue(e.target.value)}
      onBlur={() => {
        mutation.mutate(tempValue, {
          onSuccess: () => setEditing(false)
        });
      }}
      autoFocus
    />
  );
}
```

### Bulk Selection Pattern (for Benchmarks)
Standard React pattern:
```typescript
const [selected, setSelected] = useState<Set<string>>(new Set());

const toggleSelect = (id: string) => {
  setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

const selectAll = () => {
  setSelected(new Set(items.map(i => i.id)));
};

const clearSelection = () => {
  setSelected(new Set());
};
```

### Table Pattern (from MembersTable)
```typescript
<div className="overflow-x-auto">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b-2 border-border">
        <th className="text-left py-3 px-4 font-semibold text-foreground">Column</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item) => (
        <tr key={item.id} className="border-b border-border/50 hover:bg-accent/50">
          <td className="py-3 px-4">Content</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching | Custom fetch + state | React Query hooks (already done) | Caching, deduplication, refetch |
| Date formatting | Manual string manipulation | date-fns formatDistanceToNow | Edge cases, localization |
| Charts | Canvas/SVG from scratch | Recharts (already used) | Complex rendering, responsiveness |
| Drag and drop | Raw HTML5 DnD events | @dnd-kit or existing pattern | Cross-browser, touch support |

## Common Pitfalls

### Pitfall 1: Over-Engineering Table Conversion
**What goes wrong:** Building complex DataTable component when simple table suffices
**Why it happens:** Thinking "we need sorting/filtering" when API already handles it
**How to avoid:** Use the MembersTable pattern - simple HTML table with inline styles
**Warning signs:** Adding sortable columns when API doesn't support sort params

### Pitfall 2: Optimistic Updates Without Rollback
**What goes wrong:** UI shows success before API confirms, then crashes on failure
**Why it happens:** Trying to make inline edits feel instant
**How to avoid:** React Query's `onMutate`/`onError`/`onSettled` pattern or simple loading states
**Warning signs:** No error handling in mutation callbacks

### Pitfall 3: Bulk Action Race Conditions
**What goes wrong:** Approving 10 items fires 10 parallel requests, some fail silently
**Why it happens:** forEach with async operations
**How to avoid:** Promise.allSettled() and show partial failure UI
**Warning signs:** Bulk action with no loading indicator per item

### Pitfall 4: Breaking Existing Functionality
**What goes wrong:** Changing page structure breaks working features
**Why it happens:** Not understanding current implementation before modifying
**How to avoid:** Read current code thoroughly, make incremental changes
**Warning signs:** Removing or replacing entire components

## Code Examples

### Inline Editable Number (Points Config)
```typescript
// Source: Pattern from existing PointConfigCard
function InlineEditableValue({
  value,
  onSave
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(parseInt(tempValue, 10));
    setSaving(false);
    setEditing(false);
    setShowCheck(true);
    setTimeout(() => setShowCheck(false), 2000);
  };

  if (editing) {
    return (
      <input
        type="number"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        autoFocus
        className="w-20 px-2 py-1 border rounded text-right"
      />
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span
        onClick={() => setEditing(true)}
        className="cursor-pointer hover:bg-accent px-2 py-1 rounded font-medium"
      >
        {value}
      </span>
      {showCheck && <Check className="w-4 h-4 text-success animate-fade-out" />}
    </span>
  );
}
```

### Bulk Selection Table Row
```typescript
// Source: Standard React pattern
<tr className="border-b border-border/50 hover:bg-accent/50">
  <td className="py-3 px-4">
    <input
      type="checkbox"
      checked={selected.has(item.id)}
      onChange={() => toggleSelect(item.id)}
      className="rounded border-border"
    />
  </td>
  <td className="py-3 px-4">{item.name}</td>
  {/* ... other columns */}
</tr>
```

### Bulk Action Bar
```typescript
// Source: Common UI pattern
{selected.size > 0 && (
  <div className="sticky top-0 bg-card border-b border-border p-3 flex items-center gap-4">
    <span className="text-sm text-muted-foreground">
      {selected.size} selected
    </span>
    <Button size="sm" onClick={handleBulkApprove} disabled={isPending}>
      Approve All
    </Button>
    <Button size="sm" variant="outline" onClick={handleBulkReject} disabled={isPending}>
      Reject All
    </Button>
    <Button size="sm" variant="ghost" onClick={clearSelection}>
      Clear
    </Button>
  </div>
)}
```

## State of the Art

| Current State | Enhancement | Impact |
|--------------|-------------|--------|
| Card-based points config | Table with inline edit | More compact, professional |
| Card-based benchmarks | Table with checkboxes | Bulk actions enabled |
| Full analytics dashboard | Remove comparison display | Simpler per user decision |
| Resources list | Add drag-drop reorder | Featured/manual ordering |

**No deprecated patterns identified.** Current code uses modern React patterns (hooks, function components, React Query).

## Open Questions

1. **Points Config Change History**
   - What we know: `updatedAt` is returned, `updatedBy` is in DB
   - What's unclear: Is `updatedBy` included in API response?
   - Recommendation: Check if backend returns updatedBy; if not, may need small backend addition

2. **Bulk Benchmark API**
   - What we know: API has single-item approve/reject endpoints
   - What's unclear: Is there a bulk endpoint or should we fire multiple requests?
   - Recommendation: Fire parallel requests with Promise.allSettled, show progress

3. **Resource Ordering Persistence**
   - What we know: `isFeatured` boolean exists
   - What's unclear: Is there a `sortOrder` or `displayOrder` field?
   - Recommendation: Check schema; may need backend enhancement for manual ordering

## Sources

### Primary (HIGH confidence)
- `dashboard/src/app/admin/points-config/page.tsx` - Current implementation
- `dashboard/src/app/admin/benchmarks/page.tsx` - Current implementation
- `dashboard/src/app/admin/analytics/page.tsx` - Current implementation
- `dashboard/src/app/admin/resources/page.tsx` - Current implementation
- `dashboard/src/hooks/useAdminPointsConfig.ts` - React Query hooks
- `dashboard/src/hooks/useAdminBenchmarks.ts` - React Query hooks
- `dashboard/src/hooks/useAdminResources.ts` - React Query hooks
- `dashboard/src/hooks/useAnalytics.ts` - React Query hooks
- `dashboard/src/lib/admin-api.ts` - API client with all endpoints and types
- `src/routes/admin/points-config.ts` - Backend API endpoints
- `src/routes/admin/benchmarks.ts` - Backend API endpoints
- `src/routes/admin/analytics.ts` - Backend API endpoints
- `src/routes/admin/resources.ts` - Backend API endpoints

### Secondary (MEDIUM confidence)
- `dashboard/src/components/admin/` - Existing reusable components
- `.planning/phases/37-admin-features/37-CONTEXT.md` - User decisions

## Metadata

**Confidence breakdown:**
- Current page state: HIGH - Read all source files directly
- API capabilities: HIGH - Read all backend route files
- Enhancement approach: HIGH - Clear delta from CONTEXT.md decisions
- Backend gaps (ordering): MEDIUM - May need schema check

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable internal codebase)
