'use client';

import React from 'react';
import BitcoinChart from '@/components/BitcoinChart';
import { WidgetProps } from '@/lib/dashboard-types';
import { formatCurrency } from '@/lib/theme';
import { usePortfolioMetrics } from '@/hooks/use-portfolio-metrics';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

/**
 * Portfolio Hero Widget
 * The dashboard's headline: portfolio value counting up, all-time P&L,
 * and the BTC price chart (with your buys) drawing itself in underneath.
 */
export default function PortfolioHeroWidget(_props: WidgetProps) {
  const { metrics, currency, rate } = usePortfolioMetrics();
  const value = useCountUp(metrics ? metrics.portfolioValue * rate : 0);

  const pnl = (metrics?.totalPnL ?? 0) * rate;
  const roi = metrics?.roi ?? 0;
  const isUp = pnl >= 0;
  const hasSecondary = !!metrics?.secondaryCurrency && metrics.secondaryCurrency !== metrics.mainCurrency;

  const header = (
    <div className="flex flex-col gap-2.5 min-w-0">
      <span className="text-[15px] font-semibold text-muted-foreground">Your portfolio</span>
      <span className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-[-0.04em] leading-none tabular-nums">
        {metrics ? formatCurrency(value, currency) : <span className="inline-block h-12 w-72 max-w-full rounded-2xl bg-secondary animate-pulse" />}
      </span>
      {metrics && (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cn(
            'rounded-full px-3 py-1.5 text-sm font-bold animate-pop [animation-delay:1300ms]',
            isUp ? 'bg-tint-green text-tint-green-fg' : 'bg-tint-red text-tint-red-fg'
          )}>
            {isUp ? '+' : '-'}{formatCurrency(Math.abs(pnl), currency)} ({isUp ? '+' : '-'}{Math.abs(roi).toFixed(2)}%) all time
          </span>
          <span className="text-sm text-muted-foreground">
            {metrics.totalBtc.toFixed(8)} BTC
            {hasSecondary && <>, {formatCurrency(metrics.portfolioValue, metrics.mainCurrency)}</>}
          </span>
        </div>
      )}
    </div>
  );

  return <BitcoinChart headerLeft={header} showStats={false} showTransactions compact />;
}
