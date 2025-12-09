import { PriceScheduler } from './price-scheduler';
import { DCAScheduler } from './dca-scheduler';
import { ExchangeRateService } from './exchange-rate-service';
import { HistoricalDataService } from './historical-data-service';
import { SettingsService } from './settings-service';
import { prisma } from './prisma';

// App initialization - handles database setup and starts background services
export class AppInitializationService {
  private static isInitialized = false;
  private static initPromise: Promise<void> | null = null;

  static async initialize(): Promise<void> {
    if (this.isBuildTime()) return;
    if (this.initPromise) return this.initPromise;
    if (this.isInitialized) return;

    console.log('[START] Starting BTC Tracker initialization...');
    this.initPromise = this.performInitialization();
    
    try {
      await this.initPromise;
      this.isInitialized = true;
      console.log('[OK] BTC Tracker initialized');
    } catch (error) {
      console.error('[ERROR] Initialization failed:', error);
      this.initPromise = null;
      throw error;
    }
  }

  private static isBuildTime(): boolean {
    if (process.env.NEXT_PHASE === 'phase-production-build') return true;
    if (process.env.CI || process.env.BUILD_MODE) return true;
    const argv = process.argv.join(' ');
    return argv.includes('next build') || argv.includes('npm run build');
  }

  private static async performInitialization(): Promise<void> {
    try {
      console.log('[CABINET] Verifying database...');
      await this.verifyDatabase();
      console.log('[OK] Database verified');


      console.log('[INFO] Loading settings...');
      let settings;
      
      try {
        settings = await SettingsService.getSettings();
        if (!settings?.priceData || !settings?.currency) {
          throw new Error('Invalid settings structure');
        }
        console.log(`[INFO] Settings loaded: ${settings.currency.mainCurrency}`);
      } catch (error) {
        console.log('[WARN] Creating default settings...');
        settings = await SettingsService.resetToDefaults();
        console.log(`[INFO] Defaults created: ${settings.currency.mainCurrency}`);
      }

      console.log('[EXCHANGE] Initializing exchange rates...');
      try {
        await ExchangeRateService.ensureMainCurrencyRates();
        console.log('[OK] Exchange rates ready');
      } catch (error) {
        console.error('[WARN] Exchange rates failed:', error);
      }

      console.log('[UP] Starting historical data service...');
      try {
        await HistoricalDataService.initialize();
        console.log('[OK] Historical data ready');
      } catch (error) {
        console.error('[WARN] Historical data failed:', error);
      }

      console.log('[TIME] Starting price scheduler...');
      await PriceScheduler.start();
      const status = PriceScheduler.getStatus();
      console.log('[OK] Price scheduler started');

      console.log('[DCA] Starting DCA scheduler...');
      await DCAScheduler.start();
      const dcaStats = await DCAScheduler.getStatistics();
      console.log(`[DCA] Scheduler started (${dcaStats.active} active)`);

      this.setupShutdownHandlers();

    } catch (error) {
      console.error('[ERROR] Initialization failed:', error);
      throw error;
    }
  }

  private static setupShutdownHandlers(): void {
    if (this.shutdownHandlersSetup) return;
    this.shutdownHandlersSetup = true;

    const cleanup = () => {
      console.log('[STOP] Shutting down...');
      PriceScheduler.stop();
      DCAScheduler.stop();
      console.log('[OK] Stopped');
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('beforeExit', cleanup);
  }

  private static shutdownHandlersSetup = false;

  static getStatus() {
    // Always try to get scheduler status - it manages its own state
    const schedulerStatus = PriceScheduler.getStatus();
    
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.initPromise !== null && !this.isInitialized,
      schedulerStatus,
      // Include process info for debugging worker isolation issues
      processId: process.pid,
      uptime: process.uptime()
    };
  }

  static async restart(): Promise<void> {
    console.log('[SYNC] Restarting services...');
    PriceScheduler.stop();
    this.isInitialized = false;
    this.initPromise = null;
    await this.initialize();
    console.log('[OK] Restarted');
  }

  static async triggerDataUpdate(): Promise<void> {
    // Direct price update - doesn't need scheduler to be running
    // PriceScheduler.updateNow() just fetches and saves data directly
    console.log('[SYNC] Updating data...');
    await PriceScheduler.updateNow();
    console.log('[OK] Updated');
  }

  private static async verifyDatabase(): Promise<void> {
    // Database migrations are handled by docker-entrypoint.sh / migrate.sh
    // This just verifies the database is accessible and has the expected structure
    
    try {
      console.log('[SEARCH] Testing database connection...');
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log('[OK] Database connected');

      console.log('[SEARCH] Verifying database structure...');
      await this.verifyDatabaseStructure();
      console.log('[OK] Database structure verified');

    } catch (error) {
      console.error('[ERROR] Database verification failed:', error);
      console.error('[INFO] Database migrations should be run by the container entrypoint.');
      console.error('[INFO] If running locally, run: sh scripts/migrate.sh');
      throw new Error(`Database verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async verifyDatabaseStructure(): Promise<void> {
    try {
      // Quick check that core tables exist and are queryable
      await prisma.user.findFirst();
      await prisma.bitcoinTransaction.findFirst();
      await prisma.appSettings.findFirst();
      console.log('[OK] Tables verified');
    } catch (error) {
      console.error('[ERROR] Table verification failed:', error);
      throw new Error('Database structure is invalid or incomplete');
    }
  }
}
