import { ExchangeRateService } from '../../lib/exchange-rate-service'

const okResponse = (rates: Record<string, number>) =>
  ({ ok: true, status: 200, json: async () => ({ rates }) }) as Response

describe('ExchangeRateService.fetchExchangeRatesFromAPI', () => {
  const originalFetch = global.fetch
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('uses the primary API when it responds', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ USD: 1, EUR: 0.9 }))

    const result = await ExchangeRateService.fetchExchangeRatesFromAPI('USD')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.exchangerate-api.com/v4/latest/USD')
    expect(result.conversion_rates).toEqual({ USD: 1, EUR: 0.9 })
  })

  it('falls back to the keyless API when the primary API fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response)
      .mockResolvedValueOnce(okResponse({ EUR: 1, USD: 1.12 }))

    const result = await ExchangeRateService.fetchExchangeRatesFromAPI('EUR')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('https://allratestoday.com/api/open/latest/EUR')
    expect(result.base_code).toBe('EUR')
    expect(result.conversion_rates).toEqual({ EUR: 1, USD: 1.12 })
  })

  it('throws the primary error when both APIs fail', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('primary down'))
      .mockRejectedValueOnce(new Error('fallback down'))

    await expect(ExchangeRateService.fetchExchangeRatesFromAPI('USD')).rejects.toThrow('primary down')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
