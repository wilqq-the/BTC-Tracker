#!/usr/bin/env node
/**
 * BTC Tracker - Wallet Migration Script
 * 
 * This script migrates existing users to the multi-wallet system by:
 * 1. Creating default Hot Wallet and Cold Storage for each user
 * 2. Updating existing transactions to reference the appropriate wallet
 * 
 * Run with: node scripts/migrate-wallets.js
 * Options:
 *   --dry-run    Preview changes without applying
 *   --verbose    Show detailed logging
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

function log(message) {
  console.log(message);
}

function verbose(message) {
  if (VERBOSE) {
    console.log(`  ${message}`);
  }
}

async function migrateWallets() {
  log('');
  log('='.repeat(60));
  log('BTC Tracker - Multi-Wallet Migration');
  log('='.repeat(60));
  
  if (DRY_RUN) {
    log('⚠️  DRY RUN MODE - No changes will be made');
  }
  log('');

  try {
    // Get all users
    const users = await prisma.user.findMany({
      include: {
        wallets: true,
        transactions: {
          select: {
            id: true,
            type: true,
            transferType: true,
            sourceWalletId: true,
            destinationWalletId: true,
          }
        }
      }
    });

    log(`Found ${users.length} user(s) to process`);
    log('');

    let totalUsersProcessed = 0;
    let totalWalletsCreated = 0;
    let totalTransactionsUpdated = 0;

    for (const user of users) {
      log(`Processing user: ${user.email} (ID: ${user.id})`);
      
      // Check if user already has wallets
      if (user.wallets.length > 0) {
        log(`  ✓ User already has ${user.wallets.length} wallet(s), skipping wallet creation`);
        
        // Still check if transactions need updating
        const unmigrated = user.transactions.filter(tx => 
          tx.sourceWalletId === null && tx.destinationWalletId === null
        );
        
        if (unmigrated.length > 0) {
          log(`  ⚠️  Found ${unmigrated.length} transaction(s) without wallet references`);
          
          // Find default wallet or first wallet
          const defaultWallet = user.wallets.find(w => w.isDefault) || user.wallets[0];
          const coldWallet = user.wallets.find(w => w.temperature === 'COLD') || defaultWallet;
          
          if (!DRY_RUN) {
            const updated = await updateTransactions(user.id, unmigrated, defaultWallet.id, coldWallet.id);
            totalTransactionsUpdated += updated;
            log(`  ✓ Updated ${updated} transaction(s)`);
          } else {
            log(`  [DRY RUN] Would update ${unmigrated.length} transaction(s)`);
          }
        }
        
        totalUsersProcessed++;
        continue;
      }

      // Create default wallets
      verbose('Creating default wallets...');
      
      let hotWallet, coldWallet;
      
      if (!DRY_RUN) {
        hotWallet = await prisma.wallet.create({
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

        coldWallet = await prisma.wallet.create({
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

        totalWalletsCreated += 2;
        log(`  ✓ Created "Hot Wallet" (ID: ${hotWallet.id})`);
        log(`  ✓ Created "Cold Storage" (ID: ${coldWallet.id})`);
      } else {
        log('  [DRY RUN] Would create "Hot Wallet" (SOFTWARE, HOT)');
        log('  [DRY RUN] Would create "Cold Storage" (HARDWARE, COLD)');
        hotWallet = { id: 'DRY_RUN_HOT' };
        coldWallet = { id: 'DRY_RUN_COLD' };
      }

      // Update transactions
      const transactionsToUpdate = user.transactions.filter(tx => 
        tx.sourceWalletId === null && tx.destinationWalletId === null
      );

      if (transactionsToUpdate.length > 0) {
        verbose(`Updating ${transactionsToUpdate.length} transaction(s)...`);
        
        if (!DRY_RUN) {
          const updated = await updateTransactions(user.id, transactionsToUpdate, hotWallet.id, coldWallet.id);
          totalTransactionsUpdated += updated;
          log(`  ✓ Updated ${updated} transaction(s)`);
        } else {
          log(`  [DRY RUN] Would update ${transactionsToUpdate.length} transaction(s)`);
        }
      } else {
        log('  ✓ No transactions to update');
      }

      totalUsersProcessed++;
      log('');
    }

    // Summary
    log('='.repeat(60));
    log('Migration Summary');
    log('='.repeat(60));
    log(`Users processed:       ${totalUsersProcessed}`);
    log(`Wallets created:       ${totalWalletsCreated}`);
    log(`Transactions updated:  ${totalTransactionsUpdated}`);
    log('');
    
    if (DRY_RUN) {
      log('⚠️  This was a dry run. Run without --dry-run to apply changes.');
    } else {
      log('✓ Migration completed successfully!');
    }
    log('');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function updateTransactions(userId, transactions, hotWalletId, coldWalletId) {
  let updated = 0;

  for (const tx of transactions) {
    const updates = {};

    if (tx.type === 'BUY') {
      // BUY: BTC goes to hot wallet (destination)
      updates.destinationWalletId = hotWalletId;
    } else if (tx.type === 'SELL') {
      // SELL: BTC comes from hot wallet (source)
      updates.sourceWalletId = hotWalletId;
    } else if (tx.type === 'TRANSFER') {
      // Handle transfer types
      switch (tx.transferType) {
        case 'TO_COLD_WALLET':
          updates.sourceWalletId = hotWalletId;
          updates.destinationWalletId = coldWalletId;
          updates.transferCategory = 'INTERNAL';
          break;
        case 'FROM_COLD_WALLET':
          updates.sourceWalletId = coldWalletId;
          updates.destinationWalletId = hotWalletId;
          updates.transferCategory = 'INTERNAL';
          break;
        case 'BETWEEN_WALLETS':
          // Generic internal transfer - keep in hot wallet
          updates.sourceWalletId = hotWalletId;
          updates.destinationWalletId = hotWalletId;
          updates.transferCategory = 'INTERNAL';
          break;
        case 'TRANSFER_IN':
          // External receive - goes to hot wallet
          updates.destinationWalletId = hotWalletId;
          updates.transferCategory = 'EXTERNAL_IN';
          break;
        case 'TRANSFER_OUT':
          // External send - from hot wallet
          updates.sourceWalletId = hotWalletId;
          updates.transferCategory = 'EXTERNAL_OUT';
          break;
        default:
          // Unknown transfer type - default to hot wallet internal
          updates.sourceWalletId = hotWalletId;
          updates.destinationWalletId = hotWalletId;
          updates.transferCategory = 'INTERNAL';
          verbose(`  Warning: Unknown transferType "${tx.transferType}" for tx ${tx.id}`);
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.bitcoinTransaction.update({
        where: { id: tx.id },
        data: updates
      });
      updated++;
      verbose(`  Updated transaction ${tx.id}: ${tx.type} ${tx.transferType || ''}`);
    }
  }

  return updated;
}

// Run migration
migrateWallets();

