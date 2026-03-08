/**
 * Exchange Connections API
 * GET  - List user's exchange connections
 * POST - Create a new exchange connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';
import { EncryptionService } from '@/lib/encryption-service';
import { ExchangeSyncService } from '@/lib/exchange-sync-service';
import { ExchangeName, SUPPORTED_EXCHANGES } from '@/lib/exchanges';

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    const connections = await prisma.exchangeConnection.findMany({
      where: { userId },
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: connections,
      supportedExchanges: SUPPORTED_EXCHANGES,
    });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    let body: {
      exchangeName?: string;
      apiKey?: string;
      apiSecret?: string;
      label?: string;
      walletId?: number | null;
      testFirst?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const { exchangeName, apiKey, apiSecret, label, walletId, testFirst = true } = body;

    // Validate required fields
    if (!exchangeName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, error: 'exchangeName, apiKey, and apiSecret are required' },
        { status: 400 }
      );
    }

    // Validate exchange name
    const validExchanges = SUPPORTED_EXCHANGES.map(e => e.name);
    if (!validExchanges.includes(exchangeName as ExchangeName)) {
      return NextResponse.json(
        { success: false, error: `Unsupported exchange. Supported: ${validExchanges.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate wallet belongs to user (if specified)
    if (walletId) {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId },
      });
      if (!wallet) {
        return NextResponse.json(
          { success: false, error: 'Wallet not found or does not belong to you' },
          { status: 400 }
        );
      }
    }

    // Optionally test credentials before saving
    if (testFirst) {
      const testResult = await ExchangeSyncService.testCredentials(
        exchangeName as ExchangeName,
        apiKey,
        apiSecret
      );

      if (!testResult.success) {
        return NextResponse.json(
          { success: false, error: `Authentication failed: ${testResult.error}` },
          { status: 400 }
        );
      }
    }

    // Encrypt credentials
    const encryptedApiKey = EncryptionService.encrypt(apiKey);
    const encryptedApiSecret = EncryptionService.encrypt(apiSecret);

    // Create the connection
    const connection = await prisma.exchangeConnection.create({
      data: {
        userId,
        exchangeName: exchangeName as string,
        label: label || '',
        encryptedApiKey,
        encryptedApiSecret,
        walletId: walletId || null,
      },
      select: {
        id: true,
        exchangeName: true,
        label: true,
        walletId: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: connection,
      message: 'Exchange connection created successfully',
    });
  });
}
