function round2(n) {
  return Math.round(n * 100) / 100
}

/**
 * Calculate profit per unit from a quote-level profit setting.
 *
 * @param {object} params
 * @param {'per_shirt'|'percent'|'fixed_total'} params.mode
 * @param {number|string|null} params.value  - user-entered value
 * @param {number} params.garmentPerUnit     - wholesale garment cost
 * @param {number} params.decorationPerUnit  - decoration cost per unit
 * @param {number} params.totalQty           - total units across all products (used by fixed_total)
 * @returns {number} profit per unit, rounded to 2 decimal places
 */
export function calcProfitPerUnit({ mode, value, garmentPerUnit, decorationPerUnit, totalQty }) {
  const v = Number(value) || 0
  if (mode === 'per_shirt') return v
  if (mode === 'percent') return round2((garmentPerUnit + decorationPerUnit) * v / 100)
  if (mode === 'fixed_total') return totalQty > 0 ? round2(v / totalQty) : 0
  return 0
}

/**
 * Calculate total for one product line including profit and setup fees.
 *
 * @param {object} params
 * @param {number} params.garmentPerUnit
 * @param {number} params.decorationPerUnit
 * @param {number} params.profitPerUnit
 * @param {number} params.qty
 * @param {object|null} params.setupFees  - { screenSetup, dtfSetup, customPmsInk, ... }
 * @returns {number} product total, rounded to 2 decimal places
 */
export function calcProductTotal({ garmentPerUnit, decorationPerUnit, profitPerUnit, qty, setupFees }) {
  const perUnit = round2(garmentPerUnit + decorationPerUnit + profitPerUnit)
  const fees = Object.values(setupFees || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  return round2(perUnit * qty + fees)
}
