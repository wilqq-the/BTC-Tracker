import { BackupService, SnapshotMetadata } from './backup-service';

/**
 * BackupScheduler
 *
 * Periodically creates automatic ("scheduled") snapshots and applies the
 * retention policy. Follows the same static-class pattern as PriceScheduler.
 * Configuration lives in BackupService's on-disk config (see getConfig).
 */
export class BackupScheduler {
  private static interval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static async start(): Promise<void> {
    if (this.interval) return; // already scheduled

    const config = await BackupService.getConfig();
    if (!config.enabled) {
      this.isRunning = false;
      console.log('[BACKUP] Scheduler disabled');
      return;
    }

    const intervalMs = Math.max(1, config.intervalHours) * 60 * 60 * 1000;
    console.log(`[BACKUP] Scheduling automatic backups every ${config.intervalHours}h`);

    this.interval = setInterval(() => {
      this.runNow().catch((error) => console.error('[BACKUP] Scheduled backup failed:', error));
    }, intervalMs);
    this.isRunning = true;
  }

  static stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
  }

  static async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  /**
   * Create one scheduled snapshot now and apply retention. Records lastRunAt /
   * lastError in the config. Used by the interval and the manual "run now" action.
   */
  static async runNow(): Promise<SnapshotMetadata> {
    const config = await BackupService.getConfig();
    try {
      const meta = await BackupService.createSnapshot({ kind: 'scheduled', gzip: config.gzip });
      await BackupService.applyRetention(config.retention);
      await BackupService.saveConfig({ lastRunAt: new Date().toISOString(), lastError: null });
      console.log(`[BACKUP] Scheduled backup created: ${meta.filename}`);
      return meta;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await BackupService.saveConfig({ lastError: message }).catch(() => {});
      throw error;
    }
  }

  static getStatus() {
    return {
      isRunning: this.isRunning,
      scheduled: this.interval !== null,
    };
  }
}
