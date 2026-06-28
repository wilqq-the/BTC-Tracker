'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/theme';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DCAFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

interface DCABacktestSimulatorProps {
  defaultCurrency?: string;
}

export default function DCABacktestSimulator({ defaultCurrency = 'USD' }: DCABacktestSimulatorProps) {
  const [startDate, setStartDate] = useState<string>('2020-01-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(100);
  const [frequency, setFrequency] = useState<DCAFrequency>('monthly');
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
      } else {
        toast({ title: 'Backtest failed', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Backtest error:', error);
      toast({ title: 'Backtest error', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getFrequencyLabel = (freq: DCAFrequency) => {
    switch (freq) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
    }
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center">
            <span className="mr-2">🔮</span>
            Historical DCA Backtest
          </h3>
          <p className="text-sm text-muted-foreground">
            Simulate a DCA strategy using real historical Bitcoin prices
          </p>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="dca-start-date">Start Date</Label>
            <Input
              id="dca-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate}
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="dca-end-date">End Date</Label>
            <Input
              id="dca-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Investment Amount */}
          <div className="space-y-2">
            <Label htmlFor="dca-amount">Investment Amount ({defaultCurrency})</Label>
            <Input
              id="dca-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              min={1}
              step={10}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="dca-frequency">Frequency</Label>
            <select
              id="dca-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as DCAFrequency)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Run Button */}
        <Button
          onClick={runBacktest}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Running Backtest...' : 'Run Historical Backtest'}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-4 border-t border-border">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-2xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
                <div className="text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(result.totalInvested, defaultCurrency)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Total BTC</p>
                <div className="text-lg font-bold text-primary tabular-nums">
                  {result.totalBtc.toFixed(8)} ₿
                </div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                <div className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                  {formatCurrency(result.currentValue, defaultCurrency)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-3">
                <p className="text-xs text-muted-foreground mb-1">ROI</p>
                <div className={`text-lg font-bold tabular-nums ${result.roiPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {result.roiPercent >= 0 ? '+' : ''}{result.roiPercent.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* DCA vs Lump Sum Comparison */}
            <div className="bg-muted/50 rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                💡 DCA vs. Lump Sum Comparison
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Your {getFrequencyLabel(frequency)} DCA:</span>
                  <div className="text-right">
                    <div className="font-semibold text-primary tabular-nums">{result.totalBtc.toFixed(8)} ₿</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{formatCurrency(result.currentValue, defaultCurrency)}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">If you bought all on start date:</span>
                  <div className="text-right">
                    <div className="font-semibold text-foreground tabular-nums">{result.comparison.lumpSumBtc.toFixed(8)} ₿</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{formatCurrency(result.comparison.lumpSumValue, defaultCurrency)}</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-border flex justify-between items-center">
                  <span className="text-sm font-semibold text-muted-foreground">DCA Benefit:</span>
                  <div className={`text-sm font-bold tabular-nums ${result.comparison.dcaBenefit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {result.comparison.dcaBenefit >= 0 ? '+' : ''}{formatCurrency(Math.abs(result.comparison.dcaBenefit), defaultCurrency)}
                    <span className="text-xs ml-1">
                      ({result.comparison.dcaBenefitPercent >= 0 ? '+' : ''}{result.comparison.dcaBenefitPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Purchases</p>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {result.purchaseCount}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Avg Buy Price</p>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {formatCurrency(result.avgBuyPrice, defaultCurrency)}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Best Price</p>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums">
                  {formatCurrency(result.summary.bestPurchasePrice, defaultCurrency)}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Worst Price</p>
                <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 tabular-nums">
                  {formatCurrency(result.summary.worstPurchasePrice, defaultCurrency)}
                </div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="bg-primary/5 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-2">Key Insights</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• You made {result.purchaseCount} purchases over {result.summary.totalDays} days</li>
                    <li>• Average interval: {result.summary.averageInterval.toFixed(0)} days between purchases</li>
                    <li>• Your profit/loss: {result.roi >= 0 ? '+' : ''}{formatCurrency(result.roi, defaultCurrency)} ({result.roiPercent >= 0 ? '+' : ''}{result.roiPercent.toFixed(2)}%)</li>
                    <li>• {result.comparison.dcaBenefit >= 0
                      ? `DCA performed ${formatCurrency(result.comparison.dcaBenefit, defaultCurrency)} better than lump sum`
                      : `Lump sum would have performed ${formatCurrency(Math.abs(result.comparison.dcaBenefit), defaultCurrency)} better`
                    }</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
