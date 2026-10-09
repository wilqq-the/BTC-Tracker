import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinTransaction } from '@/lib/types';
import { withAuth } from '@/lib/auth-helpers';
import { isTransferFeeMode } from '@/lib/transfer-fees';

// Wallet summary attached to an exported transaction
interface ExportWallet {
  id: number;
  name: string;
  emoji: string | null;
  type: string; // 'cold' | 'hot'
}

// BitcoinTransaction enriched with the wallets it moves BTC between
type ExportTransaction = BitcoinTransaction & {
  from_wallet: ExportWallet | null;
  to_wallet: ExportWallet | null;
};

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    try {
      const { searchParams } = new URL(request.url);
      const format = searchParams.get('format') || 'csv'; // csv or json
      const type = searchParams.get('type'); // BUY, SELL, TRANSFER, or ALL
      const dateFrom = searchParams.get('date_from');
      const dateTo = searchParams.get('date_to');

      // Build Prisma query with filters - include userId for security
      const whereConditions: any = {
        userId: userId
      };

      if (type && type !== 'ALL') {
        whereConditions.type = type;
      }

      if (dateFrom) {
        whereConditions.transactionDate = {
          ...whereConditions.transactionDate,
          gte: new Date(dateFrom)
        };
      }

      if (dateTo) {
        whereConditions.transactionDate = {
          ...whereConditions.transactionDate,
          lte: new Date(dateTo)
        };
      }

      // Fetch transactions using Prisma
      // Same shape as /api/transactions so both endpoints expose wallets identically
      const walletInclude = {
        fromWallet: { select: { id: true, name: true, emoji: true, type: true } },
        toWallet: { select: { id: true, name: true, emoji: true, type: true } },
      };

      const rawTransactions = await prisma.bitcoinTransaction.findMany({
        where: whereConditions,
        include: walletInclude,
        orderBy: [
          { transactionDate: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      // Convert Prisma results to match expected format
      const transactions: ExportTransaction[] = rawTransactions.map(tx => ({
        id: tx.id,
        type: tx.type as 'BUY' | 'SELL' | 'TRANSFER',
        btc_amount: tx.btcAmount,
        original_price_per_btc: tx.originalPricePerBtc,
        original_currency: tx.originalCurrency,
        original_total_amount: tx.originalTotalAmount,
        fees: tx.fees,
        fees_currency: tx.feesCurrency,
        transaction_date: tx.transactionDate.toISOString().split('T')[0],
        notes: tx.notes || '',
        tags: (tx as any).tags || '',
        transfer_type: (tx as any).transferType || null,
        transfer_fee_mode: isTransferFeeMode(tx.transferFeeMode) ? tx.transferFeeMode : null,
        destination_address: (tx as any).destinationAddress || null,
        from_wallet: tx.fromWallet
          ? { id: tx.fromWallet.id, name: tx.fromWallet.name, emoji: tx.fromWallet.emoji, type: tx.fromWallet.type }
          : null,
        to_wallet: tx.toWallet
          ? { id: tx.toWallet.id, name: tx.toWallet.name, emoji: tx.toWallet.emoji, type: tx.toWallet.type }
          : null,
        created_at: tx.createdAt.toISOString(),
        updated_at: tx.updatedAt.toISOString()
      }));

    if (format === 'json') {
      // JSON Export
      const jsonData = {
        export_info: {
          timestamp: new Date().toISOString(),
          total_transactions: transactions.length,
          filters: {
            type: type || 'ALL',
            date_from: dateFrom,
            date_to: dateTo
          }
        },
        transactions: transactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          btc_amount: tx.btc_amount,
          original_price_per_btc: tx.original_price_per_btc,
          original_currency: tx.original_currency,
          original_total_amount: tx.original_total_amount,
          fees: tx.fees || 0,
          fees_currency: tx.fees_currency || tx.original_currency,
          transaction_date: tx.transaction_date,
          notes: tx.notes || '',
          tags: tx.tags || '',
          transfer_type: tx.transfer_type || null,
          transfer_fee_mode: tx.transfer_fee_mode || null,
          destination_address: tx.destination_address || null,
          from_wallet: tx.from_wallet,
          to_wallet: tx.to_wallet,
          created_at: tx.created_at,
          updated_at: tx.updated_at
        }))
      };

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="bitcoin_transactions_${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    } else {
      // CSV Export
      const csvHeaders = [
        'ID',
        'Type',
        'BTC Amount',
        'Price per BTC',
        'Currency',
        'Total Amount',
        'Fees',
        'Fees Currency',
        'Transaction Date',
        'Notes',
        'Transfer Type',
        'Destination Address',
        'Created At',
        'Updated At',
        'From Wallet',
        'From Wallet Type',
        'To Wallet',
        'To Wallet Type',
        'Tags',
        'Transfer Fee Mode'
      ];

      // Helper to escape CSV values (quote if contains comma, quote, or newline)
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value).trim(); // Trim whitespace
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = transactions.map(tx => [
        escapeCsvValue(tx.id),
        escapeCsvValue(tx.type),
        escapeCsvValue(tx.btc_amount),
        escapeCsvValue(tx.original_price_per_btc),
        escapeCsvValue(tx.original_currency),
        escapeCsvValue(tx.original_total_amount),
        escapeCsvValue(tx.fees || 0),
        escapeCsvValue(tx.fees_currency || tx.original_currency),
        escapeCsvValue(tx.transaction_date),
        escapeCsvValue(tx.notes),
        escapeCsvValue(tx.transfer_type || ''),
        escapeCsvValue(tx.destination_address || ''),
        escapeCsvValue(tx.created_at),
        escapeCsvValue(tx.updated_at),
        escapeCsvValue(tx.from_wallet?.name || ''),
        escapeCsvValue(tx.from_wallet?.type || ''),
        escapeCsvValue(tx.to_wallet?.name || ''),
        escapeCsvValue(tx.to_wallet?.type || ''),
        escapeCsvValue(tx.tags || ''),
        escapeCsvValue(tx.transfer_fee_mode || '')
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="bitcoin_transactions_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
    } catch (error) {
      console.error('Error exporting transactions:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to export transactions',
        message: 'An error occurred while exporting transactions'
      }, { status: 500 });
    }
  });
} 