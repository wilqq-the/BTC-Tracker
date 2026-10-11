'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WidgetProps } from '@/lib/dashboard-types';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';
import { formatCurrency } from '@/lib/theme';
import { usePortfolioMetrics } from '@/hooks/use-portfolio-metrics';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

/**
 * BTC Price Widget
 * A dark, compact live ticker. The price glides to each new value and the
 * 24h chip pops whenever an update lands.
 */
export default function BtcPriceWidget(_props: WidgetProps) {
  const { metrics, currency, rate } = usePortfolioMetrics();
  const [changePercent, setChangePercent] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const lastPrice = useRef<number | null>(null);

  useEffect(() => {
    const apply = (price: { price: number; priceChangePercent24h?: number }) => {
      setChangePercent(price.priceChangePercent24h ?? 0);
      if (lastPrice.current !== null && lastPrice.current !== price.price) setTick((t) => t + 1);
      lastPrice.current = price.price;
    };
    BitcoinPriceClient.getCurrentPrice().then(apply).catch(() => {});
    return BitcoinPriceClient.onPriceUpdate(apply);
  }, []);

  const price = useCountUp(metrics ? metrics.currentBtcPrice * rate : 0, { duration: 1000 });
  const isUp = (changePercent ?? 0) >= 0;

  return (
    <div className="h-full rounded-2xl bg-[hsl(24_10%_10%)] dark:bg-[hsl(24_8%_14%)] text-white shadow-md flex items-center gap-4 px-6 py-4 overflow-hidden">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-[22px] font-extrabold text-primary-foreground">
        ₿
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
          Bitcoin price
          <span className="size-2 rounded-full bg-green-500 animate-live-pulse" aria-label="Live" />
        </div>
        <div className="truncate text-[26px] font-extrabold tracking-tight tabular-nums">
          {metrics ? formatCurrency(price, currency) : '—'}
        </div>
      </div>
      {changePercent !== null && (
        <span
          key={tick}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold',
            tick > 0 && 'animate-pop',
            isUp ? 'bg-green-900/80 text-green-200' : 'bg-red-900/80 text-red-200'
          )}
        >
          {isUp ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      )}
    </div>
  );
}
