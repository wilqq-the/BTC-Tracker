import { NextRequest, NextResponse } from 'next/server';
import { CustomCurrencyService } from '@/lib/custom-currency-service';

/**
 * PUT /api/custom-currencies/[id]
 * Update a custom currency
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid currency ID'
      }, { status: 400 });
    }

    const body = await request.json();
    const { name, symbol } = body;

    if (!name && !symbol) {
      return NextResponse.json({
        success: false,
        error: 'At least one field (name or symbol) must be provided for update'
      }, { status: 400 });
    }

    const updatedCurrency = await CustomCurrencyService.updateCustomCurrency(id, {
      name,
      symbol
    });

    return NextResponse.json({
      success: true,
      data: updatedCurrency,
      message: `Custom currency ${updatedCurrency.code} updated successfully`
    });

  } catch (error) {
    console.error('Error updating custom currency:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: 'Custom currency not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update custom currency',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/custom-currencies/[id]
 * Delete (deactivate) a custom currency
 * Query parameter: ?permanent=true for hard delete
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid currency ID'
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      await CustomCurrencyService.permanentlyDeleteCustomCurrency(id);
    } else {
      await CustomCurrencyService.deleteCustomCurrency(id);
    }

    return NextResponse.json({
      success: true,
      message: `Custom currency ${permanent ? 'permanently deleted' : 'deleted'} successfully`
    });

  } catch (error) {
    console.error('Error deleting custom currency:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: 'Custom currency not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to delete custom currency',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 