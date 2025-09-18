/**
 * Legacy format CSV parser (old BTC Tracker format)
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class LegacyParser extends BaseParser {
  name = 'legacy';
  
  private readonly requiredHeaders = [
    'amount (btc)',
    'original price',
    'original cost',
    'original fee',
    'exchange',
    'eur rate',
    'usd rate'
  ];
  
  canParse(headers: string[]): boolean {
    const lowercaseHeaders = headers.map(h => h.toLowerCase());
    const matchCount = this.requiredHeaders.filter(header => 
      lowercaseHeaders.some(h => h.includes(header.toLowerCase()))
    ).length;
    return matchCount >= 3;
  }
  
  getConfidenceScore(headers: string[]): number {
    const lowercaseHeaders = headers.map(h => h.toLowerCase());
    const matchCount = this.requiredHeaders.filter(header => 
      lowercaseHeaders.some(h => h.includes(header.toLowerCase()))
    ).length;
    return (matchCount / this.requiredHeaders.length) * 100;
  }
  
  parseTransaction(
    transaction: any,
    headers: string[],
    values: string[]
  ): ImportTransaction | null {
    // Create notes from exchange field if present
    let notes = '';
    if (transaction.exchange && transaction.exchange.trim()) {
      notes = `Exchange: ${transaction.exchange.trim()}`;
    }
    
    // Parse amounts - handle various field names
    const btcAmount = this.parseFloat(
      transaction['amount (btc)'] || 
      transaction.btc_amount || 
      transaction.amount || 
      0
    );
    
    const pricePerBtc = this.parseFloat(
      transaction['original price'] || 
      transaction.original_price_per_btc || 
      transaction.price || 
      0
    );
    
    const totalAmount = this.parseFloat(
      transaction['original cost'] || 
      transaction.original_total_amount || 
      transaction.total || 
      0
    );
    
    const fees = this.parseFloat(
      transaction['original fee'] || 
      transaction.fees || 
      transaction.fee || 
      0
    );
    
    const currency = (
      transaction['original currency'] || 
      transaction.original_currency || 
      transaction.currency || 
      'USD'
    ).toUpperCase();
    
    const transactionDate = this.parseDate(
      transaction['transaction date'] || 
      transaction.transaction_date || 
      transaction.date || 
      ''
    );
    
    const type = (
      transaction.type || 
      transaction.transaction_type || 
      'BUY'
    ).toUpperCase() as 'BUY' | 'SELL';
    
    const result: ImportTransaction = {
      type: type,
      btc_amount: btcAmount,
      original_price_per_btc: pricePerBtc,
      original_currency: currency,
      original_total_amount: totalAmount,
      fees: fees,
      fees_currency: currency,
      transaction_date: transactionDate,
      notes: notes || transaction.notes || ''
    };
    
    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('Legacy transaction validation failed:', error);
      return null;
    }
  }
}
