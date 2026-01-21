# The Revenue Council - Membership Gateway

A Stripe-backed membership gateway that controls access to The Revenue Council Discord community. Paid members can access the community, and we always know who everyone is.

## Technology Stack

- **Runtime:** Node.js 20+ / TypeScript
- **Framework:** Express 5.x
- **Database:** Supabase PostgreSQL with Prisma 7 ORM
- **Payments:** Stripe (subscriptions, webhooks)
- **Discord:** Discord.js 14 (bot operations, OAuth)
- **Email:** Resend (production) / Console (development)

## Overview

The Revenue Council is a professional community of successful entrepreneurs. This application manages the membership lifecycle:

1. **Payment:** Member subscribes via Stripe (individual or company plan)
2. **Discord Link:** Member connects their Discord account via OAuth
3. **Introduction:** Member posts introduction in #introductions channel
4. **Access:** Bot promotes member to full access role

Supports both individual memberships and company plans with tiered seat allocation (owner vs team seats).

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see Environment Configuration below)
cp .env.example .env
# Edit .env with your credentials

# 3. Set up database
npx prisma db push

# 4. Seed initial admin account
npx prisma db seed

# 5. Start development server
npm run dev
```

For Stripe webhook testing, run in a separate terminal:
```bash
npm run stripe:listen
```

## Environment Configuration

The application requires configuration for several external services:

**Required Services:**
- Supabase PostgreSQL database
- Stripe account (test or live)
- Discord application with bot

**Optional Services:**
- Resend account (for production email delivery)

Copy `.env.example` to `.env` and configure each section. The example file includes comments explaining where to get each value.

For detailed setup instructions including service configuration, see:
- [Environment Setup Guide](.planning/ENVIRONMENT-SETUP.md)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production server (requires build) |
| `npm test` | Run test suite (Vitest) |
| `npm run lint` | Run ESLint |
| `npm run stripe:listen` | Forward Stripe webhooks to localhost |
| `npx prisma studio` | Open database GUI |
| `npx prisma db push` | Push schema changes to database |
| `npx prisma db seed` | Seed database with initial data |

## Project Structure

```
src/
  config/       # Environment validation and constants
  routes/       # Express route handlers
  services/     # Business logic (Discord, Stripe, email)
  lib/          # Utilities (auth, validation, helpers)
  types/        # TypeScript type definitions

prisma/
  schema/       # Prisma schema definition
  seed.ts       # Database seeding script

public/
  index.html    # Landing page (The Gatekeeper)
  admin/        # Admin dashboard pages
  *.html        # Member-facing pages

.planning/      # Development documentation and planning
```

## Documentation

- **API Reference:** [docs/API.md](docs/API.md)
- **Deployment Guide:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Environment Setup:** [.planning/ENVIRONMENT-SETUP.md](.planning/ENVIRONMENT-SETUP.md)
- **Manual Testing Guide:** [.planning/MANUAL-TESTING-GUIDE.md](.planning/MANUAL-TESTING-GUIDE.md)

## Discord Role Hierarchy

The bot manages these roles (medieval theme):

| Role | Access Level | Assigned When |
|------|--------------|---------------|
| Squire | Limited | Paid but not introduced |
| Knight | Full member | Individual subscriber, introduced |
| Lord | Full member + owner channels | Company owner, introduced |
| Vassal | Full member | Company team member, introduced |
| Exile | Billing issue channel only | Payment failed |

## License

Proprietary - All Rights Reserved
