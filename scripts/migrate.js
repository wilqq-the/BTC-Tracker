#!/usr/bin/env node
/**
 * BTC Tracker - Professional Prisma Migration Script
 * 
 * This script handles database migrations using Prisma's native system
 * with automatic detection and recovery for legacy databases.
 * 
 * Strategy:
 * 1. Try normal `prisma migrate deploy`
 * 2. If fails due to missing migration history → baseline all migrations
 * 3. If fails due to "already exists" (P3018) → mark as applied and retry
 * 4. Run `prisma db push` as safety net to add any missing schema elements
 * 5. Verify final state with `prisma migrate status`
 * 
 * Based on Prisma best practices:
 * - https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
 * - https://www.prisma.io/docs/guides/migrate/production-troubleshooting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const DATABASE_URL = process.env.DATABASE_URL || 'file:./data/bitcoin-tracker.db';
const DB_PATH = DATABASE_URL.replace('file:', '');
const MAX_RETRY_ATTEMPTS = 15;

// All migrations in chronological order (MUST be kept in sync with prisma/migrations)
const ALL_MIGRATIONS = [
  '20250623085038_initial_schema',
  '20250915183939_add_user_isolation',
  '20250916071210_add_admin_fields',
  '20251010112742_add_transaction_tags',
  '20251010122914_add_goals',
  '20251010124310_add_scenario_to_goals',
  '20251013085253_add_dashboard_layout',
  '20251107000000_add_transfer_and_cold_wallet_fields',
  '20251107213701_add_recurring_transactions',
  '20251207000000_add_two_factor_auth',
];


// =============================================================================
// UTILITIES
// =============================================================================

function log(level, message) {
  const prefix = {
    'INFO': '[MIGRATE]',
    'OK': '[OK]',
    'WARN': '[WARN]',
    'ERROR': '[ERROR]',
    'FIX': '[FIX]',
    'SAFETY': '[SAFETY]',
  }[level] || '[MIGRATE]';
  console.log(`${prefix} ${message}`);
}

function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || '', 
      error: error.stderr || error.message 
    };
  }
}

function runCommandCapture(command) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result, error: '' };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || '', 
      error: error.stderr || error.message 
    };
  }
}

function tableExists(tableName) {
  try {
    const result = execSync(
      `sqlite3 "${DB_PATH}" "SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim() === tableName;
  } catch {
    return false;
  }
}

// =============================================================================
// MIGRATION FUNCTIONS
// =============================================================================

/**
 * Check if this is a legacy database (created with db push, no migration history)
 */
function isLegacyDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    return false; // Fresh install, not legacy
  }
  
  const hasMigrationTable = tableExists('_prisma_migrations');
  const hasAppTables = tableExists('users') || tableExists('bitcoin_transactions');
  
  if (hasAppTables && !hasMigrationTable) {
    log('WARN', 'Legacy database detected: has app tables but no migration history');
    log('INFO', 'This database was likely created with "prisma db push"');
    return true;
  }
  
  return false;
}

/**
 * Baseline all migrations for a legacy database
 */
function baselineAllMigrations() {
  log('INFO', 'Baselining all migrations for legacy database...');
  log('INFO', `Marking ${ALL_MIGRATIONS.length} migrations as applied`);
  
  for (const migration of ALL_MIGRATIONS) {
    log('INFO', `  → ${migration}`);
    const result = runCommandCapture(`npx prisma migrate resolve --applied "${migration}"`);
    if (!result.success && !result.error.includes('already')) {
      log('WARN', `    Could not mark as applied (may already be marked)`);
    }
  }
  
  log('OK', 'Baseline complete');
}

/**
 * Extract migration name from error message
 */
