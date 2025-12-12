'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard } from '@/components/ui/widget-card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';
import { WalletIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';

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
export default function PortfolioSummaryWidget({ id, onRefresh }: WidgetProps) {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
    onRefresh?.();
  };

  const currency = metrics?.mainCurrency || 'USD';

  return (
    <WidgetCard
      title="Portfolio Summary"
      icon={WalletIcon}
      loading={loading}
      error={!metrics ? "No portfolio data available" : null}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      contentClassName="overflow-auto"
    >
      {metrics && (
        <div className="space-y-3 text-sm flex-1">
          {/* Total Holdings */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Holdings</p>
            <div className="text-lg font-bold">{metrics.totalBtc.toFixed(8)} ₿</div>
            <div className="text-xs text-muted-foreground">{formatCurrency(metrics.portfolioValue, currency)}</div>
          </div>

          <Separator />

          {/* Total P&L */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
            <div className="flex items-center gap-2">
              {metrics.totalPnL >= 0 ? (
                <TrendingUpIcon className="size-4 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDownIcon className="size-4 text-red-600 dark:text-red-400" />
              )}
              <div className={`text-base font-bold ${
                metrics.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {metrics.totalPnL >= 0 ? '+' : ''}{formatCurrency(metrics.totalPnL, currency)}
              </div>
            </div>
            <div className={`text-xs ${
              metrics.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              ROI: {metrics.roi >= 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
            </div>
          </div>

          <Separator />

          {/* Unrealized vs Realized */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Unrealized</span>
              <span className={`text-xs font-medium ${
                metrics.unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {metrics.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(metrics.unrealizedPnL, currency)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Realized</span>
              <span className={`text-xs font-medium ${
                metrics.realizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {metrics.realizedPnL >= 0 ? '+' : ''}{formatCurrency(metrics.realizedPnL, currency)}
              </span>
            </div>
          </div>

          {/* 24h Change */}
          {metrics.portfolioChange24h !== 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">24h Change</p>
                <div className={`text-sm font-semibold ${
                  metrics.portfolioChange24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {metrics.portfolioChange24h >= 0 ? '+' : ''}{formatCurrency(metrics.portfolioChange24h, currency)}
                  <span className="ml-1 text-xs">
                    ({metrics.portfolioChange24hPercent >= 0 ? '+' : ''}{metrics.portfolioChange24hPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Price Info */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Avg Buy</span>
              <span className="text-xs font-medium">{formatCurrency(metrics.avgBuyPrice, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Current</span>
              <span className="text-xs font-medium text-btc-500">{formatCurrency(metrics.currentBtcPrice, currency)}</span>
            </div>
          </div>

          <Separator />

          {/* Transaction Count */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Total Transactions</span>
            <span className="text-xs font-medium">{metrics.totalTransactions}</span>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

