/**
 * Recurring Transaction Service
 * Handles CRUD operations and business logic for automatic DCA transactions
 */

import { prisma } from './prisma';

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface CreateRecurringTransactionInput {
  userId: number;
  name: string;
  type: 'BUY' | 'SELL';
  amount: number;
  currency: string;
  fees?: number;
  feesCurrency?: string;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date | null;
  maxOccurrences?: number | null;
  goalId?: number | null;
  notes?: string;
  tags?: string;
}

export interface UpdateRecurringTransactionInput {
  name?: string;
  amount?: number;
  currency?: string;
  fees?: number;
  feesCurrency?: string;
  frequency?: RecurringFrequency;
  endDate?: Date | null;
  maxOccurrences?: number | null;
  isPaused?: boolean;
  notes?: string;
  tags?: string;
}

export class RecurringTransactionService {
  /**
   * Calculate the next execution date based on frequency
   */
  static calculateNextExecution(
    lastExecution: Date,
    frequency: RecurringFrequency
  ): Date {
    const next = new Date(lastExecution);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        // Handle month-end edge cases (e.g., Jan 31 -> Feb 28/29)
        const currentDay = next.getDate();
        next.setMonth(next.getMonth() + 1);
        // If day changed due to shorter month, set to last day of month
        if (next.getDate() !== currentDay) {
          next.setDate(0); // Sets to last day of previous month
        }
        break;
    }

