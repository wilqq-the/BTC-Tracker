/**
 * Settings API Tests
 * Tests for settings CRUD operations and validation
 */

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { NextRequest } from 'next/server'
import { AppSettings, MainCurrency, SupportedCurrency } from '../../lib/types'

// Mock Next.js app for testing
const createMockRequest = (method: string, url: string, body?: any, headers?: any) => {
  return {
    method,
    url,
    headers: new Headers(headers || {}),
    json: async () => body || {},
    text: async () => JSON.stringify(body || {}),
    nextUrl: { pathname: url }
  } as unknown as NextRequest
}

// Import API route handlers
import { GET as settingsGET, POST as settingsPOST, PATCH as settingsPATCH, PUT as settingsPUT } from '../../app/api/settings/route'

describe('Settings API', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()
  })

  afterAll(async () => {
    await testDb.$disconnect()
  })

  describe('GET /api/settings', () => {
    it('should retrieve default settings when database is fresh', async () => {
      const mockRequest = createMockRequest('GET', '/api/settings')
      const response = await settingsGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Settings retrieved successfully')
      expect(data.data).toBeDefined()
      expect(data.data.id).toBeDefined()
      expect(data.data.version).toBe('1.0.0')
      expect(data.data.currency.mainCurrency).toBe('USD')
      expect(data.data.currency.secondaryCurrency).toBe('EUR')
      expect(data.data.display.theme).toBe('dark')
      expect(data.data.lastUpdated).toBeDefined()
    })

    it('should include all required settings categories', async () => {
      const response = await settingsGET()
      const data = await response.json()

      expect(data.data.currency).toBeDefined()
      expect(data.data.priceData).toBeDefined()
      expect(data.data.display).toBeDefined()
      expect(data.data.notifications).toBeDefined()

      // Currency settings
      expect(data.data.currency.mainCurrency).toBeDefined()
      expect(data.data.currency.secondaryCurrency).toBeDefined()
      expect(Array.isArray(data.data.currency.supportedCurrencies)).toBe(true)
      expect(data.data.currency.autoUpdateRates).toBeDefined()

      // Price data settings
      expect(data.data.priceData.historicalDataPeriod).toBeDefined()
      expect(data.data.priceData.intradayInterval).toBeDefined()
      expect(data.data.priceData.enableIntradayData).toBeDefined()

      // Display settings
      expect(data.data.display.theme).toBeDefined()
      expect(data.data.display.dateFormat).toBeDefined()
      expect(data.data.display.decimalPlaces).toBeDefined()

      // Notification settings
      expect(data.data.notifications.priceAlerts).toBeDefined()
      expect(data.data.notifications.portfolioAlerts).toBeDefined()
    })
  })

  describe('POST /api/settings', () => {
    it('should reset settings to defaults', async () => {
      // First, modify settings
      const updateRequest = createMockRequest('PATCH', '/api/settings', {
        display: { theme: 'light' }
      })
      await settingsPATCH(updateRequest)

      // Then reset to defaults
      const resetRequest = createMockRequest('POST', '/api/settings')
      const response = await settingsPOST()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('reset to defaults successfully')
      expect(data.data.display.theme).toBe('dark') // Should be back to default
    })

    it('should maintain settings ID when resetting', async () => {
      const initialResponse = await settingsGET()
      const initialData = await initialResponse.json()
      const initialId = initialData.data.id

      const resetResponse = await settingsPOST()
      const resetData = await resetResponse.json()

      // Settings should always use ID 1 (singleton pattern)
      expect(resetData.data.id).toBe(1)
      expect(initialId).toBe(1)
    })
  })

  describe('PATCH /api/settings - Category Updates', () => {
    it('should update currency settings', async () => {
      const currencyUpdates = {
        category: 'currency',
        updates: {
          mainCurrency: 'EUR' as MainCurrency,
          secondaryCurrency: 'USD' as SupportedCurrency,
          autoUpdateRates: false
        }
      }

      const mockRequest = createMockRequest('PATCH', '/api/settings', currencyUpdates)
      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('currency settings updated successfully')
      expect(data.data.currency.mainCurrency).toBe('EUR')
      expect(data.data.currency.secondaryCurrency).toBe('USD')
      expect(data.data.currency.autoUpdateRates).toBe(false)
    })

    it('should update price data settings', async () => {
      const priceDataUpdates = {
        category: 'priceData',
        updates: {
          historicalDataPeriod: '6M',
          intradayInterval: '15m',
          enableIntradayData: false,
          liveUpdateInterval: 600
        }
      }

      const mockRequest = createMockRequest('PATCH', '/api/settings', priceDataUpdates)
      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('priceData settings updated successfully')
      expect(data.data.priceData.historicalDataPeriod).toBe('6M')
      expect(data.data.priceData.intradayInterval).toBe('15m')
      expect(data.data.priceData.enableIntradayData).toBe(false)
      expect(data.data.priceData.liveUpdateInterval).toBe(600)
    })

    it('should update display settings', async () => {
      const displayUpdates = {
        category: 'display',
        updates: {
          theme: 'light',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '12h',
          decimalPlaces: 4,
          showSatoshis: false
        }
      }

      const mockRequest = createMockRequest('PATCH', '/api/settings', displayUpdates)
      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('display settings updated successfully')
      expect(data.data.display.theme).toBe('light')
      expect(data.data.display.dateFormat).toBe('DD/MM/YYYY')
      expect(data.data.display.timeFormat).toBe('12h')
      expect(data.data.display.decimalPlaces).toBe(4)
      expect(data.data.display.showSatoshis).toBe(false)
    })

    it('should update notification settings', async () => {
      const notificationUpdates = {
        category: 'notifications',
        updates: {
          priceAlerts: true,
          priceThresholds: {
            high: 150000,
            low: 50000
          },
          portfolioAlerts: true,
          emailNotifications: true
        }
      }

      const mockRequest = createMockRequest('PATCH', '/api/settings', notificationUpdates)
      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('notifications settings updated successfully')
      expect(data.data.notifications.priceAlerts).toBe(true)
      expect(data.data.notifications.priceThresholds.high).toBe(150000)
      expect(data.data.notifications.priceThresholds.low).toBe(50000)
      expect(data.data.notifications.portfolioAlerts).toBe(true)
      expect(data.data.notifications.emailNotifications).toBe(true)
    })

    it('should fail with invalid category', async () => {
      const invalidUpdate = {
        category: 'invalid',
        updates: { someField: 'value' }
      }

      const mockRequest = createMockRequest('PATCH', '/api/settings', invalidUpdate)
      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid category')
    })

    it('should fail with invalid main currency', async () => {
      const invalidCurrencyUpdate = {
        category: 'currency',
        updates: {
          mainCurrency: 'INVALID_XYZ' // Not a valid currency code
        }
      }

      const mockRequest = createMockRequest('PATCH', '/api/settings', invalidCurrencyUpdate)
      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid main currency')
    })
  })

  describe('PATCH /api/settings - Direct Updates', () => {
    it('should update settings directly without category', async () => {
      const directUpdates = {
        display: {
          theme: 'light',
          decimalPlaces: 6
        },
        currency: {
          mainCurrency: 'EUR' as MainCurrency,
          autoUpdateRates: false
        }
      }

      const mockRequest = createMockRequest('PATCH', '/api/settings', directUpdates)
      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Settings updated successfully')
      expect(data.data.display.theme).toBe('light')
      expect(data.data.display.decimalPlaces).toBe(6)
      expect(data.data.currency.mainCurrency).toBe('EUR')
      expect(data.data.currency.autoUpdateRates).toBe(false)
    })

    it('should preserve unchanged settings during direct update', async () => {
      // First, reset to defaults to ensure consistent state
      await settingsPOST()
      
      const initialResponse = await settingsGET()
      const initialData = await initialResponse.json()

      const partialUpdate = {
        display: { theme: 'light' }
      }

      const mockRequest = createMockRequest('PATCH', '/api/settings', partialUpdate)
      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(data.data.display.theme).toBe('light')
      // These should remain unchanged from the initial values
      expect(data.data.currency.mainCurrency).toBe(initialData.data.currency.mainCurrency)
      expect(data.data.priceData.historicalDataPeriod).toBe(initialData.data.priceData.historicalDataPeriod)
    })
  })

  describe('PUT /api/settings', () => {
    it('should replace all settings', async () => {
      const completeSettings = {
        currency: {
          mainCurrency: 'EUR' as MainCurrency,
          secondaryCurrency: 'USD' as SupportedCurrency,
          supportedCurrencies: ['USD', 'EUR', 'GBP'] as SupportedCurrency[],
          autoUpdateRates: false,
          rateUpdateInterval: 8,
          fallbackToHardcodedRates: false
        },
        priceData: {
          historicalDataPeriod: '2Y',
          intradayInterval: '30m',
          priceUpdateInterval: 10,
          liveUpdateInterval: 600,
          enableIntradayData: false,
          maxHistoricalDays: 1000,
          dataRetentionDays: 500,
          maxIntradayDays: 14
        },
        display: {
          theme: 'light' as const,
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '12h' as const,
          decimalPlaces: 6,
          currencyDecimalPlaces: 3,
          showSatoshis: false,
          compactNumbers: true
        },
        notifications: {
          priceAlerts: true,
          priceThresholds: {
            high: 200000,
            low: 30000
          },
          portfolioAlerts: true,
          portfolioThresholds: {
            profitPercent: 100,
            lossPercent: -50
          },
          emailNotifications: true,
          pushNotifications: true
        },
        version: '2.0.0'
      }

      const mockRequest = createMockRequest('PUT', '/api/settings', completeSettings)
      const response = await settingsPUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('All settings updated successfully')
      
      // Verify all settings were replaced
      expect(data.data.currency.mainCurrency).toBe('EUR')
      expect(data.data.currency.autoUpdateRates).toBe(false)
      expect(data.data.priceData.historicalDataPeriod).toBe('2Y')
      expect(data.data.display.theme).toBe('light')
      expect(data.data.notifications.priceAlerts).toBe(true)
      expect(data.data.version).toBe('2.0.0')
    })

    it('should fail with missing required categories', async () => {
      const incompleteSettings = {
        currency: {
          mainCurrency: 'USD' as MainCurrency,
          secondaryCurrency: 'EUR' as SupportedCurrency,
          supportedCurrencies: ['USD', 'EUR'] as SupportedCurrency[],
          autoUpdateRates: true,
          rateUpdateInterval: 4,
          fallbackToHardcodedRates: true
        }
        // Missing priceData, display, notifications
      }

      const mockRequest = createMockRequest('PUT', '/api/settings', incompleteSettings)
      const response = await settingsPUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Missing required settings categories')
    })

    it('should fail with invalid main currency in PUT', async () => {
      const invalidSettings = {
        currency: {
          mainCurrency: 'INVALID_ABC', // Invalid currency code
          secondaryCurrency: 'EUR' as SupportedCurrency,
          supportedCurrencies: ['USD', 'EUR', 'GBP'] as SupportedCurrency[],
          autoUpdateRates: true,
          rateUpdateInterval: 4,
          fallbackToHardcodedRates: true
        },
        priceData: {
          historicalDataPeriod: '1Y',
          intradayInterval: '5m',
          priceUpdateInterval: 5,
          liveUpdateInterval: 300,
          enableIntradayData: true,
          maxHistoricalDays: 730,
          dataRetentionDays: 365,
          maxIntradayDays: 7
        },
        display: {
          theme: 'dark' as const,
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '24h' as const,
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
        }
      }

      const mockRequest = createMockRequest('PUT', '/api/settings', invalidSettings)
      const response = await settingsPUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid main currency')
    })
  })

  describe('Settings Validation', () => {
    it('should validate main currency restrictions', async () => {
      const validCurrencies: MainCurrency[] = ['USD', 'EUR']
      
      for (const currency of validCurrencies) {
        const update = {
          category: 'currency',
          updates: { mainCurrency: currency }
        }

        const mockRequest = createMockRequest('PATCH', '/api/settings', update)
        const response = await settingsPATCH(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.currency.mainCurrency).toBe(currency)
      }
    })

    it('should allow any supported currency as secondary currency', async () => {
      const supportedCurrencies: SupportedCurrency[] = ['USD', 'EUR', 'PLN', 'GBP', 'CAD']
      
      for (const currency of supportedCurrencies) {
        const update = {
          category: 'currency',
          updates: { secondaryCurrency: currency }
        }

        const mockRequest = createMockRequest('PATCH', '/api/settings', update)
        const response = await settingsPATCH(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.currency.secondaryCurrency).toBe(currency)
      }
    })
  })

  describe('Settings Persistence', () => {
    it('should persist settings changes across requests', async () => {
      // Update settings
      const update = {
        display: {
          theme: 'light',
          decimalPlaces: 6
        }
      }

      const updateRequest = createMockRequest('PATCH', '/api/settings', update)
      await settingsPATCH(updateRequest)

      // Retrieve settings again
      const getResponse = await settingsGET()
      const getData = await getResponse.json()

      expect(getData.data.display.theme).toBe('light')
      expect(getData.data.display.decimalPlaces).toBe(6)
    })

    it('should update lastUpdated timestamp on changes', async () => {
      const initialResponse = await settingsGET()
      const initialData = await initialResponse.json()
      const initialTimestamp = new Date(initialData.data.lastUpdated).getTime()

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      const update = { display: { theme: 'light' } }
      const updateRequest = createMockRequest('PATCH', '/api/settings', update)
      const updateResponse = await settingsPATCH(updateRequest)
      const updateData = await updateResponse.json()
      const updatedTimestamp = new Date(updateData.data.lastUpdated).getTime()

      expect(updatedTimestamp).toBeGreaterThan(initialTimestamp)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON in PATCH request', async () => {
      const mockRequest = {
        method: 'PATCH',
        json: async () => { throw new Error('Invalid JSON') }
      } as unknown as NextRequest

      const response = await settingsPATCH(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    it('should handle malformed JSON in PUT request', async () => {
      const mockRequest = {
        method: 'PUT',
        json: async () => { throw new Error('Invalid JSON') }
      } as unknown as NextRequest

      const response = await settingsPUT(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })
  })
}) 