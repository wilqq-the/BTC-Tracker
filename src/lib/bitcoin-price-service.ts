import { prisma } from './prisma';

export interface BitcoinPriceData {
  price: number;
  timestamp: string;
  source: 'database' | 'fallback';
  priceChange24h?: number;
  priceChangePercent24h?: number;
}

export interface PortfolioSummaryData {
  totalBTC: number;
  totalTransactions: number;
  totalSatoshis: number;
  
  // Main currency values (based on user settings)
  mainCurrency: string;
  totalInvestedMain: number;
  totalFeesMain: number;
  averageBuyPriceMain: number;
  currentBTCPriceMain: number;
  currentPortfolioValueMain: number;
  unrealizedPnLMain: number;
  unrealizedPnLPercentage: number;
  portfolioChange24hMain: number;
  portfolioChange24hPercentage: number;
  
  // Secondary currency values (for display)
  secondaryCurrency: string;
  totalInvestedSecondary: number;
  totalFeesSecondary: number;
  averageBuyPriceSecondary: number;
  currentBTCPriceSecondary: number;
  currentPortfolioValueSecondary: number;
  unrealizedPnLSecondary: number;
  portfolioChange24hSecondary: number;
  
  // Legacy USD fields (for backward compatibility)
  totalInvestedUSD: number;
  totalFeesUSD: number;
  averageBuyPriceUSD: number;
  currentBTCPriceUSD: number;
  currentPortfolioValueUSD: number;
  unrealizedPnLUSD: number;
  unrealizedPnLPercent: number;
  portfolioChange24hUSD: number;
  portfolioChange24hPercent: number;
  currentValueEUR: number;
  currentValuePLN: number;
  
  lastUpdated: string;
  lastPriceUpdate: string;
}

export class BitcoinPriceService {
  private static cachedPrice: BitcoinPriceData | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache

  // Cache for current price to avoid repeated database calls
  private static currentPriceCache: { price: number; timestamp: number } | null = null;
  private static readonly PRICE_CACHE_DURATION = 30000; // 30 seconds

  // Debouncing for portfolio calculations
  private static portfolioCalculationTimeout: NodeJS.Timeout | null = null;
  private static readonly PORTFOLIO_DEBOUNCE_MS = 2000; // 2 seconds

  // Rate limiting for portfolio calculations
  private static lastPortfolioCalculation = 0;
  private static readonly MIN_PORTFOLIO_CALCULATION_INTERVAL = 5000; // 5 seconds

  /**
   * Store current price with calculated daily changes
   */
  static async storeCurrentPriceWithChanges(price: number, source: string = 'api'): Promise<void> {
    try {
      // Calculate 24h change
      const priceChange = await this.calculate24hPriceChange(price);
      
      // Store in bitcoin_current_price table using Prisma
      await prisma.bitcoinCurrentPrice.upsert({
        where: { id: 1 },
        update: {
          priceUsd: price,
          priceChange24hUsd: priceChange.change,
          priceChange24hPercent: priceChange.changePercent,
          timestamp: new Date().toISOString(),
          source: source
        },
        create: {
          id: 1,
          priceUsd: price,
          priceChange24hUsd: priceChange.change,
          priceChange24hPercent: priceChange.changePercent,
          timestamp: new Date().toISOString(),
          source: source
        }
      });
      console.log(`Stored current price: $${price} with ${priceChange.changePercent.toFixed(2)}% change`);

      // Update today's historical record with current price
      await this.updateTodaysHistoricalRecord(price);
      
    } catch (error) {
      console.error('Error storing current price with changes:', error);
      throw error;
    }
  }

