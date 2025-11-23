/**
 * Base parser class with common functionality
 */

import { ImportTransaction, Parser } from './types';

export abstract class BaseParser implements Parser {
  abstract name: string;
  
  abstract canParse(headers: string[]): boolean;
  
  abstract parseTransaction(
    transaction: any,
    headers: string[],
    values: string[]
  ): ImportTransaction | null;
  
  abstract getConfidenceScore(headers: string[]): number;
  
  /**
   * Helper method to parse date strings to YYYY-MM-DD format
   */
  protected parseDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // Handle "2024-01-15 14:30:00" format
    if (dateStr.includes(' ')) {
      return dateStr.split(' ')[0];
    }
    
    // Handle "2024-01-15T14:30:00Z" format
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    
    return dateStr;
  }
  
  /**
   * Helper method to safely parse float values
   */
  protected parseFloat(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove currency symbols and commas
      const cleaned = value.replace(/[^0-9.-]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  }
  
  /**
   * Helper method to extract currency from a pair (e.g., "BTC/USD" -> "USD")
   */
  protected extractCurrencyFromPair(pair: string, position: 'first' | 'second' = 'second'): string {
    if (!pair || !pair.includes('/')) return 'USD';
    const parts = pair.split('/');
    return position === 'first' ? parts[0] : parts[1];
  }
  
  /**
   * Validate a transaction before returning it
   */
  protected validateTransaction(transaction: ImportTransaction): ImportTransaction {
    // Validation
    if (!['BUY', 'SELL', 'TRANSFER'].includes(transaction.type)) {
      throw new Error(`Invalid transaction type: ${transaction.type}. Must be BUY, SELL, or TRANSFER.`);
    }
    
    if (isNaN(transaction.btc_amount) || transaction.btc_amount <= 0) {
      throw new Error(`Invalid BTC amount: ${transaction.btc_amount}`);
    }
    
    const isTransfer = transaction.type === 'TRANSFER';
    
    // Allow zero price for mining/gifts/airdrops/transfers (but not negative)
    if (isNaN(transaction.original_price_per_btc) || transaction.original_price_per_btc < 0) {
      throw new Error(`Invalid price per BTC: ${transaction.original_price_per_btc}. Cannot be negative.`);
    }
    
    if (!transaction.original_currency || transaction.original_currency.length < 2) {
      throw new Error(`Invalid currency: ${transaction.original_currency}`);
    }
    
    // Allow zero total for mining/gifts/airdrops/transfers (but not negative)
    if (isNaN(transaction.original_total_amount) || transaction.original_total_amount < 0) {
      throw new Error(`Invalid total amount: ${transaction.original_total_amount}. Cannot be negative.`);
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(transaction.transaction_date)) {
      throw new Error(`Invalid date format: ${transaction.transaction_date}. Use YYYY-MM-DD format.`);
    }
    
    return transaction;
  }
}
