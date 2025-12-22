import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';

/**
 * POST /api/wallets/:id/set-default - Set a wallet as the default
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const { id } = await context.params;
      const walletId = parseInt(id, 10);

      if (isNaN(walletId)) {
        return NextResponse.json(
          { error: 'Invalid wallet ID' },
          { status: 400 }
        );
      }

      // Check wallet exists and belongs to user
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId }
      });

      if (!wallet) {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 }
        );
      }

      // Unset all other defaults and set this one
      await prisma.$transaction([
        prisma.wallet.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false }
        }),
        prisma.wallet.update({
          where: { id: walletId },
          data: { isDefault: true }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: `"${wallet.name}" is now the default wallet`
      });
    } catch (error) {
      console.error('Error setting default wallet:', error);
      return NextResponse.json(
        { error: 'Failed to set default wallet' },
        { status: 500 }
      );
    }
  });
}

