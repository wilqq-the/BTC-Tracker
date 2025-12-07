import { NextRequest, NextResponse } from 'next/server';
import { AppInitializationService } from '@/lib/app-initialization';
import { PriceScheduler } from '@/lib/price-scheduler';
import { DCAScheduler } from '@/lib/dca-scheduler';
import { prisma } from '@/lib/prisma';

export interface SubsystemStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  lastActivity?: string;
  nextScheduled?: string;
  details?: Record<string, any>;
}

export interface SystemStatusResponse {
  success: boolean;
  status: {
    timestamp: string;
    uptime: number;
    nodeVersion: string;
    environment: string;
    app: {
      isInitialized: boolean;
      isInitializing: boolean;
      processId: number;
    };
    subsystems: SubsystemStatus[];
    database: {
      status: 'connected' | 'disconnected' | 'error';
      stats?: {
        totalTransactions: number;
        intradayRecords: number;
        historicalRecords: number;
        recurringTransactions: number;
        activeRecurring: number;
      };
    };
    priceData: {
      currentPrice?: {
        price: number;
        change24h?: number;
        source: string;
        lastUpdate: string;
      };
      latestIntraday?: {
        timestamp: string;
        price: number;
      };
      latestHistorical?: {
        date: string;
        price: number;
      };
    };
    exchangeRates: {
      lastUpdate?: string;
      ratesCount: number;
      baseCurrency?: string;
    };
  };
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<SystemStatusResponse>> {
  try {
    // Ensure app is initialized (this will be a no-op if already initialized)
    await AppInitializationService.initialize();
    
    // Get app initialization status
    const appStatus = AppInitializationService.getStatus();
    
    // Get scheduler statuses
    const priceSchedulerStatus = PriceScheduler.getStatus();
    const dcaSchedulerStatus = DCAScheduler.getStatus();
    const dcaStats = await DCAScheduler.getStatistics();
    
    // Build subsystems array
    const subsystems: SubsystemStatus[] = [];
    
    // Price Scheduler - Live Price
    subsystems.push({
      name: 'Live Price Updates',
      status: priceSchedulerStatus.intradayActive ? 'running' : 'stopped',
      details: {
        interval: 'Every 5 minutes',
        description: 'Fetches live Bitcoin price from Yahoo Finance'
      }
    });
    
    // Price Scheduler - Historical
    subsystems.push({
      name: 'Historical Data Updates',
      status: priceSchedulerStatus.historicalActive ? 'running' : 'stopped',
      details: {
        interval: 'Every 24 hours',
        description: 'Updates daily historical price records'
      }
    });
    
    // Price Scheduler - Exchange Rates
    subsystems.push({
      name: 'Exchange Rate Updates',
      status: priceSchedulerStatus.exchangeRateActive ? 'running' : 'stopped',
      details: {
        interval: 'Every 4 hours',
        description: 'Updates currency exchange rates'
      }
    });
    
    // DCA Scheduler
    subsystems.push({
      name: 'DCA Scheduler',
      status: dcaSchedulerStatus.isRunning ? 'running' : 'stopped',
      details: {
        interval: 'Every hour',
        description: 'Executes recurring (DCA) transactions',
        activeTransactions: dcaStats.active,
        pausedTransactions: dcaStats.paused,
        totalExecutions: dcaStats.totalExecutions
      }
    });

    // Check database connectivity
    let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    let dbStats = null;
    try {
      // Test database connection with queries
      const [transactionCount, intradayCount, historyCount, recurringCount, activeRecurring] = await Promise.all([
        prisma.bitcoinTransaction.count(),
        prisma.bitcoinPriceIntraday.count(),
        prisma.bitcoinPriceHistory.count(),
        prisma.recurringTransaction.count(),
        prisma.recurringTransaction.count({ where: { isActive: true, isPaused: false } })
      ]);
      
      dbStatus = 'connected';
      dbStats = {
        totalTransactions: transactionCount,
        intradayRecords: intradayCount,
        historicalRecords: historyCount,
        recurringTransactions: recurringCount,
        activeRecurring: activeRecurring,
      };
      
      // Add database subsystem
      subsystems.push({
        name: 'Database',
        status: 'running',
        details: {
          transactions: transactionCount,
          intradayRecords: intradayCount,
          historicalRecords: historyCount
        }
      });
    } catch (error) {
      console.error('Database connectivity check failed:', error);
      dbStatus = 'error';
      subsystems.push({
        name: 'Database',
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Connection failed'
        }
      });
    }

    // Get latest price data info
    let priceDataInfo: SystemStatusResponse['status']['priceData'] = {};
    try {
      const latestPrice = await prisma.bitcoinCurrentPrice.findFirst({
        orderBy: { updatedAt: 'desc' }
      });
      
      if (latestPrice) {
        priceDataInfo.currentPrice = {
          price: latestPrice.priceUsd,
          change24h: latestPrice.priceChange24hPercent || undefined,
          source: latestPrice.source,
          lastUpdate: latestPrice.updatedAt.toISOString(),
        };
      }
      
      // Get latest intraday
      const latestIntraday = await prisma.bitcoinPriceIntraday.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      
      if (latestIntraday) {
        priceDataInfo.latestIntraday = {
          timestamp: latestIntraday.timestamp.toISOString(),
          price: latestIntraday.priceUsd,
        };
      }
      
      // Get latest historical
      const latestHistorical = await prisma.bitcoinPriceHistory.findFirst({
        orderBy: { date: 'desc' }
      });
      
      if (latestHistorical) {
        priceDataInfo.latestHistorical = {
          date: latestHistorical.date,
          price: latestHistorical.closeUsd,
        };
      }
    } catch (error) {
      console.error('Error fetching price data info:', error);
    }

    // Get exchange rate info
    let exchangeRateInfo: SystemStatusResponse['status']['exchangeRates'] = { ratesCount: 0 };
    try {
      const latestRate = await prisma.exchangeRate.findFirst({
        orderBy: { lastUpdated: 'desc' }
      });
      
      const ratesCount = await prisma.exchangeRate.count();
      
      exchangeRateInfo = {
        lastUpdate: latestRate?.lastUpdated.toISOString(),
        ratesCount,
        baseCurrency: latestRate?.fromCurrency
      };
    } catch (error) {
      console.error('Error fetching exchange rate info:', error);
    }

    const status: SystemStatusResponse['status'] = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      app: {
        isInitialized: appStatus.isInitialized,
        isInitializing: appStatus.isInitializing,
        processId: appStatus.processId,
      },
      subsystems,
      database: {
        status: dbStatus,
        stats: dbStats || undefined,
      },
      priceData: priceDataInfo,
      exchangeRates: exchangeRateInfo,
    };

    return NextResponse.json({
      success: true,
      status,
    });

  } catch (error) {
    console.error('Error getting system status:', error);
    return NextResponse.json({
      success: false,
      status: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        app: { isInitialized: false, isInitializing: false, processId: process.pid },
        subsystems: [],
        database: { status: 'error' },
        priceData: {},
        exchangeRates: { ratesCount: 0 },
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
