import { formatBtc, otherUnit, unitLabel } from '../../lib/btc-unit'

describe('formatBtc', () => {
  it('formats BTC with 8 decimals by default', () => {
    expect(formatBtc(0.44558838, 'btc')).toBe('0.44558838 BTC')
    expect(formatBtc(1, 'btc')).toBe('1.00000000 BTC')
  })

  it('trims trailing zeros when asked', () => {
    expect(formatBtc(0.05, 'btc', { trim: true })).toBe('0.05 BTC')
    expect(formatBtc(100, 'btc', { trim: true })).toBe('100 BTC')
    expect(formatBtc(0, 'btc', { trim: true })).toBe('0 BTC')
  })

  it('formats sats as whole numbers with separators', () => {
    expect(formatBtc(0.44558838, 'sats')).toBe('44,558,838 sats')
    expect(formatBtc(0.00000001, 'sats')).toBe('1 sat')
    expect(formatBtc(1, 'sats')).toBe('100,000,000 sats')
  })

  it('rounds float noise instead of showing fractional sats', () => {
    expect(formatBtc(0.1 + 0.2, 'sats')).toBe('30,000,000 sats')
  })

  it('handles signs and the unit suffix', () => {
    expect(formatBtc(-0.03, 'btc', { trim: true })).toBe('-0.03 BTC')
    expect(formatBtc(0.03, 'sats', { signed: true })).toBe('+3,000,000 sats')
    expect(formatBtc(0.03, 'sats', { withUnit: false })).toBe('3,000,000')
  })

  it('treats non-finite input as zero', () => {
    expect(formatBtc(NaN, 'btc', { trim: true })).toBe('0 BTC')
  })

  it('exposes unit helpers', () => {
    expect(otherUnit('btc')).toBe('sats')
    expect(otherUnit('sats')).toBe('btc')
    expect(unitLabel('sats')).toBe('sats')
  })
})
