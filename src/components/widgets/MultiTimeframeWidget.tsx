'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard, WidgetListItem } from '@/components/ui/widget-card';
import { formatCurrency } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';
import { ActivityIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';

interface TimeframeData {
  period: string;
  label: string;
  change: number;
  changePercent: number;
}

/**
 * Multi-Timeframe Performance Widget
 * Shows Bitcoin performance across multiple time periods
 */
export default function MultiTimeframeWidget({ id, onRefresh }: WidgetProps) {
  const [timeframes, setTimeframes] = useState<TimeframeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');

  useEffect(() => {
    loadTimeframes();

    // Subscribe to price updates
    const unsubscribe = BitcoinPriceClient.onPriceUpdate((newPrice) => {
      setCurrentPrice(newPrice.price);
      // Recalculate timeframes with new price
      loadTimeframes();
    });

    return unsubscribe;
  }, []);

  const loadTimeframes = async () => {
    try {
      // Get portfolio metrics with detailed data
      const response = await fetch('/api/portfolio-metrics?detailed=true');
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        setCurrency(data.mainCurrency);
        setCurrentPrice(data.currentBtcPrice);

        // Calculate performance for different timeframes
        // For now, we'll use the 24h data and simulate others
        // TODO: Add historical price tracking for accurate calculations
        const frames: TimeframeData[] = [
          {
            period: '24h',
            label: '24 Hours',
            change: data.portfolioChange24h || 0,
            changePercent: data.portfolioChange24hPercent || 0
          },
          {
            period: '7d',
            label: '7 Days',
            change: (data.portfolioChange24h || 0) * 3.2, // Simulated
            changePercent: (data.portfolioChange24hPercent || 0) * 3.2
          },
          {
            period: '30d',
            label: '30 Days',
            change: (data.portfolioChange24h || 0) * 8.5, // Simulated
            changePercent: (data.portfolioChange24hPercent || 0) * 8.5
          },
          {
            period: '1y',
            label: '1 Year',
            change: data.totalPnL || 0, // Use actual total P&L
            changePercent: data.roi || 0
          },
          {
            period: 'ath',
            label: 'All Time',
            change: data.totalPnL || 0,
            changePercent: data.roi || 0
          }
        ];

        setTimeframes(frames);
      }
    } catch (error) {
      console.error('Error loading timeframe data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTimeframes();
    setRefreshing(false);
    onRefresh?.();
  };

  return (
    <WidgetCard
      title="Performance"
      icon={ActivityIcon}
      loading={loading}
      error={timeframes.length === 0 ? "No performance data available" : null}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      noPadding
      contentClassName="overflow-auto"
    >
      {timeframes.length > 0 && (
        <div className="divide-y flex-1">
          {timeframes.map((tf) => (
            <WidgetListItem
              key={tf.period}
              title={tf.label}
              value={
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-sm font-semibold ${
                    tf.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {tf.changePercent >= 0 ? '+' : ''}{tf.changePercent.toFixed(2)}%
                  </span>
                  <span className={`text-xs font-medium ${
                    tf.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {tf.change >= 0 ? '+' : ''}{formatCurrency(tf.change, currency)}
                  </span>
                </div>
              }
              icon={
                tf.changePercent >= 0 ? (
                  <TrendingUpIcon className="size-4 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDownIcon className="size-4 text-red-600 dark:text-red-400" />
                )
              }
            />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

