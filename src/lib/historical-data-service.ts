import { prisma } from './prisma';
import { SettingsService } from './settings-service';

export class HistoricalDataService {
  private static isInitialized = false;
  private static fetchInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the historical data service
   */
  static async initialize() {
    if (this.isInitialized) {
      console.log('Historical data service already initialized');
      return;
    }

    try {
      console.log('🏛️ Initializing Historical Data Service...');
      
      // Check if we have any historical data
      const hasData = await this.checkHistoricalDataExists();
      
      if (!hasData) {
        console.log('📊 No historical data found, fetching default 1Y data...');
        await this.fetchHistoricalDataFromSettings();
      } else {
        // Check if data is fresh (within last 2 days)
        const isDataFresh = await this.checkDataFreshness();
        
        if (!isDataFresh) {
          console.log('📊 Historical data is stale, updating with recent data...');
          await this.updateLatestData();
        } else {
          console.log('✅ Historical data is fresh and up to date');
        }
      }

      // Set up periodic data updates (daily)
      this.setupPeriodicUpdates();
      
      this.isInitialized = true;
      console.log('🏛️ Historical Data Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Historical Data Service:', error);
    }
  }

  /**
   * Check if historical data exists in the database
   */
  private static async checkHistoricalDataExists(): Promise<boolean> {
    try {
      const count = await prisma.bitcoinPriceHistory.count();
      return count > 0;
    } catch (error) {
      console.error('Error checking historical data existence:', error);
      throw error;
    }
  }

  /**
   * Convert app period to Yahoo Finance period format
   */
  private static getYahooFinancePeriod(period: string): string {
    switch (period) {
      case '3M': return '3mo';
      case '6M': return '6mo';
      case '1Y': return '1y';
      case '2Y': return '2y';
      case '5Y': return '5y';
      case 'ALL': return '10y'; // Use 10y instead of max to ensure daily data
      default: return '1y';
    }
  }

  /**
   * Replace all historical data with new data
   */
  private static async replaceHistoricalData(historicalData: any[]): Promise<void> {
    try {
      // Clear existing data first
      await prisma.bitcoinPriceHistory.deleteMany();
      console.log('🗑️  Cleared existing historical data');
      
      // Insert new data using Prisma createMany for efficiency
      await prisma.bitcoinPriceHistory.createMany({
        data: historicalData.map(record => ({
          date: record.date,
          openUsd: record.open_usd,
          highUsd: record.high_usd,
          lowUsd: record.low_usd,
          closeUsd: record.close_usd,
          volume: record.volume || 0
        }))
      });
      
      console.log(`💾 Saved ${historicalData.length} historical price records`);
    } catch (error) {
      console.error('Error replacing historical data:', error);
      throw error;
    }
  }

  /**
   * Check if historical data is fresh (within last 2 days, accounting for weekends)
   */
  private static async checkDataFreshness(): Promise<boolean> {
    try {
      // Get the latest record and calculate days old manually
      const latestRecord = await prisma.bitcoinPriceHistory.findFirst({
        orderBy: { date: 'desc' },
        select: { date: true }
      });
      
      if (!latestRecord) {
        console.log('📅 No historical data found');
        return false;
      }
      
      // Calculate days old manually
      const recordDate = new Date(latestRecord.date);
      const now = new Date();
      const daysOld = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Check if daysOld is valid
      if (isNaN(daysOld)) {
        console.log('📅 No valid historical data found');
        return false;
      }
      
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // If it's Monday (1), allow up to 3 days old (Friday data)
      // If it's Tuesday (2), allow up to 2 days old (Sunday data, though unlikely)
      // Otherwise, allow up to 2 days old
      let maxAllowedAge = 2;
      if (dayOfWeek === 1) { // Monday
        maxAllowedAge = 3; // Allow Friday's data
      } else if (dayOfWeek === 2) { // Tuesday
        maxAllowedAge = 2; // Allow Sunday's data (if available)
      }
      
      const isFresh = daysOld <= maxAllowedAge;
      console.log(`📅 Latest data is ${daysOld.toFixed(1)} days old (${latestRecord.date}), fresh: ${isFresh}`);
      return isFresh;
    } catch (error) {
      console.error('Error checking data freshness:', error);
      throw error;
    }
  }

  /**
   * Fetch historical data based on current settings
   */
  static async fetchHistoricalDataFromSettings(): Promise<void> {
    try {
      const settings = await SettingsService.getSettings();
      const period = settings.priceData.historicalDataPeriod;
      
      console.log(`📊 Fetching historical data for period: ${period}`);
      
      // Convert app period to Yahoo Finance period
      const yahooFinancePeriod = this.getYahooFinancePeriod(period);
      
      // Fetch data directly from Yahoo Finance
      const { YahooFinanceService } = await import('./yahoo-finance-service');
      const historicalData = await YahooFinanceService.fetchHistoricalData(yahooFinancePeriod);
      
      console.log(`📊 Fetched ${historicalData.length} historical records`);

      // Clear existing historical data and insert new data
      await this.replaceHistoricalData(historicalData);
      
      console.log(`✅ Historical data fetch completed: ${historicalData.length} records`);
    } catch (error) {
      console.error('❌ Error fetching historical data from settings:', error);
    }
  }

