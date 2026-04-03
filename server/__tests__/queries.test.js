const mockPool = {
  query: jest.fn()
}
jest.mock('../db/pool', () => mockPool)

const queries = require('../db/queries')

beforeEach(() => {
  mockPool.query.mockReset()
})

describe('createUser', () => {
  it('inserts user and returns row', async () => {
    const fakeUser = { id: 1, email: 'test@example.com', name: 'Test User', avatar_url: null, role: 'member', status: 'active' }
    mockPool.query.mockResolvedValueOnce({ rows: [fakeUser] })

    const result = await queries.createUser({ email: 'test@example.com', name: 'Test User', avatarUrl: null })

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['test@example.com', 'Test User'])
    )
    expect(result).toEqual(fakeUser)
  })
})

describe('getUserByEmail', () => {
  it('returns user when found', async () => {
    const fakeUser = { id: 1, email: 'test@example.com', role: 'admin', status: 'active' }
    mockPool.query.mockResolvedValueOnce({ rows: [fakeUser] })

    const result = await queries.getUserByEmail('test@example.com')
    expect(result).toEqual(fakeUser)
  })

  it('returns null when not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    const result = await queries.getUserByEmail('nobody@example.com')
    expect(result).toBeNull()
  })
})

describe('createInvitation', () => {
  it('inserts invitation with 7-day expiry and returns row', async () => {
    const fakeInvite = { id: 1, email: 'new@example.com', token: 'abc-123', status: 'pending' }
    mockPool.query.mockResolvedValueOnce({ rows: [fakeInvite] })

    const result = await queries.createInvitation({ email: 'new@example.com', token: 'abc-123', invitedBy: 1 })

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO invitations'),
      expect.arrayContaining(['new@example.com', 'abc-123', 1])
    )
    // Verify the 4th parameter (expires_at) is approximately 7 days from now
    const callArgs = mockPool.query.mock.calls[0][1]
    const expiresAt = callArgs[3]
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + sevenDaysMs - 5000)
    expect(expiresAt.getTime()).toBeLessThan(Date.now() + sevenDaysMs + 5000)
    expect(result).toEqual(fakeInvite)
  })
})

describe('getInvitationByToken', () => {
  it('returns invitation when token is valid and pending', async () => {
    const fakeInvite = { id: 1, email: 'new@example.com', token: 'abc-123', status: 'pending' }
    mockPool.query.mockResolvedValueOnce({ rows: [fakeInvite] })

    const result = await queries.getInvitationByToken('abc-123')
    expect(result).toEqual(fakeInvite)
  })

  it('returns null when token not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    const result = await queries.getInvitationByToken('bad-token')
    expect(result).toBeNull()
  })
})

describe('listUsers', () => {
  it('returns all users and invitations', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@b.com', role: 'admin', status: 'active' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, email: 'c@d.com', status: 'pending' }] })

    const result = await queries.listUsers()
    expect(result.users).toHaveLength(1)
    expect(result.invitations).toHaveLength(1)
    expect(result.users[0].role).toBe('admin')
    expect(result.invitations[0].status).toBe('pending')
  })
})
