/**
 * Strike monthly account statements (older "Transaction ID, Time (UTC), Status" format):
 * Receive rows and months without any activity.
 */

import { parseCsvFile } from '../../app/api/transactions/import/parsers'

const HEADER =
  'Transaction ID,Time (UTC),Status,Transaction Type,Amount EUR,Fee EUR,Amount BTC,Fee BTC,Description,Exchange Rate,Transaction Hash'

const statement = (rows: string[]) => [HEADER, ...rows].join('\n')

describe('Strike statement parser', () => {
  it('imports a Lightning receive (no hash) as incoming bitcoin', () => {
    const result = parseCsvFile(statement([
      'r-001,Sep 04 2026 12:27:46,Completed,Receive,,,0.00050000,,,,',
    ]))

    expect(result.detectedFormat).toBe('strike')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]).toMatchObject({
      type: 'TRANSFER',
      transfer_type: 'TRANSFER_IN',
      btc_amount: 0.0005,
      transaction_date: '2026-09-04',
    })
  })

  it('imports an on-chain receive as coming back from cold storage', () => {
    const result = parseCsvFile(statement([
      'r-002,Sep 06 2026 08:00:00,Completed,Receive,,,0.01000000,,,,abc123hash',
    ]))

    expect(result.transactions[0]).toMatchObject({
      type: 'TRANSFER',
      transfer_type: 'FROM_COLD_WALLET',
      btc_amount: 0.01,
    })
  })

  it('keeps purchases and skips fiat deposits alongside receives', () => {
    const result = parseCsvFile(statement([
      'd-001,Sep 01 2026 09:00:00,Completed,Deposit,100.00,,,,,,',
      'p-001,Sep 02 2026 09:00:00,Completed,Purchase,-50.00,0.00,0.00070000,,,71428.57,',
      'r-003,Sep 03 2026 09:00:00,Completed,Receive,,,0.00010000,,,,',
    ]))

    expect(result.transactions.map(t => t.type)).toEqual(['BUY', 'TRANSFER'])
  })

  it('explains a month without transactions instead of failing to parse', () => {
    expect(() => parseCsvFile(HEADER)).toThrow('no transactions in it, only the header row')
    expect(() => parseCsvFile('')).toThrow('The file is empty.')
  })
})
