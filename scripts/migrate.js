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

// Critical tables that must exist for the app to function
const REQUIRED_TABLES = [
  'users',
  'bitcoin_transactions',
  'bitcoin_price_history',
  'bitcoin_price_intraday',
  'exchange_rates',
  'app_settings',
  'custom_currencies',
  'bitcoin_current_price',
  'portfolio_summary',
  'goals',
  'dashboard_layouts',
  'recurring_transactions',
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
 * Extract migration name from P3018 error message
 */
function extractFailedMigration(errorOutput) {
  const match = errorOutput.match(/Migration name:\s*(\S+)/);
  if (match) {
    return match[1].trim();
  }
  return null;
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
    
    // Unknown error
    log('ERROR', 'Migration failed with unexpected error:');
    console.error(errorOutput);
    return false;
  }
  
  log('ERROR', `Migration failed after ${MAX_RETRY_ATTEMPTS} attempts`);
  return false;
}

/**
 * Check for missing tables and run db push if needed
 * This is the safety net for legacy databases that may be missing schema elements
 */
function runSafetyNetDbPush() {
  log('SAFETY', '--- Schema Safety Check ---');
  
  // Check which tables are missing
  const missingTables = REQUIRED_TABLES.filter(table => !tableExists(table));
  
  if (missingTables.length === 0) {
    log('OK', 'All required tables exist');
    return true;
  }
  
  log('WARN', `Missing tables detected: ${missingTables.join(', ')}`);
  log('SAFETY', 'Running prisma db push to add missing schema elements...');
  log('SAFETY', 'This will only ADD missing tables/columns, not delete anything');
  
  // Run db push WITHOUT --accept-data-loss (safe mode)
  // This will only add missing tables/columns, refuse destructive changes
  const result = runCommandCapture('npx prisma db push --skip-generate');
  
  if (result.success) {
    log('OK', 'Schema safety check complete - missing elements added');
    return true;
  }
  
  // Check if it failed because it wants to do destructive changes
  if (result.error.includes('--accept-data-loss')) {
    log('WARN', 'db push wants to make destructive changes - skipping for safety');
    log('WARN', 'Some schema elements may be missing. Manual intervention may be needed.');
    log('INFO', 'You can run: npx prisma db push --accept-data-loss (⚠️ may lose data)');
    return false;
  }
  
  // Check if it succeeded but had warnings
  if (result.output.includes('Your database is now in sync')) {
    log('OK', 'Schema safety check complete');
    return true;
  }
  
  log('WARN', 'db push completed with warnings:');
  console.log(result.output || result.error);
  return true; // Continue anyway, the app will fail clearly if something is really wrong
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
  
  // Step 4: Generate Prisma client
  generateClient();
  
  console.log('');
  
  // Step 5: Verify final status
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
