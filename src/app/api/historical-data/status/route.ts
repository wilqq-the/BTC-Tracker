import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface HistoricalDataStatusResponse {
  success: boolean;
  message: string;
  data?: {
    recordCount: number;
    lastUpdate: string;
    dateRange: {
      from: string;
      to: string;
    };
    dataQuality: {
      completeness: number; // percentage
      gaps: string[]; // missing dates
    };
  };
  error?: string;
}

// GET - Check historical data status
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get record count and date range using Prisma aggregation
    const [recordCount, dateRange] = await Promise.all([
      prisma.bitcoinPriceHistory.count(),
      prisma.bitcoinPriceHistory.aggregate({
        _min: { date: true, createdAt: true },
        _max: { date: true, createdAt: true }
      })
    ]);

    if (recordCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No historical data found',
        data: {
          recordCount: 0,
          lastUpdate: 'Never',
          dateRange: {
            from: '',
            to: ''
          },
          dataQuality: {
            completeness: 0,
            gaps: []
          }
        }
      } as HistoricalDataStatusResponse);
    }

    const earliestDate = dateRange._min.date!;
    const latestDate = dateRange._max.date!;
    const lastUpdate = dateRange._max.createdAt!;

    // Check for gaps in data - get all existing dates first
    const existingRecords = await prisma.bitcoinPriceHistory.findMany({
      select: { date: true },
      orderBy: { date: 'asc' }
    });

    const existingDates = new Set(existingRecords.map(record => record.date));
    
    // Generate expected date range and find gaps
    const gaps: string[] = [];
    const startDate = new Date(earliestDate);
    const endDate = new Date(latestDate);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!existingDates.has(dateStr)) {
        gaps.push(dateStr);
        // Limit to first 10 gaps to avoid overwhelming response
        if (gaps.length >= 10) break;
      }
    }

    // Calculate completeness percentage
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    const completeness = totalDays > 0 ? (recordCount / totalDays) * 100 : 0;

    const response: HistoricalDataStatusResponse = {
      success: true,
      message: `Historical data status: ${recordCount} records`,
      data: {
        recordCount,
        lastUpdate: lastUpdate ? new Date(lastUpdate).toLocaleString() : 'Unknown',
        dateRange: {
          from: earliestDate,
          to: latestDate
        },
        dataQuality: {
          completeness: Math.round(completeness * 100) / 100,
          gaps: gaps
        }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking historical data status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check historical data status',
      message: 'An error occurred while checking historical data status'
    } as HistoricalDataStatusResponse, { status: 500 });
  }
} 