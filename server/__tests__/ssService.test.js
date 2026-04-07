jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

// Mock global fetch
global.fetch = jest.fn()

const ssService = require('../services/ssService')

beforeEach(() => fetch.mockReset())

const MOCK_SKUS = [
  { sku: 'B3001NVY-S',  colorName: 'Navy',  sizeName: 'S',  sizePriceCodeName: 'S',   customerPrice: 4.50, qty: 500, colorFrontImage: '/images/navy.jpg' },
  { sku: 'B3001NVY-M',  colorName: 'Navy',  sizeName: 'M',  sizePriceCodeName: 'M',   customerPrice: 4.50, qty: 800, colorFrontImage: '/images/navy.jpg' },
  { sku: 'B3001NVY-2X', colorName: 'Navy',  sizeName: '2XL',sizePriceCodeName: '2XL', customerPrice: 6.25, qty: 200, colorFrontImage: '/images/navy.jpg' },
  { sku: 'B3001RED-S',  colorName: 'Red',   sizeName: 'S',  sizePriceCodeName: 'S',   customerPrice: 4.50, qty: 300, colorFrontImage: '/images/red.jpg'  },
]

const MOCK_STYLES = [
  { styleID: 12345, styleName: '3001CVC', brandName: 'Bella+Canvas' },
]

function mockFetchSuccess(data) {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data
  })
}

describe('ssService.lookupGarment', () => {
  it('returns available garment data when color is found', async () => {
    mockFetchSuccess(MOCK_STYLES)  // first fetch: styles lookup
    mockFetchSuccess(MOCK_SKUS)    // second fetch: products lookup
    const result = await ssService.lookupGarment({ style: 'bella+canvas+3001', color: 'Navy' })

    expect(result.available).toBe(true)
    expect(result.requestedColor).toBe('Navy')
    expect(result.standardPrice).toBe(4.50)
    expect(result.imageUrl).toContain('ssactivewear.com')
  })

  it('returns extended size SKUs separately', async () => {
    mockFetchSuccess(MOCK_STYLES)  // first fetch: styles lookup
    mockFetchSuccess(MOCK_SKUS)    // second fetch: products lookup
    const result = await ssService.lookupGarment({ style: 'bella+canvas+3001', color: 'Navy' })

    expect(result.extendedSkus).toHaveLength(1)
    expect(result.extendedSkus[0].size).toBe('2XL')
    expect(result.extendedSkus[0].price).toBe(6.25)
  })

  it('returns available: false with alternatives when color not found', async () => {
    mockFetchSuccess(MOCK_STYLES)  // first fetch: styles lookup
    mockFetchSuccess(MOCK_SKUS)    // second fetch: products lookup
    const result = await ssService.lookupGarment({ style: 'bella+canvas+3001', color: 'Purple' })

    expect(result.available).toBe(false)
    expect(Array.isArray(result.alternatives)).toBe(true)
    expect(result.alternatives.length).toBeGreaterThan(0)
  })

  it('throws when S&S API returns non-200', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(ssService.lookupGarment({ style: 'x', color: 'y' })).rejects.toThrow('S&S API error')
  })
})

describe('ssService.buildAuthHeader', () => {
  it('returns a Basic auth header', () => {
    process.env.SS_ACCOUNT_NUMBER = 'testacct'
    process.env.SS_API_KEY = 'testkey'
    const header = ssService.buildAuthHeader()
    expect(header).toMatch(/^Basic /)
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString()
    expect(decoded).toBe('testacct:testkey')
  })
})
