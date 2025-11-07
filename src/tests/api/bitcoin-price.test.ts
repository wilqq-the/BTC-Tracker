/**
 * Bitcoin Price API Tests
 * Tests for Bitcoin price fetching, portfolio summary, and OHLC data endpoints
 */

// Mock the services that use dynamic imports BEFORE any imports
jest.mock('../../lib/settings-service', () => ({
  SettingsService: {
    getSettings: jest.fn().mockResolvedValue({
      currency: {
        mainCurrency: 'USD',
        secondaryCurrency: 'EUR'
      }
    })
  }
}))

jest.mock('../../lib/exchange-rate-service', () => ({
  ExchangeRateService: {
    getExchangeRate: jest.fn().mockResolvedValue(1.05) // EUR to USD rate
  }
}))

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUser, createTestTransaction } from '../test-helpers'
import { NextRequest } from 'next/server'
import { BitcoinPriceData, PortfolioSummaryData } from '../../lib/bitcoin-price-service'

// Mock Bitcoin Price Service
const mockBitcoinPriceService = {
  getCurrentPrice: jest.fn(),
  getPortfolioSummary: jest.fn(),
  getTodaysOHLC: jest.fn(),
  clearCache: jest.fn(),
  calculateAndStorePortfolioSummary: jest.fn()
}

jest.mock('../../lib/bitcoin-price-service', () => ({
  BitcoinPriceService: mockBitcoinPriceService
}))

