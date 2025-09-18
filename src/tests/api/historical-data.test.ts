import { NextRequest } from 'next/server';
import { GET as getHistoricalData } from '@/app/api/historical-data/route';
import { GET as getHistoricalDataStatus } from '@/app/api/historical-data/status/route';
import { GET as getUpdateStatus, POST as postUpdate } from '@/app/api/historical-data/update/route';
import { POST as postFetch } from '@/app/api/historical-data/fetch/route';
import { setupTestDatabase, cleanTestDatabase } from '../test-db';
import { HistoricalDataService } from '@/lib/historical-data-service';
import { SettingsService } from '@/lib/settings-service';
import { YahooFinanceService } from '@/lib/yahoo-finance-service';
import { prisma } from '@/lib/prisma';

// Mock the services
jest.mock('@/lib/historical-data-service');
jest.mock('@/lib/settings-service');
jest.mock('@/lib/yahoo-finance-service');

const mockHistoricalDataService = HistoricalDataService as jest.Mocked<typeof HistoricalDataService>;
const mockSettingsService = SettingsService as jest.Mocked<typeof SettingsService>;
const mockYahooFinanceService = YahooFinanceService as jest.Mocked<typeof YahooFinanceService>;

// Test data
const mockHistoricalData = [
  {
    id: 1,
    date: '2024-01-01',
    open_usd: 42000,
    high_usd: 43000,
    low_usd: 41000,
    close_usd: 42500,
    volume: 1000000000,
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    date: '2024-01-02',
    open_usd: 42500,
    high_usd: 44000,
    low_usd: 42000,
    close_usd: 43500,
    volume: 1200000000,
    created_at: '2024-01-02T00:00:00.000Z'
  },
  {
    id: 3,
    date: '2024-01-03',
    open_usd: 43500,
    high_usd: 45000,
    low_usd: 43000,
    close_usd: 44000,
    volume: 1100000000,
    created_at: '2024-01-03T00:00:00.000Z'
  }
];

const mockIntradayData = [
  {
    timestamp: '2024-01-03T10:00:00.000Z',
    priceUsd: 43800,
    volume: 50000000,
    createdAt: new Date('2024-01-03T10:00:00.000Z')
  },
  {
    timestamp: '2024-01-03T11:00:00.000Z',
    priceUsd: 44200,
    volume: 60000000,
    createdAt: new Date('2024-01-03T11:00:00.000Z')
  },
  {
    timestamp: '2024-01-03T12:00:00.000Z',
    priceUsd: 44000,
    volume: 55000000,
    createdAt: new Date('2024-01-03T12:00:00.000Z')
  }
];

