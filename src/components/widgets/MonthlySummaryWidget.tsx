'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard, WidgetEmptyState, WidgetStats } from '@/components/ui/widget-card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';

interface MonthlyStats {
  month: string;
  buys: number;
  totalBought: number;
  avgBuyPrice: number;
  amountInvested: number;
  currency: string;
}

/**
 * Monthly Summary Widget
 * Shows current month's Bitcoin accumulation stats
 */
export default function MonthlySummaryWidget({ id, onRefresh }: WidgetProps) {
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMonthlyStats();
  }, []);

  const loadMonthlyStats = async () => {
    try {
      // Fetch all transactions for monthly calculations
      const response = await fetch('/api/transactions?limit=10000');
      const result = await response.json();
      
      if (result.success && result.data) {
        const transactions = result.data;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Filter transactions from current month
        const thisMonthTxs = transactions.filter((tx: any) => {
          const txDate = new Date(tx.transaction_date);
          return txDate.getMonth() === currentMonth && 
                 txDate.getFullYear() === currentYear &&
                 tx.type === 'BUY';
        });

        if (thisMonthTxs.length > 0) {
          const totalBought = thisMonthTxs.reduce((sum: number, tx: any) => sum + tx.btc_amount, 0);
          const totalInvested = thisMonthTxs.reduce((sum: number, tx: any) => 
            sum + (tx.main_currency_total_amount || tx.original_total_amount), 0
          );
          const avgPrice = totalBought > 0 ? totalInvested / totalBought : 0;

          setStats({
            month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            buys: thisMonthTxs.length,
            totalBought,
            avgBuyPrice: avgPrice,
            amountInvested: totalInvested,
            currency: thisMonthTxs[0].main_currency || 'USD'
          });
        } else {
          setStats({
            month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            buys: 0,
            totalBought: 0,
            avgBuyPrice: 0,
            amountInvested: 0,
            currency: 'USD'
          });
        }
      }
    } catch (error) {
      console.error('Error loading monthly stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMonthlyStats();
    setRefreshing(false);
    onRefresh?.();
  };

  return (
    <WidgetCard
      title="This Month"
      icon={CalendarIcon}
      loading={loading}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      contentClassName="overflow-auto"
    >
      {!stats || stats.buys === 0 ? (
        <WidgetEmptyState
          icon={CalendarIcon}
          title="No purchases yet this month"
          description="Start accumulating Bitcoin this month"
          action={
            <Button asChild size="sm">
              <Link href="/transactions">
                <PlusIcon className="size-4 mr-2" />
                Add Transaction
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Month Header */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">{stats.month}</p>
            <div className="text-lg font-bold">{stats.totalBought.toFixed(8)} ₿</div>
            <p className="text-xs text-muted-foreground">
              {stats.buys} {stats.buys === 1 ? 'purchase' : 'purchases'}
            </p>
          </div>

          <Separator />

          {/* Amount Invested */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Amount Invested</p>
            <div className="text-base font-semibold">{formatCurrency(stats.amountInvested, stats.currency)}</div>
          </div>

          {/* Average Buy Price */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Average Buy Price</p>
            <div className="text-base font-semibold text-btc-500">{formatCurrency(stats.avgBuyPrice, stats.currency)}</div>
          </div>

          <Separator />

          {/* Quick Action */}
          <Button asChild className="w-full" size="sm">
            <Link href="/transactions">
              <PlusIcon className="size-4 mr-2" />
              Add Transaction
            </Link>
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}
