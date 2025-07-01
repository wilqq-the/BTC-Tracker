import { NextRequest } from 'next/server';
import { GET as getExchangeRates, POST as postExchangeRates } from '@/app/api/exchange-rates/route';
import { setupTestDatabase, cleanTestDatabase } from '../test-db';
import { ExchangeRateService } from '@/lib/exchange-rate-service';
import { prisma } from '@/lib/prisma';

// Mock the ExchangeRateService
jest.mock('@/lib/exchange-rate-service');

const mockExchangeRateService = ExchangeRateService as jest.Mocked<typeof ExchangeRateService>;

// Test data
const mockExchangeRateData = [
  {
    from_currency: 'USD',
    to_currency: 'EUR',
    rate: 0.85,
    last_updated: '2024-01-01T12:00:00.000Z'
  },
  {
    from_currency: 'USD',
    to_currency: 'GBP',
    rate: 0.73,
    last_updated: '2024-01-01T12:00:00.000Z'
  },
  {
    from_currency: 'USD',
    to_currency: 'JPY',
    rate: 110.25,
    last_updated: '2024-01-01T12:00:00.000Z'
  }
];

describe('Exchange Rates API', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    jest.clearAllMocks();
    
    // Reset console.log and console.error to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanTestDatabase();
    jest.restoreAllMocks();
  });

  describe('GET /api/exchange-rates', () => {
    it('should return all exchange rates when no parameters provided', async () => {
      mockExchangeRateService.getAllExchangeRates.mockResolvedValue(mockExchangeRateData);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rates).toEqual(mockExchangeRateData);
      expect(data.count).toBe(3);
      expect(data.timestamp).toBeDefined();
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(mockExchangeRateService.getAllExchangeRates).toHaveBeenCalled();
    });

    it('should return specific exchange rate when from and to parameters provided', async () => {
      mockExchangeRateService.getExchangeRate.mockResolvedValue(0.85);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=EUR');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.from_currency).toBe('USD');
      expect(data.to_currency).toBe('EUR');
      expect(data.rate).toBe(0.85);
      expect(data.timestamp).toBeDefined();
      expect(mockExchangeRateService.getExchangeRate).toHaveBeenCalledWith('USD', 'EUR');
    });

    it('should handle different currency pairs correctly', async () => {
      mockExchangeRateService.getExchangeRate.mockResolvedValue(110.25);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=JPY');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.from_currency).toBe('USD');
      expect(data.to_currency).toBe('JPY');
      expect(data.rate).toBe(110.25);
      expect(mockExchangeRateService.getExchangeRate).toHaveBeenCalledWith('USD', 'JPY');
    });

    it('should handle case when only from parameter is provided', async () => {
      mockExchangeRateService.getAllExchangeRates.mockResolvedValue(mockExchangeRateData);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rates).toEqual(mockExchangeRateData);
      expect(data.count).toBe(3);
      expect(mockExchangeRateService.getAllExchangeRates).toHaveBeenCalled();
      expect(mockExchangeRateService.getExchangeRate).not.toHaveBeenCalled();
    });

    it('should handle case when only to parameter is provided', async () => {
      mockExchangeRateService.getAllExchangeRates.mockResolvedValue(mockExchangeRateData);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates?to=EUR');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rates).toEqual(mockExchangeRateData);
      expect(data.count).toBe(3);
      expect(mockExchangeRateService.getAllExchangeRates).toHaveBeenCalled();
      expect(mockExchangeRateService.getExchangeRate).not.toHaveBeenCalled();
    });

    it('should handle empty exchange rates list', async () => {
      mockExchangeRateService.getAllExchangeRates.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rates).toEqual([]);
      expect(data.count).toBe(0);
      expect(data.timestamp).toBeDefined();
    });

    it('should handle service errors when getting all rates', async () => {
      mockExchangeRateService.getAllExchangeRates.mockRejectedValue(new Error('Service unavailable'));

      const request = new NextRequest('http://localhost:3000/api/exchange-rates');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch exchange rates');
    });

    it('should handle service errors when getting specific rate', async () => {
      mockExchangeRateService.getExchangeRate.mockRejectedValue(new Error('Currency not found'));

      const request = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=XYZ');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch exchange rates');
    });

    it('should handle zero exchange rate correctly', async () => {
      mockExchangeRateService.getExchangeRate.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=EUR');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rate).toBe(0);
    });

    it('should handle very small exchange rates correctly', async () => {
      mockExchangeRateService.getExchangeRate.mockResolvedValue(0.000001);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=MICRO');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rate).toBe(0.000001);
    });

    it('should handle very large exchange rates correctly', async () => {
      mockExchangeRateService.getExchangeRate.mockResolvedValue(1000000);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=LARGE');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rate).toBe(1000000);
    });
  });

  describe('POST /api/exchange-rates', () => {
    it('should update all exchange rates when action is "update"', async () => {
      mockExchangeRateService.updateAllExchangeRates.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ action: 'update' })
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Exchange rates updated successfully');
      expect(data.timestamp).toBeDefined();
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(mockExchangeRateService.updateAllExchangeRates).toHaveBeenCalled();
    });

    it('should clear cache when action is "clear_cache"', async () => {
      mockExchangeRateService.clearCache.mockReturnValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ action: 'clear_cache' })
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Exchange rate cache cleared');
      expect(data.timestamp).toBeDefined();
      expect(mockExchangeRateService.clearCache).toHaveBeenCalled();
    });

    it('should return error for invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid_action' })
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action. Use "update" or "clear_cache"');
    });

    it('should return error when no action provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action. Use "update" or "clear_cache"');
    });

    it('should handle update service errors gracefully', async () => {
      mockExchangeRateService.updateAllExchangeRates.mockRejectedValue(new Error('API rate limit exceeded'));

      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ action: 'update' })
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update exchange rates');
    });

    it('should handle clear cache service errors gracefully', async () => {
      mockExchangeRateService.clearCache.mockImplementation(() => {
        throw new Error('Cache clear failed');
      });

      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ action: 'clear_cache' })
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update exchange rates');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: 'invalid json'
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update exchange rates');
    });

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: ''
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update exchange rates');
    });

    it('should handle null action gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ action: null })
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action. Use "update" or "clear_cache"');
    });

    it('should handle undefined action gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ action: undefined })
      });
      const response = await postExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action. Use "update" or "clear_cache"');
    });
  });

  describe('Exchange Rate Data Validation', () => {
    it('should validate exchange rate data structure', async () => {
      mockExchangeRateService.getAllExchangeRates.mockResolvedValue(mockExchangeRateData);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.rates)).toBe(true);
      data.rates.forEach((rate: any) => {
        expect(rate).toHaveProperty('from_currency');
        expect(rate).toHaveProperty('to_currency');
        expect(rate).toHaveProperty('rate');
        expect(rate).toHaveProperty('last_updated');
        expect(typeof rate.from_currency).toBe('string');
        expect(typeof rate.to_currency).toBe('string');
        expect(typeof rate.rate).toBe('number');
        expect(typeof rate.last_updated).toBe('string');
      });
    });

    it('should validate timestamp format in responses', async () => {
      mockExchangeRateService.getAllExchangeRates.mockResolvedValue(mockExchangeRateData);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(data.timestamp).getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
    });

    it('should handle malformed exchange rate data gracefully', async () => {
      const malformedData = [
        {
          from_currency: 'USD',
          to_currency: 'EUR',
          rate: 'invalid_rate', // Should be number
          last_updated: '2024-01-01T12:00:00.000Z'
        }
      ];
      mockExchangeRateService.getAllExchangeRates.mockResolvedValue(malformedData as any);

      const request = new NextRequest('http://localhost:3000/api/exchange-rates');
      const response = await getExchangeRates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rates).toEqual(malformedData);
      expect(data.count).toBe(1);
    });
  });

  describe('Exchange Rate Service Integration', () => {
    it('should handle concurrent requests correctly', async () => {
      mockExchangeRateService.getExchangeRate
        .mockResolvedValueOnce(0.85)
        .mockResolvedValueOnce(0.73)
        .mockResolvedValueOnce(110.25);

      const requests = [
        new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=EUR'),
        new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=GBP'),
        new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=JPY')
      ];

      const responses = await Promise.all(requests.map(req => getExchangeRates(req)));
      const dataArray = await Promise.all(responses.map(res => res.json()));

      expect(responses.every(res => res.status === 200)).toBe(true);
      expect(dataArray[0].rate).toBe(0.85);
      expect(dataArray[1].rate).toBe(0.73);
      expect(dataArray[2].rate).toBe(110.25);
    });

    it('should handle mixed success and failure scenarios', async () => {
      mockExchangeRateService.getExchangeRate
        .mockResolvedValueOnce(0.85)
        .mockRejectedValueOnce(new Error('Rate not found'));

      const successRequest = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=EUR');
      const failRequest = new NextRequest('http://localhost:3000/api/exchange-rates?from=USD&to=XYZ');

      const [successResponse, failResponse] = await Promise.all([
        getExchangeRates(successRequest),
        getExchangeRates(failRequest)
      ]);

      const [successData, failData] = await Promise.all([
        successResponse.json(),
        failResponse.json()
      ]);

      expect(successResponse.status).toBe(200);
      expect(successData.rate).toBe(0.85);
      expect(failResponse.status).toBe(500);
      expect(failData.error).toBe('Failed to fetch exchange rates');
    });
  });
});