import { NextRequest, NextResponse } from 'next/server';
import { HistoricalDataService } from '@/lib/historical-data-service';

// POST - Manually trigger historical data update
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[DATA] Manual historical data update triggered via API');
    
    const result = await HistoricalDataService.forceUpdate();
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[ERROR] Error in manual historical data update:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to update historical data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET - Check status of historical data
export async function GET(): Promise<NextResponse> {
  try {
    // Get latest data info
    const latestPrice = await HistoricalDataService.getLatestHistoricalPrice();
    
    return NextResponse.json({
      success: true,
      data: {
        latestPrice,
        hasData: latestPrice !== null,
        lastUpdate: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[ERROR] Error checking historical data status:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to check historical data status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 