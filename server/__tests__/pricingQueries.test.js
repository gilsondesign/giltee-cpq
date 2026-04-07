const pool = require('../db/pool')
const { getPricingConfig, upsertPricingConfig } = require('../db/pricingQueries')

const TEST_MANUFACTURER = 'TEST_MFG'
const TEST_CONFIG = {
  tiers: [{ min: 12, max: 23, costs: [6.00, 9.20, null, null, null, null, null, null, null, null, null, null] }],
  fees: { screenFeePerColor: 20, repeatScreenPerColor: 10, inkSwitch: 20, customPmsInk: 20, screenFeeWaivedAt: 96 },
  printSizes: {
    oversized: { surchargePercent: 15, screenFee: 15 },
    jumbo: { surchargePercent: 50, screenFee: 20 },
  },
}

beforeEach(async () => {
  await pool.query('DELETE FROM pricing_config WHERE manufacturer = $1', [TEST_MANUFACTURER])
})

afterAll(async () => {
  await pool.query('DELETE FROM pricing_config WHERE manufacturer = $1', [TEST_MANUFACTURER])
  await pool.end()
})

describe('pricingQueries', () => {
  it('getPricingConfig returns null when no row exists', async () => {
    const result = await getPricingConfig(TEST_MANUFACTURER)
    expect(result).toBeNull()
  })

  it('upsertPricingConfig inserts a new row', async () => {
    const row = await upsertPricingConfig(TEST_MANUFACTURER, TEST_CONFIG, 'test@giltee.com')
    expect(row.manufacturer).toBe(TEST_MANUFACTURER)
    expect(row.config.fees.screenFeePerColor).toBe(20)
    expect(row.updated_by).toBe('test@giltee.com')
  })

  it('getPricingConfig returns the saved config', async () => {
    await upsertPricingConfig(TEST_MANUFACTURER, TEST_CONFIG, 'test@giltee.com')
    const row = await getPricingConfig(TEST_MANUFACTURER)
    expect(row).not.toBeNull()
    expect(row.config.tiers).toHaveLength(1)
  })

  it('upsertPricingConfig updates an existing row', async () => {
    await upsertPricingConfig(TEST_MANUFACTURER, TEST_CONFIG, 'test@giltee.com')
    const updated = { ...TEST_CONFIG, fees: { ...TEST_CONFIG.fees, screenFeePerColor: 25 } }
    const row = await upsertPricingConfig(TEST_MANUFACTURER, updated, 'other@giltee.com')
    expect(row.config.fees.screenFeePerColor).toBe(25)
    expect(row.updated_by).toBe('other@giltee.com')
  })
})
