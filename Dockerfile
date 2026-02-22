# BTC Tracker - Multi-stage Docker build

FROM node:22.12.0-alpine3.21 AS deps
WORKDIR /app
RUN apk add --no-cache python3 py3-setuptools make g++ gcc musl-dev sqlite-dev
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22.12.0-alpine3.21 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:./build-dummy.db"
RUN npx prisma generate
ENV NODE_ENV="production"
RUN npm run build

FROM node:22.12.0-alpine3.21 AS runner
WORKDIR /app
ENV NODE_ENV="production"

RUN apk add --no-cache su-exec sqlite
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output: self-contained server + traced minimal node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/data ./src/data

# Prisma CLI + client are called via npx at runtime (not traced by standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

RUN chmod +x ./scripts/docker-entrypoint.sh && \
    mkdir -p /app/data /app/data/uploads/avatars && \
    chown -R nextjs:nodejs /app/data && \
    chmod -R 755 /app/node_modules

EXPOSE 3000
ENV PORT="3000"
ENV HOSTNAME="0.0.0.0"

USER root
CMD ["./scripts/docker-entrypoint.sh"]