describe('Historical Data API', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    jest.clearAllMocks();
    
    // Reset console.log and console.error to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  }, 30000); // Increase timeout to 30 seconds

  afterEach(async () => {
    await cleanTestDatabase();
    jest.restoreAllMocks();
  });

  describe('GET /api/historical-data', () => {
    beforeEach(async () => {
      // Seed historical data
      await prisma.bitcoinPriceHistory.createMany({
        data: mockHistoricalData.map(item => ({
          date: item.date,
          openUsd: item.open_usd,
          highUsd: item.high_usd,
          lowUsd: item.low_usd,
          closeUsd: item.close_usd,
          volume: item.volume
        }))
      });
    }, 30000); // Increase timeout

    it('should return daily historical data for default period', async () => {
      mockHistoricalDataService.getHistoricalData.mockResolvedValue(mockHistoricalData);

      const request = new NextRequest('http://localhost:3000/api/historical-data');
      const response = await getHistoricalData(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe('daily');
      expect(data.data).toHaveLength(3);
      expect(data.count).toBe(3);
      expect(mockHistoricalDataService.getHistoricalData).toHaveBeenCalledWith(30);
    });

    it('should return historical data for specified days', async () => {
      mockHistoricalDataService.getHistoricalData.mockResolvedValue(mockHistoricalData);

      const request = new NextRequest('http://localhost:3000/api/historical-data?days=7');
      const response = await getHistoricalData(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe('daily');
      expect(mockHistoricalDataService.getHistoricalData).toHaveBeenCalledWith(7);
    });

    it('should return all available data when all=true', async () => {
      mockHistoricalDataService.getHistoricalData.mockResolvedValue(mockHistoricalData);

      const request = new NextRequest('http://localhost:3000/api/historical-data?all=true');
      const response = await getHistoricalData(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe('daily');
      expect(mockHistoricalDataService.getHistoricalData).toHaveBeenCalledWith(10000);
    });

    it('should return intraday data converted to OHLC for 1 day', async () => {
      // Seed intraday data from last 24 hours
      const now = new Date();
      const recentData = [
        {
          timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
          priceUsd: 43800,
          volume: 50000000,
          createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000)
        },
        {
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          priceUsd: 44200,
          volume: 60000000,
          createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
        },
        {
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
          priceUsd: 44000,
          volume: 55000000,
          createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000)
        }
      ];

      await prisma.bitcoinPriceIntraday.createMany({
        data: recentData
      });

      const request = new NextRequest('http://localhost:3000/api/historical-data?days=1');
      const response = await getHistoricalData(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe('intraday');
      expect(data.data.length).toBeGreaterThan(0); // Should have some hourly candles
      if (data.data.length > 0) {
        expect(data.data[0]).toHaveProperty('date');
        expect(data.data[0]).toHaveProperty('open_usd');
        expect(data.data[0]).toHaveProperty('high_usd');
        expect(data.data[0]).toHaveProperty('low_usd');
        expect(data.data[0]).toHaveProperty('close_usd');
        expect(data.data[0]).toHaveProperty('volume');
      }
    });

    it('should handle database errors gracefully', async () => {
      mockHistoricalDataService.getHistoricalData.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/historical-data');
      const response = await getHistoricalData(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Database error');
      expect(data.data).toEqual([]);
    });
  });

  describe('GET /api/historical-data/status', () => {
    it('should return status when no historical data exists', async () => {
      const request = new NextRequest('http://localhost:3000/api/historical-data/status');
      const response = await getHistoricalDataStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('No historical data found');
      expect(data.data.recordCount).toBe(0);
      expect(data.data.lastUpdate).toBe('Never');
      expect(data.data.dateRange.from).toBe('');
      expect(data.data.dateRange.to).toBe('');
      expect(data.data.dataQuality.completeness).toBe(0);
      expect(data.data.dataQuality.gaps).toEqual([]);
    });

    it('should return comprehensive status when historical data exists', async () => {
      // Seed historical data with some gaps
      await prisma.bitcoinPriceHistory.createMany({
        data: [
          {
            date: '2024-01-01',
            openUsd: 42000,
            highUsd: 43000,
            lowUsd: 41000,
            closeUsd: 42500,
            volume: 1000000000
          },
          // Missing 2024-01-02 to create a gap
          {
            date: '2024-01-03',
            openUsd: 43500,
            highUsd: 45000,
            lowUsd: 43000,
            closeUsd: 44000,
            volume: 1100000000
          }
        ]
      });

      const request = new NextRequest('http://localhost:3000/api/historical-data/status');
      const response = await getHistoricalDataStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Historical data status: 2 records');
      expect(data.data.recordCount).toBe(2);
      expect(data.data.dateRange.from).toBe('2024-01-01');
      expect(data.data.dateRange.to).toBe('2024-01-03');
      expect(data.data.dataQuality.gaps).toContain('2024-01-02');
      expect(data.data.dataQuality.completeness).toBeLessThan(100);
    });

    it('should handle database errors gracefully', async () => {
      // Mock prisma to throw an error
      const originalCount = prisma.bitcoinPriceHistory.count;
      jest.spyOn(prisma.bitcoinPriceHistory, 'count').mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/historical-data/status');
      const response = await getHistoricalDataStatus(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to check historical data status');

      // Restore the original method
      prisma.bitcoinPriceHistory.count = originalCount;
    });
  });

  describe('GET /api/historical-data/update', () => {
    it('should return latest price status when data exists', async () => {
      mockHistoricalDataService.getLatestHistoricalPrice.mockResolvedValue(44000);

      const response = await getUpdateStatus();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.latestPrice).toBe(44000);
      expect(data.data.hasData).toBe(true);
      expect(data.data.lastUpdate).toBeDefined();
    });

    it('should return status when no data exists', async () => {
      mockHistoricalDataService.getLatestHistoricalPrice.mockResolvedValue(null);

      const response = await getUpdateStatus();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.latestPrice).toBe(null);
      expect(data.data.hasData).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      mockHistoricalDataService.getLatestHistoricalPrice.mockRejectedValue(new Error('Service error'));

      const response = await getUpdateStatus();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Service error');
    });
  });

  describe('POST /api/historical-data/update', () => {
    it('should trigger historical data update successfully', async () => {
      mockHistoricalDataService.forceUpdate.mockResolvedValue({
        success: true,
        message: 'Historical data updated successfully',
        recordsAdded: 100
      });

      const request = new NextRequest('http://localhost:3000/api/historical-data/update', {
        method: 'POST'
      });
      const response = await postUpdate(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Historical data updated successfully');
      expect(data.recordsAdded).toBe(100);
      expect(mockHistoricalDataService.forceUpdate).toHaveBeenCalled();
    });

    it('should handle update failures gracefully', async () => {
      mockHistoricalDataService.forceUpdate.mockRejectedValue(new Error('Update failed'));

      const request = new NextRequest('http://localhost:3000/api/historical-data/update', {
        method: 'POST'
      });
      const response = await postUpdate(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to update historical data');
      expect(data.error).toBe('Update failed');
    });
  });

  describe('POST /api/historical-data/fetch', () => {
    beforeEach(() => {
      mockSettingsService.getPriceDataSettings.mockResolvedValue({
        historicalDataPeriod: '1Y',
        intradayInterval: '1h',
        priceUpdateInterval: 300,
        liveUpdateInterval: 60,
        enableIntradayData: true,
        maxHistoricalDays: 365,
        dataRetentionDays: 365,
        maxIntradayDays: 7
      });
      mockYahooFinanceService.fetchHistoricalData.mockResolvedValue(mockHistoricalData);
      mockYahooFinanceService.saveHistoricalData.mockResolvedValue(undefined);
    });

    it('should fetch historical data with period from request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/historical-data/fetch', {
        method: 'POST',
        body: JSON.stringify({ period: '6M' })
      });
      const response = await postFetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully fetched 3 historical records for 6M');
      expect(data.data.recordsAdded).toBe(3);
      expect(data.data.dateRange.from).toBe('2024-01-01');
      expect(data.data.dateRange.to).toBe('2024-01-03');
      expect(mockYahooFinanceService.fetchHistoricalData).toHaveBeenCalledWith('6mo');
      expect(mockYahooFinanceService.saveHistoricalData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            date: '2024-01-01',
            open_usd: 42000,
            high_usd: 43000,
            low_usd: 41000,
            close_usd: 42500,
            volume: 1000000000
          })
        ])
      );
    });

    it('should fetch historical data with period from settings when no body provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/historical-data/fetch', {
        method: 'POST'
      });
      const response = await postFetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully fetched 3 historical records for 1Y');
      expect(mockSettingsService.getPriceDataSettings).toHaveBeenCalled();
      expect(mockYahooFinanceService.fetchHistoricalData).toHaveBeenCalledWith('1y');
    });

    it('should handle ALL period with chunked fetching', async () => {
      const chunkData1 = [mockHistoricalData[0], mockHistoricalData[1]];
      const chunkData2 = [mockHistoricalData[2]];
      
      mockYahooFinanceService.fetchHistoricalData
        .mockResolvedValueOnce(chunkData1)
        .mockResolvedValueOnce(chunkData2);

      const request = new NextRequest('http://localhost:3000/api/historical-data/fetch', {
        method: 'POST',
        body: JSON.stringify({ period: 'ALL' })
      });
      const response = await postFetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockYahooFinanceService.fetchHistoricalData).toHaveBeenCalledTimes(2);
      expect(mockYahooFinanceService.fetchHistoricalData).toHaveBeenNthCalledWith(1, '10y');
      expect(mockYahooFinanceService.fetchHistoricalData).toHaveBeenNthCalledWith(2, '5y');
    });

    it('should fall back to default period when settings fail', async () => {
      mockSettingsService.getPriceDataSettings.mockRejectedValue(new Error('Settings error'));

      const request = new NextRequest('http://localhost:3000/api/historical-data/fetch', {
        method: 'POST'
      });
      const response = await postFetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully fetched 3 historical records for 1Y');
      expect(mockYahooFinanceService.fetchHistoricalData).toHaveBeenCalledWith('1y');
    });

    it('should generate mock data when Yahoo Finance fails', async () => {
      mockYahooFinanceService.fetchHistoricalData.mockRejectedValue(new Error('Yahoo Finance error'));

      const request = new NextRequest('http://localhost:3000/api/historical-data/fetch', {
        method: 'POST',
        body: JSON.stringify({ period: '1Y' })
      });
      const response = await postFetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.recordsAdded).toBe(365); // Mock data for 1 year
      expect(mockYahooFinanceService.saveHistoricalData).toHaveBeenCalled();
    });

    it('should handle invalid JSON in request body gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/historical-data/fetch', {
        method: 'POST',
        body: 'invalid json'
      });
      const response = await postFetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully fetched 3 historical records for 1Y');
      expect(mockSettingsService.getPriceDataSettings).toHaveBeenCalled();
    });

    it('should handle save data errors gracefully', async () => {
      mockYahooFinanceService.saveHistoricalData.mockRejectedValue(new Error('Save error'));

      const request = new NextRequest('http://localhost:3000/api/historical-data/fetch', {
        method: 'POST',
        body: JSON.stringify({ period: '1Y' })
      });
      const response = await postFetch(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch historical data');
    });
  });

  describe('Period conversion helpers', () => {
    it('should convert app periods to Yahoo Finance periods correctly', async () => {
      const testCases = [
        { input: '3M', expected: '3mo' },
        { input: '6M', expected: '6mo' },
        { input: '1Y', expected: '1y' },
        { input: '2Y', expected: '2y' },
        { input: '5Y', expected: '5y' },
        { input: 'ALL', expected: '10y' }
      ];

      for (const testCase of testCases) {
        const request = new NextRequest('http://localhost:3000/api/historical-data/fetch', {
          method: 'POST',
          body: JSON.stringify({ period: testCase.input })
        });
        await postFetch(request);
        
        expect(mockYahooFinanceService.fetchHistoricalData).toHaveBeenCalledWith(testCase.expected);
        jest.clearAllMocks();
        mockYahooFinanceService.fetchHistoricalData.mockResolvedValue(mockHistoricalData);
        mockYahooFinanceService.saveHistoricalData.mockResolvedValue(undefined);
      }
    });
  });

  describe('Data quality validation', () => {
    it('should validate historical data structure in GET endpoint', async () => {
      mockHistoricalDataService.getHistoricalData.mockResolvedValue(mockHistoricalData);

      const request = new NextRequest('http://localhost:3000/api/historical-data');
      const response = await getHistoricalData(request);
      const data = await response.json();

      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      data.data.forEach((record: any) => {
        expect(record).toHaveProperty('date');
        expect(record).toHaveProperty('open_usd');
        expect(record).toHaveProperty('high_usd');
        expect(record).toHaveProperty('low_usd');
        expect(record).toHaveProperty('close_usd');
        expect(record).toHaveProperty('volume');
      });
    });

    it('should validate intraday OHLC conversion', async () => {
      // Seed intraday data with multiple points in same hour from recent time
      const now = new Date();
      const baseTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      const hourStart = new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate(), baseTime.getHours(), 0, 0, 0);
      
      await prisma.bitcoinPriceIntraday.createMany({
        data: [
          {
            timestamp: new Date(hourStart.getTime() + 15 * 60 * 1000).toISOString(), // :15 minutes
            priceUsd: 43800,
            volume: 25000000,
            createdAt: new Date(hourStart.getTime() + 15 * 60 * 1000)
          },
          {
            timestamp: new Date(hourStart.getTime() + 30 * 60 * 1000).toISOString(), // :30 minutes
            priceUsd: 44200,
            volume: 30000000,
            createdAt: new Date(hourStart.getTime() + 30 * 60 * 1000)
          },
          {
            timestamp: new Date(hourStart.getTime() + 45 * 60 * 1000).toISOString(), // :45 minutes
            priceUsd: 44000,
            volume: 20000000,
            createdAt: new Date(hourStart.getTime() + 45 * 60 * 1000)
          }
        ]
      });

      const request = new NextRequest('http://localhost:3000/api/historical-data?days=1');
      const response = await getHistoricalData(request);
      const data = await response.json();

      expect(data.data.length).toBeGreaterThan(0); // Should have at least 1 hourly candle
      if (data.data.length > 0) {
        const candle = data.data[0];
        expect(candle.open_usd).toBe(43800); // First price
        expect(candle.close_usd).toBe(44000); // Last price
        expect(candle.high_usd).toBe(44200); // Highest price
        expect(candle.low_usd).toBe(43800); // Lowest price
        expect(candle.volume).toBe(75000000); // Sum of volumes
      }
    });
  });
});