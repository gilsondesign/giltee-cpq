// ─── Profit Margin Tiers ──────────────────────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 1
const PROFIT_TIERS = [
  { min: 24,  max: 47,       profit: 6.67 },
  { min: 48,  max: 95,       profit: 4.69 },
  { min: 96,  max: 143,      profit: 3.13 },
  { min: 144, max: 299,      profit: 2.26 },
  { min: 300, max: Infinity, profit: 1.67 },
]

// ─── OSP Screen Print Decoration Costs ───────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 3A
// costs array: [1c, 2c, 3c, 4c, 5c, 6c, 7c, 8c] per unit
const OSP_SCREEN_PRINT = [
  { min: 12,   max: 23,       costs: [6.00, 9.20, 12.40, 15.60, 18.80, 22.00, 25.20, 28.40] },
  { min: 24,   max: 47,       costs: [3.00, 4.60,  6.20,  7.80,  9.40, 11.00, 12.60, 14.20] },
  { min: 48,   max: 95,       costs: [1.58, 2.24,  2.90,  3.56,  4.22,  4.88,  5.54,  6.20] },
  { min: 96,   max: 143,      costs: [1.50, 2.07,  2.64,  3.21,  3.78,  4.35,  4.92,  5.49] },
  { min: 144,  max: 299,      costs: [1.28, 1.73,  2.18,  2.63,  3.08,  3.53,  3.98,  4.43] },
  { min: 300,  max: 499,      costs: [0.97, 1.24,  1.51,  1.78,  2.05,  2.32,  2.59,  2.86] },
  { min: 500,  max: 749,      costs: [0.86, 1.03,  1.20,  1.37,  1.54,  1.71,  1.88,  2.05] },
  { min: 750,  max: 999,      costs: [0.81, 0.96,  1.11,  1.26,  1.41,  1.56,  1.71,  1.86] },
  { min: 1000, max: 2499,     costs: [0.73, 0.86,  0.99,  1.12,  1.25,  1.38,  1.51,  1.64] },
  { min: 2500, max: Infinity, costs: [0.71, 0.83,  0.95,  1.07,  1.19,  1.31,  1.43,  1.55] },
]

// ─── Redwall Screen Print Decoration Costs ────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 3B
const REDWALL_SCREEN_PRINT = [
  { min: 6,    max: 11,       costs: [7.88, 9.43, 10.93, 12.47, 14.00, 15.52, 17.04, 18.57] },
  { min: 12,   max: 23,       costs: [4.49, 5.58,  6.80,  7.79,  9.09, 10.49, 11.87, 13.25] },
  { min: 24,   max: 47,       costs: [2.99, 3.74,  4.60,  5.10,  5.89,  7.27,  8.65, 10.03] },
  { min: 48,   max: 95,       costs: [2.37, 3.22,  3.91,  4.49,  5.29,  6.67,  8.04,  8.81] },
  { min: 96,   max: 143,      costs: [2.07, 2.69,  3.29,  3.98,  4.60,  5.22,  6.05,  6.89] },
  { min: 144,  max: 299,      costs: [1.70, 2.36,  2.92,  3.32,  3.81,  4.38,  4.86,  5.34] },
  { min: 300,  max: 499,      costs: [1.24, 1.47,  1.80,  2.03,  2.33,  2.48,  2.71,  2.86] },
  { min: 500,  max: 999,      costs: [1.01, 1.17,  1.36,  1.52,  1.73,  1.81,  2.05,  2.24] },
  { min: 1000, max: 2499,     costs: [0.85, 1.01,  1.07,  1.14,  1.31,  1.45,  1.56,  1.68] },
  { min: 2500, max: Infinity, costs: [0.70, 0.77,  0.84,  0.89,  1.00,  1.06,  1.13,  1.21] },
]

// ─── DTF Decoration Costs ─────────────────────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 3C
// qty breaks: 1-5, 6-11, 12-23, 24-47, 48-95, 96-143, 144-299, 300-599, 600+
const DTF_QTY_BREAKS = [1, 6, 12, 24, 48, 96, 144, 300, 600]
const DTF_COSTS = {
  SMALL:     [4.50, 4.00, 3.75, 3.50, 3.25, 3.00, 2.75, 2.50, 2.25],
  STANDARD:  [7.25, 6.95, 6.75, 6.50, 6.25, 6.00, 5.75, 5.50, 5.00],
  OVERSIZED: [11.25, 10.75, 10.25, 10.00, 9.75, 9.50, 9.25, 9.00, 8.75],
}

// ─── DTG Decoration Costs ─────────────────────────────────────────────────────
// Source: Giltee pricing rules skill, Layer 3D
// Same qty breaks as DTF
const DTG_COSTS = {
  STANDARD:  [7.25, 6.95, 6.75, 6.50, 6.25, 6.00, 5.75, 5.50, 5.00],
  OVERSIZED: [8.75, 8.45, 8.25, 8.00, 7.75, 7.50, 7.25, 7.00, 6.50],
}