    return next;
  }

  /**
   * Validate recurring transaction input
   */
  static validateInput(input: CreateRecurringTransactionInput): string | null {
    // Validate amount
    if (input.amount <= 0) {
      return 'Amount must be greater than 0';
    }

    // Validate fees
    if (input.fees !== undefined && input.fees < 0) {
      return 'Fees cannot be negative';
    }

    // Validate frequency
    const validFrequencies: RecurringFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly'];
    if (!validFrequencies.includes(input.frequency)) {
      return 'Invalid frequency. Must be: daily, weekly, biweekly, or monthly';
    }

    // Validate start date is not in the past (allow today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(input.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      return 'Start date cannot be in the past';
    }

    // Validate end date is after start date
    if (input.endDate) {
      const endDate = new Date(input.endDate);
      if (endDate <= startDate) {
        return 'End date must be after start date';
      }
    }

    // Validate max occurrences
    if (input.maxOccurrences !== undefined && input.maxOccurrences !== null && input.maxOccurrences < 1) {
      return 'Max occurrences must be at least 1';
    }

    return null;
  }

  /**
   * Create a new recurring transaction
   */
  static async create(
    input: CreateRecurringTransactionInput
  ) {
    // Validate input
    const validationError = this.validateInput(input);
    if (validationError) {
      throw new Error(validationError);
    }

    // If goalId is provided, verify it exists and belongs to user
    if (input.goalId) {
      const goal = await prisma.goal.findFirst({
        where: {
          id: input.goalId,
          userId: input.userId
        }
      });

      if (!goal) {
        throw new Error('Goal not found or does not belong to user');
      }
    }

    // Calculate next execution date
    const nextExecution = this.calculateNextExecution(
      input.startDate,
      input.frequency
    );

    // Create recurring transaction
    const recurringTx = await prisma.recurringTransaction.create({
      data: {
        userId: input.userId,
        name: input.name,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        fees: input.fees || 0,
        feesCurrency: input.feesCurrency || input.currency,
        frequency: input.frequency,
        startDate: input.startDate,
        endDate: input.endDate || null,
        maxOccurrences: input.maxOccurrences || null,
        nextExecution: nextExecution,
        goalId: input.goalId || null,
        notes: input.notes || '',
        tags: input.tags || ''
      }
    });

    return recurringTx;
  }

  /**
   * Get all recurring transactions for a user
   */
  static async getAllForUser(
    userId: number,
    filters?: {
      isActive?: boolean;
      isPaused?: boolean;
      frequency?: RecurringFrequency;
    }
  ) {
    const where: any = { userId };

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.isPaused !== undefined) {
      where.isPaused = filters.isPaused;
    }

    if (filters?.frequency) {
      where.frequency = filters.frequency;
    }

    const transactions = await prisma.recurringTransaction.findMany({
      where,
      include: {
        goal: {
          select: {
            id: true,
            name: true,
            targetBtcAmount: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { isPaused: 'asc' },
        { nextExecution: 'asc' }
      ]
    });

    return transactions;
  }

  /**
   * Get a single recurring transaction by ID
   */
  static async getById(id: number, userId: number) {
    const transaction = await prisma.recurringTransaction.findFirst({
      where: {
        id,
        userId
      },
      include: {
        goal: {
          select: {
            id: true,
            name: true,
            targetBtcAmount: true
          }
        }
      }
    });

    if (!transaction) {
      throw new Error('Recurring transaction not found');
    }

    return transaction;
  }

  /**
   * Update a recurring transaction
   */
  static async update(
    id: number,
    userId: number,
    input: UpdateRecurringTransactionInput
  ) {
    // Verify transaction exists and belongs to user
    await this.getById(id, userId);

    // Build update data
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.amount !== undefined) {
      if (input.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      updateData.amount = input.amount;
    }
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.fees !== undefined) {
      if (input.fees < 0) {
        throw new Error('Fees cannot be negative');
      }
      updateData.fees = input.fees;
    }
    if (input.feesCurrency !== undefined) updateData.feesCurrency = input.feesCurrency;
    if (input.frequency !== undefined) {
      const validFrequencies: RecurringFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly'];
      if (!validFrequencies.includes(input.frequency)) {
        throw new Error('Invalid frequency');
      }
      updateData.frequency = input.frequency;
    }
    if (input.endDate !== undefined) updateData.endDate = input.endDate;
    if (input.maxOccurrences !== undefined) {
      if (input.maxOccurrences !== null && input.maxOccurrences < 1) {
        throw new Error('Max occurrences must be at least 1');
      }
      updateData.maxOccurrences = input.maxOccurrences;
    }
    if (input.isPaused !== undefined) updateData.isPaused = input.isPaused;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.tags !== undefined) updateData.tags = input.tags;

    const updated = await prisma.recurringTransaction.update({
      where: { id },
      data: updateData,
      include: {
        goal: {
          select: {
            id: true,
            name: true,
            targetBtcAmount: true
          }
        }
      }
    });

    return updated;
  }

  /**
   * Pause or resume a recurring transaction
   */
  static async togglePause(id: number, userId: number, isPaused: boolean) {
    await this.getById(id, userId);

    const updated = await prisma.recurringTransaction.update({
      where: { id },
      data: { isPaused }
    });

    return updated;
  }

  /**
   * Delete a recurring transaction (soft delete by marking inactive)
   */
  static async delete(id: number, userId: number) {
    await this.getById(id, userId);

    const deleted = await prisma.recurringTransaction.update({
      where: { id },
      data: {
        isActive: false,
        isPaused: true
      }
    });

    return deleted;
  }

  /**
   * Hard delete a recurring transaction (permanent)
   */
  static async hardDelete(id: number, userId: number) {
    await this.getById(id, userId);

    await prisma.recurringTransaction.delete({
      where: { id }
    });

    return true;
  }

  /**
   * Check if a recurring transaction should be auto-paused
   * Returns true if it should be paused
   */
  static shouldAutoPause(
    executionCount: number,
    maxOccurrences: number | null,
    nextExecution: Date,
    endDate: Date | null
  ): boolean {
    // Check if max occurrences reached
    if (maxOccurrences !== null && executionCount >= maxOccurrences) {
      return true;
    }

    // Check if end date passed
    if (endDate !== null) {
      const now = new Date();
      if (now >= endDate) {
        return true;
      }
    }

    return false;
  }
}

