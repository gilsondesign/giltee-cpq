import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import NavBar from '../NavBar'
import { AuthContext } from '../../context/AuthContext'

function renderWithAuth(ui, user) {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={{ user, setUser: vi.fn() }}>
        {ui}
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

describe('NavBar', () => {
  it('renders the Giltee wordmark', () => {
    renderWithAuth(<NavBar />, { name: 'Lisa', role: 'member' })
    expect(screen.getByText('Giltee')).toBeInTheDocument()
  })

  it('renders main nav links', () => {
    renderWithAuth(<NavBar />, { name: 'Lisa', role: 'member' })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('New Quote')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()
  })

  it('shows admin link for admin users', () => {
    renderWithAuth(<NavBar />, { name: 'Adam', role: 'admin' })
    expect(screen.getByLabelText('Admin settings')).toBeInTheDocument()
  })

  it('hides admin link for non-admin users', () => {
    renderWithAuth(<NavBar />, { name: 'Lisa', role: 'member' })
    expect(screen.queryByLabelText('Admin settings')).not.toBeInTheDocument()
  })
})
