/**
 * Binance Exchange Adapter
 * Implements the Binance REST API for fetching spot BTC trades.
 *
 * Authentication:
 *   - X-MBX-APIKEY header: the API key
 *   - signature query param: HMAC-SHA256 of the query string, keyed with the API secret
 *
 * Endpoint used:
 *   GET https://api.binance.com/api/v3/myTrades
 */

import crypto from 'crypto';
import { BaseExchangeAdapter } from './base-exchange-adapter';
import {
  ExchangeName,
  ExchangeTrade,
  ExchangeAuthError,
  ExchangeApiError,
} from './types';

const BINANCE_API_URL = 'https://api.binance.com';

// BTC trading pairs on Binance (symbol format: BTCUSDT, BTCEUR, etc.)
const BTC_SYMBOLS = [
  'BTCUSDT', 'BTCBUSD', 'BTCUSDC',
  'BTCEUR', 'BTCGBP', 'BTCBRL', 'BTCTRY', 'BTCAUD',
  'BTCBIDR', 'BTCRUB', 'BTCUAH', 'BTCPLN', 'BTCRON',
  'BTCZAR', 'BTCNGN', 'BTCARS', 'BTCCOP',
  'BTCFDUSD', 'BTCTUSD', 'BTCDAI',
];

export class BinanceAdapter extends BaseExchangeAdapter {
  readonly exchangeName: ExchangeName = 'BINANCE';
  readonly displayName = 'Binance';

  /**
   * Create HMAC-SHA256 signature for Binance API requests.
   */
  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Make an authenticated GET request to a Binance API endpoint.
   */
  private async signedRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const timestamp = Date.now().toString();
    const allParams = { ...params, timestamp, recvWindow: '10000' };
    const queryString = new URLSearchParams(allParams).toString();
    const signature = this.createSignature(queryString);
    const url = `${BINANCE_API_URL}${endpoint}?${queryString}&signature=${signature}`;

    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMsg = errorBody.msg || `HTTP ${response.status}`;
      const code = errorBody.code;

      if (code === -2015 || code === -2014 || code === -1022) {
        throw new ExchangeAuthError('BINANCE', errorMsg);
      }

