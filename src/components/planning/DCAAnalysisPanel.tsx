'use client';

import React from 'react';
import { AlertCircleIcon, BarChart3Icon, RefreshCwIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RingChart } from '@/components/ui/ring-chart';
import { WidgetEmptyState } from '@/components/ui/widget-card';
import { PlanningIcon, btc, pct, sentenceCase, sign, tone } from './planning-icons';

export interface DCAAnalysisResult {
  score: {
    overall: number;
    timing: number;
    consistency: number;
    performance: number;
  };
  timing: {
    btcBoughtBelowCurrent: number;
    btcBoughtAboveCurrent: number;
    bestPurchasePrice: number;
    worstPurchasePrice: number;
    bestPurchaseDate: string;
    worstPurchaseDate: string;
    avgPurchasePrice: number;
    currentPrice: number;
    priceImprovement: number;
  };
  consistency: {
    avgDaysBetweenPurchases: number;
    consistency: number;
    longestGap: number;
    longestGapStart: string | null;
    longestGapEnd: string | null;
    recentActivity: number;
    totalPurchases: number;
    missedMonths: number;
  };
  priceDistribution: Array<{
    range: string;
    btcAmount: number;
    percentage: number;
    transactions: number;
  }>;
  whatIfScenarios: Array<{
    name: string;
    description: string;
    totalInvested: number;
    btcHoldings: number;
    currentValue: number;
    pnl: number;
    pnlPercentage: number;
    difference: number;
  }>;
  monthlyBreakdown: Array<{
    month: string;
    totalInvested: number;
    btcPurchased: number;
    avgPrice: number;
    transactions: number;
    missed: boolean;
  }>;
  recommendations: Array<{
    type: string;
    icon: string;
    message: string;
  }>;
  summary: {
    totalInvested: number;
    totalBtc: number;
    avgBuyPrice: number;
    currentPrice: number;
    currentValue: number;
    totalPnL: number;
    totalPnLPercent: number;
  };
  currency?: string;
}

interface DCAAnalysisPanelProps {
  analysis: DCAAnalysisResult | null;
  loading: boolean;
  error: string;
  currency: string;
  onRefresh: () => void;
}

const scoreColor = (score: number) =>
  score >= 6 ? 'hsl(var(--chart-2))' : score >= 4 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))';
const scoreTrack = (score: number) =>
  score >= 6 ? 'hsl(var(--tint-green))' : score >= 4 ? 'hsl(var(--tint-orange))' : 'hsl(var(--tint-red))';
const scoreLabel = (score: number) =>
  score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Room to improve' : 'Needs work';

const insightTone: Record<string, string> = {
  success: 'text-tint-green-fg',
  warning: 'text-primary-strong',
  info: 'text-muted-foreground',
  tip: 'text-muted-foreground',
};

