import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HistoricalDataService } from '@/lib/historical-data-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const all = searchParams.get('all') === 'true';
    
    // For 1 day, use intraday data for more granular view
    if (days === 1) {
      const intradayData = await prisma.bitcoinPriceIntraday.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        },
        orderBy: { timestamp: 'asc' },
        select: {
          timestamp: true,
          priceUsd: true,
          volume: true,
          createdAt: true
        }
      });

      // Convert to expected format and then to OHLC
      const formattedIntradayData = intradayData.map(item => ({
        timestamp: item.timestamp,
        price_usd: item.priceUsd,
        volume: item.volume,
        created_at: item.createdAt
      }));

      // Convert intraday data to OHLC format by grouping into hourly candles
      const ohlcData = convertIntradayToOHLC(formattedIntradayData);
          
      return NextResponse.json({
        success: true,
        data: ohlcData,
        count: ohlcData.length,
        source: 'intraday'
      });
    }

    // For other timeframes, use HistoricalDataService
    let dailyData;
    if (all || days >= 5000) {
      // Get all available data
      dailyData = await HistoricalDataService.getHistoricalData(10000); // Large number to get all data
    } else {
      // Get specific number of days
      dailyData = await HistoricalDataService.getHistoricalData(days);
    }

    const resultMessage = all || days >= 5000 ? 'all available data' : `${days} days of data`;
    console.log(`[DATA] Returning ${dailyData.length} records (${resultMessage})`);

    return NextResponse.json({
      success: true,
      data: dailyData,
      count: dailyData.length,
      source: 'daily'
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Database error',
      data: []
    }, { status: 500 });
  }
}

// Helper function to convert intraday price points to OHLC hourly candles
function convertIntradayToOHLC(intradayData: any[]) {
  if (!intradayData || intradayData.length === 0) {
    return [];
  }

  const hourlyCandles: { [key: string]: any } = {};
  
  intradayData.forEach(point => {
    // Group by hour - convert Date object to string first
    const timestampString = point.timestamp instanceof Date 
      ? point.timestamp.toISOString() 
      : point.timestamp;
    const hour = timestampString.substring(0, 13) + ':00:00'; // YYYY-MM-DD HH:00:00
    
    if (!hourlyCandles[hour]) {
      hourlyCandles[hour] = {
        date: hour,
        open_usd: point.price_usd,
        high_usd: point.price_usd,
        low_usd: point.price_usd,
        close_usd: point.price_usd,
        volume: point.volume || 0,
        count: 1
      };
    } else {
      // Update OHLC values
      hourlyCandles[hour].high_usd = Math.max(hourlyCandles[hour].high_usd, point.price_usd);
      hourlyCandles[hour].low_usd = Math.min(hourlyCandles[hour].low_usd, point.price_usd);
      hourlyCandles[hour].close_usd = point.price_usd; // Last price in the hour
      hourlyCandles[hour].volume += point.volume || 0;
      hourlyCandles[hour].count++;
    }
  });

  // Convert to array and sort by time
  return Object.values(hourlyCandles).sort((a: any, b: any) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
} 