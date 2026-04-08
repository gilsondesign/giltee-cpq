import { describe, it, expect } from 'vitest'
import { calcProfitPerUnit, calcProductTotal } from '../profitCalc'

describe('calcProfitPerUnit', () => {
  it('per_shirt mode returns the flat value directly', () => {
    expect(calcProfitPerUnit({ mode: 'per_shirt', value: 5, garmentPerUnit: 4, decorationPerUnit: 3, totalQty: 60 })).toBe(5)
  })

  it('percent mode returns percentage of garment + decoration cost', () => {
    // (4 + 3) * 0.20 = 1.40
    expect(calcProfitPerUnit({ mode: 'percent', value: 20, garmentPerUnit: 4, decorationPerUnit: 3, totalQty: 60 })).toBe(1.40)
  })

  it('percent mode rounds to 2 decimal places', () => {
    // (4.23 + 3.00) * 0.15 = 1.0845 → 1.08
    expect(calcProfitPerUnit({ mode: 'percent', value: 15, garmentPerUnit: 4.23, decorationPerUnit: 3.00, totalQty: 60 })).toBe(1.08)
  })

  it('fixed_total mode divides total profit evenly by totalQty', () => {
    // 300 / 60 = 5.00
    expect(calcProfitPerUnit({ mode: 'fixed_total', value: 300, garmentPerUnit: 4, decorationPerUnit: 3, totalQty: 60 })).toBe(5)
  })

  it('fixed_total mode with odd totalQty rounds to 2 decimal places', () => {
    // 100 / 3 = 33.333... → 33.33
    expect(calcProfitPerUnit({ mode: 'fixed_total', value: 100, garmentPerUnit: 4, decorationPerUnit: 3, totalQty: 3 })).toBe(33.33)
  })

  it('fixed_total mode returns 0 when totalQty is 0', () => {
    expect(calcProfitPerUnit({ mode: 'fixed_total', value: 300, garmentPerUnit: 4, decorationPerUnit: 3, totalQty: 0 })).toBe(0)
  })

  it('unknown mode returns 0', () => {
    expect(calcProfitPerUnit({ mode: 'bogus', value: 99, garmentPerUnit: 4, decorationPerUnit: 3, totalQty: 60 })).toBe(0)
  })

  it('treats null/undefined value as 0', () => {
    expect(calcProfitPerUnit({ mode: 'per_shirt', value: null, garmentPerUnit: 4, decorationPerUnit: 3, totalQty: 60 })).toBe(0)
  })
})

describe('calcProductTotal', () => {
  it('sums garment + decoration + profit per unit times qty', () => {
    // (4 + 3 + 5) * 60 = 720
    expect(calcProductTotal({ garmentPerUnit: 4, decorationPerUnit: 3, profitPerUnit: 5, qty: 60, setupFees: {} })).toBe(720)
  })

  it('adds setup fees to the unit total', () => {
    // (4 + 3 + 5) * 60 + 40 = 760
    expect(calcProductTotal({ garmentPerUnit: 4, decorationPerUnit: 3, profitPerUnit: 5, qty: 60, setupFees: { screenSetup: 40 } })).toBe(760)
  })

  it('handles multiple setup fee types', () => {
    // (4 + 3 + 5) * 60 + 40 + 20 = 780
    expect(calcProductTotal({ garmentPerUnit: 4, decorationPerUnit: 3, profitPerUnit: 5, qty: 60, setupFees: { screenSetup: 40, customPmsInk: 20 } })).toBe(780)
  })

  it('handles missing setupFees gracefully', () => {
    expect(calcProductTotal({ garmentPerUnit: 4, decorationPerUnit: 3, profitPerUnit: 5, qty: 60, setupFees: null })).toBe(720)
  })

  it('rounds result to 2 decimal places', () => {
    // (1.11 + 1.11 + 1.11) * 3 = 9.99
    expect(calcProductTotal({ garmentPerUnit: 1.11, decorationPerUnit: 1.11, profitPerUnit: 1.11, qty: 3, setupFees: {} })).toBe(9.99)
  })
})
