require('dotenv').config()

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is required in production')
  process.exit(1)
}

const express = require('express')
const session = require('express-session')
const PgSession = require('connect-pg-simple')(session)
const passport = require('passport')
const cors = require('cors')
const helmet = require('helmet')
const pool = require('./db/pool')

const app = express()

// Security + parsing
app.use(helmet({ contentSecurityPolicy: false }))
// Production: same-origin (static files served from /dist), no CORS header needed
// Development: Vite runs on :5173, Express on :3001 — allow cross-origin with credentials
app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : false,
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Sessions
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}))

// Passport (strategy + routes added in Task 7)
app.use(passport.initialize())
app.use(passport.session())

// Temporary stubs — replaced with full Google OAuth strategy in Task 7
passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser((id, done) => done(null, { id }))

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Serve production client
if (process.env.NODE_ENV === 'production') {
  const path = require('path')
  app.use(express.static(path.join(__dirname, '../dist')))
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')))
}

const PORT = process.env.PORT || 3001
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

// Must be last middleware — catches all next(err) calls and thrown errors
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: 'Internal server error' })
})

module.exports = app
