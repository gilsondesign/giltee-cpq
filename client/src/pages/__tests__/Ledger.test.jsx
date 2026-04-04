import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import Ledger from '../Ledger'

const mockUser = { id: 1, name: 'Adam', email: 'adam@giltee.com', role: 'admin' }

const MOCK_QUOTES = [
  { id: 'GL-00001', status: 'ready', customer_name: 'Kohn Law', project_name: 'Staff Shirts 2026', created_at: '2026-04-01T10:00:00Z', created_by: 'adam@giltee.com' },
  { id: 'GL-00002', status: 'draft', customer_name: 'Acme Corp', project_name: 'Promo Run', created_at: '2026-04-02T09:00:00Z', created_by: 'adam@giltee.com' },
]

function renderLedger() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_QUOTES,
  })
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn() }}>
      <MemoryRouter>
        <Ledger />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => vi.resetAllMocks())

describe('Ledger', () => {
  it('renders the page heading', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getByText('Quote Ledger')).toBeInTheDocument())
  })

  it('shows quotes after loading', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getByText('Kohn Law')).toBeInTheDocument())
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('shows quote IDs', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getByText('GL-00001')).toBeInTheDocument())
  })

  it('shows a New Quote link', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getAllByRole('link', { name: /new quote/i }).length).toBeGreaterThan(0))
  })

  it('shows status badges', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getAllByText('ready').length).toBeGreaterThan(0))
    expect(screen.getAllByText('draft').length).toBeGreaterThan(0)
  })
})
