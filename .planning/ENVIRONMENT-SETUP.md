# Environment Setup Checklist

Complete this checklist to get The Revenue Council membership app running end-to-end.

**Status Legend:**
- [ ] Not started
- [~] In progress
- [x] Complete

---

## 1. Prerequisites

### Local Tools
- [ ] Node.js 20+ installed
- [ ] npm or pnpm installed
- [ ] Git configured
- [ ] Stripe CLI installed (for local webhook testing)
  ```bash
  # Windows (winget)
  winget install Stripe.StripeCLI

  # Or download from https://stripe.com/docs/stripe-cli
  ```

### Accounts Required
- [ ] Discord Developer account
- [ ] Stripe account (test mode is fine)
- [ ] Supabase account (for PostgreSQL database)
- [ ] Resend account (for production emails - optional for dev)

---

## 2. Database Setup (Supabase)

### Create Project
- [ ] Create new Supabase project at https://supabase.com/dashboard
- [ ] Note the project URL and anon key
- [ ] Go to **Settings > Database > Connection String**
- [ ] Copy the **Pooler** connection string (important: NOT the direct connection)

### Configure Environment
```env
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
```

### Initialize Database
```bash
npx prisma db push
npx prisma db seed  # Creates admin user
```

**Note:** You must set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` before seeding.

---

## 3. Discord Setup

### Create Discord Application
- [ ] Go to https://discord.com/developers/applications
- [ ] Click "New Application" → Name it "Revenue Council Bot" (or similar)
- [ ] Note the **Application ID** (this is your `DISCORD_CLIENT_ID`)

### Configure OAuth2
- [ ] Go to **OAuth2 > General**
- [ ] Copy **Client Secret** → `DISCORD_CLIENT_SECRET`
- [ ] Add Redirect URL: `http://localhost:3000/auth/callback`
  - For production, add your domain: `https://yourdomain.com/auth/callback`

### Create Bot
- [ ] Go to **Bot** tab
- [ ] Click "Reset Token" and copy it → `DISCORD_BOT_TOKEN`
- [ ] **CRITICAL: Enable Privileged Intents:**
  - [x] SERVER MEMBERS INTENT (required for role management)
  - [x] MESSAGE CONTENT INTENT (required for introduction detection)

### Invite Bot to Server
- [ ] Go to **OAuth2 > URL Generator**
- [ ] Select scopes: `bot`, `applications.commands`
- [ ] Select bot permissions:
  - Manage Roles
  - Send Messages
  - Add Reactions
  - Kick Members
  - Read Message History
- [ ] Copy generated URL and open in browser
- [ ] Select your test Discord server and authorize

### Get Server/Channel IDs
Enable Developer Mode in Discord: User Settings > App Settings > Advanced > Developer Mode

- [ ] Right-click your server → Copy ID → `DISCORD_GUILD_ID`
- [ ] Right-click #introductions channel → Copy ID → `DISCORD_INTRODUCTIONS_CHANNEL_ID`
- [ ] Right-click #admin-alerts channel → Copy ID → `DISCORD_ADMIN_CHANNEL_ID` (optional)
- [ ] Right-click #billing-support channel → Copy ID → `DISCORD_BILLING_SUPPORT_CHANNEL_ID` (optional)

### Environment Variables
```env
DISCORD_CLIENT_ID=your_application_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
DISCORD_INTRODUCTIONS_CHANNEL_ID=your_channel_id
DISCORD_ADMIN_CHANNEL_ID=your_channel_id
DISCORD_BILLING_SUPPORT_CHANNEL_ID=your_channel_id
```

---

## 4. Stripe Setup

### Create Products and Prices
- [ ] Go to https://dashboard.stripe.com/test/products
- [ ] Create **Individual Membership** product:
  - Name: "Individual Membership"
  - Price: Your monthly rate (e.g., $49/month)
  - Billing: Recurring, Monthly
  - Copy Price ID → `STRIPE_INDIVIDUAL_PRICE_ID`

- [ ] Create **Company Team Subscription** product:
  - Name: "Company Team Subscription"
  - Create two prices:
    1. **Owner Seat**: Your owner rate (e.g., $99/month)
       - Copy Price ID → `STRIPE_OWNER_SEAT_PRICE_ID`
    2. **Team Seat**: Your team member rate (e.g., $29/month)
       - Copy Price ID → `STRIPE_TEAM_SEAT_PRICE_ID`

### Get API Keys
- [ ] Go to **Developers > API Keys**
- [ ] Copy Secret Key → `STRIPE_SECRET_KEY` (starts with `sk_test_`)

### Create Webhook Endpoint
For **local development**:
```bash
# Run this in a separate terminal
stripe listen --forward-to localhost:3000/webhooks/stripe
```
- [ ] Copy the webhook signing secret shown → `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)

For **production**:
- [ ] Go to **Developers > Webhooks**
- [ ] Add endpoint: `https://yourdomain.com/webhooks/stripe`
- [ ] Select events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- [ ] Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### Environment Variables
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_INDIVIDUAL_PRICE_ID=price_...
STRIPE_OWNER_SEAT_PRICE_ID=price_...
STRIPE_TEAM_SEAT_PRICE_ID=price_...
```

---

## 5. Email Setup

### For Development (Console Logging)
```env
EMAIL_PROVIDER=console
```
Emails will be logged to console instead of sent.

### For Production (Resend)
- [ ] Create account at https://resend.com
- [ ] Get API key from dashboard
- [ ] Verify your sending domain

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
```

