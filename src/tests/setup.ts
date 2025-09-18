/**
 * Jest Test Setup
 * This file runs before all tests to set up the testing environment
 */

import { execSync } from 'child_process'

// Set test environment variables BEFORE any Prisma imports
// Use type assertion to allow assignment to NODE_ENV
(process.env as any).NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-jest-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// NOTE: Prisma client generation is now handled by test:setup script
// This ensures the client is available before Jest starts

// Import PrismaClient (should be available from test:setup)
import { PrismaClient } from '@prisma/client'

// Global test timeout (can be overridden per test)
jest.setTimeout(10000)

// Global test database instance
let testPrisma: PrismaClient

// Setup before all tests
beforeAll(async () => {
  // Create test database instance
  testPrisma = new PrismaClient({
    log: process.env.CI ? ['error'] : []
  })

  // Connect to test database
  await testPrisma.$connect()
  
  // Make testPrisma available globally after initialization
  global.testPrisma = testPrisma
  
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