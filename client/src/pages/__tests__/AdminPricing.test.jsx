import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import AdminPricing from '../AdminPricing'

const mockUser = { id: 1, name: 'Adam', email: 'adam@giltee.com', role: 'admin' }

const MOCK_CONFIG = {
  tiers: [
    { min: 12, max: 23, costs: [6.00, 9.20, 12.40, 15.60, 18.80, 22.00, 25.20, 28.40, null, null, null, null] },
    { min: 24, max: 47, costs: [3.00, 4.60, 6.20, 7.80, 9.40, 11.00, 12.60, 14.20, null, null, null, null] },
  ],
  fees: { screenFeePerColor: 20, repeatScreenPerColor: 10, inkSwitch: 20, customPmsInk: 20, screenFeeWaivedAt: 96 },
  printSizes: {
    oversized: { surchargePercent: 15, screenFee: 15 },
    jumbo: { surchargePercent: 50, screenFee: 20 },
  },
}

function renderAdminPricing() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ manufacturer: 'OSP', config: MOCK_CONFIG, source: 'db', updated_at: '2026-04-07T10:00:00Z', updated_by: 'adam@giltee.com' }),
  })
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn() }}>
      <MemoryRouter initialEntries={['/admin/pricing']}>
        <Routes>
          <Route path="/admin/pricing" element={<AdminPricing />} />
          <Route path="/admin/users" element={<div>Users</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => vi.resetAllMocks())

describe('AdminPricing', () => {
  it('renders the OSP tab by default', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByRole('tab', { name: /osp/i })).toBeInTheDocument())
  })

  it('renders the Redwall tab', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByRole('tab', { name: /redwall/i })).toBeInTheDocument())
  })

  it('renders the PRINTING grid header', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText('PRINTING')).toBeInTheDocument())
  })

  it('renders color count column headers 1c through 12c', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText('1c')).toBeInTheDocument())
    expect(screen.getByText('12c')).toBeInTheDocument()
  })

  it('renders the FEES section', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText(/screen fee per color/i)).toBeInTheDocument())
  })

  it('renders the PRINT SIZES section', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText(/print sizes/i)).toBeInTheDocument())
  })

  it('renders a Save button', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument())
  })

  it('shows last updated info when source is db', async () => {
    renderAdminPricing()
    await waitFor(() => expect(screen.getByText(/adam@giltee.com/i)).toBeInTheDocument())
  })

  it('switches to Redwall tab and fetches Redwall config', async () => {
    const user = userEvent.setup()
    renderAdminPricing()
    await waitFor(() => screen.getByRole('tab', { name: /redwall/i }))
    await user.click(screen.getByRole('tab', { name: /redwall/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/pricing/REDWALL', expect.any(Object))
    })
  })
})
