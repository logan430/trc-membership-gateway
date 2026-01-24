# Phase 32: Member Dashboard Pages - Research

**Researched:** 2026-01-23
**Domain:** React dashboard pages, data visualization, form flows, gamification UI
**Confidence:** HIGH

## Summary

Phase 32 builds member-facing dashboard pages that connect to existing backend APIs (Phases 27-30) using the Next.js 15 foundation established in Phase 31. The dashboard shell, layout components (Sidebar, Header), and basic UI components (Button, Card, Input, GoldCoinsLoader) already exist. This phase creates the actual pages for benchmarks, resources, leaderboard, profile, account, and billing.

The backend APIs are fully implemented and ready for consumption. Chris's app provides chart components (ComparisonBar, PerformanceRadar, MetricComparisonCard, ScoreRing) that need adaptation to the medieval pixel theme. The conversational benchmark submission flow and resource library browser are greenfield UI work guided by CONTEXT.md decisions.

**Primary recommendation:** Build pages incrementally by route, with Overview API integration first, then Resources (simpler), then Benchmarks (complex forms), then Leaderboard (needs privacy toggle migration), then Account/Billing pages last (port from v1.0).

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.1.0 | React framework with App Router | Foundation from Phase 31 |
| React | 19.0.0 | UI library | Latest stable, SSR support |
| Recharts | 2.15.0 | Data visualization | Already installed, Chris has components |
| lucide-react | 0.469.0 | Icons | Pixel-friendly, already in use |
| jose | 6.0.0 | JWT handling | Auth middleware already uses it |

### Supporting (May Need to Add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.54+ | Form state management | Conversational benchmark wizard |
| zod | 4.0+ | Schema validation | Client-side form validation (match backend) |
| @tanstack/react-query | 5.62+ | Server state management | Data fetching, caching, optimistic updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hook-form | native useState | RHF better for multi-step wizard with field-by-field validation |
| @tanstack/react-query | SWR | React Query has better mutation support, devtools |
| zustand | context | Only need zustand if form state becomes too complex |

**Installation (if needed):**
```bash
cd dashboard && npm install react-hook-form zod @tanstack/react-query
```

## Architecture Patterns

### Recommended Project Structure
```
dashboard/src/
├── app/
│   └── dashboard/
│       ├── layout.tsx               # (exists) Shell with Sidebar/Header
│       ├── page.tsx                 # (exists) Overview - needs API integration
│       ├── benchmarks/
│       │   ├── page.tsx             # Category selection + submission wizard
│       │   └── results/
│       │       └── [category]/
│       │           └── page.tsx     # Results visualization per category
│       ├── resources/
│       │   ├── page.tsx             # Resource library browser
│       │   └── [id]/
│       │       └── page.tsx         # Resource detail (or use modal)
│       ├── leaderboard/
│       │   └── page.tsx             # Guild Rankings
│       ├── profile/
│       │   └── page.tsx             # Point history, download history
│       ├── account/
│       │   └── page.tsx             # Email, password management
│       └── billing/
│           └── page.tsx             # Subscription, invoices
├── components/
│   ├── ui/                          # (exists) Button, Card, Input, GoldCoinsLoader
│   ├── layout/                      # (exists) Sidebar, Header
│   ├── benchmarks/                  # NEW: Benchmark-specific components
│   │   ├── CategoryCard.tsx
│   │   ├── ConversationalWizard.tsx
│   │   ├── ComparisonBar.tsx        # Port from Chris + pixel theme
│   │   ├── MetricComparisonCard.tsx
│   │   └── PerformanceRadar.tsx
│   ├── resources/                   # NEW: Resource library components
│   │   ├── ResourceCard.tsx
│   │   ├── ResourceListItem.tsx
│   │   ├── ResourceFilters.tsx
│   │   └── ResourcePreviewModal.tsx
│   ├── leaderboard/                 # NEW: Leaderboard components
│   │   ├── LeaderboardTable.tsx
│   │   └── RankBadge.tsx
│   └── shared/                      # NEW: Cross-cutting components
│       ├── EmptyState.tsx
│       ├── ErrorState.tsx
│       └── ActivityFeed.tsx
├── hooks/                           # NEW: Custom hooks
│   ├── usePoints.ts
│   ├── useBenchmarks.ts
│   ├── useResources.ts
│   └── useLeaderboard.ts
└── lib/
    ├── api.ts                       # (exists) API client
    └── queries.ts                   # NEW: React Query query configs
```

