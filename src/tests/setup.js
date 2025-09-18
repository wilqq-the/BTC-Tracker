/**
 * Jest Test Setup
 * This file runs before all tests to set up the testing environment
 */

const { execSync } = require('child_process')

// Set test environment variables BEFORE any Prisma imports
// Use type assertion to allow assignment to NODE_ENV
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-jest-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Ensure Prisma client is generated for test DATABASE_URL
console.log('[TEST] Ensuring Prisma client is generated for tests...')
try {
  execSync('npx prisma generate', { 
    stdio: 'pipe',
    env: process.env
  })
  console.log('[TEST] Prisma client generation completed')
} catch (error) {
  console.warn('[TEST] Prisma generation warning:', error)
}

// Global test timeout (can be overridden per test)
jest.setTimeout(10000)

// Import PrismaClient AFTER generation
const { PrismaClient } = require('@prisma/client')

// Global test database instance
let testPrisma

// Setup before all tests
beforeAll(async () => {
  // Create test database instance
  testPrisma = new PrismaClient({
    log: process.env.CI ? ['error'] : []
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