// Mock Next.js app for testing
const createMockRequest = (method: string, url: string, body?: any, headers?: any) => {
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`
  const urlObj = new URL(fullUrl)
  
  return {
    method,
    url: fullUrl,
    headers: new Headers(headers || {}),
    json: async () => body || {},
    text: async () => JSON.stringify(body || {}),
    nextUrl: { pathname: urlObj.pathname, searchParams: urlObj.searchParams }
  } as unknown as NextRequest
}

// Import API route handlers
import { GET as bitcoinPriceGET, POST as bitcoinPricePOST } from '../../app/api/bitcoin-price/route'
import { GET as bitcoinPriceTodayGET } from '../../app/api/bitcoin-price/today/route'

describe('Bitcoin Price API', () => {
  let testUser: any

  beforeAll(async () => {
    await setupTestDatabase()
    testUser = await createTestUser({ email: 'testuser@example.com', password: 'password123' })
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()
    
    // Reset all mocks
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await testDb.$disconnect()
  })

  describe('GET /api/bitcoin-price', () => {
    it('should return current Bitcoin price by default', async () => {
      const mockPriceData: BitcoinPriceData = {
        price: 50000,
        timestamp: '2024-01-15T10:00:00.000Z',
        source: 'database',
        priceChange24h: 1500,
        priceChangePercent24h: 3.1
      }

      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockPriceData)

      const mockRequest = createMockRequest('GET', '/api/bitcoin-price')
      const response = await bitcoinPriceGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockPriceData)
      expect(data.timestamp).toBeDefined()
      expect(mockBitcoinPriceService.getCurrentPrice).toHaveBeenCalledTimes(1)
    })

    it('should return portfolio summary when endpoint=portfolio', async () => {
      const mockPortfolioData: PortfolioSummaryData = {
        totalBTC: 0.5,
        totalTransactions: 3,
        totalSatoshis: 50000000,
        // Wallet distribution
        coldWalletBTC: 0.3,
        hotWalletBTC: 0.2,
        totalFeesBTC: 0.001,
        mainCurrency: 'USD',
        totalInvestedMain: 25000,
        totalFeesMain: 150,
        averageBuyPriceMain: 50000,
        currentBTCPriceMain: 52000,
        currentPortfolioValueMain: 26000,
        unrealizedPnLMain: 1000,
        unrealizedPnLPercentage: 4.0,
        portfolioChange24hMain: 500,
        portfolioChange24hPercentage: 1.96,
        secondaryCurrency: 'EUR',
        totalInvestedSecondary: 23810,
        totalFeesSecondary: 143,
        averageBuyPriceSecondary: 47619,
        currentBTCPriceSecondary: 49524,
        currentPortfolioValueSecondary: 24762,
        unrealizedPnLSecondary: 952,
        portfolioChange24hSecondary: 476,
        // Legacy USD fields
        totalInvestedUSD: 25000,
        totalFeesUSD: 150,
        averageBuyPriceUSD: 50000,
        currentBTCPriceUSD: 52000,
        currentPortfolioValueUSD: 26000,
        unrealizedPnLUSD: 1000,
        unrealizedPnLPercent: 4.0,
        portfolioChange24hUSD: 500,
        portfolioChange24hPercent: 1.96,
        currentValueEUR: 24762,
        currentValuePLN: 104000,
        lastUpdated: '2024-01-15T10:00:00.000Z',
        lastPriceUpdate: '2024-01-15T10:00:00.000Z'
      }

      mockBitcoinPriceService.getPortfolioSummary.mockResolvedValue(mockPortfolioData)

      const mockRequest = createMockRequest('GET', '/api/bitcoin-price?endpoint=portfolio')
      const response = await bitcoinPriceGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockPortfolioData)
      expect(data.timestamp).toBeDefined()
      expect(mockBitcoinPriceService.getPortfolioSummary).toHaveBeenCalledTimes(1)
    })

    it('should return fallback price on service error', async () => {
      mockBitcoinPriceService.getCurrentPrice.mockRejectedValue(new Error('Service unavailable'))

      const mockRequest = createMockRequest('GET', '/api/bitcoin-price')
      const response = await bitcoinPriceGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch Bitcoin price')
      expect(data.data.price).toBe(105000) // Fallback price
      expect(data.data.source).toBe('fallback')
      expect(data.data.priceChange24h).toBe(0)
      expect(data.data.priceChangePercent24h).toBe(0)
    })

    it('should handle portfolio summary service error', async () => {
      mockBitcoinPriceService.getPortfolioSummary.mockRejectedValue(new Error('Database error'))

      const mockRequest = createMockRequest('GET', '/api/bitcoin-price?endpoint=portfolio')
      const response = await bitcoinPriceGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch Bitcoin price')
    })
  })

  describe('POST /api/bitcoin-price', () => {
    it('should refresh price cache and update portfolio', async () => {
      const mockPriceData: BitcoinPriceData = {
        price: 51000,
        timestamp: '2024-01-15T11:00:00.000Z',
        source: 'database',
        priceChange24h: 2000,
        priceChangePercent24h: 4.08
      }

      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockPriceData)
      mockBitcoinPriceService.clearCache.mockResolvedValue(undefined)
      mockBitcoinPriceService.calculateAndStorePortfolioSummary.mockResolvedValue(undefined)

      const mockRequest = createMockRequest('POST', '/api/bitcoin-price')
      const response = await bitcoinPricePOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockPriceData)
      expect(data.message).toContain('Price cache cleared, refreshed, and portfolio updated')
      expect(data.timestamp).toBeDefined()
      
      expect(mockBitcoinPriceService.clearCache).toHaveBeenCalledTimes(1)
      expect(mockBitcoinPriceService.getCurrentPrice).toHaveBeenCalledTimes(1)
      expect(mockBitcoinPriceService.calculateAndStorePortfolioSummary).toHaveBeenCalledWith(51000)
    })

    it('should handle refresh error gracefully', async () => {
      mockBitcoinPriceService.clearCache.mockImplementation(() => {})
      mockBitcoinPriceService.getCurrentPrice.mockRejectedValue(new Error('API error'))

      const mockRequest = createMockRequest('POST', '/api/bitcoin-price')
      const response = await bitcoinPricePOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to refresh Bitcoin price')
    })

    it('should handle portfolio update error without failing refresh', async () => {
      const mockPriceData: BitcoinPriceData = {
        price: 51000,
        timestamp: '2024-01-15T11:00:00.000Z',
        source: 'database',
        priceChange24h: 2000,
        priceChangePercent24h: 4.08
      }

      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockPriceData)
      mockBitcoinPriceService.clearCache.mockResolvedValue(undefined)
      mockBitcoinPriceService.calculateAndStorePortfolioSummary.mockRejectedValue(new Error('Portfolio error'))

      const mockRequest = createMockRequest('POST', '/api/bitcoin-price')
      const response = await bitcoinPricePOST(mockRequest)
      const data = await response.json()

      // Should still succeed even if portfolio update fails
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockPriceData)
      expect(data.message).toContain('but portfolio update failed')
      
      expect(mockBitcoinPriceService.clearCache).toHaveBeenCalledTimes(1)
      expect(mockBitcoinPriceService.getCurrentPrice).toHaveBeenCalledTimes(1)
      expect(mockBitcoinPriceService.calculateAndStorePortfolioSummary).toHaveBeenCalledWith(51000)
    })
  })

  describe('GET /api/bitcoin-price/today', () => {
    it('should return today\'s OHLC data with current price', async () => {
      const mockOHLCData = {
        date: '2024-01-15',
        open: 49000,
        high: 52000,
        low: 48500,
        close: 51000,
        volume: 1500000
      }

      const mockCurrentPriceData: BitcoinPriceData = {
        price: 51000,
        timestamp: '2024-01-15T11:30:00.000Z',
        source: 'database'
      }

      mockBitcoinPriceService.getTodaysOHLC.mockResolvedValue(mockOHLCData)
      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockCurrentPriceData)

      const response = await bitcoinPriceTodayGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.todaysOHLC).toEqual(mockOHLCData)
      expect(data.data.currentPrice).toBe(51000)
      expect(data.data.lastUpdate).toBe('2024-01-15T11:30:00.000Z')
      expect(data.data.source).toBe('database')
      
      expect(mockBitcoinPriceService.getTodaysOHLC).toHaveBeenCalledTimes(1)
      expect(mockBitcoinPriceService.getCurrentPrice).toHaveBeenCalledTimes(1)
    })

    it('should handle null OHLC data gracefully', async () => {
      const mockCurrentPriceData: BitcoinPriceData = {
        price: 51000,
        timestamp: '2024-01-15T11:30:00.000Z',
        source: 'database'
      }

      mockBitcoinPriceService.getTodaysOHLC.mockResolvedValue(null)
      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockCurrentPriceData)

      const response = await bitcoinPriceTodayGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.todaysOHLC).toBeNull()
      expect(data.data.currentPrice).toBe(51000)
    })

    it('should handle service errors', async () => {
      mockBitcoinPriceService.getTodaysOHLC.mockRejectedValue(new Error('Database error'))
      mockBitcoinPriceService.getCurrentPrice.mockRejectedValue(new Error('Price service error'))

      const response = await bitcoinPriceTodayGET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.message).toBe('Failed to fetch today\'s OHLC data')
      expect(data.error).toBeDefined()
    })

    it('should handle OHLC success but current price failure', async () => {
      const mockOHLCData = {
        date: '2024-01-15',
        open: 49000,
        high: 52000,
        low: 48500,
        close: 51000,
        volume: 1500000
      }

      mockBitcoinPriceService.getTodaysOHLC.mockResolvedValue(mockOHLCData)
      mockBitcoinPriceService.getCurrentPrice.mockRejectedValue(new Error('Price service error'))

      const response = await bitcoinPriceTodayGET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.message).toBe('Failed to fetch today\'s OHLC data')
    })
  })

  describe('Bitcoin Price Data Validation', () => {
    it('should validate price data structure', async () => {
      const mockPriceData: BitcoinPriceData = {
        price: 50000,
        timestamp: '2024-01-15T10:00:00.000Z',
        source: 'database',
        priceChange24h: 1500,
        priceChangePercent24h: 3.1
      }

      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockPriceData)

      const mockRequest = createMockRequest('GET', '/api/bitcoin-price')
      const response = await bitcoinPriceGET(mockRequest)
      const data = await response.json()

      expect(data.data.price).toBeGreaterThan(0)
      expect(typeof data.data.timestamp).toBe('string')
      expect(['database', 'fallback'].includes(data.data.source)).toBe(true)
      expect(typeof data.data.priceChange24h).toBe('number')
      expect(typeof data.data.priceChangePercent24h).toBe('number')
    })

    it('should validate portfolio summary structure', async () => {
      const mockPortfolioData: PortfolioSummaryData = {
        totalBTC: 0.5,
        totalTransactions: 3,
        totalSatoshis: 50000000,
        // Wallet distribution
        coldWalletBTC: 0.3,
        hotWalletBTC: 0.2,
        totalFeesBTC: 0.001,
        mainCurrency: 'USD',
        totalInvestedMain: 25000,
        totalFeesMain: 150,
        averageBuyPriceMain: 50000,
        currentBTCPriceMain: 52000,
        currentPortfolioValueMain: 26000,
        unrealizedPnLMain: 1000,
        unrealizedPnLPercentage: 4.0,
        portfolioChange24hMain: 500,
        portfolioChange24hPercentage: 1.96,
        secondaryCurrency: 'EUR',
        totalInvestedSecondary: 23810,
        totalFeesSecondary: 143,
        averageBuyPriceSecondary: 47619,
        currentBTCPriceSecondary: 49524,
        currentPortfolioValueSecondary: 24762,
        unrealizedPnLSecondary: 952,
        portfolioChange24hSecondary: 476,
        totalInvestedUSD: 25000,
        totalFeesUSD: 150,
        averageBuyPriceUSD: 50000,
        currentBTCPriceUSD: 52000,
        currentPortfolioValueUSD: 26000,
        unrealizedPnLUSD: 1000,
        unrealizedPnLPercent: 4.0,
        portfolioChange24hUSD: 500,
        portfolioChange24hPercent: 1.96,
        currentValueEUR: 24762,
        currentValuePLN: 104000,
        lastUpdated: '2024-01-15T10:00:00.000Z',
        lastPriceUpdate: '2024-01-15T10:00:00.000Z'
      }

      mockBitcoinPriceService.getPortfolioSummary.mockResolvedValue(mockPortfolioData)

      const mockRequest = createMockRequest('GET', '/api/bitcoin-price?endpoint=portfolio')
      const response = await bitcoinPriceGET(mockRequest)
      const data = await response.json()

      const portfolio = data.data
      expect(portfolio.totalBTC).toBeGreaterThanOrEqual(0)
      expect(portfolio.totalTransactions).toBeGreaterThanOrEqual(0)
      expect(portfolio.mainCurrency).toBeDefined()
      expect(portfolio.secondaryCurrency).toBeDefined()
      expect(typeof portfolio.totalInvestedMain).toBe('number')
      expect(typeof portfolio.currentPortfolioValueMain).toBe('number')
      expect(typeof portfolio.unrealizedPnLMain).toBe('number')
      expect(typeof portfolio.unrealizedPnLPercentage).toBe('number')
    })

    it('should validate OHLC data structure', async () => {
      const mockOHLCData = {
        date: '2024-01-15',
        open: 49000,
        high: 52000,
        low: 48500,
        close: 51000,
        volume: 1500000
      }

      const mockCurrentPriceData: BitcoinPriceData = {
        price: 51000,
        timestamp: '2024-01-15T11:30:00.000Z',
        source: 'database'
      }

      mockBitcoinPriceService.getTodaysOHLC.mockResolvedValue(mockOHLCData)
      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockCurrentPriceData)

      const response = await bitcoinPriceTodayGET()
      const data = await response.json()

      const ohlc = data.data.todaysOHLC
      expect(typeof ohlc.date).toBe('string')
      expect(ohlc.open).toBeGreaterThan(0)
      expect(ohlc.high).toBeGreaterThanOrEqual(ohlc.open)
      expect(ohlc.low).toBeLessThanOrEqual(ohlc.open)
      expect(ohlc.close).toBeGreaterThan(0)
      expect(ohlc.volume).toBeGreaterThanOrEqual(0)
      expect(ohlc.high).toBeGreaterThanOrEqual(ohlc.low)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed URL parameters', async () => {
      // This should not cause a crash, just ignore invalid parameters
      const mockPriceData: BitcoinPriceData = {
        price: 50000,
        timestamp: '2024-01-15T10:00:00.000Z',
        source: 'database'
      }

      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockPriceData)

      const mockRequest = createMockRequest('GET', '/api/bitcoin-price?endpoint=invalid&other=params')
      const response = await bitcoinPriceGET(mockRequest)
      const data = await response.json()

      // Should fall back to default behavior (current price)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockPriceData)
    })

    it('should handle concurrent requests properly', async () => {
      const mockPriceData: BitcoinPriceData = {
        price: 50000,
        timestamp: '2024-01-15T10:00:00.000Z',
        source: 'database'
      }

      mockBitcoinPriceService.getCurrentPrice.mockResolvedValue(mockPriceData)

      // Make multiple concurrent requests
      const requests = Array(5).fill(null).map(() => {
        const mockRequest = createMockRequest('GET', '/api/bitcoin-price')
        return bitcoinPriceGET(mockRequest)
      })

      const responses = await Promise.all(requests)
      
      // All should succeed
      responses.forEach(async (response) => {
        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data).toEqual(mockPriceData)
      })
    })
  })
}) 