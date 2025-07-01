/**
 * Test Helper Functions
 * Reusable utilities for testing
 */

import { testDb } from './test-db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '@prisma/client'

/**
 * Test user data factory
 */
export const createTestUserData = (overrides: Partial<User> = {}) => ({
  email: 'test@example.com',
  name: 'Test User',
  displayName: 'Test User',
  password: 'testpassword123',
  ...overrides
})

/**
 * Create a test user in the database
 */
export async function createTestUser(userData: Partial<User> = {}): Promise<User> {
  const testUserData = createTestUserData(userData)
  
  const hashedPassword = await bcrypt.hash(testUserData.password, 10)
  
  const user = await testDb.user.create({
    data: {
      email: testUserData.email,
      name: testUserData.name,
      displayName: testUserData.displayName,
      passwordHash: hashedPassword
    }
  })
  
  return user
}

/**
 * Generate JWT token for test user
 */
export function generateTestToken(user: User): string {
  const secret = process.env.NEXTAUTH_SECRET || 'test-secret'
  
  return jwt.sign(
    {
      sub: user.id.toString(),
      email: user.email,
      name: user.name
    },
    secret,
    { expiresIn: '1h' }
  )
}

/**
 * Create test user with JWT token
 */
export async function createTestUserWithToken(userData: Partial<User> = {}): Promise<{
  user: User
  token: string
  authHeaders: { Authorization: string }
}> {
  const user = await createTestUser(userData)
  const token = generateTestToken(user)
  
  return {
    user,
    token,
    authHeaders: {
      Authorization: `Bearer ${token}`
    }
  }
}

/**
 * Create test transaction data
 */
export const createTestTransactionData = (overrides: any = {}) => {
  const defaults = {
    type: 'BUY',
    btcAmount: 0.1,
    originalPricePerBtc: 50000,
    originalCurrency: 'USD',
    originalTotalAmount: 5000,
    fees: 0,
    feesCurrency: 'USD',
    transactionDate: new Date('2024-01-01'),
    notes: 'Test transaction'
  }
  
  const merged = { ...defaults, ...overrides }
  
  // Ensure transactionDate is a Date object
  if (typeof merged.transactionDate === 'string') {
    merged.transactionDate = new Date(merged.transactionDate)
  }
  
  // Calculate originalTotalAmount if not provided
  if (!overrides.originalTotalAmount && merged.btcAmount && merged.originalPricePerBtc) {
    merged.originalTotalAmount = merged.btcAmount * merged.originalPricePerBtc
  }
  
  return merged
}

/**
 * Create test transaction in database
 */
export async function createTestTransaction(transactionData: any = {}) {
  const testData = createTestTransactionData(transactionData)
  
  return await testDb.bitcoinTransaction.create({
    data: testData
  })
}

/**
 * Wait for a specified amount of time (for async operations)
 */
export const wait = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

/**
 * Mock console methods for testing
 */
export function mockConsole() {
  const originalConsole = { ...console }
  
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  
  afterEach(() => {
    jest.restoreAllMocks()
  })
  
  return originalConsole
}

/**
 * Expect async function to throw with specific message
 */
export async function expectToThrow(
  asyncFn: () => Promise<any>,
  expectedMessage?: string
): Promise<void> {
  try {
    await asyncFn()
    throw new Error('Expected function to throw, but it did not')
  } catch (error) {
    if (expectedMessage && error instanceof Error) {
      expect(error.message).toContain(expectedMessage)
    }
  }
} 