export default function DCAAnalysisPanel({ analysis, loading, error, currency, onRefresh }: DCAAnalysisPanelProps) {
  const money = (n: number) => formatCurrency(Math.abs(n), analysis?.currency || currency);
  const hasPurchases = !!analysis && (analysis.consistency?.totalPurchases ?? 0) > 0;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-sm text-muted-foreground">How well-timed and regular your purchases have been.</p>
      <Button variant="outline" size="sm" className="rounded-full bg-card font-semibold" onClick={onRefresh} disabled={loading}>
        <RefreshCwIcon className={cn('size-4', loading && 'animate-spin')} />
        Refresh
      </Button>
    </div>
  );

  if (!analysis) {
    return (
      <div className="space-y-4">
        {toolbar}
        <Card className="rounded-2xl">
          <CardContent className="py-10">
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
                <p className="text-sm text-muted-foreground">Analysing your purchases...</p>
              </div>
            ) : (
              <WidgetEmptyState
                icon={AlertCircleIcon}
                title="The analysis couldn't load"
                description={error ? `${error}. Try again in a moment.` : 'Try again in a moment.'}
                action={<Button variant="outline" size="sm" className="rounded-full" onClick={onRefresh}>Try again</Button>}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasPurchases) {
    return (
      <div className="space-y-4">
        {toolbar}
        <Card className="rounded-2xl">
          <CardContent className="py-10">
            <WidgetEmptyState
              icon={BarChart3Icon}
              title="Nothing to analyse yet"
              description="Once you add a few purchases, you'll see how well-timed and regular your buying has been."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { score, timing, consistency, summary } = analysis;
  const overall = score.overall || 0;
  const below = timing?.btcBoughtBelowCurrent || 0;
  const pnlPercent = summary?.totalPnLPercent || 0;

  const subScores = [
    {
      label: 'Timing',
      value: score.timing || 0,
      detail: `${below.toFixed(0)}% of your bitcoin was bought below its 7-day average.`,
    },
    {
      label: 'Consistency',
      value: score.consistency || 0,
      detail:
        consistency.totalPurchases < 2
          ? 'One purchase so far. Regular buys raise this score.'
          : `${consistency.totalPurchases} purchases, about ${Math.max(1, Math.round(consistency.avgDaysBetweenPurchases || 0))} days apart on average.`,
    },
    {
      label: 'Performance',
      value: score.performance || 0,
      detail: (
        <>
          Your purchases are{' '}
          <span className={cn('font-semibold', tone(pnlPercent))}>{pct(pnlPercent)}</span>{' '}
          against today&apos;s price.
        </>
      ),
    },
  ];

  // The first insight always restates the overall score, which the ring already shows
  const insights = (analysis.recommendations || []).slice(1);

  return (
    <div className="space-y-4">
      {toolbar}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Score */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-tight">DCA score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
              <RingChart
                segments={[{ value: overall, color: scoreColor(overall) }]}
                total={10}
                size={128}
                thickness={13}
                roundedCaps
                trackColor={scoreTrack(overall)}
              >
                <div className="text-center leading-none">
                  <div className="text-[30px] font-extrabold tracking-tight tabular-nums">{overall.toFixed(1)}</div>
                  <div className="mt-1 text-xs font-semibold text-muted-foreground">out of 10</div>
                </div>
              </RingChart>
              <span className="text-[15px] font-bold">{scoreLabel(overall)}</span>
            </div>
            <dl className="flex min-w-0 flex-1 flex-col gap-4">
              {subScores.map((row) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm font-bold">{row.label}</dt>
                    <dd className="text-sm font-bold tabular-nums">
                      {row.value.toFixed(1)}
                      <span className="font-semibold text-muted-foreground"> / 10</span>
                    </dd>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{row.detail}</p>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-tight">What stands out</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing unusual. Keep buying on your schedule.</p>
            ) : (
              <ul className="space-y-3">
                {insights.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <PlanningIcon
                      name={item.icon}
                      className={cn('mt-0.5 size-4 shrink-0', insightTone[item.type] || 'text-muted-foreground')}
                    />
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* What-if */}
        {analysis.whatIfScenarios?.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[17px] font-bold tracking-tight">What-if scenarios</CardTitle>
              <CardDescription className="text-[13px]">The same money, invested differently.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {analysis.whatIfScenarios.map((scenario, index) => (
                <div key={index} className="flex items-center justify-between gap-4 rounded-2xl bg-secondary p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{sentenceCase(scenario.name)}</p>
                    <p className="truncate text-xs text-muted-foreground">{scenario.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('text-sm font-bold tabular-nums', tone(scenario.pnl))}>
                      {sign(scenario.pnl)}{money(scenario.pnl)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {pct(scenario.pnlPercentage)} with {btc(scenario.btcHoldings)} BTC
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Distribution */}
        {analysis.priceDistribution?.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[17px] font-bold tracking-tight">Purchase distribution</CardTitle>
              <CardDescription className="text-[13px]">Share of your bitcoin bought in each price range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.priceDistribution.map((range, index) => {
                const empty = range.transactions === 0;
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className={cn('font-semibold', empty && 'text-muted-foreground')}>{range.range}</span>
                      <span className="flex items-baseline gap-3 tabular-nums">
                        <span className="text-muted-foreground">
                          {range.transactions} {range.transactions === 1 ? 'purchase' : 'purchases'}
                        </span>
                        <span className={cn('w-12 text-right font-bold', empty && 'text-muted-foreground')}>
                          {(range.percentage || 0) > 0 && (range.percentage || 0) < 0.1 ? '<0.1' : (range.percentage || 0).toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${range.percentage || 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
