---
phase: 32-member-dashboard-pages
plan: 03
title: Benchmark Submission Page
subsystem: frontend
tags: [react, benchmarks, forms, conversational-ui]
dependencies:
  requires:
    - 28: Benchmark API endpoints
    - 31: Dashboard shell with sidebar navigation
  provides:
    - Benchmark submission UI with conversational wizard
    - Category selection with submission status
    - Mobile-responsive benchmark forms
  affects:
    - 32-04: Profile page may show benchmark summary
tech-stack:
  added:
    - react-hook-form@7.71.1
    - zod@3.25.76
  patterns:
    - Conversational wizard (one question at a time)
    - React Query for data fetching/mutations
    - Category cards with status indicators
key-files:
  created:
    - dashboard/src/hooks/useBenchmarks.ts
    - dashboard/src/components/benchmarks/CategoryCard.tsx
    - dashboard/src/components/benchmarks/ConversationalWizard.tsx
    - dashboard/src/components/benchmarks/index.ts
    - dashboard/src/app/dashboard/benchmarks/page.tsx
  modified:
    - dashboard/src/lib/api.ts
decisions:
  - key: question-sets-match-backend
    choice: Questions match backend schemas exactly
    rationale: Ensures submitted data validates against Zod schemas
  - key: zod-v3-for-forms
    choice: Use zod@3 instead of zod@4
    rationale: Better compatibility with react-hook-form resolvers
  - key: conversational-flow
    choice: One question per screen with progress bar
    rationale: Per CONTEXT.md - feel like answering questions not filling form
metrics:
  duration: ~7 minutes
  completed: 2026-01-24
---

# Phase 32 Plan 03: Benchmark Submission Page Summary

**One-liner:** Conversational benchmark wizard with 4 categories (31 total questions), real-time progress tracking, and +50 gold points on submission.

## What Was Built

### Benchmark Hooks (useBenchmarks.ts)
- `useMySubmissions()` - Fetch member's submissions for all categories
- `useSubmitBenchmark()` - Submit benchmark data with automatic cache invalidation
- Invalidates both submissions and points queries on successful submission

### UI Components

**CategoryCard**
- Displays category title, description, icon
- Shows "Submitted" badge for completed categories
- Shows "+50 Gold" for incomplete or "Update submission" for completed
- Hover effects with gold accent per design system

**ConversationalWizard**
- Progress bar showing completion percentage
- One question at a time with large readable text
- Support for number, text, and select input types
- Validation with inline error messages
- Back/Next navigation with Enter key support
- Submit button on final question
- Mobile responsive with full-width layouts

### Benchmarks Page (/dashboard/benchmarks)
- 4 category cards in 2-column grid (1 column on mobile)
- Clicking card opens conversational wizard
- Success animation showing points earned
- Privacy notice about K-anonymity threshold

## Question Sets

| Category | Questions | Required Fields |
|----------|-----------|-----------------|
| Compensation | 8 | None |
| Infrastructure | 9 | cost_per_domain |
| Business | 7 | annual_revenue_band |
| Operational | 7 | domains_per_client |

Questions match backend Zod schemas in `src/benchmarks/schemas.ts`.

## Commits

| # | Hash | Description |
|---|------|-------------|
| 1 | 83c299a | Install form libraries and create benchmark hooks |
| 2 | fce5f36 | Create benchmark UI components |
| 3 | 0e4c29e | Create benchmarks page with category selection |

## Success Criteria Met

- [x] UI-02: Benchmark submission page with forms for all 4 categories
- [x] UI-11: Mobile responsive - verified at 375px breakpoint
- [x] UI-12: Loading states during submission (button loading state)
- [x] UI-13: Form validation shows helpful error messages
- [x] GAME-01: +50 points shown on submission (uses backend pointsAwarded)

## Deviations from Plan

None - plan executed as written.

## Technical Notes

### API Integration
- Uses `benchmarksApi.getMySubmissions()` to check submission status
- Uses `benchmarksApi.submit()` with category and data payload
- Returns `pointsAwarded` from backend to show in success animation

### Mobile Responsiveness
- Category cards: `grid-cols-1 md:grid-cols-2`
- Wizard: `max-w-2xl mx-auto px-4 sm:px-0`
- Inputs: `min-h-[48px]` for touch targets
- Buttons: Full-width on mobile, auto on desktop

### Form State
- formData stored as `Record<string, unknown>`
- Empty values filtered before submission
- Number inputs converted to numbers (not strings)
- Required field validation before next step

## Next Steps

- Plan 32-04: Profile and settings page
- Future: Benchmark results visualization (viewing peer comparisons)
