require('dotenv').config()

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is required in production')
  process.exit(1)
}

const express = require('express')
const session = require('express-session')
const PgSession = require('connect-pg-simple')(session)
const passport = require('passport')
const { Strategy: GoogleStrategy } = require('passport-google-oauth20')
const cors = require('cors')
const helmet = require('helmet')
const pool = require('./db/pool')
const queries = require('./db/queries')
const { requireAuth } = require('./middleware/auth')

// ─── Passport ────────────────────────────────────────────────────────────────

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_OAUTH_CLIENT_ID || 'placeholder',
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'placeholder',
  callbackURL: `${process.env.APP_URL || 'http://localhost:5173'}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    if (!profile.emails?.length) {
      return done(null, false, { message: 'No verified email on Google profile' })
    }
    const email = profile.emails[0].value
    const name = profile.displayName
    const avatarUrl = profile.photos[0]?.value

    // Allow if user already exists and is active
    let user = await queries.getUserByEmail(email)
    if (user) {
      if (user.status === 'suspended') return done(null, false, { message: 'Account suspended' })
      await queries.updateUserLastLogin(user.id)
      return done(null, user)
    }

    // Check for a valid pending invitation
    const { rows } = await pool.query(
      `SELECT * FROM invitations WHERE email = $1 AND status = 'pending' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
      [email]
    )
    if (!rows[0]) return done(null, false, { message: 'No invitation found for this email' })

    // Create user and mark invitation accepted
    user = await queries.createUser({ email, name, avatarUrl })
    await queries.acceptInvitation(rows[0].token)
    return done(null, user)
  } catch (err) {
    return done(err)
  }
}))

passport.serializeUser((user, done) => done(null, user.id))

passport.deserializeUser(async (id, done) => {
  try {
    const user = await queries.getUserById(id)
    done(null, user || false)
  } catch (err) {
    done(err)
  }
})

// ─── Admin bootstrap ─────────────────────────────────────────────────────────

async function bootstrapAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return
  try {
    // Only bootstrap on a completely empty users table — not just "this email is missing"
    const { rows } = await pool.query('SELECT COUNT(*) AS count FROM users')
    if (parseInt(rows[0].count) === 0) {
      await queries.createUser({ email: adminEmail, name: 'Admin', avatarUrl: null, role: 'admin' })
      console.log(`Admin user bootstrapped: ${adminEmail}`)
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error('Bootstrap error:', err.message)
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express()

app.use(helmet({ contentSecurityPolicy: false }))

// Production: same-origin (static files served from /dist), no CORS header needed
// Development: Vite runs on :5173, Express on :3001 — allow cross-origin with credentials
app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : false,
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}))

app.use(passport.initialize())
app.use(passport.session())

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Auth routes are public (no requireAuth)
app.use('/auth', require('./routes/auth'))
app.use('/api/auth', require('./routes/auth'))

// All /api/* routes below this point require authentication
app.use('/api', requireAuth)

// Plan B routes:
app.use('/api/quotes', require('./routes/quotes'))
app.use('/api/garments', require('./routes/garments'))
app.use('/api/gmail', require('./routes/gmail'))

// Serve production client
if (process.env.NODE_ENV === 'production') {
  const path = require('path')
  app.use(express.static(path.join(__dirname, '../dist')))
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')))
}

// Must be last middleware — catches all next(err) calls and thrown errors
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3001
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  server.on('error', (err) => { console.error('Failed to start server:', err); process.exit(1) })
  bootstrapAdmin()
}

module.exports = app
