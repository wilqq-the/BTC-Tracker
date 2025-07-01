import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';

interface ImportTransaction {
  type: 'BUY' | 'SELL';
  btc_amount: number;
  original_price_per_btc: number;
  original_currency: string;
  original_total_amount: number;
  fees?: number;
  fees_currency?: string;
  transaction_date: string;
  notes?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  details: {
    imported_transactions: ImportTransaction[];
    skipped_transactions: Array<{ data: any; reason: string }>;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const skipDuplicates = formData.get('skip_duplicates') === 'true';
    const detectOnly = formData.get('detect_only') === 'true';

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided',
        message: 'Please select a file to import'
      }, { status: 400 });
    }

    const content = await file.text();
    const fileExtension = file.name.toLowerCase().split('.').pop();

    let transactions: ImportTransaction[];
    let detectedFormat: string | null = null;

    try {
      if (fileExtension === 'json') {
        transactions = parseJsonFile(content);
        detectedFormat = 'json';
      } else if (fileExtension === 'csv') {
        const result = parseCsvFile(content, detectOnly);
        if (detectOnly && result.detectedFormat) {
          return NextResponse.json({
            success: true,
            detected_format: result.detectedFormat
          });
        }
        transactions = result.transactions;
        detectedFormat = result.detectedFormat;
      } else {
        return NextResponse.json({
          success: false,
          error: 'Unsupported file format',
          message: 'Please upload a CSV or JSON file'
        }, { status: 400 });
      }
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'File parsing failed',
        message: `Error parsing ${fileExtension?.toUpperCase()} file: ${parseError}`
      }, { status: 400 });
    }

    // Validate and import transactions
    const result = await importTransactions(transactions, skipDuplicates);

    // Recalculate portfolio after import (rate-limited to prevent I/O overload)
    if (result.imported > 0) {
      try {
        await BitcoinPriceService.calculateAndStorePortfolioSummaryRateLimited();
      } catch (portfolioError) {
        console.error('Error updating portfolio after import:', portfolioError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing transactions:', error);
    return NextResponse.json({
      success: false,
      error: 'Import failed',
      message: 'An error occurred while importing transactions'
    }, { status: 500 });
  }
}

function parseJsonFile(content: string): ImportTransaction[] {
  const data = JSON.parse(content);
  
  // Handle our export format
  if (data.transactions && Array.isArray(data.transactions)) {
    return data.transactions.map(validateTransaction);
  }
  
  // Handle array of transactions
  if (Array.isArray(data)) {
    return data.map(validateTransaction);
  }
  
  throw new Error('Invalid JSON format. Expected array of transactions or object with transactions property.');
}

type CsvSource = 'legacy' | 'kraken' | 'binance' | 'coinbase' | 'strike' | 'standard';

function detectCsvFormat(headers: string[]): CsvSource {
  // Convert all headers to lowercase for case-insensitive matching
  const lowercaseHeaders = headers.map(h => h.toLowerCase());

  // Binance SPOT export format
  const binanceIndicators = ['date(utc)', 'orderno', 'pair', 'side', 'trading total'];
  const binanceMatches = binanceIndicators.filter(indicator => 
    lowercaseHeaders.some(header => header.includes(indicator))
  ).length;
  
  if (binanceMatches >= 4) {
    return 'binance';
  }
  
  // Legacy format indicators
  const legacyIndicators = [
    'amount (btc)',
    'original price',
    'original cost', 
    'original fee',
    'exchange',
    'eur rate',
    'usd rate'
  ];
  
  const legacyMatches = legacyIndicators.filter(indicator => 
    lowercaseHeaders.some(header => header.includes(indicator.toLowerCase()))
  ).length;
  
  // If we have 3 or more legacy indicators, it's likely legacy format
  if (legacyMatches >= 3) {
    console.log('Legacy format detected with', legacyMatches, 'matching indicators');
    console.log('Matched headers:', lowercaseHeaders);
    return 'legacy';
  }
  
  // Default to standard format
  return 'standard';
}

function processLegacyTransaction(transaction: any, headers: string[], values: string[]): any {
  // Create notes from exchange field if present
  if (transaction.exchange && transaction.exchange.trim()) {
    transaction.notes = `Exchange: ${transaction.exchange.trim()}`;
  }
  
  // Ensure fees_currency matches original_currency for legacy format
  if (transaction.original_currency && !transaction.fees_currency) {
    transaction.fees_currency = transaction.original_currency;
  }
  
  // Normalize transaction type (legacy uses lowercase)
  if (transaction.type) {
    transaction.type = transaction.type.toLowerCase();
  }
  
  return transaction;
}

function processBinanceTransaction(transaction: any, headers: string[], values: string[]): any {
  console.log('Processing Binance transaction:', transaction);
  
  // Only process FILLED orders
  if (transaction.status !== 'FILLED') {
    console.log('Skipping non-FILLED order:', transaction.status);
    return null; // Skip this transaction
  }
  
  // Extract currency from pair (BTCPLN → PLN, BTCUSDT → USDT)
  const pair = transaction.pair || '';
  const currency = extractCurrencyFromPair(pair);
  
  // Convert Binance date format (2025-06-21 21:53:59 → 2025-06-21)
  const date = convertBinanceDate(transaction['date(utc)']);
  
  // Extract BTC amount (remove 'BTC' suffix from "0.00297BTC")
  const executedStr = transaction.executed || '0';
  const btcAmount = parseFloat(executedStr.replace('BTC', ''));
  
  // Extract total amount (remove currency suffix from "1116.22401PLN")
  const tradingTotalStr = transaction['trading total'] || '0';
  const totalAmount = parseFloat(tradingTotalStr.replace(currency, ''));
  
  // Calculate average price per BTC
  const avgPrice = parseFloat(transaction['average price'] || '0');
  
  const result = {
    type: transaction.side, // BUY/SELL
    btc_amount: btcAmount,
    original_price_per_btc: avgPrice,
    original_currency: currency,
    original_total_amount: totalAmount,
    fees: 0, // Binance SPOT export doesn't include fees
    fees_currency: currency,
    transaction_date: date,
    notes: `Binance Order: ${transaction.orderno || 'N/A'}`
  };
  
  console.log('Processed Binance transaction result:', result);
  return result;
}

function extractCurrencyFromPair(pair: string): string {
  // Remove BTC from the beginning to get the quote currency
  if (pair.startsWith('BTC')) {
    return pair.substring(3); // BTCPLN → PLN, BTCUSDT → USDT
  }
  return 'USD'; // Fallback
}

function convertBinanceDate(dateStr: string): string {
  // Convert "2025-06-21 21:53:59" to "2025-06-21"
  if (dateStr && dateStr.includes(' ')) {
    return dateStr.split(' ')[0];
  }
  return dateStr;
}

function parseCsvFile(content: string, detectOnly?: boolean): { transactions: ImportTransaction[], detectedFormat: string } {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  // Convert headers to lowercase and clean them
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const transactions: ImportTransaction[] = [];

  // Detect CSV format based on headers
  const csvFormat = detectCsvFormat(headers);
  console.log(`Detected CSV format: ${csvFormat}`);

  // If only detecting format, return early
  if (detectOnly) {
    return { transactions: [], detectedFormat: csvFormat };
  }

  // Map common header variations including legacy format
  const headerMap: { [key: string]: string } = {
    // Standard format
    'type': 'type',
    'transaction_type': 'type',
    'btc_amount': 'btc_amount',
    'btc amount': 'btc_amount',
    'bitcoin_amount': 'btc_amount',
    'amount': 'btc_amount',
    'amount (btc)': 'btc_amount',
    'original_price_per_btc': 'original_price_per_btc',
    'price_per_btc': 'original_price_per_btc',
    'price per btc': 'original_price_per_btc',
    'price': 'original_price_per_btc',
    'original price': 'original_price_per_btc',
    'original_currency': 'original_currency',
    'currency': 'original_currency',
    'original currency': 'original_currency',
    'original_total_amount': 'original_total_amount',
    'total_amount': 'original_total_amount',
    'total amount': 'original_total_amount',
    'total': 'original_total_amount',
    'original cost': 'original_total_amount',
    'fees': 'fees',
    'fee': 'fees',
    'original fee': 'fees',
    'fees_currency': 'fees_currency',
    'fee_currency': 'fees_currency',
    'transaction_date': 'transaction_date',
    'date': 'transaction_date',
    'transaction date': 'transaction_date',
    'notes': 'notes',
    'note': 'notes',
    'description': 'notes',
    'exchange': 'exchange' // Special handling for exchange field
  };

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue; // Skip empty lines

    let transaction: any = {};
    
    // Map all columns first
    for (let j = 0; j < headers.length && j < values.length; j++) {
      const mappedHeader = headerMap[headers[j]] || headers[j];
      transaction[mappedHeader] = values[j];
    }

    // Special processing based on detected format
    if (csvFormat === 'legacy') {
      transaction = processLegacyTransaction(transaction, headers, values);
    } else if (csvFormat === 'binance') {
      const processedTransaction = processBinanceTransaction(transaction, headers, values);
      // Skip if transaction is null (e.g., CANCELED orders)
      if (processedTransaction === null) {
        continue;
      }
      transaction = processedTransaction;
    }

    try {
      transactions.push(validateTransaction(transaction));
    } catch (error) {
      console.error('Transaction validation error:', error);
      console.error('Raw transaction data:', transaction);
      throw new Error(`Row ${i + 1}: ${error}`);
    }
  }

  return { transactions, detectedFormat: csvFormat };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/"/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim().replace(/"/g, ''));
  return result;
}

