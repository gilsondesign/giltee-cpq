import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'

// Mock fetch to return empty list
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function renderCustomers() {
  const { default: Customers } = await import('../Customers')
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={{ user: { name: 'Lisa', role: 'member' }, setUser: vi.fn() }}>
        <Customers />
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

describe('Customers list', () => {
  it('renders the page heading', async () => {
    await renderCustomers()
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
  })

  it('renders the New Customer button', async () => {
    await renderCustomers()
    expect(screen.getByText('+ New Account')).toBeInTheDocument()
  })

  it('renders the status filter', async () => {
    await renderCustomers()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
