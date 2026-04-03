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
