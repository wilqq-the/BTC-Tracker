import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';

// Wallet types for validation
const VALID_WALLET_TYPES = ['HARDWARE', 'SOFTWARE', 'EXCHANGE', 'MOBILE', 'CUSTODIAL', 'PAPER'];
const VALID_TEMPERATURES = ['HOT', 'COLD'];

/**
 * GET /api/wallets/:id - Get a specific wallet with balance
 */
export async function GET(
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

      const wallet = await prisma.wallet.findFirst({
        where: {
          id: walletId,
          userId, // Ensure user owns this wallet
        },
        include: {
          _count: {
            select: {
              transactionsFrom: true,
              transactionsTo: true,
            }
          }
        }
      });

      if (!wallet) {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 }
        );
      }

      // Calculate balance
      const incoming = await prisma.bitcoinTransaction.aggregate({
        where: { userId, destinationWalletId: wallet.id },
        _sum: { btcAmount: true }
      });

      const outgoing = await prisma.bitcoinTransaction.aggregate({
        where: { userId, sourceWalletId: wallet.id },
        _sum: { btcAmount: true }
      });

      const outgoingFees = await prisma.bitcoinTransaction.aggregate({
        where: { userId, sourceWalletId: wallet.id, feesCurrency: 'BTC' },
        _sum: { fees: true }
      });

      const balance = (incoming._sum.btcAmount || 0) - (outgoing._sum.btcAmount || 0) - (outgoingFees._sum.fees || 0);

      return NextResponse.json({
        wallet: {
          id: wallet.id,
          name: wallet.name,
          type: wallet.type,
          temperature: wallet.temperature,
          emoji: wallet.emoji,
          color: wallet.color,
          notes: wallet.notes,
          includeInTotal: wallet.includeInTotal,
          isDefault: wallet.isDefault,
          sortOrder: wallet.sortOrder,
          balance: Math.max(0, balance),
          transactionCount: wallet._count.transactionsFrom + wallet._count.transactionsTo,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        }
      });
    } catch (error) {
      console.error('Error fetching wallet:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wallet' },
        { status: 500 }
      );
    }
  });
}

/**
 * PUT /api/wallets/:id - Update a wallet
 */
export async function PUT(
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
      const existingWallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId }
      });

      if (!existingWallet) {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 }
        );
      }

      const body = await request.json();
      const { name, type, temperature, emoji, color, notes, includeInTotal, isDefault, sortOrder } = body;

      // Validate name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return NextResponse.json(
            { error: 'Wallet name cannot be empty' },
            { status: 400 }
          );
        }

        // Check for duplicate name (excluding current wallet)
        const duplicate = await prisma.wallet.findFirst({
          where: {
            userId,
            name: name.trim(),
            id: { not: walletId }
          }
        });

        if (duplicate) {
          return NextResponse.json(
            { error: 'A wallet with this name already exists' },
            { status: 400 }
          );
        }
      }

      // Validate type if provided
      if (type !== undefined && !VALID_WALLET_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Invalid wallet type. Must be one of: ${VALID_WALLET_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate temperature if provided
      if (temperature !== undefined && !VALID_TEMPERATURES.includes(temperature)) {
        return NextResponse.json(
          { error: 'Invalid temperature. Must be HOT or COLD' },
          { status: 400 }
        );
      }

      // If setting as default, unset other defaults first
      if (isDefault === true) {
        await prisma.wallet.updateMany({
          where: { userId, isDefault: true, id: { not: walletId } },
          data: { isDefault: false }
        });
      }

      // Update wallet
      const updatedWallet = await prisma.wallet.update({
        where: { id: walletId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(type !== undefined && { type }),
          ...(temperature !== undefined && { temperature }),
          ...(emoji !== undefined && { emoji: emoji || null }),
          ...(color !== undefined && { color: color || null }),
          ...(notes !== undefined && { notes: notes || null }),
          ...(includeInTotal !== undefined && { includeInTotal }),
          ...(isDefault !== undefined && { isDefault }),
          ...(sortOrder !== undefined && { sortOrder }),
        }
      });

      return NextResponse.json({
        success: true,
        wallet: {
          id: updatedWallet.id,
          name: updatedWallet.name,
          type: updatedWallet.type,
          temperature: updatedWallet.temperature,
          emoji: updatedWallet.emoji,
          color: updatedWallet.color,
          notes: updatedWallet.notes,
          includeInTotal: updatedWallet.includeInTotal,
          isDefault: updatedWallet.isDefault,
          sortOrder: updatedWallet.sortOrder,
          createdAt: updatedWallet.createdAt,
          updatedAt: updatedWallet.updatedAt,
        }
      });
    } catch (error) {
      console.error('Error updating wallet:', error);
      return NextResponse.json(
        { error: 'Failed to update wallet' },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/wallets/:id - Delete a wallet (with optional reassignment)
 */
export async function DELETE(
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
        where: { id: walletId, userId },
        include: {
          _count: {
            select: {
              transactionsFrom: true,
              transactionsTo: true,
            }
          }
        }
      });

      if (!wallet) {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 }
        );
      }

      // Check if this is the last wallet
      const walletCount = await prisma.wallet.count({
        where: { userId }
      });

      if (walletCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last wallet. You must have at least one wallet.' },
          { status: 400 }
        );
      }

      // Check if this is the default wallet
      if (wallet.isDefault) {
        return NextResponse.json(
          { error: 'Cannot delete the default wallet. Set another wallet as default first.' },
          { status: 400 }
        );
      }

      const transactionCount = wallet._count.transactionsFrom + wallet._count.transactionsTo;

      // If wallet has transactions, require reassignment
      if (transactionCount > 0) {
        const body = await request.json().catch(() => ({}));
        const { reassignToWalletId } = body;

        if (!reassignToWalletId) {
          return NextResponse.json(
            { 
              error: 'Wallet has transactions. Provide reassignToWalletId to move them.',
              transactionCount,
              requiresReassignment: true
            },
            { status: 400 }
          );
        }

        const targetWalletId = parseInt(reassignToWalletId, 10);

        // Verify target wallet exists and belongs to user
        const targetWallet = await prisma.wallet.findFirst({
          where: { id: targetWalletId, userId }
        });

        if (!targetWallet) {
          return NextResponse.json(
            { error: 'Target wallet for reassignment not found' },
            { status: 400 }
          );
        }

        if (targetWalletId === walletId) {
          return NextResponse.json(
            { error: 'Cannot reassign transactions to the same wallet being deleted' },
            { status: 400 }
          );
        }

        // Reassign all transactions
        await prisma.$transaction([
          prisma.bitcoinTransaction.updateMany({
            where: { sourceWalletId: walletId },
            data: { sourceWalletId: targetWalletId }
          }),
          prisma.bitcoinTransaction.updateMany({
            where: { destinationWalletId: walletId },
            data: { destinationWalletId: targetWalletId }
          }),
        ]);
      }

      // Delete the wallet
      await prisma.wallet.delete({
        where: { id: walletId }
      });

      return NextResponse.json({
        success: true,
        message: `Wallet "${wallet.name}" deleted successfully`,
        transactionsReassigned: transactionCount
      });
    } catch (error) {
      console.error('Error deleting wallet:', error);
      return NextResponse.json(
        { error: 'Failed to delete wallet' },
        { status: 500 }
      );
    }
  });
}

