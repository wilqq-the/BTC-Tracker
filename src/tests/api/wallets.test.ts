/**
 * Wallets API Tests
 * Tests for wallet CRUD operations, ownership checks, and balance calculation
 */

jest.mock('../../lib/bitcoin-price-service', () => ({
  BitcoinPriceService: {
    getCurrentPrice: jest.fn().mockResolvedValue({ price: 50000 }),
    calculateAndStorePortfolioSummary: jest.fn().mockResolvedValue(undefined),
    calculateAndStorePortfolioSummaryDebounced: jest.fn().mockResolvedValue(undefined),
  },
}))

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUserWithToken } from '../test-helpers'
import { NextRequest } from 'next/server'
import { GET as walletsGET, POST as walletsPOST } from '../../app/api/wallets/route'
// ensureDefaultWallets is tested indirectly via GET (auto-creates on first call)
import { PUT as walletPUT, DELETE as walletDELETE } from '../../app/api/wallets/[id]/route'

const createMockRequest = (method: string, url: string, body?: any, headers?: any) => {
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`
  const urlObj = new URL(fullUrl)
  return {
    method,
    url: fullUrl,
    headers: new Headers(headers || {}),
    json: async () => body || {},
    text: async () => JSON.stringify(body || {}),
    nextUrl: { pathname: urlObj.pathname, searchParams: urlObj.searchParams },
  } as unknown as NextRequest
}

describe('Wallets API', () => {
  let testUser: any
  let authHeaders: { Authorization: string }

  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()

    const userWithToken = await createTestUserWithToken({
      email: `wallettest-${Date.now()}@example.com`,
      name: 'Wallet Test User',
    })
    testUser = userWithToken.user
    authHeaders = userWithToken.authHeaders
  }, 30000)

  afterAll(async () => {
    await testDb.$disconnect()
  })

  const auth = (method: string, url: string, body?: any) =>
    createMockRequest(method, url, body, authHeaders)

  // ─── GET /api/wallets ───────────────────────────────────────────────────────

  describe('GET /api/wallets', () => {
    it('returns 401 without auth', async () => {
      const res = await walletsGET(createMockRequest('GET', '/api/wallets'))
      expect(res.status).toBe(401)
    })

    it('auto-creates default Cold + Hot wallets on first call', async () => {
      const res = await walletsGET(auth('GET', '/api/wallets'))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)

      const types = data.data.map((w: any) => w.type)
      expect(types).toContain('cold')
      expect(types).toContain('hot')
    })

    it('does not duplicate defaults on repeated calls', async () => {
      await walletsGET(auth('GET', '/api/wallets'))
      const res = await walletsGET(auth('GET', '/api/wallets'))
      const data = await res.json()

      expect(data.data).toHaveLength(2)
    })

    it('returns btcBalance on every wallet', async () => {
      const res = await walletsGET(auth('GET', '/api/wallets'))
      const data = await res.json()

      for (const wallet of data.data) {
        expect(wallet).toHaveProperty('btcBalance')
        expect(typeof wallet.btcBalance).toBe('number')
      }
    })

    it('calculates btcBalance from linked transactions', async () => {
      // Create a wallet and a BUY transaction that deposits into it
      const wallet = await testDb.wallet.create({
        data: { userId: testUser.id, name: 'Funded', type: 'hot', includeInPortfolio: true },
      })
      await testDb.bitcoinTransaction.create({
        data: {
          userId: testUser.id,
          type: 'BUY',
          btcAmount: 0.5,
          originalPricePerBtc: 50000,
          originalCurrency: 'USD',
          originalTotalAmount: 25000,
          fees: 0,
          feesCurrency: 'USD',
          transactionDate: new Date(),
          toWalletId: wallet.id,
        },
      })

      const res = await walletsGET(auth('GET', '/api/wallets'))
      const data = await res.json()
      const found = data.data.find((w: any) => w.id === wallet.id)

      expect(found).toBeDefined()
      expect(found.btcBalance).toBeCloseTo(0.5)
    })

    it('isolates wallets per user — other user wallets not returned', async () => {
      const other = await createTestUserWithToken({ email: `other-${Date.now()}@example.com` })
      await testDb.wallet.create({
        data: { userId: other.user.id, name: 'Theirs', type: 'cold', includeInPortfolio: true },
      })

      const res = await walletsGET(auth('GET', '/api/wallets'))
      const data = await res.json()

      const ids = data.data.map((w: any) => w.userId)
      expect(ids.every((id: number) => id === testUser.id)).toBe(true)
    })
  })

  // ─── POST /api/wallets ──────────────────────────────────────────────────────

  describe('POST /api/wallets', () => {
    it('creates a cold wallet with all fields', async () => {
      const res = await walletsPOST(
        auth('POST', '/api/wallets', {
          name: 'Ledger Nano',
          type: 'cold',
          emoji: '❄️',
          note: 'Hardware wallet',
        })
      )
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Ledger Nano')
      expect(data.data.type).toBe('cold')
      expect(data.data.emoji).toBe('❄️')
      expect(data.data.note).toBe('Hardware wallet')
      expect(data.data.includeInPortfolio).toBe(true)
    })

    it('creates a hot wallet with includeInPortfolio disabled', async () => {
      const res = await walletsPOST(
        auth('POST', '/api/wallets', {
          name: 'Exchange',
          type: 'hot',
          includeInPortfolio: false,
        })
      )
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.data.includeInPortfolio).toBe(false)
    })

    it('persists the wallet to the database', async () => {
      await walletsPOST(
        auth('POST', '/api/wallets', { name: 'Trezor', type: 'cold' })
      )
      const count = await testDb.wallet.count({
        where: { userId: testUser.id, name: 'Trezor' },
      })
      expect(count).toBe(1)
    })

    it('returns 400 when name is missing', async () => {
      const res = await walletsPOST(auth('POST', '/api/wallets', { type: 'cold' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid type', async () => {
      const res = await walletsPOST(
        auth('POST', '/api/wallets', { name: 'Test', type: 'lukewarm' })
      )
      expect(res.status).toBe(400)
    })

    it('returns 401 without auth', async () => {
      const res = await walletsPOST(
        createMockRequest('POST', '/api/wallets', { name: 'X', type: 'hot' })
      )
      expect(res.status).toBe(401)
    })
  })

  // ─── PUT /api/wallets/[id] ──────────────────────────────────────────────────

  describe('PUT /api/wallets/[id]', () => {
    let walletId: number

    beforeEach(async () => {
      const wallet = await testDb.wallet.create({
        data: { userId: testUser.id, name: 'Original', type: 'hot', includeInPortfolio: true },
      })
      walletId = wallet.id
    })

    it('updates name, type and emoji', async () => {
      const res = await walletPUT(
        auth('PUT', `/api/wallets/${walletId}`, {
          name: 'Updated',
          type: 'cold',
          emoji: '🔒',
        }),
        { params: Promise.resolve({ id: walletId.toString() }) }
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.name).toBe('Updated')
      expect(data.data.type).toBe('cold')
      expect(data.data.emoji).toBe('🔒')
    })

    it('toggles includeInPortfolio to false', async () => {
      const res = await walletPUT(
        auth('PUT', `/api/wallets/${walletId}`, { includeInPortfolio: false }),
        { params: Promise.resolve({ id: walletId.toString() }) }
      )
      const data = await res.json()

      expect(data.data.includeInPortfolio).toBe(false)
    })

    it('returns 404 for a wallet owned by another user', async () => {
      const other = await createTestUserWithToken({ email: `owner2-${Date.now()}@example.com` })
      const otherWallet = await testDb.wallet.create({
        data: { userId: other.user.id, name: 'Theirs', type: 'hot', includeInPortfolio: true },
      })

      const res = await walletPUT(
        auth('PUT', `/api/wallets/${otherWallet.id}`, { name: 'Hijack' }),
        { params: Promise.resolve({ id: otherWallet.id.toString() }) }
      )
      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid type value', async () => {
      const res = await walletPUT(
        auth('PUT', `/api/wallets/${walletId}`, { type: 'warm' }),
        { params: Promise.resolve({ id: walletId.toString() }) }
      )
      expect(res.status).toBe(400)
    })

    it('returns 400 for non-numeric id', async () => {
      const res = await walletPUT(
        auth('PUT', '/api/wallets/abc', { name: 'X' }),
        { params: Promise.resolve({ id: 'abc' }) }
      )
      expect(res.status).toBe(400)
    })
  })

  // ─── DELETE /api/wallets/[id] ───────────────────────────────────────────────

  describe('DELETE /api/wallets/[id]', () => {
    it('hard-deletes a wallet with no transactions', async () => {
      const wallet = await testDb.wallet.create({
        data: { userId: testUser.id, name: 'Empty', type: 'cold', includeInPortfolio: true },
      })

      const res = await walletDELETE(
        auth('DELETE', `/api/wallets/${wallet.id}`),
        { params: Promise.resolve({ id: wallet.id.toString() }) }
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)

      const gone = await testDb.wallet.findUnique({ where: { id: wallet.id } })
      expect(gone).toBeNull()
    })

    it('soft-deletes a wallet referenced by transactions', async () => {
      const wallet = await testDb.wallet.create({
        data: { userId: testUser.id, name: 'Used', type: 'hot', includeInPortfolio: true },
      })
      await testDb.bitcoinTransaction.create({
        data: {
          userId: testUser.id,
          type: 'TRANSFER',
          btcAmount: 0.1,
          originalPricePerBtc: 0,
          originalCurrency: 'USD',
          originalTotalAmount: 0,
          fees: 0.0001,
          feesCurrency: 'BTC',
          transactionDate: new Date(),
          transferType: 'TO_COLD_WALLET',
          toWalletId: wallet.id,
        },
      })

      const res = await walletDELETE(
        auth('DELETE', `/api/wallets/${wallet.id}`),
        { params: Promise.resolve({ id: wallet.id.toString() }) }
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)

      // Row still exists but hidden
      const softDeleted = await testDb.wallet.findUnique({ where: { id: wallet.id } })
      expect(softDeleted).not.toBeNull()
      expect(softDeleted!.isActive).toBe(false)
    })

    it('returns 404 for a wallet owned by another user', async () => {
      const other = await createTestUserWithToken({ email: `del-other-${Date.now()}@example.com` })
      const otherWallet = await testDb.wallet.create({
        data: { userId: other.user.id, name: 'Theirs', type: 'hot', includeInPortfolio: true },
      })

      const res = await walletDELETE(
        auth('DELETE', `/api/wallets/${otherWallet.id}`),
        { params: Promise.resolve({ id: otherWallet.id.toString() }) }
      )
      expect(res.status).toBe(404)
    })

    it('returns 401 without auth', async () => {
      const wallet = await testDb.wallet.create({
        data: { userId: testUser.id, name: 'Anon', type: 'hot', includeInPortfolio: true },
      })

      const res = await walletDELETE(
        createMockRequest('DELETE', `/api/wallets/${wallet.id}`),
        { params: Promise.resolve({ id: wallet.id.toString() }) }
      )
      expect(res.status).toBe(401)
    })
  })
})
