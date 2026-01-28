# End-to-End Testing Configuration

## Quick Start Commands

```bash
# Verify all integrations are configured
npm run verify

# Seed all test data (admins, members, team, configs)
npm run seed

# Seed test resources for resource library
npm run seed:resources

# Seed everything at once
npm run seed:all

# Start Stripe webhook listener (in separate terminal)
npm run stripe:listen
```

## Overview

This document provides comprehensive testing configuration including seed data documentation, expected behaviors, and end-to-end verification procedures for all external integrations.

---

## 1. Seed Data Configuration

### 1.1 Admin Account (Super Admin)

**Script:** `scripts/reset-admin.ts`
**Run:** `npx tsx scripts/reset-admin.ts`

| Field | Value |
|-------|-------|
| Email | `admin@admin.com` |
| Password | `admin123` |
| Role | `SUPER_ADMIN` |

**Expected Behavior Throughout App:**

| Location | Expected Behavior |
|----------|-------------------|
| `/admin/login` | Can login with credentials |
| Admin Dashboard | Full access to all features |
| Member Management | Can view, edit, adjust points for any member |
| Admin Management | Can create/delete other admins |
| Feature Flags | Can toggle all flags |
| Point Config | Can modify point values |
| Email Templates | Can edit all templates |
| Analytics | Full access to all metrics |
| Audit Log | Can view all system activity |

---

### 1.2 Lord Test Member (Active Subscriber)

**Script:** `scripts/seed-test-member.ts`
**Run:** `npx tsx scripts/seed-test-member.ts`

| Field | Value |
|-------|-------|
| Email | `lord@revenuecouncil.test` |
| Password | `LordTest2026!` |
| Subscription Status | `ACTIVE` |
| Seat Tier | `OWNER` |
| Total Points | `500` |
| Current Streak | `7 days` |
| Intro Completed | `true` |
| Leaderboard Visible | `true` |
| Subscription Valid Until | 30 days from seed run |

**Profile Data:**
- First Name: `Test`
- Last Name: `Lord`
- Company: `Revenue Council Testing`
- Job Title: `Chief Revenue Officer`

**Expected Behavior Throughout App:**

| Location | Expected Behavior |
|----------|-------------------|
| `/login` | Can login with credentials |
| `/dashboard` | Shows full member dashboard with stats |
| Points Display | Shows 500 points, 7-day streak |
| Leaderboard | Appears in rankings (visible=true) |
| Resources | Can browse and download (earns +5 pts each) |
| Benchmarks | Can submit to all 4 categories (+50 pts each) |
| Billing | Shows ACTIVE status, can access portal |
| Profile Settings | Can edit name, company, privacy |

---

### 1.3 Additional Test Accounts to Create

For comprehensive testing, create these additional seed members:

#### Inactive Member (No Subscription)
```typescript
{
  email: 'inactive@revenuecouncil.test',
  password: 'InactiveTest2026!',
  subscriptionStatus: 'NONE',
  seatTier: null,
  totalPoints: 0,
  introCompleted: false
}
```

**Expected Behavior:**
- Can login but sees limited dashboard
- Cannot access member-only resources
- Billing shows "No active subscription"
- Prompted to upgrade/subscribe

#### Past Due Member (Payment Failed)
```typescript
{
  email: 'pastdue@revenuecouncil.test',
  password: 'PastDueTest2026!',
  subscriptionStatus: 'PAST_DUE',
  seatTier: 'INDIVIDUAL',
  paymentFailedAt: new Date(),
  gracePeriodEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
}
```

**Expected Behavior:**
- Can login with payment warning banner
- Limited functionality during grace period
- Billing shows past due status with update payment CTA
- Email reminders sent

#### Team Owner with Members
```typescript
// Owner
{
  email: 'teamowner@revenuecouncil.test',
  password: 'TeamOwner2026!',
  subscriptionStatus: 'ACTIVE',
  seatTier: 'OWNER',
  isPrimaryOwner: true,
  teamId: '[created team id]'
}

// Team Member
{
  email: 'teammember@revenuecouncil.test',
  password: 'TeamMember2026!',
  subscriptionStatus: 'ACTIVE',
  seatTier: 'TEAM_MEMBER',
  teamId: '[same team id]'
}
```

**Expected Behavior:**
- Owner can invite new team members
- Owner can manage team seats
- Team member sees team affiliation
- Both share team billing

---

## 2. Integration Verification Checklist

### 2.1 Supabase Database Connectivity

