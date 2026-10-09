'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard } from '@/components/ui/widget-card';
import { RingChart } from '@/components/ui/ring-chart';
import { WalletTypeIcon } from '@/components/ui/wallet-type-icon';
import { WidgetProps } from '@/lib/dashboard-types';
import { onTransactionsChanged } from '@/lib/app-events';
import { useBtcUnit } from '@/hooks/use-btc-unit';

interface WalletEntry {
  id: number;
  name: string;
  type: 'cold' | 'hot';
  emoji: string | null;
  includeInPortfolio: boolean;
  btcBalance: number;
}

interface WalletData {
  totalBtc: number;
  coldWalletBtc: number;
  hotWalletBtc: number;
  coldPercentage: number;
  walletBreakdown: WalletEntry[];
}

// Segment colours: cold storage reads blue, hot reads orange, extras cycle
const COLD_COLORS = ['hsl(var(--tint-blue-fg))', 'hsl(var(--chart-5))', 'hsl(190 80% 40%)'];
const HOT_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(330 75% 55%)'];
const UNASSIGNED_COLOR = 'hsl(var(--muted-foreground) / 0.45)';

/**
 * Wallet Distribution Widget
 * Shows per-wallet BTC breakdown and overall cold/hot security status.
 */
export default function WalletDistributionWidget({ id, onRefresh }: WidgetProps) {
  const { formatBtc } = useBtcUnit();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWalletData();
    return onTransactionsChanged(loadWalletData);
  }, []);

  const loadWalletData = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;
        const total = data.totalBtc || 0;
        const cold = data.coldWalletBtc || 0;
        const hot = data.hotWalletBtc || 0;
        const coldPercent = total > 0 ? (cold / total) * 100 : 0;

        setWalletData({
          totalBtc: total,
          coldWalletBtc: cold,
          hotWalletBtc: hot,
          coldPercentage: coldPercent,
          walletBreakdown: data.walletBreakdown || [],
        });
      }
    } catch (err) {
      console.error('Error loading wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
    onRefresh?.();
  };

  // Security status based on cold-storage share, shown as a friendly tip
  const getSecurityStatus = () => {
    if (!walletData) return null;
    const pct = walletData.coldPercentage;
    if (pct >= 80) return { text: `${pct.toFixed(0)}% in cold storage — nicely secured.`, tone: 'bg-tint-green text-tint-green-fg' };
    if (pct >= 50) return { text: `${pct.toFixed(0)}% in cold storage — good, room to move more.`, tone: 'bg-tint-blue text-tint-blue-fg' };
    return { text: 'Tip: move long-term coins to cold storage.', tone: 'bg-tint-blue text-tint-blue-fg' };
  };

  const status = getSecurityStatus();

  // Rows for the legend + donut: named wallets (with an Unassigned remainder),
  // or the legacy cold/hot totals
  type Row = { key: string; name: string; btc: number; color: string; type?: string; excluded?: boolean };
  let rows: Row[] = [];
  if (walletData) {
    if (walletData.walletBreakdown.length > 0) {
      let cold = 0;
      let hot = 0;
      rows = walletData.walletBreakdown.map((w) => ({
        key: String(w.id),
        name: w.name,
        type: w.type,
        btc: w.btcBalance,
        excluded: !w.includeInPortfolio,
        color: w.type === 'cold'
          ? COLD_COLORS[cold++ % COLD_COLORS.length]
          : HOT_COLORS[hot++ % HOT_COLORS.length],
      }));
      const assigned = walletData.walletBreakdown
        .filter((w) => w.includeInPortfolio)
        .reduce((acc, w) => acc + w.btcBalance, 0);
      const unassigned = walletData.totalBtc - assigned;
      if (unassigned > 1e-8) rows.push({ key: 'unassigned', name: 'Unassigned', btc: unassigned, color: UNASSIGNED_COLOR });
    } else {
      rows = [
        { key: 'hot', name: 'Hot wallet', btc: Math.abs(walletData.hotWalletBtc), color: HOT_COLORS[0], type: 'hot' },
        { key: 'cold', name: 'Cold wallet', btc: walletData.coldWalletBtc, color: COLD_COLORS[0], type: 'cold' },
      ];
    }
  }

  return (
    <WidgetCard
      title="Wallets"
      loading={loading}
      error={!walletData ? 'No wallet data available' : null}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      contentClassName="overflow-auto"
    >
      {walletData && (
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-5">
            <RingChart
              segments={rows.filter((r) => !r.excluded).map((r) => ({ value: r.btc, color: r.color, label: r.name }))}
              total={walletData.totalBtc}
              size={112}
              thickness={16}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-sm">
              {rows.map((r) => (
                <div key={r.key} className="flex items-center gap-2.5">
                  <span className="size-2.5 shrink-0 rounded-[4px]" style={{ background: r.color }} />
                  {r.type && <WalletTypeIcon type={r.type} className="size-3.5" />}
                  <span className={`min-w-0 flex-1 truncate font-semibold ${r.btc <= 0 ? 'text-muted-foreground' : ''}`}>
                    {r.name}{r.excluded && <span className="font-normal text-muted-foreground"> (excl.)</span>}
                  </span>
                  <span className={`font-bold tabular-nums ${r.btc <= 0 ? 'text-muted-foreground' : ''}`}>{formatBtc(r.btc, { withUnit: false, trim: true })}</span>
                </div>
              ))}
            </div>
          </div>
          {status && (
            <div className={`rounded-2xl px-3.5 py-3 text-[13px] font-semibold ${status.tone}`}>{status.text}</div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
