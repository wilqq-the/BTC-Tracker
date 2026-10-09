/**
 * Cash App (#214) and Revolut X (#215) CSV parsers.
 * Samples are taken from the GitHub issues (IDs/values are fake).
 */

import { parseCsvFile } from '../../app/api/transactions/import/parsers'
import { RevolutXParser } from '../../app/api/transactions/import/parsers/revolutx'

const CASHAPP_CSV = `Transaction ID,Date,Transaction Type,Currency,Amount,Fee,Net Amount,Asset Type,Asset Price,Asset Amount
"vy3oz1","2025-12-30 23:22:22 PST","Bitcoin Buy","USD","-$0.41","$0.00","-$0.41","BTC","$88,341.37","0.00000464 BTC"
"q81kd0","2025-10-06 08:52:24 PDT","Bitcoin Withdrawal","USD","$1,252.41","$0.00","$1,252.41","BTC","$125,241.22","0.01 BTC"
"m3xx9a","2024-12-13 14:40:23 PST","Bitcoin Lightning Withdrawal","USD","$10.13","$0.00","$10.13","BTC","$101,308.58","0.0001 BTC"
"p0aa7z","2025-08-30 09:38:05 PDT","Bitcoin Sale","USD","$50.00","-$1.49","$48.51","BTC","$107,642.54","0.0004645 BTC"
"d9e2f1","2024-05-31 18:41:15 PDT","Bitcoin Deposit","USD","-$67.39","$0.00","-$67.39","BTC","$67,397.09","0.001 BTC"
"l4n6b8","2024-03-30 15:06:06 PDT","Bitcoin Lightning Deposit","USD","-$0.69","$0.00","-$0.69","BTC","$69,776.08","0.00000993 BTC"
"c7t5u3","2025-10-02 14:28:27 PDT","Bitcoin Buy","USD","-$98.15","-$2.00","-$100.15","BTC","$61,071.57","0.00160713 BTC"
"zz0001","2025-10-03 10:00:00 PDT","Bitcoin Boost Reward","USD","$0.00","$0.00","$0.00","BTC","$61,000.00","0.00000100 BTC"`

const REVOLUTX_CSV = `Symbol,Type,Quantity,Price,Value,Fees,Date
USD,Inne,,,"8,50$","0,00 PLN","3 sty 2025, 08:22:11"
BTC,Kupno — Revolut X,"0,00011234","44 500,00$","4,99$","0,00$","3 sty 2025, 08:23:04"
USD,Inne,,,"30,00$","0,27$","27 sty 2025, 08:05:14"
BTC,Kupno — Revolut X,"0,00065000","46 153,85$","30,00$","0,00$","27 sty 2025, 08:06:22"
BTC,Kupno — Revolut X,"0,00107000","46 728,97$","50,00$","0,02$","26 lut 2025, 13:16:10"
BTC,Sprzedaż — Revolut X,"0,00050000","95 000,00$","47,50$","0,05$","14 paź 2025, 09:01:02"`

