/**
 * Transactions Export API Tests
 * Regression tests for wallet information in the CSV and JSON exports.
 */

import { testDb, setupTestDatabase, cleanTestDatabase, seedTestDatabase } from '../test-db'
import { createTestUserWithToken, createTestTransaction } from '../test-helpers'
import { NextRequest } from 'next/server'
import { GET as exportGET } from '../../app/api/transactions/export/route'

const createMockRequest = (method: string, url: string, headers?: any) => {
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`
  const urlObj = new URL(fullUrl)
  return {
    method,
    url: fullUrl,
    headers: new Headers(headers || {}),
    json: async () => ({}),
    text: async () => '',
    nextUrl: { pathname: urlObj.pathname, searchParams: urlObj.searchParams },
  } as unknown as NextRequest
}

/** Minimal CSV line parser — handles the quoting escapeCsvValue produces. */
const parseCsvLine = (line: string): string[] => {
  const cells: string[] = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        value += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        value += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(value)
      value = ''
    } else {
      value += char
    }
  }
  cells.push(value)
  return cells
}

// Column offsets of the four wallet columns appended by the export
const FROM_WALLET = 14
const FROM_WALLET_TYPE = 15
const TO_WALLET = 16
const TO_WALLET_TYPE = 17
const TAGS = 18

describe('Transactions Export API', () => {
  let testUser: any
  let authHeaders: { Authorization: string }
  let coldWallet: any
  let hotWallet: any

  beforeAll(async () => {
    await setupTestDatabase()
  }, 30000)

  beforeEach(async () => {
    await cleanTestDatabase()
    await seedTestDatabase()

    const userWithToken = await createTestUserWithToken({
      email: `exporttest-${Date.now()}@example.com`,
      name: 'Export Test User',
    })
    testUser = userWithToken.user
    authHeaders = userWithToken.authHeaders

    coldWallet = await testDb.wallet.create({
      data: { userId: testUser.id, name: 'Ledger Nano', type: 'cold', emoji: '*' },
    })
    // Name contains a comma on purpose: it must come back correctly quoted
    hotWallet = await testDb.wallet.create({
      data: { userId: testUser.id, name: 'Kraken, EU', type: 'hot', emoji: '*' },
    })
  }, 30000)

  afterAll(async () => {
    await testDb.$disconnect()
  })

  const runExport = (format: string) =>
    exportGET(createMockRequest('GET', `/api/transactions/export?format=${format}`, authHeaders))

  /** Export as CSV and index the data rows by their ID column. */
  const csvRowsById = async (): Promise<Map<string, string[]>> => {
    const response = await runExport('csv')
    expect(response.status).toBe(200)

    const rows = new Map<string, string[]>()
    for (const line of (await response.text()).split('\n').slice(1)) {
      if (!line.trim()) continue
      const cells = parseCsvLine(line)
      rows.set(cells[0], cells)
    }
    return rows
  }

  const createInternalTransfer = () =>
    createTestTransaction({
      userId: testUser.id,
      type: 'TRANSFER',
      transferType: 'BETWEEN_WALLETS',
      fromWalletId: hotWallet.id,
      toWalletId: coldWallet.id,
      feesCurrency: 'BTC',
    })

  describe('CSV export', () => {
    it('appends the wallet columns without moving the existing ones', async () => {
      const response = await runExport('csv')
      expect(response.status).toBe(200)

      const header = parseCsvLine((await response.text()).split('\n')[0])

      expect(header.slice(0, FROM_WALLET)).toEqual([
        'ID',
        'Type',
        'BTC Amount',
        'Price per BTC',
        'Currency',
        'Total Amount',
        'Fees',
        'Fees Currency',
        'Transaction Date',
        'Notes',
        'Transfer Type',
        'Destination Address',
        'Created At',
        'Updated At',
      ])
      expect(header.slice(FROM_WALLET)).toEqual([
        'From Wallet',
        'From Wallet Type',
        'To Wallet',
        'To Wallet Type',
        'Tags',
      ])
    })

    it('carries the destination wallet of a BUY, quoting a name with a comma', async () => {
      const buy = await createTestTransaction({
        userId: testUser.id,
        type: 'BUY',
        toWalletId: hotWallet.id,
      })

      const row = (await csvRowsById()).get(String(buy.id))
      expect(row).toBeDefined()
      expect(row![FROM_WALLET]).toBe('')
      expect(row![FROM_WALLET_TYPE]).toBe('')
      expect(row![TO_WALLET]).toBe('Kraken, EU')
      expect(row![TO_WALLET_TYPE]).toBe('hot')
    })

    it('carries the source wallet of a SELL', async () => {
      const sell = await createTestTransaction({
        userId: testUser.id,
        type: 'SELL',
        fromWalletId: coldWallet.id,
      })

      const row = (await csvRowsById()).get(String(sell.id))
      expect(row).toBeDefined()
      expect(row![FROM_WALLET]).toBe('Ledger Nano')
      expect(row![FROM_WALLET_TYPE]).toBe('cold')
      expect(row![TO_WALLET]).toBe('')
      expect(row![TO_WALLET_TYPE]).toBe('')
    })

    it('carries both wallets of an internal transfer', async () => {
      const transfer = await createInternalTransfer()

      const row = (await csvRowsById()).get(String(transfer.id))
      expect(row).toBeDefined()
      expect(row![FROM_WALLET]).toBe('Kraken, EU')
      expect(row![FROM_WALLET_TYPE]).toBe('hot')
      expect(row![TO_WALLET]).toBe('Ledger Nano')
      expect(row![TO_WALLET_TYPE]).toBe('cold')
    })

    it('carries the comma-separated tag list, correctly quoted', async () => {
      const tagged = await createTestTransaction({
        userId: testUser.id,
        type: 'BUY',
        tags: 'DCA,Long-term',
      })

      const row = (await csvRowsById()).get(String(tagged.id))
      expect(row).toBeDefined()
      expect(row![TAGS]).toBe('DCA,Long-term')
    })

    it('leaves the wallet columns empty when no wallet is assigned', async () => {
      const orphan = await createTestTransaction({ userId: testUser.id, type: 'BUY' })

      const row = (await csvRowsById()).get(String(orphan.id))
      expect(row).toBeDefined()
      expect(row!.slice(FROM_WALLET)).toEqual(['', '', '', '', ''])
    })
  })

  describe('JSON export', () => {
    const jsonTransactions = async (): Promise<any[]> => {
      const response = await runExport('json')
      expect(response.status).toBe(200)
      return JSON.parse(await response.text()).transactions
    }

    it('nests from_wallet and to_wallet for an internal transfer', async () => {
      const transfer = await createInternalTransfer()

      const tx = (await jsonTransactions()).find((t: any) => t.id === transfer.id)
      expect(tx).toBeDefined()
      expect(tx.from_wallet).toMatchObject({
        id: hotWallet.id,
        name: 'Kraken, EU',
        type: 'hot',
      })
      expect(tx.to_wallet).toMatchObject({
        id: coldWallet.id,
        name: 'Ledger Nano',
        type: 'cold',
      })
    })

    it('carries tags as a string', async () => {
      const tagged = await createTestTransaction({
        userId: testUser.id,
        type: 'BUY',
        tags: 'DCA,Long-term',
      })

      const tx = (await jsonTransactions()).find((t: any) => t.id === tagged.id)
      expect(tx).toBeDefined()
      expect(tx.tags).toBe('DCA,Long-term')
    })

    it('returns null wallets when none are assigned', async () => {
      const orphan = await createTestTransaction({ userId: testUser.id, type: 'BUY' })

      const tx = (await jsonTransactions()).find((t: any) => t.id === orphan.id)
      expect(tx).toBeDefined()
      expect(tx.from_wallet).toBeNull()
      expect(tx.to_wallet).toBeNull()
    })
  })
})
