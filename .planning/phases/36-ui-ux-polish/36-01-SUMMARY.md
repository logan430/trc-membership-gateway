# Phase 36 Plan 01: Legal Pages Summary

---
phase: 36
plan: 01
subsystem: legal-compliance
tags: [legal, terms-of-service, privacy-policy, signup, compliance]

dependency-graph:
  requires: [36-05]
  provides: [legal-pages, terms-route, privacy-route, signup-terms-checkbox]
  affects: [stripe-compliance, discord-oauth, gdpr]

tech-stack:
  added: []
  patterns: [static-html-pages, express-static-routes, medieval-theme-voice]

key-files:
  created:
    - public/terms.html
    - public/privacy.html
  modified:
    - src/routes/public.ts
    - dashboard/src/app/(auth)/signup/page.tsx

decisions:
  - decision: Medieval theme voice in legal content
    rationale: Consistency with site branding while maintaining legal clarity
  - decision: Static HTML for legal pages
    rationale: SEO friendly, fast loading, simple maintenance
  - decision: Links open in new tab from signup
    rationale: Users can review terms without losing form state

metrics:
  duration: ~8 minutes
  completed: 2026-01-27
---

## One-liner

Terms of Service and Privacy Policy pages with medieval styling, Express routes, and signup Terms checkbox.

## What Was Built

### Task 1: Terms of Service Page
Created comprehensive Terms of Service page (`public/terms.html`) with:
- Full legal content covering 13 sections
- Subscription terms, billing, cancellation policy
- User responsibilities and prohibited conduct
- Intellectual property and liability limitations
- Dispute resolution and governing law
- Medieval theme voice ("thee," "thou," "thy")
- Mobile responsive design
- Consistent header with shield icon linking to home

### Task 2: Privacy Policy Page
Created comprehensive Privacy Policy page (`public/privacy.html`) with:
- Information collection disclosure (account, payment, Discord)
- Data usage explanations
- Third-party services table (Stripe, Discord, Supabase, Resend)
- Data retention policy (account, payment records, benchmark data)
- User rights (access, correction, deletion, portability)
- Cookie policy (essential cookies only, no third-party tracking)
- Security measures documentation
- GDPR-compliant language

### Task 3: Express Routes
Added routes in `src/routes/public.ts`:
- `/terms` -> serves `public/terms.html`
- `/privacy` -> serves `public/privacy.html`
- Footer links now return 200 instead of 404

### Task 4: Signup Terms Checkbox
Updated `dashboard/src/app/(auth)/signup/page.tsx`:
- Added `termsAccepted` state variable
- Added validation preventing form submit without checkbox
- Added styled checkbox with clickable label
- Terms and Privacy links open in new tabs
- Error message displayed when attempting submit without acceptance

## Commits

| Commit | Description |
|--------|-------------|
| d7d4ec3 | Terms of Service page with medieval styling |
| 5b6a321 | Privacy Policy page with medieval styling |
| 95e2817 | Express routes for /terms and /privacy |
| 9a38efb | Terms checkbox on signup form |

## Verification Results

1. `/terms` route returns 200 with styled page
2. `/privacy` route returns 200 with styled page
3. Footer links work from landing page
4. Signup form requires checkbox to submit
5. Error message shows when checkbox not checked
6. TypeScript compilation passes
7. Pages are mobile responsive

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

| File | Change |
|------|--------|
| public/terms.html | Created (328 lines) |
| public/privacy.html | Created (393 lines) |
| src/routes/public.ts | Added 16 lines (2 routes) |
| dashboard/src/app/(auth)/signup/page.tsx | Modified (added checkbox + validation) |

## Next Steps

- Plan 36-02: Forgot Password Flow (ready to execute)
- Plan 36-03: Password UX Improvements
- Plan 36-04: Visual Polish (favicon, branding)
