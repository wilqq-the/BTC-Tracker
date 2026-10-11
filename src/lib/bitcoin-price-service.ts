import { prisma } from './prisma';
import { btcArriving, btcLeaving, transferFeeBtc, transferHoldingsDelta } from './transfer-fees';

// The acquisition rule lives in its own module so routes can use it without
// loading (or, in tests, without depending on a mock of) this service.
export { isOnchainAcquisition } from './acquisition';
export type { AcquisitionCandidate } from './acquisition';
import { isOnchainAcquisition } from './acquisition';

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
  
  // Wallet distribution
  coldWalletBTC: number;
  hotWalletBTC: number;
  totalFeesBTC: number;
  
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
  private static portfolioCalculationTimeout: Map<number, NodeJS.Timeout> = new Map();
  private static readonly PORTFOLIO_DEBOUNCE_MS = 2000; // 2 seconds

  // Rate limiting for portfolio calculations
  private static lastPortfolioCalculation: Map<number, number> = new Map();
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
        console.log(`[DATA] Updated today's historical record (${today}) with live price: $${currentPrice}`);
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
        console.log(`[DATA] Created today's historical record (${today}) with live price: $${currentPrice}`);
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

      // Try to fetch from Yahoo Finance if no database data
      console.log('No price in database, fetching from Yahoo Finance...');
      const { YahooFinanceService } = await import('@/lib/yahoo-finance-service');
      const currentPrice = await YahooFinanceService.fetchCurrentPrice();
      
      // Store the fetched price
      await this.storeCurrentPriceWithChanges(currentPrice, 'yahoo_finance');
      
      // Return the newly stored price
      const newPriceData = await this.getCurrentPriceFromTable();
      if (newPriceData) {
        this.cachedPrice = newPriceData;
        this.cacheTimestamp = now;
        return newPriceData;
      }
      
      // Final fallback if everything fails
      throw new Error('Unable to fetch or store price data');
      
    } catch (error) {
      console.error('Error fetching Bitcoin price:', error);
      
      // Return a fallback price to keep the app functional
      const fallbackPrice = {
        price: 100000,
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
   * Backfills that were already attempted, so a missing date does not trigger
   * repeated Yahoo downloads on every sync.
   */
  private static dailyHistoryBackfills = new Map<string, Promise<void>>();

  /**
   * Get the price for a date, fetching the daily history from Yahoo on demand
   * when the date is older than the locally stored window (~365 days).
   *
   * On-chain imports value every transaction at the block-day close, but a
   * freshly scanned address can contain transactions older than the stored
   * history. Without a backfill those get valued at the current price, which
   * would distort the inferred purchase cost, so the missing range is upserted
   * into `bitcoin_price_history` once and re-read.
   */
  static async getOrFetchPriceForDate(date: string): Promise<number | null> {
    const local = await this.getPriceForDate(date);
    if (local !== null) {
      return local;
    }

    // A missing date means "older than the local window" only when a daily
    // window already exists. On a fresh install the history table is empty and
    // the daily scheduler will fill it: skipping the backfill avoids a
    // pointless 15-year Yahoo download (and lets tests stay offline).
    const oldest = await prisma.bitcoinPriceHistory.findFirst({
      select: { date: true },
      orderBy: { date: 'asc' }
    });
    if (!oldest) {
      return null;
    }

    await this.ensureDailyHistory();
    return this.getPriceForDate(date);
  }

  private static async ensureDailyHistory(): Promise<void> {
    let pending = this.dailyHistoryBackfills.get('all');
    if (pending) {
      return pending;
    }

    pending = (async () => {
      try {
        const { YahooFinanceService } = await import('./yahoo-finance-service');
        // ~15 years of daily closes, upserted per date (saveHistoricalData is
        // a per-row upsert, so the existing 1Y window is kept and extended).
        const history = await YahooFinanceService.fetchHistoricalData('max');
        await YahooFinanceService.saveHistoricalData(history);
      } catch (error) {
        console.warn(`[PRICE] Could not backfill daily history: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();

    this.dailyHistoryBackfills.set('all', pending);
    return pending;
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
  static async calculateAndStorePortfolioSummary(userId: number, currentBTCPrice?: number): Promise<void> {
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
      const portfolioData = await this.calculatePortfolioFromTransactions(userId, currentBTCPrice, mainCurrency, secondaryCurrency);
      
      // Calculate 24h portfolio change
      const portfolio24hChange = await this.calculatePortfolio24hChange(portfolioData, currentBTCPrice);
      
      // Store in portfolio_summary table
      await this.storePortfolioSummary(userId, {
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

      console.log(`Portfolio summary updated for user ${userId}: ${portfolioData.currentPortfolioValueMain.toFixed(2)} ${mainCurrency} (${portfolio24hChange.changePercent.toFixed(2)}% 24h)`);
      
    } catch (error) {
      console.error('Error calculating and storing portfolio summary:', error);
      throw error;
    }
  }

  /**
   * Recalculate the portfolio summary of every active user.
   *
   * Schedulers run outside of any request context and therefore have no user
   * to scope their queries to. PortfolioSummary rows are per-user, so the
   * scheduler has to fan out explicitly instead of relying on a global row.
   */
  static async calculateAndStorePortfolioSummaryForAllUsers(currentBTCPrice?: number): Promise<void> {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true }
    });

    for (const user of users) {
      try {
        await this.calculateAndStorePortfolioSummary(user.id, currentBTCPrice);
      } catch (error) {
        console.error(`Error calculating portfolio summary for user ${user.id}:`, error);
      }
    }
  }

  /**
   * Calculate portfolio data from transactions table
   */
  private static async calculatePortfolioFromTransactions(userId: number, currentBTCPrice: number, mainCurrency: string, secondaryCurrency: string): Promise<Omit<PortfolioSummaryData, 'portfolioChange24hUSD' | 'portfolioChange24hPercent' | 'lastUpdated' | 'lastPriceUpdate' | 'portfolioChange24hMain' | 'portfolioChange24hPercentage' | 'portfolioChange24hSecondary'>> {
    try {
      // Get exchange rates for currency conversion (cached)
      const { ExchangeRateService } = await import('@/lib/exchange-rate-service');
      
      // Batch exchange rate calls to reduce I/O
      const [usdToMainRate, usdToSecondaryRate] = await Promise.all([
        ExchangeRateService.getExchangeRate('USD', mainCurrency),
        ExchangeRateService.getExchangeRate('USD', secondaryCurrency)
      ]);

      // Get all transactions and aggregate data in parallel to reduce I/O
      // Every query MUST be scoped to userId: BitcoinTransaction is a per-user
      // table and PortfolioSummary rows are per-user too.
      const [aggregateData, buyTransactions, sellTransactions, transferTransactions] = await Promise.all([
        prisma.bitcoinTransaction.aggregate({
          where: { userId },
          _count: { id: true },
          _sum: {
            btcAmount: true,
            fees: true
          }
        }),
        prisma.bitcoinTransaction.findMany({
          where: { userId, type: 'BUY' },
          select: {
            btcAmount: true,
            originalPricePerBtc: true,
            originalTotalAmount: true,
            originalCurrency: true
          }
        }),
        prisma.bitcoinTransaction.findMany({
          where: { userId, type: 'SELL' },
          select: {
            btcAmount: true
          }
        }),
        prisma.bitcoinTransaction.findMany({
          where: { userId, type: 'TRANSFER' },
          select: {
            type: true,
            btcAmount: true,
            fees: true,
            feesCurrency: true,
            transferType: true,
            transferFeeMode: true,
            source: true,
            originalPricePerBtc: true,
            originalTotalAmount: true,
            originalCurrency: true
          }
        })
      ]);

      // Calculate holdings and track cold/hot wallet distribution
      //
      // IMPORTANT: transfer semantics
      // ================================================================
      // How much leaves and how much arrives depends on the transfer's fee
      // mode (lib/transfer-fees, #168):
      //   ON_TOP            btcAmount arrives, btcAmount + fee leaves
      //   DEDUCTED / null   btcAmount leaves, btcAmount - fee arrives
      //
      // Each transfer then moves the total by transferHoldingsDelta: + what
      // arrives for TRANSFER_IN, - what leaves for TRANSFER_OUT, and - the fee
      // for moves between the user's own wallets.
      //
      // On-chain imports store TRANSFER_OUT as ON_TOP (btcAmount = what the
      // recipients got, `fees` = the network fee we paid) and TRANSFER_IN
      // with fees = 0, so both conventions land on the real balance.
      //
      // Resulting total: BUY - SELL + (sum of the transfer moves above).
      // totalFeesBTC is reported separately and already included in the moves.
      let totalFeesBTC = 0;
      let coldWalletBTC = 0;
      let netTransferBTC = 0;

      for (const tx of transferTransactions) {
        // Fees paid in BTC are burned, whatever the transfer type
        totalFeesBTC += transferFeeBtc(tx);
        netTransferBTC += transferHoldingsDelta(tx);

        if (tx.transferType === 'TO_COLD_WALLET') {
          coldWalletBTC += btcArriving(tx);
        } else if (tx.transferType === 'FROM_COLD_WALLET') {
          coldWalletBTC -= btcLeaving(tx);
        }
      }

      const totalBuyBTC = buyTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
      const totalSellBTC = sellTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
      const totalBTC = totalBuyBTC - totalSellBTC + netTransferBTC;
      const hotWalletBTC = totalBTC - coldWalletBTC;
      const totalSatoshis = Math.round(totalBTC * 100000000);
      const totalFeesUSD = aggregateData._sum.fees || 0;

      // Acquisition pool: everything the user put money into.
      //
      // BUY rows carry the fiat price actually paid. On-chain TRANSFER_IN rows
      // are valued at the block-day close price by the on-chain importer, so an
      // address scan is how the tracker learns the cost of coins the user
      // already owned. Only rows with a stored basis (originalTotalAmount > 0)
      // qualify, and only on-chain ones: manual/internal transfers (source !=
      // 'onchain') moved BTC that already belongs to the portfolio, so counting
      // them here would double-charge the invested amount.
      const onchainAcquisitions = transferTransactions.filter(isOnchainAcquisition);
      const acquisitionTransactions = [...buyTransactions, ...onchainAcquisitions];
      const totalAcquiredBTC = acquisitionTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);

      // Batch exchange rate lookups by currency to reduce I/O
      const uniqueCurrencies = Array.from(new Set(acquisitionTransactions.map(tx => tx.originalCurrency))) as string[];
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
      let weightedBuyPriceSumUSD = 0;

      for (const tx of acquisitionTransactions) {
        const exchangeRate = currencyToRateMap[tx.originalCurrency] || 1.0;
        const usdTotal = (tx.originalTotalAmount ?? 0) * exchangeRate;
        const usdPrice = (tx.originalPricePerBtc ?? 0) * exchangeRate;

        totalInvestedUSD += usdTotal;
        // Volume-weighted average: sum of (price × volume)
        weightedBuyPriceSumUSD += usdPrice * tx.btcAmount;
      }

      // Volume-weighted average price over everything acquired (BUY + on-chain
      // received). The denominator must be the acquired volume, not the current
      // holdings: dividing by totalBTC skews the average as soon as the user
      // sells or moves BTC outside of a purchase.
      const avgBuyPriceUSD = totalAcquiredBTC > 0 ? weightedBuyPriceSumUSD / totalAcquiredBTC : 0;
      
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

      console.log(`Portfolio calculated: ${totalBTC.toFixed(8)} BTC (Cold: ${coldWalletBTC.toFixed(8)}, Hot: ${hotWalletBTC.toFixed(8)}), ${buyTransactions.length} buy transactions processed`);

      return {
        totalBTC,
        totalSatoshis,
        totalTransactions: aggregateData._count.id || 0,
        
        // Cold/Hot Wallet Distribution  
        coldWalletBTC,
        hotWalletBTC,
        totalFeesBTC,
        
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
        coldWalletBTC: 0,
        hotWalletBTC: 0,
        totalFeesBTC: 0,
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
  private static async storePortfolioSummary(userId: number, data: PortfolioSummaryData): Promise<void> {
    try {
      await prisma.portfolioSummary.upsert({
        where: { userId },
        update: {
          totalBtc: data.totalBTC,
          totalTransactions: data.totalTransactions,
          coldWalletBtc: data.coldWalletBTC,
          hotWalletBtc: data.hotWalletBTC,
          totalFeesBtc: data.totalFeesBTC,
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
          userId,
          totalBtc: data.totalBTC,
          totalTransactions: data.totalTransactions,
          coldWalletBtc: data.coldWalletBTC,
          hotWalletBtc: data.hotWalletBTC,
          totalFeesBtc: data.totalFeesBTC,
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
   * Debounced portfolio calculation to prevent excessive I/O.
   * One pending timer per user so concurrent edits by different users never
   * cancel each other's recalculation.
   */
  static async calculateAndStorePortfolioSummaryDebounced(userId: number, currentBTCPrice?: number): Promise<void> {
    const pending = this.portfolioCalculationTimeout.get(userId);
    if (pending) {
      clearTimeout(pending);
    }

    const timeout = setTimeout(async () => {
      this.portfolioCalculationTimeout.delete(userId);
      try {
        await this.calculateAndStorePortfolioSummary(userId, currentBTCPrice);
      } catch (error) {
        console.error('Error in debounced portfolio calculation:', error);
      }
    }, this.PORTFOLIO_DEBOUNCE_MS);

    this.portfolioCalculationTimeout.set(userId, timeout);
  }

  /**
   * Rate-limited portfolio calculation to prevent excessive I/O
   */
  static async calculateAndStorePortfolioSummaryRateLimited(userId: number, currentBTCPrice?: number): Promise<void> {
    const now = Date.now();
    const lastRun = this.lastPortfolioCalculation.get(userId) || 0;

    // Check if we're within the rate limit
    if (now - lastRun < this.MIN_PORTFOLIO_CALCULATION_INTERVAL) {
      console.log('Portfolio calculation rate limited, skipping...');
      return;
    }

    this.lastPortfolioCalculation.set(userId, now);

    try {
      await this.calculateAndStorePortfolioSummary(userId, currentBTCPrice);
    } catch (error) {
      console.error('Error in rate-limited portfolio calculation:', error);
      // Reset the rate limit on error to allow retry
      this.lastPortfolioCalculation.set(userId, 0);
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