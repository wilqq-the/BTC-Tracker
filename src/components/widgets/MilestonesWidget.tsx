'use client';

import React, { useEffect, useState } from 'react';
import { WidgetCard } from '@/components/ui/widget-card';
import { WidgetProps } from '@/lib/dashboard-types';
import { usePortfolioMetrics } from '@/hooks/use-portfolio-metrics';
import { cn } from '@/lib/utils';
import { useBtcUnit } from '@/hooks/use-btc-unit';

const SEEN_KEY = 'btc-tracker-milestones-seen';

const MILESTONES = [
  { amount: 0.001, label: 'Satoshi Starter' },
  { amount: 0.01, label: 'Bitcoin Believer' },
  { amount: 0.1, label: 'HODLer' },
  { amount: 0.5, label: 'Half-Coiner' },
  { amount: 1, label: 'Whole Coiner' },
  { amount: 10, label: 'Bitcoin Whale' },
];

/**
 * HODL Milestones Widget
 * Stacking progress as a row of chips that pop in; the current rank is
 * highlighted and the next one shows how far there is to go.
 */
export default function MilestonesWidget(_props: WidgetProps) {
  const { formatBtc } = useBtcUnit();
  const { metrics, loading } = usePortfolioMetrics();
  const btc = metrics?.totalBtc ?? 0;

  const reached = MILESTONES.filter((m) => btc >= m.amount).length;

  // Milestones reached since this device last saw the widget get one small
  // celebration. The first visit only records where you are.
  const [celebrateFrom, setCelebrateFrom] = useState<number | null>(null);
  useEffect(() => {
    if (loading || !metrics) return;
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      const seen = raw === null ? null : Number(raw);
      if (seen !== null && reached > seen) setCelebrateFrom(seen);
      localStorage.setItem(SEEN_KEY, String(reached));
    } catch {
      // storage unavailable: no celebration, nothing breaks
    }
  }, [loading, metrics, reached]);

  const current = MILESTONES[reached - 1];
  const next = MILESTONES[reached];
  const progress = next ? Math.min(100, (btc / next.amount) * 100) : 100;

  const subtitle = !current
    ? `${formatBtc(MILESTONES[0].amount - btc)} to go until your first milestone.`
    : next
      ? `${current.label}. ${formatBtc(next.amount - btc)} to go until ${next.label}.`
      : `All ${MILESTONES.length} reached. You're a ${current.label}.`;

  return (
    <WidgetCard title="HODL milestones" description={metrics ? subtitle : undefined} loading={loading}>
      <div className="flex flex-1 flex-col justify-between gap-3">
        <div className="grid grid-cols-3 gap-2">
          {MILESTONES.map((m, i) => {
            const isReached = btc >= m.amount;
            const isCurrent = m === current;
            const isNew = celebrateFrom !== null && isReached && i >= celebrateFrom;
            return (
              <div
                key={m.label}
                title={isReached ? `${m.label}: reached` : `${m.label}: ${formatBtc(m.amount - btc)} to go`}
                style={isNew ? { animationDelay: `${600 + (i - celebrateFrom!) * 200}ms` } : undefined}
                className={cn(
                  'rounded-2xl px-2 py-3 text-center transition-transform duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] hover:-translate-y-0.5 hover:scale-[1.06]',
                  isNew && 'animate-celebrate',
                  isCurrent
                    ? 'bg-tint-orange text-primary-strong ring-2 ring-inset ring-primary'
                    : isReached
                      ? 'bg-tint-green text-tint-green-fg'
                      : 'bg-secondary text-muted-foreground'
                )}
              >
                <div className="text-sm font-extrabold tabular-nums">{m.amount}</div>
                <div className="mt-0.5 truncate text-xs font-semibold">{m.label.replace('Bitcoin ', '')}</div>
              </div>
            );
          })}
        </div>
        {next && (
          <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-label={`${progress.toFixed(0)}% to ${next.label}`}>
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