  /**
   * Set up periodic updates for historical data
   */
  private static setupPeriodicUpdates() {
    // Clear any existing interval
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
    }

    // Calculate time until next 6 AM (after market data is usually available)
    const now = new Date();
    const next6AM = new Date();
    next6AM.setHours(6, 0, 0, 0);
    
    // If it's already past 6 AM today, schedule for 6 AM tomorrow
    if (now >= next6AM) {
      next6AM.setDate(next6AM.getDate() + 1);
    }
    
    const msUntil6AM = next6AM.getTime() - now.getTime();
    
    console.log(`⏰ Scheduling daily historical data updates for 6:00 AM (next update in ${Math.round(msUntil6AM / 1000 / 60 / 60)} hours)`);
    
    // Set timeout for first update at 6 AM
    setTimeout(() => {
      // Run the first scheduled update
      this.updateLatestData();
      
      // Then set up daily interval (every 24 hours)
      this.fetchInterval = setInterval(async () => {
        console.log('🔄 Running scheduled daily historical data update at 6:00 AM...');
        await this.updateLatestData();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, msUntil6AM);
  }

  /**
   * Update only the latest historical data (last few days)
   */
  private static async updateLatestData(): Promise<void> {
    try {
      console.log('🔄 Updating latest historical data...');
      
      // Fetch last 30 days to ensure we have recent data (Yahoo Finance uses 1mo for 30 days)
      const { YahooFinanceService } = await import('./yahoo-finance-service');
      const recentData = await YahooFinanceService.fetchHistoricalData('1mo');
      
      console.log(`📊 Fetched ${recentData.length} recent historical records`);

      // Save the recent data (will update existing records with same dates)
      await YahooFinanceService.saveHistoricalData(recentData);
      
      console.log(`✅ Daily historical data update completed: ${recentData.length} records processed`);
    } catch (error) {
      console.error('❌ Error updating latest historical data:', error);
    }
  }

  /**
   * Get historical data for a specific period
   */
  static async getHistoricalData(days: number = 365): Promise<any[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      const records = await prisma.bitcoinPriceHistory.findMany({
        where: {
          date: { gte: cutoffDateStr }
        },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          openUsd: true,
          highUsd: true,
          lowUsd: true,
          closeUsd: true,
          volume: true
        }
      });
      
      // Convert Prisma camelCase back to snake_case for compatibility
      return records.map(record => ({
        date: record.date,
        open_usd: record.openUsd,
        high_usd: record.highUsd,
        low_usd: record.lowUsd,
        close_usd: record.closeUsd,
        volume: record.volume
      }));
    } catch (error) {
      console.error('Error getting historical data:', error);
      throw error;
    }
  }

  /**
   * Get the latest historical data point
   */
  static async getLatestHistoricalPrice(): Promise<number | null> {
    try {
      const record = await prisma.bitcoinPriceHistory.findFirst({
        orderBy: { date: 'desc' },
        select: { closeUsd: true }
      });
      
      return record ? record.closeUsd : null;
    } catch (error) {
      console.error('Error getting latest historical price:', error);
      throw error;
    }
  }

  /**
   * Force an immediate update of historical data (useful for manual triggers)
   */
  static async forceUpdate(): Promise<{ success: boolean; message: string; recordsAdded?: number }> {
    try {
      console.log('🔄 Force updating historical data...');
      
      // Fetch last 30 days to ensure we have recent data
      const { YahooFinanceService } = await import('./yahoo-finance-service');
      const recentData = await YahooFinanceService.fetchHistoricalData('1mo');
      
      console.log(`📊 Fetched ${recentData.length} recent historical records for force update`);

      // Save the recent data
      await YahooFinanceService.saveHistoricalData(recentData);
      
      const message = `✅ Force update completed: ${recentData.length} records processed`;
      console.log(message);
      return {
        success: true,
        message,
        recordsAdded: recentData.length
      };
    } catch (error) {
      const message = `❌ Error during force update: ${error}`;
      console.error(message);
      return {
        success: false,
        message
      };
    }
  }

  /**
   * Clean up old historical data based on retention settings
   */
  static async cleanupOldData(): Promise<void> {
    try {
      const settings = await SettingsService.getSettings();
      const retentionDays = settings.priceData.dataRetentionDays;
      
      if (retentionDays > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        
        const result = await prisma.bitcoinPriceHistory.deleteMany({
          where: {
            date: { lt: cutoffDateStr }
          }
        });
        
        console.log(`🗑️ Cleaned up ${result.count} old historical records (older than ${retentionDays} days)`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old historical data:', error);
    }
  }

  /**
   * Stop the historical data service
   */
  static stop() {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = null;
    }
    this.isInitialized = false;
    console.log('🛑 Historical Data Service stopped');
  }
} 