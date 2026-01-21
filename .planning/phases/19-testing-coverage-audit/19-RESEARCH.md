# Phase 19: Testing Coverage Audit - Research

**Researched:** 2026-01-21
**Domain:** Node.js/TypeScript Testing, Express API Testing, Webhook Testing
**Confidence:** MEDIUM (based on codebase analysis and standard practices)

## Summary

This project currently has **ZERO automated tests** despite having Vitest v4.0.17 installed and configured in package.json. The audit will assess which critical user flows, webhook handlers, auth flows, and error scenarios need test coverage based on the implemented v1 requirements (AUTH-01 through OPS-04).

The project has comprehensive manual testing documentation (MANUAL-TESTING-GUIDE.md and TESTING-PROTOCOL.md) covering 11 test suites with 90+ manual test cases. This documentation provides an excellent roadmap for what automated tests should cover.

**Primary recommendation:** Focus the audit on identifying gaps between the extensive manual test coverage and the complete absence of automated tests, prioritizing critical paths like webhook handlers, auth flows, and billing state transitions.

## Current State Assessment

### Testing Infrastructure Status

| Item | Status | Notes |
|------|--------|-------|
| Test Framework | Vitest 4.0.17 installed | `"test": "vitest"` in package.json |
| Test Files | NONE | No `*.test.ts` or `*.spec.ts` files in src/ |
| Coverage Tool | Not configured | No c8/istanbul configuration |
| Mocking Libraries | Not installed | No vitest-mock-extended, prismock |
| Test Database | Not configured | No test database setup |
| Manual Test Docs | EXISTS | MANUAL-TESTING-GUIDE.md (90+ test cases) |

### Critical Source Files Requiring Tests

Based on codebase analysis:

| File | Critical Operations | Risk Level |
|------|---------------------|------------|
| `src/webhooks/stripe.ts` | All Stripe event processing (391 lines) | CRITICAL |
| `src/billing/failure-handler.ts` | Payment failure, grace period logic | CRITICAL |
| `src/billing/recovery-handler.ts` | Payment recovery, role restoration | CRITICAL |
| `src/auth/session.ts` | JWT creation/verification | HIGH |
| `src/auth/magic-link.ts` | Magic link token generation/verify | HIGH |
| `src/auth/discord-oauth.ts` | OAuth token exchange | HIGH |
| `src/routes/claim.ts` | Individual Discord claim flow | HIGH |
| `src/routes/team-claim.ts` | Team seat claim with race condition handling | HIGH |
| `src/routes/auth.ts` | Login, signup, refresh, magic link | HIGH |
| `src/lib/role-assignment.ts` | Async role operations with retry | MEDIUM |
| `src/bot/events/introduction.ts` | Introduction detection/promotion | MEDIUM |
| `src/reconciliation/reconcile.ts` | Drift detection and auto-fix | MEDIUM |

## Standard Stack

The established libraries/tools for testing this type of application:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.x | Test runner | Already installed, native ESM/TypeScript, fast |
| @vitest/coverage-v8 | ^4.0.x | Coverage reporting | Built-in V8 coverage, works with Vitest |
| vitest-mock-extended | ^2.x | Deep mocking | Enables mocking Prisma, external services |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| supertest | ^7.x | HTTP testing | Integration tests for Express routes |
| prismock | ^2.x | Prisma mocking | Unit tests needing DB operations |
| stripe-mock | (Stripe CLI) | Webhook simulation | Testing Stripe webhook handlers |
| msw | ^2.x | API mocking | Mock external APIs (Discord, Stripe) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest | jest | Vitest already installed; jest needs more config for ESM |
| prismock | prisma-mock-vitest | prismock reads actual schema, more realistic |
| supertest | axios | supertest better for Express testing |

**Installation (when implementing):**
```bash
npm install -D @vitest/coverage-v8 vitest-mock-extended supertest @types/supertest prismock msw
```

## Architecture Patterns

