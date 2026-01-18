# Feature Landscape: Stripe + Discord Membership Gateway

**Domain:** Paid Discord community membership with Stripe billing
**Researched:** 2026-01-18
**Confidence:** HIGH (verified across multiple commercial solutions, official documentation)

---

## Table Stakes

Features users expect from any paid Discord membership system. Missing = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Stripe payment integration** | Industry standard; users expect card payments | Medium | Direct Stripe API avoids platform fees. All major solutions (PayBot, Upgrade.chat, LaunchPass) use Stripe. |
| **Automatic role assignment** | Core value prop of membership gateways | Medium | On successful payment, assign Discord role immediately. Role grants channel access. |
| **Automatic role removal** | Prevents free access after cancellation | Low | On subscription end/cancel, revoke role. Most bots check daily or via webhook. |
| **Email-based account linking** | Standard pattern across all solutions | Low | User provides Stripe billing email, system matches to Discord account. |
| **Subscription status sync** | Users expect access to reflect payment status | Medium | Poll Stripe or use webhooks (`customer.subscription.updated`, `invoice.payment_failed`). |
| **Basic checkout flow** | Users need a way to pay | Medium | Stripe Checkout or custom payment page. PayBot uses `/subscription` command; others use web links. |
| **Cancellation handling** | Users expect graceful offboarding | Low | Remove role, optionally send goodbye message, retain data for potential return. |
| **Multiple subscription tiers** | Expected for communities with price differentiation | Medium | Basic/Pro/VIP patterns common. Each tier maps to different Discord role. |
| **Discord OAuth login** | Required for account linking without manual email entry | Medium | `identify` scope minimum; `guilds` scope to verify server membership. |
| **Payment failure notifications** | Users need to know when payment fails | Low | Email via Stripe + optional Discord DM. |

### Critical Note on Table Stakes

The project's **pay-first model** (Stripe subscription required BEFORE Discord access) is slightly non-standard. Most solutions grant access first via invite, then assign/revoke roles. The Revenue Council's flow inverts this:

1. User pays via Stripe
2. User links Discord account (OAuth)
3. System adds user to server with role

This requires: invite creation capability, server membership management, not just role assignment.

---

## Differentiators

