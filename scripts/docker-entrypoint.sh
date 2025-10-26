#!/bin/sh
set -e

# PUID/PGID Pattern - Industry standard for homelab/self-hosted apps
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "[INIT] Starting BTC Tracker with PUID=$PUID and PGID=$PGID"

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

# Modify user/group IDs if they differ from defaults
if [ "$PUID" != "1000" ]; then
    echo "[PUID] Updating user ID to $PUID"
    usermod -u "$PUID" nextjs 2>/dev/null || true
fi

if [ "$PGID" != "1000" ]; then
    echo "[PGID] Updating group ID to $PGID"
    groupmod -g "$PGID" nodejs 2>/dev/null || true
fi

# For file-based databases, ensure directory exists and is writable
if echo "$DATABASE_URL" | grep -q "^file:"; then
    DB_PATH=$(echo "$DATABASE_URL" | sed 's/^file://')
    DB_DIR=$(dirname "$DB_PATH")
    
    echo "[INFO] Ensuring database directory exists: $DB_DIR"
    mkdir -p "$DB_DIR" || echo "[WARN] Could not create directory (may already exist)"
    
    # Fix ownership with dynamic PUID/PGID
    chown -R nextjs:nodejs "$DB_DIR" 2>/dev/null || echo "[WARN] Could not change ownership"
    chmod 755 "$DB_DIR" 2>/dev/null || echo "[WARN] Could not change permissions"
    
    echo "[OK] Database directory ready: $DB_DIR"
fi

# Fix ownership of app directory and data directories
echo "[PUID] Fixing ownership of application directories..."
chown -R nextjs:nodejs /app/data /app/public/uploads 2>/dev/null || true

# Setup database schema (Prisma client already generated at build time)
echo "[DB] Setting up database schema..."
npx prisma db push --skip-generate

# Fix npm cache ownership (prevents EACCES errors during runtime)
echo "[NPM] Fixing npm cache ownership..."
chown -R nextjs:nodejs /tmp/.npm 2>/dev/null || true
mkdir -p /root/.npm && chown -R nextjs:nodejs /root/.npm 2>/dev/null || true

echo "[START] Starting Next.js application as user $(id -u nextjs):$(id -g nextjs)"

# Switch to app user and start the application
exec su-exec nextjs node server.js