---

## 6. Admin Setup

### Environment Variables
```env
ADMIN_SEED_EMAIL=admin@yourdomain.com
ADMIN_SEED_PASSWORD=your-secure-password-here
```

### Create Admin User
```bash
npx prisma db seed
```

This creates an admin user with the email and password specified above.

---

## 7. JWT Configuration

```env
JWT_SECRET=generate-a-long-random-string-here
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 8. Complete .env File Template

```env
# ===================
# DATABASE
# ===================
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# ===================
# DISCORD
# ===================
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
DISCORD_INTRODUCTIONS_CHANNEL_ID=
DISCORD_ADMIN_CHANNEL_ID=
DISCORD_BILLING_SUPPORT_CHANNEL_ID=

# ===================
# STRIPE
# ===================
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_INDIVIDUAL_PRICE_ID=price_...
STRIPE_OWNER_SEAT_PRICE_ID=price_...
STRIPE_TEAM_SEAT_PRICE_ID=price_...

# ===================
# EMAIL
# ===================
EMAIL_PROVIDER=console
# EMAIL_PROVIDER=resend
# RESEND_API_KEY=re_...
# EMAIL_FROM=noreply@yourdomain.com

# ===================
# AUTH
# ===================
JWT_SECRET=your-64-byte-hex-secret

# ===================
# ADMIN
# ===================
ADMIN_SEED_EMAIL=admin@yourdomain.com
ADMIN_SEED_PASSWORD=secure-password-here

# ===================
# APP
# ===================
NODE_ENV=development
PORT=3000
```

---

## 9. Verification Checklist

After completing setup, verify each integration:

### Database
```bash
npx prisma db push
npx prisma studio  # Opens database viewer
```
- [ ] Tables created successfully
- [ ] Admin user exists in AdminUser table

### Discord Bot
```bash
npm run dev
```
- [ ] Console shows: "Discord bot logged in as [BotName]"
- [ ] Console shows: "Synced managed roles"
- [ ] Bot appears online in Discord server
- [ ] Managed roles (Squire, Knight, Lord, Debtor) created in server

### Stripe
```bash
# Terminal 1
npm run dev

# Terminal 2
stripe listen --forward-to localhost:3000/webhooks/stripe
```
- [ ] Stripe CLI shows: "Ready! Your webhook signing secret is..."
- [ ] Test with: `stripe trigger checkout.session.completed`
- [ ] Server logs show webhook received

### OAuth Flow
- [ ] Visit `http://localhost:3000`
- [ ] Click signup → redirects to Discord OAuth
- [ ] Complete OAuth → returns to app
- [ ] Check database for new member record

---

## 10. Troubleshooting

### Discord Bot Won't Connect
1. Check `DISCORD_BOT_TOKEN` is correct and not expired
2. Verify privileged intents are enabled in Developer Portal
3. Ensure bot has been invited to the server
4. Check server logs for specific error message

### Stripe Webhooks Failing
1. Verify `STRIPE_WEBHOOK_SECRET` matches your endpoint
2. For local dev, ensure `stripe listen` is running
3. Check webhook signature validation in logs
4. Ensure endpoint URL is correct in Stripe Dashboard

### Database Connection Issues
1. Use Pooler connection string, not direct
2. Check password is URL-encoded if it contains special characters
3. Verify Supabase project is not paused

### OAuth Redirect Errors
1. Verify `DISCORD_REDIRECT_URI` exactly matches Developer Portal setting
2. Check for trailing slashes (should NOT have one)
3. Ensure protocol matches (http vs https)

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Push database schema
npx prisma db push

# 3. Seed admin user
npx prisma db seed

# 4. Start Stripe CLI (Terminal 1)
stripe listen --forward-to localhost:3000/webhooks/stripe

# 5. Start app (Terminal 2)
npm run dev

# 6. Open app
# http://localhost:3000
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| dev | `npm run dev` | Start development server with watch mode |
| build | `npm run build` | Compile TypeScript to dist/ |
| start | `npm start` | Start production server |
| test | `npm test` | Run tests with Vitest |
| stripe:listen | `npm run stripe:listen` | Start Stripe webhook forwarding |
| db:generate | `npm run db:generate` | Generate Prisma client |
| db:push | `npm run db:push` | Push schema to database |
| db:migrate | `npm run db:migrate` | Run Prisma migrations |

---

## Development Workflow

For full local development with webhooks:

**Terminal 1 - Stripe webhook forwarding:**
```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

**Terminal 2 - Application:**
```bash
npm run dev
```

**Terminal 3 (optional) - Database GUI:**
```bash
npx prisma studio
```

### Common Development Tasks

**View database:**
```bash
npx prisma studio
```

**Reset database (caution - destroys data):**
```bash
npx prisma db push --force-reset
npx prisma db seed
```

**Check TypeScript:**
```bash
npm run build  # Runs tsc
```

**Test a Stripe webhook:**
```bash
stripe trigger checkout.session.completed
```

---

*Last updated: 2026-01-21*
