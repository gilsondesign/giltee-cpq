import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import ViewQuote from '../ViewQuote'

const mockUser = { id: 1, name: 'Adam', email: 'adam@giltee.com', role: 'admin' }

const MOCK_QUOTE_DRAFT = {
  id: 'GL-00001',
  status: 'draft',
  customer_name: 'Kohn Law',
  customer_email: 'info@kohnlaw.com',
  project_name: 'Staff Shirts 2026',
  raw_input: '60 Bella+Canvas 3001 Navy, 2-color screen print',
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
  created_at: '2026-04-01T10:00:00Z',
  updated_at: '2026-04-01T10:00:00Z',
  created_by: 'adam@giltee.com',
}

const MOCK_QUOTE_READY = {
  ...MOCK_QUOTE_DRAFT,
  status: 'ready',
  intake_record: {
    customer: { name: 'Kohn Law', email: 'info@kohnlaw.com' },
    product: { brand_style: 'Bella+Canvas 3001', quantity: 60, colors: ['Navy'] },
    decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front chest', color_count: 2 }] },
    edge_cases: { dark_garment: false },
  },
  garment_data: { style: 'Bella+Canvas 3001', requestedColor: 'Navy', available: true, standardPrice: 4.50 },
  pricing_osp: { perUnitTotal: 11.43, setupFees: { screenSetup: 40 }, orderTotal: 725.80, flags: [] },
  pricing_redwall: { perUnitTotal: 13.02, setupFees: { screenSetup: 96 }, orderTotal: 877.20, flags: [] },
  recommended_supplier: 'OSP',
  qa_report: { status: 'APPROVED', failed: [], reviewer_notes: '' },
  email_draft: 'SUBJECT: Quote — Kohn Law\n\nHi Kohn,\n\nHere is your quote.',
  pdf_url: 'https://drive.google.com/file-123',
  activity_log: [
    { timestamp: '2026-04-01T10:01:00Z', message: 'Pipeline started' },
    { timestamp: '2026-04-01T10:02:00Z', message: 'Pipeline complete' },
  ],
}

function renderViewQuote(quote = MOCK_QUOTE_DRAFT) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => quote,
  })
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/quotes/GL-00001']}>
        <Routes>
          <Route path="/quotes/:id" element={<ViewQuote />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => vi.resetAllMocks())

describe('ViewQuote — draft', () => {
  it('renders the quote ID', async () => {
    renderViewQuote()
    await waitFor(() => expect(screen.getByText('GL-00001')).toBeInTheDocument())
  })

  it('shows the customer name', async () => {
    renderViewQuote()
    await waitFor(() => expect(screen.getByText('Kohn Law')).toBeInTheDocument())
  })

  it('shows a Run Pipeline button for draft quotes', async () => {
    renderViewQuote()
    await waitFor(() => expect(screen.getByRole('button', { name: /run pipeline/i })).toBeInTheDocument())
  })
})

describe('ViewQuote — ready', () => {
  it('shows pricing totals', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('$725.80')).toBeInTheDocument())
  })

  it('shows QA status', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('APPROVED')).toBeInTheDocument())
  })

  it('shows email draft content', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText(/here is your quote/i)).toBeInTheDocument())
  })

  it('shows PDF link when pdf_url is set', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByRole('link', { name: /view pdf/i })).toBeInTheDocument())
  })
})
