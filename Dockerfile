# Stage 1: Dependencies (includes native build tools for argon2)
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Build TypeScript and generate Prisma client
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressuser
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=expressuser:nodejs /app/dist ./dist
COPY --from=builder --chown=expressuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressuser:nodejs /app/package.json ./
COPY --from=builder --chown=expressuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=expressuser:nodejs /app/public ./public
USER expressuser
EXPOSE 80
CMD ["node", "dist/index.js"]
