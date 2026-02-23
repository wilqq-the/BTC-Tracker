/**
 * Admin Users API Tests
 * Tests for user listing with active/inactive filtering (issue #167)
 */

import { testDb, setupTestDatabase, cleanTestDatabase } from '../test-db'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

// Mock auth so tests bypass real authentication
jest.mock('@/lib/auth-helpers', () => ({
  withAdminAuth: jest.fn((request: NextRequest, handler: Function) =>
    handler(1, { id: '1', email: 'admin@test.com', isAdmin: true, name: 'Admin' })
  )
}))

const createMockRequest = (method: string, url: string) => {
  const fullUrl = `http://localhost:3000${url}`
  return new NextRequest(fullUrl, { method })
}

import { GET as usersGET } from '../../app/api/admin/users/route'
import { PUT as userPUT } from '../../app/api/admin/users/[id]/route'

describe('Admin Users API', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()

    const hash = await bcrypt.hash('password123', 10)

    // Create admin user (id=1)
    await testDb.user.create({
      data: { email: 'admin@test.com', passwordHash: hash, name: 'Admin', isAdmin: true, isActive: true }
    })

    // Create active user
    await testDb.user.create({
      data: { email: 'active@test.com', passwordHash: hash, name: 'Active User', isAdmin: false, isActive: true }
    })

    // Create inactive user
    await testDb.user.create({
      data: { email: 'inactive@test.com', passwordHash: hash, name: 'Inactive User', isAdmin: false, isActive: false }
    })
  })

  afterAll(async () => {
    await testDb.$disconnect()
  })

  describe('GET /api/admin/users', () => {
    it('should return only active users by default', async () => {
      const req = createMockRequest('GET', '/api/admin/users')
      const response = await usersGET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      const emails = data.data.map((u: any) => u.email)
      expect(emails).toContain('admin@test.com')
      expect(emails).toContain('active@test.com')
      expect(emails).not.toContain('inactive@test.com')
    })

    it('should return all users including inactive when include_inactive=true', async () => {
      const req = createMockRequest('GET', '/api/admin/users?include_inactive=true')
      const response = await usersGET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      const emails = data.data.map((u: any) => u.email)
      expect(emails).toContain('admin@test.com')
      expect(emails).toContain('active@test.com')
      expect(emails).toContain('inactive@test.com')
    })

    it('should show isActive=false for deactivated users', async () => {
      const req = createMockRequest('GET', '/api/admin/users?include_inactive=true')
      const response = await usersGET(req)
      const data = await response.json()

      const inactiveUser = data.data.find((u: any) => u.email === 'inactive@test.com')
      expect(inactiveUser).toBeDefined()
      expect(inactiveUser.isActive).toBe(false)
    })
  })

  describe('PUT /api/admin/users/:id - reactivate user', () => {
    it('should reactivate a deactivated user', async () => {
      // Find the inactive user
      const inactiveUser = await testDb.user.findUnique({ where: { email: 'inactive@test.com' } })
      expect(inactiveUser).not.toBeNull()

      const req = {
        method: 'PUT',
        url: `http://localhost:3000/api/admin/users/${inactiveUser!.id}`,
        headers: new Headers({}),
        json: async () => ({ isActive: true }),
      } as unknown as NextRequest

      const context = { params: Promise.resolve({ id: String(inactiveUser!.id) }) }
      const response = await userPUT(req, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isActive).toBe(true)

      // Verify in DB
      const updated = await testDb.user.findUnique({ where: { id: inactiveUser!.id } })
      expect(updated!.isActive).toBe(true)
    })
  })
})
