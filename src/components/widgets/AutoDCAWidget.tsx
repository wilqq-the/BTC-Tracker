'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from '@/components/ui/ThemeProvider';
import { WidgetProps } from '@/lib/dashboard-types';
import { useRouter } from 'next/navigation';

interface RecurringTransaction {
  id: number;
  name: string;
  type: string;
  amount: number;
  currency: string;
  frequency: string;
  nextExecution: string;
  executionCount: number;
  isActive: boolean;
  isPaused: boolean;
}

interface ExecutionHistoryItem {
  id: number;
  btcAmount: number;
  originalTotalAmount: number;
  originalCurrency: string;
  transactionDate: string;
}

/**
 * Auto DCA Widget
 * Shows status of automated recurring Bitcoin purchases
 */
export default function AutoDCAWidget({ id, isEditMode, onRefresh }: WidgetProps) {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<ExecutionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Load recurring transactions
      const transactionsResponse = await fetch('/api/recurring-transactions');
      const transactionsResult = await transactionsResponse.json();
      
      if (transactionsResult.success) {
        setTransactions(transactionsResult.data || []);
      }

      // Load recent executions
      const executionsResponse = await fetch('/api/transactions?limit=5');
      const executionsResult = await executionsResponse.json();
      
      if (executionsResult.success && executionsResult.data) {
        const autoTransactions = executionsResult.data.filter((tx: any) => 
          tx.tags && (tx.tags.includes('Automatic') || tx.tags.includes('DCA')) ||
          tx.notes && tx.notes.includes('Auto-DCA')
        );
        setRecentExecutions(autoTransactions.slice(0, 3));
      }
    } catch (err) {
      console.error('Error loading Auto DCA data:', err);
      setError('Failed to load Auto DCA data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0 && diffDays <= 7) {
      return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFrequencyIcon = (freq: string) => {
    const icons: Record<string, string> = {
      'daily': '📅',
      'weekly': '📆',
      'biweekly': '🗓️',
      'monthly': '🌙'
    };
    return icons[freq] || '🔄';
  };

  const activeTransactions = transactions.filter(t => t.isActive && !t.isPaused);
  const pausedTransactions = transactions.filter(t => t.isActive && t.isPaused);
  const totalExecutions = transactions.reduce((sum, tx) => sum + tx.executionCount, 0);

  // Find next scheduled execution
  const nextExecution = activeTransactions.length > 0
    ? activeTransactions.reduce((earliest, tx) => {
        const txDate = new Date(tx.nextExecution);
        const earliestDate = new Date(earliest.nextExecution);
        return txDate < earliestDate ? tx : earliest;
      })
    : null;

  if (loading) {
    return (
      <ThemedCard>
        <div className="p-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bitcoin"></div>
          </div>
        </div>
      </ThemedCard>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            🤖 Auto DCA
          </h3>
        </div>
        <ThemedCard className="flex-1 flex items-center justify-center">
          <ThemedText variant="secondary" className="text-center">
            {error}
          </ThemedText>
        </ThemedCard>
      </div>
    );
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            🤖 Auto DCA
          </h3>
        </div>
        
        <ThemedCard className="flex-1">
          <div className="p-4 h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🤖</div>
              <ThemedText variant="secondary" size="sm" className="mb-3">
                No recurring purchases set up yet
              </ThemedText>
              <ThemedButton
                variant="primary"
                size="sm"
                onClick={() => router.push('/goals?tab=auto-dca')}
                className="bg-bitcoin hover:bg-bitcoin-dark"
              >
                Set Up Auto DCA
              </ThemedButton>
            </div>
          </div>
        </ThemedCard>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          🤖 Auto DCA
        </h3>
        <button
          onClick={() => router.push('/goals?tab=auto-dca')}
          className="text-xs text-bitcoin hover:text-bitcoin-dark transition-colors"
          title="View all recurring purchases"
        >
          View All →
        </button>
      </div>

      <ThemedCard className="flex-1">
        <div className="p-4 h-full flex flex-col">

        {/* Quick Stats Bar */}
        <div className="flex items-center gap-4 mb-3 pb-3 border-b border-btc-border-secondary">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-bitcoin"></div>
            <ThemedText size="sm" className="font-semibold">{activeTransactions.length}</ThemedText>
            <ThemedText variant="muted" size="xs">Active</ThemedText>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
            <ThemedText size="sm" className="font-semibold">{pausedTransactions.length}</ThemedText>
            <ThemedText variant="muted" size="xs">Paused</ThemedText>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <ThemedText size="sm" className="font-semibold">{totalExecutions}</ThemedText>
            <ThemedText variant="muted" size="xs">Runs</ThemedText>
          </div>
        </div>

        {/* Active Recurring Transactions List */}
        {activeTransactions.length > 0 && (
          <div className="space-y-2 mb-3">
            <ThemedText variant="muted" size="xs" className="uppercase tracking-wide font-medium">
              Active Schedules
            </ThemedText>
            {activeTransactions.slice(0, 3).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 px-2 hover:bg-btc-bg-secondary rounded transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base">{getFrequencyIcon(tx.frequency)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-btc-text-primary truncate">
                      {tx.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-btc-text-muted">
                      <span>{tx.currency} {tx.amount.toFixed(0)}</span>
                      <span>•</span>
                      <span className="capitalize">{tx.frequency}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-xs font-semibold text-btc-text-primary">
                    {formatDate(tx.nextExecution)}
                  </div>
                  <ThemedText variant="muted" size="xs">
                    {tx.executionCount}x run
                  </ThemedText>
                </div>
              </div>
            ))}
            {activeTransactions.length > 3 && (
              <ThemedText variant="muted" size="xs" className="text-center py-1">
                + {activeTransactions.length - 3} more
              </ThemedText>
            )}
          </div>
        )}

        {/* Recent Executions */}
        {recentExecutions.length > 0 && activeTransactions.length > 0 && (
          <div className="pt-3 border-t border-btc-border-secondary">
            <ThemedText variant="muted" size="xs" className="mb-2 uppercase tracking-wide font-medium">
              Recent Purchases
            </ThemedText>
            <div className="space-y-1.5">
              {recentExecutions.map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center justify-between py-1.5 px-2 hover:bg-btc-bg-secondary rounded transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs">✅</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-btc-text-primary">
                        {exec.btcAmount.toFixed(6)} BTC
                      </div>
                      <ThemedText variant="muted" size="xs">
                        {new Date(exec.transactionDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </ThemedText>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-btc-text-secondary">
                    {exec.originalCurrency} {exec.originalTotalAmount.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manage Button */}
        <div className="mt-3 pt-3 border-t border-btc-border-secondary">
          <button
            onClick={() => router.push('/goals?tab=auto-dca')}
            className="w-full py-2 text-sm font-medium text-bitcoin hover:text-bitcoin-dark transition-colors text-center"
          >
            Manage Schedules →
          </button>
        </div>
        </div>
      </ThemedCard>
    </div>
  );
}

