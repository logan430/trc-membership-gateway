---
phase: 37-admin-features
plan: 02
subsystem: admin-dashboard
tags: [admin, benchmarks, table, bulk-actions, moderation]

dependency-graph:
  requires:
    - 34-04: Benchmark moderation page migrated
  provides:
    - Table-based benchmark moderation with bulk actions
    - Checkbox selection for batch operations
    - Promise.allSettled pattern for parallel mutations
  affects:
    - Admin workflow efficiency for benchmark review

tech-stack:
  added: []
  patterns:
    - "Promise.allSettled for bulk mutations with partial failure handling"
    - "Set<string> for checkbox selection state"
    - "Expandable table rows for detail view"

key-files:
  created: []
  modified:
    - dashboard/src/app/admin/benchmarks/page.tsx
  deleted:
    - dashboard/src/components/admin/FlaggedBenchmarkCard.tsx

decisions:
  - key: "inline-expand-logic"
    choice: "Inline expand logic in page, remove FlaggedBenchmarkCard"
    rationale: "Single source of truth, cleaner codebase"
  - key: "alert-for-failures"
    choice: "Use browser alert for partial failure notification"
    rationale: "Simple, immediate feedback without toast infrastructure"
  - key: "set-state-for-selection"
    choice: "Use Set<string> for selection state"
    rationale: "O(1) lookups for isSelected checks in table rows"

metrics:
  duration: "4 minutes"
  completed: "2026-01-28"
---

# Phase 37 Plan 02: Benchmark Moderation Table Summary

**One-liner:** Table-based benchmark moderation with checkbox selection and bulk approve/reject using Promise.allSettled.

## What Was Built

Converted the admin benchmarks moderation page from a card-based list to a compact table-based layout with bulk action capabilities.

### Table Layout
- Columns: Checkbox, Member, Category, Outlier Fields, Submitted, Actions
- Expandable rows show full JSON submission data when clicked
- Header checkbox for select all/deselect all
- Individual row checkboxes for fine-grained selection

### Bulk Actions
- Sticky bulk action bar appears when 1+ items selected
- "Approve All" button with loading spinner
- "Reject All" button with loading spinner
- "Clear" button to deselect all
- Disabled state during bulk operations

### Partial Failure Handling
- Promise.allSettled runs all mutations in parallel
- Counts rejected promises and shows alert with failure count
- Invalidates queries and clears selection after completion
- Individual mutations continue even if some fail

### Individual Actions
- Each row has expand/collapse, approve, and reject buttons
- Row-level pending state disables buttons during mutation
- Consistent with existing admin patterns

## Technical Implementation

### Selection State
```typescript
const [selected, setSelected] = useState<Set<string>>(new Set());
const toggleSelect = (id: string) => {
  setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};
```

### Bulk Operation Pattern
```typescript
const handleBulkApprove = async () => {
  setIsBulkPending(true);
  const results = await Promise.allSettled(
    Array.from(selected).map((id) => approveMutation.mutateAsync(id))
  );
  const failures = results.filter((r) => r.status === 'rejected').length;
  if (failures > 0) {
    alert(`${failures} of ${selected.size} failed to approve`);
  }
  queryClient.invalidateQueries({ queryKey: ['admin', 'benchmarks'] });
  clearSelection();
  setIsBulkPending(false);
};
```

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| dashboard/src/app/admin/benchmarks/page.tsx | Refactored to table with bulk actions | 367 |
| dashboard/src/components/admin/FlaggedBenchmarkCard.tsx | Deleted (inlined) | -114 |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| adae5c5 | feat | Convert benchmarks to table with bulk actions |
| e5c37ad | refactor | Remove FlaggedBenchmarkCard component |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria passed:
1. Page loads with table layout showing flagged benchmarks
2. Checkbox in header selects/deselects all
3. Individual checkboxes work
4. Bulk action bar appears when 1+ items selected
5. "Approve All" approves all selected items
6. "Reject All" rejects all selected items
7. Partial failures show error count
8. Individual row approve/reject still works
9. Expanded row shows submission JSON data

## Success Criteria Met

- [x] Table layout with checkbox column
- [x] Bulk action bar with Approve All, Reject All, Clear
- [x] Promise.allSettled handles parallel mutations
- [x] Partial failures reported to admin
- [x] Individual row actions preserved
- [x] Stats cards and category filter unchanged

## Next Plan Readiness

Plan 37-03 (Analytics Dashboard) can proceed independently.

---

*Plan completed: 2026-01-28*
*Duration: 4 minutes*
*Tasks: 2/2 complete*
