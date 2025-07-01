import currenciesData from '@/data/currencies.json';

export interface CurrencyData {
  name: string;
  alpha: string;
  numeric: number;
  symbol: string;
  precision: string;
}

export class CurrencySymbolService {
  private static currencies: CurrencyData[] = currenciesData;
  private static currencyMap: Map<string, CurrencyData> = new Map();
  
  // Initialize currency map for fast lookups
  static {
    this.currencies.forEach(currency => {
      this.currencyMap.set(currency.alpha, currency);
    });
  }
  
  /**
   * Get currency data by currency code
   */
  static getCurrencyData(currencyCode: string): CurrencyData | null {
    return this.currencyMap.get(currencyCode.toUpperCase()) || null;
  }
  
  /**
   * Get currency symbol by currency code
   */
  static getCurrencySymbol(currencyCode: string): string {
    const currency = this.getCurrencyData(currencyCode);
    return currency?.symbol || currencyCode;
  }
  
  /**
   * Get currency name by currency code
   */
  static getCurrencyName(currencyCode: string): string {
    const currency = this.getCurrencyData(currencyCode);
    return currency?.name || currencyCode;
  }
  
  /**
   * Get all available currencies
   */
  static getAllCurrencies(): CurrencyData[] {
    return this.currencies;
  }
  
  /**
   * Search currencies by name or code
   */
  static searchCurrencies(query: string): CurrencyData[] {
    const searchTerm = query.toLowerCase();
    return this.currencies.filter(currency => 
      currency.alpha.toLowerCase().includes(searchTerm) ||
      currency.name.toLowerCase().includes(searchTerm)
    );
  }
  
  /**
   * Check if currency code exists in ISO 4217
   */
  static isValidCurrencyCode(currencyCode: string): boolean {
    return this.currencyMap.has(currencyCode.toUpperCase());
  }
} 