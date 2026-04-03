const express = require('express')
const ssService = require('../services/ssService')

const router = express.Router()

// GET /api/garments/lookup?style=bella+canvas+3001&color=Navy
router.get('/lookup', async (req, res, next) => {
  try {
    const { style, color } = req.query
    if (!style || !color) {
      return res.status(400).json({ error: 'style and color query params are required' })
    }
    const result = await ssService.lookupGarment({ style, color })
    res.json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router
