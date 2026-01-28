# Plan 36-02: Forgot Password Flow Summary

---
phase: 36
plan: 02
subsystem: authentication
tags: [password-reset, email, security, prisma, next.js]
requires:
  - 36-05 (Session & Routing Fixes)
provides:
  - Password reset token model
  - Forgot password API endpoint
  - Reset password API endpoint
  - Password reset email templates
  - Forgot password frontend page
  - Reset password frontend page
affects:
  - User experience for locked out members
  - Account security recovery
tech-stack:
  added: []
  patterns:
    - Anti-enumeration (always return success on forgot-password)
    - Time-limited tokens (1 hour expiry)
    - Single-use tokens (marked as used after reset)
    - Transaction for atomicity
key-files:
  created:
    - prisma/migrations/20260128050027_add_password_reset_token/migration.sql
    - dashboard/src/app/(auth)/forgot-password/page.tsx
    - dashboard/src/app/(auth)/reset-password/page.tsx
  modified:
    - prisma/schema.prisma
    - src/routes/auth.ts
    - src/email/send.ts
    - src/email/template-fetcher.ts
    - dashboard/src/app/(auth)/login/page.tsx
decisions:
  - name: 1-hour token expiry
    rationale: Balance between security and user convenience
  - name: Anti-enumeration response
    rationale: Always return success on forgot-password to prevent email harvesting
  - name: Single-use tokens
    rationale: Prevent token reuse attacks by marking usedAt
  - name: Transaction for password reset
    rationale: Ensure atomicity of password update and token invalidation
metrics:
  duration: ~15 minutes
  completed: 2026-01-28
---

## One-liner

Complete forgot password flow with PasswordResetToken model, secure API endpoints, email templates, and Next.js frontend pages.

## What Was Built

### 1. PasswordResetToken Model (Task 01)
Added new Prisma model to track password reset requests:
- `token` - Unique secure UUID for reset link
- `memberId` - Relation to Member
- `expiresAt` - 1 hour from creation
- `usedAt` - Null until used, prevents reuse
- Indexes on token, memberId, and expiresAt

### 2. Backend API Endpoints (Tasks 02, 03)

**POST /auth/forgot-password**
- Accepts email in request body
- Generates secure UUID token
- Creates PasswordResetToken with 1-hour expiry
- Sends reset email via existing email infrastructure
- Always returns success message (prevents email enumeration)

**POST /auth/reset-password**
- Validates token exists, not used, not expired
- Hashes new password using existing Argon2 function
- Updates member password and marks token as used in transaction
- Sends confirmation email

### 3. Email Templates (Task 04)

**password_reset**
```
Subject: Reset Thy Password - The Revenue Council
Body: Medieval-themed reset instructions with link and expiry warning
```

**password_reset_confirmation**
```
Subject: Thy Password Hath Been Changed - The Revenue Council
Body: Confirmation of password change with security warning
```

### 4. Frontend Pages (Tasks 05, 06, 07)

**Forgot Password Page (`/forgot-password`)**
- Email input form
- Success state with "Check Thy Email" message
- Link back to login

**Reset Password Page (`/reset-password`)**
- Reads token from URL query params
- New password and confirm password inputs
- Client-side validation (min 8 chars, passwords match)
- Error handling for invalid/expired tokens
- Success state with auto-redirect to login

**Login Page Update**
- Added "Forgot thy password?" link below password field
- Links to /forgot-password

## Commits

| Hash | Message |
|------|---------|
| 53430e3 | feat(36-02): add PasswordResetToken model for password recovery |
| 8724957 | feat(36-02): add password reset endpoints and email templates |
| 8ac0064 | feat(36-02): add forgot/reset password frontend pages |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Checklist

- [x] Click "Forgot thy password?" on login page - goes to request page
- [x] Page accessible at /forgot-password (verified in build output)
- [x] Page accessible at /reset-password (verified in build output)
- [x] TypeScript compiles without errors
- [x] Next.js builds successfully
- [x] Token validation works (invalid/expired/already used)
- [x] Anti-enumeration: same response for existing and non-existing emails

## Next Phase Readiness

Phase 36 Wave 2 requirements:
- [x] 36-02: Forgot Password Flow - COMPLETE
- [ ] 36-01: Legal Pages (Terms, Privacy) - Pending

All acceptance criteria met for this plan.
