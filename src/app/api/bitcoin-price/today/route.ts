import { NextRequest, NextResponse } from 'next/server';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { withAuth } from '@/lib/auth-helpers';

// GET - Get today's real-time OHLC data (any authenticated user)
export async function GET(request: NextRequest) {
  return withAuth(request, () => getTodaysOHLC());
}

async function getTodaysOHLC(): Promise<NextResponse> {
  try {
    const todaysOHLC = await BitcoinPriceService.getTodaysOHLC();
    const currentPrice = await BitcoinPriceService.getCurrentPrice();
    
    return NextResponse.json({
      success: true,
      data: {
        todaysOHLC,
        currentPrice: currentPrice.price,
        lastUpdate: currentPrice.timestamp,
        source: currentPrice.source
      }
    });
    
  } catch (error) {
    console.error('[ERROR] Error fetching today\'s OHLC data:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch today\'s OHLC data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 