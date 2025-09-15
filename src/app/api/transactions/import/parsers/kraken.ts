/**
 * Kraken exchange CSV parser
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class KrakenParser extends BaseParser {
  name = 'kraken';
  
  private readonly requiredHeaders = ['txid', 'ordertxid', 'pair', 'vol', 'cost', 'margin', 'ledgers'];
  
  canParse(headers: string[]): boolean {
    const lowercaseHeaders = headers.map(h => h.toLowerCase());
    const matchCount = this.requiredHeaders.filter(header => 
      lowercaseHeaders.includes(header)
    ).length;
    return matchCount >= 5;
  }
  
  getConfidenceScore(headers: string[]): number {
    const lowercaseHeaders = headers.map(h => h.toLowerCase());
    const matchCount = this.requiredHeaders.filter(header => 
      lowercaseHeaders.includes(header)
    ).length;
    return (matchCount / this.requiredHeaders.length) * 100;
  }
  
  parseTransaction(
    transaction: any,
    headers: string[],
    values: string[]
  ): ImportTransaction | null {
    // Skip if not a completed order
    if (transaction.status === 'canceled' || transaction.postatuscode === 'canceled') {
      return null;
    }
    
    // Extract currency pair (e.g., "BTC/EUR" -> "EUR")
    const pair = transaction.pair || '';
    const currency = this.extractCurrencyFromPair(pair);
    
    // Parse date from Kraken format
    const transactionDate = this.parseDate(transaction.time || '');
    
    // Parse amounts
    const btcAmount = this.parseFloat(transaction.vol);
    const totalAmount = this.parseFloat(transaction.cost);
    const fees = this.parseFloat(transaction.fee || transaction.fees || 0);
    
    // Calculate price per BTC if not provided
    let pricePerBtc = this.parseFloat(transaction.price || transaction.original_price_per_btc || 0);
    if (pricePerBtc === 0 && btcAmount > 0 && totalAmount > 0) {
      pricePerBtc = totalAmount / btcAmount;
    }
    
    const result: ImportTransaction = {
      type: (transaction.type?.toUpperCase() || 'BUY') as 'BUY' | 'SELL',
      btc_amount: btcAmount,
      original_price_per_btc: pricePerBtc,
      original_currency: currency.toUpperCase(),
      original_total_amount: totalAmount,
      fees: fees,
      fees_currency: currency.toUpperCase(),
      transaction_date: transactionDate,
      notes: `Kraken Order: ${transaction.ordertxid || transaction.txid || ''}`
    };
    
    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('Kraken transaction validation failed:', error);
      return null;
    }
  }
}
