/**
 * Authentication API Tests
 * Tests for registration, login, and JWT token functionality
 */

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUser, createTestUserWithToken } from '../test-helpers'
import request from 'supertest'
import { NextRequest } from 'next/server'

// Mock Next.js app for testing
const createMockRequest = (method: string, url: string, body?: any, headers?: any) => {
  return {
    method,
    url,
    headers: new Headers(headers || {}),
    json: async () => body || {},
    text: async () => JSON.stringify(body || {}),
    nextUrl: { pathname: url }
  } as unknown as NextRequest
}

// Import API route handlers
import { POST as registerPOST } from '../../app/api/auth/register/route'
import { GET as checkUserGET } from '../../app/api/auth/check-user/route'
import { POST as tokenPOST } from '../../app/api/auth/token/route'

describe('Authentication API', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()
  })

  afterAll(async () => {
    await testDb.$disconnect()
  })

  describe('GET /api/auth/check-user', () => {
    it('should return no single user when database is empty', async () => {
      const mockRequest = createMockRequest('GET', '/api/auth/check-user')
      const response = await checkUserGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.singleUser).toBe(false)
      expect(data.email).toBe(null)
      expect(data.hasPin).toBe(false)
    })

    it('should return single user info when one user exists', async () => {
      // Create a test user
      await createTestUser({
        email: 'existing@example.com',
        name: 'Existing User'
      })

      const mockRequest = createMockRequest('GET', '/api/auth/check-user')
      const response = await checkUserGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.singleUser).toBe(true)
      expect(data.email).toBe('existing@example.com')
      expect(data.hasPin).toBe(false)
    })

    it('should return no single user when multiple users exist', async () => {
      // Ensure clean state first
      await testDb.user.deleteMany()
      
      // Create multiple test users with unique timestamps to avoid conflicts
      const user1 = await createTestUser({
        email: `user1-${Date.now()}@example.com`,
        name: 'User One',
        displayName: 'User One'
      })
      
      const user2 = await createTestUser({
        email: `user2-${Date.now()}@example.com`,
        name: 'User Two',
        displayName: 'User Two'
      })

      // Verify we actually have 2 users
      const userCount = await testDb.user.count()
      expect(userCount).toBe(2)

      const mockRequest = createMockRequest('GET', '/api/auth/check-user')
      const response = await checkUserGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.singleUser).toBe(false)
      expect(data.email).toBe(null)
      expect(data.hasPin).toBe(false)
    })
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'securepassword123',
        name: 'New User'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/register', userData, {
        'Content-Type': 'application/json'
      })

      const response = await registerPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.message).toContain('created successfully')
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe(userData.email)
      expect(data.user.name).toBe(userData.name)
      expect(data.user.passwordHash).toBeUndefined() // Should not return password

      // Verify user was created in database
      const dbUser = await testDb.user.findUnique({
        where: { email: userData.email }
      })
      expect(dbUser).toBeDefined()
      expect(dbUser?.email).toBe(userData.email)
    })

    it('should register user with default name when name not provided', async () => {
      const userData = {
        email: 'defaultname@example.com',
        password: 'securepassword123'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/register', userData, {
        'Content-Type': 'application/json'
      })

      const response = await registerPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.user.name).toBe('defaultname') // Should default to email prefix
    })

    it('should fail to register with duplicate email', async () => {
      // Create existing user
      await createTestUser({
        email: 'existing@example.com',
        name: 'Existing User'
      })

      const userData = {
        email: 'existing@example.com',
        password: 'newpassword123',
        name: 'Duplicate User'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/register', userData, {
        'Content-Type': 'application/json'
      })

      const response = await registerPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('already exists')
    })

    it('should fail to register with missing email', async () => {
      const incompleteData = {
        password: 'password123',
        name: 'Test User'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/register', incompleteData, {
        'Content-Type': 'application/json'
      })

      const response = await registerPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Email and password are required')
    })

    it('should fail to register with missing password', async () => {
      const incompleteData = {
        email: 'test@example.com',
        name: 'Test User'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/register', incompleteData, {
        'Content-Type': 'application/json'
      })

      const response = await registerPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Email and password are required')
    })

    it('should fail to register with weak password', async () => {
      const weakPasswordData = {
        email: 'test@example.com',
        password: '123', // Too short
        name: 'Test User'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/register', weakPasswordData, {
        'Content-Type': 'application/json'
      })

      const response = await registerPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Password must be at least 6 characters')
    })
  })

  describe('POST /api/auth/token', () => {
    it('should generate JWT token for valid credentials', async () => {
      // Create test user
      const testPassword = 'testpassword123'
      const user = await createTestUser({
        email: 'tokenuser@example.com',
        name: 'Token User',
        password: testPassword
      })

      const credentials = {
        email: user.email,
        password: testPassword
      }

      const mockRequest = createMockRequest('POST', '/api/auth/token', credentials, {
        'Content-Type': 'application/json'
      })

      const response = await tokenPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.token).toBeDefined()
      expect(data.tokenType).toBe('Bearer')
      expect(data.expiresAt).toBeDefined()
      expect(typeof data.token).toBe('string')
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe(user.email)
      expect(data.user.passwordHash).toBeUndefined() // Should not return password
    })

    it('should generate token with custom expiration', async () => {
      const testPassword = 'testpassword123'
      const user = await createTestUser({
        email: 'tokenuser2@example.com',
        name: 'Token User 2',
        password: testPassword
      })

      const credentials = {
        email: user.email,
        password: testPassword,
        expiresIn: '1d'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/token', credentials, {
        'Content-Type': 'application/json'
      })

      const response = await tokenPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.expiresAt).toBeDefined()
      
      // Check that expiration is roughly 1 day from now
      const expirationDate = new Date(data.expiresAt)
      const now = new Date()
      const timeDiff = expirationDate.getTime() - now.getTime()
      const dayInMs = 24 * 60 * 60 * 1000
      expect(timeDiff).toBeGreaterThan(dayInMs * 0.9) // Within 90% of a day
      expect(timeDiff).toBeLessThan(dayInMs * 1.1) // Within 110% of a day
    })

    it('should fail to generate token for invalid email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'anypassword'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/token', credentials, {
        'Content-Type': 'application/json'
      })

      const response = await tokenPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Invalid credentials')
    })

    it('should fail to generate token for wrong password', async () => {
      // Create test user
      const user = await createTestUser({
        email: 'passwordtest@example.com',
        password: 'correctpassword'
      })

      const credentials = {
        email: user.email,
        password: 'wrongpassword'
      }

      const mockRequest = createMockRequest('POST', '/api/auth/token', credentials, {
        'Content-Type': 'application/json'
      })

      const response = await tokenPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Invalid credentials')
    })

    it('should fail to generate token with missing credentials', async () => {
      const incompleteCredentials = {
        email: 'test@example.com'
        // Missing password
      }

      const mockRequest = createMockRequest('POST', '/api/auth/token', incompleteCredentials, {
        'Content-Type': 'application/json'
      })

      const response = await tokenPOST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Email and password are required')
    })
  })

  describe('JWT Token Validation', () => {
    it('should create valid JWT token that can be decoded', async () => {
      const { user, token } = await createTestUserWithToken({
        email: 'jwttest@example.com',
        name: 'JWT Test User'
      })

      // Verify token structure
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts

      // Token should contain user info (we can't easily decode without importing jwt here)
      expect(token.length).toBeGreaterThan(50) // JWT tokens are typically long
    })

    it('should generate different tokens for different users', async () => {
      const { token: token1 } = await createTestUserWithToken({
        email: 'user1@example.com',
        name: 'User One'
      })

      const { token: token2 } = await createTestUserWithToken({
        email: 'user2@example.com',
        name: 'User Two'
      })

      expect(token1).not.toBe(token2)
      expect(token1.length).toBeGreaterThan(0)
      expect(token2.length).toBeGreaterThan(0)
    })
  })

  describe('Integration Tests', () => {
    it('should complete full registration and token generation flow', async () => {
      const userData = {
        email: 'fullflow@example.com',
        password: 'securepassword123',
        name: 'Full Flow User'
      }

      // 1. Register user
      const registerRequest = createMockRequest('POST', '/api/auth/register', userData, {
        'Content-Type': 'application/json'
      })
      const registerResponse = await registerPOST(registerRequest)
      const registerData = await registerResponse.json()

      expect(registerResponse.status).toBe(201)
      expect(registerData.message).toContain('created successfully')

      // 2. Generate token for registered user
      const tokenRequest = createMockRequest('POST', '/api/auth/token', {
        email: userData.email,
        password: userData.password
      }, {
        'Content-Type': 'application/json'
      })
      const tokenResponse = await tokenPOST(tokenRequest)
      const tokenData = await tokenResponse.json()

      expect(tokenResponse.status).toBe(200)
      expect(tokenData.success).toBe(true)
      expect(tokenData.token).toBeDefined()
      expect(tokenData.user.email).toBe(userData.email)
    })

    it('should handle user check after registration', async () => {
      // Ensure clean state - delete all users first
      await testDb.user.deleteMany()
      
      // Initially no users
      const initialCheck = createMockRequest('GET', '/api/auth/check-user')
      const initialResponse = await checkUserGET(initialCheck)
      const initialData = await initialResponse.json()

      expect(initialData.singleUser).toBe(false)

      // Register one user
      const userData = {
        email: 'singleuser@example.com',
        password: 'password123',
        name: 'Single User'
      }

      const registerRequest = createMockRequest('POST', '/api/auth/register', userData, {
        'Content-Type': 'application/json'
      })
      await registerPOST(registerRequest)

      // Check user after registration
      const afterCheck = createMockRequest('GET', '/api/auth/check-user')
      const afterResponse = await checkUserGET(afterCheck)
      const afterData = await afterResponse.json()

      expect(afterData.singleUser).toBe(true)
      expect(afterData.email).toBe(userData.email)
    })
  })
}) 