Features that set the product apart. Not universally expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Company/team seat management** | B2B play; allows one billing entity to manage multiple members | High | Rare in Discord membership space. Requires: seat allocation, admin dashboard, transfer capability. Most solutions are individual-only. |
| **Seat owner dashboard** | Company admins manage their team without contacting support | High | Add/remove seats, view usage, download invoices. Differentiates from LaunchPass/Whop which lack B2B features. |
| **Billing failure grace period (restrict, don't kick)** | Better retention than immediate cancellation | Medium | Research shows 3-16 day grace periods reduce involuntary churn. Restrict to limited channels rather than full kick. |
| **Introduction requirement** | Community quality control; ensures engaged members | Medium | New member must complete introduction before full channel access. Uncommon in pure payment gateways. |
| **Prorated seat changes** | Fair billing for mid-cycle team changes | Medium | Stripe supports proration natively; must implement UI/UX around it. |
| **Invite-less onboarding** | No shareable invite links; pay-first access only | Low | Prevents link sharing abuse. User gets added programmatically after payment. |
| **Self-service seat transfer** | Team admin can reassign seats without support | Medium | Useful for employee turnover; preserves billing while swapping Discord accounts. |
| **Webhook-driven instant sync** | Real-time status updates vs daily polling | Medium | Most open-source solutions poll daily. Webhooks provide immediate role updates on payment events. |
| **Custom billing cycles** | Weekly, monthly, quarterly, annual options | Low | Stripe supports natively; differentiates from platforms with monthly-only options. |
| **White-label checkout** | Branded payment experience | Medium | Custom domain, branding on checkout. LaunchPass Ultra and Whop offer this. |

### B2B/Team Features Deep Dive

The **company plans with owner/team seats** requirement is a significant differentiator. Research into SaaS seat management patterns reveals three approaches:

1. **Checkout-based licensing** (low conversion): Must buy seats before inviting
2. **Express licensing** (medium friction): Automatic billing on invite
3. **Member trials** (high conversion): Free trial per seat, convert on usage

For The Revenue Council, **checkout-based** likely fits best since payment-first is the core model. The admin dashboard should support:
- View all seats (used/available)
- Add new team members (triggers invite flow)
- Remove team members (revokes access, frees seat)
- Transfer seats between Discord accounts
- View billing history
- Update payment method

---

## Anti-Features

Features to deliberately NOT build. Common mistakes or patterns that harm the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Immediate access revocation on first payment failure** | Increases involuntary churn; payment failures often temporary | Implement 7-14 day grace period with restricted access and notifications. Only fully revoke after all retries fail. |
| **Complex bot-powered verification (CAPTCHA, reaction roles)** | Discord now handles raid protection natively; reduces conversion | Use Discord's built-in Community Onboarding + payment verification only. |
| **Shareable invite links** | Undermines pay-first model; invites can be passed around | Programmatic invite generation per-user, single-use, short expiry. |
| **Manual email matching** | Error-prone; users mistype emails, use different accounts | OAuth-first approach; only fall back to email if OAuth fails. |
| **Platform fees on top of Stripe** | PayBot, LaunchPass, Whop all charge 1-10% on top of Stripe's 2.9% | Direct Stripe integration; no middleman fees. |
| **Monthly-only billing** | Loses annual subscribers who want discount | Support multiple cycles from launch; annual = 2 months free is common. |
| **Polling-only status sync** | Delays of hours between payment and access | Webhook-first with polling as fallback. |
| **Over-complicated onboarding questions** | Discord recommends max 6 questions; more = drop-off | Minimal onboarding; let payment + introduction be the gates. |
| **Automatic kicks on billing issues** | Loses relationship; hard to re-engage | Restrict to "payment-issues" channel; maintain Discord relationship. |
| **Single-tier pricing** | Research shows multi-tier increases revenue 40-60% | At minimum: Individual Monthly, Individual Annual, Team. |
| **Client-side secret handling** | Security risk for OAuth | Use PKCE flow for public clients; server-side token exchange otherwise. |
| **Implicit OAuth grant** | Vulnerable to token leakage and replay attacks | Use authorization code flow (Discord recommendation). |

---

## Feature Dependencies

Understanding which features depend on others helps sequence implementation.

```
Core Foundation (Phase 1):
  Stripe Integration
       |
       v
  OAuth Account Linking <---- Discord Bot (for role management)
       |
       v
  Role Assignment/Removal

Individual Subscriptions (Phase 2):
  Core Foundation
       |
       v
  Subscription Checkout --> Payment Webhooks --> Role Sync
       |
       v
  Cancellation Flow

Team/Company Features (Phase 3):
  Individual Subscriptions (proven patterns)
       |
       v
  Seat Model + Admin Dashboard
       |
       v
  Seat Allocation --> Team Member Invite Flow
       |
       v
  Seat Transfer + Removal

Polish Features (Phase 4):
  All Above
       |
       v
  Grace Period Handling --> Restricted Access State
       |
       v
  Introduction Requirement --> Full Access Gate
       |
       v
  Advanced Billing (proration, custom cycles)
```

### Dependency Notes

1. **OAuth must precede invite generation** - Need Discord user ID before adding to server
2. **Webhook infrastructure before grace periods** - Need real-time payment events
3. **Individual flow before team flow** - Team is individual + seat layer
4. **Role management before introduction gating** - Need roles to distinguish intro-complete vs intro-pending

---

## MVP Recommendation

For MVP, prioritize these features:

### Must Have (Launch Blockers)
1. **Stripe Checkout integration** - Core payment flow
2. **Discord OAuth linking** - Account connection
3. **Automatic role assignment** - Access grant on payment
4. **Webhook-driven status sync** - Real-time updates
5. **Basic cancellation handling** - Role removal

### Should Have (Week 2)
1. **Multiple tiers** (Individual Monthly/Annual at minimum)
2. **Payment failure notifications** (email + optional DM)
3. **Basic admin view** (who has access, payment status)

### Defer to Post-MVP
1. **Company/team seat management** - Complex; get individual flow right first
2. **Grace period with restricted access** - Requires additional role/channel setup
3. **Introduction requirement** - Adds friction; test if needed
4. **Self-service seat transfer** - Rare edge case initially
5. **White-label checkout** - Nice-to-have for branding

---

## Competitive Landscape Summary

| Solution | Strengths | Weaknesses | Relevance |
|----------|-----------|------------|-----------|
| **LaunchPass** | Easy setup, multi-platform | $29/mo + 3.5% fees, poor analytics, no team seats | Competition for individual subscriptions |
| **Whop** | No monthly fee, 3% transaction, marketplace discovery | 10% on marketplace sales, consumer-focused | Competition, but lacks B2B |
| **PayBot** | Free tier, Discord-native commands | Limited features, no team management | Entry-level competition |
| **Upgrade.chat** | Multi-payment (PayPal, Crypto), trials, coupons | Complexity, transaction fees | Feature-rich competitor |
| **Discord Native Subscriptions** | Zero third-party, built-in | 10% cut (30% iOS), US-only, no team seats | Not viable for B2B or non-US |

### The Revenue Council's Competitive Advantage

None of the researched solutions offer:
- True B2B team/seat management
- Company billing with multiple member seats
- Pay-first access model (vs invite-first)
- Introduction requirement before full access

This positions The Revenue Council's system for professional/business communities rather than creator/influencer audiences that existing solutions target.

---

## Sources

### Official Documentation
- [Stripe Subscription Billing Overview](https://docs.stripe.com/billing/subscriptions/overview) - Subscription states, failure handling
- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2) - OAuth scopes, authorization flow
- [Discord Community Onboarding](https://support.discord.com/hc/en-us/articles/11074987197975-Community-Onboarding-FAQ) - Native onboarding features
- [Stripe Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries) - Payment recovery automation

### Commercial Solutions (Competitive Research)
- [LaunchPass](https://www.launchpass.com/) - $29/mo + 3.5% model, multi-platform
- [Whop](https://whop.com/) - 3% transaction fee, marketplace
- [PayBot](https://paybotapp.com/) - Discord-native, free tier
- [Upgrade.chat](https://upgrade.chat/) - Multi-payment, advanced features

### Best Practices
- [Stripe Dunning Management](https://stripe.com/resources/more/dunning-management-101-why-it-matters-and-key-tactics-for-businesses) - Payment failure handling
- [Grace Periods in SaaS](https://signeasy.com/blog/engineering/grace-periods) - Restrict vs cancel approaches
- [Discord Onboarding Best Practices](https://discord.com/community/onboarding-new-members) - New member experience

### Open Source Reference
- [stripe-discord-bot](https://github.com/Androz2091/stripe-discord-bot) - TypeScript, PostgreSQL implementation
- [StripeCord](https://github.com/Rodaviva29/StripeCord) - JavaScript, MongoDB implementation
