'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard } from '@/components/ui/widget-card';
import { RingChart } from '@/components/ui/ring-chart';
import { WidgetProps } from '@/lib/dashboard-types';
import { onTransactionsChanged } from '@/lib/app-events';
import Link from 'next/link';

interface DCAAnalysis {
  score: {
    overall: number;
    timing: number;
    consistency: number;
    performance: number;
  };
  timing?: {
    btcBoughtBelowCurrent: number;
    btcBoughtAboveCurrent: number;
  };
  consistency?: {
    totalPurchases: number;
    consistency: number;
  };
  summary?: {
    totalPnLPercent: number;
    avgBuyPrice: number;
  };
  currency?: string;
}

/**
 * DCA Analysis Widget
 * Shows Dollar Cost Averaging performance metrics
 */
export default function DCAAnalysisWidget({ id, onRefresh }: WidgetProps) {
  const [analysis, setAnalysis] = useState<DCAAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadAnalysis();
    return onTransactionsChanged(loadAnalysis);
  }, []);

  const loadAnalysis = async () => {
    setError('');
    
    try {
      const response = await fetch('/api/goals/dca-analysis');
      const result = await response.json();
      
      if (result.success && result.data) {
        setAnalysis(result.data);
      } else {
        setError(result.error || 'Failed to load DCA analysis');
      }
    } catch (err) {
      console.error('Error loading DCA analysis:', err);
      setError('Failed to load DCA analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalysis();
    setRefreshing(false);
    onRefresh?.();
  };

  // Score colour: red (poor) → orange (fair) → green (good)
  const scoreColor = (score: number) =>
    score >= 6 ? 'hsl(var(--chart-2))' : score >= 4 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))';
  const scoreTrack = (score: number) =>
    score >= 6 ? 'hsl(var(--tint-green))' : score >= 4 ? 'hsl(var(--tint-orange))' : 'hsl(var(--tint-red))';

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs consistency';
  };

  const rows = analysis ? [
    { label: 'Timing', value: analysis.score.timing.toFixed(1) },
    { label: 'Consistency', value: analysis.score.consistency.toFixed(1) },
    ...(analysis.consistency ? [{ label: 'Buys', value: String(analysis.consistency.totalPurchases) }] : []),
  ] : [];

  return (
    <WidgetCard
      title="DCA score"
      loading={loading}
      error={error || (!analysis ? "No DCA data available" : null)}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      contentClassName="overflow-auto"
    >
      {analysis && (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <div className="flex items-center gap-5">
            <RingChart
              segments={[{ value: analysis.score.overall, color: scoreColor(analysis.score.overall) }]}
              total={10}
              size={112}
              thickness={12}
              roundedCaps
              trackColor={scoreTrack(analysis.score.overall)}
            >
              <span className="text-[26px] font-extrabold tabular-nums">{analysis.score.overall.toFixed(1)}</span>
            </RingChart>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-sm">
              <span className="font-bold">{getScoreLabel(analysis.score.overall)}</span>
              {rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-4">
                  <span className="font-semibold text-muted-foreground">{r.label}</span>
                  <span className="font-bold tabular-nums">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <Link href="/goals" className="text-sm font-bold text-primary-strong hover:underline">
            {analysis.score.consistency < 5 ? 'Set up Auto DCA' : 'See the full analysis'}
          </Link>
        </div>
      )}
    </WidgetCard>
  );
}
