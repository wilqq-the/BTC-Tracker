/**
 * Recurring Transaction Modal
 * Comprehensive modal for creating/editing recurring Bitcoin purchases
 * Full validation, currency support, and goal linking
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ThemedButton } from './ui/ThemeProvider';

interface Goal {
  id: number;
  name: string;
  targetBtcAmount: number;
}

interface RecurringTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingTransaction?: any;
}

interface FormData {
  name: string;
  amount: string;
  currency: string;
  fees: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  endType: 'never' | 'date' | 'occurrences';
  endDate: string;
  maxOccurrences: string;
  goalId: string;
  notes: string;
  tags: string;
}

const initialFormData: FormData = {
  name: '',
  amount: '10',
  currency: 'USD',
  fees: '0',
  frequency: 'daily',
  startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
  endType: 'never',
  endDate: '',
  maxOccurrences: '',
  goalId: '',
  notes: '',
  tags: 'DCA,Automatic'
};

export default function RecurringTransactionModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  editingTransaction 
}: RecurringTransactionModalProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number | null>(null);

  // Load goals and BTC price on mount
  useEffect(() => {
    if (isOpen) {
      loadGoals();
      loadBtcPrice();
      setIsAnimating(true);
      
      // Generate name if empty
      if (!editingTransaction && !formData.name) {
        generateDefaultName();
      }
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Load editing data
  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        name: editingTransaction.name,
        amount: editingTransaction.amount.toString(),
        currency: editingTransaction.currency,
        fees: editingTransaction.fees.toString(),
        frequency: editingTransaction.frequency,
        startDate: new Date(editingTransaction.startDate).toISOString().split('T')[0],
        endType: editingTransaction.endDate ? 'date' : editingTransaction.maxOccurrences ? 'occurrences' : 'never',
        endDate: editingTransaction.endDate ? new Date(editingTransaction.endDate).toISOString().split('T')[0] : '',
        maxOccurrences: editingTransaction.maxOccurrences?.toString() || '',
        goalId: editingTransaction.goalId?.toString() || '',
        notes: editingTransaction.notes || '',
        tags: editingTransaction.tags || 'DCA,Automatic'
      });
    } else {
      setFormData(initialFormData);
    }
  }, [editingTransaction]);

  const loadGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const result = await response.json();
      if (result.success && result.data) {
        setGoals(result.data.filter((g: any) => !g.is_completed));
      }
    } catch (err) {
      console.error('Error loading goals:', err);
    }
  };

  const loadBtcPrice = async () => {
    try {
      const response = await fetch('/api/bitcoin-price');
      const result = await response.json();
      if (result.success && result.data) {
        setCurrentBtcPrice(result.data.price);
      }
    } catch (err) {
      console.error('Error loading BTC price:', err);
    }
  };

  const generateDefaultName = () => {
    const freq = formData.frequency.charAt(0).toUpperCase() + formData.frequency.slice(1);
    setFormData(prev => ({
      ...prev,
      name: `${freq} DCA ${formData.currency} ${formData.amount}`
    }));
  };

  const calculateEstimatedBtc = () => {
    if (!currentBtcPrice || !formData.amount) return null;
    const amount = parseFloat(formData.amount);
    if (isNaN(amount)) return null;
    return (amount / currentBtcPrice).toFixed(8);
  };

  const calculateMonthlyTotal = () => {
    const amount = parseFloat(formData.amount);
    if (isNaN(amount)) return null;

    const multipliers: Record<string, number> = {
      'daily': 30,
      'weekly': 4.33,
      'biweekly': 2.17,
      'monthly': 1
    };

    return (amount * multipliers[formData.frequency]).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const fees = parseFloat(formData.fees);
      if (isNaN(fees) || fees < 0) {
        throw new Error('Fees cannot be negative');
      }

      if (formData.endType === 'date' && !formData.endDate) {
        throw new Error('Please select an end date');
      }

      if (formData.endType === 'occurrences') {
        const occurrences = parseInt(formData.maxOccurrences);
        if (isNaN(occurrences) || occurrences < 1) {
          throw new Error('Occurrences must be at least 1');
        }
      }

      // Prepare payload
      const payload: any = {
        name: formData.name || `${formData.frequency} DCA ${formData.currency} ${formData.amount}`,
        type: 'BUY',
        amount: amount,
        currency: formData.currency,
        fees: fees,
        feesCurrency: formData.currency,
        frequency: formData.frequency,
        startDate: formData.startDate,
        notes: formData.notes,
        tags: formData.tags
      };

      if (formData.endType === 'date') {
        payload.endDate = formData.endDate;
      } else if (formData.endType === 'occurrences') {
        payload.maxOccurrences = parseInt(formData.maxOccurrences);
      }

      if (formData.goalId) {
        payload.goalId = parseInt(formData.goalId);
      }

      // Submit
      const url = editingTransaction 
        ? `/api/recurring-transactions/${editingTransaction.id}`
        : '/api/recurring-transactions';
      
      const method = editingTransaction ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to save recurring transaction');
      }
    } catch (err: any) {
      console.error('Error saving:', err);
      setError(err.message || 'Failed to save recurring transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 200);
  };

  if (!isOpen && !isAnimating) return null;

  const estimatedBtc = calculateEstimatedBtc();
  const monthlyTotal = calculateMonthlyTotal();

  const modalContent = (
    <div 
      className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 transition-opacity duration-200 p-4 overflow-y-auto ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl my-8 shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 max-h-[calc(100vh-4rem)] flex flex-col ${
          isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {editingTransaction ? '✏️ Edit' : '➕ Add'} Recurring Purchase
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Set up automatic Bitcoin purchases on a schedule
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-5 overflow-y-auto flex-1 pr-2 -mr-2">
            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm text-red-400 flex-1">{error}</p>
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onBlur={() => !formData.name && generateDefaultName()}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-gray-900 dark:text-gray-100 transition-all"
                placeholder="e.g., Daily DCA $10"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave empty for auto-generated name
              </p>
            </div>

            {/* Amount & Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount per Purchase
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-gray-900 dark:text-gray-100"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="PLN">PLN</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
            </div>

            {/* BTC Estimate */}
            {estimatedBtc && (
              <div className="bg-bitcoin/10 border border-bitcoin/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ≈ <span className="font-mono font-bold text-bitcoin">{estimatedBtc} BTC</span> per purchase
                  </span>
                  {monthlyTotal && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      ≈ <span className="font-bold text-bitcoin">{formData.currency} {monthlyTotal}</span>/month
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Frequency
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFormData({ ...formData, frequency: freq })}
                    className={`py-3 px-4 rounded-lg font-medium transition-all ${
                      formData.frequency === freq
                        ? 'bg-bitcoin text-white shadow-lg scale-105'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {freq === 'biweekly' ? 'Bi-weekly' : freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            {/* End Condition */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                End Condition
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <input
                    type="radio"
                    name="endType"
                    value="never"
                    checked={formData.endType === 'never'}
                    onChange={(e) => setFormData({ ...formData, endType: e.target.value as any })}
                    className="w-4 h-4 text-bitcoin"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Never</strong> - Continue indefinitely
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <input
                    type="radio"
                    name="endType"
                    value="date"
                    checked={formData.endType === 'date'}
                    onChange={(e) => setFormData({ ...formData, endType: e.target.value as any })}
                    className="w-4 h-4 text-bitcoin"
                  />
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Until Date</strong>
                    </span>
                    {formData.endType === 'date' && (
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        min={formData.startDate}
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-sm text-gray-900 dark:text-gray-100"
                      />
                    )}
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <input
                    type="radio"
                    name="endType"
                    value="occurrences"
                    checked={formData.endType === 'occurrences'}
                    onChange={(e) => setFormData({ ...formData, endType: e.target.value as any })}
                    className="w-4 h-4 text-bitcoin"
                  />
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>After</strong>
                    </span>
                    {formData.endType === 'occurrences' && (
                      <>
                        <input
                          type="number"
                          min="1"
                          value={formData.maxOccurrences}
                          onChange={(e) => setFormData({ ...formData, maxOccurrences: e.target.value })}
                          className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-sm text-gray-900 dark:text-gray-100"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">purchases</span>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Link to Goal */}
            {goals.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Link to Goal (Optional)
                </label>
                <select
                  value={formData.goalId}
                  onChange={(e) => setFormData({ ...formData, goalId: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-gray-900 dark:text-gray-100"
                >
                  <option value="">No goal</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      🎯 {goal.name} ({goal.targetBtcAmount} BTC)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fees */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fees (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.fees}
                onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-gray-900 dark:text-gray-100 resize-none"
                placeholder="Add any notes about this recurring purchase..."
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags (Optional)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bitcoin focus:border-transparent text-gray-900 dark:text-gray-100"
                placeholder="e.g., DCA,Automatic,Long-term"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Separate tags with commas
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <ThemedButton
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </ThemedButton>
            <ThemedButton
              type="submit"
              variant="primary"
              className="flex-1 bg-bitcoin hover:bg-bitcoin-dark"
              disabled={loading}
            >
              {loading ? 'Saving...' : editingTransaction ? '💾 Update' : '➕ Create'}
            </ThemedButton>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}

