'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard, WidgetEmptyState } from '@/components/ui/widget-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { WidgetProps } from '@/lib/dashboard-types';
import { TrendingUpIcon, TargetIcon, ExternalLinkIcon } from 'lucide-react';
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 6) return 'text-blue-600 dark:text-blue-400';
    if (score >= 4) return 'text-btc-500';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-blue-500';
    if (score >= 4) return 'bg-btc-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  return (
    <WidgetCard
      title="DCA Performance"
      icon={TargetIcon}
      badge={
        analysis && (
          <Badge variant={analysis.score.overall >= 6 ? "default" : "secondary"}>
            {analysis.score.overall.toFixed(1)}/10
          </Badge>
        )
      }
      loading={loading}
      error={error || (!analysis ? "No DCA data available" : null)}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      contentClassName="overflow-auto"
    >
      {analysis && (
        <div className="space-y-3 flex-1">
          {/* Overall Score Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">DCA Strategy Score</span>
              <div className={`text-2xl font-bold ${getScoreColor(analysis.score.overall)}`}>
                {analysis.score.overall.toFixed(1)}/10
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className={`h-2 rounded-full transition-all ${getScoreBgColor(analysis.score.overall)}`}
                style={{ width: `${(analysis.score.overall / 10) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {getScoreLabel(analysis.score.overall)} - Keep up the consistent buying!
            </p>
          </div>

          <Separator />

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Timing Score */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Timing</p>
              <div className="flex items-baseline gap-2">
                <div className={`text-lg font-bold ${getScoreColor(analysis.score.timing)}`}>
                  {analysis.score.timing.toFixed(1)}
                </div>
                {analysis.timing && (
                  <span className="text-xs text-muted-foreground">
                    ({analysis.timing.btcBoughtBelowCurrent.toFixed(0)}% below)
                  </span>
                )}
              </div>
            </div>

            {/* Consistency Score */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Consistency</p>
              <div className="flex items-baseline gap-2">
                <div className={`text-lg font-bold ${getScoreColor(analysis.score.consistency)}`}>
                  {analysis.score.consistency.toFixed(1)}
                </div>
                {analysis.consistency && (
                  <span className="text-xs text-muted-foreground">
                    ({analysis.consistency.totalPurchases} buys)
                  </span>
                )}
              </div>
            </div>

            {/* Performance */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Performance</p>
              <div className="flex items-baseline gap-2">
                <div className={`text-lg font-bold ${getScoreColor(analysis.score.performance)}`}>
                  {analysis.score.performance.toFixed(1)}
                </div>
                {analysis.summary && (
                  <span className={`text-xs font-medium ${
                    analysis.summary.totalPnLPercent >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {analysis.summary.totalPnLPercent >= 0 ? '+' : ''}
                    {analysis.summary.totalPnLPercent.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Avg Buy Price */}
            {analysis.summary && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Avg Buy</p>
                <div className="text-lg font-bold text-btc-500">
                  {analysis.currency === 'EUR' ? '€' : '$'}
                  {analysis.summary.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Full Analysis Link */}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/goals">
              View Full Analysis
              <ExternalLinkIcon className="size-3.5 ml-2" />
            </Link>
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}
