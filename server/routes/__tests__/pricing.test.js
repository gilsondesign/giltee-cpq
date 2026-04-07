const request = require('supertest')
const app = require('../../index')

jest.mock('../../db/pricingQueries', () => ({
  getPricingConfig: jest.fn(),
  upsertPricingConfig: jest.fn(),
}))

jest.mock('../../services/pricingService', () => ({
  getDefaultConfig: jest.fn().mockReturnValue({
    tiers: [{ min: 12, max: 23, costs: [6.00, 9.20, null, null, null, null, null, null, null, null, null, null] }],
    fees: { screenFeePerColor: 20, repeatScreenPerColor: 10, inkSwitch: 20, customPmsInk: 20, screenFeeWaivedAt: 96 },
    printSizes: {
      oversized: { surchargePercent: 15, screenFee: 15 },
      jumbo: { surchargePercent: 50, screenFee: 20 },
    },
  }),
  invalidateCache: jest.fn(),
}))

jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 1, email: 'adam@giltee.com', role: 'admin' }; next() },
  requireAdmin: (req, res, next) => next(),
}))

const { getPricingConfig, upsertPricingConfig } = require('../../db/pricingQueries')

const VALID_CONFIG = {
  tiers: [{ min: 12, max: 23, costs: [6.00, 9.20, null, null, null, null, null, null, null, null, null, null] }],
  fees: { screenFeePerColor: 20, repeatScreenPerColor: 10, inkSwitch: 20, customPmsInk: 20, screenFeeWaivedAt: 96 },
  printSizes: {
    oversized: { surchargePercent: 15, screenFee: 15 },
    jumbo: { surchargePercent: 50, screenFee: 20 },
  },
}

afterEach(() => jest.clearAllMocks())

describe('GET /api/pricing/:manufacturer', () => {
  it('returns db config when row exists', async () => {
    getPricingConfig.mockResolvedValue({ manufacturer: 'OSP', config: VALID_CONFIG, updated_at: new Date(), updated_by: 'adam@giltee.com' })
    const res = await request(app).get('/api/pricing/OSP')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('db')
    expect(res.body.config.fees.screenFeePerColor).toBe(20)
  })

  it('returns default config when no db row', async () => {
    getPricingConfig.mockResolvedValue(null)
    const res = await request(app).get('/api/pricing/OSP')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('default')
    expect(res.body.config.tiers).toBeDefined()
  })

  it('returns 400 for unknown manufacturer', async () => {
    const res = await request(app).get('/api/pricing/BADKEY')
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/pricing/:manufacturer', () => {
  it('saves config and returns row', async () => {
    upsertPricingConfig.mockResolvedValue({ manufacturer: 'OSP', config: VALID_CONFIG, updated_at: new Date(), updated_by: 'adam@giltee.com' })
    const res = await request(app).put('/api/pricing/OSP').send({ config: VALID_CONFIG })
    expect(res.status).toBe(200)
    expect(res.body.manufacturer).toBe('OSP')
  })

  it('returns 400 for missing config.tiers', async () => {
    const res = await request(app).put('/api/pricing/OSP').send({ config: { fees: {}, printSizes: {} } })
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown manufacturer', async () => {
    const res = await request(app).put('/api/pricing/BADKEY').send({ config: VALID_CONFIG })
    expect(res.status).toBe(400)
  })
})
