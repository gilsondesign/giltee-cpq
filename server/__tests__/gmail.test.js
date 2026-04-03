jest.mock('../db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
  connect: jest.fn()
}))
jest.mock('../services/gmailService')
jest.mock('../db/queries', () => ({
  getUserById: jest.fn().mockResolvedValue({ id: 1, email: 'adam@giltee.com', role: 'admin', status: 'active' })
}))

const request = require('supertest')
const app = require('../index')

describe('GET /api/gmail/draft/:id — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).get('/api/gmail/draft/draft-123')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/gmail/draft/:id — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).delete('/api/gmail/draft/draft-123')
    expect(res.status).toBe(401)
  })
})
