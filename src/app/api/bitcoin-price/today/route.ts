import { NextResponse } from 'next/server';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';

// GET - Get today's real-time OHLC data
export async function GET(): Promise<NextResponse> {
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
    console.error('❌ Error fetching today\'s OHLC data:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch today\'s OHLC data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 