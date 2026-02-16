# Stage 1: Base image with telemetry disabled
FROM node:20-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1

# Stage 2: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 3: Build Next.js with standalone output
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 4: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copy standalone build output
# outputFileTracingRoot in next.config.ts points to parent dir, so standalone
# output nests under /app/.next/standalone/app/ instead of /app/.next/standalone/
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/app ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Critical: Listen on all interfaces for Docker networking
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
