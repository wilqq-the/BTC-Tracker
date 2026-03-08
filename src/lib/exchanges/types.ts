/**
 * Exchange Sync Type Definitions
 * Shared types for the exchange adapter system.
 */

/** Supported exchange names */
export type ExchangeName = 'KRAKEN' | 'BINANCE' | 'COINBASE' | 'BYBIT' | 'GEMINI';

/** Raw trade data fetched from an exchange API */
export interface ExchangeTrade {
  /** Exchange-specific trade/order ID */
  exchangeTradeId: string;
  /** Trade type */
  type: 'BUY' | 'SELL';
  /** Amount of BTC traded */
  btcAmount: number;
  /** Price per BTC in the quote currency */
  pricePerBtc: number;
  /** Total cost/proceeds in the quote currency */
  totalAmount: number;
  /** Trading fees */
  fees: number;
  /** Currency of the fees */
  feesCurrency: string;
  /** Quote currency (e.g. EUR, USD) */
  quoteCurrency: string;
  /** When the trade was executed */
  timestamp: Date;
  /** Raw data from the exchange (for debugging) */
  rawData?: Record<string, unknown>;
}

/** Normalized transaction ready for import into our database */
export interface NormalizedTransaction {
  type: 'BUY' | 'SELL';
  btcAmount: number;
  pricePerBtc: number;
  totalAmount: number;
  currency: string;
  fees: number;
  feesCurrency: string;
  transactionDate: Date;
  notes: string;
  tags: string;
}

/** Configuration for an exchange connection */
export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
}

/** Result of a sync operation */
export interface SyncResult {
  success: boolean;
  exchangeName: ExchangeName;
  totalFetched: number;
  imported: number;
  skipped: number;
  errors: string[];
  syncedAt: Date;
}

/** Error types specific to exchange operations */
export class ExchangeAuthError extends Error {
  constructor(exchange: ExchangeName, message: string) {
    super(`[${exchange}] Authentication failed: ${message}`);
    this.name = 'ExchangeAuthError';
  }
}

export class ExchangeApiError extends Error {
  public statusCode?: number;

  constructor(exchange: ExchangeName, message: string, statusCode?: number) {
    super(`[${exchange}] API error: ${message}`);
    this.name = 'ExchangeApiError';
    this.statusCode = statusCode;
  }
}

export class ExchangeRateLimitError extends ExchangeApiError {
  public retryAfterMs: number;

  constructor(exchange: ExchangeName, retryAfterMs: number = 60000) {
    super(exchange, `Rate limited. Retry after ${retryAfterMs}ms`, 429);
    this.name = 'ExchangeRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}
