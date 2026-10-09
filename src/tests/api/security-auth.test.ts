/**
 * API authentication / authorization tests
 *
 * Covers the middleware's edge-safe checks and, route by route, that every
 * formerly unauthenticated handler now requires a valid session/token and
 * that server-wide operations are admin-only. Route handlers are called
 * directly (like the other API tests); background services are mocked so no
 * schedulers or external price/rate fetches run.
 */

jest.mock('../../lib/bitcoin-price-service', () => ({
  BitcoinPriceService: {
    getCurrentPrice: jest.fn().mockResolvedValue({
      price: 50000,
      timestamp: '2024-01-15T10:00:00.000Z',
      source: 'database',
      priceChange24h: 0,
      priceChangePercent24h: 0,
    }),
    getTodaysOHLC: jest.fn().mockResolvedValue(null),
    clearCache: jest.fn(),
    calculateAndStorePortfolioSummary: jest.fn().mockResolvedValue(undefined),
    calculateAndStorePortfolioSummaryDebounced: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('../../lib/exchange-rate-service', () => ({
  ExchangeRateService: {
    getExchangeRate: jest.fn().mockResolvedValue(1),
    getAllExchangeRates: jest.fn().mockResolvedValue([]),
    updateAllExchangeRates: jest.fn().mockResolvedValue(undefined),
    clearCache: jest.fn(),
  },
}))

jest.mock('../../lib/historical-data-service', () => ({
  HistoricalDataService: {
    getHistoricalData: jest.fn().mockResolvedValue([]),
    getLatestHistoricalPrice: jest.fn().mockResolvedValue(null),
    forceUpdate: jest.fn().mockResolvedValue({ success: true }),
  },
}))

jest.mock('../../lib/yahoo-finance-service', () => ({
  YahooFinanceService: {
    fetchHistoricalData: jest.fn().mockResolvedValue([]),
    saveHistoricalData: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('../../lib/app-initialization', () => ({
  AppInitializationService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    restart: jest.fn().mockResolvedValue(undefined),
    triggerDataUpdate: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockReturnValue({ isInitialized: true, isInitializing: false, processId: 1 }),
  },
}))

jest.mock('../../lib/price-scheduler', () => ({
  PriceScheduler: {
    getStatus: jest.fn().mockReturnValue({ intradayActive: false, historicalActive: false, exchangeRateActive: false }),
  },
}))

jest.mock('../../lib/dca-scheduler', () => ({
  DCAScheduler: {
    getStatus: jest.fn().mockReturnValue({ isRunning: false }),
    getStatistics: jest.fn().mockResolvedValue({ active: 0, paused: 0, totalExecutions: 0 }),
  },
}))

import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { NextRequest, type NextFetchEvent } from 'next/server'
import middleware from '../../middleware'
import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUserWithToken } from '../test-helpers'
import { isBearerTokenAcceptable, isPublicApiPath, isWellFormedApiKey } from '../../lib/middleware-auth'

import * as settingsRoute from '../../app/api/settings/route'
import * as customCurrenciesRoute from '../../app/api/custom-currencies/route'
import * as customCurrencyRoute from '../../app/api/custom-currencies/[id]/route'
import * as bitcoinPriceRoute from '../../app/api/bitcoin-price/route'
import * as bitcoinPriceTodayRoute from '../../app/api/bitcoin-price/today/route'
import * as exchangeRatesRoute from '../../app/api/exchange-rates/route'
import * as historicalDataRoute from '../../app/api/historical-data/route'
import * as historicalDataStatusRoute from '../../app/api/historical-data/status/route'
import * as historicalDataUpdateRoute from '../../app/api/historical-data/update/route'
import * as historicalDataFetchRoute from '../../app/api/historical-data/fetch/route'
import * as goalsCalculateRoute from '../../app/api/goals/calculate/route'
import * as goalsScenariosRoute from '../../app/api/goals/scenarios/route'
import * as startupRoute from '../../app/api/startup/route'
import * as systemStatusRoute from '../../app/api/system/status/route'
import * as systemSchedulerRoute from '../../app/api/system/scheduler/route'
import * as transactionsRoute from '../../app/api/transactions/route'
import * as transactionRoute from '../../app/api/transactions/[id]/route'

const SECRET = process.env.NEXTAUTH_SECRET as string

const createMockRequest = (method: string, url: string, body?: any, headers?: Record<string, string>) => {
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

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

async function createApiKey(userId: number): Promise<string> {
  const key = `btct_${crypto.randomBytes(32).toString('hex')}`
  await testDb.apiKey.create({
    data: {
      userId,
      keyHash: crypto.createHash('sha256').update(key).digest('hex'),
      keyPrefix: key.slice(5, 13),
      label: 'test key',
      isActive: true,
    },
  })
  return key
}

type Level = 'user' | 'admin'
interface RouteCase {
  name: string
  level: Level
  call: (headers?: Record<string, string>) => Promise<Response>
}

const idCtx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) })

// Every handler that previously had no authentication of its own.
const ROUTES: RouteCase[] = [
  // Settings (server-wide row)
  { name: 'GET /api/settings', level: 'user', call: (h) => settingsRoute.GET(createMockRequest('GET', '/api/settings', undefined, h)) },
  { name: 'PATCH /api/settings (display)', level: 'user', call: (h) => settingsRoute.PATCH(createMockRequest('PATCH', '/api/settings', { category: 'display', updates: { theme: 'dark' } }, h)) },
  { name: 'PATCH /api/settings (priceData)', level: 'admin', call: (h) => settingsRoute.PATCH(createMockRequest('PATCH', '/api/settings', { category: 'priceData', updates: { enableIntradayData: true } }, h)) },
  { name: 'POST /api/settings (reset)', level: 'admin', call: (h) => settingsRoute.POST(createMockRequest('POST', '/api/settings', undefined, h)) },
  { name: 'PUT /api/settings', level: 'admin', call: (h) => settingsRoute.PUT(createMockRequest('PUT', '/api/settings', {}, h)) },

  // Custom currencies (global)
  { name: 'GET /api/custom-currencies', level: 'user', call: (h) => customCurrenciesRoute.GET(createMockRequest('GET', '/api/custom-currencies', undefined, h)) },
  { name: 'POST /api/custom-currencies', level: 'admin', call: (h) => customCurrenciesRoute.POST(createMockRequest('POST', '/api/custom-currencies', { code: 'TST', name: 'Test', symbol: 'T' }, h)) },
  { name: 'PUT /api/custom-currencies/[id]', level: 'admin', call: (h) => customCurrencyRoute.PUT(createMockRequest('PUT', '/api/custom-currencies/999999', { name: 'X' }, h), idCtx(999999)) },
  { name: 'DELETE /api/custom-currencies/[id]', level: 'admin', call: (h) => customCurrencyRoute.DELETE(createMockRequest('DELETE', '/api/custom-currencies/999999', undefined, h), idCtx(999999)) },

  // Prices / rates
  { name: 'GET /api/bitcoin-price', level: 'user', call: (h) => bitcoinPriceRoute.GET(createMockRequest('GET', '/api/bitcoin-price', undefined, h)) },
  { name: 'POST /api/bitcoin-price', level: 'admin', call: (h) => bitcoinPriceRoute.POST(createMockRequest('POST', '/api/bitcoin-price', undefined, h)) },
  { name: 'GET /api/bitcoin-price/today', level: 'user', call: (h) => bitcoinPriceTodayRoute.GET(createMockRequest('GET', '/api/bitcoin-price/today', undefined, h)) },
  { name: 'GET /api/exchange-rates', level: 'user', call: (h) => exchangeRatesRoute.GET(createMockRequest('GET', '/api/exchange-rates', undefined, h)) },
  { name: 'POST /api/exchange-rates', level: 'user', call: (h) => exchangeRatesRoute.POST(createMockRequest('POST', '/api/exchange-rates', { action: 'clear_cache' }, h)) },

  // Historical data
  { name: 'GET /api/historical-data', level: 'user', call: (h) => historicalDataRoute.GET(createMockRequest('GET', '/api/historical-data?days=30', undefined, h)) },
  { name: 'GET /api/historical-data/status', level: 'user', call: (h) => historicalDataStatusRoute.GET(createMockRequest('GET', '/api/historical-data/status', undefined, h)) },
  { name: 'GET /api/historical-data/update', level: 'user', call: (h) => historicalDataUpdateRoute.GET(createMockRequest('GET', '/api/historical-data/update', undefined, h)) },
  { name: 'POST /api/historical-data/update', level: 'admin', call: (h) => historicalDataUpdateRoute.POST(createMockRequest('POST', '/api/historical-data/update', undefined, h)) },
  { name: 'POST /api/historical-data/fetch', level: 'admin', call: (h) => historicalDataFetchRoute.POST(createMockRequest('POST', '/api/historical-data/fetch', { period: '1M' }, h)) },

  // Goals calculators
  { name: 'POST /api/goals/calculate', level: 'user', call: (h) => goalsCalculateRoute.POST(createMockRequest('POST', '/api/goals/calculate', {}, h)) },
  { name: 'GET /api/goals/scenarios', level: 'user', call: (h) => goalsScenariosRoute.GET(createMockRequest('GET', '/api/goals/scenarios', undefined, h)) },

  // System
  { name: 'GET /api/startup', level: 'user', call: (h) => startupRoute.GET(createMockRequest('GET', '/api/startup', undefined, h)) },
  { name: 'POST /api/startup', level: 'admin', call: (h) => startupRoute.POST(createMockRequest('POST', '/api/startup', undefined, h)) },
  { name: 'GET /api/system/status', level: 'user', call: (h) => systemStatusRoute.GET(createMockRequest('GET', '/api/system/status', undefined, h)) },
  { name: 'GET /api/system/scheduler', level: 'user', call: (h) => systemSchedulerRoute.GET(createMockRequest('GET', '/api/system/scheduler', undefined, h)) },
  { name: 'POST /api/system/scheduler', level: 'admin', call: (h) => systemSchedulerRoute.POST(createMockRequest('POST', '/api/system/scheduler', { action: 'initialize' }, h)) },
]

describe('middleware', () => {
  const run = (url: string, headers?: Record<string, string>) =>
    middleware(new NextRequest(url, { headers }), {} as NextFetchEvent) as Promise<Response>
  const passedThrough = (res: Response) => res.headers.get('x-middleware-next') === '1'

  it('rejects a fake API key on a protected API route with 401', async () => {
    const res = await run('http://localhost/api/settings', bearer('btct_fake'))
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated requests to API routes outside the old matcher', async () => {
    for (const path of ['/api/bitcoin-price', '/api/custom-currencies', '/api/exchange-rates', '/api/startup']) {
      const res = await run(`http://localhost${path}`)
      expect(res.status).toBe(401)
    }
  })

  it('passes public endpoints through without auth', async () => {
    expect(passedThrough(await run('http://localhost/api/health'))).toBe(true)
    expect(passedThrough(await run('http://localhost/api/auth/check-user'))).toBe(true)
  })

  it('passes valid JWTs and well-formed API keys through to the route', async () => {
    const token = jwt.sign({ sub: '1', email: 'a@example.com' }, SECRET, { expiresIn: '1h' })
    expect(passedThrough(await run('http://localhost/api/settings', bearer(token)))).toBe(true)
    expect(passedThrough(await run('http://localhost/api/settings', bearer(`btct_${'a'.repeat(64)}`)))).toBe(true)
  })

  it('redirects unauthenticated page requests to sign-in', async () => {
    const res = await run('http://localhost/settings')
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toContain('/auth/signin')
  })
})

describe('Middleware auth helpers', () => {
  it('treats only NextAuth/sign-in and health endpoints as public', () => {
    expect(isPublicApiPath('/api/auth/session')).toBe(true)
    expect(isPublicApiPath('/api/auth/register')).toBe(true)
    expect(isPublicApiPath('/api/auth/check-user')).toBe(true)
    expect(isPublicApiPath('/api/health')).toBe(true)
    expect(isPublicApiPath('/api/health/db')).toBe(true)

    expect(isPublicApiPath('/api/settings')).toBe(false)
    expect(isPublicApiPath('/api/bitcoin-price')).toBe(false)
    expect(isPublicApiPath('/api/custom-currencies')).toBe(false)
    expect(isPublicApiPath('/api/healthz')).toBe(false)
    expect(isPublicApiPath('/api/authx')).toBe(false)
    expect(isPublicApiPath('/api/health/other')).toBe(false)
  })

  it('accepts only API keys in the issued format', () => {
    expect(isWellFormedApiKey(`btct_${'a'.repeat(64)}`)).toBe(true)
    expect(isWellFormedApiKey('btct_fake')).toBe(false)
    expect(isWellFormedApiKey(`btct_${'A'.repeat(64)}`)).toBe(false)
    expect(isWellFormedApiKey(`btct_${'a'.repeat(65)}`)).toBe(false)
  })

  it('rejects malformed API keys and invalid JWTs, accepts valid JWTs', async () => {
    expect(await isBearerTokenAcceptable('btct_fake', SECRET)).toBe(false)
    expect(await isBearerTokenAcceptable('', SECRET)).toBe(false)
    expect(await isBearerTokenAcceptable('not-a-jwt', SECRET)).toBe(false)
    expect(await isBearerTokenAcceptable(`btct_${'0'.repeat(64)}`, SECRET)).toBe(true)

    const valid = jwt.sign({ sub: '1', email: 'a@example.com' }, SECRET, { expiresIn: '1h' })
    expect(await isBearerTokenAcceptable(valid, SECRET)).toBe(true)

    const wrongSecret = jwt.sign({ sub: '1', email: 'a@example.com' }, 'some-other-secret', { expiresIn: '1h' })
    expect(await isBearerTokenAcceptable(wrongSecret, SECRET)).toBe(false)

    const expired = jwt.sign({ sub: '1', email: 'a@example.com', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET)
    expect(await isBearerTokenAcceptable(expired, SECRET)).toBe(false)

    const missingClaims = jwt.sign({ foo: 'bar' }, SECRET, { expiresIn: '1h' })
    expect(await isBearerTokenAcceptable(missingClaims, SECRET)).toBe(false)

    expect(await isBearerTokenAcceptable(valid, undefined)).toBe(false)
  })
})

describe('API route authentication', () => {
  let userHeaders: Record<string, string>
  let adminHeaders: Record<string, string>
  let userApiKeyHeaders: Record<string, string>
  let adminApiKeyHeaders: Record<string, string>

  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()

    const admin = await createTestUserWithToken({ email: `sec-admin-${Date.now()}@example.com` })
    await testDb.user.update({ where: { id: admin.user.id }, data: { isAdmin: true } })
    const user = await createTestUserWithToken({ email: `sec-user-${Date.now()}@example.com` })

    adminHeaders = admin.authHeaders
    userHeaders = user.authHeaders
    adminApiKeyHeaders = bearer(await createApiKey(admin.user.id))
    userApiKeyHeaders = bearer(await createApiKey(user.user.id))
  }, 30000)

  afterAll(async () => {
    await testDb.$disconnect()
  })

  describe.each(ROUTES)('$name ($level)', ({ level, call }) => {
    it('returns 401 without authentication', async () => {
      const res = await call()
      expect(res.status).toBe(401)
    })

    it('returns 401 for a fake API key', async () => {
      const res = await call(bearer('btct_fake'))
      expect(res.status).toBe(401)
    })

    it('returns 401 for a well-formed but unknown API key', async () => {
      const res = await call(bearer(`btct_${'0'.repeat(64)}`))
      expect(res.status).toBe(401)
    })

    it('returns 401 for a JWT signed with the wrong secret', async () => {
      const forged = jwt.sign({ sub: '1', email: 'x@example.com' }, 'wrong-secret', { expiresIn: '1h' })
      const res = await call(bearer(forged))
      expect(res.status).toBe(401)
    })

    if (level === 'admin') {
      it('returns 403 for a non-admin user (JWT and API key)', async () => {
        expect((await call(userHeaders)).status).toBe(403)
        expect((await call(userApiKeyHeaders)).status).toBe(403)
      })

      it('lets an admin through (JWT and API key)', async () => {
        for (const headers of [adminHeaders, adminApiKeyHeaders]) {
          const res = await call(headers)
          expect([401, 403]).not.toContain(res.status)
        }
      })
    } else {
      it('lets an authenticated user through (JWT and API key)', async () => {
        for (const headers of [userHeaders, userApiKeyHeaders]) {
          const res = await call(headers)
          expect([401, 403]).not.toContain(res.status)
        }
      })
    }
  })

  it('rejects a revoked API key', async () => {
    const owner = await testDb.user.findFirst({ where: { email: { startsWith: 'sec-user-' } } })
    const key = await createApiKey(owner!.id)
    await testDb.apiKey.updateMany({ where: { userId: owner!.id }, data: { isActive: false } })
    const res = await settingsRoute.GET(createMockRequest('GET', '/api/settings', undefined, bearer(key)))
    expect(res.status).toBe(401)
  })

  it('returns real data for authenticated reads', async () => {
    const settingsRes = await settingsRoute.GET(createMockRequest('GET', '/api/settings', undefined, userHeaders))
    expect(settingsRes.status).toBe(200)
    expect((await settingsRes.json()).data.currency).toBeDefined()

    const priceRes = await bitcoinPriceRoute.GET(createMockRequest('GET', '/api/bitcoin-price', undefined, userApiKeyHeaders))
    expect(priceRes.status).toBe(200)
    expect((await priceRes.json()).data.price).toBe(50000)
  })

  describe('settings sections', () => {
    it('lets a non-admin change user-facing sections but not price-data settings', async () => {
      const before = await (await settingsRoute.GET(createMockRequest('GET', '/api/settings', undefined, userHeaders))).json()

      const display = await settingsRoute.PATCH(createMockRequest('PATCH', '/api/settings', { category: 'display', updates: { decimalPlaces: 4 } }, userHeaders))
      expect(display.status).toBe(200)

      const priceCategory = await settingsRoute.PATCH(createMockRequest('PATCH', '/api/settings', { category: 'priceData', updates: { enableIntradayData: !before.data.priceData.enableIntradayData } }, userHeaders))
      expect(priceCategory.status).toBe(403)

      const priceDirect = await settingsRoute.PATCH(createMockRequest('PATCH', '/api/settings', { priceData: { ...before.data.priceData, enableIntradayData: !before.data.priceData.enableIntradayData } }, userHeaders))
      expect(priceDirect.status).toBe(403)

      const after = await (await settingsRoute.GET(createMockRequest('GET', '/api/settings', undefined, userHeaders))).json()
      expect(after.data.priceData).toEqual(before.data.priceData)
      expect(after.data.display.decimalPlaces).toBe(4)
    })
  })

  describe('custom currencies', () => {
    it('admin can create; users can read but not modify', async () => {
      const created = await customCurrenciesRoute.POST(createMockRequest('POST', '/api/custom-currencies', { code: 'ABC', name: 'Alphabet', symbol: 'A' }, adminHeaders))
      expect(created.status).toBe(200)
      const { data } = await created.json()

      const list = await customCurrenciesRoute.GET(createMockRequest('GET', '/api/custom-currencies', undefined, userHeaders))
      expect(list.status).toBe(200)
      expect((await list.json()).data.map((c: any) => c.code)).toContain('ABC')

      const del = await customCurrencyRoute.DELETE(createMockRequest('DELETE', `/api/custom-currencies/${data.id}?permanent=true`, undefined, userHeaders), idCtx(data.id))
      expect(del.status).toBe(403)
      expect(await testDb.customCurrency.findUnique({ where: { id: data.id } })).not.toBeNull()
    })
  })

  describe('cross-user isolation', () => {
    async function twoUsersWithWallets() {
      const alice = await createTestUserWithToken({ email: `alice-${Date.now()}@example.com` })
      const bob = await createTestUserWithToken({ email: `bob-${Date.now()}@example.com` })
      const aliceWallet = await testDb.wallet.create({ data: { userId: alice.user.id, name: 'Alice cold', type: 'cold' } })
      const bobWallet = await testDb.wallet.create({ data: { userId: bob.user.id, name: 'Bob cold', type: 'cold' } })
      return { alice, bob, aliceWallet, bobWallet }
    }

    const buy = (walletId: number) => ({
      type: 'BUY',
      btc_amount: '0.5',
      price_per_btc: '40000',
      currency: 'USD',
      fees: '0',
      transaction_date: '2024-01-01',
      to_wallet_id: walletId,
    })

    it("a user cannot attach a new transaction to another user's wallet", async () => {
      const { bob, aliceWallet, bobWallet } = await twoUsersWithWallets()

      const res = await transactionsRoute.POST(createMockRequest('POST', '/api/transactions', buy(aliceWallet.id), bob.authHeaders))
      expect(res.status).toBe(400)
      expect(await testDb.bitcoinTransaction.count({ where: { toWalletId: aliceWallet.id } })).toBe(0)

      const own = await transactionsRoute.POST(createMockRequest('POST', '/api/transactions', buy(bobWallet.id), bob.authHeaders))
      expect(own.status).toBe(201)
    })

    it("a user cannot move an existing transaction into another user's wallet", async () => {
      const { bob, aliceWallet, bobWallet } = await twoUsersWithWallets()
      const created = await transactionsRoute.POST(createMockRequest('POST', '/api/transactions', buy(bobWallet.id), bob.authHeaders))
      const txId = (await created.json()).data.id

      const res = await transactionRoute.PUT(
        createMockRequest('PUT', `/api/transactions/${txId}`, buy(aliceWallet.id), bob.authHeaders),
        idCtx(txId)
      )
      expect(res.status).toBe(400)
      const tx = await testDb.bitcoinTransaction.findUnique({ where: { id: txId } })
      expect(tx!.toWalletId).toBe(bobWallet.id)
    })

    it("a user cannot read another user's transaction", async () => {
      const { alice, bob, aliceWallet } = await twoUsersWithWallets()
      const created = await transactionsRoute.POST(createMockRequest('POST', '/api/transactions', buy(aliceWallet.id), alice.authHeaders))
      const txId = (await created.json()).data.id

      const res = await transactionRoute.GET(createMockRequest('GET', `/api/transactions/${txId}`, undefined, bob.authHeaders), idCtx(txId))
      expect(res.status).toBe(404)
    })

    it('GET /api/bitcoin-price does not expose server-wide portfolio totals', async () => {
      const { alice, aliceWallet } = await twoUsersWithWallets()
      await transactionsRoute.POST(createMockRequest('POST', '/api/transactions', buy(aliceWallet.id), alice.authHeaders))

      const res = await bitcoinPriceRoute.GET(createMockRequest('GET', '/api/bitcoin-price?endpoint=portfolio', undefined, userHeaders))
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.data.totalBTC).toBeUndefined()
      expect(body.data.totalTransactions).toBeUndefined()
    })

    it('the unscoped /api/analytics route no longer exists', () => {
      expect(() => require('../../app/api/analytics/route')).toThrow()
    })
  })
})
