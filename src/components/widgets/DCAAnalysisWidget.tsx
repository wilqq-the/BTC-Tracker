'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';
import { WidgetProps } from '@/lib/dashboard-types';

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
export default function DCAAnalysisWidget({ id, isEditMode, onRefresh }: WidgetProps) {
  const [analysis, setAnalysis] = useState<DCAAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
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
    await loadAnalysis();
    if (onRefresh) onRefresh();
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 6) return 'text-blue-600 dark:text-blue-400';
    if (score >= 4) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            DCA Performance
          </h3>
        </div>
        <ThemedCard className="flex-1">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </ThemedCard>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            DCA Performance
          </h3>
          <button
            onClick={handleRefresh}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xs p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
        <ThemedCard className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ThemedText variant="muted" className="text-sm mb-2">
              {error || 'No DCA data available'}
            </ThemedText>
            <a
              href="/goals"
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              View DCA Analysis →
            </a>
          </div>
        </ThemedCard>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          DCA Performance
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xs p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
            disabled={loading}
          >
            ↻
          </button>
          <a
            href="/goals"
            className="text-orange-600 hover:text-orange-700 text-xs font-medium"
          >
            Full Analysis →
          </a>
        </div>
      </div>

      <ThemedCard className="flex-1 space-y-3">
        {/* Overall Score Bar */}
        <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <ThemedText variant="muted" className="text-xs">
              DCA Strategy Score
            </ThemedText>
            <div className={`text-2xl font-bold ${getScoreColor(analysis.score.overall)}`}>
              {analysis.score.overall.toFixed(1)}/10
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                analysis.score.overall >= 8 ? 'bg-green-500' :
                analysis.score.overall >= 6 ? 'bg-blue-500' :
                analysis.score.overall >= 4 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${(analysis.score.overall / 10) * 100}%` }}
            />
          </div>
          <ThemedText variant="muted" className="text-xs mt-1">
            {getScoreLabel(analysis.score.overall)} - Keep up the consistent buying!
          </ThemedText>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {/* Timing Score */}
          <div>
            <ThemedText variant="muted" className="text-xs mb-1">
              Timing Score
            </ThemedText>
            <div className="flex items-baseline space-x-2">
              <div className={`text-lg font-bold ${getScoreColor(analysis.score.timing)}`}>
                {analysis.score.timing.toFixed(1)}
              </div>
              {analysis.timing && (
                <ThemedText variant="muted" className="text-xs">
                  ({analysis.timing.btcBoughtBelowCurrent.toFixed(0)}% below)
                </ThemedText>
              )}
            </div>
          </div>

          {/* Consistency Score */}
          <div>
            <ThemedText variant="muted" className="text-xs mb-1">
              Consistency
            </ThemedText>
            <div className="flex items-baseline space-x-2">
              <div className={`text-lg font-bold ${getScoreColor(analysis.score.consistency)}`}>
                {analysis.score.consistency.toFixed(1)}
              </div>
              {analysis.consistency && (
                <ThemedText variant="muted" className="text-xs">
                  ({analysis.consistency.totalPurchases} buys)
                </ThemedText>
              )}
            </div>
          </div>

          {/* Performance */}
          <div>
            <ThemedText variant="muted" className="text-xs mb-1">
              Performance
            </ThemedText>
            <div className="flex items-baseline space-x-2">
              <div className={`text-lg font-bold ${getScoreColor(analysis.score.performance)}`}>
                {analysis.score.performance.toFixed(1)}
              </div>
              {analysis.summary && (
                <ThemedText 
                  className={`text-xs font-medium ${
                    analysis.summary.totalPnLPercent >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {analysis.summary.totalPnLPercent >= 0 ? '+' : ''}
                  {analysis.summary.totalPnLPercent.toFixed(1)}%
                </ThemedText>
              )}
            </div>
          </div>

          {/* Avg Buy Price */}
          {analysis.summary && (
            <div>
              <ThemedText variant="muted" className="text-xs mb-1">
                Avg Buy Price
              </ThemedText>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {analysis.currency === 'EUR' ? '€' : '$'}
                {analysis.summary.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          )}
        </div>
      </ThemedCard>
    </div>
  );
}

