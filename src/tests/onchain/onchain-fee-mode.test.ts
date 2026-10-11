/**
 * On-chain rows under the v0.8.0 transfer fee modes (#168).
 *
 * Upstream added `transferFeeMode` (ON_TOP / DEDUCTED) to transfers. This fork
 * already counted TRANSFER_IN / TRANSFER_OUT in holdings, so the merge has to
 * keep three things true:
 *  - the portfolio summary and /api/portfolio-metrics land on the same total
 *    for every mix of fee modes (they share transferHoldingsDelta);
 *  - an on-chain send is written as ON_TOP, so its network fee still counts;
 *  - the monthly breakdown counts an on-chain receive once, as a buy.
 * The scheduler part covers settings changes applying without a restart.
 */

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUserWithToken, createTestTransaction } from '../test-helpers'
import { NextRequest } from 'next/server'
import { BitcoinPriceService } from '@/lib/bitcoin-price-service'
import { OnchainSyncService } from '@/lib/onchain/onchain-sync-service'
import { OnchainScheduler } from '@/lib/onchain/onchain-scheduler'
import { SettingsService } from '@/lib/settings-service'
import { transferHoldingsDelta } from '@/lib/transfer-fees'
import { GET as portfolioMetricsGET } from '@/app/api/portfolio-metrics/route'

const metricsRequest = (headers: Record<string, string>, detailed = false) => ({
  method: 'GET',
  url: 'http://localhost/api/portfolio-metrics',
  headers: new Headers(headers),
  json: async () => ({}),
  nextUrl: {
    pathname: '/api/portfolio-metrics',
    searchParams: new URLSearchParams(detailed ? 'detailed=true' : ''),
  },
} as unknown as NextRequest)

describe('transferHoldingsDelta', () => {
  const tx = (transferType: string, transferFeeMode: string | null) => ({
    btcAmount: 0.5,
    fees: 0.01,
    feesCurrency: 'BTC',
    transferType,
    transferFeeMode,
  })

  it('removes amount + fee for an ON_TOP send, the amount alone for a DEDUCTED one', () => {
    expect(transferHoldingsDelta(tx('TRANSFER_OUT', 'ON_TOP'))).toBeCloseTo(-0.51)
    expect(transferHoldingsDelta(tx('TRANSFER_OUT', 'DEDUCTED'))).toBeCloseTo(-0.5)
    expect(transferHoldingsDelta(tx('TRANSFER_OUT', null))).toBeCloseTo(-0.5)
  })

  it('adds what arrives for a receive', () => {
    expect(transferHoldingsDelta(tx('TRANSFER_IN', null))).toBeCloseTo(0.49)
    expect(transferHoldingsDelta({ ...tx('TRANSFER_IN', null), fees: 0 })).toBeCloseTo(0.5)
  })

  it('only burns the fee for a move between own wallets, whatever the mode', () => {
    for (const type of ['TO_COLD_WALLET', 'FROM_COLD_WALLET', 'BETWEEN_WALLETS']) {
      expect(transferHoldingsDelta(tx(type, 'ON_TOP'))).toBeCloseTo(-0.01)
      expect(transferHoldingsDelta(tx(type, 'DEDUCTED'))).toBeCloseTo(-0.01)
    }
  })

  it('ignores a fee paid in fiat', () => {
    expect(transferHoldingsDelta({ ...tx('TRANSFER_OUT', 'ON_TOP'), feesCurrency: 'USD' })).toBeCloseTo(-0.5)
  })
})

describe('OnchainSyncService.classify', () => {
  const agg = (receivedSats: number, spentSats: number, feeSats: number) =>
    ({ receivedSats, spentSats, feeSats } as unknown as Parameters<typeof OnchainSyncService.classify>[0])

  it('writes a send as ON_TOP: recipients got btcAmount, btcAmount + fee left', () => {
    const out = OnchainSyncService.classify(agg(20_000, 100_000, 1_000))
    expect(out.transferType).toBe('TRANSFER_OUT')
    expect(out.transferFeeMode).toBe('ON_TOP')
    expect(out.btcAmount).toBeCloseTo(0.00079)
    expect(out.fees).toBeCloseTo(0.00001)
    // Total leaving the wallet = spent - change back
    expect(transferHoldingsDelta({ ...out, feesCurrency: 'BTC' })).toBeCloseTo(-0.0008)
  })

  it('writes a receive with no fee and no mode', () => {
    const received = OnchainSyncService.classify(agg(50_000, 0, 0))
    expect(received.transferType).toBe('TRANSFER_IN')
    expect(received.transferFeeMode).toBeNull()
    expect(received.fees).toBe(0)
  })
})

