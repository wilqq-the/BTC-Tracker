/**
 * Bitcoin amount formatting in the user's chosen unit (BTC or sats).
 * Amounts are always stored and passed around in BTC; only display changes.
 */

export type BtcUnit = 'btc' | 'sats';

export const SATS_PER_BTC = 100_000_000;

export const otherUnit = (unit: BtcUnit): BtcUnit => (unit === 'btc' ? 'sats' : 'btc');

export const unitLabel = (unit: BtcUnit) => (unit === 'btc' ? 'BTC' : 'sats');

export interface FormatBtcOptions {
  /** Append " BTC" / " sats" (default true) */
  withUnit?: boolean;
  /** BTC only: drop trailing zeros ("0.05" instead of "0.05000000") */
  trim?: boolean;
  /** Prefix "+" for positive amounts ("-" is always shown) */
  signed?: boolean;
}

/** Format a BTC amount in the given unit, e.g. "0.44558838 BTC" or "44,558,838 sats" */
export function formatBtc(amount: number, unit: BtcUnit, options: FormatBtcOptions = {}): string {
  const { withUnit = true, trim = false, signed = false } = options;
  const value = Number.isFinite(amount) ? amount : 0;
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  const abs = Math.abs(value);

  let text: string;
  let label = unitLabel(unit);
  if (unit === 'sats') {
    const sats = Math.round(abs * SATS_PER_BTC);
    text = sats.toLocaleString('en-US');
    if (sats === 1) label = 'sat';
  } else {
    text = abs.toFixed(8);
    if (trim) text = text.replace(/\.?0+$/, '') || '0';
  }
  return `${sign}${text}${withUnit ? ` ${label}` : ''}`;
}
