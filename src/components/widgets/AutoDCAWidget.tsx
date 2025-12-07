'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard, WidgetEmptyState } from '@/components/ui/widget-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { WidgetProps } from '@/lib/dashboard-types';
import { BotIcon, CalendarIcon, CheckCircleIcon, ClockIcon, ExternalLinkIcon, PauseIcon } from 'lucide-react';
import Link from 'next/link';

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
export default function AutoDCAWidget({ id, onRefresh }: WidgetProps) {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<ExecutionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setError('');
    
    try {
      const transactionsResponse = await fetch('/api/recurring-transactions');
      const transactionsResult = await transactionsResponse.json();
      
      if (transactionsResult.success) {
        setTransactions(transactionsResult.data || []);
      }

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    onRefresh?.();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0 && diffDays <= 7) {
      return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFrequencyIcon = (freq: string) => {
    return CalendarIcon;
  };

  const activeTransactions = transactions.filter(t => t.isActive && !t.isPaused);
  const pausedTransactions = transactions.filter(t => t.isActive && t.isPaused);
  const totalExecutions = transactions.reduce((sum, tx) => sum + tx.executionCount, 0);

  return (
    <WidgetCard
      title="Auto DCA"
      icon={BotIcon}
      badge={
        transactions.length > 0 && (
          <Badge variant={activeTransactions.length > 0 ? "default" : "secondary"}>
            {activeTransactions.length} active
          </Badge>
        )
      }
      loading={loading}
      error={error}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      contentClassName="overflow-auto"
      footer={
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/goals?tab=auto-dca">
            {transactions.length === 0 ? 'Set Up Auto DCA' : 'Manage Schedules'}
            <ExternalLinkIcon className="size-3.5 ml-2" />
          </Link>
        </Button>
      }
    >
      {transactions.length === 0 ? (
        <WidgetEmptyState
          icon={BotIcon}
          title="No recurring purchases yet"
          description="Set up automated Bitcoin purchases to dollar-cost average over time"
        />
      ) : (
        <div className="space-y-3 flex-1">
          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-btc-500 shrink-0" />
              <span className="text-sm font-semibold">{activeTransactions.length}</span>
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-orange-400 shrink-0" />
              <span className="text-sm font-semibold">{pausedTransactions.length}</span>
              <span className="text-xs text-muted-foreground">Paused</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-green-400 shrink-0" />
              <span className="text-sm font-semibold">{totalExecutions}</span>
              <span className="text-xs text-muted-foreground">Runs</span>
            </div>
          </div>

          <Separator />

          {/* Active Schedules */}
          {activeTransactions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Active Schedules
              </p>
              {activeTransactions.slice(0, 3).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 px-2 hover:bg-accent rounded transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {tx.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{tx.currency} {tx.amount.toFixed(0)}</span>
                        <span>•</span>
                        <span className="capitalize">{tx.frequency}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-xs font-semibold text-btc-500">
                      {formatDate(tx.nextExecution)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {tx.executionCount}x run
                    </span>
                  </div>
                </div>
              ))}
              {activeTransactions.length > 3 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  + {activeTransactions.length - 3} more
                </p>
              )}
            </div>
          )}

          {/* Recent Executions */}
          {recentExecutions.length > 0 && activeTransactions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Recent Purchases
                </p>
                <div className="space-y-1.5">
                  {recentExecutions.map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between py-1.5 px-2 hover:bg-accent rounded transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <CheckCircleIcon className="size-3.5 text-green-600 dark:text-green-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium">
                            {exec.btcAmount.toFixed(6)} BTC
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(exec.transactionDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {exec.originalCurrency} {exec.originalTotalAmount.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
