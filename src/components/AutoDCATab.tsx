/**
 * Auto DCA Tab Component
 * Displays and manages recurring Bitcoin purchases
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from '@/components/ui/ThemeProvider';
import RecurringTransactionModal from './RecurringTransactionModal';

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
  const [loadingHistory, setLoadingHistory] = useState(false);

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
      setLoadingHistory(true);
      
      // Load recent transactions with "Auto-DCA" or "Automatic" tags
      const response = await fetch('/api/transactions?limit=10');
      const result = await response.json();
      
      if (result.success && result.data) {
        // Filter for auto-generated transactions
        const autoTransactions = result.data.filter((tx: any) => 
          tx.tags && (tx.tags.includes('Automatic') || tx.tags.includes('DCA')) ||
          tx.notes && tx.notes.includes('Auto-DCA')
        );
        setRecentExecutions(autoTransactions.slice(0, 5));
      }
    } catch (err) {
      console.error('Error loading execution history:', err);
    } finally {
      setLoadingHistory(false);
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
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/recurring-transactions/${id}`, {
        method: 'DELETE'
      });

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
    if (!confirm(`Execute "${name}" now? This will create a transaction immediately.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/recurring-transactions/${id}/execute`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Transaction executed successfully!');
        await loadRecurringTransactions();
      } else {
        alert('❌ Failed to execute: ' + result.error);
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
    
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
        <ThemedText variant="secondary">Loading recurring transactions...</ThemedText>
      </div>
    );
  }

  if (error) {
    return (
      <ThemedCard>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">⚠️</div>
          <ThemedText variant="secondary" className="mb-4">{error}</ThemedText>
          <ThemedButton onClick={loadRecurringTransactions}>
            Try Again
          </ThemedButton>
        </div>
      </ThemedCard>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-btc-text-primary mb-2">
              🤖 Automatic DCA
            </h2>
            <ThemedText variant="secondary" className="text-sm">
              Set up recurring Bitcoin purchases that execute automatically
            </ThemedText>
          </div>
          <ThemedButton
            onClick={handleAddNew}
            variant="primary"
            className="bg-bitcoin hover:bg-bitcoin-dark flex-shrink-0"
          >
            ➕ Add Recurring Purchase
          </ThemedButton>
        </div>

        {/* Active Recurring Transactions */}
        {activeTransactions.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-btc-text-primary mb-4">
              Active ({activeTransactions.length})
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeTransactions.map((tx) => (
                <ThemedCard key={tx.id}>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold text-btc-text-primary truncate">
                          {tx.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-bitcoin/10 text-bitcoin rounded-md text-xs font-medium">
                            {getFrequencyIcon(tx.frequency)} {formatFrequency(tx.frequency)}
                          </span>
                          {tx.goal && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md text-xs font-medium">
                              🎯 {tx.goal.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount & Stats */}
                    <div className="flex items-center justify-between py-3 border-y border-btc-border-primary">
                      <div>
                        <div className="text-2xl font-bold text-btc-text-primary">
                          {tx.currency} {tx.amount.toFixed(2)}
                        </div>
                        <ThemedText variant="muted" size="sm">
                          per {tx.frequency === 'biweekly' ? '2 weeks' : tx.frequency.replace('ly', '')}
                        </ThemedText>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-btc-text-secondary">
                          {tx.executionCount}x
                        </div>
                        <ThemedText variant="muted" size="sm">
                          executed
                        </ThemedText>
                      </div>
                    </div>

                    {/* Next Execution */}
                    <div className="flex items-center justify-between">
                      <div>
                        <ThemedText variant="muted" size="sm" className="mb-1">
                          Next Purchase
                        </ThemedText>
                        <div className="text-sm font-medium text-btc-text-primary">
                          📅 {formatDate(tx.nextExecution)}
                        </div>
                      </div>
                      {tx.maxOccurrences && (
                        <div className="text-right">
                          <ThemedText variant="muted" size="sm" className="mb-1">
                            Remaining
                          </ThemedText>
                          <div className="text-sm font-medium text-btc-text-primary">
                            {tx.maxOccurrences - tx.executionCount} left
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <ThemedButton
                        onClick={() => togglePause(tx.id, tx.isPaused)}
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                      >
                        ⏸️ Pause
                      </ThemedButton>
                      <ThemedButton
                        onClick={() => handleEdit(tx)}
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                      >
                        ✏️ Edit
                      </ThemedButton>
                      <ThemedButton
                        onClick={() => executeNow(tx.id, tx.name)}
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-bitcoin hover:text-bitcoin-dark"
                      >
                        ⚡ Run Now
                      </ThemedButton>
                      <button
                        onClick={() => deleteTransaction(tx.id, tx.name)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </ThemedCard>
              ))}
            </div>
          </section>
        )}

        {/* Paused Transactions */}
        {pausedTransactions.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-btc-text-secondary mb-4">
              Paused ({pausedTransactions.length})
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pausedTransactions.map((tx) => (
                <ThemedCard key={tx.id} className="opacity-60">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-btc-text-primary truncate">
                          {tx.name}
                        </h4>
                        <div className="text-sm text-btc-text-secondary mt-1">
                          {tx.currency} {tx.amount.toFixed(2)} · {formatFrequency(tx.frequency)}
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded-md text-xs font-medium">
                        ⏸️ Paused
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ThemedButton
                        onClick={() => togglePause(tx.id, tx.isPaused)}
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                      >
                        ▶️ Resume
                      </ThemedButton>
                      <ThemedButton
                        onClick={() => handleEdit(tx)}
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                      >
                        ✏️ Edit
                      </ThemedButton>
                      <button
                        onClick={() => deleteTransaction(tx.id, tx.name)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </ThemedCard>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {transactions.length === 0 && (
          <ThemedCard>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-btc-text-primary mb-2">
                No Recurring Purchases Yet
              </h3>
              <ThemedText variant="secondary" className="mb-6">
                Set up automatic Bitcoin purchases to implement your DCA strategy
              </ThemedText>
              <ThemedButton
                onClick={handleAddNew}
                variant="primary"
                className="bg-bitcoin hover:bg-bitcoin-dark"
              >
                ➕ Create Your First Recurring Purchase
              </ThemedButton>
            </div>
          </ThemedCard>
        )}

        {/* Execution History */}
        {recentExecutions.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-btc-text-primary mb-4">
              📜 Recent Auto-Purchases
            </h3>
            <ThemedCard>
              <div className="divide-y divide-btc-border-primary">
                {recentExecutions.map((exec) => {
                  const date = new Date(exec.transactionDate);
                  const formattedDate = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  return (
                    <div key={exec.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">✅</span>
                        <div>
                          <div className="text-sm font-medium text-btc-text-primary">
                            Bought <span className="font-mono font-bold">{exec.btcAmount.toFixed(8)} BTC</span>
                          </div>
                          <ThemedText variant="muted" size="sm">
                            {formattedDate}
                          </ThemedText>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-btc-text-primary">
                          {exec.originalCurrency} {exec.originalTotalAmount.toFixed(2)}
                        </div>
                        <ThemedText variant="muted" size="sm">
                          Automatic
                        </ThemedText>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ThemedCard>
          </section>
        )}

        {/* Statistics */}
        {transactions.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-btc-text-primary mb-4">
              📊 Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ThemedCard>
                <div className="text-center p-4">
                  <div className="text-3xl font-bold text-bitcoin mb-1">
                    {activeTransactions.length}
                  </div>
                  <ThemedText variant="muted" size="sm">
                    Active
                  </ThemedText>
                </div>
              </ThemedCard>
              <ThemedCard>
                <div className="text-center p-4">
                  <div className="text-3xl font-bold text-orange-400 mb-1">
                    {pausedTransactions.length}
                  </div>
                  <ThemedText variant="muted" size="sm">
                    Paused
                  </ThemedText>
                </div>
              </ThemedCard>
              <ThemedCard>
                <div className="text-center p-4">
                  <div className="text-3xl font-bold text-green-400 mb-1">
                    {transactions.reduce((sum, tx) => sum + tx.executionCount, 0)}
                  </div>
                  <ThemedText variant="muted" size="sm">
                    Total Purchases
                  </ThemedText>
                </div>
              </ThemedCard>
              <ThemedCard>
                <div className="text-center p-4">
                  <div className="text-3xl font-bold text-blue-400 mb-1">
                    {new Set(transactions.map(tx => tx.frequency)).size}
                  </div>
                  <ThemedText variant="muted" size="sm">
                    Frequencies
                  </ThemedText>
                </div>
              </ThemedCard>
            </div>
          </section>
        )}

        {/* Info Box */}
        <ThemedCard className="bg-blue-500/5 border-blue-500/20">
          <div className="flex gap-3">
            <div className="text-2xl flex-shrink-0">💡</div>
            <div>
              <h4 className="text-sm font-semibold text-btc-text-primary mb-1">
                How It Works
              </h4>
              <ThemedText variant="secondary" size="sm">
                Your recurring purchases execute automatically at the scheduled time. 
                The system fetches the current Bitcoin price and creates a transaction for you. 
                You can pause, edit, or delete at any time.
              </ThemedText>
            </div>
          </div>
        </ThemedCard>
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

