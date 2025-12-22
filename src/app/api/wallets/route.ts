import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';

// Wallet types for validation
const VALID_WALLET_TYPES = ['HARDWARE', 'SOFTWARE', 'EXCHANGE', 'MOBILE', 'CUSTODIAL', 'PAPER'];
const VALID_TEMPERATURES = ['HOT', 'COLD'];

// Default temperature based on wallet type
const DEFAULT_TEMPERATURE: Record<string, string> = {
  HARDWARE: 'COLD',
  SOFTWARE: 'HOT',
  EXCHANGE: 'HOT',
  MOBILE: 'HOT',
  CUSTODIAL: 'COLD',
  PAPER: 'COLD',
};

/**
 * GET /api/wallets - Get all wallets for the current user with balances
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      // Get all wallets for user
      const wallets = await prisma.wallet.findMany({
        where: { userId },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' }
        ],
        include: {
          _count: {
            select: {
              transactionsFrom: true,
              transactionsTo: true,
            }
          }
        }
      });

      // Calculate balance for each wallet
      const walletsWithBalance = await Promise.all(
        wallets.map(async (wallet) => {
          // Calculate incoming BTC (destination wallet)
          const incoming = await prisma.bitcoinTransaction.aggregate({
            where: {
              userId,
              destinationWalletId: wallet.id,
            },
            _sum: {
              btcAmount: true,
            }
          });

          // Calculate outgoing BTC (source wallet)
          const outgoing = await prisma.bitcoinTransaction.aggregate({
            where: {
              userId,
              sourceWalletId: wallet.id,
            },
            _sum: {
              btcAmount: true,
            }
          });

          // Calculate fees for outgoing transfers (BTC fees reduce balance)
          const outgoingFees = await prisma.bitcoinTransaction.aggregate({
            where: {
              userId,
              sourceWalletId: wallet.id,
              feesCurrency: 'BTC',
            },
            _sum: {
              fees: true,
            }
          });

          const incomingBtc = incoming._sum.btcAmount || 0;
          const outgoingBtc = outgoing._sum.btcAmount || 0;
          const feesBtc = outgoingFees._sum.fees || 0;
          const balance = incomingBtc - outgoingBtc - feesBtc;

          return {
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
            balance: Math.max(0, balance), // Prevent negative display
            transactionCount: wallet._count.transactionsFrom + wallet._count.transactionsTo,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt,
          };
        })
      );

      // Calculate summary
      const totalBalance = walletsWithBalance.reduce((sum, w) => sum + w.balance, 0);
      const includedBalance = walletsWithBalance
        .filter(w => w.includeInTotal)
        .reduce((sum, w) => sum + w.balance, 0);
      const hotBalance = walletsWithBalance
        .filter(w => w.temperature === 'HOT' && w.includeInTotal)
        .reduce((sum, w) => sum + w.balance, 0);
      const coldBalance = walletsWithBalance
        .filter(w => w.temperature === 'COLD' && w.includeInTotal)
        .reduce((sum, w) => sum + w.balance, 0);

      return NextResponse.json({
        wallets: walletsWithBalance,
        summary: {
          totalBalance,
          includedBalance,
          hotBalance,
          coldBalance,
          walletCount: wallets.length,
        }
      });
    } catch (error) {
      console.error('Error fetching wallets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wallets' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/wallets - Create a new wallet
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const body = await request.json();
      const { name, type, temperature, emoji, color, notes, includeInTotal, isDefault } = body;

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Wallet name is required' },
          { status: 400 }
        );
      }

      if (!type || !VALID_WALLET_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Invalid wallet type. Must be one of: ${VALID_WALLET_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const walletTemperature = temperature || DEFAULT_TEMPERATURE[type] || 'HOT';
      if (!VALID_TEMPERATURES.includes(walletTemperature)) {
        return NextResponse.json(
          { error: 'Invalid temperature. Must be HOT or COLD' },
          { status: 400 }
        );
      }

      // Check for duplicate name
      const existing = await prisma.wallet.findFirst({
        where: {
          userId,
          name: name.trim(),
        }
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A wallet with this name already exists' },
          { status: 400 }
        );
      }

      // Get max sort order
      const maxSort = await prisma.wallet.aggregate({
        where: { userId },
        _max: { sortOrder: true }
      });

      // If setting as default, unset other defaults first
      if (isDefault) {
        await prisma.wallet.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false }
        });
      }

      // Create wallet
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          name: name.trim(),
          type,
          temperature: walletTemperature,
          emoji: emoji || null,
          color: color || null,
          notes: notes || null,
          includeInTotal: includeInTotal !== false, // Default true
          isDefault: isDefault || false,
          sortOrder: (maxSort._max.sortOrder || 0) + 1,
        }
      });

      return NextResponse.json({
        success: true,
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
          balance: 0,
          transactionCount: 0,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        }
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating wallet:', error);
      return NextResponse.json(
        { error: 'Failed to create wallet' },
        { status: 500 }
      );
    }
  });
}

