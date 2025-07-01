import { NextRequest, NextResponse } from 'next/server';
import { AppInitializationService } from '@/lib/app-initialization';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Ensure app is initialized (this will be a no-op if already initialized)
    await AppInitializationService.initialize();
    
    // Get app initialization status
    const appStatus = AppInitializationService.getStatus();
    
    // Check database connectivity
    let dbStatus = 'disconnected';
    let dbStats = null;
    try {
      // Test database connection with a simple query
      const transactionCount = await prisma.bitcoinTransaction.count();
      const intradayCount = await prisma.bitcoinPriceIntraday.count();
      const historyCount = await prisma.bitcoinPriceHistory.count();
      
      dbStatus = 'connected';
      dbStats = {
        totalTransactions: transactionCount,
        intradayRecords: intradayCount,
        historicalRecords: historyCount,
      };
    } catch (error) {
      console.error('Database connectivity check failed:', error);
    }

    // Get latest price data info
    let latestPriceInfo = null;
    try {
      const latestPrice = await prisma.bitcoinCurrentPrice.findFirst({
        orderBy: { updatedAt: 'desc' }
      });
      
      if (latestPrice) {
        latestPriceInfo = {
          price: latestPrice.priceUsd,
          timestamp: latestPrice.timestamp,
          source: latestPrice.source,
          lastUpdate: latestPrice.updatedAt,
        };
      }
    } catch (error) {
      console.error('Error fetching latest price info:', error);
    }

    // Get latest intraday data info
    let intradayInfo = null;
    try {
      const latestIntraday = await prisma.bitcoinPriceIntraday.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      
      if (latestIntraday) {
        intradayInfo = {
          latestTimestamp: latestIntraday.timestamp,
          latestPrice: latestIntraday.priceUsd,
        };
      }
    } catch (error) {
      console.error('Error fetching intraday info:', error);
    }

    const status = {
      ...appStatus,
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        stats: dbStats,
      },
      priceData: {
        currentPrice: latestPriceInfo,
        intraday: intradayInfo,
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    };

    return NextResponse.json({
      success: true,
      status,
    });

  } catch (error) {
    console.error('Error getting system status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get system status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 