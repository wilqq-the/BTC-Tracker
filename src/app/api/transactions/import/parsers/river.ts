/**
 * River exchange CSV parser
 *
 * CSV Format:
 * Date,Sent Amount,Sent Currency,Received Amount,Received Currency,Fee Amount,Fee Currency,Tag
 *
 * Transaction types (determined by Tag column):
 * - "Buy"      : regular BTC purchase (Sent = fiat, Received = BTC)
 * - "Interest" : zero-cost BTC earned as interest on cash held at River
 * - ""          : BTC received from an external wallet (Transfer In)
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class RiverParser extends BaseParser {
  name = 'river';

  private readonly requiredHeaders = [
    'date',
    'sent amount',
    'sent currency',
    'received amount',
    'received currency',
    'fee amount',
    'fee currency',
    'tag',
  ];

  canParse(headers: string[]): boolean {
    const lc = headers.map(h => h.toLowerCase().trim());
    const matchCount = this.requiredHeaders.filter(h => lc.includes(h)).length;
    return matchCount >= 6;
  }

  getConfidenceScore(headers: string[]): number {
    const lc = headers.map(h => h.toLowerCase().trim());
    const matchCount = this.requiredHeaders.filter(h => lc.includes(h)).length;
    return (matchCount / this.requiredHeaders.length) * 100;
  }

  parseTransaction(
    transaction: any,
    _headers: string[],
    _values: string[]
  ): ImportTransaction | null {
    const tag = (transaction['tag'] || '').trim().toLowerCase();
    const receivedCurrency = (transaction['received currency'] || '').trim().toUpperCase();
    const sentCurrency = (transaction['sent currency'] || '').trim().toUpperCase();
    const receivedAmount = this.parseFloat(transaction['received amount']);
    const sentAmount = this.parseFloat(transaction['sent amount']);
    const feeAmount = this.parseFloat(transaction['fee amount']);
    const feeCurrency = (transaction['fee currency'] || sentCurrency || 'USD').trim().toUpperCase();
    const transactionDate = this.parseDate(transaction['date'] || '');

    // Only process rows where BTC is received
    if (receivedCurrency !== 'BTC' || receivedAmount <= 0) {
      return null;
    }

    // --- Buy ---
    if (tag === 'buy') {
      const currency = sentCurrency || 'USD';
      const pricePerBtc = receivedAmount > 0 ? sentAmount / receivedAmount : 0;

      const result: ImportTransaction = {
        type: 'BUY',
        btc_amount: receivedAmount,
        original_price_per_btc: pricePerBtc,
        original_currency: currency,
        original_total_amount: sentAmount,
        fees: feeAmount,
        fees_currency: feeAmount > 0 ? feeCurrency : currency,
        transaction_date: transactionDate,
        notes: 'River Buy',
      };

      try {
        return this.validateTransaction(result);
      } catch {
        return null;
      }
    }

    // --- Interest (zero-cost BTC earned on cash held at River) ---
    if (tag === 'interest') {
      const result: ImportTransaction = {
        type: 'BUY',
        btc_amount: receivedAmount,
        original_price_per_btc: 0,
        original_currency: 'USD',
        original_total_amount: 0,
        fees: 0,
        fees_currency: 'USD',
        transaction_date: transactionDate,
        notes: 'River Interest',
      };

      try {
        return this.validateTransaction(result);
      } catch {
        return null;
      }
    }

    // --- Transfer In (empty tag = BTC received from an external wallet) ---
    if (tag === '' && sentAmount === 0) {
      const result: ImportTransaction = {
        type: 'TRANSFER',
        btc_amount: receivedAmount,
        original_price_per_btc: 0,
        original_currency: 'USD',
        original_total_amount: 0,
        fees: 0,
        fees_currency: 'USD',
        transaction_date: transactionDate,
        notes: 'River Receive',
        transfer_type: 'FROM_COLD_WALLET',
        destination_address: null,
      };

      try {
        return this.validateTransaction(result);
      } catch {
        return null;
      }
    }

    return null;
  }
}
