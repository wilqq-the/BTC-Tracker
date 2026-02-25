/**
 * Exchange Adapters - Factory and re-exports
 */

export { BaseExchangeAdapter } from './base-exchange-adapter';
export { KrakenAdapter } from './kraken-adapter';
export { BinanceAdapter } from './binance-adapter';
export { CoinbaseAdapter } from './coinbase-adapter';
export { BybitAdapter } from './bybit-adapter';
export { GeminiAdapter } from './gemini-adapter';
export * from './types';

import { BaseExchangeAdapter } from './base-exchange-adapter';
import { KrakenAdapter } from './kraken-adapter';
import { BinanceAdapter } from './binance-adapter';
import { CoinbaseAdapter } from './coinbase-adapter';
import { BybitAdapter } from './bybit-adapter';
import { GeminiAdapter } from './gemini-adapter';
import { ExchangeName, ExchangeCredentials } from './types';

/** Metadata about supported exchanges (for UI display) */
export const SUPPORTED_EXCHANGES: { name: ExchangeName; displayName: string; description: string }[] = [
  {
    name: 'BINANCE',
    displayName: 'Binance',
    description: 'Binance exchange - supports spot BTC trading pairs',
  },
  {
    name: 'COINBASE',
    displayName: 'Coinbase',
    description: 'Coinbase Advanced Trade - supports spot BTC trading pairs',
  },
  {
    name: 'KRAKEN',
    displayName: 'Kraken',
    description: 'Kraken exchange - supports spot BTC trading pairs',
  },
  {
    name: 'BYBIT',
    displayName: 'Bybit',
    description: 'Bybit exchange - supports spot BTC trading pairs',
  },
  {
    name: 'GEMINI',
    displayName: 'Gemini',
    description: 'Gemini exchange - supports spot BTC trading pairs',
  },
];

/**
 * Factory function to create the appropriate exchange adapter.
 */
export function getExchangeAdapter(
  exchangeName: ExchangeName,
  credentials: ExchangeCredentials
): BaseExchangeAdapter {
  switch (exchangeName) {
    case 'KRAKEN':
      return new KrakenAdapter(credentials);
    case 'BINANCE':
      return new BinanceAdapter(credentials);
    case 'COINBASE':
      return new CoinbaseAdapter(credentials);
    case 'BYBIT':
      return new BybitAdapter(credentials);
    case 'GEMINI':
      return new GeminiAdapter(credentials);
    default:
      throw new Error(`Unsupported exchange: ${exchangeName}`);
  }
}
