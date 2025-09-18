#!/bin/sh
set -e

echo "[INIT] Starting BTC Tracker..."

# Validate required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "[ERROR] DATABASE_URL environment variable is required"
    exit 1
fi

if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "[ERROR] NEXTAUTH_SECRET environment variable is required"
    exit 1
fi

echo "[INFO] Database URL: $DATABASE_URL"

# For file-based databases, ensure directory exists
if echo "$DATABASE_URL" | grep -q "^file:"; then
    DB_PATH=$(echo "$DATABASE_URL" | sed 's/^file://')
    DB_DIR=$(dirname "$DB_PATH")
    
    echo "[INFO] Ensuring database directory exists: $DB_DIR"
    mkdir -p "$DB_DIR" || echo "[WARN] Could not create directory (may already exist)"
fi

# Setup database schema (Prisma client already generated at build time)
echo "[DB] Setting up database schema..."
npx prisma db push --skip-generate

# Start the application
echo "[START] Starting Next.js application..."
exec node server.js
