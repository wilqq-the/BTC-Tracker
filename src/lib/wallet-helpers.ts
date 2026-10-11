import { prisma } from '@/lib/prisma';

const DEFAULT_WALLETS = [
  { name: 'Cold Wallet', type: 'cold', emoji: null, note: 'Default cold storage wallet' },
  { name: 'Hot Wallet', type: 'hot', emoji: null, note: 'Default hot wallet' },
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

/**
 * True if every given wallet id (null/undefined/empty are ignored) belongs to
 * the user. Used to stop transactions being attached to someone else's wallet.
 */
export async function walletsBelongToUser(
  userId: number,
  walletIds: Array<number | string | null | undefined>
): Promise<boolean> {
  const ids = walletIds
    .filter((id) => id !== null && id !== undefined && id !== '')
    .map((id) => Number(id));
  if (ids.length === 0) return true;
  if (ids.some((id) => !Number.isInteger(id))) return false;
  const unique = ids.filter((id, i) => ids.indexOf(id) === i);
  const owned = await prisma.wallet.count({ where: { id: { in: unique }, userId } });
  return owned === unique.length;
}
