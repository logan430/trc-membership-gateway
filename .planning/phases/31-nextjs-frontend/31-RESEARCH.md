# Phase 31: Next.js Frontend Setup - Research

**Researched:** 2026-01-23
**Domain:** Next.js 15.1 + React 19, Express proxy integration, JWT authentication, Tailwind CSS v4, Component library porting
**Confidence:** HIGH

## Summary

This phase establishes a Next.js 15.1 app running alongside the existing Express server, proxied through Express on `/dashboard/*` routes. The key challenges are: (1) forwarding httpOnly cookies through the proxy for shared authentication, (2) sharing JWT validation logic between Express and Next.js middleware using the `jose` library, and (3) porting Chris's component library with medieval pixel-art theming per CONTEXT.md decisions.

The existing Express app uses `jose@6.1.3` for JWT with 15-minute access tokens and 7-30 day refresh tokens stored in httpOnly cookies. Next.js middleware can read these cookies and validate using the same jose library (Edge Runtime compatible). The proxy setup uses `http-proxy-middleware` to forward `/dashboard/*` requests from port 4000 to Next.js on port 3000, preserving cookies and headers.

Chris's app already uses Next.js 16, React 19.2, Tailwind CSS v4, and Recharts 3.5 - providing working examples of the stack. Components to port include Button, Card, Input, Skeleton (replaced with gold coins loader), and chart components (ComparisonBar, ScoreRing, PerformanceRadar).

**Primary recommendation:** Create Next.js app in a `dashboard/` subdirectory, share JWT secret via environment variable, use http-proxy-middleware with cookie forwarding, and implement CSS-first Tailwind v4 theming with custom pixel-style utilities.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.1+ | React framework with App Router | Decided in STATE.md, Chris's app uses 16.0.9 |
| React | 19.2.x | UI library | Decided in STATE.md, latest stable |
| Tailwind CSS | 4.x | Utility-first CSS | Decided in STATE.md, 5x faster builds |
| jose | 6.1.3 | JWT signing/verification | Already used in Express, Edge Runtime compatible |
| Recharts | 3.5+ | Chart visualizations | Chris's app uses it, supports custom shapes |
| lucide-react | 0.560+ | Icon library | Chris's app uses it, tree-shakeable |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| http-proxy-middleware | 3.x | Express proxy to Next.js | Route /dashboard/* from Express to Next.js |
| @tailwindcss/postcss | 4.x | PostCSS plugin for Tailwind v4 | Required for Tailwind v4 CSS-first config |
| next/font | (bundled) | Google Fonts optimization | Load Inter font as in Chris's app |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jose | jsonwebtoken | jsonwebtoken NOT Edge Runtime compatible - cannot use in Next.js middleware |
| http-proxy-middleware | next.config.js rewrites | rewrites can't modify headers/cookies as needed |
| Tailwind v4 | v3 | v3 still works but slower, different config style |

**Installation:**

```bash
# In dashboard/ subdirectory
npm install next@15 react@19 react-dom@19 recharts@3 lucide-react jose
npm install -D tailwindcss@4 @tailwindcss/postcss typescript @types/react @types/node

# In root Express app
npm install http-proxy-middleware
```

## Architecture Patterns

### Recommended Project Structure

```
project-root/
├── src/                           # Express backend (existing)
│   ├── auth/
│   │   └── session.ts             # JWT functions - extract shared logic
│   ├── middleware/
│   │   └── session.ts             # Express auth middleware
│   └── index.ts                   # Add proxy middleware here
├── dashboard/                     # Next.js 15 app (new)
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css        # Tailwind v4 CSS-first config
│   │   │   ├── layout.tsx         # Root layout with fonts
│   │   │   ├── page.tsx           # Redirect to /dashboard/overview
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx     # Dashboard shell with sidebar
│   │   │       ├── page.tsx       # Overview page
│   │   │       └── [...other pages]
│   │   ├── components/
│   │   │   ├── ui/                # Ported components with pixel theme
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   └── GoldCoinsLoader.tsx
│   │   │   ├── charts/            # Chart components
│   │   │   │   ├── ComparisonBar.tsx
│   │   │   │   ├── ScoreRing.tsx
│   │   │   │   └── PerformanceRadar.tsx
│   │   │   └── layout/
│   │   │       ├── Sidebar.tsx
│   │   │       └── Header.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts            # JWT verification (uses jose)
│   │   │   └── api.ts             # API client for Express backend
│   │   └── middleware.ts          # Auth check, cookie reading
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   ├── tsconfig.json
│   └── package.json
└── package.json                   # Root package (Express)
```

