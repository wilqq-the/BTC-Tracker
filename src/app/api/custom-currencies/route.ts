import { NextRequest, NextResponse } from 'next/server';
import { CustomCurrencyService, CreateCustomCurrencyData } from '@/lib/custom-currency-service';

/**
 * GET /api/custom-currencies
 * Get all active custom currencies
 */
export async function GET(): Promise<NextResponse> {
  try {
    const customCurrencies = await CustomCurrencyService.getAllCustomCurrencies();
    
    return NextResponse.json({
      success: true,
      data: customCurrencies,
      message: 'Custom currencies retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting custom currencies:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve custom currencies',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/custom-currencies
 * Add a new custom currency
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { code, name, symbol } = body as CreateCustomCurrencyData;

    // Validate required fields
    if (!code || !name || !symbol) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: code, name, and symbol are required'
      }, { status: 400 });
    }

    const newCurrency = await CustomCurrencyService.addCustomCurrency({
      code,
      name,
      symbol
    });

    return NextResponse.json({
      success: true,
      data: newCurrency,
      message: `Custom currency ${newCurrency.code} added successfully`
    });

  } catch (error) {
    console.error('Error adding custom currency:', error);
    
    // Handle specific validation errors
    if (error instanceof Error) {
      if (error.message.includes('already exists') || 
          error.message.includes('already a built-in currency') ||
          error.message.includes('must be 3-4 uppercase letters')) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to add custom currency',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 