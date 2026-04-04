import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import CreateQuote from '../CreateQuote'

const mockUser = { id: 1, name: 'Adam', email: 'adam@giltee.com', role: 'admin' }
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderCreateQuote() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ id: 'GL-00001', status: 'draft' }),
  })
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn() }}>
      <MemoryRouter>
        <CreateQuote />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => vi.resetAllMocks())

describe('CreateQuote', () => {
  it('renders the page heading', () => {
    renderCreateQuote()
    expect(screen.getByRole('heading', { name: 'New Quote' })).toBeInTheDocument()
  })

  it('renders the raw input textarea', () => {
    renderCreateQuote()
    expect(screen.getByPlaceholderText(/paste the customer/i)).toBeInTheDocument()
  })

  it('renders customer name and email fields', () => {
    renderCreateQuote()
    expect(screen.getByPlaceholderText(/customer name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/customer@email/i)).toBeInTheDocument()
  })

  it('submits the form and navigates to the new quote', async () => {
    renderCreateQuote()
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText(/paste the customer/i), '60 Bella+Canvas 3001 in Navy')
    await user.click(screen.getByRole('button', { name: /create quote/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/quotes', expect.objectContaining({
        method: 'POST',
      }))
      expect(mockNavigate).toHaveBeenCalledWith('/quotes/GL-00001')
    })
  })

  it('shows an error when submission fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })
    render(
      <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn() }}>
        <MemoryRouter>
          <CreateQuote />
        </MemoryRouter>
      </AuthContext.Provider>
    )
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText(/paste the customer/i), 'some input')
    await user.click(screen.getByRole('button', { name: /create quote/i }))

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument())
  })
})