describe('Holdings with mixed fee modes', () => {
  let userId: number
  let authHeaders: Record<string, string>

  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()
    const created = await createTestUserWithToken({ email: 'fee-modes@example.com' })
    userId = created.user.id
    authHeaders = created.authHeaders
    await testDb.bitcoinCurrentPrice.create({
      data: { priceUsd: 100000, timestamp: new Date().toISOString(), source: 'test' },
    })
  })

  afterAll(async () => {
    await testDb.$disconnect()
  })

  async function seedMixedHistory() {
    const base = { userId, type: 'TRANSFER', feesCurrency: 'BTC', originalPricePerBtc: 40000 }
    await createTestTransaction({ userId, type: 'BUY', btcAmount: 1, originalPricePerBtc: 40000, originalTotalAmount: 40000, transactionDate: new Date('2024-05-02') })
    // On-chain send: 0.3 to the recipient, 0.001 fee on top
    await createTestTransaction({ ...base, transferType: 'TRANSFER_OUT', source: 'onchain', transferFeeMode: 'ON_TOP', btcAmount: 0.3, fees: 0.001, originalTotalAmount: 12000, transactionDate: new Date('2024-06-10') })
    // Manual send entered as "fee taken from the amount"
    await createTestTransaction({ ...base, transferType: 'TRANSFER_OUT', source: 'manual', transferFeeMode: 'DEDUCTED', btcAmount: 0.2, fees: 0.001, originalTotalAmount: 8000, transactionDate: new Date('2024-06-11') })
    // Move to cold storage: only the fee leaves the portfolio
    await createTestTransaction({ ...base, transferType: 'TO_COLD_WALLET', transferFeeMode: 'ON_TOP', btcAmount: 0.1, fees: 0.0005, originalTotalAmount: 0, transactionDate: new Date('2024-06-12') })
    // On-chain receive valued at block-day close
    await createTestTransaction({ ...base, transferType: 'TRANSFER_IN', source: 'onchain', btcAmount: 0.05, fees: 0, originalTotalAmount: 2000, transactionDate: new Date('2024-06-15') })
  }

  // 1 - (0.3 + 0.001) - 0.2 - 0.0005 + 0.05
  const EXPECTED_TOTAL = 0.5485

  it('gives the same total in the portfolio summary and the metrics route', async () => {
    await seedMixedHistory()

    await BitcoinPriceService.calculateAndStorePortfolioSummary(userId, 100000)
    const summary = await testDb.portfolioSummary.findUnique({ where: { userId } })
    expect(summary!.totalBtc).toBeCloseTo(EXPECTED_TOTAL, 8)
    expect(summary!.totalFeesBtc).toBeCloseTo(0.0025, 8)
    expect(summary!.coldWalletBtc).toBeCloseTo(0.1, 8)

    const response = await portfolioMetricsGET(metricsRequest(authHeaders))
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.totalBtc).toBeCloseTo(EXPECTED_TOTAL, 8)
    expect(body.data.totalFeesBTC).toBeCloseTo(0.0025, 8)
  })

  it('counts an on-chain receive once (as a buy) and a send as a transfer, never a sale', async () => {
    await seedMixedHistory()

    const response = await portfolioMetricsGET(metricsRequest(authHeaders, true))
    const june = (await response.json()).data.monthlyBreakdown.find((m: any) => m.month === '2024-06')

    expect(june.buys).toBe(1)
    expect(june.totalBought).toBeCloseTo(0.05)
    expect(june.transferredIn).toBe(0)
    expect(june.sells).toBe(0)
    expect(june.transferredOut).toBeCloseTo(0.301 + 0.2)
    expect(june.netBtc).toBeCloseTo(0.05 - 0.501)
  })
})

describe('OnchainScheduler.applySettings', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()
    // The scheduling is under test, not the sync itself
    jest.spyOn(OnchainScheduler, 'runOnce').mockResolvedValue(null)
  })

  afterEach(() => {
    OnchainScheduler.stop()
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await testDb.$disconnect()
  })

  async function setOnchain(patch: Record<string, unknown>) {
    const current = await SettingsService.getSettings()
    await SettingsService.updateSettings(current.id, { onchain: { ...current.onchain, ...patch } } as any)
  }

  it('starts, reschedules and stops with the settings, without a restart', async () => {
    await setOnchain({ enabled: true, syncIntervalMinutes: 10 })
    await OnchainScheduler.applySettings()
    expect(OnchainScheduler.getStatus()).toMatchObject({ isRunning: true, intervalMinutes: 10 })
    // A fresh start syncs once right away
    expect(OnchainScheduler.runOnce).toHaveBeenCalledTimes(1)

    await setOnchain({ syncIntervalMinutes: 5 })
    await OnchainScheduler.applySettings()
    expect(OnchainScheduler.getStatus()).toMatchObject({ isRunning: true, intervalMinutes: 5 })
    // A reschedule keeps the data it has instead of syncing again
    expect(OnchainScheduler.runOnce).toHaveBeenCalledTimes(1)

    await setOnchain({ enabled: false })
    await OnchainScheduler.applySettings()
    expect(OnchainScheduler.getStatus().isRunning).toBe(false)
  })

  it('arms a single timer when two starts race', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval')
    await setOnchain({ enabled: true, syncIntervalMinutes: 7 })

    await Promise.all([OnchainScheduler.start(), OnchainScheduler.start()])

    const armed = setIntervalSpy.mock.calls.filter(([, ms]) => ms === 7 * 60 * 1000)
    expect(armed).toHaveLength(1)
  })
})
