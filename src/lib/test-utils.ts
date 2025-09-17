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

// TestDataHelper removed - was using legacy database system

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
  API: APITestHelper
}; 