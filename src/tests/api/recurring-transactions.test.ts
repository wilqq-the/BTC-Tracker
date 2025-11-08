/**
 * Tests for Recurring Transactions (Auto DCA) API
 */

// Mock services
jest.mock('../../lib/settings-service', () => ({
  SettingsService: {
    getSettings: jest.fn().mockResolvedValue({
      currency: {
        mainCurrency: 'USD',
        secondaryCurrency: 'EUR'
      }
    })
  }
}));

jest.mock('../../lib/exchange-rate-service', () => ({
  ExchangeRateService: {
    getExchangeRate: jest.fn().mockResolvedValue(1.0)
  }
}));

jest.mock('../../lib/bitcoin-price-service', () => ({
  BitcoinPriceService: {
    getCurrentPrice: jest.fn().mockResolvedValue({ price: 50000 }),
    calculateAndStorePortfolioSummary: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock auth helpers
let mockUserId: number = 1;
jest.mock('../../lib/auth-helpers', () => ({
  withAuth: jest.fn((request: any, handler: Function) => {
    return handler(mockUserId);
  })
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/recurring-transactions/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/recurring-transactions/[id]/route';
import { testDb, setupTestDatabase, cleanTestDatabase } from '../test-db';
import { createTestUser } from '../test-helpers';

describe('Recurring Transactions API', () => {
  let testUserId: number;

  beforeAll(async () => {
    await setupTestDatabase();
    const user = await createTestUser();
    testUserId = user.id;
    mockUserId = user.id; // Update mock userId
  });

  afterAll(async () => {
    await cleanTestDatabase();
  });

  describe('POST /api/recurring-transactions', () => {
    it('should create a daily DCA transaction', async () => {
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Daily DCA $10',
          type: 'BUY',
          amount: 10,
          currency: 'USD',
          fees: 0,
          feesCurrency: 'USD',
          frequency: 'daily',
          startDate: new Date().toISOString(),
          isActive: true
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.name).toBe('Daily DCA $10');
      expect(data.data.frequency).toBe('daily');
      expect(data.data.isActive).toBe(true);
    });

    it('should create a weekly DCA transaction', async () => {
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Weekly DCA $50',
          type: 'BUY',
          amount: 50,
          currency: 'USD',
          frequency: 'weekly',
          startDate: new Date().toISOString()
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.frequency).toBe('weekly');
    });

    it('should create a monthly DCA transaction with max occurrences', async () => {
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Monthly DCA $100 for 12 months',
          type: 'BUY',
          amount: 100,
          currency: 'USD',
          frequency: 'monthly',
          startDate: new Date().toISOString(),
          maxOccurrences: 12
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.maxOccurrences).toBe(12);
    });

    it('should reject invalid frequency', async () => {
      // Suppress expected console.error
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Invalid Frequency',
          type: 'BUY',
          amount: 10,
          currency: 'USD',
          frequency: 'invalid',
          startDate: new Date().toISOString()
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      
      consoleError.mockRestore();
    });

    it('should reject negative amount', async () => {
      // Suppress expected console.error
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Negative Amount',
          type: 'BUY',
          amount: -10,
          currency: 'USD',
          frequency: 'daily',
          startDate: new Date().toISOString()
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      
      consoleError.mockRestore();
    });
  });

  describe('GET /api/recurring-transactions', () => {
    it('should list all recurring transactions', async () => {
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by active status', async () => {
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions?active=true', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.forEach((tx: any) => {
        expect(tx.isActive).toBe(true);
      });
    });
  });

  describe('PUT /api/recurring-transactions/[id]', () => {
    let createdId: number;

    beforeEach(async () => {
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Update',
          type: 'BUY',
          amount: 25,
          currency: 'USD',
          frequency: 'daily',
          startDate: new Date().toISOString()
        })
      });

      const response = await POST(request);
      const data = await response.json();
      createdId = data.data.id;
    });

    it('should update recurring transaction', async () => {
      const request = new NextRequest(`http://localhost:3000/api/recurring-transactions/${createdId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 50
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: createdId.toString() }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.amount).toBe(50);
    });

    it('should pause recurring transaction', async () => {
      const request = new NextRequest(`http://localhost:3000/api/recurring-transactions/${createdId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPaused: true
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: createdId.toString() }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isPaused).toBe(true);
    });
  });

  describe('DELETE /api/recurring-transactions/[id]', () => {
    let createdId: number;

    beforeEach(async () => {
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Delete',
          type: 'BUY',
          amount: 15,
          currency: 'USD',
          frequency: 'weekly',
          startDate: new Date().toISOString()
        })
      });

      const response = await POST(request);
      const data = await response.json();
      createdId = data.data.id;
    });

    it('should delete recurring transaction', async () => {
      const request = new NextRequest(`http://localhost:3000/api/recurring-transactions/${createdId}`, {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: createdId.toString() }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent transaction', async () => {
      // Suppress expected console.error
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions/99999', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '99999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      
      consoleError.mockRestore();
    });
  });

  describe('Next Execution Calculation', () => {
    it('should calculate next daily execution correctly', async () => {
      const startDate = new Date();
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Daily Test',
          type: 'BUY',
          amount: 10,
          currency: 'USD',
          frequency: 'daily',
          startDate: startDate.toISOString()
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.nextExecution).toBeDefined();
      
      const nextExecution = new Date(data.data.nextExecution);
      expect(nextExecution >= startDate).toBe(true);
    });

    it('should calculate next weekly execution correctly', async () => {
      const startDate = new Date();
      const request = new NextRequest('http://localhost:3000/api/recurring-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Weekly Test',
          type: 'BUY',
          amount: 10,
          currency: 'USD',
          frequency: 'weekly',
          startDate: startDate.toISOString()
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      const nextExecution = new Date(data.data.nextExecution);
      const expectedNext = new Date(startDate);
      expectedNext.setDate(expectedNext.getDate() + 7);
      
      // Allow 1 day tolerance for timezone differences
      const diff = Math.abs(nextExecution.getTime() - expectedNext.getTime());
      expect(diff).toBeLessThan(24 * 60 * 60 * 1000);
    });
  });
});

