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
  profit_mode: 'per_shirt',
  profit_value: 0,
  intake_record: {
    customer: { name: 'Kohn Law', email: 'info@kohnlaw.com' },
    product: { brand_style: 'Bella+Canvas 3001', quantity: 60, colors: ['Navy'] },
    decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front chest', color_count: 2 }] },
    edge_cases: { dark_garment: false },
  },
  garment_data: { style: 'Bella+Canvas 3001', requestedColor: 'Navy', available: true, standardPrice: 4.50 },
  pricing_osp: { perUnitGarment: 4.50, perUnitDecoration: 3.00, perUnitTotal: 11.43, setupFees: { screenSetup: 40 }, orderTotal: 725.80, flags: [] },
  pricing_redwall: { perUnitGarment: 4.50, perUnitDecoration: 5.00, perUnitTotal: 13.02, setupFees: { screenSetup: 96 }, orderTotal: 877.20, flags: [] },
  recommended_supplier: 'OSP',
  selected_supplier: null,
  qa_report: { status: 'APPROVED', failed: [], reviewer_notes: '' },
  email_draft: 'SUBJECT: Quote — Kohn Law\n\nHi Kohn,\n\nHere is your quote.',
  pdf_url: 'https://drive.google.com/file-123',
  activity_log: [
    { timestamp: '2026-04-01T10:01:00Z', message: 'Pipeline started' },
    { timestamp: '2026-04-01T10:02:00Z', message: 'Pipeline complete' },
  ],
}

const MOCK_QUOTE_MULTI = {
  id: 'GL-00002',
  status: 'ready',
  customer_name: 'Test Multi',
  customer_email: 'multi@test.com',
  project_name: 'Multi Product Test',
  recommended_supplier: 'OSP',
  selected_supplier: null,
  profit_mode: 'per_shirt',
  profit_value: 0,
  intake_record: {
    customer: { name: 'Test Multi', email: 'multi@test.com' },
    products: [
      {
        brand_style: '3001CVC',
        quantity: 60,
        colors: ['Navy'],
        size_breakdown: 'S:20,M:20,L:20',
        product_type: 'adult',
        decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'left chest', color_count: 1 }] },
        edge_cases: {},
      },
      {
        brand_style: 'Gildan 5000',
        quantity: 24,
        colors: ['Black'],
        size_breakdown: 'M:12,L:12',
        product_type: 'adult',
        decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'full front', color_count: 2 }] },
        edge_cases: {},
      },
    ],
    flags: [],
    status: 'READY_FOR_PRICING',
  },
  garment_data: [
    { style: '3001CVC', requestedColor: 'Navy', available: true, standardPrice: 4.23 },
    { style: 'Gildan 5000', requestedColor: 'Black', available: true, standardPrice: 3.50 },
  ],
  pricing_osp: [
    { perUnitGarment: 4.23, perUnitDecoration: 3.00, perUnitProfit: 6.67, perUnitTotal: 13.90, setupFees: { screenSetup: 0, customPmsInk: 0 }, orderTotal: 834.00, flags: [] },
    { perUnitGarment: 3.50, perUnitDecoration: 4.60, perUnitProfit: 6.67, perUnitTotal: 14.77, setupFees: { screenSetup: 40, customPmsInk: 0 }, orderTotal: 394.48, flags: [] },
  ],
  pricing_redwall: null,
  qa_report: { status: 'APPROVED', passed_count: 10, total_checks: 10, failed: [], unable_to_verify: [] },
  email_draft: 'SUBJECT: Test\n\nBody',
  activity_log: [],
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

  it('shows a Run Quote button for draft quotes', async () => {
    renderViewQuote()
    await waitFor(() => expect(screen.getByRole('button', { name: /run quote/i })).toBeInTheDocument())
  })

  it('shows an Edit button for non-processing quotes', async () => {
    renderViewQuote()
    await waitFor(() => expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument())
  })

  it('opens edit panel when Edit is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    renderViewQuote()
    await waitFor(() => screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByPlaceholderText(/name or organization/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })
})

describe('ViewQuote — ready', () => {
  it('shows pricing totals', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('$725.80')).toBeInTheDocument())
  })

  it('shows QA status', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => screen.getByRole('button', { name: /quote quality/i }))
    await user.click(screen.getByRole('button', { name: /quote quality/i }))
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument())
  })

  it('shows email draft content', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => screen.getByRole('button', { name: /email draft/i }))
    await user.click(screen.getByRole('button', { name: /email draft/i }))
    await waitFor(() => expect(screen.getByText(/here is your quote/i)).toBeInTheDocument())
  })

  it('shows PDF download and preview links', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => screen.getByRole('button', { name: /quote pdf/i }))
    await user.click(screen.getByRole('button', { name: /quote pdf/i }))
    await waitFor(() => expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /open in new tab/i })).toBeInTheDocument()
  })
})

describe('ViewQuote — manufacturer selection', () => {
  it('shows Selected badge on the overridden supplier when selected_supplier differs from recommended', async () => {
    const quoteWithOverride = {
      ...MOCK_QUOTE_READY,
      recommended_supplier: 'OSP',
      selected_supplier: 'REDWALL',
    }
    renderViewQuote(quoteWithOverride)
    await waitFor(() => expect(screen.getByText('$877.20')).toBeInTheDocument())
    expect(screen.getByText('Selected')).toBeInTheDocument()
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('does not show Selected badge when selected_supplier matches recommended', async () => {
    const quoteNoOverride = {
      ...MOCK_QUOTE_READY,
      recommended_supplier: 'OSP',
      selected_supplier: 'OSP',
    }
    renderViewQuote(quoteNoOverride)
    await waitFor(() => expect(screen.getByText('$725.80')).toBeInTheDocument())
    expect(screen.queryByText('Selected')).not.toBeInTheDocument()
  })

  it('shows manufacturer radios in edit panel for screen print quote', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('radio', { name: /osp/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /redwall/i })).toBeInTheDocument()
  })
})

describe('pricing breakdown', () => {
  it('shows Garment Cost row for active supplier product', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('Garment Cost')).toBeInTheDocument())
  })

  it('shows Decoration Cost row', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('Decoration Cost')).toBeInTheDocument())
  })

  it('shows Giltee Profit row', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('Giltee Profit')).toBeInTheDocument())
  })

  it('shows Per Unit Total and Product Total rows', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => {
      expect(screen.getByText('Per Unit Total')).toBeInTheDocument()
      expect(screen.getByText(/Product Total/)).toBeInTheDocument()
    })
  })

  it('shows Quote Grand Total', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('Quote Grand Total')).toBeInTheDocument())
  })

  it('shows a breakdown row for each product in a multi-product quote', async () => {
    renderViewQuote(MOCK_QUOTE_MULTI)
    await waitFor(() => {
      expect(screen.getAllByText('Product 1 — 3001CVC').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Product 2 — Gildan 5000').length).toBeGreaterThan(0)
    })
  })
})
