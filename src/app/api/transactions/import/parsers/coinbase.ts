/**
 * Coinbase exchange CSV parser
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class CoinbaseParser extends BaseParser {
  name = 'coinbase';
  
  private readonly requiredHeaders = ['portfolio', 'trade id', 'product', 'side', 'created at'];
  
  canParse(headers: string[]): boolean {
    const lowercaseHeaders = headers.map(h => h.toLowerCase());
    const matchCount = this.requiredHeaders.filter(header => 
      lowercaseHeaders.includes(header)
    ).length;
    return matchCount >= 4;
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
    // Extract currency from product (e.g., "BTC-USD" -> "USD")
    const product = transaction.product || '';
    const currency = product.includes('-') ? product.split('-')[1] : 'USD';
    
    // Parse date from Coinbase format
    const transactionDate = this.parseDate(
      transaction['created at'] || transaction.created_at || ''
    );
    
    // Parse amounts
    const size = this.parseFloat(transaction.size || transaction.btc_amount || 0);
    const total = this.parseFloat(transaction.total || transaction['executed value'] || 0);
    const fee = this.parseFloat(transaction.fee || transaction.fees || 0);
    
    // Calculate price per BTC
    let pricePerBtc = this.parseFloat(transaction.price || 0);
    if (pricePerBtc === 0 && size > 0 && total > 0) {
      pricePerBtc = Math.abs(total) / size;
    }
    
    const result: ImportTransaction = {
      type: (transaction.side?.toUpperCase() || 'BUY') as 'BUY' | 'SELL',
      btc_amount: size,
      original_price_per_btc: pricePerBtc,
      original_currency: currency.toUpperCase(),
      original_total_amount: Math.abs(total),
      fees: fee,
      fees_currency: currency.toUpperCase(),
      transaction_date: transactionDate,
      notes: `Coinbase Trade: ${transaction['trade id'] || transaction.trade_id || ''}`
    };
    
    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('Coinbase transaction validation failed:', error);
      return null;
    }
  }
}
