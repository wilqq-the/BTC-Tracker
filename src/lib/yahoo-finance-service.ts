import yahooFinance from 'yahoo-finance2';
import { prisma } from './prisma';
import { BitcoinPriceHistory, BitcoinPriceIntraday } from './types';

const BITCOIN_SYMBOL = 'BTC-USD';

export class YahooFinanceService {
  
  /**
   * Fetch current Bitcoin price (for intraday updates every 5-10 minutes)
   */
  static async fetchCurrentPrice(): Promise<number> {
    try {
      const quote = await yahooFinance.quote(BITCOIN_SYMBOL);
      
      if (!quote.regularMarketPrice) {
        throw new Error('No regular market price available');
      }
      
      return quote.regularMarketPrice;
      
    } catch (error) {
      console.error('Error fetching current Bitcoin price:', error);
      throw error;
    }
  }

  /**
   * Fetch historical daily OHLC data
   * @param period - '1y', '2y', '5y', '10y', 'max' (up to 15 years)
   */
  static async fetchHistoricalData(period: string = '1y'): Promise<BitcoinPriceHistory[]> {
    try {
      const startDate = this.getPeriodStartDate(period);
      const endDate = new Date();
      
      const result = await yahooFinance.historical(BITCOIN_SYMBOL, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      });
      
      const historicalData: BitcoinPriceHistory[] = [];
      
      for (const data of result) {
        const date = new Date(data.date);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Skip if any OHLC data is null
        if (data.open && data.high && data.low && data.close) {
          historicalData.push({
            id: 0, // Will be set by database
            date: dateStr,
            open_usd: data.open,
            high_usd: data.high,
            low_usd: data.low,
            close_usd: data.close,
            volume: data.volume || 0,
            created_at: new Date().toISOString()
          });
        }
      }
      
      return historicalData;
      
    } catch (error) {
      console.error('Error fetching historical Bitcoin data:', error);
      throw error;
    }
  }

  /**
   * Fetch intraday data for current day only (hourly intervals - 24 points max)
   * This data is cleared daily and used only for current day charts
   */
  static async fetchIntradayData(): Promise<BitcoinPriceIntraday[]> {
    try {
      console.log('[DATA] Fetching hourly intraday data for current day...');
      
      // Get start and end of current day
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      // Use chart API for intraday data (not historical)
      const result = await yahooFinance.chart(BITCOIN_SYMBOL, {
        period1: startOfDay,
        period2: now,
        interval: '1h' // Hourly intervals
      });
      
      const intradayData: BitcoinPriceIntraday[] = [];
      
      if (result.quotes && result.quotes.length > 0) {
        for (const quote of result.quotes) {
          const timestamp = new Date(quote.date);
          
          // Use close price as the main price point for intraday
          if (quote.close && quote.close > 0) {
            intradayData.push({
              id: 0, // Will be set by database
              timestamp: timestamp.toISOString(),
              price_usd: quote.close,
              volume: quote.volume || 0,
              created_at: new Date().toISOString()
            });
          }
        }
      }
      
      console.log(`[OK] Fetched ${intradayData.length} hourly data points for today`);
      return intradayData;
      
    } catch (error) {
      console.error('Error fetching intraday Bitcoin data:', error);
      throw error;
    }
  }

  /**
   * Helper method to convert period string to Date
   */
  private static getPeriodStartDate(period: string): Date {
    const now = new Date();
    const startDate = new Date(now);
    
    switch (period) {
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case '2y':
        startDate.setFullYear(now.getFullYear() - 2);
        break;
      case '5y':
        startDate.setFullYear(now.getFullYear() - 5);
        break;
      case '10y':
        startDate.setFullYear(now.getFullYear() - 10);
        break;
      case 'max':
        startDate.setFullYear(now.getFullYear() - 15); // Yahoo Finance typically goes back ~15 years
        break;
      default:
        startDate.setFullYear(now.getFullYear() - 1); // Default to 1 year
    }
    
    return startDate;
  }

  /**
   * Save historical data to database
   */
  static async saveHistoricalData(data: BitcoinPriceHistory[]): Promise<void> {
    try {
      if (data.length === 0) {
        console.log('No historical data to save');
        return;
      }

      // Use createMany for better performance on large datasets
      const batchSize = 100; // Process in batches to avoid memory issues
      let processed = 0;

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        // Use upsert for smaller batches to handle conflicts
        await prisma.$transaction(async (tx) => {
          for (const record of batch) {
            await tx.bitcoinPriceHistory.upsert({
              where: { date: record.date },
              update: {
                openUsd: record.open_usd,
                highUsd: record.high_usd,
                lowUsd: record.low_usd,
                closeUsd: record.close_usd,
                volume: record.volume
              },
              create: {
                date: record.date,
                openUsd: record.open_usd,
                highUsd: record.high_usd,
                lowUsd: record.low_usd,
                closeUsd: record.close_usd,
                volume: record.volume
              }
            });
          }
        }, {
          timeout: 30000, // 30 second timeout for large batches
          maxWait: 5000   // 5 second max wait time
        });
        
        processed += batch.length;
        console.log(`Processed ${processed}/${data.length} historical records`);
      }
      
      console.log(`Successfully saved ${data.length} historical price records`);
    } catch (error) {
      console.error('Error saving historical data:', error);
      throw error;
    }
  }

  /**
   * Clear old intraday data (only keep current day)
   * This should be called daily to keep intraday table clean
   */
  static async clearOldIntradayData(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      
      const result = await prisma.bitcoinPriceIntraday.deleteMany({
        where: {
          timestamp: {
            lt: todayStr
          }
        }
      });
      
      if (result.count > 0) {
        console.log(`[CLEAN] Cleared ${result.count} old intraday records (keeping only today's data)`);
      }
    } catch (error) {
      console.error('Error clearing old intraday data:', error);
    }
  }

  /**
   * Save intraday data to database (current day only)
   */
  static async saveIntradayData(data: BitcoinPriceIntraday[]): Promise<void> {
    try {
      if (data.length === 0) {
        console.log('No intraday data to save');
        return;
      }

      // Clear old data first (daily cleanup)
      await this.clearOldIntradayData();

      // Save new data with upsert to handle duplicates
      for (const record of data) {
        await prisma.bitcoinPriceIntraday.upsert({
          where: { timestamp: record.timestamp },
          update: {
            priceUsd: record.price_usd,
            volume: record.volume
          },
          create: {
            timestamp: record.timestamp,
            priceUsd: record.price_usd,
            volume: record.volume
          }
        });
      }
      
      console.log(`[OK] Saved ${data.length} hourly intraday records for today`);
    } catch (error) {
      console.error('Error saving intraday data:', error);
      throw error;
    }
  }

  /**
   * Get latest Bitcoin price from database
   */
  static async getLatestPrice(): Promise<number | null> {
    try {
      const record = await prisma.bitcoinPriceIntraday.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { priceUsd: true }
      });
      
      return record ? record.priceUsd : null;
    } catch (error) {
      console.error('Error getting latest price:', error);
      throw error;
    }
  }
} 