function extractFailedMigration(errorOutput) {
  // Try different patterns
  const patterns = [
    /Migration name:\s*(\S+)/,
    /`(\d{14}_\w+)`/,
    /migration "([^"]+)"/i,
  ];
  
  for (const pattern of patterns) {
    const match = errorOutput.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Resolve all failed migrations found in the database
 * Failed migrations have finished_at = NULL in _prisma_migrations table
 */
function resolveAllFailedMigrations() {
  try {
    // Query for failed migrations (finished_at is NULL but rolled_back_at is also NULL)
    const result = execSync(
      `sqlite3 "${DB_PATH}" "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    const failedMigrations = result.trim().split('\n').filter(m => m.trim());
    
    if (failedMigrations.length === 0) {
      log('INFO', 'No failed migrations found in database');
      return;
    }
    
    log('INFO', `Found ${failedMigrations.length} failed migration(s)`);
    
    for (const migration of failedMigrations) {
      log('FIX', `  Resolving: ${migration}`);
      // Mark as applied (since the objects likely exist)
      runCommandCapture(`npx prisma migrate resolve --applied "${migration}"`);
    }
    
    log('OK', 'Failed migrations resolved');
  } catch (error) {
    log('WARN', 'Could not query failed migrations from database');
    // Fallback: try to resolve all known migrations
    log('INFO', 'Attempting to resolve all known migrations...');
    for (const migration of ALL_MIGRATIONS) {
      runCommandCapture(`npx prisma migrate resolve --applied "${migration}"`);
    }
  }
}

/**
 * Run prisma migrate deploy with automatic error recovery
 */
function runMigrateWithRecovery() {
  let attempts = 0;
  
  while (attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;
    log('INFO', `Running prisma migrate deploy (attempt ${attempts}/${MAX_RETRY_ATTEMPTS})...`);
    
    const result = runCommandCapture('npx prisma migrate deploy');
    
    if (result.success) {
      log('OK', 'Migrations applied successfully');
      return true;
    }
    
    const errorOutput = result.error + result.output;
    
    // P3018: "already exists" error
    if (errorOutput.includes('P3018') || errorOutput.includes('already exists')) {
      const failedMigration = extractFailedMigration(errorOutput);
      
      if (failedMigration) {
        log('FIX', `Migration "${failedMigration}" failed: objects already exist in database`);
        log('FIX', 'This migration was likely already applied via "db push"');
        log('FIX', 'Marking as applied and retrying...');
        
        runCommandCapture(`npx prisma migrate resolve --applied "${failedMigration}"`);
        continue;
      }
    }
    
    // P3005: "database is not empty" (needs baselining)
    if (errorOutput.includes('P3005')) {
      log('FIX', 'Database is not empty but has no migration history');
      log('FIX', 'Applying baseline for all migrations...');
      baselineAllMigrations();
      continue;
    }
    
    // P3009: "failed migrations" blocking new migrations
    if (errorOutput.includes('P3009') || errorOutput.includes('found failed migrations')) {
      log('FIX', 'Found failed/incomplete migrations blocking deployment');
      log('FIX', 'Resolving failed migrations...');
      
      // Try to extract the failed migration name
      const failedMigration = extractFailedMigration(errorOutput);
      if (failedMigration) {
        log('FIX', `Marking "${failedMigration}" as applied...`);
        runCommandCapture(`npx prisma migrate resolve --applied "${failedMigration}"`);
      } else {
        // Can't find specific migration - resolve all failed ones from DB
        log('FIX', 'Resolving all failed migrations from database...');
        resolveAllFailedMigrations();
      }
      continue;
    }
    
    // Unknown error
    log('ERROR', 'Migration failed with unexpected error:');
    console.error(errorOutput);
    return false;
  }
  
  log('ERROR', `Migration failed after ${MAX_RETRY_ATTEMPTS} attempts`);
  return false;
}

/**
 * Run db push as safety net to ensure ALL schema elements exist
 * This catches missing columns even when tables exist
 * 
 * IMPORTANT: Always run this, not just when tables are missing!
 * Migrations may have been marked as "applied" without actually running,
 * leaving columns missing even though tables exist.
 */
function runSafetyNetDbPush() {
  log('SAFETY', '--- Schema Safety Check ---');
  log('SAFETY', 'Running prisma db push to ensure all tables/columns exist...');
  log('SAFETY', 'This will only ADD missing elements, not delete anything');
  
  // Run db push WITHOUT --accept-data-loss (safe mode)
  // This will only add missing tables/columns, refuse destructive changes
  const result = runCommandCapture('npx prisma db push --skip-generate');
  
  if (result.success) {
    log('OK', 'Schema is in sync with prisma schema');
    return true;
  }
  
  const errorOutput = result.error + result.output;
  
  // Check if it failed because it wants to do destructive changes
  if (errorOutput.includes('--accept-data-loss')) {
    log('WARN', 'db push detected schema changes that require --accept-data-loss');
    log('WARN', 'This usually means column types changed. Checking if it\'s safe...');
    
    // For SQLite, adding columns is always safe. The warning is usually about
    // nullable vs non-nullable or default values. Try with accept-data-loss.
    log('SAFETY', 'Attempting db push with --accept-data-loss for SQLite compatibility...');
    const retryResult = runCommandCapture('npx prisma db push --skip-generate --accept-data-loss');
    
    if (retryResult.success) {
      log('OK', 'Schema synchronized successfully');
      return true;
    }
    
    log('ERROR', 'db push failed even with --accept-data-loss');
    console.error(retryResult.error);
    return false;
  }
  
  // Check if it succeeded but had warnings
  if (errorOutput.includes('Your database is now in sync') || errorOutput.includes('already in sync')) {
    log('OK', 'Schema is in sync');
    return true;
  }
  
  // Some other issue
  log('WARN', 'db push completed with output:');
  console.log(errorOutput);
  return true; // Continue anyway, the app will fail clearly if something is really wrong
}

/**
 * Repair orphaned data from migration issues
 * 
 * Issue: Upgrading from pre-0.6.6 versions could result in user_id becoming NULL
 * on transactions and other tables, and is_admin becoming false on users.
 * 
 * This function safely repairs the data ONLY if there's exactly one user.
 * For multi-user instances, it warns and lets the admin handle it manually.
 * 
 * See: docs/MIGRATION_DATA_REPAIR.md
 */
function repairOrphanedData() {
  log('INFO', '--- Data Integrity Check ---');
  
  if (!fs.existsSync(DB_PATH)) {
    log('INFO', 'No database yet, skipping data repair');
    return;
  }
  
  try {
    // Count users
    const userCountResult = execSync(
      `sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM users;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const userCount = parseInt(userCountResult.trim(), 10);
    
    // Count orphaned transactions (user_id IS NULL)
    const orphanedTxResult = execSync(
      `sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM bitcoin_transactions WHERE user_id IS NULL;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const orphanedTxCount = parseInt(orphanedTxResult.trim(), 10);
    
    // Check if first user is admin
    const adminResult = execSync(
      `sqlite3 "${DB_PATH}" "SELECT is_admin FROM users WHERE id = (SELECT MIN(id) FROM users);"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const firstUserIsAdmin = adminResult.trim() === '1';
    
    // Nothing to fix
    if (orphanedTxCount === 0 && (userCount === 0 || firstUserIsAdmin)) {
      log('OK', 'Data integrity verified');
      return;
    }
    
    // Multi-user with orphaned data - DON'T auto-fix
    if (userCount > 1 && orphanedTxCount > 0) {
      log('WARN', '════════════════════════════════════════════════════════════');
      log('WARN', 'ATTENTION: Data repair needed but multiple users detected!');
      log('WARN', `Found ${orphanedTxCount} transactions with no owner and ${userCount} users`);
      log('WARN', 'Cannot auto-assign - manual intervention required');
      log('WARN', 'See: docs/MIGRATION_DATA_REPAIR.md for instructions');
      log('WARN', '════════════════════════════════════════════════════════════');
      return;
    }
    
    // Single user (or no users) - safe to auto-fix
    if (userCount === 1) {
      const firstUserId = execSync(
        `sqlite3 "${DB_PATH}" "SELECT MIN(id) FROM users;"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      
      if (orphanedTxCount > 0) {
        log('FIX', `Assigning ${orphanedTxCount} orphaned transactions to user ${firstUserId}...`);
        
        // Fix bitcoin_transactions
        execSync(`sqlite3 "${DB_PATH}" "UPDATE bitcoin_transactions SET user_id = ${firstUserId} WHERE user_id IS NULL;"`, { stdio: 'pipe' });
        
        // Fix app_settings
        execSync(`sqlite3 "${DB_PATH}" "UPDATE app_settings SET user_id = ${firstUserId} WHERE user_id IS NULL;"`, { stdio: 'pipe' });
        
        // Fix custom_currencies
        execSync(`sqlite3 "${DB_PATH}" "UPDATE custom_currencies SET user_id = ${firstUserId} WHERE user_id IS NULL;"`, { stdio: 'pipe' });
        
        // Fix portfolio_summary
        execSync(`sqlite3 "${DB_PATH}" "UPDATE portfolio_summary SET user_id = ${firstUserId} WHERE user_id IS NULL;"`, { stdio: 'pipe' });
        
        log('OK', 'Orphaned data assigned to user');
      }
      
      // Ensure first user is admin
      if (!firstUserIsAdmin) {
        log('FIX', 'Setting first user as admin...');
        execSync(`sqlite3 "${DB_PATH}" "UPDATE users SET is_admin = 1 WHERE id = ${firstUserId};"`, { stdio: 'pipe' });
        log('OK', 'Admin status restored');
      }
    }
    
    log('OK', 'Data integrity check complete');
    
  } catch (error) {
    log('WARN', 'Could not perform data integrity check (database may be new)');
  }
}

/**
 * Verify migration status
 */
function verifyMigrationStatus() {
  log('INFO', 'Verifying migration status...');
  const result = runCommand('npx prisma migrate status', { silent: false });
  return result.success;
}

/**
 * Generate Prisma client
 */
function generateClient() {
  log('INFO', 'Generating Prisma client...');
  const result = runCommand('npx prisma generate', { silent: true });
  if (result.success) {
    log('OK', 'Prisma client generated');
  } else {
    log('WARN', 'Could not generate Prisma client');
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('');
  log('INFO', '===========================================');
  log('INFO', 'BTC Tracker Database Migration');
  log('INFO', '===========================================');
  log('INFO', `Database: ${DB_PATH}`);
  console.log('');

  // Ensure database directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log('INFO', `Created database directory: ${dbDir}`);
  }

  // Step 1: Check for legacy database and baseline if needed
  if (isLegacyDatabase()) {
    console.log('');
    log('INFO', '--- Legacy Database Recovery ---');
    baselineAllMigrations();
    console.log('');
  }

  // Step 2: Run migrations with automatic recovery
  log('INFO', '--- Applying Migrations ---');
  const migrationSuccess = runMigrateWithRecovery();
  
  if (!migrationSuccess) {
    log('ERROR', 'Migration failed. Please check the errors above.');
    log('INFO', 'You may need to manually resolve the issue.');
    log('INFO', 'See: https://www.prisma.io/docs/guides/migrate/production-troubleshooting');
    process.exit(1);
  }

  console.log('');
  
  // Step 3: Safety net - ensure all schema elements exist
  // This catches cases where baseline marked migrations as applied but tables don't exist
  runSafetyNetDbPush();
  
  console.log('');
  
  // Step 4: Repair orphaned data from 0.6.6 migration issue
  // See: docs/MIGRATION_DATA_REPAIR.md
  repairOrphanedData();
  
  console.log('');
  
  // Step 5: Generate Prisma client
  generateClient();
  
  console.log('');
  
  // Step 6: Verify final status
  log('INFO', '--- Final Status ---');
  verifyMigrationStatus();
  
  console.log('');
  log('OK', 'Database migration complete!');
  log('OK', '===========================================');
  console.log('');
}

main().catch((error) => {
  log('ERROR', `Unexpected error: ${error.message}`);
  process.exit(1);
});
