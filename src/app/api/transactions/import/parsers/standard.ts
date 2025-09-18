/**
 * Standard format CSV parser (default format)
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class StandardParser extends BaseParser {
  name = 'standard';
  
  // Standard format is the fallback, so it has lower requirements
  private readonly preferredHeaders = [
    'type',
    'btc_amount',
    'original_price_per_btc',
    'original_currency',
    'original_total_amount',
    'fees',
    'transaction_date'
  ];
  
  canParse(headers: string[]): boolean {
    // Standard parser is the fallback - it can always try to parse
    return true;
  }
  
  getConfidenceScore(headers: string[]): number {
    const lowercaseHeaders = headers.map(h => h.toLowerCase().replace(/[_\s]/g, ''));
    const matchCount = this.preferredHeaders.filter(header => {
      const cleanHeader = header.toLowerCase().replace(/[_\s]/g, '');
      return lowercaseHeaders.some(h => h.includes(cleanHeader) || cleanHeader.includes(h));
    }).length;
    
    // Return lower confidence as this is the fallback parser
    return (matchCount / this.preferredHeaders.length) * 50;
  }
  
  parseTransaction(
    transaction: any,
    headers: string[],
    values: string[]
  ): ImportTransaction | null {
    // Map common header variations
    const btcAmount = this.parseFloat(
      transaction.btc_amount ||
      transaction['btc amount'] ||
      transaction.bitcoin_amount ||
      transaction.amount ||
      transaction['amount (btc)'] ||
      0
    );
    
    const pricePerBtc = this.parseFloat(
      transaction.original_price_per_btc ||
      transaction.price_per_btc ||
      transaction['price per btc'] ||
      transaction.price ||
      transaction['original price'] ||
      0
    );
    
    const totalAmount = this.parseFloat(
      transaction.original_total_amount ||
      transaction.total_amount ||
      transaction['total amount'] ||
      transaction.total ||
      transaction['original cost'] ||
      0
    );
    
    const fees = this.parseFloat(
      transaction.fees ||
      transaction.fee ||
      transaction['original fee'] ||
      0
    );
    
    const currency = (
      transaction.original_currency ||
      transaction.currency ||
      transaction['original currency'] ||
      'USD'
    ).toUpperCase();
    
    const transactionDate = this.parseDate(
      transaction.transaction_date ||
      transaction.date ||
      transaction['transaction date'] ||
      ''
    );
    
    const type = (
      transaction.type ||
      transaction.transaction_type ||
      transaction['transaction type'] ||
      'BUY'
    ).toUpperCase() as 'BUY' | 'SELL';
    
    const notes = 
      transaction.notes ||
      transaction.note ||
      transaction.description ||
      '';
    
    // If we couldn't extract essential data, skip this transaction
    if (btcAmount === 0 || pricePerBtc === 0 || totalAmount === 0) {
      console.warn('Standard parser: Missing essential data, skipping transaction');
      return null;
    }
    
    const result: ImportTransaction = {
      type: type,
      btc_amount: btcAmount,
      original_price_per_btc: pricePerBtc,
      original_currency: currency,
      original_total_amount: totalAmount,
      fees: fees,
      fees_currency: transaction.fees_currency || currency,
      transaction_date: transactionDate,
      notes: notes
    };
    
    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('Standard transaction validation failed:', error);
      return null;
    }
  }
}