### Pattern 1: Data Fetching with React Query
**What:** Centralized data fetching with caching, refetching, and loading states
**When to use:** All API calls in dashboard pages
**Example:**
```typescript
// hooks/usePoints.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePointsSummary() {
  return useQuery({
    queryKey: ['points', 'summary'],
    queryFn: () => api.points.getSummary(),
    staleTime: 30_000, // 30 seconds
  });
}

// In component
const { data, isLoading, error } = usePointsSummary();
if (isLoading) return <PageLoader />;
if (error) return <ErrorState message="Failed to load points" />;
```

### Pattern 2: Conversational Form Wizard
**What:** Question-by-question form flow with state persistence
**When to use:** Benchmark submission (per CONTEXT.md decision)
**Example:**
```typescript
// components/benchmarks/ConversationalWizard.tsx
'use client';

import { useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface WizardStep {
  field: string;
  question: string;
  type: 'number' | 'text' | 'select';
  options?: { value: string; label: string }[];
}

export function ConversationalWizard({
  steps,
  schema,
  onSubmit,
}: {
  steps: WizardStep[];
  schema: z.ZodType;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const handleNext = async () => {
    const field = steps[currentStep].field;
    const isValid = await form.trigger(field);
    if (isValid) {
      if (currentStep === steps.length - 1) {
        await form.handleSubmit(onSubmit)();
      } else {
        setCurrentStep(s => s + 1);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-lg font-semibold text-foreground">
        {steps[currentStep].question}
      </div>
      {/* Render input based on step.type */}
      <Button onClick={handleNext}>
        {currentStep === steps.length - 1 ? 'Submit' : 'Next'}
      </Button>
    </div>
  );
}
```

### Pattern 3: Server Components + Client Islands
**What:** Keep pages as Server Components where possible, isolate interactivity
**When to use:** Pages with static structure but interactive sections
**Example:**
```typescript
// app/dashboard/resources/page.tsx (Server Component)
import { ResourceFilters } from '@/components/resources/ResourceFilters';
import { ResourceGrid } from '@/components/resources/ResourceGrid';

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Resource Library</h1>
      {/* Client component for interactivity */}
      <ResourceBrowser />
    </div>
  );
}

// components/resources/ResourceBrowser.tsx
'use client';

export function ResourceBrowser() {
  // All client-side state and logic here
}
```

### Anti-Patterns to Avoid
- **Giant page components:** Split into smaller client islands for interactivity
- **Prop drilling for API data:** Use React Query hooks at component level
- **Duplicating API types:** Import from api.ts, keep single source of truth
- **Form state in URL:** Use client state for wizard progress, URL for filters
- **Blocking navigation on data fetch:** Use suspense boundaries with PageLoader

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-step form state | Custom step tracking | react-hook-form + wizard pattern | Field validation, persistence, error handling |
| Data fetching cache | localStorage cache | @tanstack/react-query | Automatic refetch, stale-while-revalidate, devtools |
| Chart components | SVG from scratch | Recharts + custom shapes | Animation, responsiveness, tooltips built-in |
| Form validation | Manual if/else | Zod schemas (mirror backend) | Type-safe, composable, already used in backend |
| Loading skeletons | Custom shimmer CSS | GoldCoinsLoader (exists) | Theme-consistent, already built in Phase 31 |

**Key insight:** The backend already has Zod schemas for all benchmark categories. Import those types or mirror them client-side for validation parity.

## Common Pitfalls

### Pitfall 1: Leaderboard Privacy Toggle Missing from Schema
**What goes wrong:** GAME-11 requires privacy opt-out, but schema lacks `showOnLeaderboard` field
**Why it happens:** Field wasn't added in Phase 26 schema migration
**How to avoid:** Add schema migration as first task, or use Member.metadata JSONB
**Warning signs:** Privacy toggle UI has no backend field to persist to

### Pitfall 2: K-Anonymity Blurred Preview Confusion
**What goes wrong:** User sees blurred chart and thinks data is loading
**Why it happens:** Blurred state looks like loading state
**How to avoid:** Clear messaging: "Need X more submissions to unlock" with explicit lock icon, not just blur
**Warning signs:** Users waiting for "loading" that never completes

