'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';
import { formatCurrency } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';

interface PortfolioMetrics {
  totalBtc: number;
  totalInvested: number;
  portfolioValue: number;
  currentBtcPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  roi: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  mainCurrency: string;
  portfolioChange24h: number;
  portfolioChange24hPercent: number;
  totalTransactions: number;
}

/**
 * Portfolio Summary Widget
 * Shows key portfolio metrics and performance
 */
export default function PortfolioSummaryWidget({ id, isEditMode, onRefresh }: WidgetProps) {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();

    // Subscribe to price updates
    const unsubscribe = BitcoinPriceClient.onPriceUpdate(() => {
      loadMetrics();
    });

    return unsubscribe;
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      if (result.success && result.data) {
        setMetrics(result.data);
      }
    } catch (error) {
      console.error('Error loading portfolio metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadMetrics();
    if (onRefresh) onRefresh();
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Portfolio Summary
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

  if (!metrics) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Portfolio Summary
          </h3>
        </div>
        <ThemedCard className="flex-1 flex items-center justify-center">
          <ThemedText variant="muted" className="text-sm">
            No portfolio data available
          </ThemedText>
        </ThemedCard>
      </div>
    );
  }

  const currency = metrics.mainCurrency;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Portfolio Summary
        </h3>
        <button
          onClick={handleRefresh}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xs p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          title="Refresh"
          disabled={loading}
        >
          ↻
        </button>
      </div>

      <ThemedCard className="flex-1 space-y-2.5 text-sm">
        {/* Total Holdings */}
        <div>
          <ThemedText variant="muted" className="text-xs mb-1">
            Total Holdings
          </ThemedText>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {(metrics.totalBtc || 0).toFixed(8)} ₿
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(metrics.portfolioValue || 0, currency)}
          </div>
        </div>

        {/* Total P&L (Unrealized + Realized) */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <ThemedText variant="muted" className="text-xs mb-1">
            Total P&L
          </ThemedText>
          <div className={`text-base font-bold ${
            (metrics.totalPnL || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {(metrics.totalPnL || 0) >= 0 ? '+' : ''}{formatCurrency(metrics.totalPnL || 0, currency)}
          </div>
          <div className={`text-xs ${
            (metrics.roi || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            ROI: {(metrics.roi || 0) >= 0 ? '+' : ''}{(metrics.roi || 0).toFixed(2)}%
          </div>
        </div>

        {/* Unrealized vs Realized */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-1">
            <ThemedText variant="muted" className="text-xs">
              Unrealized
            </ThemedText>
            <ThemedText className={`text-xs font-medium ${
              (metrics.unrealizedPnL || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {(metrics.unrealizedPnL || 0) >= 0 ? '+' : ''}{formatCurrency(metrics.unrealizedPnL || 0, currency)}
            </ThemedText>
          </div>
          <div className="flex justify-between items-center">
            <ThemedText variant="muted" className="text-xs">
              Realized
            </ThemedText>
            <ThemedText className={`text-xs font-medium ${
              (metrics.realizedPnL || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {(metrics.realizedPnL || 0) >= 0 ? '+' : ''}{formatCurrency(metrics.realizedPnL || 0, currency)}
            </ThemedText>
          </div>
        </div>

        {/* 24h Change */}
        {(metrics.portfolioChange24h || 0) !== 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <ThemedText variant="muted" className="text-xs mb-1">
              24h Change
            </ThemedText>
            <div className={`text-sm font-semibold ${
              (metrics.portfolioChange24h || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {(metrics.portfolioChange24h || 0) >= 0 ? '+' : ''}{formatCurrency(metrics.portfolioChange24h || 0, currency)}
              <span className="ml-1 text-xs">
                ({(metrics.portfolioChange24hPercent || 0) >= 0 ? '+' : ''}{(metrics.portfolioChange24hPercent || 0).toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {/* Price Info */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between mb-1">
            <ThemedText variant="muted" className="text-xs">
              Avg Buy
            </ThemedText>
            <ThemedText className="text-xs font-medium">
              {formatCurrency(metrics.avgBuyPrice || 0, currency)}
            </ThemedText>
          </div>
          <div className="flex justify-between">
            <ThemedText variant="muted" className="text-xs">
              Current
            </ThemedText>
            <ThemedText className="text-xs font-medium text-orange-600 dark:text-orange-400">
              {formatCurrency(metrics.currentBtcPrice || 0, currency)}
            </ThemedText>
          </div>
        </div>

        {/* Transaction Count */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <ThemedText variant="muted" className="text-xs">
              Total Transactions
            </ThemedText>
            <ThemedText className="text-xs font-medium">
              {metrics.totalTransactions || 0}
            </ThemedText>
          </div>
        </div>
      </ThemedCard>
    </div>
  );
}

