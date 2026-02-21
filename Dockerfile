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

# Prisma generated client (built during `prisma generate` in builder)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Prisma CLI package (contains WASM engines in build/ dir)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# All @prisma/* scoped packages (engines, config, debug, fetch-engine, get-platform, engines-version)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# @standard-schema (peer dep of @prisma/config)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@standard-schema ./node_modules/@standard-schema

# effect + its runtime deps (required by @prisma/config)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/effect ./node_modules/effect
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pure-rand ./node_modules/pure-rand

# c12 (config loader, required by @prisma/config) + its transitive deps
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/c12 ./node_modules/c12
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/chokidar ./node_modules/chokidar
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/citty ./node_modules/citty
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/confbox ./node_modules/confbox
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/consola ./node_modules/consola
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/defu ./node_modules/defu
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/destr ./node_modules/destr
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/exsolve ./node_modules/exsolve
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/giget ./node_modules/giget
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/jiti ./node_modules/jiti
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/node-fetch-native ./node_modules/node-fetch-native
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/nypm ./node_modules/nypm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/ohash ./node_modules/ohash
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pathe ./node_modules/pathe
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/rc9 ./node_modules/rc9
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/readdirp ./node_modules/readdirp
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/tinyexec ./node_modules/tinyexec

# Other @prisma/config deps
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/empathic ./node_modules/empathic

# Prisma CLI symlink: preserve so __dirname resolves to prisma/build/ (where WASM files live)
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
