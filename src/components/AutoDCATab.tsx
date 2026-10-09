'use client';

import React, { useState, useEffect } from 'react';
import RecurringTransactionModal from './RecurringTransactionModal';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/theme';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/components/ui/confirm-dialog';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Icons
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  TargetIcon,
  Trash2Icon,
  ZapIcon,
} from 'lucide-react';
import { WidgetEmptyState } from '@/components/ui/widget-card';
import { btc } from '@/components/planning/planning-icons';
import { useBtcUnit } from '@/hooks/use-btc-unit';

const PER_PERIOD: Record<string, string> = {
  daily: 'a day',
  weekly: 'a week',
  biweekly: 'every 2 weeks',
  monthly: 'a month',
};

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
  const { formatBtc } = useBtcUnit();
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
        toast({ title: 'Failed to update', description: result.error, variant: 'destructive' });
      }
    } catch (err) {
      console.error('Error toggling pause:', err);
      toast({ title: 'Failed to update recurring transaction', variant: 'destructive' });
    }
  };

  const deleteTransaction = async (id: number, name: string) => {
    if (!(await confirm({ title: 'Delete recurring purchase?', description: `Are you sure you want to delete "${name}"?`, confirmText: 'Delete', destructive: true }))) return;

    try {
      const response = await fetch(`/api/recurring-transactions/${id}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        await loadRecurringTransactions();
      } else {
        toast({ title: 'Failed to delete', description: result.error, variant: 'destructive' });
      }
    } catch (err) {
      console.error('Error deleting:', err);
      toast({ title: 'Failed to delete recurring transaction', variant: 'destructive' });
    }
  };

  const executeNow = async (id: number, name: string) => {
    if (!(await confirm({ title: 'Buy now?', description: `Run "${name}" now. This adds a transaction at the current price straight away.`, confirmText: 'Buy now' }))) return;

    try {
      const response = await fetch(`/api/recurring-transactions/${id}/execute`, { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: 'Purchase added', variant: 'success' });
        await loadRecurringTransactions();
        await loadExecutionHistory();
      } else {
        toast({ title: 'Purchase failed', description: result.error, variant: 'destructive' });
      }
    } catch (err) {
      console.error('Error executing:', err);
      toast({ title: 'Purchase failed', description: 'Please try again.', variant: 'destructive' });
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
  const totalExecutions = transactions.reduce((sum, tx) => sum + tx.executionCount, 0);

  // "€10.00 a day", "€50.00 every 2 weeks"
  const formatSchedule = (tx: RecurringTransaction) =>
    `${formatCurrency(tx.amount, tx.currency)} ${PER_PERIOD[tx.frequency] ?? formatFrequency(tx.frequency).toLowerCase()}`;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading recurring purchases" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-10">
          <WidgetEmptyState
            icon={AlertCircleIcon}
            title="Recurring purchases couldn't load"
            description={`${error}. Check that the server is running, then try again.`}
            action={
              <Button variant="outline" size="sm" className="rounded-full" onClick={loadRecurringTransactions}>
                Try again
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-sm text-muted-foreground">
            {transactions.length === 0
              ? 'Buy bitcoin automatically on a schedule.'
              : `${activeTransactions.length} active, ${pausedTransactions.length} paused, ${totalExecutions} ${totalExecutions === 1 ? 'purchase' : 'purchases'} made so far.`}
          </p>
          {transactions.length > 0 && (
            <Button size="sm" className="rounded-full font-bold" onClick={handleAddNew}>
              <PlusIcon className="size-4" />
              Add recurring purchase
            </Button>
          )}
        </div>

        {/* Empty state */}
        {transactions.length === 0 && (
          <Card className="rounded-2xl">
            <CardContent className="py-12">
              <WidgetEmptyState
                icon={RepeatIcon}
                title="No recurring purchases yet"
                description="Pick an amount and a schedule. Each purchase is added to your transactions at the current bitcoin price."
                action={
                  <Button size="sm" className="rounded-full font-bold" onClick={handleAddNew}>
                    <PlusIcon className="size-4" />
                    Create your first recurring purchase
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )}

        {/* Active */}
        {activeTransactions.length > 0 && (
          <section className="space-y-3">
            <h3 className="px-1 text-[15px] font-bold">
              Active <span className="font-semibold text-muted-foreground">{activeTransactions.length}</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeTransactions.map((tx) => (
                <Card key={tx.id} className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="truncate text-[17px] font-bold tracking-tight">{tx.name}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                        <RepeatIcon className="size-3.5 text-muted-foreground" />
                        {formatFrequency(tx.frequency)}
                      </span>
                      {tx.goal && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-tint-orange px-2.5 py-1 text-xs font-semibold text-primary-strong">
                          <TargetIcon className="size-3.5" />
                          {tx.goal.name}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatCurrency(tx.amount, tx.currency)}</p>
                        <p className="text-[13px] text-muted-foreground">
                          per {{ daily: 'day', weekly: 'week', biweekly: '2 weeks', monthly: 'month' }[tx.frequency] ?? tx.frequency}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-[15px] font-bold tabular-nums', tx.executionCount === 0 && 'text-muted-foreground')}>
                          {tx.executionCount} {tx.executionCount === 1 ? 'time' : 'times'}
                        </p>
                        <p className="text-[13px] text-muted-foreground">bought so far</p>
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-secondary p-3">
                        <dt className="text-[13px] font-semibold text-muted-foreground">Next purchase</dt>
                        <dd className="mt-0.5 text-[15px] font-bold">{formatDate(tx.nextExecution)}</dd>
                      </div>
                      <div className="rounded-2xl bg-secondary p-3">
                        <dt className="text-[13px] font-semibold text-muted-foreground">Ends</dt>
                        <dd className="mt-0.5 text-[15px] font-bold">
                          {tx.maxOccurrences
                            ? `After ${tx.maxOccurrences - tx.executionCount} more`
                            : tx.endDate
                              ? formatDate(tx.endDate)
                              : 'Never'}
                        </dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => togglePause(tx.id, tx.isPaused)}>
                        <PauseIcon className="size-4" />
                        Pause
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleEdit(tx)}>
                        <PencilIcon className="size-4" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => executeNow(tx.id, tx.name)}>
                        <ZapIcon className="size-4" />
                        Buy now
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto rounded-full text-muted-foreground hover:text-destructive"
                        onClick={() => deleteTransaction(tx.id, tx.name)}
                        aria-label={`Delete ${tx.name}`}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Paused */}
        {pausedTransactions.length > 0 && (
          <section className="space-y-3">
            <h3 className="px-1 text-[15px] font-bold">
              Paused <span className="font-semibold text-muted-foreground">{pausedTransactions.length}</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {pausedTransactions.map((tx) => (
                <Card key={tx.id} className="rounded-2xl py-5">
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{tx.name}</p>
                        <p className="text-sm text-muted-foreground tabular-nums">{formatSchedule(tx)}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        <PauseIcon className="size-3.5" />
                        Paused
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="rounded-full font-bold" onClick={() => togglePause(tx.id, tx.isPaused)}>
                        <PlayIcon className="size-4" />
                        Resume
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleEdit(tx)}>
                        <PencilIcon className="size-4" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto rounded-full text-muted-foreground hover:text-destructive"
                        onClick={() => deleteTransaction(tx.id, tx.name)}
                        aria-label={`Delete ${tx.name}`}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Recent executions */}
        {recentExecutions.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[17px] font-bold tracking-tight">Recent automatic purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {recentExecutions.map((exec) => {
                  const formattedDate = new Date(exec.transactionDate).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <li key={exec.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <CheckCircle2Icon className="size-5 shrink-0 text-tint-green-fg" />
                        <div>
                          <p className="text-sm font-semibold">
                            Bought <span className="font-bold text-primary-strong tabular-nums">{formatBtc(exec.btcAmount, { trim: true })}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{formattedDate}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold tabular-nums">
                        {formatCurrency(exec.originalTotalAmount, exec.originalCurrency)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* How it works */}
        <Card className="rounded-2xl py-5">
          <CardContent className="flex gap-3">
            <InfoIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-bold">How it works</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Each recurring purchase runs at its scheduled time: the app fetches the current bitcoin price and adds
                the transaction for you. You can pause, edit or delete it at any time.
              </p>
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
