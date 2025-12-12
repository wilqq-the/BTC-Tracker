# BTC Tracker - Multi-stage Docker build

FROM node:22.12.0-alpine3.21 AS deps
WORKDIR /app
RUN apk add --no-cache python3 py3-setuptools make g++ gcc musl-dev sqlite-dev
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22.12.0-alpine3.21 AS builder
WORKDIR /app
RUN apk add --no-cache python3 py3-setuptools make g++ gcc musl-dev sqlite-dev
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

COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/data ./src/data

RUN chmod +x ./scripts/docker-entrypoint.sh && \
    mkdir -p /app/data /app/data/uploads/avatars && \
    chown -R nextjs:nodejs /app/data && \
    chmod -R 755 /app/node_modules

EXPOSE 3000
ENV PORT="3000"
ENV HOSTNAME="0.0.0.0"

USER root
CMD ["./scripts/docker-entrypoint.sh"]