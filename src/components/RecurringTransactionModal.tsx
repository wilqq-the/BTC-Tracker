'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Icons
import {
  AlertCircleIcon,
  CalendarIcon,
  CoinsIcon,
  TargetIcon,
  TagIcon,
  StickyNoteIcon,
  CalendarClockIcon,
  HashIcon,
  InfinityIcon,
} from 'lucide-react';

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
  startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
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
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadGoals();
      loadBtcPrice();
      if (!editingTransaction && !formData.name) {
        generateDefaultName();
      }
    }
  }, [isOpen]);

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

  const estimatedBtc = calculateEstimatedBtc();
  const monthlyTotal = calculateMonthlyTotal();

  const frequencies = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold tracking-tight">
            {editingTransaction ? 'Edit recurring purchase' : 'Add recurring purchase'}
          </DialogTitle>
          <DialogDescription>
            Buy a fixed amount of bitcoin automatically on a schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 rounded-2xl bg-tint-red p-3 text-sm font-semibold text-tint-red-fg">
              <AlertCircleIcon className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onBlur={() => !formData.name && generateDefaultName()}
              placeholder="Daily DCA $10"
            />
            <p className="text-xs text-muted-foreground">Leave it empty and a name is made for you.</p>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount per purchase</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full h-10 px-3 bg-background border border-input rounded-md"
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
            <div className="card-solid rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CoinsIcon className="size-4" />
                  About <span className="font-bold text-primary-strong tabular-nums">{estimatedBtc} BTC</span> per purchase
                </span>
                {monthlyTotal && (
                  <span className="text-muted-foreground">
                    About <span className="font-bold text-foreground tabular-nums">{formData.currency} {monthlyTotal}</span> a month
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Frequency */}
          <div className="space-y-3">
            <Label>Frequency</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Frequency">
              {frequencies.map((freq) => (
                <button
                  key={freq.value}
                  type="button"
                  role="radio"
                  aria-checked={formData.frequency === freq.value}
                  onClick={() => setFormData({ ...formData, frequency: freq.value as any })}
                  className={cn(
                    "h-10 rounded-full px-4 text-sm font-bold transition-colors",
                    formData.frequency === freq.value
                      ? 'bg-tint-orange text-primary-strong ring-2 ring-primary'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate" className="flex items-center gap-1">
              <CalendarIcon className="size-4" />
              Start date
            </Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* End Condition */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1">
              <CalendarClockIcon className="size-4" />
              Ends
            </Label>
            <div className="space-y-2">
              {/* Never */}
              <label className={cn(
                "card-solid flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl p-3",
                formData.endType === 'never' && 'outline outline-2 -outline-offset-1 outline-primary'
              )}>
                <input
                  type="radio"
                  name="endType"
                  value="never"
                  checked={formData.endType === 'never'}
                  onChange={(e) => setFormData({ ...formData, endType: e.target.value as any })}
                  className="sr-only"
                />
                <InfinityIcon className="size-4 text-muted-foreground" />
                <span className="text-sm"><strong>Never</strong> <span className="text-muted-foreground">until you pause or delete it</span></span>
              </label>

              {/* Until Date */}
              <label className={cn(
                "card-solid flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl p-3",
                formData.endType === 'date' && 'outline outline-2 -outline-offset-1 outline-primary'
              )}>
                <input
                  type="radio"
                  name="endType"
                  value="date"
                  checked={formData.endType === 'date'}
                  onChange={(e) => setFormData({ ...formData, endType: e.target.value as any })}
                  className="sr-only"
                />
                <CalendarIcon className="size-4 text-muted-foreground" />
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-sm"><strong>On a date</strong></span>
                  {formData.endType === 'date' && (
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      min={formData.startDate}
                      className="flex-1 h-8"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </label>

              {/* After X occurrences */}
              <label className={cn(
                "card-solid flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl p-3",
                formData.endType === 'occurrences' && 'outline outline-2 -outline-offset-1 outline-primary'
              )}>
                <input
                  type="radio"
                  name="endType"
                  value="occurrences"
                  checked={formData.endType === 'occurrences'}
                  onChange={(e) => setFormData({ ...formData, endType: e.target.value as any })}
                  className="sr-only"
                />
                <HashIcon className="size-4 text-muted-foreground" />
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm"><strong>After</strong></span>
                  {formData.endType === 'occurrences' && (
                    <>
                      <Input
                        type="number"
                        min="1"
                        value={formData.maxOccurrences}
                        onChange={(e) => setFormData({ ...formData, maxOccurrences: e.target.value })}
                        className="w-20 h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm">purchases</span>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Link to Goal */}
          {goals.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="goalId" className="flex items-center gap-1">
                <TargetIcon className="size-4" />
                Link to a goal <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <select
                id="goalId"
                value={formData.goalId}
                onChange={(e) => setFormData({ ...formData, goalId: e.target.value })}
                className="w-full h-10 px-3 bg-background border border-input rounded-md"
              >
                <option value="">No goal</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name} ({goal.targetBtcAmount} BTC)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fees */}
          <div className="space-y-2">
            <Label htmlFor="fees">Fees <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="fees"
              type="number"
              step="0.01"
              min="0"
              value={formData.fees}
              onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-1">
              <StickyNoteIcon className="size-4" />
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-input rounded-md resize-none text-sm"
              placeholder="Add any notes about this recurring purchase..."
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="flex items-center gap-1">
              <TagIcon className="size-4" />
              Tags <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="DCA,Automatic,Long-term"
            />
            <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-full" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-full font-bold" disabled={loading}>
              {loading ? 'Saving...' : editingTransaction ? 'Save changes' : 'Create recurring purchase'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
