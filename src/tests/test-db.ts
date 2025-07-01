/**
 * Test Database Utilities
 * Helper functions for managing test database state
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import { defaultSettings } from '../lib/types'
import { prisma } from '../lib/prisma'

// Use the same Prisma instance as the application
export const testDb = prisma

/**
 * Initialize test database with schema (simplified)
 */
export async function initTestDatabase(): Promise<void> {
  try {
    console.log('🔧 Initializing test database...')
    
    // Just connect to the database - Prisma will handle schema
    await testDb.$connect()
    
    // Test basic connectivity
    await testDb.$queryRaw`SELECT 1 as test`
    
    console.log('✅ Test database initialized')
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error)
    throw error
  }
}

/**
 * Clean all data from test database
 */
export async function cleanTestDatabase(): Promise<void> {
  try {
    // Delete in reverse order of dependencies
    await testDb.bitcoinPriceIntraday.deleteMany()
    await testDb.bitcoinPriceHistory.deleteMany()
    await testDb.bitcoinCurrentPrice.deleteMany()
    await testDb.portfolioSummary.deleteMany()
    await testDb.exchangeRate.deleteMany()
    await testDb.customCurrency.deleteMany()
    await testDb.bitcoinTransaction.deleteMany()
    await testDb.appSettings.deleteMany()
    await testDb.user.deleteMany()
    
    console.log('🧹 Test database cleaned')
  } catch (error) {
    console.error('❌ Failed to clean test database:', error)
    throw error
  }
}

/**
 * Clean only user data, preserve settings
 */
export async function cleanUserData(): Promise<void> {
  try {
    // Delete user-related data but keep settings
    await testDb.bitcoinPriceIntraday.deleteMany()
    await testDb.bitcoinPriceHistory.deleteMany()
    await testDb.bitcoinCurrentPrice.deleteMany()
    await testDb.portfolioSummary.deleteMany()
    await testDb.exchangeRate.deleteMany()
    await testDb.customCurrency.deleteMany()
    await testDb.bitcoinTransaction.deleteMany()
    await testDb.user.deleteMany()
    // Keep appSettings
    
    console.log('🧹 User data cleaned, settings preserved')
  } catch (error) {
    console.error('❌ Failed to clean user data:', error)
    throw error
  }
}

/**
 * Seed test database with minimal required data
 */
export async function seedTestDatabase(): Promise<void> {
  try {
    // Use the actual default settings from the application
    await testDb.appSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        settingsData: JSON.stringify(defaultSettings),
        version: defaultSettings.version
      }
    })
    
    console.log('🌱 Test database seeded')
  } catch (error) {
    console.error('❌ Failed to seed test database:', error)
    throw error
  }
}

/**
 * Remove test database file
 */
export async function removeTestDatabase(): Promise<void> {
  try {
    const dbPath = './test.db'
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
      console.log('🗑️ Test database file removed')
    }
  } catch (error) {
    console.error('❌ Failed to remove test database:', error)
  }
}

/**
 * Complete test database setup (simplified)
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    console.log('🔧 Setting up test database...')
    
    // Connect to database
    await testDb.$connect()
    
    // Test connectivity
    await testDb.$queryRaw`SELECT 1 as test`
    
    // Clean any existing data
    await cleanTestDatabase()
    
    // Seed with required data
    await seedTestDatabase()
    
    console.log('✅ Test database setup complete')
  } catch (error) {
    console.error('❌ Test database setup failed:', error)
    throw error
  }
}

/**
 * Complete test database teardown (clean + remove)
 */
export async function teardownTestDatabase(): Promise<void> {
  await cleanTestDatabase()
  await testDb.$disconnect()
  await removeTestDatabase()
} 