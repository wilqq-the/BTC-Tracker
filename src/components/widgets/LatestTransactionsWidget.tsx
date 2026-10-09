'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard } from '@/components/ui/widget-card';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';
import { useDisplayCurrency } from '@/hooks/use-display-currency';
import { onTransactionsChanged } from '@/lib/app-events';
import Link from 'next/link';
import { useBtcUnit } from '@/hooks/use-btc-unit';

interface Transaction {
  id: number;
  type: 'BUY' | 'SELL';
  btc_amount: number;
  original_price_per_btc: number;
  original_total_amount: number;
  main_currency_total_amount: number;
  main_currency_price_per_btc?: number;
  current_value_main?: number;
  pnl_main?: number;
  main_currency?: string;
  transaction_date: string;
  notes?: string;
}

/**
 * Latest Transactions Widget
 * Shows recent transactions with P&L
 */
export default function LatestTransactionsWidget({ id, onRefresh }: WidgetProps) {
  const { formatBtc } = useBtcUnit();
  const [latestTransactions, setLatestTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { mainCurrency, secondaryCurrency, exchangeRate } = useDisplayCurrency();
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number>(0);
  const [maxTransactions] = useState<number>(5);

  useEffect(() => {
    loadLatestTransactions();
    loadCurrentPrice();

    // Subscribe to price updates
    const unsubscribe = BitcoinPriceClient.onPriceUpdate((newPrice) => {
      setCurrentBtcPrice(newPrice.price);
    });

    const unsubscribeTx = onTransactionsChanged(loadLatestTransactions);

    return () => {
      unsubscribe();
      unsubscribeTx();
    };
  }, []);

  const loadCurrentPrice = async () => {
    try {
      const price = await BitcoinPriceClient.getCurrentPrice();
      setCurrentBtcPrice(price.price);
    } catch (error) {
      console.error('Error loading Bitcoin price:', error);
    }
  };

  const loadLatestTransactions = async () => {
    try {
      const response = await fetch(`/api/transactions?limit=${maxTransactions}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const latest = result.data
          .sort((a: Transaction, b: Transaction) => 
            new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
          )
          .slice(0, maxTransactions);
        setLatestTransactions(latest);
      }
    } catch (error) {
      console.error('Error loading latest transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLatestTransactions();
    setRefreshing(false);
    onRefresh?.();
  };

  const typeBadge = (type: string) =>
    type === 'BUY' ? { label: 'Buy', tone: 'bg-tint-green text-tint-green-fg' }
      : type === 'SELL' ? { label: 'Sell', tone: 'bg-tint-red text-tint-red-fg' }
        : { label: 'Transfer', tone: 'bg-tint-blue text-tint-blue-fg' };

  return (
    <WidgetCard
      title="Recent transactions"
      badge={
        <Link href="/transactions" className="ml-auto shrink-0 text-sm font-bold text-primary-strong hover:underline">
          View all
        </Link>
      }
      loading={loading}
      error={!latestTransactions.length ? "No transactions yet" : null}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      contentClassName="overflow-hidden"
    >
      {latestTransactions.length > 0 && (
        <div className="-mx-2 flex flex-1 flex-col overflow-auto">
          {latestTransactions.map((transaction) => {
            const pricePerBtc = transaction.main_currency_price_per_btc || transaction.original_price_per_btc;
            const currentValue = transaction.current_value_main || 0;
            const pnl = transaction.pnl_main || 0;
            const originalValue = transaction.main_currency_total_amount || transaction.original_total_amount;
            const pnlPercent = originalValue > 0 ? (pnl / originalValue) * 100 : 0;
            const badge = typeBadge(transaction.type);
            const pnlTone = pnl > 0 ? 'text-tint-green-fg' : pnl < 0 ? 'text-tint-red-fg' : 'text-muted-foreground';

            return (
              <div key={transaction.id} className="flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-secondary/70">
                <span className={`w-[72px] shrink-0 rounded-full py-1.5 text-center text-[13px] font-bold ${badge.tone}`}>
                  {badge.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold tabular-nums">{formatBtc(transaction.btc_amount)}</div>
                  <div className="truncate text-[13px] text-muted-foreground">
                    {new Date(transaction.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {', at '}{formatCurrency(pricePerBtc * exchangeRate, secondaryCurrency)}
                  </div>
                </div>
                {currentValue > 0 && (
                  <div className="shrink-0 text-right">
                    <div className={`text-[15px] font-bold tabular-nums ${pnlTone}`}>
                      {pnl >= 0 ? '+' : '-'}{formatCurrency(Math.abs(pnl) * exchangeRate, secondaryCurrency)}
                    </div>
                    <div className={`text-[13px] tabular-nums ${pnlTone}`}>{formatPercentage(pnlPercent)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
