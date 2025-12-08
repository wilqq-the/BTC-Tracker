#!/bin/sh
# Production-safe migration script for BTC Tracker
# Handles: fresh installs, normal upgrades, legacy database baselining, and error recovery
# 
# Based on Prisma best practices:
# - https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
# - https://www.prisma.io/docs/guides/migrate/production-troubleshooting
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

# Function to check if a column exists in a table
column_exists() {
    sqlite3 "$DB_PATH" "PRAGMA table_info($1);" 2>/dev/null | grep -q "$2"
}

# Function to get list of all migrations in chronological order
get_all_migrations() {
    MIGRATIONS_DIR="/app/prisma/migrations"
    for migration_dir in $(ls -d "$MIGRATIONS_DIR"/*/ 2>/dev/null | sort); do
        migration_name=$(basename "$migration_dir")
        if [ -f "$migration_dir/migration.sql" ]; then
            echo "$migration_name"
        fi
    done
}

# Function to mark a migration as applied (with error handling)
mark_applied() {
    migration_name="$1"
    echo "[MIGRATE] Marking as applied: $migration_name"
    if ! npx prisma migrate resolve --applied "$migration_name" 2>/dev/null; then
        echo "[MIGRATE] Warning: Could not mark $migration_name as applied (may already be marked)"
    fi
}

# Function to run migrations with automatic error recovery
# Handles P3018 "table already exists" errors by marking migrations as applied
run_migrations_with_recovery() {
    MAX_RETRIES=10
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        echo "[MIGRATE] Running prisma migrate deploy (attempt $((RETRY_COUNT + 1)))..."
        
        # Capture both stdout and stderr
        OUTPUT=$(npx prisma migrate deploy 2>&1) && {
            echo "$OUTPUT"
            echo "[MIGRATE] Migrations completed successfully"
            return 0
        }
        
        # Check if it's a P3018 error (table/index already exists)
        if echo "$OUTPUT" | grep -q "P3018"; then
            # Extract the failed migration name
            FAILED_MIGRATION=$(echo "$OUTPUT" | grep "Migration name:" | sed 's/.*Migration name: //' | tr -d '[:space:]')
            
            if [ -n "$FAILED_MIGRATION" ]; then
                echo "[MIGRATE] Migration $FAILED_MIGRATION failed because objects already exist"
                echo "[MIGRATE] This typically means the migration was already applied to the database"
                echo "[MIGRATE] Marking as applied and continuing..."
                
                # Mark as applied (this tells Prisma the migration is complete)
                npx prisma migrate resolve --applied "$FAILED_MIGRATION" 2>/dev/null || true
                
                RETRY_COUNT=$((RETRY_COUNT + 1))
                continue
            fi
        fi
        
        # Not a recoverable error - print output and fail
        echo "$OUTPUT"
        echo "[MIGRATE] ERROR: Migration failed with unrecoverable error"
        return 1
    done
    
    echo "[MIGRATE] ERROR: Too many migration retries ($MAX_RETRIES)"
    return 1
}

# Function to baseline legacy database by detecting which migrations are already applied
# This checks actual database state (tables/columns) to determine what's present
baseline_legacy_database() {
    echo "[MIGRATE] Analyzing database schema to determine applied migrations..."
    
    # First, create the migrations table by marking the initial schema
    # This MUST be done first as it creates _prisma_migrations table
    echo "[MIGRATE] Creating migration history table..."
    mark_applied "20250623085038_initial_schema"
    
    # Now detect and mark other migrations in CHRONOLOGICAL ORDER
    # This is critical - migrations must be marked in order!
    
    # Migration: 20250915183939_add_user_isolation
    # Adds user_id column to bitcoin_transactions, app_settings, custom_currencies, portfolio_summary
    if column_exists "bitcoin_transactions" "user_id"; then
        mark_applied "20250915183939_add_user_isolation"
    fi
    
    # Migration: 20250916071210_add_admin_fields  
    # Adds is_admin and is_active columns to users table
    if column_exists "users" "is_admin"; then
        mark_applied "20250916071210_add_admin_fields"
    fi
    
    # Migration: 20251010112742_add_transaction_tags
    # Adds tags column to bitcoin_transactions
    if column_exists "bitcoin_transactions" "tags"; then
        mark_applied "20251010112742_add_transaction_tags"
    fi
    
    # Migration: 20251010122914_add_goals
    # Creates goals table
    if table_exists "goals"; then
        mark_applied "20251010122914_add_goals"
    fi
    
    # Migration: 20251010124310_add_scenario_to_goals
    # Adds price_scenario, scenario_growth_rate, etc. to goals
    if column_exists "goals" "price_scenario"; then
        mark_applied "20251010124310_add_scenario_to_goals"
    fi
    
    # Migration: 20251013085253_add_dashboard_layout
    # Creates dashboard_layouts TABLE (not a column!)
    if table_exists "dashboard_layouts"; then
        mark_applied "20251013085253_add_dashboard_layout"
    fi
    
    # Migration: 20251107000000_add_transfer_and_cold_wallet_fields
    # Adds transfer_type to bitcoin_transactions, cold_wallet_btc to portfolio_summary
    if column_exists "bitcoin_transactions" "transfer_type"; then
        mark_applied "20251107000000_add_transfer_and_cold_wallet_fields"
    fi
    
    # Migration: 20251107213701_add_recurring_transactions
    # Creates recurring_transactions table
    if table_exists "recurring_transactions"; then
        mark_applied "20251107213701_add_recurring_transactions"
    fi
    
    # Migration: 20251207000000_add_two_factor_auth
    # Adds two_factor_secret, two_factor_enabled, two_factor_backup_codes to users
    if column_exists "users" "two_factor_secret"; then
        mark_applied "20251207000000_add_two_factor_auth"
    fi
    
    echo "[MIGRATE] Schema analysis complete"
}

# Function to handle existing database with migration history that may have failed migrations
handle_existing_migrations() {
    # Check for failed migrations (finished_at is NULL means it didn't complete)
    FAILED=$(sqlite3 "$DB_PATH" "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL LIMIT 1;" 2>/dev/null || echo "")
    
    if [ -n "$FAILED" ]; then
        echo "[MIGRATE] Found failed/incomplete migration: $FAILED"
        echo "[MIGRATE] Checking if migration artifacts exist in database..."
        
        # Instead of blindly marking as applied, we'll let the recovery mechanism handle it
        # This is safer as it will properly detect if the migration needs to be completed
        echo "[MIGRATE] Will attempt to complete or skip during migration..."
    fi
}

# =============================================================================
# MAIN LOGIC
# =============================================================================

if [ ! -f "$DB_PATH" ]; then
    # CASE 1: Fresh install - no database exists
    echo "[MIGRATE] Fresh install detected - creating database..."
    npx prisma migrate deploy
    echo "[MIGRATE] Database created successfully"
    
elif table_exists "_prisma_migrations"; then
    # CASE 2: Existing database with migration history
    echo "[MIGRATE] Existing database with migration history detected"
    
    handle_existing_migrations
    
    # Run migrations with automatic error recovery
    run_migrations_with_recovery
    echo "[MIGRATE] Migrations complete"
    
else
    # CASE 3: Legacy database - has data but no migration history
    # This is the baselining scenario (P3005)
    echo "[MIGRATE] Legacy database detected (no migration history)"
    
    # Verify this is actually a BTC Tracker database
    if table_exists "users" || table_exists "bitcoin_transactions"; then
        echo "[MIGRATE] Verified as BTC Tracker database - baselining..."
        
        # Analyze schema and mark appropriate migrations as applied
        baseline_legacy_database
        
        # Now run any remaining migrations with error recovery
        echo "[MIGRATE] Applying any remaining migrations..."
        run_migrations_with_recovery
        echo "[MIGRATE] Legacy database upgraded successfully"
    else
        # Unknown database structure
        echo "[MIGRATE] WARNING: Database exists but doesn't appear to be a BTC Tracker database"
        echo "[MIGRATE] Found tables:"
        sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "  (unable to query)"
        echo "[MIGRATE] Attempting standard migration..."
        npx prisma migrate deploy || {
            echo "[MIGRATE] ERROR: Migration failed. Database may be corrupted or incompatible."
            echo "[MIGRATE] Consider backing up and removing: $DB_PATH"
            exit 1
        }
    fi
fi

# Final verification - check migration status
echo "[MIGRATE] Verifying migration status..."
npx prisma migrate status 2>/dev/null || true

echo "[MIGRATE] Database ready"
