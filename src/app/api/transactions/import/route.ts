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
    const walletIdRaw = formData.get('wallet_id') as string | null;
    const walletId = walletIdRaw ? parseInt(walletIdRaw) : null;

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
    const result = await importTransactions(transactions, duplicateCheckMode, userId, walletId);

    // Recalculate portfolio after import (rate-limited to prevent I/O overload)
    if (result.imported > 0 || (result.updated && result.updated > 0)) {
      try {
        await BitcoinPriceService.calculateAndStorePortfolioSummary();
      } catch (error) {
        console.error('Error recalculating portfolio after import:', error);
      }
    }

    const updatedMsg = result.updated && result.updated > 0 ? `, updated ${result.updated} Auto-DCA entries` : '';
    return NextResponse.json({
      ...result,
      detected_format: detectedFormat,
      message: `Successfully imported ${result.imported} transactions${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}${updatedMsg}`
    });
  });
}

type DuplicateCheckMode = 'strict' | 'standard' | 'loose' | 'off' | 'dca';

async function importTransactions(
  transactions: ImportTransaction[],
  duplicateCheckMode: string,
  userId: number,
  walletId: number | null = null
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
        let existing: any = null;

        if (duplicateCheckMode === 'dca') {
          // DCA mode: match by date (day), fiat amount, currency, and Auto-DCA marker
          const dateStr = transaction.transaction_date.substring(0, 10); // YYYY-MM-DD
          const startDate = new Date(dateStr + 'T00:00:00.000Z');
          const endDate = new Date(dateStr + 'T23:59:59.999Z');
          existing = await prisma.bitcoinTransaction.findFirst({
            where: {
              userId,
              type: transaction.type,
              transactionDate: { gte: startDate, lte: endDate },
              originalCurrency: transaction.original_currency,
              originalTotalAmount: {
                gte: transaction.original_total_amount - 0.01,
                lte: transaction.original_total_amount + 0.01,
              },
              OR: [
                { notes: { contains: 'Auto-DCA' } },
                { tags: { contains: 'DCA' } },
              ],
            },
          });

          if (existing) {
            // Check if already reconciled (btcAmount and price already match CSV values)
            const btcTolerance = transaction.btc_amount * 0.0001; // 0.01%
            const priceTolerance = transaction.original_price_per_btc * 0.0001;
            const alreadyReconciled =
              Math.abs(existing.btcAmount - transaction.btc_amount) <= btcTolerance &&
              Math.abs(existing.originalPricePerBtc - transaction.original_price_per_btc) <= priceTolerance;

            if (alreadyReconciled) {
              result.skipped++;
              result.details.duplicate_transactions++;
              result.details.skipped_transactions.push({
                data: transaction,
                reason: 'Duplicate transaction (dca mode — already reconciled)'
              });
              continue;
            }

            // Update the Auto-DCA transaction with real broker data (date kept as-is)
            await prisma.bitcoinTransaction.update({
              where: { id: existing.id },
              data: {
                btcAmount: transaction.btc_amount,
                originalPricePerBtc: transaction.original_price_per_btc,
                fees: transaction.fees > 0 ? transaction.fees : existing.fees,
                feesCurrency: transaction.fees_currency || existing.feesCurrency,
                notes: existing.notes
                  ? `${existing.notes} | ${transaction.notes}`
                  : transaction.notes,
                updatedAt: new Date(),
              },
            });
            result.updated = (result.updated || 0) + 1;
            continue;
          }

          // Option B: also skip already-imported broker transactions (same day + fiat amount + currency + btcAmount)
          // to prevent duplicates when the same CSV is imported a second time.
          // btcAmount must also match closely — otherwise it's a manual entry with wrong data, not a true duplicate.
          const btcTolerance = transaction.btc_amount * 0.0001; // 0.01% tolerance
          const alreadyImported = await prisma.bitcoinTransaction.findFirst({
            where: {
              userId,
              type: transaction.type,
              transactionDate: { gte: startDate, lte: endDate },
              originalCurrency: transaction.original_currency,
              originalTotalAmount: {
                gte: transaction.original_total_amount - 0.01,
                lte: transaction.original_total_amount + 0.01,
              },
              btcAmount: {
                gte: transaction.btc_amount - btcTolerance,
                lte: transaction.btc_amount + btcTolerance,
              },
            },
          });

          if (alreadyImported) {
            result.skipped++;
            result.details.duplicate_transactions++;
            result.details.skipped_transactions.push({
              data: transaction,
              reason: 'Duplicate transaction (dca mode — already imported)'
            });
            continue;
          }
        } else {
          // Build where clause for standard duplicate check modes.
          // Use a day-range instead of exact timestamp to stay compatible with
          // previously imported data (stored at midnight) and new imports (exact time).
          const dateStr = transaction.transaction_date.substring(0, 10); // YYYY-MM-DD
          const dayStart = new Date(dateStr + 'T00:00:00.000Z');
          const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
          let whereClause: any = {
            userId: userId,
            transactionDate: { gte: dayStart, lte: dayEnd }
          };

          if (duplicateCheckMode === 'strict') {
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
            whereClause = {
              ...whereClause,
              type: transaction.type,
              btcAmount: transaction.btc_amount,
              originalPricePerBtc: transaction.original_price_per_btc
            };
          } else if (duplicateCheckMode === 'loose') {
            whereClause = {
              ...whereClause,
              btcAmount: transaction.btc_amount
            };
          }

          existing = await prisma.bitcoinTransaction.findFirst({
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
          destinationAddress: isTransfer ? (transaction.destination_address || null) : null,
          toWalletId: !isTransfer && transaction.type === 'BUY' ? walletId : null,
          fromWalletId: !isTransfer && transaction.type === 'SELL' ? walletId : null,
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