'use client';

import React, { useState } from 'react';
import { HistoryIcon, RefreshCwIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/theme';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WidgetEmptyState } from '@/components/ui/widget-card';
import { btc, pct, sign, tone } from '@/components/planning/planning-icons';

type DCAFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

const FREQUENCY_OPTIONS: { label: string; value: DCAFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Every 2 weeks', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
];

const FREQUENCY_NOUN: Record<DCAFrequency, string> = {
  daily: 'daily',
  weekly: 'weekly',
  biweekly: 'fortnightly',
  monthly: 'monthly',
};

interface DCABacktestSimulatorProps {
  defaultCurrency?: string;
}

export default function DCABacktestSimulator({ defaultCurrency = 'USD' }: DCABacktestSimulatorProps) {
  const [startDate, setStartDate] = useState<string>('2020-01-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(100);
  const [frequency, setFrequency] = useState<DCAFrequency>('monthly');
  const [ranFrequency, setRanFrequency] = useState<DCAFrequency>('monthly');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runBacktest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/dca-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          investmentAmount: amount,
          frequency,
          currency: defaultCurrency
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        setRanFrequency(frequency);
      } else {
        toast({ title: 'Backtest failed', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Backtest error:', error);
      toast({ title: 'Backtest failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const money = (n: number) => formatCurrency(Math.abs(n), defaultCurrency);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[17px] font-bold tracking-tight">Backtest a DCA plan</CardTitle>
          <CardDescription className="text-[13px]">
            See how buying a fixed amount on a schedule would have worked out, using real historical prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dca-start-date" className="text-sm font-bold">Start date</Label>
              <Input
                id="dca-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dca-end-date" className="text-sm font-bold">End date</Label>
              <Input
                id="dca-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dca-amount" className="text-sm font-bold">
                Amount per purchase <span className="font-medium text-muted-foreground">({defaultCurrency})</span>
              </Label>
              <Input
                id="dca-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                min={1}
                step={10}
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-bold">How often</span>
            <SegmentedControl<DCAFrequency>
              aria-label="How often to buy"
              options={FREQUENCY_OPTIONS}
              value={frequency}
              onChange={setFrequency}
            />
          </div>

          <Button onClick={runBacktest} disabled={loading} className="h-11 w-full rounded-full font-bold">
            {loading ? (
              <><RefreshCwIcon className="size-4 animate-spin" /> Running backtest...</>
            ) : (
              'Run backtest'
            )}
          </Button>

          {!result && !loading && (
            <div className="flex rounded-2xl bg-secondary py-8">
              <WidgetEmptyState
                icon={HistoryIcon}
                title="Results appear here"
                description="You'll see how much bitcoin the plan would have bought, what it's worth today, and how it compares with investing everything on the start date."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {result && renderResult(result)}
    </div>
  );

  function renderResult(r: any) {
    const benefit: number = r.comparison.dcaBenefit;
    const tiles = [
      { label: 'Invested', value: money(r.totalInvested) },
      { label: 'Bitcoin bought', value: `${btc(r.totalBtc)} BTC`, className: 'text-primary-strong' },
      { label: 'Profit or loss', value: `${sign(r.roi)}${money(r.roi)}`, className: tone(r.roi) },
      { label: 'Purchases', value: String(r.purchaseCount) },
    ];
    const prices = [
      { label: 'Average price', value: money(r.avgBuyPrice) },
      { label: 'Lowest price', value: money(r.summary.bestPurchasePrice) },
      { label: 'Highest price', value: money(r.summary.worstPurchasePrice) },
    ];

    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[17px] font-bold tracking-tight">Results</CardTitle>
          <CardDescription className="text-[13px]">
            {r.purchaseCount} {FREQUENCY_NOUN[ranFrequency]} purchases over {r.summary.totalDays} days, about every{' '}
            {Math.max(1, Math.round(r.summary.averageInterval || 0))} days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Headline */}
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold text-muted-foreground">Worth today</span>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-extrabold leading-none tracking-tight tabular-nums">{money(r.currentValue)}</span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
                  r.roiPercent > 0 ? 'bg-tint-green text-tint-green-fg' : r.roiPercent < 0 ? 'bg-tint-red text-tint-red-fg' : 'bg-secondary text-muted-foreground'
                )}
              >
                {pct(r.roiPercent)}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-secondary p-4">
                <dt className="text-[13px] font-semibold text-muted-foreground">{tile.label}</dt>
                <dd className={cn('mt-1 text-lg font-extrabold tabular-nums', tile.className)}>{tile.value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* DCA vs lump sum */}
            <div className="space-y-3 rounded-2xl bg-secondary p-4">
              <h3 className="text-sm font-bold">Compared with buying it all at once</h3>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Buying {FREQUENCY_NOUN[ranFrequency]}</span>
                <span className="text-right">
                  <span className="font-bold tabular-nums">{btc(r.totalBtc)} BTC</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">{money(r.currentValue)}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Everything on the start date</span>
                <span className="text-right">
                  <span className="font-bold tabular-nums">{btc(r.comparison.lumpSumBtc)} BTC</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">{money(r.comparison.lumpSumValue)}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t pt-3 text-sm">
                <span className="font-semibold">
                  {benefit > 0 ? 'DCA came out ahead' : benefit < 0 ? 'Lump sum came out ahead' : 'Both came out the same'}
                </span>
                <span className={cn('font-bold tabular-nums', tone(benefit))}>
                  {sign(benefit)}{money(benefit)}{' '}
                  <span className="text-xs font-semibold">{pct(r.comparison.dcaBenefitPercent)}</span>
                </span>
              </div>
            </div>

            {/* Prices paid */}
            <div className="space-y-3 rounded-2xl bg-secondary p-4">
              <h3 className="text-sm font-bold">Prices you would have paid</h3>
              {prices.map((p) => (
                <div key={p.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-bold tabular-nums">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
}
