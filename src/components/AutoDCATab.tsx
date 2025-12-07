'use client';

import React, { useState, useEffect } from 'react';
import RecurringTransactionModal from './RecurringTransactionModal';
import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Icons
import {
  BotIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  EditIcon,
  TrashIcon,
  ZapIcon,
  CalendarIcon,
  RepeatIcon,
  TargetIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  InfoIcon,
  TrendingUpIcon,
  CoinsIcon,
  HistoryIcon,
} from 'lucide-react';

interface RecurringTransaction {
  id: number;
  name: string;
  type: string;
  amount: number;
  currency: string;
  fees: number;
  feesCurrency: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  lastExecuted: string | null;
  executionCount: number;
  nextExecution: string;
  isActive: boolean;
  isPaused: boolean;
  goalId: number | null;
  notes: string;
  tags: string;
  createdAt: string;
  goal?: {
    id: number;
    name: string;
    targetBtcAmount: number;
  } | null;
}

interface ExecutionHistoryItem {
  id: number;
  type: string;
  btcAmount: number;
  originalTotalAmount: number;
  originalCurrency: string;
  transactionDate: string;
  notes: string;
  tags: string;
}

export default function AutoDCATab() {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<ExecutionHistoryItem[]>([]);

  useEffect(() => {
    loadRecurringTransactions();
    loadExecutionHistory();
  }, []);

  const loadRecurringTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/recurring-transactions');
      const result = await response.json();
      
      if (result.success) {
        setTransactions(result.data || []);
      } else {
        setError(result.error || 'Failed to load recurring transactions');
      }
    } catch (err) {
      console.error('Error loading recurring transactions:', err);
      setError('Failed to load recurring transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionHistory = async () => {
    try {
      const response = await fetch('/api/transactions?limit=10');
      const result = await response.json();
      
      if (result.success && result.data) {
        const autoTransactions = result.data.filter((tx: any) => 
          tx.tags && (tx.tags.includes('Automatic') || tx.tags.includes('DCA')) ||
          tx.notes && tx.notes.includes('Auto-DCA')
        );
        setRecentExecutions(autoTransactions.slice(0, 5));
      }
    } catch (err) {
      console.error('Error loading execution history:', err);
    }
  };

  const togglePause = async (id: number, currentlyPaused: boolean) => {
    try {
      const response = await fetch(`/api/recurring-transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: !currentlyPaused })
      });

      const result = await response.json();
      
      if (result.success) {
        await loadRecurringTransactions();
      } else {
        alert('Failed to update: ' + result.error);
      }
    } catch (err) {
      console.error('Error toggling pause:', err);
      alert('Failed to update recurring transaction');
    }
  };

  const deleteTransaction = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const response = await fetch(`/api/recurring-transactions/${id}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        await loadRecurringTransactions();
      } else {
        alert('Failed to delete: ' + result.error);
      }
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete recurring transaction');
    }
  };

  const executeNow = async (id: number, name: string) => {
    if (!confirm(`Execute "${name}" now? This will create a transaction immediately.`)) return;

    try {
      const response = await fetch(`/api/recurring-transactions/${id}/execute`, { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        alert('Transaction executed successfully!');
        await loadRecurringTransactions();
        await loadExecutionHistory();
      } else {
        alert('Failed to execute: ' + result.error);
      }
    } catch (err) {
      console.error('Error executing:', err);
      alert('Failed to execute transaction');
    }
  };

  const formatFrequency = (freq: string) => {
    const map: Record<string, string> = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'biweekly': 'Bi-weekly',
      'monthly': 'Monthly'
    };
    return map[freq] || freq;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleAddNew = () => {
    setEditingTransaction(null);
    setShowModal(true);
  };

  const handleEdit = (transaction: RecurringTransaction) => {
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingTransaction(null);
  };

  const handleModalSuccess = () => {
    loadRecurringTransactions();
  };

  const activeTransactions = transactions.filter(t => t.isActive && !t.isPaused);
  const pausedTransactions = transactions.filter(t => t.isActive && t.isPaused);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading recurring transactions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <AlertCircleIcon className="size-12 text-destructive mx-auto" />
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={loadRecurringTransactions}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BotIcon className="size-6" />
              Automatic DCA
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Set up recurring Bitcoin purchases that execute automatically
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <PlusIcon className="size-4 mr-2" />
            Add Recurring Purchase
          </Button>
        </div>

        {/* Active Transactions */}
        {activeTransactions.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <PlayIcon className="size-4 text-profit" />
              Active ({activeTransactions.length})
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeTransactions.map((tx) => (
                <Card key={tx.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{tx.name}</CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="gap-1">
                            <RepeatIcon className="size-3" />
                            {formatFrequency(tx.frequency)}
                          </Badge>
                          {tx.goal && (
                            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-500/30">
                              <TargetIcon className="size-3" />
                              {tx.goal.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Amount & Stats */}
                    <div className="flex items-center justify-between py-3 border-y">
                      <div>
                        <p className="text-2xl font-bold">{tx.currency} {tx.amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          per {tx.frequency === 'biweekly' ? '2 weeks' : tx.frequency.replace('ly', '')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-muted-foreground">{tx.executionCount}x</p>
                        <p className="text-xs text-muted-foreground">executed</p>
                      </div>
                    </div>

                    {/* Next Execution */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Next Purchase</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <CalendarIcon className="size-3" />
                          {formatDate(tx.nextExecution)}
                        </p>
                      </div>
                      {tx.maxOccurrences && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                          <p className="text-sm font-medium">{tx.maxOccurrences - tx.executionCount} left</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePause(tx.id, tx.isPaused)}
                        className="flex-1"
                      >
                        <PauseIcon className="size-4 mr-1" />
                        Pause
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(tx)}
                        className="flex-1"
                      >
                        <EditIcon className="size-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => executeNow(tx.id, tx.name)}
                        className="flex-1 text-primary"
                      >
                        <ZapIcon className="size-4 mr-1" />
                        Run Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTransaction(tx.id, tx.name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Paused Transactions */}
        {pausedTransactions.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-muted-foreground">
              <PauseIcon className="size-4" />
              Paused ({pausedTransactions.length})
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pausedTransactions.map((tx) => (
                <Card key={tx.id} className="opacity-60">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{tx.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tx.currency} {tx.amount.toFixed(2)} · {formatFrequency(tx.frequency)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                        <PauseIcon className="size-3 mr-1" />
                        Paused
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePause(tx.id, tx.isPaused)}
                        className="flex-1"
                      >
                        <PlayIcon className="size-4 mr-1" />
                        Resume
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tx)}
                        className="flex-1"
                      >
                        <EditIcon className="size-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTransaction(tx.id, tx.name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {transactions.length === 0 && (
          <Card>
            <CardContent className="py-16">
              <div className="text-center space-y-4">
                <div className="size-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <BotIcon className="size-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">No Recurring Purchases Yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Set up automatic Bitcoin purchases to implement your DCA strategy
                  </p>
                </div>
                <Button onClick={handleAddNew}>
                  <PlusIcon className="size-4 mr-2" />
                  Create Your First Recurring Purchase
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Executions */}
        {recentExecutions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HistoryIcon className="size-4" />
                Recent Auto-Purchases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {recentExecutions.map((exec) => {
                  const date = new Date(exec.transactionDate);
                  const formattedDate = date.toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
                  
                  return (
                    <div key={exec.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircleIcon className="size-5 text-profit" />
                        <div>
                          <p className="text-sm font-medium">
                            Bought <span className="font-mono font-bold">{exec.btcAmount.toFixed(8)} BTC</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{formattedDate}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{exec.originalCurrency} {exec.originalTotalAmount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Automatic</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-primary">{activeTransactions.length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{pausedTransactions.length}</p>
                <p className="text-xs text-muted-foreground">Paused</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-profit">
                  {transactions.reduce((sum, tx) => sum + tx.executionCount, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Purchases</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-blue-500">
                  {new Set(transactions.map(tx => tx.frequency)).size}
                </p>
                <p className="text-xs text-muted-foreground">Frequencies</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info Box */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <InfoIcon className="size-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold mb-1">How It Works</h4>
                <p className="text-sm text-muted-foreground">
                  Your recurring purchases execute automatically at the scheduled time. 
                  The system fetches the current Bitcoin price and creates a transaction for you. 
                  You can pause, edit, or delete at any time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <RecurringTransactionModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        editingTransaction={editingTransaction}
      />
    </>
  );
}
