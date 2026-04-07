jest.mock('../db/pool', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), on: jest.fn() }))
jest.mock('../db/queries')
jest.mock('../services/claudeService')
jest.mock('../services/ssService')
jest.mock('../services/pricingService')
jest.mock('../services/pdfService')
jest.mock('../services/gmailService')
jest.mock('../services/driveService')

const queries = require('../db/queries')
const claudeService = require('../services/claudeService')
const ssService = require('../services/ssService')
const pricingService = require('../services/pricingService')
const pdfService = require('../services/pdfService')
const gmailService = require('../services/gmailService')
const driveService = require('../services/driveService')
const pipelineService = require('../services/pipelineService')

const MOCK_QUOTE = {
  id: 'GL-00001',
  raw_input: '60 Bella+Canvas 3001 in Navy, screen print, 2 colors front, for Kohn Law, info@kohnlaw.com',
  status: 'draft',
  customer_name: 'Kohn Law',
  customer_email: 'info@kohnlaw.com',
  activity_log: [],
}

const MOCK_INTAKE_JSON = {
  customer: { name: 'Kohn Law', email: 'info@kohnlaw.com', event_purpose: null, deadline: null, rush: false, returning: null },
  product: { garment_type: 'T-shirt', brand_style: 'Bella+Canvas 3001', quantity: 60, size_breakdown: null, colors: ['Navy'], youth_sizes: false },
  decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front chest', color_count: 2, print_size: 'STANDARD' }], artwork_status: 'UNKNOWN', special_inks: [], stitch_count: null },
  edge_cases: { extended_sizes: false, dark_garment: false, individual_names: false, multiple_garment_colors: false, garment_color_count: 1, shipping_destination: null },
  flags: [],
  status: 'READY_FOR_PRICING',
  missing_fields: [],
}

const MOCK_GARMENT = { style: 'Bella+Canvas 3001', requestedColor: 'Navy', available: true, standardPrice: 4.50, extendedSkus: [], imageUrl: null, skus: [] }
const MOCK_PRICING = { osp: { perUnitTotal: 11.43, setupFees: { screenSetup: 40 }, orderTotal: 725.80, flags: [] }, redwall: { perUnitTotal: 13.02, setupFees: { screenSetup: 96 }, orderTotal: 877.20, flags: [] }, recommended: 'OSP' }
const MOCK_QA = { passed_count: 18, total_count: 20, failed: [], unable_to_verify: [], status: 'APPROVED', reviewer_notes: '' }

beforeEach(() => {
  process.env.GMAIL_CLIENT_ID = 'test-client-id'
  process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token'
  jest.clearAllMocks()

  queries.getQuote.mockResolvedValue({ ...MOCK_QUOTE })
  queries.updateQuote.mockImplementation(async (id, fields) => ({ ...MOCK_QUOTE, ...fields }))

  claudeService.callClaude.mockResolvedValue(JSON.stringify(MOCK_INTAKE_JSON))
  claudeService.parseJSONFromText.mockImplementation((text) => JSON.parse(text))

  ssService.lookupGarment.mockResolvedValue(MOCK_GARMENT)
  pricingService.calculateQuote.mockReturnValue(MOCK_PRICING)

  claudeService.callClaude
    .mockResolvedValueOnce(JSON.stringify(MOCK_INTAKE_JSON))  // intake
    .mockResolvedValueOnce(JSON.stringify(MOCK_QA))            // qa
    .mockResolvedValueOnce('SUBJECT: Quote — Kohn Law 60 Shirts\n---\nHi Kohn,\n\nHere is your quote.\n\nLisa')  // email

  pdfService.generateQuotePDF.mockResolvedValue(Buffer.from('fake-pdf'))
  driveService.uploadPDF.mockResolvedValue({ fileId: 'file-123', url: 'https://drive.google.com/file-123' })
  gmailService.createDraft.mockResolvedValue('draft-456')
})

afterEach(() => {
  delete process.env.GMAIL_CLIENT_ID
  delete process.env.GMAIL_REFRESH_TOKEN
})

describe('pipelineService.runQuotePipeline', () => {
  it('runs all pipeline steps and returns completed quote', async () => {
    const result = await pipelineService.runQuotePipeline('GL-00001')
    expect(result).toBeDefined()
    expect(queries.updateQuote).toHaveBeenCalled()
  })

  it('calls Claude for intake with the INTAKE system prompt', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    const firstClaudeCall = claudeService.callClaude.mock.calls[0][0]
    expect(firstClaudeCall.systemPrompt).toBeDefined()
    expect(firstClaudeCall.userPrompt).toContain('Kohn Law')
  })

  it('calls ssService.lookupGarment with the extracted style and color', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    expect(ssService.lookupGarment).toHaveBeenCalledWith(
      expect.objectContaining({ style: 'Bella+Canvas 3001', color: 'Navy' })
    )
  })

  it('calls pricingService.calculateQuote with garment cost', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    expect(pricingService.calculateQuote).toHaveBeenCalledWith(
      expect.objectContaining({ garmentCostPerUnit: 4.50 })
    )
  })

  it('calls pdfService.generateQuotePDF', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    expect(pdfService.generateQuotePDF).toHaveBeenCalled()
  })

  it('calls driveService.uploadPDF and gmailService.createDraft', async () => {
    await pipelineService.runQuotePipeline('GL-00001')
    expect(driveService.uploadPDF).toHaveBeenCalled()
    expect(gmailService.createDraft).toHaveBeenCalled()
  })

  it('sets quote status to error when a step fails', async () => {
    ssService.lookupGarment.mockRejectedValue(new Error('S&S API down'))
    await expect(pipelineService.runQuotePipeline('GL-00001')).rejects.toThrow('S&S API down')
    const errorCall = queries.updateQuote.mock.calls.find(
      call => call[1].status === 'error'
    )
    expect(errorCall).toBeDefined()
  })

  it('throws when quote has no raw_input', async () => {
    queries.getQuote.mockResolvedValue({ ...MOCK_QUOTE, raw_input: null })
    await expect(pipelineService.runQuotePipeline('GL-00001')).rejects.toThrow()
  })

  it('uses selected_supplier for email and PDF when set', async () => {
    queries.getQuote.mockResolvedValue({
      ...MOCK_QUOTE,
      selected_supplier: 'REDWALL',
      intake_record: MOCK_INTAKE_JSON,
    })

    // intake_record is pre-set, so pipeline skips intake Claude call.
    // Re-mock with only QA + email responses (not 3).
    claudeService.callClaude.mockReset()
    claudeService.callClaude
      .mockResolvedValueOnce(JSON.stringify(MOCK_QA))
      .mockResolvedValueOnce('SUBJECT: Quote — Kohn Law 60 Shirts\n---\nHere is your quote.\n\nLisa')

    await pipelineService.runQuotePipeline('GL-00001')

    // Email prompt should reference REDWALL total ($877.20), not OSP ($725.80)
    const emailCall = claudeService.callClaude.mock.calls.find(
      call => call[0].userPrompt?.includes('REDWALL') && call[0].userPrompt?.includes('877.20')
    )
    expect(emailCall).toBeDefined()

    // pdfService should be called with 'REDWALL' as second arg
    expect(pdfService.generateQuotePDF).toHaveBeenCalledWith(
      expect.anything(),
      'REDWALL'
    )
  })
})