### Pattern 1: Express Proxy to Next.js

**What:** Express forwards `/dashboard/*` requests to Next.js running on port 3000
**When to use:** Running Next.js alongside existing Express server on same domain
**Example:**

```typescript
// Source: http-proxy-middleware documentation
// In src/index.ts
import { createProxyMiddleware } from 'http-proxy-middleware';

// Mount BEFORE other routes
app.use('/dashboard', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true, // WebSocket support for HMR in dev
  cookieDomainRewrite: '', // Preserve cookies
  on: {
    proxyReq: (proxyReq, req) => {
      // Forward auth cookies
      const cookies = req.headers.cookie;
      if (cookies) {
        proxyReq.setHeader('Cookie', cookies);
      }
    },
  },
}));
```

### Pattern 2: Shared JWT Validation

**What:** Both Express and Next.js validate JWTs using same jose library and secret
**When to use:** Cross-app authentication with httpOnly cookies
**Example:**

```typescript
// Source: jose npm documentation, Next.js auth guide
// In dashboard/src/lib/auth.ts
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { sub: payload.sub as string, type: payload.type as string | undefined };
  } catch {
    return null;
  }
}
```

### Pattern 3: Next.js Middleware Auth Check

**What:** Middleware reads cookies and validates JWT before page render
**When to use:** Protecting all dashboard routes
**Example:**

```typescript
// Source: Next.js middleware docs, jose examples
// In dashboard/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  // Read refresh token from cookies (access token in header not available here)
  const refreshToken = request.cookies.get('trc_refresh')?.value;

  if (!refreshToken) {
    // Redirect to Express login page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Token valid - continue to page
  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

### Pattern 4: Tailwind v4 CSS-First Theme

**What:** Theme configuration directly in CSS file, not tailwind.config.js
**When to use:** Tailwind v4 projects
**Example:**

```css
/* Source: Tailwind CSS v4 docs */
/* In dashboard/src/app/globals.css */
@import "tailwindcss";

/* Medieval pixel theme per CONTEXT.md */
:root {
  /* Core colors */
  --background: #faf8f5;       /* Parchment background */
  --foreground: #334155;       /* Slate/charcoal primary */
  --card: #fffef9;             /* Card parchment */
  --card-foreground: #334155;

  /* Gold accents */
  --gold: #d4a017;
  --gold-light: #f4d03f;
  --gold-dark: #b8860b;

  /* Medieval palette */
  --accent: #e8e4db;           /* Aged parchment accent */
  --border: #d1c7b5;           /* Parchment edge */
  --muted: #f0ece4;
  --muted-foreground: #64748b;

  /* Pixel styling */
  --pixel-border-width: 2px;
  --pixel-shadow-offset: 3px;
  --radius: 8px;               /* Per success criteria */
}

