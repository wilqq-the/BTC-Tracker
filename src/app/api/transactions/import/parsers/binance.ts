/**
 * Binance exchange CSV parser
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class BinanceParser extends BaseParser {
  name = 'binance';
  
  // Support multiple Binance export formats
  private readonly format1Headers = ['date(utc)', 'orderno', 'pair', 'side', 'trading total'];
  private readonly format2Headers = ['date(utc)', 'pair', 'base asset', 'quote asset', 'type', 'price', 'amount', 'total', 'fee'];
  
  canParse(headers: string[]): boolean {
    const lowercaseHeaders = headers.map(h => h.toLowerCase().trim());
    
    // Check format 1 (old format)
    const format1Matches = this.format1Headers.filter(header => 
      lowercaseHeaders.some(h => h.includes(header))
    ).length;
    
    // Check format 2 (new format) - check for exact matches
    const format2Matches = this.format2Headers.filter(header => 
      lowercaseHeaders.some(h => h === header || h.includes('base asset') || h.includes('quote asset'))
    ).length;
    
    console.log('Binance parser checking headers:', lowercaseHeaders);
    console.log('Format 1 matches:', format1Matches, 'Format 2 matches:', format2Matches);
    
    return format1Matches >= 3 || format2Matches >= 5;
  }
  
  getConfidenceScore(headers: string[]): number {
    const lowercaseHeaders = headers.map(h => h.toLowerCase().trim());
    
    // Check both formats
    const format1Matches = this.format1Headers.filter(header => 
      lowercaseHeaders.some(h => h.includes(header))
    ).length;
    
    const format2Matches = this.format2Headers.filter(header => 
      lowercaseHeaders.some(h => h === header || h.includes('base asset') || h.includes('quote asset'))
    ).length;
    
    const bestMatch = Math.max(
      (format1Matches / this.format1Headers.length) * 100,
      (format2Matches / this.format2Headers.length) * 100
    );
    
    console.log('Binance confidence score:', bestMatch);
    return bestMatch;
  }
  
  private detectFormat(headers: string[]): 'format1' | 'format2' {
    const lowercaseHeaders = headers.map(h => h.toLowerCase());
    
    // If we have 'base asset' and 'quote asset', it's format 2
    if (lowercaseHeaders.includes('base asset') || lowercaseHeaders.includes('quote asset')) {
      return 'format2';
    }
    
    return 'format1';
  }
  
  parseTransaction(
    transaction: any,
    headers: string[],
    values: string[]
  ): ImportTransaction | null {
    const format = this.detectFormat(headers);
    
    if (format === 'format2') {
      return this.parseFormat2Transaction(transaction);
    } else {
      return this.parseFormat1Transaction(transaction);
    }
  }
  
  private parseFormat2Transaction(transaction: any): ImportTransaction | null {
    // New format: Date(UTC),Pair,Base Asset,Quote Asset,Type,Price,Amount,Total,Fee,Fee Coin
    
    // Extract currency from pair (BTC/PLN → PLN)
    const pair = transaction.pair || '';
    let currency = 'USD';
    if (pair.includes('/')) {
      currency = pair.split('/')[1];
    } else if (transaction['quote asset']) {
      currency = transaction['quote asset'];
    }
    
    // Convert Binance date format
    const date = this.parseDate(transaction['date(utc)']);
    
    // Parse amounts
    const btcAmount = this.parseFloat(transaction.amount || 0);
    const price = this.parseFloat(transaction.price || 0);
    const totalAmount = this.parseFloat(transaction.total || 0);
    const fee = this.parseFloat(transaction.fee || 0);
    
    // Determine fee currency
    const feeCoin = transaction['fee coin'] || currency;
    const feeCurrency = feeCoin === 'BTC' ? currency : feeCoin; // If fee is in BTC, use quote currency
    
    const result: ImportTransaction = {
      type: (transaction.type?.toUpperCase() || 'BUY') as 'BUY' | 'SELL',
      btc_amount: btcAmount,
      original_price_per_btc: price,
      original_currency: currency.toUpperCase(),
      original_total_amount: totalAmount,
      fees: fee,
      fees_currency: feeCurrency.toUpperCase(),
      transaction_date: date,
      notes: `Binance Trade`
    };
    
    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('Binance format2 transaction validation failed:', error);
      return null;
    }
  }
  
  private parseFormat1Transaction(transaction: any): ImportTransaction | null {
    // Old format: with orderno, side, trading total, etc.
    
    // Only process FILLED orders
    if (transaction.status && transaction.status !== 'FILLED') {
      console.log('Skipping non-FILLED Binance order:', transaction.status);
      return null;
    }
    
    // Extract currency from pair (BTCPLN → PLN, BTCUSDT → USDT)
    const pair = transaction.pair || '';
    const currency = this.extractCurrencyFromBinancePair(pair);
    
    // Convert Binance date format
    const date = this.parseDate(transaction['date(utc)']);
    
    // Extract BTC amount (remove 'BTC' suffix from "0.00297BTC")
    const executedStr = transaction.executed || '0';
    const btcAmount = this.parseFloat(executedStr.replace('BTC', ''));
    
    // Extract total amount (remove currency suffix from "1116.22401PLN")
    const tradingTotalStr = transaction['trading total'] || '0';
    const totalAmount = this.parseFloat(tradingTotalStr.replace(currency, ''));
    
    // Calculate average price per BTC
    const pricePerBtc = btcAmount > 0 ? totalAmount / btcAmount : 0;
    
    // Extract fee (remove currency suffix)
    const feeStr = transaction.fee || '0';
    const fee = this.parseFloat(feeStr.replace(currency, ''));
    
    const result: ImportTransaction = {
      type: (transaction.side?.toUpperCase() || 'BUY') as 'BUY' | 'SELL',
      btc_amount: btcAmount,
      original_price_per_btc: pricePerBtc,
      original_currency: currency.toUpperCase(),
      original_total_amount: totalAmount,
      fees: fee,
      fees_currency: currency.toUpperCase(),
      transaction_date: date,
      notes: `Binance Order: ${transaction.orderno || ''}`
    };
    
    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('Binance format1 transaction validation failed:', error);
      return null;
    }
  }
  
  private extractCurrencyFromBinancePair(pair: string): string {
    // Handle pairs like BTCUSDT, BTCPLN, etc.
    if (!pair || pair.length < 4) return 'USD';
    
    // Remove BTC prefix
    if (pair.startsWith('BTC')) {
      const currency = pair.substring(3);
      // Convert USDT to USD for consistency
      return currency === 'USDT' ? 'USD' : currency;
    }
    
    return 'USD'; // Fallback
  }
}
