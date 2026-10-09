'use client';

import React from 'react';
import { WidgetCard } from '@/components/ui/widget-card';
import { WidgetProps } from '@/lib/dashboard-types';
import { usePortfolioMetrics } from '@/hooks/use-portfolio-metrics';
import { cn } from '@/lib/utils';
import { useBtcUnit } from '@/hooks/use-btc-unit';

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
          {MILESTONES.map((m) => {
            const isReached = btc >= m.amount;
            const isCurrent = m === current;
            return (
              <div
                key={m.label}
                className={cn(
                  'rounded-2xl px-2 py-3 text-center',
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
