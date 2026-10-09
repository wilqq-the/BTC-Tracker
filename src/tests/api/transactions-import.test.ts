/**
 * Transaction Import API Tests
 * Covers wallet linking for TO_COLD_WALLET/FROM_COLD_WALLET transfer rows
 * imported via CSV - the import previously only ever linked BUY/SELL rows,
 * leaving every imported transfer's fromWalletId/toWalletId null.
 */

jest.mock('../../lib/settings-service', () => ({
  SettingsService: {
    getSettings: jest.fn().mockResolvedValue({
      currency: {
        mainCurrency: 'USD',
        secondaryCurrency: 'EUR'
      }
    })
  }
}))

jest.mock('../../lib/exchange-rate-service', () => ({
  ExchangeRateService: {
    getExchangeRate: jest.fn().mockResolvedValue(1.0)
  }
}))

jest.mock('../../lib/bitcoin-price-service', () => ({
  BitcoinPriceService: {
    getCurrentPrice: jest.fn().mockResolvedValue({ price: 50000 }),
    calculateAndStorePortfolioSummary: jest.fn().mockResolvedValue(undefined),
    calculateAndStorePortfolioSummaryDebounced: jest.fn().mockResolvedValue(undefined)
  }
}))

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUserWithToken } from '../test-helpers'
import { NextRequest } from 'next/server'
import { POST as importPOST } from '../../app/api/transactions/import/route'

const STRIKE_CSV_HEADER =
  'Reference,Date & Time (UTC),Transaction Type,Amount USD,Fee USD,Amount BTC,Fee BTC,BTC Price,Cost Basis (USD),Destination,Description,Transaction Hash,Note'

function strikeCsv(rows: string[]): string {
  return [STRIKE_CSV_HEADER, ...rows].join('\n')
}

const createImportRequest = (csv: string, opts: { walletId?: number; authHeaders: Record<string, string> }): NextRequest => {
  const form = new FormData()
  form.append('file', new File([csv], 'statement.csv', { type: 'text/csv' }))
  form.append('duplicate_check_mode', 'off')
  if (opts.walletId !== undefined) {
    form.append('wallet_id', String(opts.walletId))
  }

  return {
    method: 'POST',
    url: 'http://localhost/api/transactions/import',
    headers: new Headers(opts.authHeaders),
    formData: async () => form,
    nextUrl: { pathname: '/api/transactions/import', searchParams: new URLSearchParams() }
  } as unknown as NextRequest
}

describe('Transaction Import - wallet linking', () => {
  let testUser: any
  let authHeaders: { Authorization: string }

  beforeAll(async () => {
    await setupTestDatabase()
    await testDb.user.deleteMany()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()

    const timestamp = Date.now()
    const userWithToken = await createTestUserWithToken({
      email: `import-test-${timestamp}@example.com`,
      name: 'Import Test User'
    })
    testUser = userWithToken.user
    authHeaders = userWithToken.authHeaders
  })

  it('links a TO_COLD_WALLET transfer to walletId and the sole cold wallet', async () => {
    const exchangeWallet = await testDb.wallet.create({
      data: { userId: testUser.id, name: 'Strike', type: 'hot' }
    })
    const coldWallet = await testDb.wallet.create({
      data: { userId: testUser.id, name: 'Cold Wallet', type: 'cold' }
    })

    const csv = strikeCsv([
      'abc-123,Jan 01 2026 10:00:00,Send,,,-0.01000000,,,,bc1qexampleaddress,,txhash123,'
    ])
    const request = createImportRequest(csv, { walletId: exchangeWallet.id, authHeaders })

    const response = await importPOST(request)
    const result = await response.json()
    expect(result.imported).toBe(1)

    const transfer = await testDb.bitcoinTransaction.findFirst({
      where: { userId: testUser.id, type: 'TRANSFER' }
    })
    expect(transfer).not.toBeNull()
    expect(transfer!.transferType).toBe('TO_COLD_WALLET')
    expect(transfer!.fromWalletId).toBe(exchangeWallet.id)
    expect(transfer!.toWalletId).toBe(coldWallet.id)
  })

  it('leaves toWalletId unset when more than one cold wallet exists', async () => {
    const exchangeWallet = await testDb.wallet.create({
      data: { userId: testUser.id, name: 'Strike', type: 'hot' }
    })
    await testDb.wallet.create({
      data: { userId: testUser.id, name: 'Cold Wallet A', type: 'cold' }
    })
    await testDb.wallet.create({
      data: { userId: testUser.id, name: 'Cold Wallet B', type: 'cold' }
    })

    const csv = strikeCsv([
      'abc-124,Jan 02 2026 10:00:00,Send,,,-0.02000000,,,,bc1qexampleaddress,,txhash124,'
    ])
    const request = createImportRequest(csv, { walletId: exchangeWallet.id, authHeaders })

    await importPOST(request)

    const transfer = await testDb.bitcoinTransaction.findFirst({
      where: { userId: testUser.id, type: 'TRANSFER' }
    })
    expect(transfer!.fromWalletId).toBe(exchangeWallet.id)
    expect(transfer!.toWalletId).toBeNull()
  })

  it('still links a BUY row to walletId as before (regression check)', async () => {
    const exchangeWallet = await testDb.wallet.create({
      data: { userId: testUser.id, name: 'Strike', type: 'hot' }
    })

    const csv = strikeCsv([
      'abc-125,Jan 03 2026 10:00:00,Purchase,-100.00,1.00,0.00200000,,50000.00,100.00,,,,'
    ])
    const request = createImportRequest(csv, { walletId: exchangeWallet.id, authHeaders })

    await importPOST(request)

    const buy = await testDb.bitcoinTransaction.findFirst({
      where: { userId: testUser.id, type: 'BUY' }
    })
    expect(buy!.toWalletId).toBe(exchangeWallet.id)
    expect(buy!.fromWalletId).toBeNull()
  })

  it('leaves both sides unset when no walletId is given (existing behavior)', async () => {
    const csv = strikeCsv([
      'abc-126,Jan 04 2026 10:00:00,Send,,,-0.03000000,,,,bc1qexampleaddress,,txhash126,'
    ])
    const request = createImportRequest(csv, { authHeaders })

    await importPOST(request)

    const transfer = await testDb.bitcoinTransaction.findFirst({
      where: { userId: testUser.id, type: 'TRANSFER' }
    })
    expect(transfer!.fromWalletId).toBeNull()
    expect(transfer!.toWalletId).toBeNull()
  })
})
