import { prisma } from '@/lib/prisma';

const DEFAULT_WALLETS = [
  { name: 'Cold Wallet', type: 'cold', emoji: '❄️', note: 'Default cold storage wallet' },
  { name: 'Hot Wallet', type: 'hot', emoji: '🔥', note: 'Default hot wallet' },
];

/** Ensure the user has at least the two default wallets (migration helper). */
export async function ensureDefaultWallets(userId: number) {
  const existing = await prisma.wallet.count({ where: { userId } });
  if (existing === 0) {
    await prisma.wallet.createMany({
      data: DEFAULT_WALLETS.map(w => ({ ...w, userId })),
    });
  }
}
