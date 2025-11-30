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
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.initPromise !== null && !this.isInitialized,
      schedulerStatus: this.isInitialized ? PriceScheduler.getStatus() : null
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
    if (!this.isInitialized) throw new Error('Not initialized');
    console.log('[SYNC] Updating data...');
    await PriceScheduler.updateNow();
    console.log('[OK] Updated');
  }

  private static async verifyDatabase(): Promise<void> {
    // Auto-setup database in dev if it doesn't exist
    if (process.env.NODE_ENV !== 'production') {
      const { existsSync } = require('fs');
      const dbUrl = process.env.DATABASE_URL || '';
      
      if (dbUrl.startsWith('file:')) {
        const dbPath = dbUrl.replace('file:', '');
        if (!existsSync(dbPath)) {
          console.log('[DEV] Database not found - setting up...');
          try {
            await this.setupDatabaseForDev();
            console.log('[OK] Database ready');
            return;
          } catch (setupError) {
            console.error('[ERROR] Setup failed:', setupError);
            throw new Error('Failed to setup database for development');
          }
        }
      }
    }

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
      console.error('[INFO] Please run: npx prisma migrate deploy');
      throw new Error(`Database verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async setupDatabaseForDev(): Promise<void> {
    const { execSync } = require('child_process');
    
    console.log('[DEV] Running migrations...');
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('[DEV] Verifying tables...');
    await this.verifyDatabaseStructure();
  }

  private static async verifyDatabaseStructure(): Promise<void> {
    try {
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