### Recommended Test Structure
```
src/
├── __tests__/
│   ├── unit/
│   │   ├── auth/
│   │   │   ├── session.test.ts
│   │   │   └── magic-link.test.ts
│   │   ├── billing/
│   │   │   ├── failure-handler.test.ts
│   │   │   └── recovery-handler.test.ts
│   │   └── lib/
│   │       └── role-assignment.test.ts
│   ├── integration/
│   │   ├── webhooks/
│   │   │   └── stripe.test.ts
│   │   ├── routes/
│   │   │   ├── auth.test.ts
│   │   │   └── claim.test.ts
│   │   └── setup.ts
│   └── helpers/
│       ├── factories.ts
│       ├── mocks.ts
│       └── fixtures.ts
├── vitest.config.ts
└── vitest.setup.ts
```

### Pattern 1: App/Server Separation
**What:** Separate Express app creation from server listening for testability
**When to use:** All integration tests

Current code creates app and starts listening in same file (index.ts). For testing:
```typescript
// src/app.ts - Export app builder
export function buildApp() {
  const app = express();
  // ... middleware and routes
  return app;
}

// src/index.ts - Start server
const app = buildApp();
app.listen(PORT);

// __tests__/integration/routes/auth.test.ts
import { buildApp } from '../../../app';
import supertest from 'supertest';

const app = buildApp();
const request = supertest(app);
```

### Pattern 2: Prisma Client Mocking
**What:** Mock Prisma Client for unit tests
**When to use:** Testing business logic without database
```typescript
// vitest.setup.ts
import { beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prisma = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(prisma);
});

export { prisma };
```

### Pattern 3: Stripe Webhook Testing
**What:** Test webhook handlers with mocked events
**When to use:** Testing webhook processing logic
```typescript
// Using Stripe CLI for realistic event format
// stripe trigger checkout.session.completed --add checkout_session:mode=subscription

// In tests, create minimal valid events:
const mockCheckoutEvent: Stripe.Event = {
  id: 'evt_test_123',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_123',
      mode: 'subscription',
      client_reference_id: 'member_123',
      // ... required fields
    }
  },
  // ...
};
```

### Anti-Patterns to Avoid
- **Testing implementation, not behavior:** Don't test internal function calls; test observable outcomes
- **Excessive mocking:** Over-mocking loses confidence; prefer integration tests for critical paths
- **Shared state between tests:** Each test should be independent; reset state in beforeEach
- **Testing external services directly:** Mock Discord API, Stripe API in unit tests

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe event simulation | Custom JSON objects | Stripe CLI `stripe trigger` | Realistic event structure, signature handling |
| Prisma mocking | Manual mock objects | prismock or prisma-mock-vitest | Type-safe, schema-aware |
| HTTP testing | fetch + assertions | supertest | Request building, response assertions built-in |
| API mocking | Custom interceptors | msw | Type-safe, realistic, works in Node |
| Time manipulation | setTimeout tricks | vi.useFakeTimers() | Predictable, controllable |

**Key insight:** Webhook signature verification cannot be bypassed easily. Either mock at the router level (bypass verification for tests) or use Stripe CLI to generate properly signed requests.

## Common Pitfalls

### Pitfall 1: Async Fire-and-Forget Code
**What goes wrong:** Code like `assignRoleAsync()` returns immediately; test passes but async work fails
**Why it happens:** Functions like `removeAndKickAsync` don't await completion
**How to avoid:**
- For unit tests: Mock the fire-and-forget functions
- For integration tests: Add test-only hooks or use `vi.waitFor()`
**Warning signs:** Tests pass but logs show errors after test completion

### Pitfall 2: Token Expiration in Tests
**What goes wrong:** JWT tests fail intermittently due to time-sensitive expiration
**Why it happens:** Real time passes between token creation and verification
**How to avoid:** Use `vi.useFakeTimers()` for time-sensitive token tests
**Warning signs:** Tests pass locally but fail in CI

### Pitfall 3: Discord Bot State
**What goes wrong:** Bot tests require running Discord bot, which can't mock guild state
**Why it happens:** discord.js caches guild/role data from live API
**How to avoid:**
- Extract logic into testable pure functions
- Mock at the discordClient level
- Use dependency injection pattern
**Warning signs:** Tests hang waiting for Discord API, rate limit errors

