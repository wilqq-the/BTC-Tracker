/**
 * Base Exchange Adapter
 * Abstract class that all exchange adapters must extend.
 * Provides common interface and utility methods for fetching and normalizing trades.
 */

import {
  ExchangeName,
  ExchangeCredentials,
  ExchangeTrade,
  NormalizedTransaction,
  ExchangeRateLimitError,
} from './types';

export abstract class BaseExchangeAdapter {
  /** The name of the exchange this adapter handles */
  abstract readonly exchangeName: ExchangeName;

  /** Display name for UI */
  abstract readonly displayName: string;

  /** API credentials */
  protected credentials: ExchangeCredentials;

  constructor(credentials: ExchangeCredentials) {
    this.credentials = credentials;
  }

  /**
   * Validate that the API credentials are correct by making a lightweight API call.
   * Should NOT fetch trades - just verify the key/secret work.
   * @returns true if authentication succeeds
   * @throws ExchangeAuthError if credentials are invalid
   */
  abstract authenticate(): Promise<boolean>;

  /**
   * Fetch spot BTC trades from the exchange.
   * @param since Optional date to fetch trades from (for incremental sync)
   * @returns Array of raw exchange trades
   */
  abstract fetchSpotTrades(since?: Date): Promise<ExchangeTrade[]>;

  /**
   * Normalize a raw exchange trade into our standard transaction format.
   * Each adapter implements its own mapping logic.
   */
  normalizeTransaction(trade: ExchangeTrade): NormalizedTransaction {
    return {
      type: trade.type,
      btcAmount: trade.btcAmount,
      pricePerBtc: trade.pricePerBtc,
      totalAmount: trade.totalAmount,
      currency: trade.quoteCurrency,
      fees: trade.fees,
      feesCurrency: trade.feesCurrency,
      transactionDate: trade.timestamp,
      notes: `Synced from ${this.displayName} (Trade ID: ${trade.exchangeTradeId})`,
      tags: `${this.displayName},Exchange Sync`,
    };
  }

  /**
   * Normalize all trades into our standard format.
   */
  normalizeAll(trades: ExchangeTrade[]): NormalizedTransaction[] {
    return trades.map((trade) => this.normalizeTransaction(trade));
  }

  // ---------------------------------------------------------------------------
  // Utility helpers available to all adapters
  // ---------------------------------------------------------------------------

  /**
   * Sleep for a given number of milliseconds (for rate limiting).
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute a fetch with basic retry logic for rate limits.
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
          const waitMs = retryAfter * 1000;
          console.log(`[${this.exchangeName}] Rate limited, waiting ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`);

          if (attempt < maxRetries - 1) {
            await this.sleep(waitMs);
            continue;
          }
          throw new ExchangeRateLimitError(this.exchangeName, waitMs);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof ExchangeRateLimitError) {
          throw error;
        }
        // Network error - retry with exponential backoff
        if (attempt < maxRetries - 1) {
          const backoff = Math.pow(2, attempt) * 1000;
          console.log(`[${this.exchangeName}] Request failed, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(backoff);
        }
      }
    }

    throw lastError || new Error(`Request failed after ${maxRetries} attempts`);
  }

  /**
   * Filter trades to only include BTC spot trades.
   * Subclasses can override for exchange-specific filtering.
   */
  protected isBtcSpotTrade(trade: ExchangeTrade): boolean {
    return trade.btcAmount > 0;
  }
}