function validateTransaction(data: any): ImportTransaction {
  const transaction: ImportTransaction = {
    type: data.type?.toUpperCase(),
    btc_amount: parseFloat(data.btc_amount),
    original_price_per_btc: parseFloat(data.original_price_per_btc),
    original_currency: data.original_currency?.toUpperCase(),
    original_total_amount: parseFloat(data.original_total_amount),
    fees: data.fees ? parseFloat(data.fees) : 0,
    fees_currency: data.fees_currency?.toUpperCase() || data.original_currency?.toUpperCase(),
    transaction_date: data.transaction_date,
    notes: data.notes || ''
  };

  // Validation
  if (!['BUY', 'SELL'].includes(transaction.type)) {
    throw new Error(`Invalid transaction type: ${data.type}. Must be BUY or SELL.`);
  }

  if (isNaN(transaction.btc_amount) || transaction.btc_amount <= 0) {
    throw new Error(`Invalid BTC amount: ${data.btc_amount}`);
  }

  if (isNaN(transaction.original_price_per_btc) || transaction.original_price_per_btc <= 0) {
    throw new Error(`Invalid price per BTC: ${data.original_price_per_btc}`);
  }

  if (!transaction.original_currency || transaction.original_currency.length < 2) {
    throw new Error(`Invalid currency: ${data.original_currency}`);
  }

  if (isNaN(transaction.original_total_amount) || transaction.original_total_amount <= 0) {
    throw new Error(`Invalid total amount: ${data.original_total_amount}`);
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(transaction.transaction_date)) {
    throw new Error(`Invalid date format: ${data.transaction_date}. Use YYYY-MM-DD format.`);
  }

  return transaction;
}

