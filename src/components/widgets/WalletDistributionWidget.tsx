'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard } from '@/components/ui/widget-card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { WidgetProps } from '@/lib/dashboard-types';
import { ShieldCheckIcon, WalletIcon, ServerIcon } from 'lucide-react';

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

// Colour palette for individual wallet bars (cycles through these)
const WALLET_COLORS = [
  'bg-blue-500',
  'bg-btc-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-rose-500',
];

/**
 * Wallet Distribution Widget
 * Shows per-wallet BTC breakdown and overall cold/hot security status.
 */
export default function WalletDistributionWidget({ id, onRefresh }: WidgetProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWalletData();
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

  // Determine security status based on cold wallet %
  const getSecurityStatus = () => {
    if (!walletData) return { text: 'Unknown', color: 'text-muted-foreground', variant: 'secondary' as const };
    if (walletData.coldPercentage >= 80) return { text: 'Excellent', color: 'text-green-600 dark:text-green-400', variant: 'default' as const };
    if (walletData.coldPercentage >= 50) return { text: 'Good', color: 'text-blue-600 dark:text-blue-400', variant: 'default' as const };
    if (walletData.coldPercentage >= 20) return { text: 'Fair', color: 'text-btc-500', variant: 'secondary' as const };
    return { text: 'Consider Cold Storage', color: 'text-red-600 dark:text-red-400', variant: 'destructive' as const };
  };

  const status = getSecurityStatus();

  // Decide which view to render: named wallets (new) or legacy cold/hot totals
  const hasNamedWallets = walletData && walletData.walletBreakdown.length > 0;

  return (
    <WidgetCard
      title="Wallet Distribution"
      icon={ShieldCheckIcon}
      badge={<Badge variant={status.variant}>{status.text}</Badge>}
      loading={loading}
      error={!walletData ? 'No wallet data available' : null}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      contentClassName="overflow-auto"
    >
      {walletData && (
        <div className="space-y-4 flex-1">
          {/* Visual Distribution Bar */}
          <div>
            <div className="h-3 bg-muted rounded-full overflow-hidden flex">
              {hasNamedWallets ? (
                // Segmented bar: one segment per wallet
                walletData.walletBreakdown
                  .filter(w => w.includeInPortfolio && w.btcBalance > 0)
                  .map((w, i) => (
                    <div
                      key={w.id}
                      className={`${WALLET_COLORS[i % WALLET_COLORS.length]} transition-all duration-300`}
                      style={{ width: `${(w.btcBalance / walletData.totalBtc) * 100}%` }}
                      title={`${w.name}: ${w.btcBalance.toFixed(8)} ₿`}
                    />
                  ))
              ) : (
                // Legacy two-colour bar
                <>
                  <div
                    className="bg-blue-500 transition-all duration-300"
                    style={{ width: `${walletData.coldPercentage}%` }}
                    title="Cold Wallet"
                  />
                  <div
                    className="bg-btc-500 transition-all duration-300"
                    style={{ width: `${100 - walletData.coldPercentage}%` }}
                    title="Hot Wallet"
                  />
                </>
              )}
            </div>
          </div>

          {/* Wallet Breakdown */}
          <div className="space-y-2">
            {hasNamedWallets ? (
              // Named wallets list
              walletData.walletBreakdown.map((w, i) => {
                const pct = walletData.totalBtc > 0 ? (w.btcBalance / walletData.totalBtc) * 100 : 0;
                const colorClass = WALLET_COLORS[i % WALLET_COLORS.length];
                return (
                  <div key={w.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`size-3 rounded-full shrink-0 ${colorClass}`} />
                      <span className="text-sm">{w.emoji || (w.type === 'cold' ? '❄️' : '🔥')}</span>
                      <span className="text-sm font-medium truncate">{w.name}</span>
                      {!w.includeInPortfolio && (
                        <span className="text-xs text-muted-foreground">(excl.)</span>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-sm font-bold">{w.btcBalance.toFixed(8)} ₿</div>
                      <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })
            ) : (
              // Legacy cold / hot rows
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-blue-500 shrink-0" />
                    <ServerIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Cold Wallet</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{walletData.coldWalletBtc.toFixed(8)} ₿</div>
                    <p className="text-xs text-muted-foreground">{walletData.coldPercentage.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-btc-500 shrink-0" />
                    <WalletIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Hot Wallet</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{Math.abs(walletData.hotWalletBtc).toFixed(8)} ₿</div>
                    <p className="text-xs text-muted-foreground">{Math.abs(100 - walletData.coldPercentage).toFixed(1)}%</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Security Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Security Status</span>
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4" />
              <span className={`text-sm font-semibold ${status.color}`}>{status.text}</span>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
