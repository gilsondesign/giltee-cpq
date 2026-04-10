jest.mock('../db/pool', () => ({ query: jest.fn(), on: jest.fn() }))

const pdfService = require('../services/pdfService')

const SAMPLE_QUOTE = {
  id: 'GL-00001',
  customer_name: 'Kohn Law',
  customer_email: 'info@kohnlaw.com',
  project_name: 'Staff Shirts 2026',
  intake_record: {
    customer: { name: 'Kohn Law', email: 'info@kohnlaw.com', event_purpose: 'Staff shirts' },
    product: { garment_type: 'T-shirt', brand_style: 'Bella+Canvas 3001', quantity: 60, colors: ['Navy'] },
    decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front chest', colorCount: 2 }] },
  },
  garment_data: {
    style: 'Bella+Canvas 3001',
    requestedColor: 'Navy',
    standardPrice: 4.50,
    available: true,
  },
  pricing_osp: {
    perUnitTotal: 11.43,
    setupFees: { screenSetup: 40 },
    orderTotal: 725.80,
    flags: [],
  },
  pricing_redwall: {
    perUnitTotal: 13.02,
    setupFees: { screenSetup: 96 },
    orderTotal: 877.20,
    flags: [],
  },
  recommended_supplier: 'OSP',
  qa_report: { status: 'APPROVED', failed: [], reviewer_notes: '' },
  email_draft: 'Hi,\n\nHere is your quote.\n\nLisa',
  created_at: '2026-04-03T00:00:00Z',
}

const MULTI_PRODUCT_QUOTE = {
  id: 'GL-00002',
  customer_name: 'Acme Corp',
  customer_email: 'orders@acme.com',
  project_name: 'Company Retreat 2026',
  intake_record: {
    customer: { name: 'Acme Corp', email: 'orders@acme.com', event_purpose: 'Retreat' },
    products: [
      {
        brand_style: 'Gildan 5000',
        quantity: 48,
        colors: ['Forest Green'],
        decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front Center', colorCount: 3 }] },
        edge_cases: {},
      },
      {
        brand_style: 'Port Authority J317',
        quantity: 24,
        colors: ['Black'],
        decoration: { method: 'EMBROIDERY', locations: [{ name: 'Left Chest', colorCount: 1 }] },
        edge_cases: {},
      },
    ],
  },
  garment_data: [
    { style: 'Gildan 5000', requestedColor: 'Forest Green', available: true },
    { style: 'Port Authority J317', requestedColor: 'Black', available: true },
  ],
  pricing_osp: [
    { perUnitGarment: 4.50, perUnitDecoration: 2.10, setupFees: { screenSetup: 45 }, orderTotal: 361.80, flags: [] },
    { perUnitGarment: 38.00, perUnitDecoration: 8.50, setupFees: { digitizing: 50 }, orderTotal: 1166.00, flags: [] },
  ],
  pricing_redwall: [
    { perUnitGarment: 5.00, perUnitDecoration: 2.50, setupFees: { screenSetup: 60 }, orderTotal: 420.00, flags: [] },
    { perUnitGarment: 40.00, perUnitDecoration: 9.00, setupFees: { digitizing: 60 }, orderTotal: 1236.00, flags: [] },
  ],
  recommended_supplier: 'OSP',
  created_at: '2026-04-10T00:00:00Z',
}

describe('pdfService.generateQuotePDF', () => {
  it('returns a Buffer', async () => {
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE)
    expect(Buffer.isBuffer(buffer)).toBe(true)
  })

  it('returns a non-empty buffer (>1KB)', async () => {
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE)
    expect(buffer.length).toBeGreaterThan(1024)
  })

  it('does not throw when garment_data is null', async () => {
    const quote = { ...SAMPLE_QUOTE, garment_data: null }
    await expect(pdfService.generateQuotePDF(quote)).resolves.toBeDefined()
  })
})

describe('pdfService product type logic — source', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(path.join(__dirname, '../services/pdfService.js'), 'utf8')

  it('references product_type field', () => {
    expect(source).toContain('product_type')
  })

  it('does not contain the old "Youth Sizes" label', () => {
    expect(source).not.toContain('Youth Sizes')
  })

  it('does not contain the old "youth_sizes: Yes" string', () => {
    expect(source).not.toContain('youth_sizes: Yes')
  })

  it('contains the "Product Type" label', () => {
    expect(source).toContain('Product Type')
  })
})

describe('pdfService profit adjustment', () => {
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '../services/pdfService.js'),
    'utf8'
  )

  it('does not include a "Giltee Profit" row label in the PDF source', () => {
    expect(source).not.toContain('Giltee Profit')
  })

  it('reads profit_mode and profit_value from the quote object', () => {
    expect(source).toContain('profit_mode')
    expect(source).toContain('profit_value')
  })

  it('defines calcPdfProfitPerUnit function', () => {
    expect(source).toContain('calcPdfProfitPerUnit')
  })

  it('uses perUnitGarment and perUnitDecoration in adjusted total calculation', () => {
    expect(source).toContain('perUnitGarment')
    expect(source).toContain('perUnitDecoration')
  })
})

describe('pdfService.generateQuotePDF — supplier override', () => {
  it('uses OSP pricing when supplier is OSP', async () => {
    // recommended is OSP, so this just confirms default behavior
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE, 'OSP')
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1024)
  })

  it('uses Redwall pricing when supplier is REDWALL', async () => {
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE, 'REDWALL')
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1024)
  })

  it('falls back to recommended_supplier when no supplier arg is provided', async () => {
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE)
    expect(Buffer.isBuffer(buffer)).toBe(true)
  })
})

describe('pdfService.buildDocDefinition — multi-product card layout', () => {
  // Helper: find card table nodes in doc content
  function findCardTables(doc) {
    return doc.content.filter(node =>
      node?.table?.body?.[0]?.[0]?.fillColor === '#104F42' &&
      node?.table?.body?.[0]?.[0]?.columns?.[0]?.text?.startsWith('Product ')
    )
  }

  it('single-product quote: no product card tables in content', () => {
    const doc = pdfService.buildDocDefinition(SAMPLE_QUOTE, 'OSP')
    expect(findCardTables(doc)).toHaveLength(0)
  })

  it('multi-product quote: content has one card table per product', () => {
    const doc = pdfService.buildDocDefinition(MULTI_PRODUCT_QUOTE, 'OSP')
    expect(findCardTables(doc)).toHaveLength(2)
  })

  it('multi-product card headers show correct product numbers', () => {
    const doc = pdfService.buildDocDefinition(MULTI_PRODUCT_QUOTE, 'OSP')
    const cards = findCardTables(doc)
    expect(cards[0].table.body[0][0].columns[0].text).toBe('Product 1')
    expect(cards[1].table.body[0][0].columns[0].text).toBe('Product 2')
  })

  it('multi-product card headers show correct unit counts', () => {
    const doc = pdfService.buildDocDefinition(MULTI_PRODUCT_QUOTE, 'OSP')
    const cards = findCardTables(doc)
    expect(cards[0].table.body[0][0].columns[1].text).toBe('48 units')
    expect(cards[1].table.body[0][0].columns[1].text).toBe('24 units')
  })

  it('multi-product quote renders to PDF without throwing', async () => {
    const buffer = await pdfService.generateQuotePDF(MULTI_PRODUCT_QUOTE, 'OSP')
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1024)
  })
})
