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
    sqlite-dev
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
# Install build dependencies for Prisma generation
RUN apk add --no-cache python3 py3-setuptools make g++ gcc musl-dev sqlite-dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Set environment variables for build process
ENV DATABASE_URL="file:../bitcoin-tracker.db"
ENV NODE_ENV="production"

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV="production"
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

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

# Copy Prisma files and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy database and scripts for initialization
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/data ./src/data

# Create directory for SQLite database and uploads
RUN mkdir -p /app/public/uploads/avatars
RUN chown -R nextjs:nodejs /app/public/uploads

# Ensure the nextjs user can write to the app directory for database
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT="3000"
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"] 