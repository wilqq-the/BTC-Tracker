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

# Check if we're running as root
CURRENT_UID=$(id -u)
echo "[INFO] Current UID: $CURRENT_UID"

# Only attempt user/group modifications if running as root
if [ "$CURRENT_UID" = "0" ]; then
    echo "[ROOT] Running as root, setting up permissions..."
    
    # Modify user/group IDs if they differ from defaults
    if [ "$PUID" != "1001" ]; then
        echo "[PUID] Updating user ID to $PUID"
        usermod -u "$PUID" nextjs 2>/dev/null || true
    fi

    if [ "$PGID" != "1001" ]; then
        echo "[PGID] Updating group ID to $PGID"
        groupmod -g "$PGID" nodejs 2>/dev/null || true
    fi
    
    # For file-based databases, ensure directory exists and is writable
    if echo "$DATABASE_URL" | grep -q "^file:"; then
        DB_PATH=$(echo "$DATABASE_URL" | sed 's/^file://')
        DB_DIR=$(dirname "$DB_PATH")
        
        echo "[INFO] Ensuring database directory exists: $DB_DIR"
        mkdir -p "$DB_DIR" 2>/dev/null || true
        
        # Fix ownership with dynamic PUID/PGID
        chown -R nextjs:nodejs "$DB_DIR" 2>/dev/null || true
        chmod -R 755 "$DB_DIR" 2>/dev/null || true
        
        echo "[OK] Database directory ready: $DB_DIR"
    fi
    
    # Fix ownership of app directory and data directories
    echo "[PUID] Fixing ownership of application directories..."
    chown -R nextjs:nodejs /app/data /app/public/uploads 2>/dev/null || true
    
    # Setup npm cache directory for the target user
    export NPM_CONFIG_CACHE="/tmp/.npm"
    mkdir -p "$NPM_CONFIG_CACHE" 2>/dev/null || true
    chown -R nextjs:nodejs "$NPM_CONFIG_CACHE" 2>/dev/null || true
    
    echo "[DB] Setting up database schema..."
    su-exec nextjs npx prisma db push --skip-generate
    
    echo "[START] Starting Next.js application as user $(id -u nextjs):$(id -g nextjs)"
    exec su-exec nextjs node server.js
else
    # Not running as root - probably Umbrel or similar orchestrator
    echo "[USER] Running as non-root user (UID: $CURRENT_UID)"
    
    # For file-based databases, ensure directory exists (don't try to chown)
    if echo "$DATABASE_URL" | grep -q "^file:"; then
        DB_PATH=$(echo "$DATABASE_URL" | sed 's/^file://')
        DB_DIR=$(dirname "$DB_PATH")
        
        echo "[INFO] Ensuring database directory exists: $DB_DIR"
        mkdir -p "$DB_DIR" 2>/dev/null || echo "[WARN] Could not create directory (may already exist)"
        echo "[OK] Database directory ready: $DB_DIR"
    fi
    
    # Ensure data directories exist (orchestrator should handle permissions)
    mkdir -p /app/data /app/public/uploads 2>/dev/null || true
    
    # Use /tmp for npm cache (user-writable)
    export NPM_CONFIG_CACHE="/tmp/.npm-$(id -u)"
    export npm_config_cache="$NPM_CONFIG_CACHE"
    mkdir -p "$NPM_CONFIG_CACHE" 2>/dev/null || true
    
    echo "[DB] Setting up database schema..."
    npx prisma db push --skip-generate || echo "[WARN] Database setup failed, may need manual migration"
    
    echo "[START] Starting Next.js application as current user"
    exec node server.js
fi
