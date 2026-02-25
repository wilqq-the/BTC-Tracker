/**
 * Kraken Exchange Adapter
 * Implements the Kraken REST API v0 for fetching spot BTC trades.
 *
 * Authentication:
 *   - API-Key header: the API key
 *   - API-Sign header: HMAC-SHA512 of (uri_path + SHA256(nonce + POST_data)), keyed with base64-decoded secret
 *
 * Endpoint used:
 *   POST https://api.kraken.com/0/private/TradesHistory
 */

import crypto from 'crypto';
import { BaseExchangeAdapter } from './base-exchange-adapter';
import {
  ExchangeName,
  ExchangeTrade,
  ExchangeAuthError,
  ExchangeApiError,
} from './types';

const KRAKEN_API_URL = 'https://api.kraken.com';

// BTC trading pairs on Kraken (Kraken uses XBT internally)
const BTC_PAIRS = [
  'XXBTZUSD', 'XXBTZEUR', 'XXBTZGBP', 'XXBTZCAD', 'XXBTZJPY', 'XXBTZCAD',
  'XBTUSDT', 'XBTUSDC',
  // Newer pair naming convention
  'BTC/USD', 'BTC/EUR', 'BTC/GBP', 'BTC/CAD', 'BTC/JPY',
  'BTCUSDT', 'BTCUSDC',
];

export class KrakenAdapter extends BaseExchangeAdapter {
  readonly exchangeName: ExchangeName = 'KRAKEN';
  readonly displayName = 'Kraken';

  /**
   * Create the API-Sign header value for Kraken private endpoints.
   */
  private createSignature(urlPath: string, postData: string, nonce: number): string {
    const message = nonce + postData;
    const hash = crypto.createHash('sha256').update(message).digest();
    const secretBuffer = Buffer.from(this.credentials.apiSecret, 'base64');
    const hmac = crypto.createHmac('sha512', secretBuffer);
    hmac.update(Buffer.concat([Buffer.from(urlPath), hash]));
    return hmac.digest('base64');
  }

  /**
   * Make an authenticated request to a Kraken private endpoint.
   */
  private async privateRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const urlPath = `/0/private/${endpoint}`;
    const url = `${KRAKEN_API_URL}${urlPath}`;
    const nonce = Date.now() * 1000; // Microsecond nonce

    const postParams = new URLSearchParams({ nonce: nonce.toString(), ...params });
    const postData = postParams.toString();
    const signature = this.createSignature(urlPath, postData, nonce);

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'API-Key': this.credentials.apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData,
    });

    const data = await response.json();

    if (data.error && data.error.length > 0) {
      const errorMsg = data.error.join(', ');

      if (errorMsg.includes('EAPI:Invalid key') || errorMsg.includes('EAPI:Invalid signature')) {
        throw new ExchangeAuthError('KRAKEN', errorMsg);
      }

      throw new ExchangeApiError('KRAKEN', errorMsg, response.status);
    }

    return data.result;
  }

  /**
   * Validate credentials by calling the Balance endpoint (lightweight).
   */
  async authenticate(): Promise<boolean> {
    try {
      await this.privateRequest('Balance');
      return true;
    } catch (error) {
      if (error instanceof ExchangeAuthError) {
        throw error;
      }
      throw new ExchangeAuthError('KRAKEN', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Fetch all spot BTC trades from Kraken.
   * Uses pagination via the `ofs` (offset) parameter.
   */
  async fetchSpotTrades(since?: Date): Promise<ExchangeTrade[]> {
    const allTrades: ExchangeTrade[] = [];
    let offset = 0;
    const pageSize = 50; // Kraken returns up to 50 trades per request
    let hasMore = true;

    const params: Record<string, string> = {
      type: 'all',
      trades: 'true',
    };

    if (since) {
      // Kraken expects Unix timestamp for 'start'
      params.start = Math.floor(since.getTime() / 1000).toString();
    }

    while (hasMore) {
      const result = await this.privateRequest('TradesHistory', {
        ...params,
        ofs: offset.toString(),
      });

      const trades = result?.trades || {};
      const tradeIds = Object.keys(trades);

      if (tradeIds.length === 0) {
        hasMore = false;
        break;
      }

      for (const tradeId of tradeIds) {
        const trade = trades[tradeId];
        const pair = (trade.pair || '').toUpperCase();

        // Only include BTC spot trades
        if (!this.isBtcPair(pair)) {
          continue;
        }

        const parsed = this.parseTrade(tradeId, trade);
        if (parsed) {
          allTrades.push(parsed);
        }
      }

      offset += tradeIds.length;

      // If we got fewer than pageSize, we've reached the end
      if (tradeIds.length < pageSize) {
        hasMore = false;
      }

      // Small delay between pages to be polite to the API
      if (hasMore) {
        await this.sleep(1000);
      }
    }

    console.log(`[KRAKEN] Fetched ${allTrades.length} BTC trades (scanned ${offset} total trades)`);
    return allTrades;
  }

  /**
   * Check if a Kraken pair is a BTC spot pair.
   */
  private isBtcPair(pair: string): boolean {
    const upper = pair.toUpperCase().replace('/', '');
    return BTC_PAIRS.some(p => upper === p.replace('/', '')) ||
           upper.startsWith('XXBT') ||
           upper.startsWith('XBT') ||
           (upper.startsWith('BTC') && !upper.includes('CASH'));
  }

  /**
   * Extract the quote currency from a Kraken pair.
   * e.g. XXBTZEUR -> EUR, XBTUSDT -> USDT, BTC/USD -> USD
   */
  private extractQuoteCurrency(pair: string): string {
    // Handle slash-separated pairs
    if (pair.includes('/')) {
      return pair.split('/')[1];
    }

    // Handle Kraken's legacy naming: XXBTZEUR, XXBTZUSD, etc.
    const legacyMatch = pair.match(/^XXBT[Z]?(.+)$/);
    if (legacyMatch) {
      const currency = legacyMatch[1];
      // Kraken uses Z-prefix for fiat: ZUSD -> USD, ZEUR -> EUR
      return currency.startsWith('Z') ? currency.substring(1) : currency;
    }

    // Handle newer naming: XBTUSDT, BTCUSD, BTCEUR, etc.
    const newMatch = pair.match(/^(?:XBT|BTC)(.+)$/);
    if (newMatch) {
      return newMatch[1];
    }

    return 'USD'; // Fallback
  }

  /**
   * Parse a single Kraken trade object into our ExchangeTrade format.
   */
  private parseTrade(tradeId: string, trade: any): ExchangeTrade | null {
    try {
      const pair = trade.pair || '';
      const quoteCurrency = this.extractQuoteCurrency(pair.toUpperCase());

      const type = trade.type === 'buy' ? 'BUY' : 'SELL';
      const btcAmount = parseFloat(trade.vol) || 0;
      const price = parseFloat(trade.price) || 0;
      const cost = parseFloat(trade.cost) || 0;
      const fee = parseFloat(trade.fee) || 0;
      const timestamp = new Date((parseFloat(trade.time) || 0) * 1000);

      if (btcAmount <= 0 || price <= 0) {
        return null;
      }

      return {
        exchangeTradeId: tradeId,
        type,
        btcAmount,
        pricePerBtc: price,
        totalAmount: cost,
        fees: fee,
        feesCurrency: quoteCurrency,
        quoteCurrency,
        timestamp,
        rawData: trade,
      };
    } catch (error) {
      console.error(`[KRAKEN] Failed to parse trade ${tradeId}:`, error);
      return null;
    }
  }
}
