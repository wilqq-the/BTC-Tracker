import { PriceScheduler } from './price-scheduler';
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

    console.log('🚀 Starting BTC Tracker application initialization...');

    // Create and store the initialization promise
    this.initPromise = this.performInitialization();
    
    try {
      await this.initPromise;
      this.isInitialized = true;
      console.log('✅ BTC Tracker application initialized successfully');
    } catch (error) {
              console.error('❌ BTC Tracker application initialization failed:', error);
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
      console.log('🗄️ Initializing database...');
      await this.initializeDatabase();
      console.log('✅ Database initialized');

      // 2. Load application settings (with validation and fallback)
      console.log('📋 Loading application settings...');
      let settings;
      
      try {
        settings = await SettingsService.getSettings();
        
        // Validate settings structure
        if (!settings || !settings.priceData || !settings.currency || 
            typeof settings.priceData.liveUpdateInterval !== 'number' ||
            typeof settings.priceData.enableIntradayData !== 'boolean') {
          throw new Error('Settings validation failed: incomplete or corrupted settings');
        }
        
        console.log(`📋 Settings loaded: ${settings.currency.mainCurrency} main currency, scheduler interval: ${settings.priceData.liveUpdateInterval}s`);
        
      } catch (error) {
        console.log('⚠️ Settings invalid or missing, creating default settings...');
        console.log('Settings error:', error instanceof Error ? error.message : 'Unknown error');
        
        // Create default settings
        settings = await SettingsService.resetToDefaults();
        console.log(`📋 Default settings created: ${settings.currency.mainCurrency} main currency, scheduler interval: ${settings.priceData.liveUpdateInterval}s`);
      }

      // 3. Initialize core exchange rates (independent of Bitcoin data)
      console.log('💱 Initializing exchange rates...');
      try {
        await ExchangeRateService.ensureMainCurrencyRates();
        console.log('✅ Exchange rates initialized');
      } catch (error) {
        console.error('⚠️ Exchange rate initialization failed (continuing):', error);
      }

      // 4. Start Historical Data Service
      console.log('📈 Initializing historical data service...');
      try {
        await HistoricalDataService.initialize();
        console.log('✅ Historical data service initialized');
      } catch (error) {
        console.error('⚠️ Historical data service initialization failed (continuing):', error);
      }

      // 5. Start Price Scheduler (most critical service)
      console.log('⏰ Starting Bitcoin price scheduler...');
      await PriceScheduler.start();
      console.log('✅ Bitcoin price scheduler started');
      
      // Log scheduler status
      const status = PriceScheduler.getStatus();
      console.log('📊 Scheduler status:', {
        isRunning: status.isRunning,
        intradayActive: status.intradayActive,
        historicalActive: status.historicalActive,
        exchangeRateActive: status.exchangeRateActive
      });

      // 6. Setup graceful shutdown handlers
      this.setupShutdownHandlers();

    } catch (error) {
      console.error('💥 Critical error during app initialization:', error);
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
      console.log('🛑 Shutting down BTC Tracker services...');
      PriceScheduler.stop();
      console.log('✅ Services stopped gracefully');
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
    console.log('🔄 Restarting BTC Tracker services...');
    
    // Stop existing services
    PriceScheduler.stop();
    
    // Reset initialization state
    this.isInitialized = false;
    this.initPromise = null;
    
    // Reinitialize
    await this.initialize();
    
    console.log('✅ Services restarted successfully');
  }

  /**
   * Manual trigger for immediate data update
   */
  static async triggerDataUpdate(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('App not initialized. Call initialize() first.');
    }

    console.log('🔄 Manual data update triggered...');
    await PriceScheduler.updateNow();
    console.log('✅ Manual data update completed');
  }

  /**
   * Initialize database - ensure it exists and run migrations
   */
  private static async initializeDatabase(): Promise<void> {
    try {
      // Test database connection
      console.log('🔍 Testing database connection...');
      await prisma.$connect();
      
      // Check if database is accessible
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection successful');

      // Run pending migrations
      console.log('🔄 Checking for database migrations...');
      try {
        execSync('npx prisma migrate deploy', { 
          stdio: 'pipe',
          cwd: process.cwd()
        });
        console.log('✅ Database migrations completed');
      } catch (migrationError) {
        console.log('⚠️ Migration command failed, attempting database setup...');
        
        // If migrations fail, try to set up the database from scratch
        await this.setupFreshDatabase();
      }

      // Verify database structure
      console.log('🔍 Verifying database structure...');
      await this.verifyDatabaseStructure();
      console.log('✅ Database structure verified');

    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      
      // Try to set up fresh database as last resort
      console.log('🔧 Attempting fresh database setup...');
      await this.setupFreshDatabase();
    }
  }

  /**
   * Set up a fresh database when migrations fail
   */
  private static async setupFreshDatabase(): Promise<void> {
    try {
      console.log('🔧 Setting up fresh database...');
      
      // Generate Prisma client
      console.log('📋 Generating Prisma client...');
      execSync('npx prisma generate', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });

      // Push schema to database (creates tables)
      console.log('📋 Creating database schema...');
      execSync('npx prisma db push --accept-data-loss', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });

      // Run seed data
      console.log('🌱 Setting up initial data...');
      try {
        execSync('npx tsx prisma/seed.ts', { 
          stdio: 'pipe',
          cwd: process.cwd()
        });
        console.log('✅ Initial data seeded');
      } catch (seedError) {
        console.warn('⚠️ Seeding failed (continuing):', seedError);
      }

      console.log('✅ Fresh database setup completed');
    } catch (error) {
      console.error('❌ Fresh database setup failed:', error);
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
      console.log('✅ Core database tables verified');
    } catch (error) {
      console.error('❌ Database structure verification failed:', error);
      throw new Error('Database structure is invalid or incomplete');
    }
  }
} 