/**
 * Cash App bitcoin CSV parser
 *
 * Export: Cash App → Account → Documents & Statements → Bitcoin →
 * "Transactions CSV" (one file per year).
 *
 * Headers:
 *   Transaction ID, Date, Transaction Type, Currency, Amount, Fee,
 *   Net Amount, Asset Type, Asset Price, Asset Amount
 *
 * Example rows:
 *   "vy3oz1","2025-12-30 23:22:22 PST","Bitcoin Buy","USD","-$0.41","$0.00","-$0.41","BTC","$88,341.37","0.00000464 BTC"
 *   "k2m9qa","2025-08-30 09:38:05 PDT","Bitcoin Sale","USD","$50.00","-$1.49","$48.51","BTC","$107,642.54","0.0004645 BTC"
 *
 * Mapping:
 *   Bitcoin Buy                  → BUY
 *   Bitcoin Sale / Sell          → SELL
 *   Bitcoin Withdrawal (on-chain)→ TRANSFER, TO_COLD_WALLET (same as Strike sends)
 *   Bitcoin Lightning Withdrawal → TRANSFER, TRANSFER_OUT (usually a payment)
 *   Bitcoin Deposit (on-chain)   → TRANSFER, FROM_COLD_WALLET
 *   Bitcoin Lightning Deposit    → TRANSFER, TRANSFER_IN
 *   anything else                → skipped
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class CashAppParser extends BaseParser {
  name = 'cashapp';

  private readonly requiredHeaders = [
    'transaction type',
    'asset type',
    'asset price',
    'asset amount',
  ];

  private readonly supportingHeaders = [
    'transaction id',
    'date',
    'currency',
    'amount',
    'fee',
    'net amount',
  ];

  canParse(headers: string[]): boolean {
    const lc = headers.map(h => h.toLowerCase().trim());
    return this.requiredHeaders.every(h => lc.includes(h));
  }

  getConfidenceScore(headers: string[]): number {
    const lc = headers.map(h => h.toLowerCase().trim());
    const required = this.requiredHeaders.filter(h => lc.includes(h)).length;
    const supporting = this.supportingHeaders.filter(h => lc.includes(h)).length;
    // "Asset Amount"/"Asset Price" are distinctive; full header set → ~100
    return Math.min(100, (required / this.requiredHeaders.length) * 70 +
      (supporting / this.supportingHeaders.length) * 30);
  }

  private field(transaction: Record<string, string>, name: string): string {
    const key = Object.keys(transaction).find(k => k.toLowerCase().trim() === name);
    return key ? (transaction[key] || '').trim() : '';
  }

  parseTransaction(transaction: any): ImportTransaction | null {
    const assetType = this.field(transaction, 'asset type').toUpperCase();
    if (assetType && assetType !== 'BTC') return null;

    const type = this.field(transaction, 'transaction type').toLowerCase();
    const currency = (this.field(transaction, 'currency') || 'USD').toUpperCase();
    const btcAmount = Math.abs(this.parseFloat(this.field(transaction, 'asset amount')));
    const price = Math.abs(this.parseFloat(this.field(transaction, 'asset price')));
    const amount = Math.abs(this.parseFloat(this.field(transaction, 'amount')));
    const fee = Math.abs(this.parseFloat(this.field(transaction, 'fee')));
    const date = this.parseDate(this.field(transaction, 'date'));
    const txId = this.field(transaction, 'transaction id');
    const note = (label: string) => `Cash App ${label}${txId ? ` (${txId})` : ''}`;

    if (btcAmount <= 0) return null;

    const isLightning = type.includes('lightning');
    let result: ImportTransaction | null = null;

    if (type.includes('buy')) {
      // "Amount" is what was spent on bitcoin; the fee is listed separately
      result = {
        type: 'BUY',
        btc_amount: btcAmount,
        original_price_per_btc: price || (amount > 0 ? amount / btcAmount : 0),
        original_currency: currency,
        original_total_amount: amount || btcAmount * price,
        fees: fee,
        fees_currency: currency,
        transaction_date: date,
        notes: note('buy'),
      };
    } else if (type.includes('sale') || type.includes('sell')) {
      result = {
        type: 'SELL',
        btc_amount: btcAmount,
        original_price_per_btc: price || (amount > 0 ? amount / btcAmount : 0),
        original_currency: currency,
        original_total_amount: amount || btcAmount * price,
        fees: fee,
        fees_currency: currency,
        transaction_date: date,
        notes: note('sale'),
      };
    } else if (type.includes('withdrawal')) {
      result = {
        type: 'TRANSFER',
        btc_amount: btcAmount,
        original_price_per_btc: price,
        original_currency: currency,
        original_total_amount: 0,
        fees: 0,
        fees_currency: 'BTC',
        transaction_date: date,
        notes: note(isLightning ? 'Lightning withdrawal' : 'withdrawal'),
        transfer_type: isLightning ? 'TRANSFER_OUT' : 'TO_COLD_WALLET',
        destination_address: null,
      };
    } else if (type.includes('deposit')) {
      result = {
        type: 'TRANSFER',
        btc_amount: btcAmount,
        original_price_per_btc: price,
        original_currency: currency,
        original_total_amount: 0,
        fees: 0,
        fees_currency: 'BTC',
        transaction_date: date,
        notes: note(isLightning ? 'Lightning deposit' : 'deposit'),
        transfer_type: isLightning ? 'TRANSFER_IN' : 'FROM_COLD_WALLET',
        destination_address: null,
      };
    }

    if (!result) return null;
    try {
      return this.validateTransaction(result);
    } catch {
      return null;
    }
  }
}
