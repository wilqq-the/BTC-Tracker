'use client';

import { useCallback, useEffect, useState } from 'react';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';
import { onTransactionsChanged } from '@/lib/app-events';

export interface PortfolioMetrics {
  totalBtc: number;
  totalInvested: number;
  portfolioValue: number;
  currentBtcPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  roi: number;
  avgBuyPrice: number;
  mainCurrency: string;
  secondaryCurrency?: string;
  mainToSecondaryRate?: number;
  portfolioChange24h: number;
  portfolioChange24hPercent: number;
  totalTransactions: number;
}

/**
 * Portfolio metrics from /api/portfolio-metrics, kept fresh on live price
 * updates and whenever transactions change. Also returns the display
 * currency + rate (secondary currency when configured, else main).
 */
export function usePortfolioMetrics() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      if (result.success && result.data) setMetrics(result.data);
    } catch (error) {
      console.error('Error loading portfolio metrics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribePrice = BitcoinPriceClient.onPriceUpdate(() => load());
    const unsubscribeTx = onTransactionsChanged(load);
    return () => {
      unsubscribePrice();
      unsubscribeTx();
    };
  }, [load]);

  const currency = metrics?.secondaryCurrency || metrics?.mainCurrency || 'USD';
  const rate = metrics?.secondaryCurrency ? metrics?.mainToSecondaryRate || 1 : 1;

  return { metrics, loading, reload: load, currency, rate };
}
