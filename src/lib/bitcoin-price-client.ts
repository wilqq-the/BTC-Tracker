'use client';

export interface BitcoinPriceData {
  price: number;
  timestamp: string;
  source: 'database' | 'fallback';
  priceChange24h?: number;
  priceChangePercent24h?: number;
}

export class BitcoinPriceClient {
  private static cachedPrice: BitcoinPriceData | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache

  /**
   * Get the current Bitcoin price from the API
   */
  static async getCurrentPrice(): Promise<BitcoinPriceData> {
    const now = Date.now();
    
    // Return cached price if still valid
    if (this.cachedPrice && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedPrice;
    }

    try {
      const response = await fetch('/api/bitcoin-price');
      const result = await response.json();
      
      if (result.success && result.data) {
        this.cachedPrice = result.data;
        this.cacheTimestamp = now;
        return result.data;
      }

      throw new Error('Failed to fetch price from API');
      
    } catch (error) {
      console.error('Error fetching Bitcoin price from API:', error);
      
      // Return fallback price if API fails
      const fallbackPrice = {
        price: 105000, // Reasonable fallback
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
   * Force refresh the cached price
   */
  static clearCache(): void {
    this.cachedPrice = null;
    this.cacheTimestamp = 0;
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
   * Manual refresh trigger
   */
  static async refresh(): Promise<BitcoinPriceData> {
    this.clearCache();
    return await this.getCurrentPrice();
  }
} 