'use client';

import React from 'react';
import { CheckCircle2Icon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { formatCurrency } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SCENARIO_NAMES, ScenarioIcon, btc, pct, tone } from './planning-icons';
import { useBtcUnit } from '@/hooks/use-btc-unit';

export interface Goal {
  id: number;
  name: string;
  target_btc_amount: number;
  target_date: string;
  current_holdings: number;
  monthly_budget: number | null;
  currency: string;
  price_scenario: string;
  scenario_growth_rate: number;
  monthly_btc_needed: number;
  monthly_fiat_needed: number;
  total_fiat_needed: number;
  total_months: number;
  initial_btc_price: number;
  final_btc_price: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalRecalculation {
  goalId: number;
  original: any;
  current: any;
  projection: any;
  recommendations: any;
}

interface GoalCardProps {
  goal: Goal;
  recalc?: GoalRecalculation;
  currency: string;
  /** Converts an amount from another currency into `currency`; null if no rate */
  toDisplay?: (amount: number, from: string) => number | null;
  recalculating: boolean;
  onRecalculate: () => void;
  onDelete: () => void;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function GoalCard({ goal, recalc, currency, toDisplay, recalculating, onRecalculate, onDelete }: GoalCardProps) {
  const { formatBtc } = useBtcUnit();
  const current = recalc?.current;
  const projection = recalc?.projection;
  const progress = current ? Math.max(0, current.progress_percent || 0) : null;
  const growth = (goal.scenario_growth_rate || 0) * 100;
  const priceChange: number = current?.price_change_percent ?? 0;
  const monthlyChange: number = projection?.monthly_change_percent ?? 0;

  // The plan was saved in the currency of the day; show it in today's display
  // currency next to the live figures (fall back to the original if no rate)
  const planInDisplay = toDisplay?.(goal.monthly_fiat_needed, goal.currency) ?? null;
  const planMonthly = planInDisplay !== null
    ? formatCurrency(planInDisplay, currency)
    : formatCurrency(goal.monthly_fiat_needed, goal.currency);

  const tiles = [
    { label: 'Target', value: formatBtc(goal.target_btc_amount, { trim: true }), strong: true },
    { label: 'Target date', value: formatDate(goal.target_date) },
    { label: 'Each month', value: planMonthly },
    { label: 'Duration', value: `${goal.total_months} months` },
  ];

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <CardTitle className="truncate text-[17px] font-bold tracking-tight">{goal.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                <ScenarioIcon id={goal.price_scenario} className="size-3.5 text-muted-foreground" />
                {SCENARIO_NAMES[goal.price_scenario] || goal.price_scenario}
                <span className="font-medium text-muted-foreground">{pct(growth, 0)} a year</span>
              </span>
              {goal.is_completed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-tint-green px-2.5 py-1 text-xs font-semibold text-tint-green-fg">
                  <CheckCircle2Icon className="size-3.5" />
                  Reached
                </span>
              ) : current ? (
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    current.is_on_track ? 'bg-tint-green text-tint-green-fg' : 'bg-tint-orange text-primary-strong'
                  )}
                >
                  {current.is_on_track ? 'On track' : 'Behind'}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onRecalculate}
              disabled={recalculating}
              aria-label="Recalculate with today's price"
            >
              <RefreshCwIcon className={cn('size-4', recalculating && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete goal"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {progress !== null && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-muted-foreground">
                <span className="font-bold text-primary-strong">{formatBtc(current.current_holdings || 0, { trim: true, withUnit: false })}</span> of {formatBtc(goal.target_btc_amount, { trim: true })}
              </span>
              <span className="font-bold tabular-nums">{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl bg-secondary p-3">
              <dt className="text-[13px] font-semibold text-muted-foreground">{tile.label}</dt>
              <dd className={cn('mt-0.5 text-[15px] font-bold tabular-nums', tile.strong && 'text-primary-strong')}>
                {tile.value}
              </dd>
            </div>
          ))}
        </dl>

        {current && projection && !goal.is_completed && (
          <div className="space-y-2 border-t pt-4 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Bitcoin price now</span>
              <span className="text-right font-semibold tabular-nums">
                {formatCurrency(current.btc_price, currency)}{' '}
                <span className={cn('text-xs', tone(priceChange))}>{pct(priceChange)}</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Needed each month now</span>
              <span className="text-right font-semibold tabular-nums">
                {formatCurrency(projection.monthly_fiat_needed, currency)}{' '}
                {/* paying less each month is the good direction */}
                <span className={cn('text-xs', tone(-monthlyChange))}>{pct(monthlyChange, 0)}</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Months left</span>
              <span className="font-semibold tabular-nums">{current.remaining_months}</span>
            </div>
            {!current.is_on_track && recalc?.recommendations?.message && (
              <p className="pt-1 text-[13px] text-muted-foreground">{recalc.recommendations.message}</p>
            )}
          </div>
        )}

        {goal.is_completed && goal.completed_at && (
          <p className="text-sm text-muted-foreground">Reached on {formatDate(goal.completed_at)}.</p>
        )}
      </CardContent>
    </Card>
  );
}