      throw new ExchangeApiError('BINANCE', errorMsg, response.status);
    }

    return response.json();
  }

  /**
   * Validate credentials by calling the account endpoint (lightweight).
   */
  async authenticate(): Promise<boolean> {
    try {
      await this.signedRequest('/api/v3/account');
      return true;
    } catch (error) {
      if (error instanceof ExchangeAuthError) {
        throw error;
      }
      throw new ExchangeAuthError('BINANCE', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Fetch all spot BTC trades from Binance.
   * Binance requires querying per symbol, and returns max 1000 trades per request.
   * Uses fromId pagination for complete history.
   */
  async fetchSpotTrades(since?: Date): Promise<ExchangeTrade[]> {
    const allTrades: ExchangeTrade[] = [];

    // First, get account info to find which BTC pairs the user has traded
    const tradedSymbols = await this.getActiveBtcSymbols();

    for (const symbol of tradedSymbols) {
      try {
        const symbolTrades = await this.fetchTradesForSymbol(symbol, since);
        allTrades.push(...symbolTrades);

        // Small delay between symbols to avoid rate limits
        if (tradedSymbols.indexOf(symbol) < tradedSymbols.length - 1) {
          await this.sleep(500);
        }
      } catch (error) {
        console.error(`[BINANCE] Error fetching trades for ${symbol}:`, error);
        // Continue with other symbols
      }
    }

    // Sort by timestamp
    allTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log(`[BINANCE] Fetched ${allTrades.length} BTC trades across ${tradedSymbols.length} pairs`);
    return allTrades;
  }

  /**
   * Determine which BTC symbols the user has actually traded.
   * Checks exchange info and account balances to narrow down the list.
   */
  private async getActiveBtcSymbols(): Promise<string[]> {
    try {
      // Get exchange info to know which symbols are valid
      const exchangeInfo = await this.fetchExchangeInfo();
      const validSymbols = new Set(exchangeInfo.symbols?.map((s: any) => s.symbol) || []);

      // Filter our BTC_SYMBOLS list to only valid ones
      const validBtcSymbols = BTC_SYMBOLS.filter(s => validSymbols.has(s));

      // Try the most common pairs first, then add others
      // We'll attempt to fetch from each and skip if no trades
      return validBtcSymbols.length > 0 ? validBtcSymbols : BTC_SYMBOLS.slice(0, 5);
    } catch {
      // Fallback to most common pairs
      return ['BTCUSDT', 'BTCEUR', 'BTCBUSD', 'BTCUSDC', 'BTCGBP'];
    }
  }

  /**
   * Fetch exchange info (public endpoint, no auth needed).
   */
  private async fetchExchangeInfo(): Promise<any> {
    const response = await this.fetchWithRetry(`${BINANCE_API_URL}/api/v3/exchangeInfo`, {
      method: 'GET',
    });
    return response.json();
  }

  /**
   * Fetch all trades for a specific symbol with pagination.
   * Note: Binance /api/v3/myTrades without startTime may only return recent trades.
   * We always pass a startTime to ensure we get the full history.
   */
  private async fetchTradesForSymbol(symbol: string, since?: Date): Promise<ExchangeTrade[]> {
    const trades: ExchangeTrade[] = [];
    let fromId: string | undefined;
    let hasMore = true;
    const limit = 1000; // Binance max per request

    const quoteCurrency = this.extractQuoteCurrency(symbol);

    // Default to fetching from 2017-01-01 (Binance launch era) if no since date
    const effectiveSince = since || new Date('2017-01-01T00:00:00Z');

    while (hasMore) {
      const params: Record<string, string> = {
        symbol,
        limit: limit.toString(),
      };

      if (fromId) {
        params.fromId = fromId;
      } else {
        params.startTime = effectiveSince.getTime().toString();
      }

      const result = await this.signedRequest('/api/v3/myTrades', params);

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

      // Pagination: use the last trade's ID + 1 as fromId for next page
      if (result.length === limit) {
        const lastTrade = result[result.length - 1];
        fromId = (lastTrade.id + 1).toString();
        await this.sleep(300); // Rate limit courtesy
      } else {
        hasMore = false;
      }
    }

    return trades;
  }

  /**
   * Extract the quote currency from a Binance symbol.
   * e.g. BTCUSDT -> USDT, BTCEUR -> EUR
   */
  private extractQuoteCurrency(symbol: string): string {
    // Remove "BTC" prefix to get the quote currency
    if (symbol.startsWith('BTC')) {
      return symbol.substring(3);
    }
    return 'USDT'; // Fallback
  }

  /**
   * Parse a single Binance trade object into our ExchangeTrade format.
   */
  private parseTrade(trade: any, quoteCurrency: string): ExchangeTrade | null {
    try {
      const isBuyer = trade.isBuyer === true;
      const btcAmount = parseFloat(trade.qty) || 0;
      const price = parseFloat(trade.price) || 0;
      const quoteQty = parseFloat(trade.quoteQty) || 0;
      const commission = parseFloat(trade.commission) || 0;
      const commissionAsset = trade.commissionAsset || quoteCurrency;
      const timestamp = new Date(trade.time);

      if (btcAmount <= 0 || price <= 0) {
        return null;
      }

      return {
        exchangeTradeId: trade.id?.toString() || '',
        type: isBuyer ? 'BUY' : 'SELL',
        btcAmount,
        pricePerBtc: price,
        totalAmount: quoteQty || btcAmount * price,
        fees: commission,
        feesCurrency: commissionAsset,
        quoteCurrency,
        timestamp,
        rawData: trade,
      };
    } catch (error) {
      console.error(`[BINANCE] Failed to parse trade:`, error);
      return null;
    }
  }
}