/* Tailwind v4 theme registration */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-gold: var(--gold);
  --color-gold-light: var(--gold-light);
  --color-gold-dark: var(--gold-dark);
  --color-card: var(--card);
  --color-border: var(--border);
  --radius-default: var(--radius);
}
```

### Anti-Patterns to Avoid

- **Using jsonwebtoken in middleware:** Will crash - not Edge Runtime compatible. Use jose.
- **Hardcoding JWT secret:** Use environment variable shared between Express and Next.js.
- **Cookie path mismatch:** Ensure cookies are set with `path: '/'` not just `/auth/refresh` for cross-app access.
- **Forgetting proxy cookie forwarding:** Without explicit cookie forwarding in proxy config, auth fails.
- **Using tailwind.config.js with v4:** Tailwind v4 uses CSS-first config, not JS config file.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation in Edge | Custom decoder | jose library | Edge Runtime compatible, handles all edge cases |
| Cookie forwarding proxy | Manual req.pipe() | http-proxy-middleware | Handles headers, WebSocket, cookies correctly |
| Chart pixel styling | SVG manipulation | Recharts custom shapes | Recharts supports custom Bar/Cell shapes via props |
| Loading spinner | Custom keyframes | CSS animation with @keyframes | Well-tested, hardware accelerated |
| Icon system | Custom SVGs | lucide-react | 1500+ icons, tree-shakeable, consistent style |

**Key insight:** The existing Express auth uses `jose` which is already Edge Runtime compatible. No need to switch JWT libraries - just share the secret and import the same verification logic pattern.

## Common Pitfalls

### Pitfall 1: Cookie Path Restriction

**What goes wrong:** Refresh token cookie set with `path: '/auth/refresh'` is not accessible in Next.js middleware
**Why it happens:** Express auth sets cookie path to only the refresh endpoint
**How to avoid:** Modify Express cookie config to use `path: '/'` for dashboard access, OR create a separate session cookie for dashboard
**Warning signs:** Next.js middleware can't read the cookie, auth always fails

### Pitfall 2: Next.js 15 Async Cookies API

**What goes wrong:** Using `cookies()` synchronously causes deprecation warnings in Next.js 15+
**Why it happens:** Cookies API changed to async in Next.js 14/15
**How to avoid:** Always `await cookies()` in Server Components and use `request.cookies` in middleware
**Warning signs:** Deprecation warnings, intermittent cookie reading failures

### Pitfall 3: Tailwind v4 PostCSS Setup

**What goes wrong:** Tailwind styles not applied, build errors about unknown at-rules
**Why it happens:** Using wrong PostCSS config or missing @tailwindcss/postcss plugin
**How to avoid:** Use exactly: `@tailwindcss/postcss` in postcss.config.mjs, `@import "tailwindcss"` in CSS
**Warning signs:** Build warnings about unknown `@theme` directive

### Pitfall 4: Proxy WebSocket for HMR

**What goes wrong:** Hot module replacement doesn't work in development
**Why it happens:** WebSocket connections not proxied
**How to avoid:** Set `ws: true` in http-proxy-middleware options
**Warning signs:** Changes require manual refresh, no live updates

### Pitfall 5: CORS with Proxy

**What goes wrong:** API calls from Next.js to Express fail with CORS errors
**Why it happens:** Different ports count as different origins
**How to avoid:** API calls go through proxy path (same origin) OR configure CORS in Express
**Warning signs:** Network errors, "blocked by CORS policy" in console

## Code Examples

Verified patterns from official sources and Chris's working app:

### Button Component with Pixel Styling

```typescript
// Adapted from Chris's Button.tsx with pixel enhancements per CONTEXT.md
'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center font-semibold
      rounded-[8px] transition-transform
      focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      hover:scale-[1.02]
    `;

    // Pixel-style hard shadows per CONTEXT.md
    const pixelShadow = 'shadow-[3px_3px_0px_0px_rgba(51,65,85,0.3)]';

    const variants = {
      primary: `bg-foreground text-background border-2 border-foreground ${pixelShadow}`,
      secondary: `bg-gold text-foreground border-2 border-gold-dark ${pixelShadow}`,
      outline: `border-2 border-foreground bg-transparent text-foreground ${pixelShadow}`,
      ghost: 'bg-transparent text-foreground hover:bg-accent',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <GoldCoinSpinner className="mr-2" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };
```

### Gold Coins Loader Animation

```typescript
// Custom medieval loader per CONTEXT.md
'use client';

export function GoldCoinsLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`relative ${sizes[size]}`}>
      {/* Three stacking coins */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute w-full h-[40%] rounded-full bg-gradient-to-b from-gold-light via-gold to-gold-dark border-2 border-gold-dark animate-coin-stack"
          style={{
            animationDelay: `${i * 0.15}s`,
            bottom: `${i * 25}%`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes coin-stack {
          0%, 100% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-10px) scale(0.95); opacity: 0.8; }
        }
        .animate-coin-stack {
          animation: coin-stack 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
```

### Pixel-Style Card Component

```typescript
// Adapted from Chris's Card.tsx with pixel theme
import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-card rounded-[8px]
          border-2 border-border
          shadow-[3px_3px_0px_0px_rgba(51,65,85,0.2)]
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export { Card };
```

