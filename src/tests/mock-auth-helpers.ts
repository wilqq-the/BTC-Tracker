/**
 * Auth mock for route-behaviour tests.
 *
 * Authentication/authorization itself is covered by
 * `src/tests/api/security-auth.test.ts`. Tests that only exercise what a
 * route does once the caller is allowed in can use this to run every request
 * as an authenticated admin:
 *
 *   jest.mock('@/lib/auth-helpers', () => require('../mock-auth-helpers').adminAuthMock())
 *
 * Plain functions (not jest.fn) so `restoreMocks` in jest.config doesn't
 * reset them between tests.
 */
import type { AuthUser } from '@/lib/auth-helpers'

export const MOCK_ADMIN_USER: AuthUser = {
  id: '1',
  email: 'admin@test.local',
  name: 'Test Admin',
  isAdmin: true,
  isActive: true,
}

export function adminAuthMock() {
  const actual = jest.requireActual('@/lib/auth-helpers')
  const run = (_request: unknown, handler: (userId: number, user: AuthUser) => unknown) =>
    handler(parseInt(MOCK_ADMIN_USER.id), MOCK_ADMIN_USER)
  return {
    ...actual,
    withAuth: run,
    withAdminAuth: run,
  }
}
