/**
 * Parser factory and CSV parsing utilities
 */

import { Parser, ImportTransaction, ParseResult } from './types';
import { KrakenParser } from './kraken';
import { BinanceParser } from './binance';
import { CoinbaseParser } from './coinbase';
import { StrikeParser } from './strike';
import { LegacyParser } from './legacy';
import { StandardParser } from './standard';

export * from './types';

/**
 * Available parsers in order of priority
 */
const PARSERS: Parser[] = [
  new KrakenParser(),
  new BinanceParser(),
  new CoinbaseParser(),
  new StrikeParser(),
  new LegacyParser(),
  new StandardParser(), // Fallback parser - should be last
];

/**
 * Detect the best parser for the given CSV headers
 */
export function detectParser(headers: string[]): Parser {
  let bestParser: Parser | null = null;
  let bestScore = 0;
  
  for (const parser of PARSERS) {
    if (parser.canParse(headers)) {
      const score = parser.getConfidenceScore(headers);
      if (score > bestScore) {
        bestScore = score;
        bestParser = parser;
      }
    }
  }
  
  // If no parser matched with confidence, use the standard parser as fallback
  if (!bestParser || bestScore < 30) {
    console.log(`No confident parser match (best score: ${bestScore}), using standard parser`);
    return new StandardParser();
  }
  
  console.log(`Selected parser: ${bestParser.name} (confidence: ${bestScore}%)`);
  return bestParser;
}

/**
 * Parse a CSV line handling quoted values
 */
export function parseCsvLine(line: string): string[] {
  // Fix for Excel wrapping entire rows in quotes
  // Detect if line starts and ends with quote but contains unquoted commas
  // e.g., "381,BUY,0.01794592,..." should become 381,BUY,0.01794592,...
  if (line.startsWith('"') && line.endsWith('"')) {
    const inner = line.slice(1, -1);
    // Check if this looks like a wrapped row (has commas that would be field separators)
    // by seeing if removing the outer quotes gives us a valid CSV row
    const testParse = parseLineInner(inner);
    if (testParse.length > 1) {
      // This was a wrapped row - use the inner content
      line = inner;
    }
  }
  
  return parseLineInner(line);
}

function parseLineInner(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  if (current || line.endsWith(',')) {
    result.push(current.trim());
  }
  
  return result;
}

/**
 * Parse CSV content using auto-detection
 */
export function parseCsvFile(content: string, detectOnly?: boolean): ParseResult {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }
  
  // Parse and clean headers
  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  
  // Detect the appropriate parser
  const parser = detectParser(headers);
  
  // If only detecting format, return early
  if (detectOnly) {
    return {
      transactions: [],
      detectedFormat: parser.name
    };
  }
  
  const transactions: ImportTransaction[] = [];
  const skippedRows: number[] = [];
  
  // Process each data row
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0 || values.every(v => !v)) {
      continue; // Skip empty lines
    }
    
    // Create transaction object from headers and values
    const transactionData: any = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      transactionData[headers[j]] = values[j];
    }
    
    try {
      // Use the detected parser to process the transaction
      const transaction = parser.parseTransaction(transactionData, headers, values);
      
      if (transaction) {
        transactions.push(transaction);
      } else {
        skippedRows.push(i + 1); // Row number (1-indexed)
      }
    } catch (error) {
      console.error(`Error parsing row ${i + 1}:`, error);
      console.error('Raw transaction data:', transactionData);
      throw new Error(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (skippedRows.length > 0) {
    console.log(`Skipped ${skippedRows.length} rows: ${skippedRows.join(', ')}`);
  }
  
  return {
    transactions,
    detectedFormat: parser.name
  };
}

/**
 * Parse JSON file content
 */
export function parseJsonFile(content: string): ImportTransaction[] {
  const data = JSON.parse(content);
  
  // Handle both array and object with transactions property
  if (Array.isArray(data)) {
    return data;
  }
  
  if (data.transactions && Array.isArray(data.transactions)) {
    return data.transactions;
  }
  
  throw new Error('Invalid JSON format. Expected array of transactions or object with transactions property.');
}