describe('Cash App parser', () => {
  const result = parseCsvFile(CASHAPP_CSV)
  const byNote = (id: string) => result.transactions.find(t => t.notes.includes(id))!

  it('is auto-detected', () => {
    expect(result.detectedFormat).toBe('cashapp')
  })

  it('imports buys with BTC amount, price, total and fee', () => {
    const buy = byNote('c7t5u3')
    expect(buy).toMatchObject({
      type: 'BUY',
      btc_amount: 0.00160713,
      original_price_per_btc: 61071.57,
      original_currency: 'USD',
      original_total_amount: 98.15,
      fees: 2,
      fees_currency: 'USD',
      transaction_date: '2025-10-02',
    })
  })

  it('imports sales', () => {
    expect(byNote('p0aa7z')).toMatchObject({
      type: 'SELL',
      btc_amount: 0.0004645,
      original_price_per_btc: 107642.54,
      original_total_amount: 50,
      fees: 1.49,
      transaction_date: '2025-08-30',
    })
  })

  it('maps on-chain and Lightning withdrawals/deposits to transfers', () => {
    expect(byNote('q81kd0')).toMatchObject({ type: 'TRANSFER', btc_amount: 0.01, transfer_type: 'TO_COLD_WALLET' })
    expect(byNote('m3xx9a')).toMatchObject({ type: 'TRANSFER', btc_amount: 0.0001, transfer_type: 'TRANSFER_OUT' })
    expect(byNote('d9e2f1')).toMatchObject({ type: 'TRANSFER', btc_amount: 0.001, transfer_type: 'FROM_COLD_WALLET' })
    expect(byNote('l4n6b8')).toMatchObject({ type: 'TRANSFER', btc_amount: 0.00000993, transfer_type: 'TRANSFER_IN' })
  })

  it('skips types it does not understand', () => {
    expect(result.transactions).toHaveLength(7)
    expect(result.transactions.find(t => t.notes.includes('zz0001'))).toBeUndefined()
  })
})

describe('Revolut X parser', () => {
  const result = parseCsvFile(REVOLUTX_CSV)

  it('is auto-detected', () => {
    expect(result.detectedFormat).toBe('revolutx')
  })

  it('skips fiat top-ups and imports BTC buys and sales', () => {
    expect(result.transactions.map(t => t.type)).toEqual(['BUY', 'BUY', 'BUY', 'SELL'])
  })

  it('reads Polish numbers, currency and dates', () => {
    expect(result.transactions[0]).toMatchObject({
      type: 'BUY',
      btc_amount: 0.00011234,
      original_price_per_btc: 44500,
      original_currency: 'USD',
      original_total_amount: 4.99,
      fees: 0,
      fees_currency: 'USD',
      transaction_date: '2025-01-03',
    })
    expect(result.transactions[2]).toMatchObject({ fees: 0.02, transaction_date: '2025-02-26' })
    expect(result.transactions[3]).toMatchObject({
      type: 'SELL',
      btc_amount: 0.0005,
      original_price_per_btc: 95000,
      transaction_date: '2025-10-14',
    })
  })

  describe('localised values', () => {
    const parser = new RevolutXParser()

    it.each([
      ['44 500,00$', 44500],
      ['44 500,00 $', 44500],     // non-breaking space
      ['44 500,00 $', 44500],     // narrow non-breaking space
      ['$44,500.00', 44500],
      ['1.234,56 €', 1234.56],
      ['0,00011234', 0.00011234],
      ['0.00011234', 0.00011234],
      ['0,001', 0.001],
      ['12,345', 12345],
      ['0,00 PLN', 0],
      ['', 0],
    ])('parses %j as %d', (raw, expected) => {
      expect(parser.parseAmount(raw)).toBeCloseTo(expected, 10)
    })

    it.each([
      ['3 sty 2025, 08:23:04', '2025-01-03'],
      ['14 paź 2025, 09:01:02', '2025-10-14'],
      ['1 grudnia 2024, 10:00:00', '2024-12-01'],
      ['3 Jan 2025, 08:23', '2025-01-03'],
      ['Jan 3, 2025, 8:23 AM', '2025-01-03'],
      ['2025-01-03T08:23:04Z', '2025-01-03'],
      ['03.01.2025 08:23', '2025-01-03'],
    ])('parses date %j', (raw, expected) => {
      expect(parser.parseLocalisedDate(raw)).toBe(expected)
    })

    it('detects the currency from the amount', () => {
      expect(parser.detectCurrency('44 500,00$')).toBe('USD')
      expect(parser.detectCurrency('0,00 PLN')).toBe('PLN')
      expect(parser.detectCurrency('100,00 zł')).toBe('PLN')
      expect(parser.detectCurrency('41 000,00 €')).toBe('EUR')
    })
  })
})
