import { prisma } from './prisma';

export interface CustomCurrency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomCurrencyData {
  code: string;
  name: string;
  symbol: string;
}

export class CustomCurrencyService {
  /**
   * Get all custom currencies
   */
  static async getAllCustomCurrencies(): Promise<CustomCurrency[]> {
    try {
      const records = await prisma.customCurrency.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
      });

      return records.map(record => ({
        id: record.id,
        code: record.code,
        name: record.name,
        symbol: record.symbol,
        is_active: record.isActive,
        created_at: record.createdAt.toISOString(),
        updated_at: record.updatedAt.toISOString()
      }));
    } catch (error) {
      console.error('Error getting custom currencies:', error);
      throw error;
    }
  }

  /**
   * Add a new custom currency
   */
  static async addCustomCurrency(currencyData: CreateCustomCurrencyData): Promise<CustomCurrency> {
    try {
      // Validate input
      const { code, name, symbol } = currencyData;
      
      if (!code || !name || !symbol) {
        throw new Error('Currency code, name, and symbol are required');
      }

      // Ensure code is uppercase and valid format
      const normalizedCode = code.toUpperCase().trim();
      if (!/^[A-Z]{3,4}$/.test(normalizedCode)) {
        throw new Error('Currency code must be 3-4 uppercase letters (e.g., INR, USDT)');
      }

      // Check if currency already exists (including built-in currencies)
      const builtInCurrencies = ['USD', 'EUR', 'PLN', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK'];
      if (builtInCurrencies.includes(normalizedCode)) {
        throw new Error(`${normalizedCode} is already a built-in currency`);
      }

      // Check if a currency with this code exists (active or inactive)
      const existingCurrency = await prisma.customCurrency.findUnique({
        where: { code: normalizedCode }
      });

      if (existingCurrency) {
        if (existingCurrency.isActive) {
          throw new Error(`Currency ${normalizedCode} already exists`);
        } else {
          // Currency exists but is soft-deleted, reactivate it with new data
          const updatedCurrency = await prisma.customCurrency.update({
            where: { id: existingCurrency.id },
            data: {
              name: name.trim(),
              symbol: symbol.trim(),
              isActive: true,
              updatedAt: new Date()
            }
          });

          return {
            id: updatedCurrency.id,
            code: updatedCurrency.code,
            name: updatedCurrency.name,
            symbol: updatedCurrency.symbol,
            is_active: updatedCurrency.isActive,
            created_at: updatedCurrency.createdAt.toISOString(),
            updated_at: updatedCurrency.updatedAt.toISOString()
          };
        }
      } else {
        // Currency doesn't exist, create new one
        const createdCurrency = await prisma.customCurrency.create({
          data: {
            code: normalizedCode,
            name: name.trim(),
            symbol: symbol.trim()
          }
        });

        return {
          id: createdCurrency.id,
          code: createdCurrency.code,
          name: createdCurrency.name,
          symbol: createdCurrency.symbol,
          is_active: createdCurrency.isActive,
          created_at: createdCurrency.createdAt.toISOString(),
          updated_at: createdCurrency.updatedAt.toISOString()
        };
      }
    } catch (error) {
      console.error('Error adding custom currency:', error);
      throw error;
    }
  }

  /**
   * Update a custom currency
   */
  static async updateCustomCurrency(id: number, updates: Partial<CreateCustomCurrencyData>): Promise<CustomCurrency> {
    try {
      const updateData: any = {};

      if (updates.name !== undefined) {
        updateData.name = updates.name.trim();
      }
      if (updates.symbol !== undefined) {
        updateData.symbol = updates.symbol.trim();
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to update');
      }

      updateData.updatedAt = new Date();

      const updatedCurrency = await prisma.customCurrency.update({
        where: { 
          id,
          isActive: true 
        },
        data: updateData
      });

      return {
        id: updatedCurrency.id,
        code: updatedCurrency.code,
        name: updatedCurrency.name,
        symbol: updatedCurrency.symbol,
        is_active: updatedCurrency.isActive,
        created_at: updatedCurrency.createdAt.toISOString(),
        updated_at: updatedCurrency.updatedAt.toISOString()
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Custom currency not found or already deleted');
      }
      console.error('Error updating custom currency:', error);
      throw error;
    }
  }

  /**
   * Delete (deactivate) a custom currency
   */
  static async deleteCustomCurrency(id: number): Promise<void> {
    try {
      await prisma.customCurrency.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error deleting custom currency:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a custom currency from database
   */
  static async permanentlyDeleteCustomCurrency(id: number): Promise<void> {
    try {
      await prisma.customCurrency.delete({
        where: { id }
      });
    } catch (error) {
      console.error('Error permanently deleting custom currency:', error);
      throw error;
    }
  }

  /**
   * Get all custom currencies including soft-deleted ones
   */
  static async getAllCustomCurrenciesIncludingDeleted(): Promise<CustomCurrency[]> {
    try {
      const records = await prisma.customCurrency.findMany({
        orderBy: [
          { isActive: 'desc' },
          { code: 'asc' }
        ]
      });

      return records.map(record => ({
        id: record.id,
        code: record.code,
        name: record.name,
        symbol: record.symbol,
        is_active: record.isActive,
        created_at: record.createdAt.toISOString(),
        updated_at: record.updatedAt.toISOString()
      }));
    } catch (error) {
      console.error('Error getting all custom currencies:', error);
      throw error;
    }
  }

  /**
   * Get currency by code (including custom currencies)
   */
  static async getCurrencyByCode(code: string): Promise<CustomCurrency | null> {
    try {
      const record = await prisma.customCurrency.findUnique({
        where: { 
          code: code.toUpperCase() 
        }
      });

      if (record && record.isActive) {
        return {
          id: record.id,
          code: record.code,
          name: record.name,
          symbol: record.symbol,
          is_active: record.isActive,
          created_at: record.createdAt.toISOString(),
          updated_at: record.updatedAt.toISOString()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting currency by code:', error);
      throw error;
    }
  }
} 