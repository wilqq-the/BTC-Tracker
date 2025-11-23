import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-helpers';
import { RecurringTransactionService, UpdateRecurringTransactionInput } from '@/lib/recurring-transaction-service';

/**
 * GET /api/recurring-transactions/[id]
 * Get a specific recurring transaction by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const { id: idParam } = await params;
      const id = parseInt(idParam);
      
      if (isNaN(id)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid transaction ID'
        }, { status: 400 });
      }

      const transaction = await RecurringTransactionService.getById(id, userId);

      return NextResponse.json({
        success: true,
        data: transaction
      });
    } catch (error: any) {
      console.error('Error fetching recurring transaction:', error);
      
      if (error.message === 'Recurring transaction not found') {
        return NextResponse.json({
          success: false,
          error: 'Recurring transaction not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch recurring transaction'
      }, { status: 500 });
    }
  });
}

/**
 * PUT /api/recurring-transactions/[id]
 * Update a recurring transaction
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const { id: idParam } = await params;
      const id = parseInt(idParam);
      
      if (isNaN(id)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid transaction ID'
        }, { status: 400 });
      }

      const body = await request.json();

      // Prepare update data
      const input: UpdateRecurringTransactionInput = {};
      
      if (body.name !== undefined) input.name = body.name;
      if (body.amount !== undefined) input.amount = parseFloat(body.amount);
      if (body.currency !== undefined) input.currency = body.currency;
      if (body.fees !== undefined) input.fees = parseFloat(body.fees);
      if (body.feesCurrency !== undefined) input.feesCurrency = body.feesCurrency;
      if (body.frequency !== undefined) input.frequency = body.frequency;
      if (body.endDate !== undefined) input.endDate = body.endDate ? new Date(body.endDate) : null;
      if (body.maxOccurrences !== undefined) input.maxOccurrences = body.maxOccurrences ? parseInt(body.maxOccurrences) : null;
      if (body.isPaused !== undefined) input.isPaused = body.isPaused;
      if (body.notes !== undefined) input.notes = body.notes;
      if (body.tags !== undefined) input.tags = body.tags;

      const transaction = await RecurringTransactionService.update(id, userId, input);

      return NextResponse.json({
        success: true,
        data: transaction,
        message: 'Recurring transaction updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating recurring transaction:', error);
      
      if (error.message === 'Recurring transaction not found') {
        return NextResponse.json({
          success: false,
          error: 'Recurring transaction not found'
        }, { status: 404 });
      }

      // Return validation errors with 400 status
      if (error.message && (
        error.message.includes('must be') ||
        error.message.includes('cannot be') ||
        error.message.includes('Invalid')
      )) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to update recurring transaction'
      }, { status: 500 });
    }
  });
}

/**
 * DELETE /api/recurring-transactions/[id]
 * Delete a recurring transaction (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    try {
      const { id: idParam } = await params;
      const id = parseInt(idParam);
      
      if (isNaN(id)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid transaction ID'
        }, { status: 400 });
      }

      // Check if hard delete is requested
      const { searchParams } = new URL(request.url);
      const hard = searchParams.get('hard') === 'true';

      if (hard) {
        await RecurringTransactionService.hardDelete(id, userId);
      } else {
        await RecurringTransactionService.delete(id, userId);
      }

      return NextResponse.json({
        success: true,
        message: 'Recurring transaction deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting recurring transaction:', error);
      
      if (error.message === 'Recurring transaction not found') {
        return NextResponse.json({
          success: false,
          error: 'Recurring transaction not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to delete recurring transaction'
      }, { status: 500 });
    }
  });
}

