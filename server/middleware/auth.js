function requireAuth(req, res, next) {
  // Use passport's isAuthenticated() — it checks req.session.passport.user (Passport 0.7+)
  if (req.isAuthenticated && req.isAuthenticated()) return next()
  return res.status(401).json({ error: 'Authentication required' })
}

function requireAdmin(req, res, next) {
  // requireAuth must be called before this middleware to ensure req.user is set
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  return next()
}

module.exports = { requireAuth, requireAdmin }
