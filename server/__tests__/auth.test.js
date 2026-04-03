jest.mock('../db/pool', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), on: jest.fn(), connect: jest.fn() }))
jest.mock('../db/queries')

const request = require('supertest')
const queries = require('../db/queries')
const app = require('../index')

describe('GET /api/auth/me — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/invite — unauthenticated', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app)
      .post('/api/auth/invite')
      .send({ email: 'new@example.com' })
    expect(res.status).toBe(401)
  })
})

describe('POST /auth/logout', () => {
  it('returns 200 and clears session', async () => {
    const res = await request(app).post('/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: 'Logged out' })
  })
})

describe('GET /api/auth/users — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).get('/api/auth/users')
    expect(res.status).toBe(401)
  })
})