**Environment Variables Required:**
```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

**Verification Tests:**

| Test | Command/Action | Expected Result |
|------|----------------|-----------------|
| Connection Test | `npx prisma db pull` | Schema pulls without error |
| Migration Test | `npx prisma migrate deploy` | Migrations apply successfully |
| Read Test | Run seed script | Reads/writes member data |
| Pool Test | Multiple concurrent requests | No connection pool exhaustion |

**Manual Verification:**
1. Start server: `npm run dev`
2. Check logs for: `Prisma Client connected`
3. Hit `/api/dashboard` (authenticated) - should return member data

**Common Issues:**
- Port 6543 (pooler) vs 5432 (direct) - use pooler for app, direct for migrations
- SSL mode - Supabase requires SSL
- Connection limit - free tier has 25 connections max

---

### 2.2 Stripe Integration

**Environment Variables Required:**
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_INDIVIDUAL_PRICE_ID=price_...
STRIPE_OWNER_SEAT_PRICE_ID=price_...
STRIPE_TEAM_SEAT_PRICE_ID=price_...
```

**Test Mode Setup:**
1. Use `sk_test_` keys (NOT `sk_live_`)
2. Create test products in Stripe Dashboard
3. Configure webhook endpoint: `https://your-domain.com/webhooks/stripe`
4. Select events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.*`

**Verification Tests:**

| Test | Action | Expected Result |
|------|--------|-----------------|
| Checkout Session | Create via API | Returns checkout URL |
| Webhook Receipt | Stripe CLI forward | Server logs "Processing stripe event" |
| Idempotency | Send same webhook twice | Second one skipped (StripeEvent check) |
| Payment Success | Complete test checkout | Member status -> ACTIVE |
| Payment Failure | Use `4000000000000341` card | Member status -> PAST_DUE |
| Billing Portal | Hit `/billing/portal` | Returns portal URL |

**Stripe CLI Testing:**
```bash
# Install Stripe CLI
# Forward webhooks to local server
stripe listen --forward-to localhost:3000/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

**Test Card Numbers:**
| Card | Result |
|------|--------|
| `4242424242424242` | Success |
| `4000000000000002` | Declined |
| `4000000000000341` | Attaches but fails on charge |
| `4000002500003155` | Requires 3D Secure |

---

### 2.3 Discord Integration

**Environment Variables Required:**
```env
# OAuth (for member account linking)
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# Bot (for automated actions)
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_INVITE_URL=https://discord.gg/...

# Channels
DISCORD_INTRODUCTIONS_CHANNEL_ID=...
DISCORD_ADMIN_CHANNEL_ID=... (optional)
```

**Bot Setup Requirements:**
1. Bot must be in the guild (server)
2. Required intents: Server Members, Message Content
3. Bot role must be above member roles for role assignment
4. Bot needs "Manage Roles" permission

**Verification Tests:**

| Test | Action | Expected Result |
|------|--------|-----------------|
| OAuth URL | Visit `/claim/start` | Redirects to Discord auth |
| OAuth Callback | Complete Discord auth | Returns to `/claim/callback` with code |
| User Info Fetch | After callback | Saves discordId, discordUsername, discordAvatar |
| Bot Online | Check Discord | Bot shows as online |
| Role Assignment | Member becomes ACTIVE | Bot assigns appropriate role |
| Intro Detection | Post in intros channel | introCompleted=true, +25 points |

**Manual OAuth Test:**
1. Login as test member
2. Go to Account Settings > Link Discord
3. Complete Discord OAuth flow
4. Verify member record has discordId populated

**Bot Role Hierarchy Check:**
```
Server Settings > Roles
- Bot role must be ABOVE these roles:
  - Knight (Individual member)
  - Lord (Owner)
  - Squire (Team member)
  - etc.
```

---

### 2.4 Supabase Storage (Resource Library)

**Environment Variables Required:**
```env
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Storage Setup:**
1. Create bucket named `resources` in Supabase Storage
2. Set bucket to PRIVATE (not public)
3. Service role key needed for signed URLs

**Verification Tests:**

| Test | Action | Expected Result |
|------|--------|-----------------|
| Upload | Admin uploads file | File saved to `resources/` bucket |
| Signed URL | Member clicks download | 15-min signed URL generated |
| Download Tracking | After download | ResourceDownload record created |
| Points Award | After download | +5 points to member |
| Version Upload | Admin uploads new version | ResourceVersion created |

---

### 2.5 Email Integration

**Environment Variables:**
```env
# Development
EMAIL_PROVIDER=console

# Production
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=The Revenue Council <noreply@revenuecouncil.com>
EMAIL_REPLY_TO=support@revenuecouncil.com
```

**Verification Tests:**

| Test | Action | Expected Result |
|------|--------|-----------------|
| Console Mode | Trigger password reset | Email logged to terminal |
| Template Loading | Check EmailTemplate table | Templates exist |
| Variable Substitution | Send welcome email | {{firstName}} replaced |

**Email Templates to Verify:**
- `welcome` - New member welcome
- `password_reset` - Password reset link
- `password_reset_confirmation` - After password changed
- `payment_failure` - Payment declined notice
- `claim_reminder` - Reminder to link Discord

---

## 3. End-to-End Test Flows

### 3.1 New Member Signup Flow

**Preconditions:** No existing member with test email

**Steps:**
1. Visit `/signup`
2. Enter email: `newmember@test.com`, password: `TestPass123!`
3. Submit form
4. Check database: Member created with status=NONE
5. Check email (console): Welcome email sent
6. Login with credentials
7. View dashboard - shows "No subscription" state

**Expected Database State:**
```sql
SELECT email, subscriptionStatus, seatTier, introCompleted
FROM "Member" WHERE email = 'newmember@test.com';

