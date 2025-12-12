'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard } from '@/components/ui/widget-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';
import { HistoryIcon, ExternalLinkIcon, ArrowUpRightIcon, ArrowDownRightIcon } from 'lucide-react';
import Link from 'next/link';

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
  const [latestTransactions, setLatestTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mainCurrency, setMainCurrency] = useState<string>('USD');
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number>(0);
  const [maxTransactions] = useState<number>(5);

  useEffect(() => {
    loadLatestTransactions();
    loadCurrentPrice();

    // Subscribe to price updates
    const unsubscribe = BitcoinPriceClient.onPriceUpdate((newPrice) => {
      setCurrentBtcPrice(newPrice.price);
    });

    return unsubscribe;
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
        
        if (latest.length > 0 && latest[0].main_currency) {
          setMainCurrency(latest[0].main_currency);
        }
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

  return (
    <WidgetCard
      title="Latest Transactions"
      icon={HistoryIcon}
      badge={latestTransactions.length > 0 && <Badge variant="secondary">{latestTransactions.length}</Badge>}
      loading={loading}
      error={!latestTransactions.length ? "No transactions found" : null}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      noPadding
      contentClassName="overflow-hidden"
      footer={
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/transactions">
            View All Transactions
            <ExternalLinkIcon className="size-3.5 ml-2" />
          </Link>
        </Button>
      }
    >
      {latestTransactions.length > 0 && (
        <div className="divide-y overflow-auto flex-1">
          {latestTransactions.map((transaction) => {
            const pricePerBtc = transaction.main_currency_price_per_btc || transaction.original_price_per_btc;
            const currentValue = transaction.current_value_main || 0;
            const pnl = transaction.pnl_main || 0;
            const originalValue = transaction.main_currency_total_amount || transaction.original_total_amount;
            const pnlPercent = originalValue > 0 ? (pnl / originalValue) * 100 : 0;
            const isBuy = transaction.type === 'BUY';

            return (
              <div key={transaction.id} className="px-3 py-2.5 hover:bg-accent transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={isBuy ? "default" : "destructive"} className="gap-1">
                      {isBuy ? <ArrowDownRightIcon className="size-3" /> : <ArrowUpRightIcon className="size-3" />}
                      {transaction.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-medium text-foreground">
                      {transaction.btc_amount.toFixed(6)} ₿
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @ {formatCurrency(pricePerBtc, mainCurrency)}
                    </div>
                  </div>
                </div>
                
                {currentValue > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">P&L:</span>
                    <span className={`font-medium ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, mainCurrency)} ({formatPercentage(pnlPercent)})
                    </span>
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
