const express = require('express')
const { requireAdmin } = require('../middleware/auth')
const { getPricingConfig, upsertPricingConfig } = require('../db/pricingQueries')
const pricingService = require('../services/pricingService')

const router = express.Router()

const VALID_MANUFACTURERS = new Set(['OSP', 'REDWALL'])

router.get('/:manufacturer', requireAdmin, async (req, res, next) => {
  try {
    const { manufacturer } = req.params
    if (!VALID_MANUFACTURERS.has(manufacturer)) {
      return res.status(400).json({ error: 'Unknown manufacturer. Valid values: OSP, REDWALL' })
    }
    const row = await getPricingConfig(manufacturer)
    if (row) {
      return res.json({ manufacturer, config: row.config, updated_at: row.updated_at, updated_by: row.updated_by, source: 'db' })
    }
    const config = pricingService.getDefaultConfig(manufacturer)
    return res.json({ manufacturer, config, source: 'default' })
  } catch (err) {
    next(err)
  }
})

router.put('/:manufacturer', requireAdmin, async (req, res, next) => {
  try {
    const { manufacturer } = req.params
    if (!VALID_MANUFACTURERS.has(manufacturer)) {
      return res.status(400).json({ error: 'Unknown manufacturer. Valid values: OSP, REDWALL' })
    }
    const { config } = req.body
    if (!config || !Array.isArray(config.tiers) || config.tiers.length === 0 || !config.fees || !config.printSizes) {
      return res.status(400).json({ error: 'config must have tiers (array), fees (object), and printSizes (object)' })
    }
    const row = await upsertPricingConfig(manufacturer, config, req.user.email)
    pricingService.invalidateCache(manufacturer)
    return res.json({ manufacturer: row.manufacturer, config: row.config, updated_at: row.updated_at, updated_by: row.updated_by })
  } catch (err) {
    next(err)
  }
})

module.exports = router
