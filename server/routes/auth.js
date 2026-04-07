const express = require('express')
const passport = require('passport')
const { v4: uuidv4 } = require('uuid')
const queries = require('../db/queries')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}))

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  (req, res) => {
    res.redirect('/')
  }
)

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err)
    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr)
      res.json({ message: 'Logged out' })
    })
  })
})

// ─── Current user ────────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    avatarUrl: req.user.avatar_url,
    role: req.user.role
  })
})

// ─── Invite flow ─────────────────────────────────────────────────────────────

router.post('/invite', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    const token = uuidv4()
    await queries.createInvitation({ email, token, invitedBy: req.user.id })

    const appUrl = process.env.APP_URL || 'http://localhost:5173'
    const inviteUrl = `${appUrl}/accept?token=${token}`
    // Note: /accept is handled by the React SPA (client-side router).
    // The token in the URL is for UI display only — actual access control happens
    // in the OAuth callback (email matched against pending invitations in the DB).

    res.json({ inviteUrl })
  } catch (err) {
    next(err)
  }
})

// ─── User management ─────────────────────────────────────────────────────────

router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = await queries.listUsers()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

router.patch('/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own account status' })
    }
    const { status } = req.body
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or suspended' })
    }
    const user = await queries.updateUserStatus(req.params.id, status)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    next(err)
  }
})

module.exports = router
