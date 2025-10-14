'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';
import { formatCurrency } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';

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
export default function MonthlySummaryWidget({ id, isEditMode, onRefresh }: WidgetProps) {
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthlyStats();
  }, []);

  const loadMonthlyStats = async () => {
    try {
      const response = await fetch('/api/transactions');
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
    setLoading(true);
    await loadMonthlyStats();
    if (onRefresh) onRefresh();
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            This Month
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          This Month
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

      <ThemedCard className="flex-1">
        {!stats || stats.buys === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <ThemedText variant="muted" className="text-sm mb-2">
              No purchases yet this month
            </ThemedText>
            <a
              href="/transactions"
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              Add Transaction →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Month Header */}
            <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
              <ThemedText variant="muted" className="text-xs mb-1">
                {stats.month}
              </ThemedText>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {stats.totalBought.toFixed(8)} ₿
              </div>
              <ThemedText variant="muted" className="text-xs">
                {stats.buys} {stats.buys === 1 ? 'purchase' : 'purchases'}
              </ThemedText>
            </div>

            {/* Amount Invested */}
            <div>
              <ThemedText variant="muted" className="text-xs mb-1">
                Amount Invested
              </ThemedText>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(stats.amountInvested, stats.currency)}
              </div>
            </div>

            {/* Average Buy Price */}
            <div>
              <ThemedText variant="muted" className="text-xs mb-1">
                Average Buy Price
              </ThemedText>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(stats.avgBuyPrice, stats.currency)}
              </div>
            </div>

            {/* Quick Action */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <a
                href="/transactions"
                className="block w-full text-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Add Transaction
              </a>
            </div>
          </div>
        )}
      </ThemedCard>
    </div>
  );
}

