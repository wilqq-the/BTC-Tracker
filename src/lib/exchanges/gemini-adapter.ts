/**
 * Gemini Exchange Adapter
 * Implements the Gemini REST API v1 for fetching spot BTC trades.
 *
 * Authentication:
 *   - X-GEMINI-APIKEY header: the API key
 *   - X-GEMINI-PAYLOAD header: base64-encoded JSON payload
 *   - X-GEMINI-SIGNATURE header: HMAC-SHA384 of the payload, keyed with the API secret
 *
 * Endpoint used:
 *   POST https://api.gemini.com/v1/mytrades
 */

import crypto from 'crypto';
import { BaseExchangeAdapter } from './base-exchange-adapter';
import {
  ExchangeName,
  ExchangeTrade,
  ExchangeAuthError,
  ExchangeApiError,
} from './types';

const GEMINI_API_URL = 'https://api.gemini.com';

// BTC trading pairs on Gemini
const BTC_SYMBOLS = [
  'btcusd', 'btceur', 'btcgbp', 'btcsgd',
];

export class GeminiAdapter extends BaseExchangeAdapter {
  readonly exchangeName: ExchangeName = 'GEMINI';
  readonly displayName = 'Gemini';

  /**
   * Make an authenticated POST request to a Gemini private endpoint.
   * Gemini uses a unique payload-based authentication:
   *   1. Build a JSON payload with the request path and nonce
   *   2. Base64-encode the payload
   *   3. HMAC-SHA384 sign the base64 payload with the API secret
   */
  private async privateRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const nonce = Date.now();
    const url = `${GEMINI_API_URL}${endpoint}`;

    const payload = {
      request: endpoint,
      nonce,
      ...params,
    };

    const payloadJson = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadJson).toString('base64');

    const signature = crypto
      .createHmac('sha384', this.credentials.apiSecret)
      .update(payloadBase64)
      .digest('hex');

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': '0',
        'X-GEMINI-APIKEY': this.credentials.apiKey,
        'X-GEMINI-PAYLOAD': payloadBase64,
        'X-GEMINI-SIGNATURE': signature,
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMsg = errorBody.message || errorBody.reason || `HTTP ${response.status}`;

      if (response.status === 400 && errorMsg.includes('InvalidSignature')) {
        throw new ExchangeAuthError('GEMINI', errorMsg);
      }
      if (response.status === 403 || response.status === 401) {
        throw new ExchangeAuthError('GEMINI', errorMsg);
      }

      throw new ExchangeApiError('GEMINI', errorMsg, response.status);
    }

    return response.json();
  }

  /**
   * Validate credentials by calling the balances endpoint (lightweight).
   */
  async authenticate(): Promise<boolean> {
    try {
      await this.privateRequest('/v1/balances');
      return true;
    } catch (error) {
      if (error instanceof ExchangeAuthError) {
        throw error;
      }
      throw new ExchangeAuthError('GEMINI', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Fetch all spot BTC trades from Gemini.
   * Gemini's /v1/mytrades returns trades per symbol, paginated by timestamp.
   */
  async fetchSpotTrades(since?: Date): Promise<ExchangeTrade[]> {
    const allTrades: ExchangeTrade[] = [];

    for (const symbol of BTC_SYMBOLS) {
      try {
        const symbolTrades = await this.fetchTradesForSymbol(symbol, since);
        allTrades.push(...symbolTrades);

        // Small delay between symbols to avoid rate limits
        if (BTC_SYMBOLS.indexOf(symbol) < BTC_SYMBOLS.length - 1) {
          await this.sleep(500);
        }
      } catch (error) {
        // Symbol not available or no trades is expected
        if (error instanceof ExchangeApiError && error.statusCode === 400) {
          continue;
        }
        console.error(`[GEMINI] Error fetching trades for ${symbol}:`, error);
      }
    }

    // Sort by timestamp
    allTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log(`[GEMINI] Fetched ${allTrades.length} BTC trades across ${BTC_SYMBOLS.length} pairs`);
    return allTrades;
  }

  /**
   * Fetch trades for a specific symbol with timestamp-based pagination.
   * Gemini returns up to 500 trades per request, ordered by timestamp descending.
   */
  private async fetchTradesForSymbol(symbol: string, since?: Date): Promise<ExchangeTrade[]> {
    const trades: ExchangeTrade[] = [];
    let hasMore = true;
    const limit = 500; // Gemini max per request
    let lastTimestamp: number | undefined;

    const quoteCurrency = this.extractQuoteCurrency(symbol);

    while (hasMore) {
      const params: Record<string, any> = {
        symbol,
        limit_trades: limit,
      };

      if (since && !lastTimestamp) {
        // Gemini uses millisecond timestamps for the timestamp_nanos parameter
        params.timestamp = Math.floor(since.getTime() / 1000);
      }

      if (lastTimestamp) {
        params.timestamp = lastTimestamp;
      }

      const result = await this.privateRequest('/v1/mytrades', params);

      if (!Array.isArray(result) || result.length === 0) {
        hasMore = false;
        break;
      }

      for (const trade of result) {
        const parsed = this.parseTrade(trade, quoteCurrency);
        if (parsed) {
          trades.push(parsed);
        }
      }

      // Pagination: Gemini returns oldest first when using timestamp param
      // If we got a full page, there might be more
      if (result.length === limit) {
        const lastTrade = result[result.length - 1];
        const tradeTimestamp = Math.floor(lastTrade.timestampms / 1000);
        // Avoid infinite loop if timestamp doesn't change
        if (lastTimestamp === tradeTimestamp) {
          hasMore = false;
        } else {
          lastTimestamp = tradeTimestamp;
        }
        await this.sleep(500); // Rate limit courtesy (Gemini has stricter limits)
      } else {
        hasMore = false;
      }
    }

    return trades;
  }

  /**
   * Extract the quote currency from a Gemini symbol.
   * e.g. btcusd -> USD, btceur -> EUR
   */
  private extractQuoteCurrency(symbol: string): string {
    const lower = symbol.toLowerCase();
    if (lower.startsWith('btc')) {
      const quote = lower.substring(3).toUpperCase();
      return quote || 'USD';
    }
    return 'USD'; // Fallback
  }

  /**
   * Parse a single Gemini trade into our ExchangeTrade format.
   */
  private parseTrade(trade: any, quoteCurrency: string): ExchangeTrade | null {
    try {
      const type = (trade.type || '').toLowerCase();
      const isBuy = type === 'buy';
      const btcAmount = parseFloat(trade.amount) || 0;
      const price = parseFloat(trade.price) || 0;
      const feeAmount = parseFloat(trade.fee_amount) || 0;
      const feeCurrency = (trade.fee_currency || quoteCurrency).toUpperCase();
      const timestamp = new Date(trade.timestampms || trade.timestamp * 1000);

      if (btcAmount <= 0 || price <= 0) {
        return null;
      }

      return {
        exchangeTradeId: trade.tid?.toString() || trade.order_id || '',
        type: isBuy ? 'BUY' : 'SELL',
        btcAmount,
        pricePerBtc: price,
        totalAmount: btcAmount * price,
        fees: feeAmount,
        feesCurrency: feeCurrency,
        quoteCurrency,
        timestamp,
        rawData: trade,
      };
    } catch (error) {
      console.error(`[GEMINI] Failed to parse trade:`, error);
      return null;
    }
  }
}
