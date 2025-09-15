/**
 * Common types for transaction import parsers
 */

export interface ImportTransaction {
  type: 'BUY' | 'SELL';
  btc_amount: number;
  original_price_per_btc: number;
  original_currency: string;
  original_total_amount: number;
  fees: number;
  fees_currency: string;
  transaction_date: string;
  notes: string;
}

export interface ParseResult {
  transactions: ImportTransaction[];
  detectedFormat: string;
}

export interface Parser {
  name: string;
  
  /**
   * Check if this parser can handle the given CSV headers
   */
  canParse(headers: string[]): boolean;
  
  /**
   * Parse a single transaction row
   * Returns null if the transaction should be skipped
   */
  parseTransaction(
    transaction: any,
    headers: string[],
    values: string[]
  ): ImportTransaction | null;
  
  /**
   * Get the detection score for this parser (higher = more confident)
   */
  getConfidenceScore(headers: string[]): number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  details: {
    total_transactions: number;
    duplicate_transactions: number;
    invalid_transactions: number;
    skipped_transactions: Array<{ data: any; reason: string }>;
  };
}
