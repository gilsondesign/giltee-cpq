import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Admin from '../Admin'

// Mock fetch
global.fetch = vi.fn()

beforeEach(() => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      users: [{ id: 1, email: 'adam@giltee.com', name: 'Adam', role: 'admin', status: 'active', created_at: '2026-01-01T00:00:00Z' }],
      invitations: [{ id: 1, email: 'grace@giltee.com', status: 'pending', expires_at: '2026-04-10T00:00:00Z', created_at: '2026-04-03T00:00:00Z' }]
    })
  })
})

afterEach(() => vi.resetAllMocks())

describe('Admin page', () => {
  it('renders the page title', async () => {
    render(<BrowserRouter><Admin /></BrowserRouter>)
    await waitFor(() => expect(screen.getByText('INVITE USER')).toBeInTheDocument())
  })

  it('lists users after loading', async () => {
    render(<BrowserRouter><Admin /></BrowserRouter>)
    await waitFor(() => expect(screen.getByText('adam@giltee.com')).toBeInTheDocument())
  })

  it('lists pending invitations', async () => {
    render(<BrowserRouter><Admin /></BrowserRouter>)
    await waitFor(() => expect(screen.getByText('grace@giltee.com')).toBeInTheDocument())
  })

  it('renders the invite form', async () => {
    render(<BrowserRouter><Admin /></BrowserRouter>)
    await waitFor(() => expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument())
  })
})
