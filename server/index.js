require('dotenv').config()
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

module.exports = app
