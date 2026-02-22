/**
 * Strike exchange CSV parser
 *
 * Supports two export formats:
 *
 * Format A (older):
 *   Transaction ID, Time (UTC), Status, Transaction Type, Amount EUR, Fee EUR,
 *   Amount BTC, Fee BTC, Description, Exchange Rate, Transaction Hash
 *
 * Format B (newer):
 *   Reference, Date & Time (UTC), Transaction Type, Amount EUR, Fee EUR,
 *   Amount BTC, Fee BTC, BTC Price, Cost Basis (EUR), Destination,
 *   Description, Transaction Hash, Note
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class StrikeParser extends BaseParser {
  name = 'strike';

  // Headers shared by both formats
  private readonly sharedHeaders = [
    'transaction type',
    'amount btc',
    'fee btc',
  ];

  // Headers with dynamic currency: matched via pattern
  private readonly sharedPatterns = [
    /^amount (?!btc)\w+$/,  // "amount eur", "amount usd", etc.
    /^fee (?!btc)\w+$/,     // "fee eur", "fee usd", etc.
  ];

  // Format A specific headers
  private readonly formatAHeaders = [
    'transaction id',
    'time (utc)',
    'status',
    'exchange rate',
  ];

  // Format B specific headers
  private readonly formatBHeaders = [
    'reference',
    'date & time (utc)',
    'btc price',
    'cost basis (eur)',
  ];

  canParse(headers: string[]): boolean {
    const lc = headers.map(h => h.toLowerCase().trim());

    const sharedFixed = this.sharedHeaders.filter(h => lc.includes(h)).length;
    const sharedPattern = this.sharedPatterns.filter(p => lc.some(h => p.test(h))).length;
    const sharedCount = sharedFixed + sharedPattern;

    // Need at least 4 of the 5 shared indicators
    return sharedCount >= 4;
  }

  getConfidenceScore(headers: string[]): number {
    const lc = headers.map(h => h.toLowerCase().trim());

    const sharedFixed = this.sharedHeaders.filter(h => lc.includes(h)).length;
    const sharedPattern = this.sharedPatterns.filter(p => lc.some(h => p.test(h))).length;
    const sharedCount = sharedFixed + sharedPattern;

    const formatACount = this.formatAHeaders.filter(h => lc.includes(h)).length;
    const formatBCount = this.formatBHeaders.filter(h => lc.includes(h)).length;

    const totalShared = this.sharedHeaders.length + this.sharedPatterns.length; // 5
    const formatSpecific = Math.max(formatACount, formatBCount);
    const formatTotal = formatACount > formatBCount
      ? this.formatAHeaders.length
      : this.formatBHeaders.length;

    // 60% from shared headers, 40% from format-specific
    const score = (sharedCount / totalShared) * 60 +
      (formatSpecific / formatTotal) * 40;

    return Math.min(score, 100);
  }

  /**
   * Detect fiat currency from headers (e.g. "Amount EUR" → "EUR")
   */
  private detectFiatCurrency(headers: string[]): string {
    for (const h of headers) {
      const match = h.toLowerCase().trim().match(/^amount (\w+)$/);
      if (match && match[1] !== 'btc') {
        return match[1].toUpperCase();
      }
    }
    return 'USD';
  }

  /**
   * Parse Strike date format "Jan 01 2026 10:33:55" → "2026-01-01"
   */
  private parseStrikeDate(dateStr: string): string {
    if (!dateStr) return '';

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return super.parseDate(dateStr);
    }

    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Detect whether this is Format A or Format B
   */
  private isFormatA(headers: string[]): boolean {
    const lc = headers.map(h => h.toLowerCase().trim());
    return lc.includes('transaction id') || lc.includes('status');
  }

  /**
   * Get a field value from the transaction object, case-insensitive
   */
  private getField(transaction: Record<string, string>, name: string): string {
    // The CSV parser may use the exact header casing as the key
    const key = Object.keys(transaction).find(
      k => k.toLowerCase().trim() === name.toLowerCase()
    );
    return key ? (transaction[key] || '').trim() : '';
  }

  /**
   * Find the fiat amount field (e.g. "amount eur")
   */
  private getFiatAmountField(transaction: Record<string, string>): string {
    const key = Object.keys(transaction).find(k => {
      const lc = k.toLowerCase().trim();
      return lc.startsWith('amount ') && !lc.endsWith('btc');
    });
    return key ? (transaction[key] || '').trim() : '';
  }

  /**
   * Find the fiat fee field (e.g. "fee eur")
   */
  private getFiatFeeField(transaction: Record<string, string>): string {
    const key = Object.keys(transaction).find(k => {
      const lc = k.toLowerCase().trim();
      return lc.startsWith('fee ') && !lc.endsWith('btc');
    });
    return key ? (transaction[key] || '').trim() : '';
  }

  parseTransaction(
    transaction: any,
    headers: string[],
    values: string[]
  ): ImportTransaction | null {
    const formatA = this.isFormatA(headers);
    const currency = this.detectFiatCurrency(headers);

    // Format A: skip reversed transactions
    if (formatA) {
      const status = this.getField(transaction, 'status').toLowerCase();
      if (status === 'reversed') {
        return null;
      }
    }

    const transactionType = this.getField(transaction, 'transaction type').toLowerCase();
    const description = this.getField(transaction, 'description').toLowerCase();
    const amountBtcRaw = this.parseFloat(this.getField(transaction, 'amount btc'));
    const fiatAmountRaw = this.parseFloat(this.getFiatAmountField(transaction));
    const fiatFee = this.parseFloat(this.getFiatFeeField(transaction));
    // Date: Format A uses "Time (UTC)", Format B uses "Date & Time (UTC)"
    const dateStr = formatA
      ? this.getField(transaction, 'time (utc)')
      : this.getField(transaction, 'date & time (utc)');
    const transactionDate = this.parseStrikeDate(dateStr);

    // Price per BTC: Format A = "Exchange Rate", Format B = "BTC Price"
    const priceFromColumn = formatA
      ? this.parseFloat(this.getField(transaction, 'exchange rate'))
      : this.parseFloat(this.getField(transaction, 'btc price'));

    // Identifier for notes
    const txId = formatA
      ? this.getField(transaction, 'transaction id')
      : this.getField(transaction, 'reference');

    // --- Skip: Deposit ---
    if (transactionType === 'deposit') {
      return null;
    }

    // --- Send / Transfer ---
    if (transactionType === 'send' && amountBtcRaw < 0) {
      const btcAmount = Math.abs(amountBtcRaw);
      const pricePerBtc = priceFromColumn > 0 ? priceFromColumn : 0;
      const destination = this.getField(transaction, 'destination') || null;

      const result: ImportTransaction = {
        type: 'TRANSFER',
        btc_amount: btcAmount,
        original_price_per_btc: pricePerBtc,
        original_currency: currency,
        original_total_amount: 0,
        fees: 0,
        fees_currency: currency,
        transaction_date: transactionDate,
        notes: `Strike Send${txId ? ` (${txId})` : ''}`,
        transfer_type: 'TO_COLD_WALLET',
        destination_address: destination,
      };

      try {
        return this.validateTransaction(result);
      } catch {
        return null;
      }
    }

    // --- Initiated target order: negative fiat, no BTC, description match ---
    if (
      fiatAmountRaw < 0 &&
      amountBtcRaw === 0 &&
      description.includes('initiated target order')
    ) {
      return null;
    }

    // --- Cancelled/expired target order: positive fiat refund, description match ---
    if (
      fiatAmountRaw > 0 &&
      (description.includes('cancelled') || description.includes('expired'))
    ) {
      return null;
    }

    // --- Executed target order: positive BTC, no fiat movement ---
    if (
      amountBtcRaw > 0 &&
      fiatAmountRaw === 0 &&
      description.includes('executed target order')
    ) {
      const btcAmount = amountBtcRaw;
      const pricePerBtc = priceFromColumn > 0 ? priceFromColumn : 0;
      const totalAmount = pricePerBtc > 0 ? btcAmount * pricePerBtc : 0;

      const result: ImportTransaction = {
        type: 'BUY',
        btc_amount: btcAmount,
        original_price_per_btc: pricePerBtc,
        original_currency: currency,
        original_total_amount: totalAmount,
        fees: 0,
        fees_currency: currency,
        transaction_date: transactionDate,
        notes: `Strike Target Order${txId ? ` (${txId})` : ''}`,
      };

      try {
        return this.validateTransaction(result);
      } catch {
        return null;
      }
    }

    // --- Regular Purchase: negative fiat AND positive BTC ---
    if (fiatAmountRaw < 0 && amountBtcRaw > 0) {
      const btcAmount = amountBtcRaw;
      const totalAmount = Math.abs(fiatAmountRaw);
      const fees = Math.abs(fiatFee);
      const pricePerBtc = priceFromColumn > 0
        ? priceFromColumn
        : (btcAmount > 0 ? totalAmount / btcAmount : 0);

      const result: ImportTransaction = {
        type: 'BUY',
        btc_amount: btcAmount,
        original_price_per_btc: pricePerBtc,
        original_currency: currency,
        original_total_amount: totalAmount,
        fees: fees,
        fees_currency: currency,
        transaction_date: transactionDate,
        notes: `Strike Purchase${txId ? ` (${txId})` : ''}`,
      };

      try {
        return this.validateTransaction(result);
      } catch {
        return null;
      }
    }

    // Unrecognized row pattern — skip
    return null;
  }
}
