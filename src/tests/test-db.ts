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
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    await testDb.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name=${tableName}`
    return true
  } catch {
    return false
  }
}

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
 * Clean all data from test database with error handling for missing tables
 */
export async function cleanTestDatabase(): Promise<void> {
  try {
    // Delete in reverse order of dependencies
    // Use try-catch for each table in case it doesn't exist yet
    try { 
      if (await tableExists('bitcoin_price_intraday')) {
        await testDb.bitcoinPriceIntraday.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('bitcoin_price_history')) {
        await testDb.bitcoinPriceHistory.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('bitcoin_current_price')) {
        await testDb.bitcoinCurrentPrice.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('portfolio_summary')) {
        await testDb.portfolioSummary.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('exchange_rates')) {
        await testDb.exchangeRate.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('custom_currencies')) {
        await testDb.customCurrency.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('bitcoin_transactions')) {
        await testDb.bitcoinTransaction.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('app_settings')) {
        await testDb.appSettings.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('users')) {
        await testDb.user.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
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
    // Use try-catch for each table in case it doesn't exist yet
    try { 
      if (await tableExists('bitcoin_price_intraday')) {
        await testDb.bitcoinPriceIntraday.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('bitcoin_price_history')) {
        await testDb.bitcoinPriceHistory.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('bitcoin_current_price')) {
        await testDb.bitcoinCurrentPrice.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('portfolio_summary')) {
        await testDb.portfolioSummary.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('exchange_rates')) {
        await testDb.exchangeRate.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('custom_currencies')) {
        await testDb.customCurrency.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('bitcoin_transactions')) {
        await testDb.bitcoinTransaction.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
    
    try { 
      if (await tableExists('users')) {
        await testDb.user.deleteMany()
      }
    } catch (e) { /* Table might not exist */ }
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