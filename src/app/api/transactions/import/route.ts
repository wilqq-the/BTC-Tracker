/**
 * Transaction Import API Route
 * Handles CSV and JSON file imports with auto-detection of exchange formats
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { withAuth } from '@/lib/auth-helpers';
import { 
  ImportTransaction, 
  ImportResult,
  parseCsvFile,
  parseJsonFile 
} from './parsers';

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const duplicateCheckMode = (formData.get('duplicate_check_mode') as string) || 'standard';
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

    // Validate and import transactions with user association
    const result = await importTransactions(transactions, duplicateCheckMode, userId);

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
  });
}

type DuplicateCheckMode = 'strict' | 'standard' | 'loose' | 'off';

async function importTransactions(
  transactions: ImportTransaction[], 
  duplicateCheckMode: string,
  userId: number
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
      // Check for duplicates based on mode
      if (duplicateCheckMode !== 'off') {
        // Convert date string to Date object for comparison
        const transactionDate = new Date(transaction.transaction_date);
        
        // Build where clause based on duplicate check mode
        let whereClause: any = {
          userId: userId,
          transactionDate: transactionDate
        };
        
        if (duplicateCheckMode === 'strict') {
          // Strict: All fields must match
          whereClause = {
            ...whereClause,
            type: transaction.type,
            btcAmount: transaction.btc_amount,
            originalPricePerBtc: transaction.original_price_per_btc,
            originalCurrency: transaction.original_currency,
            originalTotalAmount: transaction.original_total_amount,
            fees: transaction.fees,
            feesCurrency: transaction.fees_currency,
            notes: transaction.notes || ''
          };
        } else if (duplicateCheckMode === 'standard') {
          // Standard: Core fields must match (date, type, amount, price)
          whereClause = {
            ...whereClause,
            type: transaction.type,
            btcAmount: transaction.btc_amount,
            originalPricePerBtc: transaction.original_price_per_btc
          };
        } else if (duplicateCheckMode === 'loose') {
          // Loose: Only date and amount must match
          whereClause = {
            ...whereClause,
            btcAmount: transaction.btc_amount
          };
        }
          
        const existing = await prisma.bitcoinTransaction.findFirst({
          where: whereClause
        });

        if (existing) {
          result.skipped++;
          result.details.duplicate_transactions++;
          result.details.skipped_transactions.push({
            data: transaction,
            reason: `Duplicate transaction (${duplicateCheckMode} mode)`
          });
          continue;
        }
      }

      // Import the transaction with user association
      const isTransfer = transaction.type === 'TRANSFER';
      await prisma.bitcoinTransaction.create({
        data: {
          userId: userId,
          type: transaction.type,
          btcAmount: transaction.btc_amount,
          originalPricePerBtc: transaction.original_price_per_btc,
          originalCurrency: transaction.original_currency,
          originalTotalAmount: transaction.original_total_amount,
          fees: transaction.fees,
          feesCurrency: transaction.fees_currency,
          transactionDate: new Date(transaction.transaction_date),
          notes: transaction.notes,
          transferType: isTransfer ? (transaction.transfer_type || null) : null,
          destinationAddress: isTransfer ? (transaction.destination_address || null) : null
        } as any
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