### Pitfall 3: Benchmark Form Abandonment
**What goes wrong:** Users start conversational flow and abandon mid-way
**Why it happens:** Too many questions, no progress indicator, no save
**How to avoid:** Show progress (e.g., "Question 3 of 8"), allow skip on optional fields
**Warning signs:** High drop-off in analytics, support tickets about lost progress

### Pitfall 4: Mobile Sidebar Overlap
**What goes wrong:** Mobile menu overlaps page content or doesn't close properly
**Why it happens:** z-index conflicts, click-outside handling
**How to avoid:** Use existing layout.tsx mobile overlay pattern (already implemented)
**Warning signs:** Mobile testing shows menu stuck open

### Pitfall 5: Stale Data After Mutation
**What goes wrong:** User submits benchmark but old data still shows
**Why it happens:** React Query cache not invalidated after mutation
**How to avoid:** Use `queryClient.invalidateQueries(['benchmarks'])` after submission
**Warning signs:** User has to refresh page to see updated data

## Code Examples

Verified patterns from existing codebase and official sources:

### API Client Usage (from api.ts)
```typescript
// lib/api.ts already exports typed API methods
import { api, pointsApi, benchmarksApi, resourcesApi } from '@/lib/api';

// Usage in component
const summary = await api.points.getSummary();
const resources = await api.resources.list({ tags: 'template', limit: 20 });
```

### Chart Components (from Chris's app - needs theming)
```typescript
// Source: Chris's Dashboard/src/components/benchmarks/chart-components.tsx
// Needs adaptation for pixel theme per CONTEXT.md

// ComparisonBar - change colors to theme variables
const data = [
  { name: 'You', value: yourValue, fill: 'var(--gold)' },        // Was #2563eb
  { name: 'Median', value: median, fill: 'var(--success)' },     // Was #10b981
  { name: 'Average', value: average, fill: 'var(--foreground)' }, // Was #64748b
];

// PerformanceRadar - add pixel-style grid
// Custom grid renderer for stepped/blocky lines
```

### Form with React Hook Form + Zod
```typescript
// Mirrors backend schema from src/benchmarks/schemas.ts
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const compensationSchema = z.object({
  gtm_engineer_us: z.number().optional(),
  gtm_engineer_offshore: z.number().optional(),
  sdr_bdr_us_salary: z.number().optional(),
  // ... other fields
});

function CompensationForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(compensationSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('gtm_engineer_us', { valueAsNumber: true })} />
      {errors.gtm_engineer_us && <span>{errors.gtm_engineer_us.message}</span>}
    </form>
  );
}
```

### Resource Library Grid/List Toggle
```typescript
// Per CONTEXT.md: Toggle between card grid and list view
'use client';

import { useState } from 'react';
import { Grid3X3, List } from 'lucide-react';

type ViewMode = 'grid' | 'list';

export function ResourceBrowser() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('grid')}
          className={viewMode === 'grid' ? 'text-gold' : 'text-muted-foreground'}
        >
          <Grid3X3 size={20} />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={viewMode === 'list' ? 'text-gold' : 'text-muted-foreground'}
        >
          <List size={20} />
        </button>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(r => <ResourceCard key={r.id} resource={r} />)}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {resources.map(r => <ResourceListItem key={r.id} resource={r} />)}
        </div>
      )}
    </>
  );
}
```

