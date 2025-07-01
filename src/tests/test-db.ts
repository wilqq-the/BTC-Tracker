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

// Global flag to track if schema has been initialized
let schemaInitialized = false

/**
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await testDb.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name=${tableName}` as any[]
    return result.length > 0
  } catch {
    return false
  }
}

/**
 * Initialize test database with schema (only once)
 */
export async function initTestDatabase(): Promise<void> {
  if (schemaInitialized) {
    return
  }

  try {
    console.log('🔧 Initializing test database...')
    
    // Connect to the database
    await testDb.$connect()
    
    // Check if any tables exist - if so, schema is already there
    const hasUsers = await tableExists('users')
    const hasSettings = await tableExists('app_settings')
    
    if (!hasUsers || !hasSettings) {
      console.log('📋 Creating database schema...')
      
      // Create tables directly using raw SQL from the migration
      await testDb.$executeRawUnsafe(`
        -- CreateTable
        CREATE TABLE IF NOT EXISTS "users" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "email" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "passwordHash" TEXT NOT NULL,
            "pinHash" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "app_settings" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "settingsData" TEXT NOT NULL,
            "version" TEXT NOT NULL DEFAULT '1.0.0',
            "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "bitcoin_transactions" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "userId" INTEGER NOT NULL,
            "type" TEXT NOT NULL,
            "btcAmount" REAL NOT NULL,
            "originalPricePerBtc" REAL NOT NULL,
            "originalTotalAmount" REAL NOT NULL,
            "originalCurrency" TEXT NOT NULL DEFAULT 'USD',
            "date" DATETIME NOT NULL,
            "description" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "bitcoin_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "custom_currencies" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "code" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "symbol" TEXT NOT NULL,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "exchange_rates" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "fromCurrency" TEXT NOT NULL,
            "toCurrency" TEXT NOT NULL,
            "rate" REAL NOT NULL,
            "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "bitcoin_current_price" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "price" REAL NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'USD',
            "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "source" TEXT NOT NULL DEFAULT 'api'
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "bitcoin_price_history" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "date" DATETIME NOT NULL,
            "open" REAL NOT NULL,
            "high" REAL NOT NULL,
            "low" REAL NOT NULL,
            "close" REAL NOT NULL,
            "volume" REAL,
            "currency" TEXT NOT NULL DEFAULT 'USD',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "bitcoin_price_intraday" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "timestamp" DATETIME NOT NULL,
            "price" REAL NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'USD',
            "volume" REAL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "portfolio_summary" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "userId" INTEGER NOT NULL,
            "totalBtc" REAL NOT NULL,
            "totalInvested" REAL NOT NULL,
            "currentValue" REAL NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'USD',
            "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "portfolio_summary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "custom_currencies_code_key" ON "custom_currencies"("code");

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_fromCurrency_toCurrency_key" ON "exchange_rates"("fromCurrency", "toCurrency");

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "bitcoin_price_history_date_currency_key" ON "bitcoin_price_history"("date", "currency");

        -- CreateIndex
        CREATE INDEX IF NOT EXISTS "bitcoin_price_intraday_timestamp_idx" ON "bitcoin_price_intraday"("timestamp");

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_summary_userId_key" ON "portfolio_summary"("userId");
      `)
    }
    
    // Test basic connectivity
    await testDb.$queryRaw`SELECT 1 as test`
    
    schemaInitialized = true
    console.log('✅ Test database initialized')
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error)
    throw error
  }
}

/**
 * Clean test database (delete all data but keep schema)
 */
export async function cleanTestDatabase(): Promise<void> {
  try {
    // Ensure schema exists first
    await initTestDatabase()
    
    // Delete in reverse order of dependencies
    // Only clean if tables exist
    if (await tableExists('bitcoin_price_intraday')) {
      await testDb.bitcoinPriceIntraday.deleteMany()
    }
    
    if (await tableExists('bitcoin_price_history')) {
      await testDb.bitcoinPriceHistory.deleteMany()
    }
    
    if (await tableExists('bitcoin_current_price')) {
      await testDb.bitcoinCurrentPrice.deleteMany()
    }
    
    if (await tableExists('portfolio_summary')) {
      await testDb.portfolioSummary.deleteMany()
    }
    
    if (await tableExists('exchange_rates')) {
      await testDb.exchangeRate.deleteMany()
    }
    
    if (await tableExists('custom_currencies')) {
      await testDb.customCurrency.deleteMany()
    }
    
    if (await tableExists('bitcoin_transactions')) {
      await testDb.bitcoinTransaction.deleteMany()
    }
    
    if (await tableExists('app_settings')) {
      await testDb.appSettings.deleteMany()
    }
    
    if (await tableExists('users')) {
      await testDb.user.deleteMany()
    }
    
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
    // Ensure schema exists first
    await initTestDatabase()
    
    // Delete user-related data but keep settings
    if (await tableExists('bitcoin_price_intraday')) {
      await testDb.bitcoinPriceIntraday.deleteMany()
    }
    
    if (await tableExists('bitcoin_price_history')) {
      await testDb.bitcoinPriceHistory.deleteMany()
    }
    
    if (await tableExists('bitcoin_current_price')) {
      await testDb.bitcoinCurrentPrice.deleteMany()
    }
    
    if (await tableExists('portfolio_summary')) {
      await testDb.portfolioSummary.deleteMany()
    }
    
    if (await tableExists('exchange_rates')) {
      await testDb.exchangeRate.deleteMany()
    }
    
    if (await tableExists('custom_currencies')) {
      await testDb.customCurrency.deleteMany()
    }
    
    if (await tableExists('bitcoin_transactions')) {
      await testDb.bitcoinTransaction.deleteMany()
    }
    
    if (await tableExists('users')) {
      await testDb.user.deleteMany()
    }
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
    // Ensure schema exists first
    await initTestDatabase()
    
    // Only seed if the app_settings table exists
    if (await tableExists('app_settings')) {
      await testDb.appSettings.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          settingsData: JSON.stringify(defaultSettings),
          version: defaultSettings.version
        }
      })
    }
    
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
      schemaInitialized = false // Reset flag when database is removed
      console.log('🗑️ Test database file removed')
    }
  } catch (error) {
    console.error('❌ Failed to remove test database:', error)
  }
}

/**
 * Complete test database setup
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    console.log('🔧 Setting up test database...')
    
    // Initialize database with schema
    await initTestDatabase()
    
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