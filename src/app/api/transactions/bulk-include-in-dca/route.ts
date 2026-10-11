import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { isOnchainAcquisition } from '@/lib/acquisition';
import { withAuth } from '@/lib/auth-helpers';

/**
 * Bulk version of "Include in DCA": promote every eligible on-chain receive
 * among the selected transaction ids to a BUY. Rows that do not qualify (or
 * that belong to another user) are skipped without failing the whole batch.
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    let ids: unknown;
    try {
      const body = await request.json();
      ids = body?.ids;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) {
      return NextResponse.json(
        { success: false, error: 'A non-empty array of transaction ids is required' },
        { status: 400 }
      );
    }

    const selectedIds = ids as number[];
    const transactions = await prisma.bitcoinTransaction.findMany({
      where: { id: { in: selectedIds }, userId },
    });

    const eligible = transactions.filter(isOnchainAcquisition);
    const included = eligible.length;

    if (included > 0) {
      await prisma.bitcoinTransaction.updateMany({
        where: { id: { in: eligible.map((tx) => tx.id) }, userId },
        data: { type: 'BUY' },
      });

      try {
        await BitcoinPriceService.calculateAndStorePortfolioSummary(userId);
      } catch (error) {
        console.error(`Failed to recalc portfolio after bulk-including ${included} tx in DCA:`, error);
      }
    }

    const skipped = transactions.length - included;
    const message =
      included > 0
        ? `${included} transaction(s) included in DCA`
        : 'None of the selected transactions can be included in DCA (only on-chain receives with a stored cost basis)';

    return NextResponse.json({
      success: true,
      data: { included, skipped, totalSelected: selectedIds.length },
      message,
    });
  });
}