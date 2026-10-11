/**
 * Transfer fee modes (#168): "Transaction fee for transfer comes out of sent
 * amount". A transfer's BTC fee can be paid on top (exchange style: the
 * amount arrives, amount + fee leaves) or taken from the amount (original
 * behaviour, still used for every transfer saved without a mode).
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
import { createTestUserWithToken } from '../test-helpers'
import { NextRequest } from 'next/server'
import { GET as metricsGET } from '../../app/api/portfolio-metrics/route'
import { GET as walletsGET } from '../../app/api/wallets/route'
import { POST as transactionsPOST } from '../../app/api/transactions/route'
import { PUT as transactionPUT } from '../../app/api/transactions/[id]/route'
import { btcArriving, btcLeaving, transferFeeBtc } from '../../lib/transfer-fees'

const request = (method: string, url: string, headers: Record<string, string>, body?: any) => {
  const full = `http://localhost${url}`
  const u = new URL(full)
  return {
    method,
    url: full,
    headers: new Headers(headers),
    json: async () => body || {},
    text: async () => JSON.stringify(body || {}),
    nextUrl: { pathname: u.pathname, searchParams: u.searchParams },
  } as unknown as NextRequest
}

describe('transfer fee helpers', () => {
  const tx = (transferFeeMode: string | null, feesCurrency = 'BTC') =>
    ({ btcAmount: 1, fees: 0.1, feesCurrency, transferFeeMode })

  it('paid on top: the amount arrives, amount + fee leaves', () => {
    expect(btcArriving(tx('ON_TOP'))).toBeCloseTo(1)
    expect(btcLeaving(tx('ON_TOP'))).toBeCloseTo(1.1)
  })

  it('taken from the amount (and legacy null): amount leaves, amount - fee arrives', () => {
    for (const mode of ['DEDUCTED', null]) {
      expect(btcLeaving(tx(mode))).toBeCloseTo(1)
      expect(btcArriving(tx(mode))).toBeCloseTo(0.9)
    }
  })

  it('ignores fees paid in fiat', () => {
    expect(transferFeeBtc(tx('ON_TOP', 'USD'))).toBe(0)
    expect(btcLeaving(tx('ON_TOP', 'USD'))).toBe(1)
    expect(btcArriving(tx(null, 'EUR'))).toBe(1)
  })
})

describe('Transfer fee modes in balances and the API', () => {
  let user: any
  let authHeaders: Record<string, string>
  let hot: any
  let cold: any

  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()
    const created = await createTestUserWithToken({ email: `feemode-${Date.now()}@example.com`, name: 'Fee Mode User' })
    user = created.user
    authHeaders = created.authHeaders
    hot = await testDb.wallet.create({ data: { userId: user.id, name: 'Exchange', type: 'hot' } })
    cold = await testDb.wallet.create({ data: { userId: user.id, name: 'Ledger', type: 'cold' } })
    // 2 BTC bought onto the exchange
    await testDb.bitcoinTransaction.create({
      data: {
        userId: user.id, type: 'BUY', btcAmount: 2, originalPricePerBtc: 50000, originalCurrency: 'USD',
        originalTotalAmount: 100000, fees: 0, feesCurrency: 'USD', transactionDate: new Date('2026-01-01'),
        toWalletId: hot.id,
      },
    })
  }, 30000)

  afterAll(async () => {
    await testDb.$disconnect()
  })

  // The issue's case: send 1 BTC to cold storage with a 0.1 BTC network fee
  const sendToCold = (transferFeeMode: string | null) =>
    testDb.bitcoinTransaction.create({
      data: {
        userId: user.id, type: 'TRANSFER', btcAmount: 1, originalPricePerBtc: 0, originalCurrency: 'USD',
        originalTotalAmount: 0, fees: 0.1, feesCurrency: 'BTC', transactionDate: new Date('2026-01-02'),
        transferType: 'TO_COLD_WALLET', transferFeeMode, fromWalletId: hot.id, toWalletId: cold.id,
      },
    })

  const balances = async () => {
    const res = await walletsGET(request('GET', '/api/wallets', authHeaders))
    const data = (await res.json()).data
    return {
      hot: data.find((w: any) => w.id === hot.id).btcBalance,
      cold: data.find((w: any) => w.id === cold.id).btcBalance,
    }
  }

  it('fee paid on top: the full amount arrives in cold storage', async () => {
    await sendToCold('ON_TOP')
    const b = await balances()
    expect(b.cold).toBeCloseTo(1)
    expect(b.hot).toBeCloseTo(0.9)
  })

  it('transfers saved before fee modes keep their original balances', async () => {
    await sendToCold(null)
    const b = await balances()
    expect(b.cold).toBeCloseTo(0.9)
    expect(b.hot).toBeCloseTo(1)
  })

  it('portfolio metrics: same total either way, only the split differs', async () => {
    await sendToCold('ON_TOP')
    const res = await metricsGET(request('GET', '/api/portfolio-metrics', authHeaders))
    const data = (await res.json()).data
    expect(data.totalBtc).toBeCloseTo(1.9) // the 0.1 fee is burned
    const byId = (id: number) => data.walletBreakdown.find((w: any) => w.id === id).btcBalance
    expect(byId(cold.id)).toBeCloseTo(1)
    expect(byId(hot.id)).toBeCloseTo(0.9)
  })

  const transferBody = (extra: Record<string, any>) => ({
    type: 'TRANSFER', btc_amount: '1', price_per_btc: '0', currency: 'USD', fees: '0.1', fees_currency: 'BTC',
    transaction_date: '2026-01-02', notes: '', transfer_type: 'TO_COLD_WALLET',
    from_wallet_id: hot.id, to_wallet_id: cold.id, ...extra,
  })

  it('stores the mode sent by the app and returns it', async () => {
    const res = await transactionsPOST(request('POST', '/api/transactions', authHeaders, transferBody({ transfer_fee_mode: 'ON_TOP' })))
    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.data.transfer_fee_mode).toBe('ON_TOP')
  })

  it('API clients that omit the mode keep the original behaviour', async () => {
    const res = await transactionsPOST(request('POST', '/api/transactions', authHeaders, transferBody({})))
    const data = await res.json()
    expect(data.data.transfer_fee_mode).toBeNull()
  })

  it('rejects an unknown mode', async () => {
    const res = await transactionsPOST(request('POST', '/api/transactions', authHeaders, transferBody({ transfer_fee_mode: 'SOMETIMES' })))
    expect(res.status).toBe(400)
  })

  it('ignores the mode on incoming transfers (the sender pays the fee)', async () => {
    const res = await transactionsPOST(request('POST', '/api/transactions', authHeaders, transferBody({
      transfer_type: 'TRANSFER_IN', from_wallet_id: null, to_wallet_id: hot.id, transfer_fee_mode: 'ON_TOP',
    })))
    const data = await res.json()
    expect(data.data.transfer_fee_mode).toBeNull()
  })

  it('an update without the field keeps the stored mode', async () => {
    const tx = await sendToCold('ON_TOP')
    const body = transferBody({ notes: 'edited by an older client' })
    const res = await transactionPUT(
      request('PUT', `/api/transactions/${tx.id}`, authHeaders, body),
      { params: Promise.resolve({ id: String(tx.id) }) }
    )
    expect(res.status).toBe(200)
    const stored = await testDb.bitcoinTransaction.findUnique({ where: { id: tx.id } })
    expect(stored?.transferFeeMode).toBe('ON_TOP')
  })
})
