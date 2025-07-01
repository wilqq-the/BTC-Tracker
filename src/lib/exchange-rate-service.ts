import { prisma } from './prisma';
import { SettingsService } from './settings-service';
import { CustomCurrencyService } from './custom-currency-service';

export interface ExchangeRateData {
  from_currency: string;
  to_currency: string;
  rate: number;
  last_updated: string;
}

export interface ExchangeRateApiResponse {
  result?: string;
  documentation?: string;
  terms_of_use?: string;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  time_next_update_unix?: number;
  time_next_update_utc?: string;
  base_code?: string;
  conversion_rates?: { [key: string]: number };
  rates?: { [key: string]: number }; // Alternative API structure
}

export class ExchangeRateService {
  private static readonly API_BASE_URL = 'https://api.exchangerate-api.com/v4/latest';
  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache
  private static cachedRates: Map<string, { rate: number; timestamp: number }> = new Map();

  /**
   * Get supported currencies from settings including custom currencies
   */
  static async getSupportedCurrencies(): Promise<string[]> {
    try {
      const settings = await SettingsService.getSettings();
      const builtInCurrencies = settings.currency.supportedCurrencies;
      
      // Get custom currencies
      const customCurrencies = await CustomCurrencyService.getAllCustomCurrencies();
      const customCurrencyCodes = customCurrencies.map(c => c.code);
      
      // Combine built-in and custom currencies
      const allCurrencies = [...builtInCurrencies, ...customCurrencyCodes];
      
      console.log('All supported currencies (built-in + custom):', allCurrencies);
      return allCurrencies;
    } catch (error) {
      console.error('Error getting supported currencies from settings:', error);
      // Fallback to default currencies
      return ['USD', 'EUR', 'PLN', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK'];
    }
  }

  /**
   * Fetch exchange rates from API
   */
  static async fetchExchangeRatesFromAPI(baseCurrency: string = 'USD'): Promise<ExchangeRateApiResponse> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/${baseCurrency}`);
      
      if (!response.ok) {
        throw new Error(`Exchange rate API error: ${response.status}`);
      }

      const data = await response.json();
      
      // The API uses 'rates' not 'conversion_rates'
      if (!data.rates) {
        throw new Error('Exchange rate API returned unexpected response structure');
      }

      return {
        result: 'success',
        time_last_update_utc: new Date().toISOString(),
        base_code: baseCurrency,
        conversion_rates: data.rates
      };
    } catch (error) {
      console.error('Error fetching exchange rates from API:', error);
      throw error;
    }
  }

  /**
   * Store exchange rates in database
   */
  static async storeExchangeRates(baseCurrency: string, rates: { [key: string]: number }, timestamp: string): Promise<void> {
    try {
      const supportedCurrencies = await this.getSupportedCurrencies();
      
      // Prepare exchange rate data, filtering out invalid rates and same currency
      const exchangeRateData: Array<{
        fromCurrency: string;
        toCurrency: string;
        rate: number;
        lastUpdated: Date;
      }> = [];
      
      for (const targetCurrency of supportedCurrencies) {
        if (targetCurrency === baseCurrency) {
          continue; // Skip same currency
        }

        const rate = rates[targetCurrency];
        if (!rate) {
          // Check if this is a custom currency
          const builtInCurrencies = ['USD', 'EUR', 'PLN', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK'];
          const isCustomCurrency = !builtInCurrencies.includes(targetCurrency);
          
          if (isCustomCurrency) {
            console.warn(`⚠️  Custom currency ${targetCurrency} not available in exchange rate API. Skipping rate storage.`);
          }
          continue;
        }

        exchangeRateData.push({
          fromCurrency: baseCurrency,
          toCurrency: targetCurrency,
          rate: rate,
          lastUpdated: new Date(timestamp)
        });
      }

      // Use transaction to handle upserts efficiently
      await prisma.$transaction(async (tx) => {
        for (const rateData of exchangeRateData) {
          await tx.exchangeRate.upsert({
            where: {
              fromCurrency_toCurrency: {
                fromCurrency: rateData.fromCurrency,
                toCurrency: rateData.toCurrency
              }
            },
            update: {
              rate: rateData.rate,
              lastUpdated: rateData.lastUpdated
            },
            create: rateData
          });
        }
      });

      console.log(`Stored ${exchangeRateData.length} exchange rates for ${baseCurrency}`);
    } catch (error) {
      console.error('Error storing exchange rates:', error);
      throw error;
    }
  }

  /**
   * Get exchange rate from database
   */
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1.0;

    // Check cache first
    const cacheKey = `${fromCurrency}_${toCurrency}`;
    const cached = this.cachedRates.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.rate;
    }

    try {
      // Try direct rate first
      const directRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: fromCurrency,
          toCurrency: toCurrency
        },
        orderBy: { lastUpdated: 'desc' }
      });

      if (directRate) {
        const rate = directRate.rate;
        
        // Cache the result
        this.cachedRates.set(cacheKey, {
          rate,
          timestamp: Date.now()
        });
        
        return rate;
      }

      // Try reverse rate (e.g., if EUR->USD not found, try USD->EUR and invert)
      const reverseRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: toCurrency,
          toCurrency: fromCurrency
        },
        orderBy: { lastUpdated: 'desc' }
      });

      if (reverseRate) {
        const rate = 1 / reverseRate.rate;
        
        // Cache the result
        this.cachedRates.set(cacheKey, {
          rate,
          timestamp: Date.now()
        });
        
        return rate;
      }

      // Try USD as middleware (e.g., PLN -> USD -> BRL)
      if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
        console.log(`Attempting USD middleware conversion: ${fromCurrency} -> USD -> ${toCurrency}`);
        
        const middlewareRate = await this.tryUsdMiddlewareConversion(fromCurrency, toCurrency);
        if (middlewareRate !== null) {
          console.log(`USD middleware conversion successful: ${fromCurrency} -> ${toCurrency} = ${middlewareRate}`);
          
          // Cache the calculated result
          this.cachedRates.set(cacheKey, {
            rate: middlewareRate,
            timestamp: Date.now()
          });
          
          return middlewareRate;
        }
      }

      // Fallback to hardcoded rates as last resort
      console.warn(`No exchange rate found for ${fromCurrency} -> ${toCurrency}, using fallback`);
      const fallbackRate = this.getFallbackRate(fromCurrency, toCurrency);
      return fallbackRate;

    } catch (error) {
      console.error(`Error getting exchange rate ${fromCurrency} -> ${toCurrency}:`, error);
      // Fallback to hardcoded rates as last resort
      const fallbackRate = this.getFallbackRate(fromCurrency, toCurrency);
      return fallbackRate;
    }
  }

  /**
   * Try USD as middleware for currency conversion
   * Returns null if USD middleware conversion is not possible
   */
  private static async tryUsdMiddlewareConversion(fromCurrency: string, toCurrency: string): Promise<number | null> {
    try {
      // Get fromCurrency -> USD rate directly from database
      let fromToUsdRate: number | null = null;
      
      const fromToUsd = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: fromCurrency,
          toCurrency: 'USD'
        },
        orderBy: { lastUpdated: 'desc' }
      });

      if (fromToUsd) {
        fromToUsdRate = fromToUsd.rate;
      } else {
        // Try reverse: USD -> fromCurrency, then invert
        const usdToFrom = await prisma.exchangeRate.findFirst({
          where: {
            fromCurrency: 'USD',
            toCurrency: fromCurrency
          },
          orderBy: { lastUpdated: 'desc' }
        });

        if (usdToFrom) {
          fromToUsdRate = 1 / usdToFrom.rate;
        }
      }

      if (!fromToUsdRate) {
        return null;
      }

      // Get USD -> toCurrency rate
      return await this.getUsdToTargetRate(toCurrency, fromToUsdRate);
    } catch (error) {
      console.error('Error in USD middleware conversion:', error);
      return null;
    }
  }

  /**
   * Helper to get USD -> target currency rate for middleware conversion
   */
  private static async getUsdToTargetRate(toCurrency: string, fromToUsdRate: number): Promise<number | null> {
    try {
      // Try USD -> toCurrency rate first
      const usdToTarget = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: 'USD',
          toCurrency: toCurrency
        },
        orderBy: { lastUpdated: 'desc' }
      });

      if (usdToTarget) {
        const middlewareRate = fromToUsdRate * usdToTarget.rate;
        return middlewareRate;
      }

      // Try reverse: toCurrency -> USD, then invert
      const targetToUsd = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: toCurrency,
          toCurrency: 'USD'
        },
        orderBy: { lastUpdated: 'desc' }
      });

      if (targetToUsd) {
        const usdToTargetRate = 1 / targetToUsd.rate;
        const middlewareRate = fromToUsdRate * usdToTargetRate;
        return middlewareRate;
      }

      return null;
    } catch (error) {
      console.error('Error getting USD to target rate:', error);
      return null;
    }
  }

  /**
   * Fallback exchange rates (only as last resort)
   */
  private static getFallbackRate(fromCurrency: string, toCurrency: string): number {
    const rates: { [key: string]: number } = {
      'EUR_USD': 1.05,
      'PLN_USD': 0.25,
      'GBP_USD': 1.27,
      'USD_USD': 1.0,
      'USD_EUR': 1 / 1.05,
      'USD_PLN': 1 / 0.25,
      'USD_GBP': 1 / 1.27,
    };

    const key = `${fromCurrency}_${toCurrency}`;
    const fallbackRate = rates[key];
    
    if (!fallbackRate) {
      // Check if this involves a custom currency
      const builtInCurrencies = ['USD', 'EUR', 'PLN', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK'];
      const isCustomCurrency = !builtInCurrencies.includes(fromCurrency) || !builtInCurrencies.includes(toCurrency);
      
      if (isCustomCurrency) {
        console.warn(`⚠️  No exchange rate available for custom currency conversion: ${fromCurrency} → ${toCurrency}. Using rate of 1.0. Consider adding this rate manually or using a different base currency.`);
      }
      
      return 1.0;
    }
    
    return fallbackRate;
  }

  /**
   * Ensure core main currency rates (USD ↔ EUR) are always available
   * This runs regardless of user settings since these are the only allowed main currencies
   */
  static async ensureMainCurrencyRates(): Promise<void> {
    try {
      // Always fetch USD-based rates (includes USD->EUR)
      const usdRates = await this.fetchExchangeRatesFromAPI('USD');
      if (usdRates.conversion_rates) {
        // Store USD->EUR rate
        const eurRate = usdRates.conversion_rates['EUR'];
        if (eurRate) {
          await this.storeExchangeRate('USD', 'EUR', eurRate, usdRates.time_last_update_utc!);
        }
      }
      
      // Always fetch EUR-based rates (includes EUR->USD)
      const eurRates = await this.fetchExchangeRatesFromAPI('EUR');
      if (eurRates.conversion_rates) {
        // Store EUR->USD rate
        const usdRate = eurRates.conversion_rates['USD'];
        if (usdRate) {
          await this.storeExchangeRate('EUR', 'USD', usdRate, eurRates.time_last_update_utc!);
        }
      }
    } catch (error) {
      console.error('Failed to ensure main currency rates:', error);
      // Set fallback rates as last resort
      await this.storeExchangeRate('USD', 'EUR', 0.92, new Date().toISOString());
      await this.storeExchangeRate('EUR', 'USD', 1.09, new Date().toISOString());
    }
  }

  /**
   * Store a single exchange rate
   */
  private static async storeExchangeRate(fromCurrency: string, toCurrency: string, rate: number, timestamp: string): Promise<void> {
    try {
      await prisma.exchangeRate.upsert({
        where: {
          fromCurrency_toCurrency: {
            fromCurrency: fromCurrency,
            toCurrency: toCurrency
          }
        },
        update: {
          rate: rate,
          lastUpdated: new Date(timestamp)
        },
        create: {
          fromCurrency: fromCurrency,
          toCurrency: toCurrency,
          rate: rate,
          lastUpdated: new Date(timestamp)
        }
      });
    } catch (error) {
      console.error('Error storing exchange rate:', error);
      throw error;
    }
  }

  /**
   * Update all exchange rates (called by scheduler)
   */
  static async updateAllExchangeRates(): Promise<void> {
    try {
      // Always ensure core main currency rates first (USD ↔ EUR)
      await this.ensureMainCurrencyRates();
      
      // Fetch USD-based rates for all supported currencies
      const usdRates = await this.fetchExchangeRatesFromAPI('USD');
      await this.storeExchangeRates('USD', usdRates.conversion_rates!, usdRates.time_last_update_utc!);
      
      // Fetch EUR-based rates for all supported currencies
      const eurRates = await this.fetchExchangeRatesFromAPI('EUR');
      await this.storeExchangeRates('EUR', eurRates.conversion_rates!, eurRates.time_last_update_utc!);
      
      // Clear cache to force fresh data
      this.cachedRates.clear();
    } catch (error) {
      console.error('Failed to update exchange rates:', error);
      // Don't throw - let app continue with cached rates
    }
  }

  /**
   * Get all stored exchange rates
   */
  static async getAllExchangeRates(): Promise<ExchangeRateData[]> {
    try {
      const records = await prisma.exchangeRate.findMany({
        orderBy: [
          { fromCurrency: 'asc' },
          { toCurrency: 'asc' }
        ]
      });

      return records.map(record => ({
        from_currency: record.fromCurrency,
        to_currency: record.toCurrency,
        rate: record.rate,
        last_updated: record.lastUpdated.toISOString()
      }));
    } catch (error) {
      console.error('Error getting all exchange rates:', error);
      throw error;
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  static clearCache(): void {
    this.cachedRates.clear();
  }
} 