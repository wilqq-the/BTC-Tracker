import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';

// PUT /api/wallets/[id] - update a wallet
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    const { id } = await context.params;
    const walletId = parseInt(id);
    if (isNaN(walletId)) {
      return NextResponse.json({ success: false, message: 'Invalid wallet ID' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Wallet not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, type, emoji, note, includeInPortfolio } = body;

    if (type && type !== 'cold' && type !== 'hot') {
      return NextResponse.json(
        { success: false, message: 'type must be "cold" or "hot"' },
        { status: 400 }
      );
    }

    const updated = await prisma.wallet.update({
      where: { id: walletId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type }),
        ...(emoji !== undefined && { emoji: emoji?.trim() || null }),
        ...(note !== undefined && { note: note?.trim() || null }),
        ...(includeInPortfolio !== undefined && { includeInPortfolio }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  });
}

// DELETE /api/wallets/[id] - soft-delete a wallet
// If the wallet has linked transactions, it is soft-deleted (isActive = false).
// If it has no transactions it is permanently deleted.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    const { id } = await context.params;
    const walletId = parseInt(id);
    if (isNaN(walletId)) {
      return NextResponse.json({ success: false, message: 'Invalid wallet ID' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.wallet.findFirst({ where: { id: walletId, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Wallet not found' }, { status: 404 });
    }

    // Check if any transactions reference this wallet
    const txCount = await prisma.bitcoinTransaction.count({
      where: {
        OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
      },
    });

    if (txCount > 0) {
      // Soft delete: hide from UI but keep for historical accuracy
      await prisma.wallet.update({
        where: { id: walletId },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        message: `Wallet deactivated (${txCount} transactions reference it)`,
      });
    }

    // Hard delete: no transactions linked
    await prisma.wallet.delete({ where: { id: walletId } });
    return NextResponse.json({ success: true, message: 'Wallet deleted' });
  });
}
