/**
 * Transactions API Tests
 * Tests for transaction CRUD operations, filtering, validation, and summary calculations
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

jest.mock('../../lib/bitcoin-price-service', () => ({
  BitcoinPriceService: {
    getCurrentPrice: jest.fn().mockResolvedValue({ price: 50000 }),
    calculateAndStorePortfolioSummary: jest.fn().mockResolvedValue(undefined),
    calculateAndStorePortfolioSummaryDebounced: jest.fn().mockResolvedValue(undefined)
  }
}))

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUser, createTestTransaction } from '../test-helpers'
import { NextRequest } from 'next/server'
import { BitcoinTransaction, TransactionFormData, TransactionResponse } from '../../lib/types'

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
import { GET as transactionsGET, POST as transactionsPOST } from '../../app/api/transactions/route'
import { GET as transactionGET, PUT as transactionPUT, DELETE as transactionDELETE } from '../../app/api/transactions/[id]/route'

describe('Transactions API', () => {
  let testUser: any
  let testTransactionId: number

  beforeAll(async () => {
    await setupTestDatabase()
    testUser = await createTestUser({ email: 'testuser@example.com', password: 'password123' })
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()
    
    // Create a test transaction for each test
    const transaction = await createTestTransaction({
      type: 'BUY',
      btcAmount: 0.1,
      originalPricePerBtc: 50000,
      originalCurrency: 'USD',
      transactionDate: '2024-01-15',
      notes: 'Test transaction'
    })
    testTransactionId = transaction.id
  }, 30000) // Increase timeout to 30 seconds

  afterAll(async () => {
    await testDb.$disconnect()
  })

  describe('GET /api/transactions', () => {
    it('should retrieve all transactions with default pagination', async () => {
      // Verify the test transaction exists
      const transactionCount = await testDb.bitcoinTransaction.count()
      expect(transactionCount).toBeGreaterThan(0)

      const mockRequest = createMockRequest('GET', '/api/transactions')
      const response = await transactionsGET(mockRequest)
      const data = await response.json()

      console.log('Response status:', response.status)
      console.log('Response data:', data)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Retrieved')
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data.length).toBeGreaterThan(0)
      expect(data.summary).toBeDefined()
      
      // Check transaction structure
      const transaction = data.data[0]
      expect(transaction.id).toBeDefined()
      expect(transaction.type).toMatch(/^(BUY|SELL)$/)
      expect(transaction.btc_amount).toBeDefined()
      expect(transaction.original_price_per_btc).toBeDefined()
      expect(transaction.original_currency).toBeDefined()
      expect(transaction.transaction_date).toBeDefined()
    })

    it('should filter transactions by type', async () => {
      // Create a SELL transaction
      await createTestTransaction({
        type: 'SELL',
        btcAmount: 0.05,
        originalPricePerBtc: 52000,
        originalCurrency: 'USD',
        transactionDate: '2024-01-16'
      })

      const mockRequest = createMockRequest('GET', '/api/transactions?type=BUY')
      const response = await transactionsGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
      
      // All transactions should be BUY type
      data.data.forEach((tx: any) => {
        expect(tx.type).toBe('BUY')
      })
    })

    it('should filter transactions by date range', async () => {
      // Create transactions on different dates
      await createTestTransaction({
        type: 'BUY',
        btcAmount: 0.02,
        originalPricePerBtc: 48000,
        originalCurrency: 'USD',
        transactionDate: '2024-01-10'
      })
      
      await createTestTransaction({
        type: 'BUY',
        btcAmount: 0.03,
        originalPricePerBtc: 55000,
        originalCurrency: 'USD',
        transactionDate: '2024-01-20'
      })

      const mockRequest = createMockRequest('GET', '/api/transactions?date_from=2024-01-12&date_to=2024-01-18')
      const response = await transactionsGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Should only return transactions within date range
      data.data.forEach((tx: any) => {
        const txDate = new Date(tx.transaction_date)
        expect(txDate >= new Date('2024-01-12')).toBe(true)
        expect(txDate <= new Date('2024-01-18')).toBe(true)
      })
    })

    it('should apply pagination with limit and offset', async () => {
      // Create multiple transactions
      for (let i = 0; i < 5; i++) {
        await createTestTransaction({
          type: 'BUY',
          btcAmount: 0.01 * (i + 1),
          originalPricePerBtc: 50000 + (i * 1000),
          originalCurrency: 'USD',
          transactionDate: `2024-01-${15 + i}`
        })
      }

      const mockRequest = createMockRequest('GET', '/api/transactions?limit=3&offset=2')
      const response = await transactionsGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.length).toBeLessThanOrEqual(3)
    })

    it('should include summary statistics', async () => {
      const mockRequest = createMockRequest('GET', '/api/transactions')
      const response = await transactionsGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary).toBeDefined()
      expect(data.summary.total_transactions).toBeDefined()
      expect(data.summary.total_buy_transactions).toBeDefined()
      expect(data.summary.total_sell_transactions).toBeDefined()
      expect(data.summary.total_btc_bought).toBeDefined()
      expect(data.summary.current_btc_holdings).toBeDefined()
      expect(data.summary.total_usd_invested).toBeDefined()
      expect(data.summary.roi_percentage).toBeDefined()
    })

    it('should include enhanced currency calculations', async () => {
      const mockRequest = createMockRequest('GET', '/api/transactions')
      const response = await transactionsGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      const transaction = data.data[0]
      
      // Should have main currency fields
      expect(transaction.main_currency).toBeDefined()
      expect(transaction.main_currency_price_per_btc).toBeDefined()
      expect(transaction.main_currency_total_amount).toBeDefined()
      
      // Should have secondary currency fields
      expect(transaction.secondary_currency).toBeDefined()
      expect(transaction.secondary_currency_price_per_btc).toBeDefined()
      expect(transaction.secondary_currency_total_amount).toBeDefined()
      expect(transaction.secondary_currency_current_value).toBeDefined()
      expect(transaction.secondary_currency_pnl).toBeDefined()
    })
  })

  describe('POST /api/transactions', () => {
    it('should create a new BUY transaction', async () => {
      const newTransaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: '0.05',
        price_per_btc: '51000',
        currency: 'USD',
        fees: '25',
        transaction_date: '2024-01-17',
        notes: 'New test transaction'
      }

      const mockRequest = createMockRequest('POST', '/api/transactions', newTransaction)
      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.message).toContain('created successfully')
      expect(data.data).toBeDefined()
      expect(data.data.type).toBe('BUY')
      expect(data.data.btc_amount).toBe(0.05)
      expect(data.data.original_price_per_btc).toBe(51000)
      expect(data.data.original_currency).toBe('USD')
      expect(data.data.fees).toBe(25)
      expect(data.data.transaction_date).toBe('2024-01-17')
      expect(data.data.notes).toBe('New test transaction')
    })

    it('should create a new SELL transaction', async () => {
      const newTransaction: TransactionFormData = {
        type: 'SELL',
        btc_amount: '0.02',
        price_per_btc: '53000',
        currency: 'EUR',
        fees: '15',
        transaction_date: '2024-01-18',
        notes: 'Sell transaction'
      }

      const mockRequest = createMockRequest('POST', '/api/transactions', newTransaction)
      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.type).toBe('SELL')
      expect(data.data.btc_amount).toBe(0.02)
      expect(data.data.original_price_per_btc).toBe(53000)
      expect(data.data.original_currency).toBe('EUR')
      expect(data.data.original_total_amount).toBe(1060) // 0.02 * 53000
    })

    it('should calculate total amount automatically', async () => {
      const newTransaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: '0.1',
        price_per_btc: '50000',
        currency: 'USD',
        fees: '0',
        transaction_date: '2024-01-19',
        notes: ''
      }

      const mockRequest = createMockRequest('POST', '/api/transactions', newTransaction)
      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.original_total_amount).toBe(5000) // 0.1 * 50000
    })

    it('should fail with missing required fields', async () => {
      const incompleteTransaction = {
        type: 'BUY',
        btc_amount: '0.1'
        // Missing price_per_btc, currency, transaction_date
      }

      const mockRequest = createMockRequest('POST', '/api/transactions', incompleteTransaction)
      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing required fields')
      expect(data.message).toContain('required')
    })

    it('should fail with invalid numeric values', async () => {
      const invalidTransaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: '0',
        price_per_btc: '50000',
        currency: 'USD',
        fees: '0',
        transaction_date: '2024-01-19',
        notes: ''
      }

      const mockRequest = createMockRequest('POST', '/api/transactions', invalidTransaction)
      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid numeric values')
      expect(data.message).toContain('positive numbers')
    })

    it('should fail with non-numeric string values', async () => {
      const invalidTransaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: 'invalid',
        price_per_btc: '50000',
        currency: 'USD',
        fees: '0',
        transaction_date: '2024-01-19',
        notes: ''
      }

      const mockRequest = createMockRequest('POST', '/api/transactions', invalidTransaction)
      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid numeric values')
    })
  })

  describe('GET /api/transactions/[id]', () => {
    it('should retrieve a specific transaction by ID', async () => {
      const mockRequest = createMockRequest('GET', `/api/transactions/${testTransactionId}`)
      const context = { params: Promise.resolve({ id: testTransactionId.toString() }) }
      
      const response = await transactionGET(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('retrieved successfully')
      expect(data.data).toBeDefined()
      expect(data.data.id).toBe(testTransactionId)
      expect(data.data.type).toBe('BUY')
      expect(data.data.btc_amount).toBe(0.1)
    })

    it('should return 404 for non-existent transaction', async () => {
      const nonExistentId = 99999
      const mockRequest = createMockRequest('GET', `/api/transactions/${nonExistentId}`)
      const context = { params: Promise.resolve({ id: nonExistentId.toString() }) }
      
      const response = await transactionGET(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Transaction not found')
      expect(data.message).toContain('does not exist')
    })

    it('should return 400 for invalid transaction ID', async () => {
      const mockRequest = createMockRequest('GET', '/api/transactions/invalid')
      const context = { params: Promise.resolve({ id: 'invalid' }) }
      
      const response = await transactionGET(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid transaction ID')
      expect(data.message).toContain('must be a number')
    })
  })

  describe('PUT /api/transactions/[id]', () => {
    it('should update an existing transaction', async () => {
      // Create a transaction to update
      const transaction = await createTestTransaction({
        userId: testUser.id,
        type: 'BUY',
        btcAmount: 0.1,
        originalPricePerBtc: 50000,
        originalCurrency: 'USD',
        originalTotalAmount: 5000,
        date: new Date('2024-01-15'),
        notes: 'Original transaction'
      })

      const updatedTransaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: '0.15',
        price_per_btc: '52000',
        currency: 'EUR',
        fees: '30',
        transaction_date: '2024-01-20',
        notes: 'Updated transaction'
      }

      const mockRequest = createMockRequest('PUT', `/api/transactions/${transaction.id}`, updatedTransaction)
      const context = { params: Promise.resolve({ id: transaction.id.toString() }) }
      
      const response = await transactionPUT(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('updated successfully')
      expect(data.data.id).toBe(transaction.id)
      expect(data.data.btc_amount).toBe(0.15)
      expect(data.data.original_price_per_btc).toBe(52000)
      expect(data.data.original_currency).toBe('EUR')
      expect(data.data.fees).toBe(30)
      expect(data.data.transaction_date).toBe('2024-01-20')
      expect(data.data.notes).toBe('Updated transaction')
      expect(data.data.original_total_amount).toBe(7800) // 0.15 * 52000
    })

    it('should fail to update non-existent transaction', async () => {
      const nonExistentId = 99999
      const updatedTransaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: '0.1',
        price_per_btc: '50000',
        currency: 'USD',
        fees: '0',
        transaction_date: '2024-01-15',
        notes: ''
      }

      const mockRequest = createMockRequest('PUT', `/api/transactions/${nonExistentId}`, updatedTransaction)
      const context = { params: Promise.resolve({ id: nonExistentId.toString() }) }
      
      const response = await transactionPUT(mockRequest, context)
      
      expect(response.status).toBe(500) // Prisma throws error for non-existent record
    })

    it('should fail with invalid transaction ID', async () => {
      const updatedTransaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: '0.1',
        price_per_btc: '50000',
        currency: 'USD',
        fees: '0',
        transaction_date: '2024-01-15',
        notes: ''
      }

      const mockRequest = createMockRequest('PUT', '/api/transactions/invalid', updatedTransaction)
      const context = { params: Promise.resolve({ id: 'invalid' }) }
      
      const response = await transactionPUT(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid transaction ID')
    })

    it('should fail with missing required fields', async () => {
      const incompleteUpdate = {
        type: 'BUY',
        btc_amount: '0.1'
        // Missing required fields
      }

      const mockRequest = createMockRequest('PUT', `/api/transactions/${testTransactionId}`, incompleteUpdate)
      const context = { params: Promise.resolve({ id: testTransactionId.toString() }) }
      
      const response = await transactionPUT(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing required fields')
    })
  })

  describe('DELETE /api/transactions/[id]', () => {
    it('should delete an existing transaction', async () => {
      // Create a fresh transaction for this test to avoid conflicts
      const transaction = await createTestTransaction({
        userId: testUser.id,
        type: 'SELL',
        btcAmount: 0.05,
        originalPricePerBtc: 55000,
        originalCurrency: 'USD',
        originalTotalAmount: 2750,
        date: new Date('2024-02-01'),
        notes: 'Transaction to delete'
      })
      
      const mockRequest = createMockRequest('DELETE', `/api/transactions/${transaction.id}`)
      const context = { params: Promise.resolve({ id: transaction.id.toString() }) }
      
      const response = await transactionDELETE(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('deleted successfully')

      // Verify transaction is actually deleted
      const getResponse = await transactionGET(mockRequest, context)
      expect(getResponse.status).toBe(404)
    })

    it('should return 404 when deleting non-existent transaction', async () => {
      const nonExistentId = 99999
      const mockRequest = createMockRequest('DELETE', `/api/transactions/${nonExistentId}`)
      const context = { params: Promise.resolve({ id: nonExistentId.toString() }) }
      
      const response = await transactionDELETE(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Transaction not found')
      expect(data.message).toContain('does not exist')
    })

    it('should return 400 for invalid transaction ID', async () => {
      const mockRequest = createMockRequest('DELETE', '/api/transactions/invalid')
      const context = { params: Promise.resolve({ id: 'invalid' }) }
      
      const response = await transactionDELETE(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid transaction ID')
    })
  })

  describe('Transaction Validation', () => {
    it('should accept valid transaction types', async () => {
      const validTypes = ['BUY', 'SELL']
      
      for (const type of validTypes) {
        const transaction: TransactionFormData = {
          type: type as 'BUY' | 'SELL',
          btc_amount: '0.1',
          price_per_btc: '50000',
          currency: 'USD',
          fees: '0',
          transaction_date: '2024-01-15',
          notes: ''
        }

        const mockRequest = createMockRequest('POST', '/api/transactions', transaction)
        const response = await transactionsPOST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.type).toBe(type)
      }
    })

    it('should handle different currencies', async () => {
      const currencies = ['USD', 'EUR', 'GBP', 'PLN']
      
      for (const currency of currencies) {
        const transaction: TransactionFormData = {
          type: 'BUY',
          btc_amount: '0.01',
          price_per_btc: '50000',
          currency: currency,
          fees: '5',
          transaction_date: '2024-01-15',
          notes: `Transaction in ${currency}`
        }

        const mockRequest = createMockRequest('POST', '/api/transactions', transaction)
        const response = await transactionsPOST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.original_currency).toBe(currency)
        expect(data.data.fees_currency).toBe(currency)
      }
    })

    it('should handle zero fees', async () => {
      const transaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: '0.1',
        price_per_btc: '50000',
        currency: 'USD',
        fees: '0',
        transaction_date: '2024-01-15',
        notes: 'No fees transaction'
      }

      const mockRequest = createMockRequest('POST', '/api/transactions', transaction)
      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.fees).toBe(0)
    })

    it('should handle empty notes', async () => {
      const transaction: TransactionFormData = {
        type: 'BUY',
        btc_amount: '0.1',
        price_per_btc: '50000',
        currency: 'USD',
        fees: '0',
        transaction_date: '2024-01-15',
        notes: ''
      }

      const mockRequest = createMockRequest('POST', '/api/transactions', transaction)
      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.notes).toBe('')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON in POST request', async () => {
      const mockRequest = {
        method: 'POST',
        json: async () => { throw new Error('Invalid JSON') }
      } as unknown as NextRequest

      const response = await transactionsPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to create transaction')
    })

    it('should handle malformed JSON in PUT request', async () => {
      const mockRequest = {
        method: 'PUT',
        json: async () => { throw new Error('Invalid JSON') }
      } as unknown as NextRequest
      const context = { params: Promise.resolve({ id: testTransactionId.toString() }) }

      const response = await transactionPUT(mockRequest, context)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to update transaction')
    })
  })
}) 