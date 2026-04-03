jest.mock('../db/pool', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), on: jest.fn() }))

const { requireAuth, requireAdmin } = require('../middleware/auth')

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis()
  }
}

describe('requireAuth', () => {
  it('calls next() when session has userId', () => {
    const req = { session: { userId: 1 } }
    const res = mockRes()
    const next = jest.fn()

    requireAuth(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('returns 401 for API routes when no session', () => {
    const req = { session: {}, path: '/api/quotes' }
    const res = mockRes()
    const next = jest.fn()

    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('requireAdmin', () => {
  it('calls next() when user is admin', () => {
    const req = { session: { userId: 1 }, user: { role: 'admin' } }
    const res = mockRes()
    const next = jest.fn()

    requireAdmin(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('returns 403 when user is not admin', () => {
    const req = { session: { userId: 1 }, user: { role: 'member' } }
    const res = mockRes()
    const next = jest.fn()

    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
