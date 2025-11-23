import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-helpers';
import { DCAScheduler } from '@/lib/dca-scheduler';

/**
 * POST /api/recurring-transactions/[id]/execute
 * Manually trigger execution of a recurring transaction
 * Useful for testing or allowing users to execute ahead of schedule
 */
export async function POST(
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

      console.log(`[DCA API] Manual execution requested for recurring transaction #${id} by user #${userId}`);

      // Execute the recurring transaction
      const result = await DCAScheduler.executeNow(id, userId);

      return NextResponse.json({
        success: true,
        data: result,
        message: 'Recurring transaction executed successfully'
      });
    } catch (error: any) {
      console.error('[DCA API] Error executing recurring transaction:', error);
      
      if (error.message === 'Recurring transaction not found') {
        return NextResponse.json({
          success: false,
          error: 'Recurring transaction not found'
        }, { status: 404 });
      }

      if (error.message === 'Recurring transaction is not active') {
        return NextResponse.json({
          success: false,
          error: 'Cannot execute inactive recurring transaction'
        }, { status: 400 });
      }

      if (error.message && error.message.includes('Failed to fetch')) {
        return NextResponse.json({
          success: false,
          error: 'Unable to fetch Bitcoin price. Please try again later.'
        }, { status: 503 });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to execute recurring transaction'
      }, { status: 500 });
    }
  });
}