-- Result: 'newmember@test.com', 'NONE', NULL, false
```

---

### 3.2 Stripe Checkout to Active Member

**Preconditions:** Member exists with status=NONE

**Steps:**
1. Login as inactive member
2. Click "Subscribe" button
3. Redirect to Stripe Checkout
4. Use test card: `4242424242424242`
5. Complete checkout
6. Webhook fires: `checkout.session.completed`
7. Check member: status=ACTIVE, seatTier set
8. Redirect to success page

**Webhook Verification:**
```bash
# In server logs, look for:
Processing stripe event: checkout.session.completed
Member [id] subscription activated
```

---

### 3.3 Discord Account Linking

**Preconditions:** Member logged in, no Discord linked

**Steps:**
1. Go to Account Settings
2. Click "Link Discord Account"
3. Redirected to Discord OAuth
4. Authorize application
5. Callback processes code
6. Member record updated with Discord info
7. Bot adds member to guild (if ACTIVE)
8. Appropriate role assigned

**Database Verification:**
```sql
SELECT discordId, discordUsername, discordAvatar
FROM "Member" WHERE email = 'lord@revenuecouncil.test';

-- Result: Should show Discord ID, username, avatar URL
```

---

### 3.4 Resource Download with Points

**Preconditions:** Active member, published resource exists

**Steps:**
1. Login as Lord test member (500 points)
2. Go to Resources page
3. Click on a resource
4. Click "Download"
5. Signed URL generated
6. File downloads
7. Check points: Now 505 (+5)
8. Check ResourceDownload record created
9. Check PointTransaction record created

**Points Verification:**
```sql
SELECT totalPoints FROM "Member" WHERE email = 'lord@revenuecouncil.test';
-- Before: 500
-- After: 505

SELECT * FROM "PointTransaction"
WHERE memberId = '[lord-id]'
ORDER BY createdAt DESC LIMIT 1;
-- action: 'resource_download', points: 5
```

---

### 3.5 Benchmark Submission with Points

**Preconditions:** Active member, no existing submission for category

**Steps:**
1. Login as test member
2. Go to Benchmarks page
3. Select category (e.g., COMPENSATION)
4. Fill out benchmark form
5. Submit
6. Check: BenchmarkSubmission created
7. Check points: +50 points
8. View aggregates page
9. See anonymous comparison data

**Submission Verification:**
```sql
SELECT category, isValid, submittedAt
FROM "BenchmarkSubmission"
WHERE memberId = '[member-id]';

-- Result: 'COMPENSATION', true, [timestamp]
```

---

### 3.6 Admin Point Adjustment

**Preconditions:** Admin logged in, member exists

**Steps:**
1. Login to admin dashboard
2. Go to Members page
3. Find test member
4. Click "Adjust Points"
5. Enter: +100 points, reason: "Testing adjustment"
6. Submit
7. Check member points updated
8. Check PointTransaction with action='admin_adjustment'
9. Check AuditLog entry created

**Audit Verification:**
```sql
SELECT * FROM "AuditLog"
WHERE entityType = 'Member'
AND action = 'POINTS_ADJUSTED'
ORDER BY createdAt DESC LIMIT 1;

-- Result: Shows admin who made change, amount, reason
```

---

### 3.7 Payment Failure Handling

**Preconditions:** Active member with linked Stripe customer

**Steps:**
1. Trigger invoice.payment_failed webhook (via Stripe CLI)
2. Check member: status changed to PAST_DUE
3. Check paymentFailedAt timestamp set
4. Check gracePeriodEndsAt set (3 days from failure)
5. Login as member
6. See payment failure banner
7. Click "Update Payment Method"
8. Redirected to Stripe billing portal

**State Verification:**
```sql
SELECT subscriptionStatus, paymentFailedAt, gracePeriodEndsAt
FROM "Member" WHERE email = '[test-email]';

-- Result: 'PAST_DUE', [failure time], [grace end time]
```

---

## 4. Test Data Reset Procedures

### Reset All Test Data

```bash
# Reset admin
npx tsx scripts/reset-admin.ts

# Reset/create Lord member
npx tsx scripts/seed-test-member.ts