### Custom Pixel Bar for Recharts

```typescript
// Source: Recharts custom shapes documentation
// Pixel-stepped bar per CONTEXT.md
import { Rectangle } from 'recharts';

interface PixelBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}

export function PixelBar({ x = 0, y = 0, width = 0, height = 0, fill }: PixelBarProps) {
  // Create stepped/blocky effect by rounding to nearest 4px
  const stepSize = 4;
  const steppedWidth = Math.round(width / stepSize) * stepSize;
  const steppedHeight = Math.round(height / stepSize) * stepSize;

  return (
    <Rectangle
      x={x}
      y={y + (height - steppedHeight)}
      width={steppedWidth}
      height={steppedHeight}
      fill={fill}
      radius={0} // Sharp corners for pixel style
    />
  );
}

// Usage in ComparisonBar:
// <Bar dataKey="value" shape={<PixelBar />} />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js | CSS-first @import "tailwindcss" | Tailwind v4 (Jan 2025) | No JS config needed, 5x faster |
| middleware.js | proxy.js | Next.js 16 (late 2025) | Name change only, same functionality |
| jsonwebtoken | jose | Always for Edge | jose works in Edge Runtime, jwt does not |
| Pages Router | App Router | Next.js 13+ (2023) | Server Components, layouts, streaming |

**Deprecated/outdated:**
- `tailwindcss/nesting` plugin: Not needed in Tailwind v4
- `@tailwind base/components/utilities` directives: Replaced by `@import "tailwindcss"`
- Sync `cookies()` API: Deprecated in Next.js 15, use async

## Open Questions

Things that couldn't be fully resolved:

1. **Cookie Path Modification**
   - What we know: Current refresh token has `path: '/auth/refresh'`
   - What's unclear: Can we change path without breaking existing sessions?
   - Recommendation: Create new session cookie with `path: '/'` for dashboard, OR modify refresh path and accept session invalidation

2. **Next.js 16 vs 15.1**
   - What we know: Chris's app uses Next.js 16.0.9, docs mention Next.js 16 changes
   - What's unclear: Exact differences between 15.1 and 16 for our use case
   - Recommendation: Start with 15.1 (per success criteria), can upgrade later if needed

3. **Pixel-Art Icon Source**
   - What we know: Need pixel-style icons for medieval theme
   - What's unclear: Best source for pixel icons compatible with lucide-react pattern
   - Recommendation: Use lucide-react for now, create custom pixel SVGs for key icons (shield, coins, etc.)

## Sources

### Primary (HIGH confidence)

- Chris's Next.js app source code - working implementation of Next.js 16, React 19, Tailwind v4, Recharts
- Express app source code - existing JWT auth with jose@6.1.3
- [Tailwind CSS v4 Next.js Guide](https://tailwindcss.com/docs/guides/nextjs) - official setup
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) - official cookie/JWT patterns
- [http-proxy-middleware GitHub](https://github.com/chimurai/http-proxy-middleware) - proxy configuration

### Secondary (MEDIUM confidence)

- [Tailwind CSS v4.0 Blog](https://tailwindcss.com/blog/tailwindcss-v4) - CSS-first config explanation
- [Next.js Middleware Authentication 2025](https://www.hashbuilds.com/articles/next-js-middleware-authentication-protecting-routes-in-2025) - middleware patterns
- [jose npm](https://www.npmjs.com/package/jose) - Edge Runtime JWT library
- [Recharts Custom Shape Bar Chart](https://recharts.github.io/en-US/examples/CustomShapeBarChart/) - custom bar shapes

### Tertiary (LOW confidence)

- WebSearch results on pixel CSS techniques - need validation in implementation
- Next.js 16 changes (proxy.js) - may not apply to 15.1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Chris's app provides working reference, versions verified
- Architecture: HIGH - Patterns verified in official docs and existing codebase
- Pitfalls: HIGH - Based on official Next.js docs and known API changes
- Pixel styling: MEDIUM - CSS techniques verified, integration with Recharts needs implementation testing

**Research date:** 2026-01-23
**Valid until:** 2026-02-23 (30 days - stable stack, well-documented)
