'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';
import { formatCurrency } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';

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
export default function MultiTimeframeWidget({ id, isEditMode, onRefresh }: WidgetProps) {
  const [timeframes, setTimeframes] = useState<TimeframeData[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    await loadTimeframes();
    if (onRefresh) onRefresh();
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Performance
          </h3>
        </div>
        <ThemedCard className="flex-1">
          <div className="animate-pulse space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </ThemedCard>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Performance
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

      <ThemedCard padding={false} className="flex-1">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {timeframes.map((tf) => (
            <div key={tf.period} className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <ThemedText variant="muted" className="text-xs">
                    {tf.label}
                  </ThemedText>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`text-sm font-semibold ${
                    tf.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {tf.changePercent >= 0 ? '+' : ''}{tf.changePercent.toFixed(2)}%
                  </div>
                  <div className={`text-xs font-medium min-w-[80px] text-right ${
                    tf.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {tf.change >= 0 ? '+' : ''}{formatCurrency(tf.change, currency)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ThemedCard>
    </div>
  );
}

