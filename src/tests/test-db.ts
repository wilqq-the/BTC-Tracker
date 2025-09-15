/**
 * Test Database Utilities
 * Helper functions for managing test database state
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import { defaultSettings } from '../lib/types'

// Create a dedicated test database instance
export const testDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./test.db'
    }
  },
  log: process.env.CI ? ['error'] : []
})

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
    console.log('[TOOL] Initializing test database...')
    
    // Connect to the database
    await testDb.$connect()
    
    // Check if any tables exist - if so, schema is already there
    const hasUsers = await tableExists('users')
    const hasSettings = await tableExists('app_settings')
    
    if (!hasUsers || !hasSettings) {
      console.log('[INFO] Creating database schema...')
      
      // Create tables directly using raw SQL from the migration
      await testDb.$executeRawUnsafe(`
        -- CreateTable
        CREATE TABLE IF NOT EXISTS "users" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "email" TEXT NOT NULL,
            "name" TEXT,
            "display_name" TEXT,
            "profile_picture" TEXT,
            "password_hash" TEXT NOT NULL,
            "pin_hash" TEXT,
            "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "app_settings" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "settings_data" TEXT NOT NULL,
            "version" TEXT NOT NULL DEFAULT '1.0.0',
            "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "bitcoin_transactions" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "type" TEXT NOT NULL,
            "btc_amount" REAL NOT NULL,
            "original_price_per_btc" REAL NOT NULL,
            "original_currency" TEXT NOT NULL,
            "original_total_amount" REAL NOT NULL,
            "fees" REAL NOT NULL DEFAULT 0,
            "fees_currency" TEXT NOT NULL DEFAULT 'USD',
            "transaction_date" DATETIME NOT NULL,
            "notes" TEXT,
            "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "custom_currencies" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "code" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "symbol" TEXT NOT NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT true,
            "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "exchange_rates" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "from_currency" TEXT NOT NULL,
            "to_currency" TEXT NOT NULL,
            "rate" REAL NOT NULL,
            "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "bitcoin_current_price" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "price_usd" REAL NOT NULL,
            "price_change_24h_usd" REAL NOT NULL DEFAULT 0,
            "price_change_24h_percent" REAL NOT NULL DEFAULT 0,
            "timestamp" TEXT NOT NULL,
            "source" TEXT NOT NULL DEFAULT 'api',
            "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "bitcoin_price_history" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "date" TEXT NOT NULL,
            "open_usd" REAL NOT NULL,
            "high_usd" REAL NOT NULL,
            "low_usd" REAL NOT NULL,
            "close_usd" REAL NOT NULL,
            "volume" REAL,
            "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "bitcoin_price_intraday" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "timestamp" DATETIME NOT NULL,
            "price_usd" REAL NOT NULL,
            "volume" REAL,
            "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateTable
        CREATE TABLE IF NOT EXISTS "portfolio_summary" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
            "total_btc" REAL NOT NULL DEFAULT 0,
            "total_transactions" INTEGER NOT NULL DEFAULT 0,
            "total_invested" REAL NOT NULL DEFAULT 0,
            "total_fees" REAL NOT NULL DEFAULT 0,
            "average_buy_price" REAL NOT NULL DEFAULT 0,
            "main_currency" TEXT NOT NULL DEFAULT 'USD',
            "current_btc_price_usd" REAL NOT NULL DEFAULT 0,
            "current_portfolio_value" REAL NOT NULL DEFAULT 0,
            "unrealized_pnl" REAL NOT NULL DEFAULT 0,
            "unrealized_pnl_percent" REAL NOT NULL DEFAULT 0,
            "portfolio_change_24h" REAL NOT NULL DEFAULT 0,
            "portfolio_change_24h_percent" REAL NOT NULL DEFAULT 0,
            "secondary_currency" TEXT NOT NULL DEFAULT 'EUR',
            "current_value_secondary" REAL NOT NULL DEFAULT 0,
            "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "last_price_update" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "custom_currencies_code_key" ON "custom_currencies"("code");

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_from_currency_to_currency_key" ON "exchange_rates"("from_currency", "to_currency");

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "bitcoin_price_history_date_key" ON "bitcoin_price_history"("date");

        -- CreateIndex
        CREATE INDEX IF NOT EXISTS "bitcoin_price_intraday_timestamp_idx" ON "bitcoin_price_intraday"("timestamp");

        -- CreateIndex
        CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_summary_userId_key" ON "portfolio_summary"("userId");
      `)
    }
    
    // Test basic connectivity
    await testDb.$queryRaw`SELECT 1 as test`
    
    schemaInitialized = true
    console.log('[OK] Test database initialized')
  } catch (error) {
    console.error('[ERROR] Failed to initialize test database:', error)
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
    console.error('[ERROR] Failed to clean test database:', error)
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
    
    // Ensure settings still exist (or recreate if missing)
    if (await tableExists('app_settings')) {
      const settingsCount = await testDb.appSettings.count()
      if (settingsCount === 0) {
        await testDb.appSettings.create({
          data: {
            id: 1,
            settingsData: JSON.stringify(defaultSettings),
            version: defaultSettings.version
          }
        })
      }
    }
    
    console.log('🧹 User data cleaned, settings preserved')
  } catch (error) {
    console.error('[ERROR] Failed to clean user data:', error)
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
    console.error('[ERROR] Failed to seed test database:', error)
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
    console.error('[ERROR] Failed to remove test database:', error)
  }
}

/**
 * Complete test database setup
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    console.log('[TOOL] Setting up test database...')
    
    // Initialize database with schema
    await initTestDatabase()
    
    // Clean any existing data
    await cleanTestDatabase()
    
    // Seed with required data
    await seedTestDatabase()
    
    console.log('[OK] Test database setup complete')
  } catch (error) {
    console.error('[ERROR] Test database setup failed:', error)
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