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
// LOAD ENVIRONMENT VARIABLES
// =============================================================================

// Load .env file before reading DATABASE_URL
// This ensures we use the correct database path in logs
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

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
  '20251222140223_add_multi_wallet_support',
];


// =============================================================================
// UTILITIES
// =============================================================================

// Verbose mode can be enabled with --verbose flag
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

function log(level, message) {
  // In quiet mode, only show OK, WARN, ERROR, and FIX messages
  if (!VERBOSE && level === 'INFO') return;
  
  const prefix = {
    'INFO': '[INFO]',
    'OK': '✓',
    'WARN': '⚠',
    'ERROR': '✗',
    'FIX': '→',
  }[level] || '';
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
    return false;
  }
  
  const hasMigrationTable = tableExists('_prisma_migrations');
  const hasAppTables = tableExists('users') || tableExists('bitcoin_transactions');
  
  if (hasAppTables && !hasMigrationTable) {
    log('WARN', 'Legacy database detected (no migration history)');
    return true;
  }
  
  return false;
}

/**
 * Baseline all migrations for a legacy database
 */
function baselineAllMigrations() {
  log('FIX', `Baselining ${ALL_MIGRATIONS.length} migrations for legacy database...`);
  
  for (const migration of ALL_MIGRATIONS) {
    log('INFO', `  → ${migration}`);
    runCommandCapture(`npx prisma migrate resolve --applied "${migration}"`);
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
 */
function resolveAllFailedMigrations() {
  try {
    const result = execSync(
      `sqlite3 "${DB_PATH}" "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    const failedMigrations = result.trim().split('\n').filter(m => m.trim());
    
    if (failedMigrations.length === 0) return;
    
    log('FIX', `Resolving ${failedMigrations.length} failed migration(s)...`);
    
    for (const migration of failedMigrations) {
      runCommandCapture(`npx prisma migrate resolve --applied "${migration}"`);
    }
  } catch (error) {
    // Fallback: try to resolve all known migrations
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
    log('INFO', `Applying migrations (attempt ${attempts})...`);
    
    const result = runCommandCapture('npx prisma migrate deploy');
    
    if (result.success) {
      log('OK', 'Migrations applied');
      return true;
    }
    
    const errorOutput = result.error + result.output;
    
    // P3018: "already exists" error
    if (errorOutput.includes('P3018') || errorOutput.includes('already exists')) {
      const failedMigration = extractFailedMigration(errorOutput);
      if (failedMigration) {
        log('FIX', `Resolving "${failedMigration}" (already exists)...`);
        runCommandCapture(`npx prisma migrate resolve --applied "${failedMigration}"`);
        continue;
      }
    }
    
    // P3005: "database is not empty" (needs baselining)
    if (errorOutput.includes('P3005')) {
      baselineAllMigrations();
      continue;
    }
    
    // P3009: "failed migrations" blocking new migrations
    if (errorOutput.includes('P3009') || errorOutput.includes('found failed migrations')) {
      const failedMigration = extractFailedMigration(errorOutput);
      if (failedMigration) {
        log('FIX', `Resolving failed migration "${failedMigration}"...`);
        runCommandCapture(`npx prisma migrate resolve --applied "${failedMigration}"`);
      } else {
        resolveAllFailedMigrations();
      }
      continue;
    }
    
    // Unknown error
    log('ERROR', 'Migration failed');
    if (VERBOSE) console.error(errorOutput);
    return false;
  }
  
  log('ERROR', `Migration failed after ${MAX_RETRY_ATTEMPTS} attempts`);
  return false;
}

/**
 * Run db push as safety net to ensure ALL schema elements exist
 */
function runSafetyNetDbPush() {
  log('INFO', 'Verifying schema...');
  
  const result = runCommandCapture('npx prisma db push --skip-generate');
  
  if (result.success) {
    log('OK', 'Schema verified');
    return true;
  }
  
  const errorOutput = result.error + result.output;
  
  // Check if it failed because it wants to do destructive changes
  if (errorOutput.includes('--accept-data-loss')) {
    log('FIX', 'Applying schema updates...');
    const retryResult = runCommandCapture('npx prisma db push --skip-generate --accept-data-loss');
    
    if (retryResult.success) {
      log('OK', 'Schema updated');
      return true;
    }
    
    log('ERROR', 'Schema update failed');
    if (VERBOSE) console.error(retryResult.error);
    return false;
  }
  
  // Check if it succeeded but had warnings
  if (errorOutput.includes('Your database is now in sync') || errorOutput.includes('already in sync')) {
    log('OK', 'Schema verified');
    return true;
  }
  
  // Some other issue - continue anyway
  if (VERBOSE) console.log(errorOutput);
  return true;
}

/**
 * Repair orphaned data from migration issues
 */
function repairOrphanedData() {
  if (!fs.existsSync(DB_PATH)) {
    return; // Fresh install, nothing to repair
  }
  
  try {
    const userCountResult = execSync(
      `sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM users;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const userCount = parseInt(userCountResult.trim(), 10);
    
    const orphanedTxResult = execSync(
      `sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM bitcoin_transactions WHERE user_id IS NULL;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const orphanedTxCount = parseInt(orphanedTxResult.trim(), 10);
    
    const adminResult = execSync(
      `sqlite3 "${DB_PATH}" "SELECT is_admin FROM users WHERE id = (SELECT MIN(id) FROM users);"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const firstUserIsAdmin = adminResult.trim() === '1';
    
    // Nothing to fix
    if (orphanedTxCount === 0 && (userCount === 0 || firstUserIsAdmin)) {
      return;
    }
    
    // Multi-user with orphaned data - DON'T auto-fix
    if (userCount > 1 && orphanedTxCount > 0) {
      log('WARN', `Found ${orphanedTxCount} orphaned transactions with ${userCount} users`);
      log('WARN', 'Manual fix required. See: docs/MIGRATION_DATA_REPAIR.md');
      return;
    }
    
    // Single user - safe to auto-fix
    if (userCount === 1) {
      const firstUserId = execSync(
        `sqlite3 "${DB_PATH}" "SELECT MIN(id) FROM users;"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      
      if (orphanedTxCount > 0) {
        log('FIX', `Repairing ${orphanedTxCount} orphaned transactions...`);
        execSync(`sqlite3 "${DB_PATH}" "UPDATE bitcoin_transactions SET user_id = ${firstUserId} WHERE user_id IS NULL;"`, { stdio: 'pipe' });
        execSync(`sqlite3 "${DB_PATH}" "UPDATE app_settings SET user_id = ${firstUserId} WHERE user_id IS NULL;"`, { stdio: 'pipe' });
        execSync(`sqlite3 "${DB_PATH}" "UPDATE custom_currencies SET user_id = ${firstUserId} WHERE user_id IS NULL;"`, { stdio: 'pipe' });
        execSync(`sqlite3 "${DB_PATH}" "UPDATE portfolio_summary SET user_id = ${firstUserId} WHERE user_id IS NULL;"`, { stdio: 'pipe' });
        log('OK', 'Data repaired');
      }
      
      if (!firstUserIsAdmin) {
        log('FIX', 'Restoring admin status...');
        execSync(`sqlite3 "${DB_PATH}" "UPDATE users SET is_admin = 1 WHERE id = ${firstUserId};"`, { stdio: 'pipe' });
        log('OK', 'Admin restored');
      }
    }
  } catch (error) {
    // Database may be new or tables don't exist yet - that's fine
  }
}

/**
 * Generate Prisma client
 */
function generateClient() {
  log('INFO', 'Generating Prisma client...');
  const result = runCommand('npx prisma generate', { silent: true });
  if (!result.success) {
    log('WARN', 'Could not generate Prisma client');
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log(`[DB] Migrating ${path.basename(DB_PATH)}...`);

  // Ensure database directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Step 1: Check for legacy database and baseline if needed
  if (isLegacyDatabase()) {
    baselineAllMigrations();
  }

  // Step 2: Run migrations with automatic recovery
  const migrationSuccess = runMigrateWithRecovery();
  
  if (!migrationSuccess) {
    log('ERROR', 'Migration failed. Run with --verbose for details.');
    process.exit(1);
  }

  // Step 3: Safety net - ensure all schema elements exist
  runSafetyNetDbPush();
  
  // Step 4: Repair orphaned data from migration issues
  repairOrphanedData();
  
  // Step 5: Generate Prisma client
  generateClient();
  
  // Step 6: Auto-migrate wallets for existing users (v0.7.0+)
  await migrateWalletsIfNeeded();
  
  log('OK', 'Database ready');
}

/**
 * Auto-migrate users to multi-wallet system if they don't have wallets yet
 * This runs silently on every startup to ensure new users and upgrades are handled
 */
async function migrateWalletsIfNeeded() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Find users without any wallets
    const usersWithoutWallets = await prisma.user.findMany({
      where: {
        wallets: {
          none: {}
        }
      },
      select: { id: true, email: true }
    });

    if (usersWithoutWallets.length === 0) {
      await prisma.$disconnect();
      return;
    }

    log('INFO', `Found ${usersWithoutWallets.length} user(s) without wallets, creating defaults...`);

    for (const user of usersWithoutWallets) {
      // Create default wallets
      const hotWallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          name: 'Hot Wallet',
          type: 'SOFTWARE',
          temperature: 'HOT',
          emoji: '🔥',
          includeInTotal: true,
          isDefault: true,
          sortOrder: 0,
        }
      });

      const coldWallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          name: 'Cold Storage',
          type: 'HARDWARE',
          temperature: 'COLD',
          emoji: '🔐',
          includeInTotal: true,
          isDefault: false,
          sortOrder: 1,
        }
      });

      // Update existing transactions
      // BUY → destination = hot wallet
      await prisma.bitcoinTransaction.updateMany({
        where: { 
          userId: user.id, 
          type: 'BUY',
          destinationWalletId: null
        },
        data: { destinationWalletId: hotWallet.id }
      });

      // SELL → source = hot wallet
      await prisma.bitcoinTransaction.updateMany({
        where: { 
          userId: user.id, 
          type: 'SELL',
          sourceWalletId: null
        },
        data: { sourceWalletId: hotWallet.id }
      });

      // TRANSFER - TO_COLD_WALLET
      await prisma.bitcoinTransaction.updateMany({
        where: { 
          userId: user.id, 
          type: 'TRANSFER',
          transferType: 'TO_COLD_WALLET',
          sourceWalletId: null
        },
        data: { 
          sourceWalletId: hotWallet.id,
          destinationWalletId: coldWallet.id,
          transferCategory: 'INTERNAL'
        }
      });

      // TRANSFER - FROM_COLD_WALLET
      await prisma.bitcoinTransaction.updateMany({
        where: { 
          userId: user.id, 
          type: 'TRANSFER',
          transferType: 'FROM_COLD_WALLET',
          sourceWalletId: null
        },
        data: { 
          sourceWalletId: coldWallet.id,
          destinationWalletId: hotWallet.id,
          transferCategory: 'INTERNAL'
        }
      });

      // TRANSFER - BETWEEN_WALLETS (default to hot→hot)
      await prisma.bitcoinTransaction.updateMany({
        where: { 
          userId: user.id, 
          type: 'TRANSFER',
          transferType: 'BETWEEN_WALLETS',
          sourceWalletId: null
        },
        data: { 
          sourceWalletId: hotWallet.id,
          destinationWalletId: hotWallet.id,
          transferCategory: 'INTERNAL'
        }
      });

      // TRANSFER - TRANSFER_IN
      await prisma.bitcoinTransaction.updateMany({
        where: { 
          userId: user.id, 
          type: 'TRANSFER',
          transferType: 'TRANSFER_IN',
          destinationWalletId: null
        },
        data: { 
          destinationWalletId: hotWallet.id,
          transferCategory: 'EXTERNAL_IN'
        }
      });

      // TRANSFER - TRANSFER_OUT
      await prisma.bitcoinTransaction.updateMany({
        where: { 
          userId: user.id, 
          type: 'TRANSFER',
          transferType: 'TRANSFER_OUT',
          sourceWalletId: null
        },
        data: { 
          sourceWalletId: hotWallet.id,
          transferCategory: 'EXTERNAL_OUT'
        }
      });

      log('OK', `Created wallets for user ${user.email}`);
    }

    await prisma.$disconnect();
  } catch (error) {
    // Don't fail startup if wallet migration fails - it can be run manually
    log('WARN', `Wallet auto-migration skipped: ${error.message}`);
  }
}

main().catch((error) => {
  log('ERROR', `Unexpected error: ${error.message}`);
  process.exit(1);
});
