/**
 * On-chain sync scheduler.
 *
 * Polls the configured Esplora endpoint on a fixed interval and pushes anything
 * new into `BitcoinTransaction`. Esplora has no per-address websocket, so
 * polling is the only option; the interval is the latency/load trade-off and it
 * is configurable.
 *
 * Like the other schedulers in this project this is an in-memory `setInterval`,
 * which has two consequences worth stating plainly rather than hiding:
 *
 *  - On a restart, nothing is missed because the sync is idempotent (transactions
 *    are deduplicated by txid), but nothing is *backfilled* either until the
 *    next tick.
 *  - Only one Node process may be polling. Running several app instances against
 *    one database would multiply the request rate for no benefit.
 *
 * The feature is opt-in: with `onchain.enabled` false the scheduler does not
 * start at all, so installing the app sends nothing to any third party.
 */

import { prisma } from '@/lib/prisma';
import { OnchainSyncService, OnchainSyncSummary } from '@/lib/onchain/onchain-sync-service';
import { SettingsService } from '@/lib/settings-service';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';

const MIN_INTERVAL_MINUTES = 1;

export class OnchainScheduler {
  private static interval: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static currentIntervalMinutes = 0;
  private static lastSummary: OnchainSyncSummary | null = null;
  private static lastRunAt: Date | null = null;
  private static lastError: string | null = null;
  private static inProgress = false;

  /**
   * Start polling, if the user enabled on-chain watching.
   *
   * Safe to call more than once: a second call is a no-op unless the configured
   * interval actually changed, in which case the timer is rescheduled. Nothing
   * between reading the settings and arming the timer awaits, so two concurrent
   * calls cannot both arm one and leak the other.
   */
  static async start(): Promise<void> {
    let settings;
    try {
      settings = await SettingsService.loadSettings();
    } catch (error) {
      // Settings are not critical for startup; a failure here must not stop the
      // app from booting, exactly like the other initialisation steps.
      console.error('[ONCHAIN] Could not load settings, scheduler not started:', error);
      return;
    }

    const config = settings.onchain;

    if (!config || !config.enabled) {
      console.log('[ONCHAIN] On-chain watching is disabled, scheduler not started');
      return;
    }

    const intervalMinutes = Math.max(MIN_INTERVAL_MINUTES, config.syncIntervalMinutes || 10);

    if (OnchainScheduler.isRunning && OnchainScheduler.currentIntervalMinutes === intervalMinutes) {
      console.log('[ONCHAIN] Scheduler already running at the same interval');
      return;
    }

    const wasRunning = OnchainScheduler.isRunning;
    if (wasRunning) {
      console.log(
        `[ONCHAIN] Sync interval changed ${OnchainScheduler.currentIntervalMinutes} -> ${intervalMinutes} minutes`
      );
    }

    // Always clear first: rescheduling must never leave the old timer polling
    // at the previous rate forever.
    OnchainScheduler.stopTimer();
    OnchainScheduler.isRunning = true;
    OnchainScheduler.currentIntervalMinutes = intervalMinutes;
    OnchainScheduler.interval = setInterval(() => {
      void OnchainScheduler.runOnce();
    }, intervalMinutes * 60 * 1000);

    console.log(
      `[ONCHAIN] Scheduler started - polling ${config.esploraEndpoint} every ${intervalMinutes} min`
    );

    // Sync once on a fresh start so a new install shows history without
    // waiting a full interval. A reschedule keeps the data it already has.
    if (!wasRunning) {
      await OnchainScheduler.runOnce();
    }
  }

  /**
   * Bring the scheduler in line with the saved settings: stop it when on-chain
   * watching was disabled, start or reschedule it otherwise. Called after the
   * settings change, so none of these needs a restart.
   */
  static async applySettings(): Promise<void> {
    const settings = await SettingsService.loadSettings();
    if (!settings.onchain || !settings.onchain.enabled) {
      if (OnchainScheduler.isRunning) {
        OnchainScheduler.stop();
      }
      return;
    }
    await OnchainScheduler.start();
  }

  private static stopTimer(): void {
    if (OnchainScheduler.interval) {
      clearInterval(OnchainScheduler.interval);
      OnchainScheduler.interval = null;
    }
  }

