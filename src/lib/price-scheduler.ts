import { YahooFinanceService } from './yahoo-finance-service';
import { BitcoinPriceService } from './bitcoin-price-service';
import { ExchangeRateService } from './exchange-rate-service';
import { SettingsService } from './settings-service';

export class PriceScheduler {
  private static intradayInterval: NodeJS.Timeout | null = null;
  private static historicalInterval: NodeJS.Timeout | null = null;
  private static exchangeRateInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Start the price fetching scheduler
   * - Intraday: Based on user settings (default 5 minutes)
   * - Historical: Once per day (at startup and midnight)
   * - Exchange Rates: Every 4 hours
   */
  static async start() {
    if (this.isRunning) {
      console.log('Price scheduler is already running');
      return;
    }

    console.log('Starting Bitcoin price scheduler...');

    // Load settings to configure intervals
    const settings = await SettingsService.getSettings();
    console.log(`[INFO] Using settings: intraday ${settings.priceData.enableIntradayData ? 'enabled' : 'disabled'}, interval: ${settings.priceData.liveUpdateInterval}s`);

    this.isRunning = true;

    // Initial fetch on startup
    this.fetchInitialData();

    // Schedule intraday updates every hour
    if (settings.priceData.enableIntradayData) {
      const intervalMs = 60 * 60 * 1000; // 1 hour in milliseconds
      console.log(`[TIME] Scheduling hourly intraday updates (every hour)`);
      
      this.intradayInterval = setInterval(async () => {
        try {
          console.log('[DATA] Fetching hourly intraday Bitcoin data...');
          const intradayData = await YahooFinanceService.fetchIntradayData();
          
          if (intradayData.length > 0) {
            await YahooFinanceService.saveIntradayData(intradayData);
            
            // Update current price table with latest price and calculated changes
            const latestPrice = intradayData[intradayData.length - 1];
            await BitcoinPriceService.storeCurrentPriceWithChanges(latestPrice.price_usd, 'yahoo_finance');
            
            // Recalculate and store portfolio summary with new price
            await BitcoinPriceService.calculateAndStorePortfolioSummary(latestPrice.price_usd);
          }
        } catch (error) {
          console.error('Error in hourly intraday data fetch:', error);
        }
      }, intervalMs);
    } else {
      console.log('[INFO] Intraday data collection disabled in settings');
    }

    // Schedule historical updates once per day (24 hours)
    this.historicalInterval = setInterval(async () => {
      try {
        console.log('Fetching historical Bitcoin data...');
        await this.updateHistoricalData();
      } catch (error) {
        console.error('Error in historical price fetch:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Schedule exchange rate updates every 4 hours
    this.exchangeRateInterval = setInterval(async () => {
      try {
        console.log('Updating exchange rates...');
        await ExchangeRateService.updateAllExchangeRates();
      } catch (error) {
        console.error('Error updating exchange rates:', error);
      }
    }, 4 * 60 * 60 * 1000); // 4 hours

    console.log('Bitcoin price scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  static stop() {
    if (this.intradayInterval) {
      clearInterval(this.intradayInterval);
      this.intradayInterval = null;
    }

    if (this.historicalInterval) {
      clearInterval(this.historicalInterval);
      this.historicalInterval = null;
    }

    if (this.exchangeRateInterval) {
      clearInterval(this.exchangeRateInterval);
      this.exchangeRateInterval = null;
    }

    this.isRunning = false;
    console.log('Bitcoin price scheduler stopped');
  }

  /**
   * Fetch initial data on startup
   */
  private static async fetchInitialData() {
    try {
      console.log('[DATA] Fetching initial Bitcoin price data and exchange rates...');
      
      // Start exchange rate update first (independent of Bitcoin data)
      try {
        await ExchangeRateService.updateAllExchangeRates();
      } catch (error) {
        console.error('Error fetching initial exchange rates:', error);
      }
      
      // Always fetch current price from Yahoo Finance on startup
      try {
        console.log('[SYNC] Fetching current Bitcoin price from Yahoo Finance...');
        const currentPrice = await YahooFinanceService.fetchCurrentPrice();
        await BitcoinPriceService.storeCurrentPriceWithChanges(currentPrice, 'yahoo_finance');
        console.log(`[OK] Current Bitcoin price: $${currentPrice.toFixed(2)}`);
        
        // Calculate initial portfolio summary
        await BitcoinPriceService.calculateAndStorePortfolioSummary(currentPrice);
      } catch (error) {
        console.error('Error fetching current price:', error);
      }
      
      // Check if we have historical data
      const latestPrice = await YahooFinanceService.getLatestPrice();
      
      if (!latestPrice) {
        console.log('No existing historical data found, fetching initial dataset...');
        
        // Fetch historical data for the past year
        const historicalData = await YahooFinanceService.fetchHistoricalData('1y');
        if (historicalData.length > 0) {
          await YahooFinanceService.saveHistoricalData(historicalData);
        }

        // Fetch today's intraday data (hourly)
        const intradayData = await YahooFinanceService.fetchIntradayData();
        if (intradayData.length > 0) {
          await YahooFinanceService.saveIntradayData(intradayData);
          
          // Store current price with changes
          const currentPrice = intradayData[intradayData.length - 1];
          await BitcoinPriceService.storeCurrentPriceWithChanges(currentPrice.price_usd, 'yahoo_finance');
          
          // Calculate initial portfolio summary
          await BitcoinPriceService.calculateAndStorePortfolioSummary(currentPrice.price_usd);
        }
      } else {
        console.log(`Latest price found: $${latestPrice}, updating recent data...`);
        
        // Just fetch recent intraday data (hourly)
        const intradayData = await YahooFinanceService.fetchIntradayData();
        
        if (intradayData.length > 0) {
          await YahooFinanceService.saveIntradayData(intradayData);
          
          // Update current price table with latest price and calculated changes
          const currentPrice = intradayData[intradayData.length - 1];
          await BitcoinPriceService.storeCurrentPriceWithChanges(currentPrice.price_usd, 'yahoo_finance');
          
          // Recalculate and store portfolio summary with new price
          await BitcoinPriceService.calculateAndStorePortfolioSummary(currentPrice.price_usd);
        }
      }
      
      console.log('Initial Bitcoin price data and exchange rates fetch completed');
    } catch (error) {
      console.error('Error fetching initial Bitcoin price data and exchange rates:', error);
    }
  }

  /**
   * Update historical data (fetch recent days to keep database current)
   */
  private static async updateHistoricalData() {
    try {
      // Fetch last 30 days to ensure we have recent historical data
      const recentHistorical = await YahooFinanceService.fetchHistoricalData('1mo');
      
      if (recentHistorical.length > 0) {
        await YahooFinanceService.saveHistoricalData(recentHistorical);
      }
    } catch (error) {
      console.error('Error updating historical data:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for immediate price update (useful for API endpoints)
   */
  static async updateNow(): Promise<void> {
    try {
      console.log('Manual Bitcoin price update triggered...');
      
      // Fetch current intraday data
      const intradayData = await YahooFinanceService.fetchIntradayData();
      
      if (intradayData.length > 0) {
        await YahooFinanceService.saveIntradayData(intradayData);
        
        // Update current price table with latest price and calculated changes
        const latestPrice = intradayData[intradayData.length - 1];
        await BitcoinPriceService.storeCurrentPriceWithChanges(latestPrice.price_usd, 'yahoo_finance');
        
        // Recalculate and store portfolio summary with new price
        await BitcoinPriceService.calculateAndStorePortfolioSummary(latestPrice.price_usd);
      }
      
      console.log('Manual Bitcoin price update completed');
    } catch (error) {
      console.error('Error in manual price update:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      intradayActive: this.intradayInterval !== null,
      historicalActive: this.historicalInterval !== null,
      exchangeRateActive: this.exchangeRateInterval !== null
    };
  }
} 