### Pitfall 4: Database State Pollution
**What goes wrong:** Tests interfere with each other via shared database state
**Why it happens:** Prisma operations persist between tests
**How to avoid:**
- Use transaction-based testing (rollback after each test)
- Use test-specific database with reset between tests
- Use mocked Prisma for unit tests
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 5: Webhook Signature Verification
**What goes wrong:** Direct POST to webhook endpoint fails signature verification
**Why it happens:** Stripe signature requires webhook secret and specific signing algorithm
**How to avoid:**
- Mock `stripe.webhooks.constructEvent` in unit tests
- Use Stripe CLI for integration tests
- Create test-environment bypass (dangerous, flag clearly)
**Warning signs:** All webhook tests return 400 "signature verification failed"

## Code Examples

### Example 1: Testing JWT Token Functions
```typescript
// src/__tests__/unit/auth/session.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAccessToken, createRefreshToken, verifyToken } from '../../../auth/session';

describe('session tokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createAccessToken', () => {
    it('creates a valid JWT with member ID', async () => {
      const memberId = 'member_123';
      const token = await createAccessToken(memberId);

      const payload = await verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(memberId);
    });

    it('expires after 15 minutes', async () => {
      const token = await createAccessToken('member_123');

      // Advance time past expiration
      vi.advanceTimersByTime(16 * 60 * 1000); // 16 minutes

      const payload = await verifyToken(token);
      expect(payload).toBeNull();
    });
  });

  describe('createRefreshToken', () => {
    it('sets 30 day expiry when rememberMe is true', async () => {
      const token = await createRefreshToken('member_123', true);

      // Still valid after 29 days
      vi.advanceTimersByTime(29 * 24 * 60 * 60 * 1000);
      const payload = await verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.type).toBe('refresh');
    });
  });
});
```

### Example 2: Testing Webhook Handlers (Unit)
```typescript
// src/__tests__/unit/billing/failure-handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePaymentFailure } from '../../../billing/failure-handler';
import { prisma } from '../../../lib/prisma';

vi.mock('../../../lib/prisma');
vi.mock('../../../billing/notifications');

describe('handlePaymentFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores non-renewal failures', async () => {
    const invoice = {
      id: 'inv_123',
      billing_reason: 'subscription_create', // Not renewal
      customer: 'cus_123',
    } as any;

    await handlePaymentFailure(invoice);

    expect(prisma.member.findUnique).not.toHaveBeenCalled();
  });

  it('starts grace period on first failure', async () => {
    const mockMember = {
      id: 'member_123',
      email: 'test@example.com',
      paymentFailedAt: null, // First failure
    };

    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(mockMember as any);
    vi.mocked(prisma.member.update).mockResolvedValue({} as any);

    const invoice = {
      id: 'inv_123',
      billing_reason: 'subscription_cycle',
      customer: 'cus_123',
    } as any;

    await handlePaymentFailure(invoice);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 'member_123' },
      data: expect.objectContaining({
        subscriptionStatus: 'PAST_DUE',
        paymentFailedAt: expect.any(Date),
        gracePeriodEndsAt: expect.any(Date),
      }),
    });
  });

  it('does not reset grace period on retry failure', async () => {
    const mockMember = {
      id: 'member_123',
      paymentFailedAt: new Date(), // Already in grace period
    };

    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(mockMember as any);

    const invoice = {
      id: 'inv_456',
      billing_reason: 'subscription_cycle',
      customer: 'cus_123',
    } as any;

    await handlePaymentFailure(invoice);

    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});
```

### Example 3: Integration Test with Supertest
```typescript
// src/__tests__/integration/routes/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../../app';

const app = buildApp();
const request = supertest(app);

describe('POST /auth/signup', () => {
  it('creates new user and returns tokens', async () => {
    const response = await request
      .post('/auth/signup')
      .send({
        email: 'newuser@test.com',
        password: 'SecurePassword123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.expiresIn).toBe(900);
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('rejects invalid email format', async () => {
    const response = await request
      .post('/auth/signup')
      .send({
        email: 'invalid-email',
        password: 'SecurePassword123',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('email');
  });
});
```

## Coverage Gap Mapping

Mapping v1 requirements to test coverage needs:

