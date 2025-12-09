/**
 * 21bitcoin exchange CSV parser
 * 
 * CSV Format:
 * id,exchange_name,depot_name,transaction_date,buy_asset,buy_amount,sell_asset,sell_amount,fee_asset,fee_amount,transaction_type,note,linked_transaction
 * 
 * Example rows:
 * 1,21bitcoin,main,09.12.2025 09:46:34,EUR,100,,,,,deposit,SEPA Bank Transfer EUR Deposit,
 * 2,21bitcoin,main,10.12.2025 20:26:27,BTC,0.0010000,EUR,95.00,EUR,1.25,trade,Standard BTC Purchase,
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class Bitcoin21Parser extends BaseParser {
  name = '21bitcoin';
  
  private readonly requiredHeaders = [
    'exchange_name',
    'transaction_date',
    'buy_asset',
    'buy_amount',
    'sell_asset',
    'sell_amount',
    'transaction_type'
  ];
  
  // Headers that strongly indicate 21bitcoin format
  private readonly signatureHeaders = [
    'depot_name',
    'linked_transaction'
  ];
  
  canParse(headers: string[]): boolean {
    const lowercaseHeaders = headers.map(h => h.toLowerCase());
    
    // Check if it has the required headers
    const requiredCount = this.requiredHeaders.filter(header => 
      lowercaseHeaders.includes(header)
    ).length;
    
    // Check for signature headers that indicate 21bitcoin specifically
    const hasSignature = this.signatureHeaders.some(header => 
      lowercaseHeaders.includes(header)
    );
    
    // Also check if exchange_name column contains "21bitcoin" in any row
    const hasExchangeName = lowercaseHeaders.includes('exchange_name');
    
    return requiredCount >= 5 && (hasSignature || hasExchangeName);
  }
  
  getConfidenceScore(headers: string[]): number {
    const lowercaseHeaders = headers.map(h => h.toLowerCase());
    
    // Count required headers
    const requiredCount = this.requiredHeaders.filter(header => 
      lowercaseHeaders.includes(header)
    ).length;
    
    // Count signature headers
    const signatureCount = this.signatureHeaders.filter(header => 
      lowercaseHeaders.includes(header)
    ).length;
    
    // Base score from required headers
    let score = (requiredCount / this.requiredHeaders.length) * 70;
    
    // Bonus for signature headers (30% extra if both present)
    score += (signatureCount / this.signatureHeaders.length) * 30;
    
    return Math.min(score, 100);
  }
  
  /**
   * Parse European date format (DD.MM.YYYY HH:MM:SS) to YYYY-MM-DD
   */
  private parseEuropeanDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // Try to match DD.MM.YYYY format (with optional time)
    const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    
    // Fallback to base class parsing
    return super.parseDate(dateStr);
  }
  
  parseTransaction(
    transaction: any,
    headers: string[],
    values: string[]
  ): ImportTransaction | null {
    const transactionType = (transaction['transaction_type'] || '').toLowerCase();
    
    // Only process 'trade' transactions (skip deposits, withdrawals, etc.)
    if (transactionType !== 'trade') {
      return null;
    }
    
    const buyAsset = (transaction['buy_asset'] || '').toUpperCase();
    const sellAsset = (transaction['sell_asset'] || '').toUpperCase();
    const buyAmount = this.parseFloat(transaction['buy_amount'] || 0);
    const sellAmount = this.parseFloat(transaction['sell_amount'] || 0);
    const feeAsset = (transaction['fee_asset'] || '').toUpperCase();
    const feeAmount = this.parseFloat(transaction['fee_amount'] || 0);
    
    let type: 'BUY' | 'SELL' = 'BUY';
    let btcAmount = 0;
    let fiatAmount = 0;
    let currency = 'EUR'; // 21bitcoin is primarily EUR-based
    let fees = 0;
    let feesCurrency = 'EUR';
    
    if (buyAsset === 'BTC') {
      // Buying BTC with fiat
      type = 'BUY';
      btcAmount = buyAmount;
      fiatAmount = sellAmount;
      currency = sellAsset || 'EUR';
    } else if (sellAsset === 'BTC') {
      // Selling BTC for fiat
      type = 'SELL';
      btcAmount = sellAmount;
      fiatAmount = buyAmount;
      currency = buyAsset || 'EUR';
    } else {
      // Not a BTC transaction, skip
      return null;
    }
    
    // Handle fees
    if (feeAmount > 0 && feeAsset) {
      fees = feeAmount;
      feesCurrency = feeAsset;
    }
    
    // Skip if BTC amount is 0 or invalid
    if (btcAmount <= 0) {
      return null;
    }
    
    // Parse date
    const transactionDate = this.parseEuropeanDate(
      transaction['transaction_date'] || ''
    );
    
    // Calculate price per BTC
    const pricePerBtc = btcAmount > 0 ? fiatAmount / btcAmount : 0;
    
    // Build notes from 21bitcoin fields
    const note = transaction['note'] || '';
    const txId = transaction['id'] || '';
    const notes = note 
      ? `21bitcoin: ${note}${txId ? ` (ID: ${txId})` : ''}`
      : `21bitcoin Transaction${txId ? ` (ID: ${txId})` : ''}`;
    
    const result: ImportTransaction = {
      type: type,
      btc_amount: btcAmount,
      original_price_per_btc: pricePerBtc,
      original_currency: currency,
      original_total_amount: fiatAmount,
      fees: fees,
      fees_currency: feesCurrency,
      transaction_date: transactionDate,
      notes: notes
    };
    
    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('21bitcoin transaction validation failed:', error);
      return null;
    }
  }
}

