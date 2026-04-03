jest.mock('../db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
  connect: jest.fn()
}))
jest.mock('../services/ssService')
jest.mock('../db/queries', () => ({
  getUserById: jest.fn().mockResolvedValue({ id: 1, email: 'adam@giltee.com', role: 'admin', status: 'active' })
}))

const request = require('supertest')
const ssService = require('../services/ssService')
const app = require('../index')

beforeEach(() => {
  jest.clearAllMocks()
  ssService.lookupGarment = jest.fn().mockResolvedValue({
    style: 'Bella+Canvas 3001',
    requestedColor: 'Navy',
    available: true,
    standardPrice: 4.50,
    extendedSkus: [],
    skus: [],
  })
})

describe('GET /api/garments/lookup — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app)
      .get('/api/garments/lookup?style=bella+canvas+3001&color=Navy')
    expect(res.status).toBe(401)
  })
})
