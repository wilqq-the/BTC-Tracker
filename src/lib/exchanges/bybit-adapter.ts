/**
 * Bybit Exchange Adapter
 * Implements the Bybit V5 API for fetching spot BTC trades.
 *
 * Authentication:
 *   - X-BAPI-API-KEY header: the API key
 *   - X-BAPI-SIGN header: HMAC-SHA256 of (timestamp + apiKey + recvWindow + queryString), keyed with API secret
 *   - X-BAPI-TIMESTAMP header: Unix timestamp in milliseconds
 *   - X-BAPI-RECV-WINDOW header: receive window (default 5000)
 *
 * Endpoint used:
 *   GET https://api.bybit.com/v5/execution/list
 */

import crypto from 'crypto';
import { BaseExchangeAdapter } from './base-exchange-adapter';
import {
  ExchangeName,
  ExchangeTrade,
  ExchangeAuthError,
  ExchangeApiError,
} from './types';

const BYBIT_API_URL = 'https://api.bybit.com';
const RECV_WINDOW = '20000';

// BTC spot trading pairs on Bybit
const BTC_SYMBOLS = [
  'BTCUSDT', 'BTCUSDC', 'BTCEUR', 'BTCEURS',
];

export class BybitAdapter extends BaseExchangeAdapter {
  readonly exchangeName: ExchangeName = 'BYBIT';
  readonly displayName = 'Bybit';

  /**
   * Create HMAC-SHA256 signature for Bybit V5 API requests.
   */
  private createSignature(timestamp: string, queryString: string): string {
    const preSign = timestamp + this.credentials.apiKey + RECV_WINDOW + queryString;
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(preSign)
      .digest('hex');
  }

  /**
   * Make an authenticated GET request to a Bybit V5 API endpoint.
   */
  private async signedRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const timestamp = Date.now().toString();
    const queryString = new URLSearchParams(params).toString();
    const signature = this.createSignature(timestamp, queryString);

    const url = queryString
      ? `${BYBIT_API_URL}${endpoint}?${queryString}`
      : `${BYBIT_API_URL}${endpoint}`;

    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': this.credentials.apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': RECV_WINDOW,
      },
    });

    const data = await response.json();

    if (data.retCode !== 0) {
      const errorMsg = data.retMsg || `Error code: ${data.retCode}`;

      // Auth-related error codes
      if (data.retCode === 10003 || data.retCode === 10004 || data.retCode === 33004 || data.retCode === 10001) {
        throw new ExchangeAuthError('BYBIT', errorMsg);
      }

      throw new ExchangeApiError('BYBIT', errorMsg, response.status);
    }

    return data.result;
  }

  /**
   * Validate credentials by calling the wallet balance endpoint (lightweight).
   */
  async authenticate(): Promise<boolean> {
    try {
      await this.signedRequest('/v5/account/wallet-balance', { accountType: 'UNIFIED' });
      return true;
    } catch (error) {
      if (error instanceof ExchangeAuthError) {
        throw error;
      }
      throw new ExchangeAuthError('BYBIT', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Fetch all spot BTC executions from Bybit.
   * Uses cursor-based pagination.
   */
  async fetchSpotTrades(since?: Date): Promise<ExchangeTrade[]> {
    const allTrades: ExchangeTrade[] = [];

    for (const symbol of BTC_SYMBOLS) {
      try {
        const symbolTrades = await this.fetchExecutionsForSymbol(symbol, since);
        allTrades.push(...symbolTrades);

        // Small delay between symbols to avoid rate limits
        if (BTC_SYMBOLS.indexOf(symbol) < BTC_SYMBOLS.length - 1) {
          await this.sleep(300);
        }
      } catch (error) {
        console.error(`[BYBIT] Error fetching executions for ${symbol}:`, error);
        // Continue with other symbols
      }
    }

    // Sort by timestamp
    allTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log(`[BYBIT] Fetched ${allTrades.length} BTC trades across ${BTC_SYMBOLS.length} pairs`);
    return allTrades;
  }

  /**
   * Fetch executions for a specific symbol with cursor pagination.
   */
  private async fetchExecutionsForSymbol(symbol: string, since?: Date): Promise<ExchangeTrade[]> {
    const trades: ExchangeTrade[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    const limit = 100; // Bybit max per request

    const quoteCurrency = this.extractQuoteCurrency(symbol);

    while (hasMore) {
      const params: Record<string, string> = {
        category: 'spot',
        symbol,
        limit: limit.toString(),
      };

      if (cursor) {
        params.cursor = cursor;
      }

      if (since) {
        params.startTime = since.getTime().toString();
      }

      const result = await this.signedRequest('/v5/execution/list', params);

      const executions = result?.list || [];

      if (executions.length === 0) {
        hasMore = false;
        break;
      }

      for (const execution of executions) {
        const parsed = this.parseExecution(execution, quoteCurrency);
        if (parsed) {
          trades.push(parsed);
        }
      }

      // Cursor-based pagination
      cursor = result?.nextPageCursor;
      if (!cursor || executions.length < limit) {
        hasMore = false;
      } else {
        await this.sleep(200); // Rate limit courtesy
      }
    }

    return trades;
  }

  /**
   * Extract the quote currency from a Bybit symbol.
   * e.g. BTCUSDT -> USDT, BTCUSDC -> USDC, BTCEUR -> EUR
   */
  private extractQuoteCurrency(symbol: string): string {
    if (symbol.startsWith('BTC')) {
      return symbol.substring(3);
    }
    return 'USDT'; // Fallback
  }

  /**
   * Parse a single Bybit execution into our ExchangeTrade format.
   */
  private parseExecution(execution: any, quoteCurrency: string): ExchangeTrade | null {
    try {
      const side = (execution.side || '').toUpperCase();
      const isBuy = side === 'BUY';
      const btcAmount = parseFloat(execution.execQty) || 0;
      const price = parseFloat(execution.execPrice) || 0;
      const fee = parseFloat(execution.execFee) || 0;
      const timestamp = new Date(parseInt(execution.execTime) || 0);

      if (btcAmount <= 0 || price <= 0) {
        return null;
      }

      return {
        exchangeTradeId: execution.execId || '',
        type: isBuy ? 'BUY' : 'SELL',
        btcAmount,
        pricePerBtc: price,
        totalAmount: btcAmount * price,
        fees: Math.abs(fee),
        feesCurrency: execution.feeCurrency || quoteCurrency,
        quoteCurrency,
        timestamp,
        rawData: execution,
      };
    } catch (error) {
      console.error(`[BYBIT] Failed to parse execution:`, error);
      return null;
    }
  }
}