### Authentication (AUTH-01 through AUTH-04)
| Requirement | Current Coverage | Audit Action |
|-------------|------------------|--------------|
| AUTH-01: Discord OAuth initiation | Manual only | Document: needs integration test |
| AUTH-02: Session persistence | Manual only | Document: needs unit test for refresh flow |
| AUTH-03: Magic link request | Manual only | Document: needs unit test |
| AUTH-04: Magic link verification | Manual only | Document: needs unit + integration test |

### Payments (PAY-01 through PAY-07)
| Requirement | Current Coverage | Audit Action |
|-------------|------------------|--------------|
| PAY-01: Individual checkout | Manual only | Document: needs integration test |
| PAY-03: Webhook processing | Manual only | **CRITICAL**: needs unit + integration tests |
| PAY-04: Idempotency | Manual only | Document: needs unit test for duplicate handling |
| PAY-05: Signature verification | Manual only | Document: needs unit test |

### Billing Failure (BILL-01 through BILL-05)
| Requirement | Current Coverage | Audit Action |
|-------------|------------------|--------------|
| BILL-01: Failure detection | Manual only | **CRITICAL**: needs unit test |
| BILL-02: Debtor role transition | Manual only | Document: needs integration test |
| BILL-04: Recovery detection | Manual only | **CRITICAL**: needs unit test |
| BILL-05: Role restoration | Manual only | Document: needs integration test |

### Discord Roles (ROLE-01 through ROLE-06)
| Requirement | Current Coverage | Audit Action |
|-------------|------------------|--------------|
| ROLE-01: Squire assignment | Manual only | Document: needs mocked integration test |
| ROLE-02: Knight promotion | Manual only | Document: bot event handler test |
| ROLE-06: Role removal on cancel | Manual only | Document: needs unit test |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for ESM | Vitest native ESM | 2023-2024 | No complex transform config needed |
| Manual mocks | vitest-mock-extended | 2024 | Type-safe deep mocking |
| Separate test DB | Transaction rollback | 2024-2025 | Faster tests, same-DB isolation |
| Supertest only | MSW + Supertest | 2024 | Better API mocking at network level |

**Deprecated/outdated:**
- `jest` with `ts-jest` transform: Vitest handles TypeScript natively
- `@types/jest`: Use Vitest's built-in types
- Istanbul instrumentation: c8 with V8 coverage is more accurate for modern Node.js

## Open Questions

Things that couldn't be fully resolved:

1. **Discord Bot Testing Strategy**
   - What we know: Dependency injection recommended, mock at client level
   - What's unclear: How to test bot event handlers without live Discord API
   - Recommendation: Extract pure functions for logic, mock discord.js Client

2. **Test Database Strategy**
   - What we know: prismock for unit tests, transaction rollback for integration
   - What's unclear: Whether project needs integration tests with real Supabase
   - Recommendation: Start with mocked Prisma; add real DB tests if needed

3. **Coverage Thresholds**
   - What we know: Industry standard is 70-80% for new projects
   - What's unclear: What thresholds are realistic for audit phase
   - Recommendation: Audit documents gaps; implementation phase sets thresholds

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All `src/` files examined for testing needs
- `.planning/MANUAL-TESTING-GUIDE.md` - 90+ documented manual test cases
- `.planning/TESTING-PROTOCOL.md` - UI/UX testing checklist
- `.planning/REQUIREMENTS.md` - v1 requirements (41 total)

### Secondary (MEDIUM confidence)
- [Prisma Testing Guide](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing) - Official mocking patterns
- [Vitest Documentation](https://vitest.dev/guide/) - Test runner configuration
- [Stripe Webhook Testing](https://docs.stripe.com/webhooks) - CLI-based testing approach

### Tertiary (LOW confidence)
- WebSearch results for discord.js testing - Community consensus: mock at client level
- WebSearch results for Express testing patterns - Supertest + app separation

## Metadata

**Confidence breakdown:**
- Current state assessment: HIGH - Direct codebase analysis
- Standard stack: MEDIUM - Based on ecosystem research
- Coverage gap mapping: HIGH - Based on REQUIREMENTS.md mapping
- Testing patterns: MEDIUM - Community best practices, not project-specific

**Research date:** 2026-01-21
**Valid until:** 60 days (testing fundamentals stable)