  /** Stop polling. Safe to call when not running. */
  static stop(): void {
    OnchainScheduler.stopTimer();
    OnchainScheduler.isRunning = false;
    OnchainScheduler.currentIntervalMinutes = 0;
    console.log('[ONCHAIN] Scheduler stopped');
  }

  /**
   * One full sync pass over every active user.
   *
   * Reentrancy is guarded: a pass over many addresses can take longer than the
   * interval, and two overlapping passes would double the load on the endpoint
   * for no benefit — the deduplication would make the second one a no-op anyway.
   */
  static async runOnce(): Promise<OnchainSyncSummary | null> {
    if (OnchainScheduler.inProgress) {
      console.log('[ONCHAIN] A sync pass is already running, skipping this tick');
      return null;
    }

    OnchainScheduler.inProgress = true;

    try {
      const settings = await SettingsService.loadSettings();
      const config = settings.onchain;

      if (!config || !config.enabled) {
        // The user disabled it while the timer was still pending.
        OnchainScheduler.stop();
        return null;
      }

      const startedAt = Date.now();
      const summary = await OnchainSyncService.syncAllUsers(
        config.esploraEndpoint,
        config.requestTimeoutMs
      );

      OnchainScheduler.lastSummary = summary;
      OnchainScheduler.lastRunAt = new Date();
      OnchainScheduler.lastError = null;

      console.log(
        `[ONCHAIN] Sync pass done in ${Date.now() - startedAt}ms - ` +
          `${summary.addresses} address(es), ${summary.txsImported} new transaction(s), ` +
          `${summary.failed} failure(s)`
      );

      // Only recompute portfolios that actually changed, otherwise every tick
      // would rewrite every user's summary for nothing.
      if (config.recalculatePortfolio && summary.txsImported > 0) {
        await OnchainScheduler.refreshPortfolios();
      }

      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      OnchainScheduler.lastError = message;
      console.error('[ONCHAIN] Sync pass failed:', message);
      return null;
    } finally {
      OnchainScheduler.inProgress = false;
    }
  }

  /**
   * Recompute the portfolio of every user that received a transaction.
   *
   * Scoped by userId because PortfolioSummary is a per-user table; recomputing
   * one user's imports must never touch another's numbers.
   */
  private static async refreshPortfolios(): Promise<void> {
    const last = OnchainScheduler.lastSummary;
    if (!last || last.txsImported === 0) {
      return;
    }

    const affected = new Set<number>();
    for (const result of last.results) {
      if (result.txsImported > 0) {
        affected.add(result.watchedAddressId);
      }
    }

    for (const watchedAddressId of Array.from(affected)) {
      try {
        const record = await prisma.watchedAddress.findUnique({
          where: { id: watchedAddressId },
          select: { userId: true },
        });
        if (!record) {
          continue;
        }
        await BitcoinPriceService.calculateAndStorePortfolioSummary(record.userId);
      } catch (error) {
        // One user failing to recompute must not stop the others.
        console.error(
          `[ONCHAIN] Could not refresh portfolio for watched address ${watchedAddressId}:`,
          error
        );
      }
    }
  }

  /** Status for the settings screen. */
  static getStatus() {
    return {
      isRunning: OnchainScheduler.isRunning,
      intervalMinutes: OnchainScheduler.currentIntervalMinutes,
      lastRunAt: OnchainScheduler.lastRunAt,
      lastError: OnchainScheduler.lastError,
      lastSummary: OnchainScheduler.lastSummary,
    };
  }

  /**
   * Probe the configured endpoint without syncing anything.
   *
   * Used by the settings screen so a user pointing at their own electrs gets
   * immediate feedback instead of a silent scheduler that never succeeds.
   */
  static async testConnection(): Promise<{
    reachable: boolean;
    tipHeight: number | null;
    endpoint: string;
    error?: string;
  }> {
    const settings = await SettingsService.loadSettings();
    const config = settings.onchain;
    const endpoint = config?.esploraEndpoint || 'https://mempool.space/api';
    const result = await OnchainSyncService.isEsploraReachable(
      endpoint,
      config?.requestTimeoutMs
    );
    return {
      reachable: result.reachable,
      tipHeight: result.tipHeight,
      endpoint,
      error: result.error,
    };
  }
}
