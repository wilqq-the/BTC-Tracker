/**
 * Revolut X CSV parser
 *
 * Export: Revolut X app → account settings → Documents & statements →
 * Account statement → Excel (.csv).
 *
 * Headers: Symbol, Type, Quantity, Price, Value, Fees, Date
 *
 * The export is localised to the app language. Polish example:
 *   BTC,Kupno — Revolut X,"0,00011234","44 500,00$","4,99$","0,00$","3 sty 2025, 08:23:04"
 *   USD,Inne,,,"8,50$","0,00 PLN","3 sty 2025, 08:22:11"   ← top-up, skipped
 *
 * So numbers can use a decimal comma and (non-breaking) spaces as thousands
 * separators, amounts carry a currency symbol, and month names are localised.
 * Polish and English are recognised; rows that can't be understood are
 * skipped rather than guessed.
 *
 * Mapping: BTC + buy ("Kupno"/"Buy") → BUY, BTC + sell ("Sprzedaż"/"Sell")
 * → SELL; everything else (fiat top-ups "Inne"/"Other", other coins) is skipped.
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

// Month name/abbreviation → month number. Polish (incl. genitive forms) and English.
const MONTHS: Record<string, number> = {
  sty: 1, lut: 2, mar: 3, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paz: 10, lis: 11, gru: 12,
  jan: 1, feb: 2, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const CURRENCY_SYMBOLS: Array<[RegExp, string]> = [
  [/zł|pln/i, 'PLN'],
  [/€|eur/i, 'EUR'],
  [/£|gbp/i, 'GBP'],
  [/\$|usd/i, 'USD'],
];

export class RevolutXParser extends BaseParser {
  name = 'revolutx';

  private readonly headersRequired = ['symbol', 'type', 'quantity', 'price', 'value', 'fees', 'date'];

  canParse(headers: string[]): boolean {
    const lc = headers.map(h => h.toLowerCase().trim());
    return this.headersRequired.every(h => lc.includes(h));
  }

  getConfidenceScore(headers: string[]): number {
    const lc = headers.map(h => h.toLowerCase().trim());
    const found = this.headersRequired.filter(h => lc.includes(h)).length;
    // "symbol" + "quantity" + "fees" together are distinctive for Revolut X
    const exact = lc.length === this.headersRequired.length ? 10 : 0;
    return Math.min(100, (found / this.headersRequired.length) * 90 + exact);
  }

  /**
   * Parse a localised amount such as "44 500,00$", "0,00011234", "$44,500.00",
   * "1.234,56 €" or "0,00 PLN" into a number.
   */
  parseAmount(raw: string): number {
    if (!raw) return 0;
    // Drop currency symbols/codes and every kind of space (incl. NBSP / narrow NBSP)
    let s = raw.replace(/[^\d.,\-]/g, '');
    if (!s) return 0;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma > -1 && lastDot > -1) {
      // Both present: whichever comes last is the decimal separator
      s = lastComma > lastDot
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
    } else if (lastComma > -1) {
      const parts = s.split(',');
      const decimals = parts[parts.length - 1];
      const integer = parts.slice(0, -1).join('');
      // A single comma is a decimal comma unless it looks like "12,345"
      // (exactly three digits after it and a non-zero integer part)
      const isThousands = parts.length > 2 || (decimals.length === 3 && !/^-?0*$/.test(integer));
      s = isThousands ? parts.join('') : `${integer}.${decimals}`;
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /** Currency from an amount string ("44 500,00$" → USD, "0,00 PLN" → PLN) */
  detectCurrency(raw: string, fallback = 'USD'): string {
    for (const [pattern, code] of CURRENCY_SYMBOLS) {
      if (pattern.test(raw || '')) return code;
    }
    return fallback;
  }

  /**
   * Parse "3 sty 2025, 08:23:04", "25 lut 2025", "3 Jan 2025, 08:23",
   * "Jan 3, 2025" or ISO dates into YYYY-MM-DD.
   */
  parseLocalisedDate(raw: string): string {
    if (!raw) return '';
    const text = raw
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // "paź" → "paz"
      .replace(/ł/g, 'l');

    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const pad = (n: number) => String(n).padStart(2, '0');
    const month = (name: string) => MONTHS[name.replace('.', '').slice(0, 3)];

    // "3 sty 2025" / "3 jan 2025"
    let m = text.match(/(\d{1,2})\s+([a-z.]+)\s+(\d{4})/);
    if (m && month(m[2])) return `${m[3]}-${pad(month(m[2]))}-${pad(+m[1])}`;

    // "jan 3, 2025"
    m = text.match(/([a-z.]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && month(m[1])) return `${m[3]}-${pad(month(m[1]))}-${pad(+m[2])}`;

    // "03.01.2025" / "03/01/2025" (day first, as Revolut writes it in EU locales)
    m = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;

    return '';
  }

  private field(transaction: Record<string, string>, name: string): string {
    const key = Object.keys(transaction).find(k => k.toLowerCase().trim() === name);
    return key ? (transaction[key] || '').trim() : '';
  }

  parseTransaction(transaction: any): ImportTransaction | null {
    const symbol = this.field(transaction, 'symbol').toUpperCase();
    if (symbol !== 'BTC') return null; // fiat top-ups ("Inne"/"Other") and other coins

    const typeText = this.field(transaction, 'type').toLowerCase();
    const side: 'BUY' | 'SELL' | null =
      /kupno|buy|purchase/.test(typeText) ? 'BUY'
        : /sprzeda|sell|sale/.test(typeText) ? 'SELL'
          : null;
    if (!side) return null;

    const priceRaw = this.field(transaction, 'price');
    const valueRaw = this.field(transaction, 'value');
    const feesRaw = this.field(transaction, 'fees');

    const btcAmount = Math.abs(this.parseAmount(this.field(transaction, 'quantity')));
    const value = Math.abs(this.parseAmount(valueRaw));
    const price = Math.abs(this.parseAmount(priceRaw)) || (btcAmount > 0 ? value / btcAmount : 0);
    const currency = this.detectCurrency(priceRaw || valueRaw);
    const fees = Math.abs(this.parseAmount(feesRaw));
    const date = this.parseLocalisedDate(this.field(transaction, 'date'));

    if (btcAmount <= 0 || !date) return null;

    const result: ImportTransaction = {
      type: side,
      btc_amount: btcAmount,
      original_price_per_btc: price,
      original_currency: currency,
      original_total_amount: value || btcAmount * price,
      fees,
      fees_currency: this.detectCurrency(feesRaw, currency),
      transaction_date: date,
      notes: `Revolut X ${side === 'BUY' ? 'buy' : 'sale'}`,
    };

    try {
      return this.validateTransaction(result);
    } catch {
      return null;
    }
  }
}
