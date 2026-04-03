const request = require('supertest')

// Isolate from real DB — query must return a Promise so connect-pg-simple doesn't throw
jest.mock('../db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
  connect: jest.fn()
}))

const app = require('../index')

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
