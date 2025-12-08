#!/bin/sh
# Production-safe migration script for BTC Tracker
# Handles: fresh installs, normal upgrades, and legacy database baselining
set -e

echo "[MIGRATE] Starting database migration check..."

# Get database path from DATABASE_URL
DB_URL="${DATABASE_URL:-file:/app/data/bitcoin-tracker.db}"
DB_PATH=$(echo "$DB_URL" | sed 's/^file://')
DB_DIR=$(dirname "$DB_PATH")

# Ensure database directory exists
mkdir -p "$DB_DIR" 2>/dev/null || true

# Function to check if a table exists in SQLite
table_exists() {
    sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='$1';" 2>/dev/null | grep -q "$1"
}

# Function to baseline all migrations (mark as applied without running)
baseline_migrations() {
    echo "[MIGRATE] Baselining existing database..."
    
    # Get list of all migrations from the migrations directory
    MIGRATIONS_DIR="/app/prisma/migrations"
    
    for migration_dir in "$MIGRATIONS_DIR"/*/; do
        if [ -d "$migration_dir" ]; then
            migration_name=$(basename "$migration_dir")
            # Skip if it's not a valid migration directory (has migration.sql)
            if [ -f "$migration_dir/migration.sql" ]; then
                echo "[MIGRATE] Marking as applied: $migration_name"
                npx prisma migrate resolve --applied "$migration_name" 2>/dev/null || true
            fi
        fi
    done
    
    echo "[MIGRATE] Baseline complete"
}

# Check database state
if [ ! -f "$DB_PATH" ]; then
    # CASE 1: Fresh install - no database exists
    echo "[MIGRATE] Fresh install detected - creating database..."
    npx prisma migrate deploy
    echo "[MIGRATE] Database created successfully"
    
elif table_exists "_prisma_migrations"; then
    # CASE 2: Normal upgrade - migrations table exists
    echo "[MIGRATE] Existing database with migration history detected"
    
    # Check for failed migrations
    FAILED=$(sqlite3 "$DB_PATH" "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL LIMIT 1;" 2>/dev/null || echo "")
    
    if [ -n "$FAILED" ]; then
        echo "[MIGRATE] Found failed migration: $FAILED"
        echo "[MIGRATE] Attempting to mark as applied and retry..."
        npx prisma migrate resolve --applied "$FAILED" 2>/dev/null || true
    fi
    
    # Run pending migrations
    echo "[MIGRATE] Running pending migrations..."
    npx prisma migrate deploy
    echo "[MIGRATE] Migrations complete"
    
else
    # CASE 3: Legacy database - has data but no migration history
    # This is the P3005 scenario
    echo "[MIGRATE] Legacy database detected (no migration history)"
    
    # Check if this is actually a BTC Tracker database by looking for known tables
    if table_exists "users" || table_exists "bitcoin_transactions"; then
        echo "[MIGRATE] Verified as BTC Tracker database - baselining..."
        
        # First, we need to create the migrations table
        # Running migrate deploy will fail, but we can use resolve to create the table
        # and mark migrations as applied
        
        # Try to determine which migrations are already in the schema
        # by checking for columns/tables that each migration adds
        
        # Start by marking the initial schema as applied (this creates _prisma_migrations table)
        echo "[MIGRATE] Creating migration history table..."
        npx prisma migrate resolve --applied "20250623085038_initial_schema" 2>/dev/null || true
        
        # Check for user isolation (added userId to various tables)
        if sqlite3 "$DB_PATH" "PRAGMA table_info(bitcoin_transactions);" 2>/dev/null | grep -q "userId"; then
            npx prisma migrate resolve --applied "20250915183939_add_user_isolation" 2>/dev/null || true
        fi
        
        # Check for admin fields
        if sqlite3 "$DB_PATH" "PRAGMA table_info(users);" 2>/dev/null | grep -q "isAdmin"; then
            npx prisma migrate resolve --applied "20250916071210_add_admin_fields" 2>/dev/null || true
        fi
        
        # Check for transaction tags
        if sqlite3 "$DB_PATH" "PRAGMA table_info(bitcoin_transactions);" 2>/dev/null | grep -q "tags"; then
            npx prisma migrate resolve --applied "20251010112742_add_transaction_tags" 2>/dev/null || true
        fi
        
        # Check for goals table
        if table_exists "goals"; then
            npx prisma migrate resolve --applied "20251010122914_add_goals" 2>/dev/null || true
        fi
        
        # Check for scenario field in goals
        if sqlite3 "$DB_PATH" "PRAGMA table_info(goals);" 2>/dev/null | grep -q "scenario"; then
            npx prisma migrate resolve --applied "20251010124310_add_scenario_to_goals" 2>/dev/null || true
        fi
        
        # Check for dashboard layout
        if sqlite3 "$DB_PATH" "PRAGMA table_info(users);" 2>/dev/null | grep -q "dashboardLayout"; then
            npx prisma migrate resolve --applied "20251013085253_add_dashboard_layout" 2>/dev/null || true
        fi
        
        # Check for transfer fields
        if sqlite3 "$DB_PATH" "PRAGMA table_info(bitcoin_transactions);" 2>/dev/null | grep -q "transfer_type"; then
            npx prisma migrate resolve --applied "20251107000000_add_transfer_and_cold_wallet_fields" 2>/dev/null || true
        fi
        
        # Check for recurring transactions table
        if table_exists "recurring_transactions"; then
            npx prisma migrate resolve --applied "20251107213701_add_recurring_transactions" 2>/dev/null || true
        fi
        
        # Check for 2FA fields
        if sqlite3 "$DB_PATH" "PRAGMA table_info(users);" 2>/dev/null | grep -q "two_factor_secret"; then
            npx prisma migrate resolve --applied "20251207000000_add_two_factor_auth" 2>/dev/null || true
        fi
        
        # Now run any remaining migrations that weren't applied
        echo "[MIGRATE] Running remaining migrations..."
        npx prisma migrate deploy
        echo "[MIGRATE] Legacy database upgraded successfully"
    else
        # Unknown database - might be corrupted or wrong file
        echo "[MIGRATE] WARNING: Database exists but doesn't appear to be a BTC Tracker database"
        echo "[MIGRATE] Attempting standard migration..."
        npx prisma migrate deploy || {
            echo "[MIGRATE] ERROR: Migration failed. Database may be corrupted."
            echo "[MIGRATE] Consider backing up and removing: $DB_PATH"
            exit 1
        }
    fi
fi

echo "[MIGRATE] Database ready"
