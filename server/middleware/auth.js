function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next()
  return res.status(401).json({ error: 'Authentication required' })
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  return next()
}

module.exports = { requireAuth, requireAdmin }
