import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';

// Default wallets created for users migrating from the old cold/hot wallet system
const DEFAULT_WALLETS = [
  { name: 'Cold Wallet', type: 'cold', emoji: '❄️', note: 'Default cold storage wallet' },
  { name: 'Hot Wallet', type: 'hot', emoji: '🔥', note: 'Default hot wallet' },
];

// Ensure the user has at least the default wallets (migration helper)
export async function ensureDefaultWallets(userId: number) {
  const existing = await prisma.wallet.count({ where: { userId } });
  if (existing === 0) {
    await prisma.wallet.createMany({
      data: DEFAULT_WALLETS.map(w => ({ ...w, userId })),
    });
  }
}

// GET /api/wallets - list all wallets for the authenticated user, with per-wallet BTC balance
export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    await ensureDefaultWallets(userId);

    const wallets = await prisma.wallet.findMany({
      where: { userId, isActive: true },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });

    // Calculate BTC balance per wallet from transactions
    const walletsWithBalance = await Promise.all(
      wallets.map(async (wallet) => {
        const balance = await calculateWalletBalance(wallet.id);
        return { ...wallet, btcBalance: balance };
      })
    );

    return NextResponse.json({ success: true, data: walletsWithBalance });
  });
}

// POST /api/wallets - create a new wallet
export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    const body = await request.json();
    const { name, type, emoji, note, includeInPortfolio } = body;

    if (!name || !type) {
      return NextResponse.json(
        { success: false, message: 'name and type are required' },
        { status: 400 }
      );
    }
    if (type !== 'cold' && type !== 'hot') {
      return NextResponse.json(
        { success: false, message: 'type must be "cold" or "hot"' },
        { status: 400 }
      );
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        name: name.trim(),
        type,
        emoji: emoji?.trim() || null,
        note: note?.trim() || null,
        includeInPortfolio: includeInPortfolio !== false,
      },
    });

    return NextResponse.json({ success: true, data: wallet }, { status: 201 });
  });
}

// Helper: calculate the BTC balance for a wallet based on linked transactions
async function calculateWalletBalance(walletId: number): Promise<number> {
  // BTC received: toWallet transactions
  //   - Internal transfer arriving: btcAmount - fees
  //   - External TRANSFER_IN arriving: btcAmount - fees
  //   - BUY going to this wallet: btcAmount
  const incoming = await prisma.bitcoinTransaction.findMany({
    where: { toWalletId: walletId },
    select: { type: true, btcAmount: true, fees: true, feesCurrency: true, transferType: true },
  });

  // BTC sent: fromWallet transactions
  //   - Internal transfer leaving: btcAmount (fees already deducted on arrival side)
  //   - External TRANSFER_OUT leaving: btcAmount
  //   - SELL from this wallet: btcAmount
  const outgoing = await prisma.bitcoinTransaction.findMany({
    where: { fromWalletId: walletId },
    select: { type: true, btcAmount: true, fees: true, feesCurrency: true, transferType: true },
  });

  let balance = 0;

  for (const tx of incoming) {
    const btcFee = tx.feesCurrency === 'BTC' ? tx.fees : 0;
    if (tx.type === 'BUY') {
      balance += tx.btcAmount;
    } else if (tx.type === 'TRANSFER') {
      // Wallet receives btcAmount minus network fees
      balance += tx.btcAmount - btcFee;
    }
  }

  for (const tx of outgoing) {
    if (tx.type === 'SELL') {
      balance -= tx.btcAmount;
    } else if (tx.type === 'TRANSFER') {
      // Wallet sends btcAmount (fee is deducted from what arrives)
      balance -= tx.btcAmount;
    }
  }

  return Math.max(0, balance);
}
