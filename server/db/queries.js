const pool = require('./pool')

// ─── Users ───────────────────────────────────────────────────────────────────

async function createUser({ email, name, avatarUrl, role = 'member' }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, avatar_url, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = $2, avatar_url = $3, last_login = NOW()
     RETURNING *`,
    [email, name, avatarUrl, role]
  )
  return rows[0]
}

async function getUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id])
  return rows[0] || null
}

async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email])
  return rows[0] || null
}

async function updateUserStatus(id, status) {
  const { rows } = await pool.query(
    'UPDATE users SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  )
  return rows[0] || null
}

async function updateUserLastLogin(id) {
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [id])
}

async function listUsers() {
  const [usersResult, invitesResult] = await Promise.all([
    pool.query('SELECT id, email, name, avatar_url, role, status, created_at, last_login FROM users ORDER BY created_at DESC'),
    pool.query('SELECT id, email, token, status, expires_at, created_at FROM invitations ORDER BY created_at DESC')
  ])
  return { users: usersResult.rows, invitations: invitesResult.rows }
}

// ─── Invitations ─────────────────────────────────────────────────────────────

async function createInvitation({ email, token, invitedBy }) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  const { rows } = await pool.query(
    `INSERT INTO invitations (email, token, invited_by, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [email, token, invitedBy, expiresAt]
  )
  return rows[0]
}

async function getInvitationByToken(token) {
  const { rows } = await pool.query(
    `SELECT * FROM invitations
     WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
    [token]
  )
  return rows[0] || null
}

async function acceptInvitation(token) {
  const { rows } = await pool.query(
    `UPDATE invitations SET status = 'accepted' WHERE token = $1 RETURNING *`,
    [token]
  )
  return rows[0] || null
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

async function getNextQuoteId() {
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM quotes')
  const next = parseInt(rows[0].count) + 1
  return `GL-${String(next).padStart(5, '0')}`
}

async function createQuote(data) {
  const id = await getNextQuoteId()
  const { rows } = await pool.query(
    `INSERT INTO quotes (id, status, customer_name, customer_email, project_name, raw_input, created_by)
     VALUES ($1, 'draft', $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, data.customerName, data.customerEmail, data.projectName, data.rawInput, data.createdBy]
  )
  return rows[0]
}

async function getQuote(id) {
  const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [id])
  return rows[0] || null
}

async function listQuotes({ status, search } = {}) {
  let query = 'SELECT * FROM quotes'
  const params = []
  const conditions = []

  if (status) {
    params.push(status)
    conditions.push(`status = $${params.length}`)
  }
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(customer_name ILIKE $${params.length} OR project_name ILIKE $${params.length})`)
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ' ORDER BY created_at DESC'

  const { rows } = await pool.query(query, params)
  return rows
}

async function updateQuote(id, fields) {
  const keys = Object.keys(fields)
  const values = Object.values(fields)
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')

  const { rows } = await pool.query(
    `UPDATE quotes SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] || null
}

module.exports = {
  createUser, getUserById, getUserByEmail, updateUserStatus, updateUserLastLogin, listUsers,
  createInvitation, getInvitationByToken, acceptInvitation,
  getNextQuoteId, createQuote, getQuote, listQuotes, updateQuote
}
