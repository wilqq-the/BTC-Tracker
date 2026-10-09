/**
 * Demo account for screenshots and local testing.
 *
 *   DEMO_PASSWORD=... npx tsx scripts/seed-demo.ts
 *
 * Creates (or recreates) the user demo@btctracker.local with ~4.5 years of
 * realistic activity priced from the local bitcoin_price_history table:
 * monthly $250 DCA buys, two dip buys, one sale, periodic moves from an
 * exchange wallet to a hardware wallet, a savings goal and two recurring
 * purchases. Re-running deletes only this demo user (cascade) and rebuilds it.
 * Never touches other users.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const EMAIL = 'demo@btctracker.local';

const round8 = (n: number) => Math.round(n * 1e8) / 1e8;
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function closeOn(date: Date): Promise<number> {
  // Nearest available daily close on or before the date
  const row = await prisma.bitcoinPriceHistory.findFirst({
    where: { date: { lte: iso(date) } },
    orderBy: { date: 'desc' },
  });
  if (!row) throw new Error(`No price history on or before ${iso(date)} — fetch historical data first`);
  return row.closeUsd;
}

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set DEMO_PASSWORD (8+ characters) to create the demo account');
  }

  await prisma.user.deleteMany({ where: { email: EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await bcrypt.hash(password, 12),
      name: 'Alex Demo',
      displayName: 'Alex',
      isAdmin: false,
    },
  });

  const exchange = await prisma.wallet.create({
    data: { userId: user.id, name: 'Kraken', type: 'hot', note: 'Monthly DCA lands here' },
  });
  const ledger = await prisma.wallet.create({
    data: { userId: user.id, name: 'Ledger Nano X', type: 'cold', note: 'Long-term savings' },
  });

  type Tx = Parameters<typeof prisma.bitcoinTransaction.create>[0]['data'];
  const txs: Tx[] = [];
  let hot = 0;

  const buy = async (date: Date, usd: number, tags: string, notes: string) => {
    const price = await closeOn(date);
    const btc = round8(usd / price);
    hot += btc;
    txs.push({
      userId: user.id, type: 'BUY', btcAmount: btc,
      originalPricePerBtc: price, originalCurrency: 'USD', originalTotalAmount: usd,
      fees: round8(usd * 0.005), feesCurrency: 'USD',
      transactionDate: date, notes, tags, toWalletId: exchange.id,
    });
  };

  // Monthly DCA on the 5th, Jan 2022 → Sep 2026
  for (let d = new Date(Date.UTC(2022, 0, 5)); d <= new Date(Date.UTC(2026, 8, 5)); d.setUTCMonth(d.getUTCMonth() + 1)) {
    await buy(new Date(d), 250, 'DCA', 'Monthly buy');
  }
  // Dip buys
  await buy(new Date(Date.UTC(2022, 5, 18)), 1000, 'DCA,Dip', 'Bought the June 2022 dip');
  await buy(new Date(Date.UTC(2022, 10, 10)), 1500, 'Dip', 'FTX crash buy');

  // Chronological order matters for the wallet moves below
  txs.sort((a, b) => +new Date(a.transactionDate as Date) - +new Date(b.transactionDate as Date));
  const timeline: Tx[] = [];
  const moves = [
    new Date(Date.UTC(2023, 0, 15)),
    new Date(Date.UTC(2023, 8, 1)),
    new Date(Date.UTC(2024, 5, 1)),
    new Date(Date.UTC(2025, 2, 1)),
    new Date(Date.UTC(2026, 0, 10)),
  ];
  const sale = new Date(Date.UTC(2024, 2, 14));
  let balance = 0;
  let pending = [...moves, sale].sort((a, b) => +a - +b);

  for (const tx of txs) {
    while (pending.length && +pending[0] <= +new Date(tx.transactionDate as Date)) {
      const when = pending.shift()!;
      if (+when === +sale) {
        const price = await closeOn(when);
        const btc = 0.03;
        balance -= btc;
        timeline.push({
          userId: user.id, type: 'SELL', btcAmount: btc,
          originalPricePerBtc: price, originalCurrency: 'USD', originalTotalAmount: round8(btc * price),
          fees: round8(btc * price * 0.0026), feesCurrency: 'USD',
          transactionDate: when, notes: 'Took some profit near the high', tags: 'Rebalance', fromWalletId: exchange.id,
        });
      } else {
        const btc = round8(balance * 0.85);
        balance -= btc;
        timeline.push({
          userId: user.id, type: 'TRANSFER', transferType: 'TO_COLD_WALLET', btcAmount: btc,
          originalPricePerBtc: 0, originalCurrency: 'USD', originalTotalAmount: 0,
          fees: 0.00004, feesCurrency: 'BTC',
          transactionDate: when, notes: 'Moved to hardware wallet', tags: 'Cold storage',
          fromWalletId: exchange.id, toWalletId: ledger.id,
        });
      }
    }
    balance += tx.btcAmount as number;
    timeline.push(tx);
  }

  await prisma.bitcoinTransaction.createMany({ data: timeline as any });

  const holdings = timeline.reduce((sum, t) =>
    t.type === 'BUY' ? sum + (t.btcAmount as number)
      : t.type === 'SELL' ? sum - (t.btcAmount as number)
        : sum - ((t.feesCurrency === 'BTC' ? (t.fees as number) : 0)), 0);
  const now = await closeOn(new Date());
  const target = new Date(Date.UTC(2030, 11, 31));
  const months = Math.max(1, Math.round((+target - Date.now()) / (30.44 * 86_400_000)));
  const btcNeeded = Math.max(0, 1 - holdings);

  const goal = await prisma.goal.create({
    data: {
      userId: user.id, name: '1 BTC by 2030', targetBtcAmount: 1, targetDate: target,
      currentHoldings: holdings, monthlyBudget: 500, currency: 'USD',
      priceScenario: 'moderate', scenarioGrowthRate: 0.17,
      monthlyBtcNeeded: round8(btcNeeded / months), monthlyFiatNeeded: Math.round((btcNeeded / months) * now * 1.4),
      totalFiatNeeded: Math.round(btcNeeded * now * 1.4), totalMonths: months,
      initialBtcPrice: now, finalBtcPrice: Math.round(now * Math.pow(1.17, months / 12)),
    },
  });

  const nextMonth = new Date();
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 5);
  await prisma.recurringTransaction.createMany({
    data: [
      {
        userId: user.id, name: 'Monthly DCA', type: 'BUY', amount: 250, currency: 'USD',
        fees: 1.25, feesCurrency: 'USD', frequency: 'monthly',
        startDate: new Date(Date.UTC(2022, 0, 5)), nextExecution: nextMonth,
        executionCount: 57, lastExecuted: new Date(Date.UTC(2026, 8, 5)),
        goalId: goal.id, tags: 'DCA', notes: 'Payday buy',
      },
      {
        userId: user.id, name: 'Weekly stack', type: 'BUY', amount: 25, currency: 'USD',
        fees: 0.13, feesCurrency: 'USD', frequency: 'weekly',
        startDate: new Date(Date.UTC(2026, 6, 1)), nextExecution: nextMonth,
        isPaused: true, tags: 'DCA', notes: 'Paused while saving for a trip',
      },
    ],
  });

  console.log(`Demo user ${EMAIL}: ${timeline.length} transactions, ${holdings.toFixed(8)} BTC`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
