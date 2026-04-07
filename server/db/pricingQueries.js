const pool = require('./pool')

async function getPricingConfig(manufacturer) {
  const { rows } = await pool.query(
    'SELECT * FROM pricing_config WHERE manufacturer = $1',
    [manufacturer]
  )
  return rows[0] || null
}

async function upsertPricingConfig(manufacturer, config, updatedBy) {
  const { rows } = await pool.query(
    `INSERT INTO pricing_config (manufacturer, config, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (manufacturer) DO UPDATE
       SET config = $2, updated_by = $3, updated_at = NOW()
     RETURNING *`,
    [manufacturer, JSON.stringify(config), updatedBy]
  )
  return rows[0]
}

module.exports = { getPricingConfig, upsertPricingConfig }
