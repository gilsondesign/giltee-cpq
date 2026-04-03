jest.mock('../db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
  connect: jest.fn()
}))
jest.mock('../db/queries')
jest.mock('../services/pipelineService')

const request = require('supertest')
const queries = require('../db/queries')
const pipelineService = require('../services/pipelineService')
const app = require('../index')

const MOCK_QUOTE = {
  id: 'GL-00001',
  status: 'draft',
  customer_name: 'Test Customer',
  customer_email: 'test@example.com',
  project_name: 'Test Project',
  raw_input: 'Give me 60 shirts',
  intake_record: null,
  garment_data: null,
  pricing_osp: null,
  pricing_redwall: null,
  recommended_supplier: null,
  qa_report: null,
  email_draft: null,
  gmail_draft_id: null,
  pdf_url: null,
  activity_log: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'adam@giltee.com',
}

beforeEach(() => {
  jest.clearAllMocks()
  queries.listQuotes = jest.fn().mockResolvedValue([MOCK_QUOTE])
  queries.getQuote = jest.fn().mockResolvedValue(MOCK_QUOTE)
  queries.createQuote = jest.fn().mockResolvedValue(MOCK_QUOTE)
  queries.updateQuote = jest.fn().mockResolvedValue(MOCK_QUOTE)
  queries.getNextQuoteId = jest.fn().mockResolvedValue('GL-00001')
  queries.getUserById = jest.fn().mockResolvedValue({ id: 1, email: 'adam@giltee.com', role: 'admin', status: 'active' })
  pipelineService.runQuotePipeline = jest.fn().mockResolvedValue({ ...MOCK_QUOTE, status: 'ready' })
})

describe('GET /health', () => {
  it('returns 200 (public route, no auth needed)', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/quotes — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).get('/api/quotes')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/quotes/:id — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).get('/api/quotes/GL-00001')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/quotes/:id/run — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).post('/api/quotes/GL-00001/run')
    expect(res.status).toBe(401)
  })
})
