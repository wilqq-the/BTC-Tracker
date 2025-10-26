'use client';

import React, { useState } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from './ui/ThemeProvider';
import { formatCurrency } from '@/lib/theme';

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
        alert(data.error || 'Failed to run backtest');
      }
    } catch (error) {
      console.error('Backtest error:', error);
      alert('Error running backtest. Please try again.');
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
    <ThemedCard>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-btc-text-primary mb-1 flex items-center">
            <span className="mr-2">🔮</span>
            Historical DCA Backtest
          </h3>
          <ThemedText variant="muted" className="text-sm">
            Simulate a DCA strategy using real historical Bitcoin prices
          </ThemedText>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-btc-text-primary mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate}
              className="w-full px-3 py-2 bg-btc-bg-secondary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-btc-text-primary mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-btc-bg-secondary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
            />
          </div>

          {/* Investment Amount */}
          <div>
            <label className="block text-sm font-medium text-btc-text-primary mb-2">
              Investment Amount ({defaultCurrency})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              min={1}
              step={10}
              className="w-full px-3 py-2 bg-btc-bg-secondary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-btc-text-primary mb-2">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as DCAFrequency)}
              className="w-full px-3 py-2 bg-btc-bg-secondary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Run Button */}
        <ThemedButton
          onClick={runBacktest}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Running Backtest...' : 'Run Historical Backtest'}
        </ThemedButton>

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-4 border-t border-btc-border-primary">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-btc-bg-secondary rounded-lg p-3">
                <ThemedText variant="muted" className="text-xs mb-1">Total Invested</ThemedText>
                <div className="text-lg font-bold text-btc-text-primary">
                  {formatCurrency(result.totalInvested, defaultCurrency)}
                </div>
              </div>
              <div className="bg-btc-bg-secondary rounded-lg p-3">
                <ThemedText variant="muted" className="text-xs mb-1">Total BTC</ThemedText>
                <div className="text-lg font-bold text-bitcoin">
                  {result.totalBtc.toFixed(8)} ₿
                </div>
              </div>
              <div className="bg-btc-bg-secondary rounded-lg p-3">
                <ThemedText variant="muted" className="text-xs mb-1">Current Value</ThemedText>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(result.currentValue, defaultCurrency)}
                </div>
              </div>
              <div className="bg-btc-bg-secondary rounded-lg p-3">
                <ThemedText variant="muted" className="text-xs mb-1">ROI</ThemedText>
                <div className={`text-lg font-bold ${result.roiPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {result.roiPercent >= 0 ? '+' : ''}{result.roiPercent.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* DCA vs Lump Sum Comparison */}
            <div className="bg-btc-bg-secondary rounded-lg p-4">
              <h4 className="text-sm font-semibold text-btc-text-primary mb-3">
                💡 DCA vs. Lump Sum Comparison
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <ThemedText variant="secondary" className="text-sm">Your {getFrequencyLabel(frequency)} DCA:</ThemedText>
                  <div className="text-right">
                    <div className="font-semibold text-bitcoin">{result.totalBtc.toFixed(8)} ₿</div>
                    <div className="text-xs text-btc-text-secondary">{formatCurrency(result.currentValue, defaultCurrency)}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <ThemedText variant="secondary" className="text-sm">If you bought all on start date:</ThemedText>
                  <div className="text-right">
                    <div className="font-semibold text-btc-text-primary">{result.comparison.lumpSumBtc.toFixed(8)} ₿</div>
                    <div className="text-xs text-btc-text-secondary">{formatCurrency(result.comparison.lumpSumValue, defaultCurrency)}</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-btc-border-primary flex justify-between items-center">
                  <ThemedText variant="secondary" className="text-sm font-semibold">DCA Benefit:</ThemedText>
                  <div className={`text-sm font-bold ${result.comparison.dcaBenefit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
                <ThemedText variant="muted" className="text-xs mb-1">Total Purchases</ThemedText>
                <div className="text-sm font-semibold text-btc-text-primary">
                  {result.purchaseCount}
                </div>
              </div>
              <div>
                <ThemedText variant="muted" className="text-xs mb-1">Avg Buy Price</ThemedText>
                <div className="text-sm font-semibold text-btc-text-primary">
                  {formatCurrency(result.avgBuyPrice, defaultCurrency)}
                </div>
              </div>
              <div>
                <ThemedText variant="muted" className="text-xs mb-1">Best Price</ThemedText>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(result.summary.bestPurchasePrice, defaultCurrency)}
                </div>
              </div>
              <div>
                <ThemedText variant="muted" className="text-xs mb-1">Worst Price</ThemedText>
                <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                  {formatCurrency(result.summary.worstPurchasePrice, defaultCurrency)}
                </div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="bg-bitcoin/10 border border-bitcoin/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-btc-text-primary mb-2">Key Insights</h4>
                  <ul className="space-y-1 text-sm text-btc-text-secondary">
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
      </div>
    </ThemedCard>
  );
}