  /**
   * Update today's historical record with current live price
   * This ensures charts show real-time data for the current day
   */
  static async updateTodaysHistoricalRecord(currentPrice: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Check if we have a record for today using Prisma
      const existingRecord = await prisma.bitcoinPriceHistory.findUnique({
        where: { date: today }
      });

      if (existingRecord) {
        // Update existing record: keep open/high/low, update close and volume
        const newHigh = Math.max(existingRecord.highUsd, currentPrice);
        const newLow = Math.min(existingRecord.lowUsd, currentPrice);
        
        await prisma.bitcoinPriceHistory.update({
          where: { date: today },
          data: {
            closeUsd: currentPrice,
            highUsd: newHigh,
            lowUsd: newLow
          }
        });
        console.log(`📊 Updated today's historical record (${today}) with live price: $${currentPrice}`);
      } else {
        // Create new record for today (open = close = current price initially)
        await prisma.bitcoinPriceHistory.create({
          data: {
            date: today,
            openUsd: currentPrice,
            highUsd: currentPrice,
            lowUsd: currentPrice,
            closeUsd: currentPrice,
            volume: 0
          }
        });
        console.log(`📊 Created today's historical record (${today}) with live price: $${currentPrice}`);
      }
    } catch (error) {
      console.error('Error updating today\'s historical record:', error);
      // Don't throw - this is supplementary functionality
    }
  }

  /**
   * Get current price with pre-calculated daily changes from table
   */
  static async getCurrentPriceFromTable(): Promise<BitcoinPriceData | null> {
    try {
      const record = await prisma.bitcoinCurrentPrice.findFirst({
        where: { id: 1 },
        orderBy: { updatedAt: 'desc' }
      });

      if (record) {
        return {
          price: record.priceUsd,
          timestamp: record.timestamp,
          source: record.source as 'database' | 'fallback',
          priceChange24h: record.priceChange24hUsd,
          priceChangePercent24h: record.priceChange24hPercent
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting current price from table:', error);
      throw error;
    }
  }

  /**
   * Updated getCurrentPrice method - now uses pre-calculated data from table
   */
  static async getCurrentPrice(): Promise<BitcoinPriceData> {
    const now = Date.now();
    
    // Return cached price if still valid
    if (this.cachedPrice && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedPrice;
    }

    try {
      // First try to get pre-calculated data from current price table
      const currentPriceData = await this.getCurrentPriceFromTable();
      
      if (currentPriceData) {
        this.cachedPrice = currentPriceData;
        this.cacheTimestamp = now;
        return this.cachedPrice;
      }

      // Fallback to old method if no data in current price table
      const latestPrice = await this.getLatestIntradayPrice();
      
      if (latestPrice) {
        const priceChange = await this.calculate24hPriceChange(latestPrice.price);
        
        this.cachedPrice = {
          price: latestPrice.price,
          timestamp: latestPrice.timestamp,
          source: 'database',
          priceChange24h: priceChange.change,
          priceChangePercent24h: priceChange.changePercent
        };
        this.cacheTimestamp = now;
        return this.cachedPrice;
      }

      // Final fallback
      throw new Error('No price data available');
      
    } catch (error) {
      console.error('Error fetching Bitcoin price:', error);
      
      const fallbackPrice = {
        price: 105000,
        timestamp: new Date().toISOString(),
        source: 'fallback' as const,
        priceChange24h: 0,
        priceChangePercent24h: 0
      };
      
      this.cachedPrice = fallbackPrice;
      this.cacheTimestamp = now;
      return fallbackPrice;
    }
  }

  /**
   * Calculate 24h price change
   */
  private static async calculate24hPriceChange(currentPrice: number): Promise<{ change: number; changePercent: number }> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Try to get price from 24h ago
      const price24hAgo = await this.getPriceForDate(yesterdayStr);
      
      if (price24hAgo && price24hAgo > 0) {
        const change = currentPrice - price24hAgo;
        const changePercent = (change / price24hAgo) * 100;
        return { change, changePercent };
      }
      
      return { change: 0, changePercent: 0 };
    } catch (error) {
      console.error('Error calculating 24h price change:', error);
      return { change: 0, changePercent: 0 };
    }
  }

  /**
   * Get the latest price from intraday data (most recent)
   */
  private static async getLatestIntradayPrice(): Promise<{ price: number; timestamp: string } | null> {
    try {
      const record = await prisma.bitcoinPriceIntraday.findFirst({
        orderBy: { timestamp: 'desc' }
      });

      if (record) {
        return {
          price: record.priceUsd,
          timestamp: typeof record.timestamp === 'string' ? record.timestamp : record.timestamp.toISOString()
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting latest intraday price:', error);
      throw error;
    }
  }

  /**
   * Get the latest price from historical data (daily close)
   */
  private static async getLatestHistoricalPrice(): Promise<{ price: number; timestamp: string } | null> {
    try {
      const record = await prisma.bitcoinPriceHistory.findFirst({
        orderBy: { date: 'desc' }
      });

      if (record) {
        return {
          price: record.closeUsd,
          timestamp: record.date + 'T23:59:59Z' // End of day
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting latest historical price:', error);
      throw error;
    }
  }

  /**
   * Force refresh the cached price (useful after known price updates)
   */
  static clearCache(): void {
    this.cachedPrice = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get price for a specific date (for historical calculations)
   */
  static async getPriceForDate(date: string): Promise<number | null> {
    try {
      // First try historical data (exact date match)
      let record = await prisma.bitcoinPriceHistory.findUnique({
        where: { date: date }
      });

      if (record) {
        return record.closeUsd;
      }

      // Fallback to nearest date
      record = await prisma.bitcoinPriceHistory.findFirst({
        where: { date: { lte: date } },
        orderBy: { date: 'desc' }
      });

      return record ? record.closeUsd : null;
    } catch (error) {
      console.error('Error getting price for date:', error);
      throw error;
    }
  }

  /**
   * Subscribe to price updates (for real-time components)
   */
  static onPriceUpdate(callback: (price: BitcoinPriceData) => void): () => void {
    // Simple polling implementation
    const interval = setInterval(async () => {
      try {
        this.clearCache(); // Force fresh data
        const newPrice = await this.getCurrentPrice();
        callback(newPrice);
      } catch (error) {
        console.error('Error in price update subscription:', error);
      }
    }, 60000); // Update every minute

    // Return cleanup function
    return () => clearInterval(interval);
  }

  /**
   * Calculate and store complete portfolio summary
   */
  static async calculateAndStorePortfolioSummary(currentBTCPrice?: number): Promise<void> {
    try {
      // Get current BTC price if not provided
      if (!currentBTCPrice) {
        const priceData = await this.getCurrentPriceFromTable();
        currentBTCPrice = priceData?.price || 105000; // fallback
      }

      // Load user settings for currency preferences
      const { SettingsService } = await import('@/lib/settings-service');
      const settings = await SettingsService.getSettings();
      const mainCurrency = settings.currency.mainCurrency;
      const secondaryCurrency = settings.currency.secondaryCurrency;

      // Calculate portfolio data from transactions
      const portfolioData = await this.calculatePortfolioFromTransactions(currentBTCPrice, mainCurrency, secondaryCurrency);
      
      // Calculate 24h portfolio change
      const portfolio24hChange = await this.calculatePortfolio24hChange(portfolioData, currentBTCPrice);
      
      // Store in portfolio_summary table
      await this.storePortfolioSummary({
        ...portfolioData,
        portfolioChange24hMain: portfolio24hChange.changeMain,
        portfolioChange24hPercentage: portfolio24hChange.changePercent,
        portfolioChange24hSecondary: portfolio24hChange.changeSecondary,
        // Legacy fields
        portfolioChange24hUSD: portfolio24hChange.changeUSD,
        portfolioChange24hPercent: portfolio24hChange.changePercent,
        lastUpdated: new Date().toISOString(),
        lastPriceUpdate: new Date().toISOString()
      });

      console.log(`Portfolio summary updated: ${portfolioData.currentPortfolioValueMain.toFixed(2)} ${mainCurrency} (${portfolio24hChange.changePercent.toFixed(2)}% 24h)`);
      
    } catch (error) {
      console.error('Error calculating and storing portfolio summary:', error);
      throw error;
    }
  }

  /**
   * Calculate portfolio data from transactions table
   */
  private static async calculatePortfolioFromTransactions(currentBTCPrice: number, mainCurrency: string, secondaryCurrency: string): Promise<Omit<PortfolioSummaryData, 'portfolioChange24hUSD' | 'portfolioChange24hPercent' | 'lastUpdated' | 'lastPriceUpdate' | 'portfolioChange24hMain' | 'portfolioChange24hPercentage' | 'portfolioChange24hSecondary'>> {
    try {
      // Get exchange rates for currency conversion (cached)
      const { ExchangeRateService } = await import('@/lib/exchange-rate-service');
      
      // Batch exchange rate calls to reduce I/O
      const [usdToMainRate, usdToSecondaryRate] = await Promise.all([
        ExchangeRateService.getExchangeRate('USD', mainCurrency),
        ExchangeRateService.getExchangeRate('USD', secondaryCurrency)
      ]);

      // Get all transactions and aggregate data in parallel to reduce I/O
      const [aggregateData, buyTransactions, sellTransactions] = await Promise.all([
        prisma.bitcoinTransaction.aggregate({
          _count: { id: true },
          _sum: {
            btcAmount: true,
            fees: true
          }
        }),
        prisma.bitcoinTransaction.findMany({
          where: { type: 'BUY' },
          select: {
            btcAmount: true,
            originalPricePerBtc: true,
            originalTotalAmount: true,
            originalCurrency: true
          }
        }),
        prisma.bitcoinTransaction.findMany({
          where: { type: 'SELL' },
          select: {
            btcAmount: true
          }
        })
      ]);

      // Calculate total BTC (BUY - SELL)
      const totalBuyBTC = buyTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
      const totalSellBTC = sellTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
      const totalBTC = totalBuyBTC - totalSellBTC;
      const totalSatoshis = Math.round(totalBTC * 100000000);
      const totalFeesUSD = aggregateData._sum.fees || 0;

      // Batch exchange rate lookups by currency to reduce I/O
      const uniqueCurrencies = Array.from(new Set(buyTransactions.map(tx => tx.originalCurrency)));
      const exchangeRatePromises = uniqueCurrencies.map(currency => 
        ExchangeRateService.getExchangeRate(currency, 'USD').catch(error => {
          console.warn(`Failed to get exchange rate for ${currency}, using 1.0:`, error);
          return 1.0; // Fallback rate
        })
      );
      
      const exchangeRates = await Promise.all(exchangeRatePromises);
      const currencyToRateMap = Object.fromEntries(
        uniqueCurrencies.map((currency, index) => [currency, exchangeRates[index]])
      );

      // Calculate totals using batched exchange rates
      let totalInvestedUSD = 0;
      let totalBuyValueUSD = 0;
      let buyCount = 0;

      for (const tx of buyTransactions) {
        const exchangeRate = currencyToRateMap[tx.originalCurrency] || 1.0;
        const usdTotal = tx.originalTotalAmount * exchangeRate;
        const usdPrice = tx.originalPricePerBtc * exchangeRate;

        totalInvestedUSD += usdTotal;
        totalBuyValueUSD += usdPrice;
        buyCount++;
      }

      const avgBuyPriceUSD = buyCount > 0 ? totalBuyValueUSD / buyCount : 0;
      
      // Convert to main currency
      const totalInvestedMain = totalInvestedUSD * usdToMainRate;
      const totalFeesMain = totalFeesUSD * usdToMainRate;
      const averageBuyPriceMain = avgBuyPriceUSD * usdToMainRate;
      const currentBTCPriceMain = currentBTCPrice * usdToMainRate;
      const currentPortfolioValueMain = totalBTC * currentBTCPriceMain;
      const unrealizedPnLMain = currentPortfolioValueMain - totalInvestedMain;
      const unrealizedPnLPercentage = totalInvestedMain > 0 ? (unrealizedPnLMain / totalInvestedMain) * 100 : 0;
      
      // Convert to secondary currency
      const totalInvestedSecondary = totalInvestedUSD * usdToSecondaryRate;
      const totalFeesSecondary = totalFeesUSD * usdToSecondaryRate;
      const averageBuyPriceSecondary = avgBuyPriceUSD * usdToSecondaryRate;
      const currentBTCPriceSecondary = currentBTCPrice * usdToSecondaryRate;
      const currentPortfolioValueSecondary = totalBTC * currentBTCPriceSecondary;
      const unrealizedPnLSecondary = currentPortfolioValueSecondary - totalInvestedSecondary;
      
      // Calculate current values (legacy fields)
      const currentPortfolioValueUSD = totalBTC * currentBTCPrice;
      const unrealizedPnLUSD = currentPortfolioValueUSD - totalInvestedUSD;
      const unrealizedPnLPercent = totalInvestedUSD > 0 ? (unrealizedPnLUSD / totalInvestedUSD) * 100 : 0;
      
      // Legacy EUR/PLN values (hardcoded for backward compatibility)
      const currentValueEUR = currentPortfolioValueUSD * 0.85;
      const currentValuePLN = currentPortfolioValueUSD * 3.7;

      console.log(`Portfolio calculated: ${totalBTC.toFixed(8)} BTC, ${buyTransactions.length} buy transactions processed`);

      return {
        totalBTC,
        totalSatoshis,
        totalTransactions: aggregateData._count.id || 0,
        
        // Main currency values
        mainCurrency,
        totalInvestedMain,
        totalFeesMain,
        averageBuyPriceMain,
        currentBTCPriceMain,
        currentPortfolioValueMain,
        unrealizedPnLMain,
        unrealizedPnLPercentage,
        
        // Secondary currency values
        secondaryCurrency,
        totalInvestedSecondary,
        totalFeesSecondary,
        averageBuyPriceSecondary,
        currentBTCPriceSecondary,
        currentPortfolioValueSecondary,
        unrealizedPnLSecondary,
        
        // Legacy USD fields
        totalInvestedUSD,
        totalFeesUSD,
        averageBuyPriceUSD: avgBuyPriceUSD,
        currentBTCPriceUSD: currentBTCPrice,
        currentPortfolioValueUSD,
        unrealizedPnLUSD,
        unrealizedPnLPercent,
        currentValueEUR,
        currentValuePLN
      };
    } catch (error) {
      console.error('Error calculating portfolio from transactions:', error);
      
      // Return safe defaults to prevent complete failure
      return {
        totalBTC: 0,
        totalSatoshis: 0,
        totalTransactions: 0,
        mainCurrency,
        totalInvestedMain: 0,
        totalFeesMain: 0,
        averageBuyPriceMain: 0,
        currentBTCPriceMain: currentBTCPrice,
        currentPortfolioValueMain: 0,
        unrealizedPnLMain: 0,
        unrealizedPnLPercentage: 0,
        secondaryCurrency,
        totalInvestedSecondary: 0,
        totalFeesSecondary: 0,
        averageBuyPriceSecondary: 0,
        currentBTCPriceSecondary: currentBTCPrice,
        currentPortfolioValueSecondary: 0,
        unrealizedPnLSecondary: 0,
        totalInvestedUSD: 0,
        totalFeesUSD: 0,
        averageBuyPriceUSD: 0,
        currentBTCPriceUSD: currentBTCPrice,
        currentPortfolioValueUSD: 0,
        unrealizedPnLUSD: 0,
        unrealizedPnLPercent: 0,
        currentValueEUR: 0,
        currentValuePLN: 0
      };
    }
  }

  /**
   * Calculate 24h portfolio change
   */
  private static async calculatePortfolio24hChange(portfolioData: any, currentBTCPrice: number): Promise<{ changeUSD: number; changePercent: number; changeMain: number; changeSecondary: number }> {
    try {
      // Get Bitcoin price change from current price table
      const currentPriceData = await this.getCurrentPriceFromTable();
      
      if (currentPriceData?.priceChange24h && portfolioData.totalBTC > 0) {
        const portfolioChangeUSD = portfolioData.totalBTC * currentPriceData.priceChange24h;
        const portfolioValue24hAgo = portfolioData.currentPortfolioValueUSD - portfolioChangeUSD;
        const portfolioChangePercent = portfolioValue24hAgo > 0 ? (portfolioChangeUSD / portfolioValue24hAgo) * 100 : 0;
        
        // Get exchange rates for currency conversion
        const { ExchangeRateService } = await import('@/lib/exchange-rate-service');
        const usdToMainRate = await ExchangeRateService.getExchangeRate('USD', portfolioData.mainCurrency);
        const usdToSecondaryRate = await ExchangeRateService.getExchangeRate('USD', portfolioData.secondaryCurrency);
        
        const portfolioChangeMain = portfolioChangeUSD * usdToMainRate;
        const portfolioChangeSecondary = portfolioChangeUSD * usdToSecondaryRate;
        
        return {
          changeUSD: portfolioChangeUSD,
          changePercent: portfolioChangePercent,
          changeMain: portfolioChangeMain,
          changeSecondary: portfolioChangeSecondary
        };
      }
      
      return { changeUSD: 0, changePercent: 0, changeMain: 0, changeSecondary: 0 };
    } catch (error) {
      console.error('Error calculating portfolio 24h change:', error);
      return { changeUSD: 0, changePercent: 0, changeMain: 0, changeSecondary: 0 };
    }
  }

  /**
   * Store portfolio summary in database
   */
  private static async storePortfolioSummary(data: PortfolioSummaryData): Promise<void> {
    try {
      await prisma.portfolioSummary.upsert({
        where: { id: 1 },
        update: {
          totalBtc: data.totalBTC,
          totalTransactions: data.totalTransactions,
          totalInvested: data.totalInvestedMain,
          totalFees: data.totalFeesMain,
          averageBuyPrice: data.averageBuyPriceMain,
          mainCurrency: data.mainCurrency,
          currentBtcPriceUsd: data.currentBTCPriceUSD,
          currentPortfolioValue: data.currentPortfolioValueMain,
          unrealizedPnl: data.unrealizedPnLMain,
          unrealizedPnlPercent: data.unrealizedPnLPercentage,
          portfolioChange24h: data.portfolioChange24hMain,
          portfolioChange24hPercent: data.portfolioChange24hPercentage,
          secondaryCurrency: data.secondaryCurrency,
          currentValueSecondary: data.currentPortfolioValueSecondary,
          lastUpdated: data.lastUpdated,
          lastPriceUpdate: data.lastPriceUpdate
        },
        create: {
          id: 1,
          totalBtc: data.totalBTC,
          totalTransactions: data.totalTransactions,
          totalInvested: data.totalInvestedMain,
          totalFees: data.totalFeesMain,
          averageBuyPrice: data.averageBuyPriceMain,
          mainCurrency: data.mainCurrency,
          currentBtcPriceUsd: data.currentBTCPriceUSD,
          currentPortfolioValue: data.currentPortfolioValueMain,
          unrealizedPnl: data.unrealizedPnLMain,
          unrealizedPnlPercent: data.unrealizedPnLPercentage,
          portfolioChange24h: data.portfolioChange24hMain,
          portfolioChange24hPercent: data.portfolioChange24hPercentage,
          secondaryCurrency: data.secondaryCurrency,
          currentValueSecondary: data.currentPortfolioValueSecondary,
          lastUpdated: data.lastUpdated,
          lastPriceUpdate: data.lastPriceUpdate
        }
      });
    } catch (error) {
      console.error('Error storing portfolio summary:', error);
      throw error;
    }
  }

  /**
   * Get portfolio summary from database
   */
  static async getPortfolioSummary(): Promise<PortfolioSummaryData | null> {
    // For now, just trigger a recalculation to get current data
    // This ensures we always have the most up-to-date portfolio with all currencies
    try {
      await this.calculateAndStorePortfolioSummary();
      
      const record = await prisma.portfolioSummary.findUnique({
        where: { id: 1 }
      });

      if (record) {
        // Get current settings for currency info
        const { SettingsService } = await import('@/lib/settings-service');
        const settings = await SettingsService.getSettings();
        
        // Calculate satoshis
        const totalSatoshis = Math.round((record.totalBtc || 0) * 100000000);
        
        // Get exchange rates to convert stored main currency values to other currencies
        const { ExchangeRateService } = await import('@/lib/exchange-rate-service');
        const storedMainCurrency = record.mainCurrency || 'USD';
        const storedSecondaryCurrency = record.secondaryCurrency || 'EUR';
        
        // Convert stored values if needed
        let mainToUSDRate = 1;
        let mainToSecondaryRate = 1;
        if (storedMainCurrency !== 'USD') {
          mainToUSDRate = await ExchangeRateService.getExchangeRate(storedMainCurrency, 'USD');
        }
        if (storedMainCurrency !== storedSecondaryCurrency) {
          mainToSecondaryRate = await ExchangeRateService.getExchangeRate(storedMainCurrency, storedSecondaryCurrency);
        }
        
        const btcPriceUSD = record.currentBtcPriceUsd || 0;
        const btcPriceMain = btcPriceUSD * (await ExchangeRateService.getExchangeRate('USD', storedMainCurrency));
        const btcPriceSecondary = btcPriceUSD * (await ExchangeRateService.getExchangeRate('USD', storedSecondaryCurrency));
        
        return {
          totalBTC: record.totalBtc || 0,
          totalSatoshis,
          totalTransactions: record.totalTransactions || 0,
          
          // Main currency values (stored directly in DB)
          mainCurrency: storedMainCurrency,
          totalInvestedMain: record.totalInvested || 0,
          totalFeesMain: record.totalFees || 0,
          averageBuyPriceMain: record.averageBuyPrice || 0,
          currentBTCPriceMain: btcPriceMain,
          currentPortfolioValueMain: record.currentPortfolioValue || 0,
          unrealizedPnLMain: record.unrealizedPnl || 0,
          unrealizedPnLPercentage: record.unrealizedPnlPercent || 0,
          portfolioChange24hMain: record.portfolioChange24h || 0,
          portfolioChange24hPercentage: record.portfolioChange24hPercent || 0,
          
          // Secondary currency values
          secondaryCurrency: storedSecondaryCurrency,
          totalInvestedSecondary: (record.totalInvested || 0) * mainToSecondaryRate,
          totalFeesSecondary: (record.totalFees || 0) * mainToSecondaryRate,
          averageBuyPriceSecondary: (record.averageBuyPrice || 0) * mainToSecondaryRate,
          currentBTCPriceSecondary: btcPriceSecondary,
          currentPortfolioValueSecondary: record.currentValueSecondary || 0,
          unrealizedPnLSecondary: (record.unrealizedPnl || 0) * mainToSecondaryRate,
          portfolioChange24hSecondary: (record.portfolioChange24h || 0) * mainToSecondaryRate,
          
          // Legacy USD fields (convert from main currency)
          totalInvestedUSD: (record.totalInvested || 0) * mainToUSDRate,
          totalFeesUSD: (record.totalFees || 0) * mainToUSDRate,
          averageBuyPriceUSD: (record.averageBuyPrice || 0) * mainToUSDRate,
          currentBTCPriceUSD: btcPriceUSD,
          currentPortfolioValueUSD: (record.currentPortfolioValue || 0) * mainToUSDRate,
          unrealizedPnLUSD: (record.unrealizedPnl || 0) * mainToUSDRate,
          unrealizedPnLPercent: record.unrealizedPnlPercent || 0,
          portfolioChange24hUSD: (record.portfolioChange24h || 0) * mainToUSDRate,
          portfolioChange24hPercent: record.portfolioChange24hPercent || 0,
          currentValueEUR: record.currentValueSecondary || 0, // Assuming EUR is secondary
          currentValuePLN: 0, // Deprecated
          
          lastUpdated: typeof record.lastUpdated === 'string' ? record.lastUpdated : record.lastUpdated?.toISOString() || new Date().toISOString(),
          lastPriceUpdate: typeof record.lastPriceUpdate === 'string' ? record.lastPriceUpdate : record.lastPriceUpdate?.toISOString() || new Date().toISOString()
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting portfolio summary:', error);
      return null;
    }
  }

  /**
   * Get today's real-time OHLC data (useful for debugging and monitoring)
   */
  static async getTodaysOHLC(): Promise<{ date: string; open: number; high: number; low: number; close: number; volume: number } | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const record = await prisma.bitcoinPriceHistory.findUnique({
        where: { date: today }
      });

      if (record) {
        return {
          date: record.date,
          open: record.openUsd,
          high: record.highUsd,
          low: record.lowUsd,
          close: record.closeUsd,
          volume: record.volume || 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting today\'s OHLC data:', error);
      return null;
    }
  }

  /**
   * Debounced portfolio calculation to prevent excessive I/O
   */
  static async calculateAndStorePortfolioSummaryDebounced(currentBTCPrice?: number): Promise<void> {
    // Clear existing timeout
    if (this.portfolioCalculationTimeout) {
      clearTimeout(this.portfolioCalculationTimeout);
    }

    // Set new timeout for debounced calculation
    this.portfolioCalculationTimeout = setTimeout(async () => {
      try {
        await this.calculateAndStorePortfolioSummary(currentBTCPrice);
      } catch (error) {
        console.error('Error in debounced portfolio calculation:', error);
      }
    }, this.PORTFOLIO_DEBOUNCE_MS);
  }

  /**
   * Rate-limited portfolio calculation to prevent excessive I/O
   */
  static async calculateAndStorePortfolioSummaryRateLimited(currentBTCPrice?: number): Promise<void> {
    const now = Date.now();
    
    // Check if we're within the rate limit
    if (now - this.lastPortfolioCalculation < this.MIN_PORTFOLIO_CALCULATION_INTERVAL) {
      console.log('Portfolio calculation rate limited, skipping...');
      return;
    }

    this.lastPortfolioCalculation = now;
    
    try {
      await this.calculateAndStorePortfolioSummary(currentBTCPrice);
    } catch (error) {
      console.error('Error in rate-limited portfolio calculation:', error);
      // Reset the rate limit on error to allow retry
      this.lastPortfolioCalculation = 0;
      throw error;
    }
  }

  /**
   * Get current price with caching to reduce database I/O
   */
  static async getCurrentPriceFromTableCached(): Promise<BitcoinPriceData | null> {
    const now = Date.now();
    
    // Return cached price if still valid
    if (this.currentPriceCache && (now - this.currentPriceCache.timestamp) < this.PRICE_CACHE_DURATION) {
      return {
        price: this.currentPriceCache.price,
        priceChange24h: 0, // Simplified for cache
        priceChangePercent24h: 0,
        timestamp: new Date(this.currentPriceCache.timestamp).toISOString(),
        source: 'database'
      };
    }

    try {
      const result = await this.getCurrentPriceFromTable();
      
      // Update cache
      if (result) {
        this.currentPriceCache = {
          price: result.price,
          timestamp: now
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error getting cached current price:', error);
      return null;
    }
  }
} 