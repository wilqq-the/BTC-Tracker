# Use the official Node.js runtime as the base image
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Install build dependencies for native modules like sqlite3
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    py3-setuptools \
    make \
    g++ \
    gcc \
    musl-dev \
    sqlite-dev \
    su-exec
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
# Install build dependencies for Prisma generation
RUN apk add --no-cache python3 py3-setuptools make g++ gcc musl-dev sqlite-dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build process  
ENV NODE_ENV="production"
# Use dummy DATABASE_URL for build - will be overridden at runtime
ENV DATABASE_URL="file:./build-dummy.db"

# Generate Prisma client for build process
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV="production"
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

# Install su-exec for secure user switching in entrypoint script
RUN apk add --no-cache su-exec

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema for runtime generation
COPY --from=builder /app/prisma ./prisma
# NOTE: Prisma CLI will be auto-downloaded by npx at runtime (cached in /tmp/.npm)
# This is simpler and more reliable than trying to copy all dependencies

# Copy database and scripts for initialization
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/data ./src/data

# Make entrypoint scripts executable
RUN chmod +x ./scripts/docker-entrypoint.sh

# Note: Prisma client is already generated at build time
# The SQLite driver is embedded, so different file paths work without regeneration

# Create directories for SQLite database and uploads
RUN mkdir -p /app/public/uploads/avatars /app/data
RUN chown -R nextjs:nodejs /app/public/uploads /app/data

# Ensure the nextjs user can write to the app directory for database
RUN chown -R nextjs:nodejs /app

EXPOSE 3000

ENV PORT="3000"
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# Run as root initially to allow entrypoint script to handle permission setup
# The entrypoint will drop privileges appropriately based on environment
USER root

# Use entrypoint script for dynamic database setup
CMD ["./scripts/docker-entrypoint.sh"] 