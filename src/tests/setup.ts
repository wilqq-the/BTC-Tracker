/**
 * Jest Test Setup
 * This file runs before all tests to set up the testing environment
 */

import { PrismaClient } from '@prisma/client'

// Set test environment variables
// Use type assertion to allow assignment to NODE_ENV
(process.env as any).NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-jest-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Global test timeout (can be overridden per test)
jest.setTimeout(10000)

// Global test database instance
let testPrisma: PrismaClient

// Setup before all tests
beforeAll(async () => {
  // Create test database instance
  testPrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

  // Connect to test database
  await testPrisma.$connect()
  
  console.log('[TEST] Test database connected')
})

// Cleanup after all tests
afterAll(async () => {
  if (testPrisma) {
    await testPrisma.$disconnect()
    console.log('[TEST] Test database disconnected')
  }
})

// Export test utilities for use in tests
export { testPrisma }

// Global test utilities
declare global {
  var testPrisma: PrismaClient
}

// Make testPrisma available globally
global.testPrisma = testPrisma 