### Leaderboard with Pinned Member Row
```typescript
// Per CONTEXT.md: Member position pinned at bottom
export function LeaderboardTable({
  rankings,
  currentMemberRank
}: {
  rankings: RankEntry[];
  currentMemberRank: RankEntry | null;
}) {
  const memberInTop25 = rankings.some(r => r.isCurrent);

  return (
    <div className="relative">
      <table className="w-full">
        <thead>...</thead>
        <tbody>
          {rankings.map((r, i) => (
            <LeaderboardRow key={r.memberId} rank={i + 1} entry={r} />
          ))}
        </tbody>
      </table>

      {/* Pinned row for member outside top 25 */}
      {!memberInTop25 && currentMemberRank && (
        <div className="sticky bottom-0 bg-accent border-t-2 border-gold/30 py-3">
          <LeaderboardRow
            rank={currentMemberRank.rank}
            entry={currentMemberRank}
            highlighted
          />
        </div>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| getServerSideProps | Server Components + React Query | Next.js 13+ (2022) | Simpler data fetching |
| useState + useEffect for API | React Query | TanStack Query 5 (2024) | Better caching, less boilerplate |
| Form state in parent | react-hook-form per step | RHF 7 (2021) | Field-level validation |
| CSS-in-JS (styled-components) | Tailwind CSS | Project standard | Already using Tailwind v4 |

**Deprecated/outdated:**
- `getServerSideProps`, `getStaticProps` - use Server Components or client fetch
- `fetch` without cache config - Next.js 15 changed defaults, be explicit
- Class components - functional with hooks only

## Backend API Reference

Existing endpoints ready for consumption:

### Points API (src/routes/points.ts)
- `GET /api/points/summary` - totalPoints, breakdown by action
- `GET /api/points/history?cursor=&limit=50&type=` - paginated transactions
- `GET /api/points/values` - enabled point values for transparency

### Benchmarks API (src/routes/benchmarks.ts)
- `POST /api/benchmarks/submit` - { category, data } returns submission + outlierFields + pointsAwarded
- `GET /api/benchmarks/my-submissions` - member's submissions
- `GET /api/benchmarks/aggregates/:category?companySize=&industry=` - aggregates with k-anonymity

### Resources API (src/routes/resources.ts)
- `GET /api/resources?cursor=&limit=&tags=&type=&search=&featured=` - browse with filters
- `GET /api/resources/:id` - resource details
- `POST /api/resources/:id/download` - returns { downloadUrl, expiresAt, pointsAwarded }
- `GET /api/resources/tags` - all available tags
- `GET /api/resources/recommended?limit=5` - personalized recommendations

### Auth API (src/routes/auth.ts)
- `POST /auth/update-email` - { newEmail, currentPassword }
- `POST /auth/update-password` - { currentPassword, newPassword }

### Billing API (src/routes/billing.ts)
- `GET /billing/details` - subscription, paymentMethod, invoices
- `POST /billing/portal` - returns { portalUrl } for Stripe billing portal

### Dashboard API (src/routes/dashboard.ts)
- `GET /dashboard` - member info, claim status, team, timeline

## Open Questions

Things that couldn't be fully resolved:

1. **Leaderboard Privacy Toggle Field**
   - What we know: GAME-11 requires privacy opt-out
   - What's unclear: No `showOnLeaderboard` field in Member schema
   - Recommendation: Add migration in first plan, or store in Member.metadata

2. **Monthly Leaderboard Reset (GAME-12)**
   - What we know: Requirement mentions monthly reset with all-time hall of fame
   - What's unclear: No backend API for monthly vs all-time rankings
   - Recommendation: May need backend enhancement or compute client-side from point history

3. **Discord Role at 500+ Points (GAME-15)**
   - What we know: Automatic role assignment at point threshold
   - What's unclear: Is this Phase 32 scope or separate backend concern?
   - Recommendation: Backend job responsibility, frontend just shows current role

4. **Leaderboard Caching (JOBS-03)**
   - What we know: Requirement mentions 5-minute refresh
   - What's unclear: Is caching implemented in backend?
   - Recommendation: Use React Query staleTime: 5 minutes client-side

## Sources

### Primary (HIGH confidence)
- Existing codebase: dashboard/src/*, src/routes/*, src/benchmarks/*
- Chris's Dashboard: chart-components.tsx (ComparisonBar, PerformanceRadar patterns)
- Phase 31 CONTEXT.md: Medieval pixel theme decisions
- Phase 32 CONTEXT.md: Page-specific UX decisions

### Secondary (MEDIUM confidence)
- [Recharts Custom Shape Bar Chart](https://recharts.github.io/en-US/examples/CustomShapeBarChart/) - Official example
- [React Hook Form Advanced Usage](https://react-hook-form.com/advanced-usage) - Wizard pattern
- [TanStack Query v5 Docs](https://tanstack.com/query/latest) - Data fetching patterns

### Tertiary (LOW confidence)
- Web search results on conversational form UX patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed or well-documented
- Architecture: HIGH - patterns follow existing codebase conventions
- Backend APIs: HIGH - verified by reading actual route files
- Pitfalls: MEDIUM - some based on common React patterns, not project-specific issues

**Research date:** 2026-01-23
**Valid until:** 30 days (Next.js/React ecosystem relatively stable)
