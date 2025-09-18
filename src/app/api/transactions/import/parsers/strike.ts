/**
 * Strike exchange CSV parser
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class StrikeParser extends BaseParser {
  name = 'strike';
  
  private readonly requiredHeaders = [
    'transaction id',
    'amount sold',
    'currency sold',
    'amount bought',
    'currency bought',
    'exchange rate'
  ];
  
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
    // Skip non-completed transactions
    if (transaction.status && transaction.status.toLowerCase() !== 'completed') {
      return null;
    }
    
    // Determine if it's a buy or sell based on what was bought/sold
    const currencyBought = transaction['currency bought'] || '';
    const currencySold = transaction['currency sold'] || '';
    const amountBought = this.parseFloat(transaction['amount bought'] || 0);
    const amountSold = this.parseFloat(transaction['amount sold'] || 0);
    
    let type: 'BUY' | 'SELL' = 'BUY';
    let btcAmount = 0;
    let fiatAmount = 0;
    let currency = 'USD';
    
    if (currencyBought.toUpperCase() === 'BTC') {
      // Buying BTC
      type = 'BUY';
      btcAmount = amountBought;
      fiatAmount = amountSold;
      currency = currencySold.toUpperCase();
    } else if (currencySold.toUpperCase() === 'BTC') {
      // Selling BTC
      type = 'SELL';
      btcAmount = amountSold;
      fiatAmount = amountBought;
      currency = currencyBought.toUpperCase();
    } else {
      // Neither bought nor sold BTC, skip
      return null;
    }
    
    // Parse date from Strike format
    const transactionDate = this.parseDate(
      transaction['completed time (utc)'] || transaction['created time (utc)'] || ''
    );
    
    // Calculate price per BTC
    const exchangeRate = this.parseFloat(transaction['exchange rate'] || 0);
    const pricePerBtc = exchangeRate > 0 ? exchangeRate : (btcAmount > 0 ? fiatAmount / btcAmount : 0);
    
    const result: ImportTransaction = {
      type: type,
      btc_amount: btcAmount,
      original_price_per_btc: pricePerBtc,
      original_currency: currency,
      original_total_amount: fiatAmount,
      fees: 0, // Strike doesn't seem to have fees in the export
      fees_currency: currency,
      transaction_date: transactionDate,
      notes: `Strike Transaction: ${transaction['transaction id'] || ''}`
    };
    
    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('Strike transaction validation failed:', error);
      return null;
    }
  }
}
