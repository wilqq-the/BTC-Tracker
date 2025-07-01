import { NextRequest, NextResponse } from 'next/server';
import { ExchangeRateService } from '@/lib/exchange-rate-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (from && to) {
      // Get specific exchange rate
      const rate = await ExchangeRateService.getExchangeRate(from, to);
      return NextResponse.json({
        from_currency: from,
        to_currency: to,
        rate,
        timestamp: new Date().toISOString()
      });
    } else {
      // Get all exchange rates
      const rates = await ExchangeRateService.getAllExchangeRates();
      return NextResponse.json({
        rates,
        count: rates.length,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { action } = await request.json();

    if (action === 'update') {
      // Manually trigger exchange rate update
      await ExchangeRateService.updateAllExchangeRates();
      return NextResponse.json({
        message: 'Exchange rates updated successfully',
        timestamp: new Date().toISOString()
      });
    } else if (action === 'clear_cache') {
      // Clear the cache
      ExchangeRateService.clearCache();
      return NextResponse.json({
        message: 'Exchange rate cache cleared',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "update" or "clear_cache"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating exchange rates:', error);
    return NextResponse.json(
      { error: 'Failed to update exchange rates' },
      { status: 500 }
    );
  }
} 