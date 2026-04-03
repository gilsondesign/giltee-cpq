import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import NavBar from '../NavBar'

function renderWithRouter(ui) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('NavBar', () => {
  it('renders the Giltee wordmark', () => {
    renderWithRouter(<NavBar user={{ name: 'Lisa', role: 'member' }} />)
    expect(screen.getByText('Giltee')).toBeInTheDocument()
  })

  it('renders main nav links', () => {
    renderWithRouter(<NavBar user={{ name: 'Lisa', role: 'member' }} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('New Quote')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()
  })

  it('shows admin link for admin users', () => {
    renderWithRouter(<NavBar user={{ name: 'Adam', role: 'admin' }} />)
    expect(screen.getByLabelText('Admin settings')).toBeInTheDocument()
  })

  it('hides admin link for non-admin users', () => {
    renderWithRouter(<NavBar user={{ name: 'Lisa', role: 'member' }} />)
    expect(screen.queryByLabelText('Admin settings')).not.toBeInTheDocument()
  })
})
