/**
 * Regression tests:
 * - the detailed portfolio metrics' monthly breakdown counted every non-BUY
 *   transaction (including moves to cold storage) as a sale;
 * - sorting transactions by price compared original prices across currencies.
 */

jest.mock('../../lib/bitcoin-price-service', () => ({
  BitcoinPriceService: {
    getCurrentPrice: jest.fn().mockResolvedValue({ price: 50000, priceChange24h: 0, priceChangePercent24h: 0 }),
    getCurrentPriceData: jest.fn().mockResolvedValue({ price: 50000, priceChange24h: 0, priceChangePercent24h: 0 }),
    calculateAndStorePortfolioSummary: jest.fn().mockResolvedValue(undefined),
    calculateAndStorePortfolioSummaryDebounced: jest.fn().mockResolvedValue(undefined),
  },
}))

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUserWithToken, createTestTransaction } from '../test-helpers'
import { NextRequest } from 'next/server'
import { GET as metricsGET } from '../../app/api/portfolio-metrics/route'
import { GET as transactionsGET } from '../../app/api/transactions/route'

const request = (url: string, headers: Record<string, string>) => {
  const full = `http://localhost${url}`
  const u = new URL(full)
  return {
    method: 'GET',
    url: full,
    headers: new Headers(headers),
    nextUrl: { pathname: u.pathname, searchParams: u.searchParams },
  } as unknown as NextRequest
}

describe('Monthly breakdown and price sorting', () => {
  let user: any
  let authHeaders: { Authorization: string }

  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()
    const created = await createTestUserWithToken({
      email: `breakdown-${Date.now()}@example.com`,
      name: 'Breakdown Test User',
    })
    user = created.user
    authHeaders = created.authHeaders
  }, 30000)

  afterAll(async () => {
    await testDb.$disconnect()
  })

  it('does not count transfers between own wallets as sales', async () => {
    await createTestTransaction({ userId: user.id, type: 'BUY', btcAmount: 1, date: new Date('2026-03-05') })
    await createTestTransaction({
      userId: user.id,
      type: 'TRANSFER',
      transferType: 'TO_COLD_WALLET',
      btcAmount: 0.5,
      feesCurrency: 'BTC',
      date: new Date('2026-03-20'),
    })

    const response = await metricsGET(request('/api/portfolio-metrics?detailed=true', authHeaders))
    const result = await response.json()
    const march = result.data.monthlyBreakdown.find((m: any) => m.month === '2026-03')

    expect(march.buys).toBe(1)
    expect(march.sells).toBe(0)
    expect(march.totalSold).toBe(0)
    expect(march.netBtc).toBeCloseTo(1)
  })

  it('counts external transfers in and out toward net BTC, not as buys or sales', async () => {
    await createTestTransaction({
      userId: user.id,
      type: 'TRANSFER',
      transferType: 'TRANSFER_IN',
      btcAmount: 0.3,
      feesCurrency: 'BTC',
      date: new Date('2026-04-02'),
    })
    await createTestTransaction({
      userId: user.id,
      type: 'TRANSFER',
      transferType: 'TRANSFER_OUT',
      btcAmount: 0.1,
      feesCurrency: 'BTC',
      date: new Date('2026-04-10'),
    })

    const response = await metricsGET(request('/api/portfolio-metrics?detailed=true', authHeaders))
    const result = await response.json()
    const april = result.data.monthlyBreakdown.find((m: any) => m.month === '2026-04')

    expect(april.buys).toBe(0)
    expect(april.sells).toBe(0)
    expect(april.netBtc).toBeCloseTo(0.2)
  })

  it('sorts by price using the converted price, not the original amount', async () => {
    // 200,000 PLN is about $50k, cheaper than the $60k buy. Sorting the raw
    // original numbers would wrongly put the PLN row last.
    await createTestTransaction({ userId: user.id, type: 'BUY', originalCurrency: 'USD', originalPricePerBtc: 60000, date: new Date('2026-01-01') })
    await createTestTransaction({ userId: user.id, type: 'BUY', originalCurrency: 'PLN', originalPricePerBtc: 200000, date: new Date('2026-01-02') })

    const response = await transactionsGET(request('/api/transactions?sortBy=price&sortOrder=asc', authHeaders))
    const result = await response.json()

    expect(result.data.map((t: any) => t.original_currency)).toEqual(['PLN', 'USD'])
    const prices = result.data.map((t: any) => t.main_currency_price_per_btc)
    expect(prices[0]).toBeLessThan(prices[1])
  })
})
