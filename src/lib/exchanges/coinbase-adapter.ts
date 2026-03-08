/**
 * Coinbase Advanced Trade Adapter
 * Implements the Coinbase Advanced Trade API (v3) for fetching spot BTC trades.
 *
 * Authentication:
 *   - CB-ACCESS-KEY header: the API key
 *   - CB-ACCESS-SIGN header: HMAC-SHA256 of (timestamp + method + requestPath + body), keyed with API secret
 *   - CB-ACCESS-TIMESTAMP header: Unix timestamp in seconds
 *
 * Endpoint used:
 *   GET https://api.coinbase.com/api/v3/brokerage/orders/historical/fills
 */

import crypto from 'crypto';
import { BaseExchangeAdapter } from './base-exchange-adapter';
import {
  ExchangeName,
  ExchangeTrade,
  ExchangeAuthError,
  ExchangeApiError,
} from './types';

const COINBASE_API_URL = 'https://api.coinbase.com';

// BTC trading pairs on Coinbase (product_id format: BTC-USD, BTC-EUR, etc.)
const BTC_PRODUCT_IDS = [
  'BTC-USD', 'BTC-EUR', 'BTC-GBP', 'BTC-USDT', 'BTC-USDC',
];

export class CoinbaseAdapter extends BaseExchangeAdapter {
  readonly exchangeName: ExchangeName = 'COINBASE';
  readonly displayName = 'Coinbase';

  /**
   * Create HMAC-SHA256 signature for Coinbase API requests.
   */
  private createSignature(timestamp: string, method: string, requestPath: string, body: string = ''): string {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Make an authenticated request to a Coinbase API endpoint.
   */
  private async signedRequest(method: string, path: string, params?: Record<string, string>): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    let requestPath = path;
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      requestPath = `${path}?${queryString}`;
    }

    const signature = this.createSignature(timestamp, method, requestPath);
    const url = `${COINBASE_API_URL}${requestPath}`;

    const response = await this.fetchWithRetry(url, {
      method,
      headers: {
        'CB-ACCESS-KEY': this.credentials.apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMsg = errorBody.message || errorBody.error || `HTTP ${response.status}`;

      if (response.status === 401 || response.status === 403) {
        throw new ExchangeAuthError('COINBASE', errorMsg);
      }

      throw new ExchangeApiError('COINBASE', errorMsg, response.status);
    }

    return response.json();
  }

  /**
   * Validate credentials by calling the accounts endpoint (lightweight).
   */
  async authenticate(): Promise<boolean> {
    try {
      await this.signedRequest('GET', '/api/v3/brokerage/accounts', { limit: '1' });
      return true;
    } catch (error) {
      if (error instanceof ExchangeAuthError) {
        throw error;
      }
      throw new ExchangeAuthError('COINBASE', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Fetch all spot BTC fills from Coinbase.
   * Uses cursor-based pagination.
   */
  async fetchSpotTrades(since?: Date): Promise<ExchangeTrade[]> {
    const allTrades: ExchangeTrade[] = [];

    for (const productId of BTC_PRODUCT_IDS) {
      try {
        const productTrades = await this.fetchFillsForProduct(productId, since);
        allTrades.push(...productTrades);

        // Small delay between products to avoid rate limits
        if (BTC_PRODUCT_IDS.indexOf(productId) < BTC_PRODUCT_IDS.length - 1) {
          await this.sleep(300);
        }
      } catch (error) {
        // 404 or product not found is expected for pairs user hasn't traded
        if (error instanceof ExchangeApiError && error.statusCode === 404) {
          continue;
        }
        console.error(`[COINBASE] Error fetching fills for ${productId}:`, error);
      }
    }

    // Sort by timestamp
    allTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log(`[COINBASE] Fetched ${allTrades.length} BTC trades across ${BTC_PRODUCT_IDS.length} pairs`);
    return allTrades;
  }

  /**
   * Fetch fills for a specific product with cursor pagination.
   */
  private async fetchFillsForProduct(productId: string, since?: Date): Promise<ExchangeTrade[]> {
    const trades: ExchangeTrade[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    const limit = 100; // Coinbase max per request

    const quoteCurrency = productId.split('-')[1] || 'USD';

    while (hasMore) {
      const params: Record<string, string> = {
        product_id: productId,
        limit: limit.toString(),
      };

      if (cursor) {
        params.cursor = cursor;
      }

      if (since) {
        params.start_sequence_timestamp = since.toISOString();
      }

      const result = await this.signedRequest('GET', '/api/v3/brokerage/orders/historical/fills', params);

      const fills = result.fills || [];

      if (fills.length === 0) {
        hasMore = false;
        break;
      }

      for (const fill of fills) {
        const parsed = this.parseFill(fill, quoteCurrency);
        if (parsed) {
          trades.push(parsed);
        }
      }

      // Cursor-based pagination
      cursor = result.cursor;
      if (!cursor || fills.length < limit) {
        hasMore = false;
      } else {
        await this.sleep(200); // Rate limit courtesy
      }
    }

    return trades;
  }

  /**
   * Parse a single Coinbase fill into our ExchangeTrade format.
   */
  private parseFill(fill: any, quoteCurrency: string): ExchangeTrade | null {
    try {
      const side = (fill.side || '').toUpperCase();
      const isBuy = side === 'BUY';
      const btcAmount = parseFloat(fill.size) || 0;
      const price = parseFloat(fill.price) || 0;
      const commission = parseFloat(fill.commission) || 0;
      const timestamp = new Date(fill.trade_time || fill.sequence_timestamp);

      if (btcAmount <= 0 || price <= 0) {
        return null;
      }

      return {
        exchangeTradeId: fill.trade_id?.toString() || fill.entry_id || '',
        type: isBuy ? 'BUY' : 'SELL',
        btcAmount,
        pricePerBtc: price,
        totalAmount: btcAmount * price,
        fees: commission,
        feesCurrency: quoteCurrency,
        quoteCurrency,
        timestamp,
        rawData: fill,
      };
    } catch (error) {
      console.error(`[COINBASE] Failed to parse fill:`, error);
      return null;
    }
  }
}
