/**
 * Exchange Connection Detail API
 * GET    - Get connection details (without decrypted secrets)
 * PUT    - Update connection (wallet assignment, label, active status)
 * DELETE - Remove connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    const { id } = await params;
    const connectionId = parseInt(id);

    if (isNaN(connectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid connection ID' }, { status: 400 });
    }

    const connection = await prisma.exchangeConnection.findFirst({
      where: { id: connectionId, userId },
      select: {
        id: true,
        exchangeName: true,
        label: true,
        walletId: true,
        isActive: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        lastSyncCount: true,
        createdAt: true,
        updatedAt: true,
        wallet: {
          select: { id: true, name: true, type: true, emoji: true },
        },
      },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: connection });
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    const { id } = await params;
    const connectionId = parseInt(id);

    if (isNaN(connectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid connection ID' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.exchangeConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    let body: {
      label?: string;
      walletId?: number | null;
      isActive?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    // Validate wallet if specified
    if (body.walletId !== undefined && body.walletId !== null) {
      const wallet = await prisma.wallet.findFirst({
        where: { id: body.walletId, userId },
      });
      if (!wallet) {
        return NextResponse.json(
          { success: false, error: 'Wallet not found or does not belong to you' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.label !== undefined) updateData.label = body.label;
    if (body.walletId !== undefined) updateData.walletId = body.walletId;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await prisma.exchangeConnection.update({
      where: { id: connectionId },
      data: updateData,
      select: {
        id: true,
        exchangeName: true,
        label: true,
        walletId: true,
        isActive: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Connection updated',
    });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    const { id } = await params;
    const connectionId = parseInt(id);

    if (isNaN(connectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid connection ID' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.exchangeConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    await prisma.exchangeConnection.delete({
      where: { id: connectionId },
    });

    return NextResponse.json({
      success: true,
      message: 'Exchange connection deleted',
    });
  });
}
