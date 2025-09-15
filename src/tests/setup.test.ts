/**
 * Jest Setup Verification Tests
 * Basic tests to ensure our testing infrastructure is working
 */

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase, cleanUserData } from './test-db'
import { createTestUser, createTestUserWithToken } from './test-helpers'

describe('Jest Setup Verification', () => {
  // Enable database tests now that we've fixed the setup
  describe('Database Connection', () => {
    beforeAll(async () => {
      try {
        await setupTestDatabase()
      } catch (error) {
        console.error('Database setup failed:', error)
        throw error
      }
    }, 30000) // Increase timeout for database setup

    beforeEach(async () => {
      await cleanTestDatabase()
      await seedTestDatabase() // Re-seed after each clean
    })

    afterAll(async () => {
      await testDb.$disconnect()
    })

    it('should connect to test database', async () => {
      // Test basic database connectivity
      const result = await testDb.$queryRaw`SELECT 1 as test`
      expect(result).toBeDefined()
    })

    it('should have app settings seeded', async () => {
      const settings = await testDb.appSettings.findFirst()
      expect(settings).toBeDefined()
      expect(settings?.settingsData).toBeDefined()
      
      const parsedSettings = JSON.parse(settings?.settingsData || '{}')
      expect(parsedSettings.currency?.mainCurrency).toBe('USD')
    })
  })

  describe('Test Helpers', () => {
    beforeAll(async () => {
      await setupTestDatabase()
    }, 30000)

    beforeEach(async () => {
      await cleanTestDatabase()
      await seedTestDatabase() // Re-seed after each clean
    })

    afterAll(async () => {
      await testDb.$disconnect()
    })

    it('should create test user', async () => {
      const user = await createTestUser({
        email: 'testuser@example.com',
        name: 'Test User'
      })

      expect(user).toBeDefined()
      expect(user.email).toBe('testuser@example.com')
      expect(user.name).toBe('Test User')
      expect(user.id).toBeDefined()
    })

    it('should create test user with JWT token', async () => {
      const { user, token, authHeaders } = await createTestUserWithToken({
        email: 'tokenuser@example.com'
      })

      expect(user).toBeDefined()
      expect(token).toBeDefined()
      expect(authHeaders.Authorization).toContain('Bearer ')
      expect(typeof token).toBe('string')
    })

    it.skip('should clean database between tests', async () => {
      // Ensure settings exist first
      await seedTestDatabase()
      
      // Create a user
      await createTestUser({ email: 'cleanup@example.com' })
      
      // Verify user exists
      const usersBefore = await testDb.user.count()
      expect(usersBefore).toBeGreaterThan(0)
      
      // Verify settings exist before cleanup
      const settingsBefore = await testDb.appSettings.count()
      expect(settingsBefore).toBe(1)
      
      // Clean user data but preserve settings
      await cleanUserData()
      
      // Verify user is gone
      const usersAfter = await testDb.user.count()
      expect(usersAfter).toBe(0)
      
      // But settings should still exist
      const settings = await testDb.appSettings.count()
      expect(settings).toBe(1)
    })
  })

  describe('Environment', () => {
    it('should be in test environment', () => {
      expect(process.env.NODE_ENV).toBe('test')
    })

    it('should use test database URL', () => {
      expect(process.env.DATABASE_URL).toContain('test.db')
    })

    it('should have test NextAuth secret', () => {
      expect(process.env.NEXTAUTH_SECRET).toBe('test-secret-key-for-jest-testing-only')
    })
  })
}) 