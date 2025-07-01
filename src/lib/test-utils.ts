import { NextRequest } from 'next/server';

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string;
}

export const TEST_USERS: TestUser[] = [
  {
    id: 1,
    email: 'test@bitcointracker.com',
    name: 'Test User',
    password: 'test123'
  },
  {
    id: 2,
    email: 'test.eur@bitcointracker.com', 
    name: 'EUR Test User',
    password: 'test123'
  },
  {
    id: 3,
    email: 'test.pln@bitcointracker.com',
    name: 'PLN Test User', 
    password: 'test123'
  }
];

export class TestAuthHelper {
  /**
   * Create test session token
   */
  static createTestToken(userId: number): string {
    const payload = {
      userId,
      email: TEST_USERS.find(u => u.id === userId)?.email,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      iat: Math.floor(Date.now() / 1000),
      test: true // Mark as test token
    };
    
    // Simple base64 encoding for test tokens (not secure, just for testing)
    return 'test_' + Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /**
   * Verify test token
   */
  static verifyTestToken(token: string): { userId: number; email: string } | null {
    try {
      if (!token.startsWith('test_')) {
        return null;
      }
      
      const payload = JSON.parse(Buffer.from(token.substring(5), 'base64').toString());
      
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null; // Expired
      }
      
      return {
        userId: payload.userId,
        email: payload.email
      };
    } catch {
      return null;
    }
  }

  /**
   * Create authenticated request for testing
   */
  static createAuthenticatedRequest(url: string, options: RequestInit = {}, userId: number = 1): Request {
    const token = this.createTestToken(userId);
    
    return new Request(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Extract user from request (for API routes)
   */
  static async getUserFromRequest(request: NextRequest): Promise<{ userId: number; email: string } | null> {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    return this.verifyTestToken(token);
  }
}

export class TestDataHelper {
  /**
   * Clear all test data
   */
  static async clearTestData(): Promise<void> {
    const { db } = await import('./database');
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM bitcoin_transactions WHERE notes LIKE "TEST:%"', (err) => {
          if (err) console.warn('Clear transactions failed:', err.message);
        });
        
        db.run('DELETE FROM exchange_rates WHERE last_updated LIKE "TEST:%"', (err) => {
          if (err) console.warn('Clear exchange rates failed:', err.message);
        });
        
        // Try to reset portfolio summary with safe column names
        db.run(`UPDATE portfolio_summary SET 
          total_btc = 0, 
          total_transactions = 0
        WHERE id = 1`, (err) => {
          if (err) {
            console.warn('Portfolio summary basic update failed:', err.message);
          }
          
          // Try updating new columns if they exist
          db.run(`UPDATE portfolio_summary SET 
            total_invested = 0,
            current_portfolio_value = 0,
            unrealized_pnl = 0
          WHERE id = 1`, (err2) => {
            if (err2) {
              console.warn('Portfolio summary new columns update failed (expected during migration):', err2.message);
            }
          });
        });
        
        db.run('DELETE FROM app_settings WHERE version LIKE "TEST%"', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /**
   * Seed test data for different currency scenarios
   */
  static async seedTestData(scenario: 'USD' | 'EUR' | 'PLN'): Promise<void> {
    const { db } = await import('./database');
    const { ExchangeRateService } = await import('./exchange-rate-service');
    
    // Seed exchange rates
    await ExchangeRateService.updateAllExchangeRates();
    
    // Seed test settings
    const testSettings = {
      currency: {
        mainCurrency: scenario,
        secondaryCurrency: scenario === 'USD' ? 'EUR' : 'USD',
        supportedCurrencies: ['USD', 'EUR', 'PLN', 'GBP'],
        autoUpdateRates: true,
        rateUpdateInterval: 4,
        fallbackToHardcodedRates: true
      },
      priceData: {
        historicalDataPeriod: '1Y',
        intradayInterval: '5m',
        liveUpdateInterval: 300,
        dataRetentionDays: 365,
        enableIntradayData: true,
        maxIntradayDays: 7
      },
      display: {
        theme: 'dark',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '24h',
        decimalPlaces: 8,
        currencyDecimalPlaces: 2,
        showSatoshis: true,
        compactNumbers: false
      },
      notifications: {
        priceAlerts: false,
        priceThresholds: { high: 120000, low: 80000 },
        portfolioAlerts: false,
        portfolioThresholds: { profitPercent: 50, lossPercent: -20 },
        emailNotifications: false,
        pushNotifications: false
      },
      version: `TEST_${scenario}_1.0.0`
    };

    return new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO app_settings (id, settings_data, version)
        VALUES (1, ?, ?)
      `, [JSON.stringify(testSettings), testSettings.version], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Create test transaction
   */
  static async createTestTransaction(data: {
    type: 'BUY' | 'SELL';
    btc_amount: number;
    original_currency: string;
    original_price_per_btc: number;
    main_currency: string;
    exchange_rate?: number;
  }): Promise<number> {
    const { db } = await import('./database');
    const { ExchangeRateService } = await import('./exchange-rate-service');
    
    const exchangeRate = data.exchange_rate || 
      await ExchangeRateService.getExchangeRate(data.original_currency, data.main_currency);
    
    const mainCurrencyPrice = data.original_price_per_btc * exchangeRate;
    const originalTotal = data.btc_amount * data.original_price_per_btc;
    const mainCurrencyTotal = data.btc_amount * mainCurrencyPrice;
    
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO bitcoin_transactions (
          type, btc_amount, 
          original_price_per_btc, original_currency, original_total_amount,
          main_currency_price_per_btc, main_currency_total_amount, main_currency,
          exchange_rate_used, transaction_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.type, data.btc_amount,
        data.original_price_per_btc, data.original_currency, originalTotal,
        mainCurrencyPrice, mainCurrencyTotal, data.main_currency,
        exchangeRate, new Date().toISOString().split('T')[0], 
        `TEST: ${data.type} transaction`
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }
}

export class APITestHelper {
  /**
   * Test API endpoint with authentication
   */
  static async testAPI(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    userId: number = 1
  ): Promise<Response> {
    const url = `http://localhost:3000/api${endpoint}`;
    
    const request = TestAuthHelper.createAuthenticatedRequest(url, {
      method,
      body: body ? JSON.stringify(body) : undefined
    }, userId);
    
    // Import the API route handler
    const routePath = `../app/api${endpoint}/route`;
    const handler = await import(routePath);
    
    // Call the appropriate handler
    switch (method) {
      case 'GET': return handler.GET(request);
      case 'POST': return handler.POST(request);
      case 'PUT': return handler.PUT(request);
      case 'DELETE': return handler.DELETE(request);
      default: throw new Error(`Unsupported method: ${method}`);
    }
  }

  /**
   * Verify API response
   */
  static async verifyResponse(
    response: Response, 
    expectedStatus: number = 200,
    expectedFields?: string[]
  ): Promise<any> {
    if (response.status !== expectedStatus) {
      const text = await response.text();
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}: ${text}`);
    }
    
    const data = await response.json();
    
    if (expectedFields) {
      for (const field of expectedFields) {
        if (!(field in data)) {
          throw new Error(`Expected field '${field}' not found in response`);
        }
      }
    }
    
    return data;
  }
}

// Export for easy testing
export const TestUtils = {
  Auth: TestAuthHelper,
  Data: TestDataHelper,
  API: APITestHelper
}; 