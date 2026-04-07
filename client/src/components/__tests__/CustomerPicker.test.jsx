import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CustomerPicker from '../CustomerPicker'

const mockCustomers = [
  { id: 1, account_id: '0248', company_name: "Jim's Trucking", contact_name: 'Jim Hargrove', contact_email: 'jim@jimstrucking.com', account_status: 'active' },
  { id: 2, account_id: '0312', company_name: 'Apex Gym', contact_name: 'Sara Chen', contact_email: 'sara@apexgym.com', account_status: 'active' },
]

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockCustomers,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CustomerPicker', () => {
  it('renders the search input when no customer is linked', () => {
    render(<CustomerPicker linkedCustomerId={null} onLink={vi.fn()} onUnlink={vi.fn()} />)
    expect(screen.getByPlaceholderText(/search by company/i)).toBeInTheDocument()
  })

  it('shows dropdown results when search returns results', async () => {
    render(<CustomerPicker linkedCustomerId={null} onLink={vi.fn()} onUnlink={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search by company/i), { target: { value: 'jim' } })
    await waitFor(() => {
      expect(screen.getByText("Jim's Trucking")).toBeInTheDocument()
    })
  })

  it('calls onLink with customer data when a result is clicked', async () => {
    const onLink = vi.fn()
    render(<CustomerPicker linkedCustomerId={null} onLink={onLink} onUnlink={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search by company/i), { target: { value: 'jim' } })
    await waitFor(() => screen.getByText("Jim's Trucking"))
    fireEvent.click(screen.getByText("Jim's Trucking"))
    expect(onLink).toHaveBeenCalledWith(mockCustomers[0])
  })

  it('renders linked chip when linkedCustomerId and linkedCustomer are provided', () => {
    render(
      <CustomerPicker
        linkedCustomerId={1}
        linkedCustomer={mockCustomers[0]}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />
    )
    expect(screen.getByText("Jim's Trucking")).toBeInTheDocument()
    expect(screen.getByText(/0248/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlink/i })).toBeInTheDocument()
  })

  it('calls onUnlink when unlink button is clicked', () => {
    const onUnlink = vi.fn()
    render(
      <CustomerPicker
        linkedCustomerId={1}
        linkedCustomer={mockCustomers[0]}
        onLink={vi.fn()}
        onUnlink={onUnlink}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /unlink/i }))
    expect(onUnlink).toHaveBeenCalled()
  })
})
