import { PriceScheduler } from './price-scheduler';
import { DCAScheduler } from './dca-scheduler';
import { ExchangeRateService } from './exchange-rate-service';
import { HistoricalDataService } from './historical-data-service';
import { SettingsService } from './settings-service';
import { prisma } from './prisma';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

/**
 * App Initialization Service
 * Handles server-side initialization of background services
 * Following Next.js best practices for server startup
 */
export class AppInitializationService {
  private static isInitialized = false;
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialize the application (idempotent - safe to call multiple times)
   * Only runs during actual runtime, not during build time
   */
  static async initialize(): Promise<void> {
    // Skip initialization during build time
    if (this.isBuildTime()) {
      return;
    }

    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Skip if already initialized
    if (this.isInitialized) {
      return;
    }

    console.log('[START] Starting BTC Tracker application initialization...');

    // Create and store the initialization promise
    this.initPromise = this.performInitialization();
    
    try {
      await this.initPromise;
      this.isInitialized = true;
      console.log('[OK] BTC Tracker application initialized successfully');
    } catch (error) {
              console.error('[ERROR] BTC Tracker application initialization failed:', error);
      // Reset so it can be retried
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Check if we're in build time (Next.js static generation)
   */
  private static isBuildTime(): boolean {
    // Check for Next.js build phase
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return true;
    }
    
    // Check for common build environment indicators
    if (process.env.CI || process.env.BUILD_MODE) {
      return true;
    }
    
    // Check if we're in a build context by looking at the command line
    const argv = process.argv.join(' ');
    if (argv.includes('next build') || argv.includes('npm run build')) {
      return true;
    }
    
    return false;
  }

  /**
   * Perform the actual initialization steps
   */
  private static async performInitialization(): Promise<void> {
    try {
      // 1. Initialize database (ensure it exists and is up to date)
      console.log('[CABINET] Initializing database...');
      await this.initializeDatabase();
      console.log('[OK] Database initialized');

      // 2. Load application settings (with validation and fallback)
      console.log('[INFO] Loading application settings...');
      let settings;
      
      try {
        settings = await SettingsService.getSettings();
        
        // Validate settings structure
        if (!settings || !settings.priceData || !settings.currency || 
            typeof settings.priceData.liveUpdateInterval !== 'number' ||
            typeof settings.priceData.enableIntradayData !== 'boolean') {
          throw new Error('Settings validation failed: incomplete or corrupted settings');
        }
        
        console.log(`[INFO] Settings loaded: ${settings.currency.mainCurrency} main currency, scheduler interval: ${settings.priceData.liveUpdateInterval}s`);
        
      } catch (error) {
        console.log('[WARN] Settings invalid or missing, creating default settings...');
        console.log('Settings error:', error instanceof Error ? error.message : 'Unknown error');
        
        // Create default settings
        settings = await SettingsService.resetToDefaults();
        console.log(`[INFO] Default settings created: ${settings.currency.mainCurrency} main currency, scheduler interval: ${settings.priceData.liveUpdateInterval}s`);
      }

      // 3. Initialize core exchange rates (independent of Bitcoin data)
      console.log('[EXCHANGE] Initializing exchange rates...');
      try {
        await ExchangeRateService.ensureMainCurrencyRates();
        console.log('[OK] Exchange rates initialized');
      } catch (error) {
        console.error('[WARN] Exchange rate initialization failed (continuing):', error);
      }

      // 4. Start Historical Data Service
      console.log('[UP] Initializing historical data service...');
      try {
        await HistoricalDataService.initialize();
        console.log('[OK] Historical data service initialized');
      } catch (error) {
        console.error('[WARN] Historical data service initialization failed (continuing):', error);
      }

      // 5. Start Price Scheduler (most critical service)
      console.log('[TIME] Starting Bitcoin price scheduler...');
      await PriceScheduler.start();
      console.log('[OK] Bitcoin price scheduler started');
      
      // Log scheduler status
      const status = PriceScheduler.getStatus();
      console.log('[DATA] Scheduler status:', {
        isRunning: status.isRunning,
        intradayActive: status.intradayActive,
        historicalActive: status.historicalActive,
        exchangeRateActive: status.exchangeRateActive
      });

      // 6. Start DCA Scheduler (automatic recurring transactions)
      console.log('[DCA] Starting DCA scheduler...');
      await DCAScheduler.start();
      const dcaStatus = DCAScheduler.getStatus();
      const dcaStats = await DCAScheduler.getStatistics();
      console.log('[DCA] DCA scheduler started', {
        isRunning: dcaStatus.isRunning,
        checkIntervalMinutes: dcaStatus.checkIntervalMinutes,
        activeRecurring: dcaStats.active,
        totalExecutions: dcaStats.totalExecutions
      });

      // 7. Setup graceful shutdown handlers
      this.setupShutdownHandlers();

    } catch (error) {
      console.error('[BOOM] Critical error during app initialization:', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private static setupShutdownHandlers(): void {
    // Avoid duplicate listeners
    if (this.shutdownHandlersSetup) {
      return;
    }
    this.shutdownHandlersSetup = true;

    const cleanup = () => {
      console.log('[STOP] Shutting down BTC Tracker services...');
      PriceScheduler.stop();
      DCAScheduler.stop();
      console.log('[OK] Services stopped gracefully');
    };

    // Handle different termination signals
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('beforeExit', cleanup);
  }

  private static shutdownHandlersSetup = false;

  /**
   * Get initialization status
   */
  static getStatus() {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.initPromise !== null && !this.isInitialized,
      schedulerStatus: this.isInitialized ? PriceScheduler.getStatus() : null
    };
  }

  /**
   * Force restart services (for settings changes)
   */
  static async restart(): Promise<void> {
    console.log('[SYNC] Restarting BTC Tracker services...');
    
    // Stop existing services
    PriceScheduler.stop();
    
    // Reset initialization state
    this.isInitialized = false;
    this.initPromise = null;
    
    // Reinitialize
    await this.initialize();
    
    console.log('[OK] Services restarted successfully');
  }

  /**
   * Manual trigger for immediate data update
   */
  static async triggerDataUpdate(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('App not initialized. Call initialize() first.');
    }

    console.log('[SYNC] Manual data update triggered...');
    await PriceScheduler.updateNow();
    console.log('[OK] Manual data update completed');
  }

  /**
   * Initialize database - ensure it exists and run migrations
   */
  private static async initializeDatabase(): Promise<void> {
    try {
      // Test database connection
      console.log('[SEARCH] Testing database connection...');
      await prisma.$connect();
      
      // Check if database is accessible
      await prisma.$queryRaw`SELECT 1`;
      console.log('[OK] Database connection successful');

      // Run pending migrations
      console.log('[SYNC] Checking for database migrations...');
      try {
        execSync('npm exec prisma migrate deploy', { 
          stdio: 'pipe',
          cwd: process.cwd()
        });
        console.log('[OK] Database migrations completed');
      } catch (migrationError) {
        console.log('[WARN] Migration command failed, attempting database setup...');
        
        // If migrations fail, try to set up the database from scratch
        await this.setupFreshDatabase();
      }

      // Verify database structure
      console.log('[SEARCH] Verifying database structure...');
      await this.verifyDatabaseStructure();
      console.log('[OK] Database structure verified');

    } catch (error) {
      console.error('[ERROR] Database initialization failed:', error);
      
      // Try to set up fresh database as last resort
      console.log('[TOOL] Attempting fresh database setup...');
      await this.setupFreshDatabase();
    }
  }

  /**
   * Set up a fresh database when migrations fail
   */
  private static async setupFreshDatabase(): Promise<void> {
    try {
      console.log('[TOOL] Setting up fresh database...');
      
      // Note: Prisma client is already generated at build time
      console.log('[INFO] Using pre-generated Prisma client...');

      // Push schema to database (creates tables)
      console.log('[INFO] Creating database schema...');
      execSync('npm exec prisma db push --accept-data-loss', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });

      // Run seed data
      console.log('Setting up initial data...');
      try {
        execSync('npx tsx prisma/seed.ts', { 
          stdio: 'pipe',
          cwd: process.cwd()
        });
        console.log('[OK] Initial data seeded');
      } catch (seedError) {
        console.warn('[WARN] Seeding failed (continuing):', seedError);
      }

      console.log('[OK] Fresh database setup completed');
    } catch (error) {
      console.error('[ERROR] Fresh database setup failed:', error);
      throw new Error(`Database setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify database structure is correct
   */
  private static async verifyDatabaseStructure(): Promise<void> {
    try {
      // Test key tables exist and are accessible
      await prisma.user.findFirst();
      await prisma.bitcoinTransaction.findFirst();
      await prisma.appSettings.findFirst();
      console.log('[OK] Core database tables verified');
    } catch (error) {
      console.error('[ERROR] Database structure verification failed:', error);
      throw new Error('Database structure is invalid or incomplete');
    }
  }
} 