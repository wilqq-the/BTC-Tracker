# BTC Tracker - Multi-stage Docker build

FROM node:22.12.0-alpine3.21 AS deps
WORKDIR /app
RUN apk add --no-cache python3 py3-setuptools make g++ gcc musl-dev sqlite-dev
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
ENV DATABASE_URL="file:./build-dummy.db"
RUN npx prisma generate
ENV NODE_ENV="production"
RUN npm run build

# Automatically collect all transitive runtime dependencies of the prisma CLI.
# Reads each package's package.json recursively — no manual list to maintain.
# When prisma is upgraded, this stage picks up new deps automatically.
FROM deps AS prisma-runtime
COPY scripts/collect-prisma-deps.js /tmp/collect-prisma-deps.js
RUN node /tmp/collect-prisma-deps.js /app/node_modules /prisma-runtime/node_modules

FROM node:22.12.0-alpine3.21 AS runner
WORKDIR /app
ENV NODE_ENV="production"

RUN apk add --no-cache su-exec sqlite
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone-Output: server.js + minimal node_modules (Next.js File-Tracing)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/data ./src/data

# Prisma generated client (produced by `prisma generate` in builder)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# All prisma CLI deps — collected automatically by prisma-runtime stage
COPY --from=prisma-runtime --chown=nextjs:nodejs /prisma-runtime/node_modules ./node_modules

# Prisma CLI symlink: must be a real symlink so __dirname resolves to
# prisma/build/ (where WASM engines live). Docker COPY would flatten it.
RUN mkdir -p /app/node_modules/.bin && ln -sf ../prisma/build/index.js /app/node_modules/.bin/prisma

RUN chmod +x ./scripts/docker-entrypoint.sh && \
    mkdir -p /app/data /app/data/uploads/avatars && \
    chown -R nextjs:nodejs /app/data && \
    chmod -R 755 /app/node_modules

EXPOSE 3000
ENV PORT="3000"
ENV HOSTNAME="0.0.0.0"

USER root
CMD ["./scripts/docker-entrypoint.sh"]
