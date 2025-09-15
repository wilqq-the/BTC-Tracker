/**
 * Transaction Import API Route
 * Handles CSV and JSON file imports with auto-detection of exchange formats
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { 
  ImportTransaction, 
  ImportResult,
  parseCsvFile,
  parseJsonFile 
} from './parsers';

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
        await BitcoinPriceService.calculateAndStorePortfolioSummary();
      } catch (error) {
        console.error('Error recalculating portfolio after import:', error);
      }
    }

    return NextResponse.json({
      ...result,
      detected_format: detectedFormat,
      message: `Successfully imported ${result.imported} transactions${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}`
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({
      success: false,
      error: 'Import failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred during import'
    }, { status: 500 });
  }
}

async function importTransactions(
  transactions: ImportTransaction[], 
  skipDuplicates: boolean
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    details: {
      total_transactions: transactions.length,
      duplicate_transactions: 0,
      invalid_transactions: 0,
      skipped_transactions: []
    }
  };

  for (const transaction of transactions) {
    try {
      // Check for duplicates if requested
      if (skipDuplicates) {
        // Convert date string to Date object for comparison
        const transactionDate = new Date(transaction.transaction_date);
          
        const existing = await prisma.bitcoinTransaction.findFirst({
          where: {
            type: transaction.type,
            btcAmount: transaction.btc_amount,
            originalPricePerBtc: transaction.original_price_per_btc,
            transactionDate: transactionDate
          }
        });

        if (existing) {
          result.skipped++;
          result.details.duplicate_transactions++;
          result.details.skipped_transactions.push({
            data: transaction,
            reason: 'Duplicate transaction'
          });
          continue;
        }
      }

      // Import the transaction
      await prisma.bitcoinTransaction.create({
        data: {
          type: transaction.type,
          btcAmount: transaction.btc_amount,
          originalPricePerBtc: transaction.original_price_per_btc,
          originalCurrency: transaction.original_currency,
          originalTotalAmount: transaction.original_total_amount,
          fees: transaction.fees,
          feesCurrency: transaction.fees_currency,
          transactionDate: new Date(transaction.transaction_date),
          notes: transaction.notes
        }
      });

      result.imported++;
    } catch (error) {
      result.errors.push(`Transaction import error: ${error}`);
      result.details.invalid_transactions++;
      result.details.skipped_transactions.push({
        data: transaction,
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return result;
}