async function importTransactions(transactions: ImportTransaction[], skipDuplicates: boolean): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    details: {
      imported_transactions: [],
      skipped_transactions: []
    }
  };

  for (const transaction of transactions) {
    try {
      // Check for duplicates
      if (skipDuplicates) {
        const isDuplicate = await checkDuplicate(transaction);
        if (isDuplicate) {
          result.skipped++;
          result.details.skipped_transactions.push({
            data: transaction,
            reason: 'Duplicate transaction found'
          });
          continue;
        }
      }

      // Insert transaction
      await insertTransaction(transaction);
      result.imported++;
      result.details.imported_transactions.push(transaction);
    } catch (error) {
      result.errors.push(`Failed to import transaction: ${error}`);
    }
  }

  return result;
}

async function checkDuplicate(transaction: ImportTransaction): Promise<boolean> {
  try {
    const existing = await prisma.bitcoinTransaction.findFirst({
      where: {
        type: transaction.type,
        btcAmount: transaction.btc_amount,
        originalPricePerBtc: transaction.original_price_per_btc,
        originalCurrency: transaction.original_currency,
        transactionDate: new Date(transaction.transaction_date)
      }
    });
    return !!existing;
  } catch (error) {
    console.error('Error checking for duplicate:', error);
    throw error;
  }
}

async function insertTransaction(transaction: ImportTransaction): Promise<void> {
  try {
    await prisma.bitcoinTransaction.create({
      data: {
        type: transaction.type,
        btcAmount: transaction.btc_amount,
        originalPricePerBtc: transaction.original_price_per_btc,
        originalCurrency: transaction.original_currency,
        originalTotalAmount: transaction.original_total_amount,
        fees: transaction.fees || 0,
        feesCurrency: transaction.fees_currency || transaction.original_currency,
        transactionDate: new Date(transaction.transaction_date),
        notes: transaction.notes || ''
      }
    });
  } catch (error) {
    console.error('Error inserting transaction:', error);
    throw error;
  }
} 