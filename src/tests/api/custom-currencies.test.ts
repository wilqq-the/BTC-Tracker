import { NextRequest } from 'next/server';
import { GET as getCustomCurrencies, POST as postCustomCurrency } from '@/app/api/custom-currencies/route';
import { PUT as putCustomCurrency, DELETE as deleteCustomCurrency } from '@/app/api/custom-currencies/[id]/route';
import { setupTestDatabase, cleanTestDatabase } from '../test-db';
import { CustomCurrencyService } from '@/lib/custom-currency-service';
import { prisma } from '@/lib/prisma';

// Mock the CustomCurrencyService
jest.mock('@/lib/custom-currency-service');

const mockCustomCurrencyService = CustomCurrencyService as jest.Mocked<typeof CustomCurrencyService>;

// Test data
const mockCustomCurrencies = [
  {
    id: 1,
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    is_active: true,
    created_at: '2024-01-01T12:00:00.000Z',
    updated_at: '2024-01-01T12:00:00.000Z'
  },
  {
    id: 2,
    code: 'USDT',
    name: 'Tether USD',
    symbol: '₮',
    is_active: true,
    created_at: '2024-01-02T12:00:00.000Z',
    updated_at: '2024-01-02T12:00:00.000Z'
  },
  {
    id: 3,
    code: 'BRL',
    name: 'Brazilian Real',
    symbol: 'R$',
    is_active: true,
    created_at: '2024-01-03T12:00:00.000Z',
    updated_at: '2024-01-03T12:00:00.000Z'
  }
];

