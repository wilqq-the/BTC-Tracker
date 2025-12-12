#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting BTC Tracker (PUID=$PUID, PGID=$PGID)"

# Check required env vars
[ -z "$DATABASE_URL" ] && echo "ERROR: DATABASE_URL required" && exit 1
[ -z "$NEXTAUTH_SECRET" ] && echo "ERROR: NEXTAUTH_SECRET required" && exit 1

# Setup writable cache in /tmp
setup_cache() {
    CACHE_DIR="/tmp/.cache-$(id -u)"
    mkdir -p "$CACHE_DIR" "$CACHE_DIR/npm" 2>/dev/null || true
    export HOME="$CACHE_DIR"
    export NPM_CONFIG_CACHE="$CACHE_DIR/npm"
}

# Setup database directory for SQLite
setup_db_dir() {
    if echo "$DATABASE_URL" | grep -q "^file:"; then
        DB_DIR=$(dirname "$(echo "$DATABASE_URL" | sed 's/^file://')")
        mkdir -p "$DB_DIR" 2>/dev/null || true
        [ "$1" = "chown" ] && chown -R nextjs:nodejs "$DB_DIR" 2>/dev/null || true
    fi
}

# Run migrations using our custom migration system
run_migrations() {
    echo "Running database migrations..."
    node /app/scripts/migrate.js
}

CURRENT_UID=$(id -u)

if [ "$CURRENT_UID" = "0" ]; then
    # Running as root - configure user and drop privileges
    [ "$PUID" != "1001" ] && usermod -u "$PUID" nextjs 2>/dev/null || true
    [ "$PGID" != "1001" ] && groupmod -g "$PGID" nodejs 2>/dev/null || true
    
    setup_db_dir "chown"
    chown -R nextjs:nodejs /app/data 2>/dev/null || true
    
    setup_cache
    su-exec nextjs sh -c "cd /app && HOME='$HOME' node /app/scripts/migrate.js" || true
    
    echo "Starting app as nextjs user..."
    exec su-exec nextjs npm run start:skip-migrate
else
    # Non-root (Umbrel etc)
    setup_db_dir
    mkdir -p /app/data 2>/dev/null || true
    
    setup_cache
    run_migrations
    
    echo "Starting app..."
    exec npm run start:skip-migrate
fi
