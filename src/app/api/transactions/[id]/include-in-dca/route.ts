import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { isOnchainAcquisition } from '@/lib/acquisition';
import { withAuth } from '@/lib/auth-helpers';

/**
 * Promote a scanned on-chain receive to a BUY in one click so it joins the DCA
 * analysis (which only looks at BUY rows). The inferred cost basis stored at
 * import time (block-day close) is kept as-is; the user can still refine the
 * price afterwards through the regular edit form.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    const params = await context.params;
    const transactionId = parseInt(params.id);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    const transaction = await prisma.bitcoinTransaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (!isOnchainAcquisition(transaction)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only on-chain receives with a stored cost basis can be included in DCA',
          message: 'This transaction is not an eligible on-chain receive.',
        },
        { status: 400 }
      );
    }

    const updated = await prisma.bitcoinTransaction.update({
      where: { id: transactionId },
      data: { type: 'BUY' },
    });

    try {
      await BitcoinPriceService.calculateAndStorePortfolioSummary(userId);
    } catch (error) {
      console.error(`Failed to recalc portfolio after including tx ${transactionId} in DCA:`, error);
    }

    return NextResponse.json({
      success: true,
      data: { id: updated.id, type: updated.type },
      message: 'Transaction included in DCA',
    });
  });
}