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
  it('calls next() when user is authenticated via passport', () => {
    const req = { isAuthenticated: jest.fn().mockReturnValue(true) }
    const res = mockRes()
    const next = jest.fn()

    requireAuth(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('returns 401 when not authenticated', () => {
    const req = { isAuthenticated: jest.fn().mockReturnValue(false) }
    const res = mockRes()
    const next = jest.fn()

    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when isAuthenticated is not present (no passport middleware)', () => {
    const req = {}
    const res = mockRes()
    const next = jest.fn()

    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})

describe('requireAdmin', () => {
  it('calls next() when user is admin', () => {
    const req = { user: { role: 'admin' } }
    const res = mockRes()
    const next = jest.fn()

    requireAdmin(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('returns 403 when user is not admin', () => {
    const req = { user: { role: 'member' } }
    const res = mockRes()
    const next = jest.fn()

    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when req.user is not set', () => {
    const req = {}
    const res = mockRes()
    const next = jest.fn()

    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
