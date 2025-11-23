/**
 * DCA Scheduler Service
 * Automatically executes recurring Bitcoin transactions (Dollar-Cost Averaging)
 * Checks hourly for due transactions and creates them
 */

import { prisma } from './prisma';
import { RecurringTransactionService } from './recurring-transaction-service';
import { BitcoinPriceService } from './bitcoin-price-service';

export class DCAScheduler {
  private static interval: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static readonly CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

  /**
   * Start the DCA scheduler
   */
  static async start() {
    if (this.isRunning) {
      console.log('[DCA] Scheduler is already running');
      return;
    }

    console.log('[DCA] Starting DCA scheduler...');
    this.isRunning = true;

    // Execute immediately on startup (check for missed transactions)
    await this.checkAndExecuteDueTransactions();

    // Then schedule hourly checks
    this.interval = setInterval(async () => {
      try {
        await this.checkAndExecuteDueTransactions();
      } catch (error) {
        console.error('[DCA] Error in scheduled check:', error);
      }
    }, this.CHECK_INTERVAL_MS);

    console.log('[DCA] DCA scheduler started - checking every hour');
  }

  /**
   * Stop the DCA scheduler
   */
  static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('[DCA] DCA scheduler stopped');
  }

  /**
   * Check for due transactions and execute them
   */
  static async checkAndExecuteDueTransactions() {
    try {
      const now = new Date();
      console.log(`[DCA] Checking for due recurring transactions at ${now.toISOString()}...`);

      // Find all active, non-paused transactions where nextExecution <= now
      const dueTransactions = await prisma.recurringTransaction.findMany({
        where: {
          isActive: true,
          isPaused: false,
          nextExecution: {
            lte: now
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      if (dueTransactions.length === 0) {
        console.log('[DCA] No due transactions found');
        return;
      }

      console.log(`[DCA] Found ${dueTransactions.length} due transaction(s)`);

      // Execute each transaction
      for (const recurringTx of dueTransactions) {
        try {
          await this.executeRecurringTransaction(recurringTx);
        } catch (error) {
          console.error(`[DCA] Failed to execute recurring transaction ${recurringTx.id}:`, error);
          // Continue with other transactions even if one fails
        }
      }

      console.log('[DCA] Batch execution completed');
    } catch (error) {
      console.error('[DCA] Error checking for due transactions:', error);
      throw error;
    }
  }

  /**
   * Execute a single recurring transaction
   */
  static async executeRecurringTransaction(recurringTx: any) {
    const startTime = Date.now();
    console.log(`[DCA] Executing recurring transaction #${recurringTx.id} - ${recurringTx.name}`);

    try {
      // 1. Get current BTC price
      const priceData = await BitcoinPriceService.getCurrentPrice();
      if (!priceData || !priceData.price) {
        throw new Error('Failed to fetch current BTC price');
      }

      const currentBTCPriceUSD = priceData.price;
      console.log(`[DCA] Current BTC price: $${currentBTCPriceUSD.toFixed(2)}`);

      // 2. Calculate BTC amount based on fiat amount
      // For now, assume currency is USD (we'll add conversion later)
      const btcAmount = recurringTx.amount / currentBTCPriceUSD;
      
      console.log(`[DCA] Converting ${recurringTx.amount} ${recurringTx.currency} to ${btcAmount.toFixed(8)} BTC`);

      // 3. Create the actual Bitcoin transaction
      const transaction = await prisma.bitcoinTransaction.create({
        data: {
          userId: recurringTx.userId,
          type: recurringTx.type,
          btcAmount: btcAmount,
          originalPricePerBtc: currentBTCPriceUSD,
          originalCurrency: recurringTx.currency,
          originalTotalAmount: recurringTx.amount,
          fees: recurringTx.fees,
          feesCurrency: recurringTx.feesCurrency,
          transactionDate: new Date(),
          notes: `Auto-DCA: ${recurringTx.name}`,
          tags: recurringTx.tags || 'DCA,Automatic',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`[DCA] Created transaction #${transaction.id}`);

      // 4. Update recurring transaction
      const nextExecution = RecurringTransactionService.calculateNextExecution(
        new Date(),
        recurringTx.frequency
      );

      const newExecutionCount = recurringTx.executionCount + 1;

      // Check if should auto-pause
      const shouldPause = RecurringTransactionService.shouldAutoPause(
        newExecutionCount,
        recurringTx.maxOccurrences,
        nextExecution,
        recurringTx.endDate
      );

      await prisma.recurringTransaction.update({
        where: { id: recurringTx.id },
        data: {
          lastExecuted: new Date(),
          executionCount: newExecutionCount,
          nextExecution: nextExecution,
          isPaused: shouldPause
        }
      });

      if (shouldPause) {
        console.log(`[DCA] 🛑 Auto-paused recurring transaction #${recurringTx.id} (limit reached)`);
      } else {
        console.log(`[DCA] Next execution scheduled for: ${nextExecution.toISOString()}`);
      }

      // 5. Recalculate portfolio summary with new transaction
      await BitcoinPriceService.calculateAndStorePortfolioSummary(currentBTCPriceUSD);

      const duration = Date.now() - startTime;
      console.log(`[DCA] Completed in ${duration}ms`);

      return {
        success: true,
        transactionId: transaction.id,
        btcAmount,
        nextExecution,
        autoPaused: shouldPause
      };
    } catch (error: any) {
      console.error(`[DCA] ❌ Error executing recurring transaction #${recurringTx.id}:`, error);
      
      // Log the error but don't throw - we want to continue with other transactions
      // In production, you might want to:
      // - Send notification to user
      // - Increment error counter
      // - Auto-pause after N consecutive failures
      
      throw error;
    }
  }

  /**
   * Manually trigger execution of a specific recurring transaction (for testing/admin)
   */
  static async executeNow(recurringTxId: number, userId: number) {
    try {
      const recurringTx = await prisma.recurringTransaction.findFirst({
        where: {
          id: recurringTxId,
          userId: userId
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      if (!recurringTx) {
        throw new Error('Recurring transaction not found');
      }

      if (!recurringTx.isActive) {
        throw new Error('Recurring transaction is not active');
      }

      console.log(`[DCA] Manual execution triggered for recurring transaction #${recurringTxId}`);
      
      const result = await this.executeRecurringTransaction(recurringTx);
      
      return result;
    } catch (error) {
      console.error(`[DCA] Error in manual execution:`, error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.CHECK_INTERVAL_MS,
      checkIntervalMinutes: this.CHECK_INTERVAL_MS / 1000 / 60
    };
  }

  /**
   * Get statistics about recurring transactions
   */
  static async getStatistics() {
    try {
      const [total, active, paused, totalExecutions] = await Promise.all([
        prisma.recurringTransaction.count(),
        prisma.recurringTransaction.count({
          where: { isActive: true, isPaused: false }
        }),
        prisma.recurringTransaction.count({
          where: { isActive: true, isPaused: true }
        }),
        prisma.recurringTransaction.aggregate({
          _sum: {
            executionCount: true
          }
        })
      ]);

      return {
        total,
        active,
        paused,
        totalExecutions: totalExecutions._sum.executionCount || 0
      };
    } catch (error) {
      console.error('[DCA] Error fetching statistics:', error);
      return {
        total: 0,
        active: 0,
        paused: 0,
        totalExecutions: 0
      };
    }
  }
}

