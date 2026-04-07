jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

const pricingService = require('../services/pricingService')

describe('getMarginForQuantity', () => {
  it('returns correct margin for each tier', () => {
    expect(pricingService.getMarginForQuantity(24)).toBe(6.67)
    expect(pricingService.getMarginForQuantity(47)).toBe(6.67)
    expect(pricingService.getMarginForQuantity(48)).toBe(4.69)
    expect(pricingService.getMarginForQuantity(95)).toBe(4.69)
    expect(pricingService.getMarginForQuantity(96)).toBe(3.13)
    expect(pricingService.getMarginForQuantity(144)).toBe(2.26)
    expect(pricingService.getMarginForQuantity(300)).toBe(1.67)
    expect(pricingService.getMarginForQuantity(500)).toBe(1.67)
  })

  it('returns null for quantities below 24', () => {
    expect(pricingService.getMarginForQuantity(23)).toBeNull()
    expect(pricingService.getMarginForQuantity(1)).toBeNull()
  })
})

describe('getOspDecorationCost', () => {
  it('returns correct OSP cost for 48-95 tier, 2 colors', async () => {
    expect(await pricingService.getOspDecorationCost(60, 2)).toBe(2.24)
  })
  it('returns correct OSP cost for 24-47 tier, 1 color', async () => {
    expect(await pricingService.getOspDecorationCost(36, 1)).toBe(3.00)
  })
  it('returns correct OSP cost for 144-299 tier, 4 colors', async () => {
    expect(await pricingService.getOspDecorationCost(150, 4)).toBe(2.63)
  })
  it('returns null when quantity is below minimum for OSP table (below 12)', async () => {
    expect(await pricingService.getOspDecorationCost(5, 1)).toBeNull()
  })
})

describe('getRedwallDecorationCost', () => {
  it('returns correct Redwall cost for 48-95 tier, 2 colors', async () => {
    expect(await pricingService.getRedwallDecorationCost(60, 2)).toBe(3.22)
  })
  it('returns correct Redwall cost for 96-143 tier, 3 colors', async () => {
    expect(await pricingService.getRedwallDecorationCost(100, 3)).toBe(3.29)
  })
})

describe('calculateScreenPrintQuote', () => {
  it('calculates correct per-unit and total for a 60-unit, 2-color, single-location order', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: false,
      isReorder: false,
    })

    // OSP: garment 4.50 + decoration 2.24 (48-95 tier, 2c) + margin 4.69 = 11.43/unit
    // Setup fees: $20 × 2 colors = $40 (60 < 96 so fees apply)
    expect(result.osp.perUnitGarment).toBe(4.50)
    expect(result.osp.perUnitDecoration).toBe(2.24)
    expect(result.osp.perUnitProfit).toBe(4.69)
    expect(result.osp.perUnitTotal).toBe(11.43)
    expect(result.osp.setupFees.screenSetup).toBe(40)
    expect(result.osp.orderTotal).toBeCloseTo(60 * 11.43 + 40, 2)
  })

  it('waives OSP setup fees at 96+ pieces', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 100,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.screenSetup).toBe(0)
  })

  it('adds underbase color to count on dark garments', async () => {
    const resultLight = await pricingService.calculateScreenPrintQuote({
      quantity: 60, garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: false, isReorder: false,
    })
    const resultDark = await pricingService.calculateScreenPrintQuote({
      quantity: 60, garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: true, isReorder: false,
    })
    // Dark garment: 2 colors + 1 underbase = 3 colors for pricing
    // OSP 48-95, 3c = 2.90 vs 2c = 2.24
    expect(resultDark.osp.perUnitDecoration).toBe(2.90)
    expect(resultLight.osp.perUnitDecoration).toBe(2.24)
  })

  it('waives Redwall setup fees at 144+ pieces', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 150,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 3, printSize: 'STANDARD' }],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.redwall.setupFees.screenSetup).toBe(0)
  })
})

describe('calculateScreenPrintQuote — custom PMS ink fee', () => {
  it('applies no custom PMS fee when all ink colors are stock', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD', inkColors: [
        { name: 'PANTONE 286 C', custom: false },
        { name: 'PANTONE 485 C', custom: false },
      ]}],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.customPmsInk).toBe(0)
    expect(result.redwall.setupFees.customPmsInk).toBe(0)
  })

  it('applies $20 per custom PMS color for OSP', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD', inkColors: [
        { name: 'PANTONE 286 C', custom: false },
        { name: 'PMS Custom Red', custom: true },
      ]}],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.customPmsInk).toBe(20)
    expect(result.osp.orderTotal).toBe(
      result.osp.perUnitTotal * 60 + result.osp.setupFees.screenSetup + 20
    )
  })

  it('applies $40 for two custom PMS colors across two locations', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [
        { colorCount: 1, printSize: 'STANDARD', inkColors: [{ name: 'PMS Custom A', custom: true }] },
        { colorCount: 1, printSize: 'STANDARD', inkColors: [{ name: 'PMS Custom B', custom: true }] },
      ],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.customPmsInk).toBe(40)
  })

  it('calculates Redwall customPmsInk fee using its own config value', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 1, printSize: 'STANDARD', inkColors: [{ name: 'PMS Custom', custom: true }] }],
      isDarkGarment: false,
      isReorder: false,
    })
    // Both use their own config's customPmsInk value (default: 20 each)
    expect(result.redwall.setupFees.customPmsInk).toBe(20)
    expect(result.osp.setupFees.customPmsInk).toBe(20)
  })

  it('treats absent inkColors as zero custom colors', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.customPmsInk).toBe(0)
  })

  it('adds a flag message when OSP custom PMS fee applies', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 1, printSize: 'STANDARD', inkColors: [{ name: 'PMS Custom', custom: true }] }],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.flags.some(f => f.includes('custom PMS'))).toBe(true)
  })
})

describe('calculateDTFQuote', () => {
  it('calculates correct DTF quote for 60 units, standard print size', () => {
    const result = pricingService.calculateDTFQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      printSize: 'STANDARD',
    })
    // DTF 48-95 tier standard = $6.25/unit
    // Margin 48-95 = $4.69/unit
    // One-time setup = $35
    expect(result.perUnitDecoration).toBe(6.25)
    expect(result.perUnitProfit).toBe(4.69)
    expect(result.perUnitTotal).toBeCloseTo(4.50 + 6.25 + 4.69, 2)
    expect(result.setupFees.dtfSetup).toBe(35)
  })
})
