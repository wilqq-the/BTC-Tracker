import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-helpers';
import { RecurringTransactionService, CreateRecurringTransactionInput } from '@/lib/recurring-transaction-service';

/**
 * GET /api/recurring-transactions
 * Get all recurring transactions for the authenticated user
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      // Parse query parameters for filtering
      const { searchParams } = new URL(request.url);
      const isActive = searchParams.get('isActive');
      const isPaused = searchParams.get('isPaused');
      const frequency = searchParams.get('frequency');

      const filters: any = {};
      
      if (isActive !== null) {
        filters.isActive = isActive === 'true';
      }
      
      if (isPaused !== null) {
        filters.isPaused = isPaused === 'true';
      }
      
      if (frequency) {
        filters.frequency = frequency;
      }

      const transactions = await RecurringTransactionService.getAllForUser(userId, filters);

      return NextResponse.json({
        success: true,
        data: transactions
      });
    } catch (error) {
      console.error('Error fetching recurring transactions:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch recurring transactions'
      }, { status: 500 });
    }
  });
}

/**
 * POST /api/recurring-transactions
 * Create a new recurring transaction
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const body = await request.json();

      // Validate required fields
      if (!body.name || !body.amount || !body.currency || !body.frequency || !body.startDate) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: name, amount, currency, frequency, startDate'
        }, { status: 400 });
      }

      // Prepare input data
      const input: CreateRecurringTransactionInput = {
        userId,
        name: body.name,
        type: body.type || 'BUY',
        amount: parseFloat(body.amount),
        currency: body.currency,
        fees: body.fees ? parseFloat(body.fees) : undefined,
        feesCurrency: body.feesCurrency,
        frequency: body.frequency,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        maxOccurrences: body.maxOccurrences ? parseInt(body.maxOccurrences) : null,
        goalId: body.goalId ? parseInt(body.goalId) : null,
        notes: body.notes || '',
        tags: body.tags || ''
      };

      // Create recurring transaction
      const transaction = await RecurringTransactionService.create(input);

      return NextResponse.json({
        success: true,
        data: transaction,
        message: 'Recurring transaction created successfully'
      }, { status: 201 });
    } catch (error: any) {
      console.error('Error creating recurring transaction:', error);
      
      // Return validation errors with 400 status
      if (error.message && (
        error.message.includes('must be') ||
        error.message.includes('cannot be') ||
        error.message.includes('Invalid') ||
        error.message.includes('not found')
      )) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to create recurring transaction'
      }, { status: 500 });
    }
  });
}

