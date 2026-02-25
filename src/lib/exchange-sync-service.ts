/**
 * Exchange Sync Service
 * Orchestrates syncing trades from connected exchanges into our database.
 * Handles credential decryption, adapter selection, duplicate detection,
 * and transaction creation.
 */

import { prisma } from './prisma';
import { EncryptionService } from './encryption-service';
import { getExchangeAdapter, ExchangeName, NormalizedTransaction, SyncResult } from './exchanges';
import { BitcoinPriceService } from './bitcoin-price-service';

export class ExchangeSyncService {
  /**
   * Sync trades from a specific exchange connection.
   * @param fullSync - If true, ignores lastSyncAt and fetches all trades from the beginning.
   *                   Useful when the user has deleted transactions and wants to re-import.
   */
  static async syncExchange(connectionId: number, userId: number, fullSync: boolean = false): Promise<SyncResult> {
    const syncStartTime = new Date();

    // 1. Fetch the connection record
    const connection = await prisma.exchangeConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new Error('Exchange connection not found');
    }

    if (!connection.isActive) {
      throw new Error('Exchange connection is inactive');
    }

    const exchangeName = connection.exchangeName as ExchangeName;

    try {
      // 2. Decrypt credentials
      const apiKey = EncryptionService.decrypt(connection.encryptedApiKey);
      const apiSecret = EncryptionService.decrypt(connection.encryptedApiSecret);

      // 3. Create adapter
      const adapter = getExchangeAdapter(exchangeName, { apiKey, apiSecret });

      // 4. Fetch trades (incremental if we have a last sync date, unless fullSync requested)
      const since = fullSync ? undefined : (connection.lastSyncAt || undefined);
      console.log(`[SYNC] Fetching trades from ${exchangeName} (since: ${since?.toISOString() || 'all time'})${fullSync ? ' [FULL SYNC]' : ''}...`);

      const trades = await adapter.fetchSpotTrades(since);
      const normalized = adapter.normalizeAll(trades);

      console.log(`[SYNC] ${exchangeName}: ${trades.length} trades fetched, normalizing...`);

      // 5. Import with duplicate detection
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const tx of normalized) {
        try {
          const isDuplicate = await this.isDuplicate(tx, userId);
          if (isDuplicate) {
            skipped++;
            continue;
          }

          await this.createTransaction(tx, userId, connection.walletId);
          imported++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to import trade: ${msg}`);
        }
      }

      // 6. Update connection sync status
      await prisma.exchangeConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: syncStartTime,
          lastSyncStatus: errors.length > 0 && imported > 0 ? 'partial' : errors.length > 0 ? 'error' : 'success',
          lastSyncError: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
          lastSyncCount: imported,
        },
      });

      // 7. Recalculate portfolio if we imported anything
      if (imported > 0) {
        try {
          await BitcoinPriceService.calculateAndStorePortfolioSummary();
        } catch (error) {
          console.error('[SYNC] Error recalculating portfolio after sync:', error);
        }
      }

      const result: SyncResult = {
        success: true,
        exchangeName,
        totalFetched: trades.length,
        imported,
        skipped,
        errors,
        syncedAt: syncStartTime,
      };

      console.log(`[SYNC] ${exchangeName}: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SYNC] ${exchangeName} sync failed:`, errorMsg);

      // Update connection with error status
      await prisma.exchangeConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: syncStartTime,
          lastSyncStatus: 'error',
          lastSyncError: errorMsg.slice(0, 500),
          lastSyncCount: 0,
        },
      });

      return {
        success: false,
        exchangeName,
        totalFetched: 0,
        imported: 0,
        skipped: 0,
        errors: [errorMsg],
        syncedAt: syncStartTime,
      };
    }
  }

  /**
   * Sync all active exchange connections for a user.
   */
  static async syncAllExchanges(userId: number): Promise<SyncResult[]> {
    const connections = await prisma.exchangeConnection.findMany({
      where: { userId, isActive: true },
    });

    const results: SyncResult[] = [];

    for (const connection of connections) {
      const result = await this.syncExchange(connection.id, userId);
      results.push(result);
    }

    return results;
  }

  /**
   * Test exchange connection credentials without syncing.
   */
  static async testConnection(connectionId: number, userId: number): Promise<{ success: boolean; error?: string }> {
    const connection = await prisma.exchangeConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      const apiKey = EncryptionService.decrypt(connection.encryptedApiKey);
      const apiSecret = EncryptionService.decrypt(connection.encryptedApiSecret);
      const adapter = getExchangeAdapter(connection.exchangeName as ExchangeName, { apiKey, apiSecret });

      await adapter.authenticate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test credentials before saving a new connection.
   */
  static async testCredentials(
    exchangeName: ExchangeName,
    apiKey: string,
    apiSecret: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const adapter = getExchangeAdapter(exchangeName, { apiKey, apiSecret });
      await adapter.authenticate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Check if a transaction already exists in the database.
   * Uses "standard" duplicate detection: same date, type, btc amount, and price.
   */
  private static async isDuplicate(tx: NormalizedTransaction, userId: number): Promise<boolean> {
    const existing = await prisma.bitcoinTransaction.findFirst({
      where: {
        userId,
        type: tx.type,
        btcAmount: tx.btcAmount,
        originalPricePerBtc: tx.pricePerBtc,
        transactionDate: tx.transactionDate,
      },
    });

    return existing !== null;
  }

  /**
   * Create a BitcoinTransaction record from a normalized exchange trade.
   */
  private static async createTransaction(
    tx: NormalizedTransaction,
    userId: number,
    walletId: number | null
  ): Promise<void> {
    await prisma.bitcoinTransaction.create({
      data: {
        userId,
        type: tx.type,
        btcAmount: tx.btcAmount,
        originalPricePerBtc: tx.pricePerBtc,
        originalCurrency: tx.currency,
        originalTotalAmount: tx.totalAmount,
        fees: tx.fees,
        feesCurrency: tx.feesCurrency,
        transactionDate: tx.transactionDate,
        notes: tx.notes,
        tags: tx.tags,
        // Assign to wallet if specified
        toWalletId: tx.type === 'BUY' ? walletId : null,
        fromWalletId: tx.type === 'SELL' ? walletId : null,
      },
    });
  }
}