// ─── Default config shape (converted from hardcoded constants) ────────────────

function padTo12(costs) {
  const arr = costs.slice(0, 12)
  while (arr.length < 12) arr.push(null)
  return arr
}

function buildDefaultConfig(tiers) {
  return {
    tiers: tiers.map(t => ({
      min: t.min,
      max: t.max === Infinity ? null : t.max,
      costs: padTo12(t.costs),
    })),
    fees: {
      screenFeePerColor: 20,
      repeatScreenPerColor: 10,
      inkSwitch: 20,
      customPmsInk: 20,
      screenFeeWaivedAt: 96,
    },
    printSizes: {
      oversized: { surchargePercent: 15, screenFee: 15 },
      jumbo: { surchargePercent: 50, screenFee: 20 },
    },
  }
}

function getDefaultConfig(manufacturer) {
  if (manufacturer === 'OSP') return buildDefaultConfig(OSP_SCREEN_PRINT)
  if (manufacturer === 'REDWALL') return buildDefaultConfig(REDWALL_SCREEN_PRINT)
  throw new Error(`Unknown manufacturer: ${manufacturer}`)
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const _cache = { OSP: null, REDWALL: null }

function invalidateCache(manufacturer) {
  _cache[manufacturer] = null
}

async function loadConfig(manufacturer) {
  if (_cache[manufacturer]) return _cache[manufacturer]
  try {
    const { getPricingConfig } = require('../db/pricingQueries')
    const row = await getPricingConfig(manufacturer)
    if (row) {
      _cache[manufacturer] = row.config
      return _cache[manufacturer]
    }
  } catch {
    // DB unavailable — fall through to hardcoded
  }
  _cache[manufacturer] = getDefaultConfig(manufacturer)
  return _cache[manufacturer]
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

function getMarginForQuantity(qty) {
  const tier = PROFIT_TIERS.find(t => qty >= t.min && qty <= t.max)
  return tier ? tier.profit : null
}

async function getOspDecorationCost(qty, colorCount) {
  const config = await loadConfig('OSP')
  const row = config.tiers.find(r => qty >= r.min && qty <= (r.max === null ? Infinity : r.max))
  if (!row) return null
  const idx = Math.min(colorCount, 12) - 1
  return row.costs[idx] ?? null
}

async function getRedwallDecorationCost(qty, colorCount) {
  const config = await loadConfig('REDWALL')
  const row = config.tiers.find(r => qty >= r.min && qty <= (r.max === null ? Infinity : r.max))
  if (!row) return null
  const idx = Math.min(colorCount, 12) - 1
  return row.costs[idx] ?? null
}

function getDTFDecorationCost(qty, printSize = 'STANDARD') {
  const tierIndex = DTF_QTY_BREAKS.filter(b => qty >= b).length - 1
  const costs = DTF_COSTS[printSize] || DTF_COSTS.STANDARD
  return costs[Math.min(tierIndex, costs.length - 1)]
}

function getDTGDecorationCost(qty, printSize = 'STANDARD') {
  const tierIndex = DTF_QTY_BREAKS.filter(b => qty >= b).length - 1
  const costs = DTG_COSTS[printSize] || DTG_COSTS.STANDARD
  return costs[Math.min(tierIndex, costs.length - 1)]
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// ─── Screen Print Calculation ─────────────────────────────────────────────────

/**
 * Calculate screen print pricing for both OSP and Redwall.
 *
 * @param {{
 *   quantity: number,
 *   garmentCostPerUnit: number,
 *   locations: Array<{ colorCount: number, printSize: 'STANDARD'|'OVERSIZED'|'JUMBO' }>,
 *   isDarkGarment: boolean,
 *   isReorder: boolean,
 * }} params
 */
async function calculateScreenPrintQuote({ quantity, garmentCostPerUnit, locations, isDarkGarment, isReorder }) {
  const ospConfig = await loadConfig('OSP')
  const redwallConfig = await loadConfig('REDWALL')
  const margin = getMarginForQuantity(quantity)
  const flags = []

  if (margin === null) {
    flags.push(`Quantity ${quantity} is below the screen print minimum (24 units). Consider DTF or DTG.`)
  }

  async function sumDecoration(costFn) {
    let total = 0
    for (const loc of locations) {
      const effectiveColors = isDarkGarment ? loc.colorCount + 1 : loc.colorCount
      const cost = await costFn(quantity, effectiveColors)
      total += cost || 0
    }
    return total
  }

  const totalOspDecoration = round2(await sumDecoration(getOspDecorationCost))
  const totalRedwallDecoration = round2(await sumDecoration(getRedwallDecorationCost))
  const perUnitProfit = margin || 0

  const totalColors = locations.reduce((sum, loc) => {
    return sum + (isDarkGarment ? loc.colorCount + 1 : loc.colorCount)
  }, 0)

  const ospFees = ospConfig.fees
  const redwallFees = redwallConfig.fees

  const ospSetupFee = quantity >= (ospFees.screenFeeWaivedAt || 96)
    ? 0
    : (isReorder ? ospFees.repeatScreenPerColor : ospFees.screenFeePerColor) * totalColors

  const redwallSetupFee = quantity >= (redwallFees.screenFeeWaivedAt || 144)
    ? 0
    : locations.reduce((sum, loc) => {
        const colors = isDarkGarment ? loc.colorCount + 1 : loc.colorCount
        return sum + (isReorder ? redwallFees.repeatScreenPerColor : redwallFees.screenFeePerColor) * colors
      }, 0)

  const ospPerUnit = round2(garmentCostPerUnit + totalOspDecoration + perUnitProfit)
  const redwallPerUnit = round2(garmentCostPerUnit + totalRedwallDecoration + perUnitProfit)
  const ospTotal = round2(ospPerUnit * quantity + ospSetupFee)
  const redwallTotal = round2(redwallPerUnit * quantity + redwallSetupFee)

  if (isDarkGarment) {
    flags.push('Dark garment: underbase added to color count for pricing.')
  }

  return {
    osp: {
      perUnitGarment: garmentCostPerUnit,
      perUnitDecoration: totalOspDecoration,
      perUnitProfit,
      perUnitTotal: ospPerUnit,
      setupFees: { screenSetup: ospSetupFee },
      orderTotal: ospTotal,
      flags,
    },
    redwall: {
      perUnitGarment: garmentCostPerUnit,
      perUnitDecoration: totalRedwallDecoration,
      perUnitProfit,
      perUnitTotal: redwallPerUnit,
      setupFees: { screenSetup: redwallSetupFee },
      orderTotal: redwallTotal,
      flags,
    },
    recommended: ospTotal <= redwallTotal ? 'OSP' : 'REDWALL',
  }
}

// ─── DTF Calculation ──────────────────────────────────────────────────────────

function calculateDTFQuote({ quantity, garmentCostPerUnit, printSize = 'STANDARD' }) {
  const perUnitDecoration = getDTFDecorationCost(quantity, printSize)
  const perUnitProfit = getMarginForQuantity(quantity) || 0
  const perUnitTotal = round2(garmentCostPerUnit + perUnitDecoration + perUnitProfit)
  const setupFees = { dtfSetup: 35 }
  const orderTotal = round2(perUnitTotal * quantity + 35)

  return {
    perUnitGarment: garmentCostPerUnit,
    perUnitDecoration,
    perUnitProfit,
    perUnitTotal,
    setupFees,
    orderTotal,
    flags: quantity < 24 ? ['Sub-24 unit order — confirm profit margin with Lisa.'] : [],
  }
}

// ─── DTG Calculation ──────────────────────────────────────────────────────────

function calculateDTGQuote({ quantity, garmentCostPerUnit, printSize = 'STANDARD' }) {
  const perUnitDecoration = getDTGDecorationCost(quantity, printSize)
  const perUnitProfit = getMarginForQuantity(quantity) || 0
  const perUnitTotal = round2(garmentCostPerUnit + perUnitDecoration + perUnitProfit)
  const setupFees = { dtgSetup: 35 }
  const orderTotal = round2(perUnitTotal * quantity + 35)

  return {
    perUnitGarment: garmentCostPerUnit,
    perUnitDecoration,
    perUnitProfit,
    perUnitTotal,
    setupFees,
    orderTotal,
    flags: quantity < 24 ? ['Sub-24 unit order — confirm profit margin with Lisa.'] : [],
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Calculate pricing for a quote based on decoration method.
 * For SCREEN_PRINT, returns both OSP and Redwall. For others, returns a single breakdown.
 */
async function calculateQuote(params) {
  const { decorationMethod } = params
  switch (decorationMethod) {
    case 'SCREEN_PRINT':
      return calculateScreenPrintQuote(params)
    case 'DTF':
      return { single: calculateDTFQuote(params), recommended: 'SINGLE' }
    case 'DTG':
      return { single: calculateDTGQuote(params), recommended: 'SINGLE' }
    case 'EMBROIDERY':
      return {
        single: null,
        recommended: 'BAYVIEW',
        flags: ['EMBROIDERY: Draft pricing only — flag for Bayview Threadworks confirmation.'],
      }
    default:
      throw new Error(`Unknown decoration method: ${decorationMethod}`)
  }
}

module.exports = {
  getDefaultConfig,
  invalidateCache,
  getMarginForQuantity,
  getOspDecorationCost,
  getRedwallDecorationCost,
  getDTFDecorationCost,
  getDTGDecorationCost,
  calculateScreenPrintQuote,
  calculateDTFQuote,
  calculateDTGQuote,
  calculateQuote,
}