describe('Custom Currencies API', () => {
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

  describe('GET /api/custom-currencies', () => {
    it('should return all active custom currencies', async () => {
      mockCustomCurrencyService.getAllCustomCurrencies.mockResolvedValue(mockCustomCurrencies);

      const response = await getCustomCurrencies();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockCustomCurrencies);
      expect(data.message).toBe('Custom currencies retrieved successfully');
      expect(mockCustomCurrencyService.getAllCustomCurrencies).toHaveBeenCalled();
    });

    it('should return empty array when no custom currencies exist', async () => {
      mockCustomCurrencyService.getAllCustomCurrencies.mockResolvedValue([]);

      const response = await getCustomCurrencies();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
      expect(data.message).toBe('Custom currencies retrieved successfully');
    });

    it('should handle service errors gracefully', async () => {
      mockCustomCurrencyService.getAllCustomCurrencies.mockRejectedValue(new Error('Database error'));

      const response = await getCustomCurrencies();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to retrieve custom currencies');
      expect(data.details).toBe('Database error');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockCustomCurrencyService.getAllCustomCurrencies.mockRejectedValue('String error');

      const response = await getCustomCurrencies();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to retrieve custom currencies');
      expect(data.details).toBe('Unknown error');
    });
  });

  describe('POST /api/custom-currencies', () => {
    const validCurrencyData = {
      code: 'INR',
      name: 'Indian Rupee',
      symbol: '₹'
    };

    it('should create a new custom currency successfully', async () => {
      const newCurrency = mockCustomCurrencies[0];
      mockCustomCurrencyService.addCustomCurrency.mockResolvedValue(newCurrency);

      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify(validCurrencyData)
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(newCurrency);
      expect(data.message).toBe('Custom currency INR added successfully');
      expect(mockCustomCurrencyService.addCustomCurrency).toHaveBeenCalledWith(validCurrencyData);
    });

    it('should return error when required fields are missing', async () => {
      const incompleteData = { code: 'INR', name: 'Indian Rupee' }; // Missing symbol

      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify(incompleteData)
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing required fields: code, name, and symbol are required');
      expect(mockCustomCurrencyService.addCustomCurrency).not.toHaveBeenCalled();
    });

    it('should handle validation errors for currency already exists', async () => {
      mockCustomCurrencyService.addCustomCurrency.mockRejectedValue(
        new Error('Currency INR already exists')
      );

      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify(validCurrencyData)
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Currency INR already exists');
    });

    it('should handle validation errors for built-in currency', async () => {
      mockCustomCurrencyService.addCustomCurrency.mockRejectedValue(
        new Error('USD is already a built-in currency')
      );

      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify({ code: 'USD', name: 'US Dollar', symbol: '$' })
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('USD is already a built-in currency');
    });

    it('should handle validation errors for invalid currency code format', async () => {
      mockCustomCurrencyService.addCustomCurrency.mockRejectedValue(
        new Error('Currency code must be 3-4 uppercase letters')
      );

      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify({ code: 'INVALID123', name: 'Invalid Currency', symbol: 'X' })
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Currency code must be 3-4 uppercase letters');
    });

    it('should handle general service errors', async () => {
      mockCustomCurrencyService.addCustomCurrency.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify(validCurrencyData)
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to add custom currency');
      expect(data.details).toBe('Database connection failed');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: 'invalid json'
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to add custom currency');
    });

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing required fields: code, name, and symbol are required');
    });

    it('should handle null values in required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify({ code: null, name: 'Test', symbol: 'T' })
      });
      const response = await postCustomCurrency(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing required fields: code, name, and symbol are required');
    });
  });

  describe('PUT /api/custom-currencies/[id]', () => {
    const mockContext = { params: Promise.resolve({ id: '1' }) };
    const updatedCurrency = { ...mockCustomCurrencies[0], name: 'Updated Indian Rupee', symbol: '₹₹' };

    it('should update a custom currency successfully', async () => {
      mockCustomCurrencyService.updateCustomCurrency.mockResolvedValue(updatedCurrency);

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Indian Rupee', symbol: '₹₹' })
      });
      const response = await putCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(updatedCurrency);
      expect(data.message).toBe('Custom currency INR updated successfully');
      expect(mockCustomCurrencyService.updateCustomCurrency).toHaveBeenCalledWith(1, {
        name: 'Updated Indian Rupee',
        symbol: '₹₹'
      });
    });

    it('should update only name when only name is provided', async () => {
      const partialUpdate = { ...mockCustomCurrencies[0], name: 'New Name' };
      mockCustomCurrencyService.updateCustomCurrency.mockResolvedValue(partialUpdate);

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' })
      });
      const response = await putCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCustomCurrencyService.updateCustomCurrency).toHaveBeenCalledWith(1, {
        name: 'New Name',
        symbol: undefined
      });
    });

    it('should update only symbol when only symbol is provided', async () => {
      const partialUpdate = { ...mockCustomCurrencies[0], symbol: 'NEW' };
      mockCustomCurrencyService.updateCustomCurrency.mockResolvedValue(partialUpdate);

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1', {
        method: 'PUT',
        body: JSON.stringify({ symbol: 'NEW' })
      });
      const response = await putCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCustomCurrencyService.updateCustomCurrency).toHaveBeenCalledWith(1, {
        name: undefined,
        symbol: 'NEW'
      });
    });

    it('should return error when no fields are provided for update', async () => {
      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1', {
        method: 'PUT',
        body: JSON.stringify({})
      });
      const response = await putCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('At least one field (name or symbol) must be provided for update');
      expect(mockCustomCurrencyService.updateCustomCurrency).not.toHaveBeenCalled();
    });

    it('should return error for invalid currency ID', async () => {
      const invalidContext = { params: Promise.resolve({ id: 'invalid' }) };

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/invalid', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' })
      });
      const response = await putCustomCurrency(request, invalidContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid currency ID');
      expect(mockCustomCurrencyService.updateCustomCurrency).not.toHaveBeenCalled();
    });

    it('should handle currency not found error', async () => {
      mockCustomCurrencyService.updateCustomCurrency.mockRejectedValue(
        new Error('Custom currency not found')
      );

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/999', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' })
      });
      const notFoundContext = { params: Promise.resolve({ id: '999' }) };
      const response = await putCustomCurrency(request, notFoundContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Custom currency not found');
    });

    it('should handle general service errors', async () => {
      mockCustomCurrencyService.updateCustomCurrency.mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' })
      });
      const response = await putCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to update custom currency');
      expect(data.details).toBe('Database error');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1', {
        method: 'PUT',
        body: 'invalid json'
      });
      const response = await putCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to update custom currency');
    });
  });

  describe('DELETE /api/custom-currencies/[id]', () => {
    const mockContext = { params: Promise.resolve({ id: '1' }) };

    it('should soft delete a custom currency successfully', async () => {
      mockCustomCurrencyService.deleteCustomCurrency.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1', {
        method: 'DELETE'
      });
      const response = await deleteCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Custom currency deleted successfully');
      expect(mockCustomCurrencyService.deleteCustomCurrency).toHaveBeenCalledWith(1);
      expect(mockCustomCurrencyService.permanentlyDeleteCustomCurrency).not.toHaveBeenCalled();
    });

    it('should permanently delete a custom currency when permanent=true', async () => {
      mockCustomCurrencyService.permanentlyDeleteCustomCurrency.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1?permanent=true', {
        method: 'DELETE'
      });
      const response = await deleteCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Custom currency permanently deleted successfully');
      expect(mockCustomCurrencyService.permanentlyDeleteCustomCurrency).toHaveBeenCalledWith(1);
      expect(mockCustomCurrencyService.deleteCustomCurrency).not.toHaveBeenCalled();
    });

    it('should return error for invalid currency ID', async () => {
      const invalidContext = { params: Promise.resolve({ id: 'invalid' }) };

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/invalid', {
        method: 'DELETE'
      });
      const response = await deleteCustomCurrency(request, invalidContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid currency ID');
      expect(mockCustomCurrencyService.deleteCustomCurrency).not.toHaveBeenCalled();
      expect(mockCustomCurrencyService.permanentlyDeleteCustomCurrency).not.toHaveBeenCalled();
    });

    it('should handle currency not found error', async () => {
      mockCustomCurrencyService.deleteCustomCurrency.mockRejectedValue(
        new Error('Custom currency not found')
      );

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/999', {
        method: 'DELETE'
      });
      const notFoundContext = { params: Promise.resolve({ id: '999' }) };
      const response = await deleteCustomCurrency(request, notFoundContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Custom currency not found');
    });

    it('should handle general service errors for soft delete', async () => {
      mockCustomCurrencyService.deleteCustomCurrency.mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1', {
        method: 'DELETE'
      });
      const response = await deleteCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to delete custom currency');
      expect(data.details).toBe('Database error');
    });

    it('should handle general service errors for permanent delete', async () => {
      mockCustomCurrencyService.permanentlyDeleteCustomCurrency.mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest('http://localhost:3000/api/custom-currencies/1?permanent=true', {
        method: 'DELETE'
      });
      const response = await deleteCustomCurrency(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to delete custom currency');
      expect(data.details).toBe('Database error');
    });

    it('should handle query parameter edge cases', async () => {
      mockCustomCurrencyService.deleteCustomCurrency.mockResolvedValue(undefined);

      // Test with permanent=false
      const request1 = new NextRequest('http://localhost:3000/api/custom-currencies/1?permanent=false', {
        method: 'DELETE'
      });
      const response1 = await deleteCustomCurrency(request1, mockContext);
      const data1 = await response1.json();

      expect(data1.message).toBe('Custom currency deleted successfully');
      expect(mockCustomCurrencyService.deleteCustomCurrency).toHaveBeenCalledWith(1);

      jest.clearAllMocks();
      mockCustomCurrencyService.deleteCustomCurrency.mockResolvedValue(undefined);

      // Test with permanent=invalid
      const request2 = new NextRequest('http://localhost:3000/api/custom-currencies/1?permanent=invalid', {
        method: 'DELETE'
      });
      const response2 = await deleteCustomCurrency(request2, mockContext);
      const data2 = await response2.json();

      expect(data2.message).toBe('Custom currency deleted successfully');
      expect(mockCustomCurrencyService.deleteCustomCurrency).toHaveBeenCalledWith(1);
    });
  });

  describe('Custom Currency Data Validation', () => {
    it('should validate custom currency data structure', async () => {
      mockCustomCurrencyService.getAllCustomCurrencies.mockResolvedValue(mockCustomCurrencies);

      const response = await getCustomCurrencies();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
      data.data.forEach((currency: any) => {
        expect(currency).toHaveProperty('id');
        expect(currency).toHaveProperty('code');
        expect(currency).toHaveProperty('name');
        expect(currency).toHaveProperty('symbol');
        expect(currency).toHaveProperty('is_active');
        expect(currency).toHaveProperty('created_at');
        expect(currency).toHaveProperty('updated_at');
        expect(typeof currency.id).toBe('number');
        expect(typeof currency.code).toBe('string');
        expect(typeof currency.name).toBe('string');
        expect(typeof currency.symbol).toBe('string');
        expect(typeof currency.is_active).toBe('boolean');
        expect(typeof currency.created_at).toBe('string');
        expect(typeof currency.updated_at).toBe('string');
      });
    });

    it('should validate timestamp formats in responses', async () => {
      mockCustomCurrencyService.getAllCustomCurrencies.mockResolvedValue(mockCustomCurrencies);

      const response = await getCustomCurrencies();
      const data = await response.json();

      data.data.forEach((currency: any) => {
        expect(currency.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(currency.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    it('should handle malformed currency data gracefully', async () => {
      const malformedData = [
        {
          id: 'invalid_id', // Should be number
          code: 'TEST',
          name: 'Test Currency',
          symbol: 'T',
          is_active: 'true', // Should be boolean
          created_at: '2024-01-01T12:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z'
        }
      ];
      mockCustomCurrencyService.getAllCustomCurrencies.mockResolvedValue(malformedData as any);

      const response = await getCustomCurrencies();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual(malformedData);
    });
  });

  describe('Custom Currency Service Integration', () => {
    it('should handle concurrent requests correctly', async () => {
      mockCustomCurrencyService.getAllCustomCurrencies.mockResolvedValue(mockCustomCurrencies);
      mockCustomCurrencyService.addCustomCurrency.mockResolvedValue(mockCustomCurrencies[0]);

      const getRequest = getCustomCurrencies();
      const postRequest = postCustomCurrency(new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify({ code: 'TEST', name: 'Test Currency', symbol: 'T' })
      }));

      const [getResponse, postResponse] = await Promise.all([getRequest, postRequest]);
      const [getData, postData] = await Promise.all([getResponse.json(), postResponse.json()]);

      expect(getResponse.status).toBe(200);
      expect(postResponse.status).toBe(200);
      expect(getData.success).toBe(true);
      expect(postData.success).toBe(true);
    });

    it('should handle mixed success and failure scenarios', async () => {
      mockCustomCurrencyService.getAllCustomCurrencies.mockResolvedValue(mockCustomCurrencies);
      mockCustomCurrencyService.addCustomCurrency.mockRejectedValue(new Error('Currency already exists'));

      const getRequest = getCustomCurrencies();
      const postRequest = postCustomCurrency(new NextRequest('http://localhost:3000/api/custom-currencies', {
        method: 'POST',
        body: JSON.stringify({ code: 'EXISTING', name: 'Existing Currency', symbol: 'E' })
      }));

      const [getResponse, postResponse] = await Promise.all([getRequest, postRequest]);
      const [getData, postData] = await Promise.all([getResponse.json(), postResponse.json()]);

      expect(getResponse.status).toBe(200);
      expect(postResponse.status).toBe(400); // Should be 400 for validation error, not 500
      expect(getData.success).toBe(true);
      expect(postData.success).toBe(false);
    });
  });
});