# Optional: Clear all members (DANGEROUS - dev only)
npx prisma db execute --stdin <<< "DELETE FROM \"Member\";"
```

### Reset Specific Tables

```bash
# Clear point transactions
npx prisma db execute --stdin <<< "DELETE FROM \"PointTransaction\";"

# Clear benchmark submissions
npx prisma db execute --stdin <<< "DELETE FROM \"BenchmarkSubmission\";"

# Clear resource downloads
npx prisma db execute --stdin <<< "DELETE FROM \"ResourceDownload\";"

# Reset member points
npx prisma db execute --stdin <<< "UPDATE \"Member\" SET \"totalPoints\" = 0, \"currentStreak\" = 0;"
```

---

## 5. Environment Verification Script

Create this script to verify all integrations:

**File:** `scripts/verify-integrations.ts`

```typescript
import 'dotenv/config';

async function verify() {
  console.log('\n=== INTEGRATION VERIFICATION ===\n');

  // 1. Database
  console.log('1. DATABASE');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing');

  // 2. Stripe
  console.log('\n2. STRIPE');
  console.log('   STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY?.startsWith('sk_') ? '✓ Set' : '✗ Missing');
  console.log('   STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') ? '✓ Set' : '✗ Missing');
  console.log('   Price IDs:',
    process.env.STRIPE_INDIVIDUAL_PRICE_ID &&
    process.env.STRIPE_OWNER_SEAT_PRICE_ID &&
    process.env.STRIPE_TEAM_SEAT_PRICE_ID ? '✓ All set' : '✗ Missing some');

  // 3. Discord
  console.log('\n3. DISCORD');
  console.log('   CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✓ Set' : '✗ Missing');
  console.log('   CLIENT_SECRET:', process.env.DISCORD_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
  console.log('   BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✓ Set' : '✗ Missing');
  console.log('   GUILD_ID:', process.env.DISCORD_GUILD_ID ? '✓ Set' : '✗ Missing');

  // 4. Supabase Storage
  console.log('\n4. SUPABASE STORAGE');
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing');
  console.log('   SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');

  // 5. Email
  console.log('\n5. EMAIL');
  console.log('   EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'console (default)');
  if (process.env.EMAIL_PROVIDER === 'resend') {
    console.log('   RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing');
  }

  console.log('\n================================\n');
}

verify();
```

Run with: `npx tsx scripts/verify-integrations.ts`

---

## 6. Quick Start Testing Checklist

### Before Testing Session

- [ ] Environment variables configured (copy `.env.example` to `.env`)
- [ ] Database migrations applied: `npx prisma migrate deploy`
- [ ] Admin seeded: `npx tsx scripts/reset-admin.ts`
- [ ] Test member seeded: `npx tsx scripts/seed-test-member.ts`
- [ ] Server running: `npm run dev`
- [ ] Dashboard running: `cd dashboard && npm run dev`

### Integration Smoke Tests

- [ ] **Database:** Can login as admin/member
- [ ] **Stripe:** Webhook endpoint responds (check Stripe Dashboard)
- [ ] **Discord:** Bot shows online in server
- [ ] **Storage:** Can view resource list (if resources exist)
- [ ] **Email:** Password reset sends (check console logs)

### Full Flow Tests

- [ ] Member signup → login → dashboard visible
- [ ] Admin login → can see member list
- [ ] Resource download → points awarded
- [ ] Benchmark submit → points awarded
- [ ] Discord OAuth → account linked
- [ ] Stripe checkout → member activated (use test mode)

---

## 7. Test Credentials Summary

### Admin Account

| Email | Password | Role |
|-------|----------|------|
| `admin@admin.com` | `admin123` | SUPER_ADMIN |

### Member Accounts

| Email | Password | Status | Tier | Use Case |
|-------|----------|--------|------|----------|
| `lord@revenuecouncil.test` | `LordTest2026!` | ACTIVE | OWNER | Full access Lord member |
| `knight@revenuecouncil.test` | `KnightTest2026!` | ACTIVE | INDIVIDUAL | Standard member |
| `inactive@revenuecouncil.test` | `InactiveTest2026!` | NONE | - | Non-subscriber |
| `pastdue@revenuecouncil.test` | `PastDueTest2026!` | PAST_DUE | INDIVIDUAL | Payment failed |
| `cancelled@revenuecouncil.test` | `CancelledTest2026!` | CANCELLED | INDIVIDUAL | Former member |

### Team Accounts

| Email | Password | Role | Team |
|-------|----------|------|------|
| `teamowner@revenuecouncil.test` | `TeamOwner2026!` | Primary Owner | Test Team Corp |
| `teammember@revenuecouncil.test` | `TeamMember2026!` | Team Member | Test Team Corp |

### Stripe Test Cards

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 0341` | Attaches but fails on charge |
| `4000 0025 0000 3155` | Requires 3D Secure |

### Test Expiry & CVC

- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)
