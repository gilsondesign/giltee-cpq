import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'
import AcceptInvite from '../AcceptInvite'

describe('Login', () => {
  it('renders the Giltee logo and sign in button', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(screen.getByAltText('Giltee')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows error message when auth_failed param is present', () => {
    render(
      <MemoryRouter initialEntries={['/login?error=auth_failed']}>
        <Login />
      </MemoryRouter>
    )
    expect(screen.getByText(/sign-in failed/i)).toBeInTheDocument()
  })
})

describe('AcceptInvite', () => {
  it('renders the invited message and sign in button', () => {
    render(<MemoryRouter initialEntries={['/auth/accept?token=abc-123']}><AcceptInvite /></MemoryRouter>)
    expect(screen.getByText(/you.ve been invited/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows error when no token is present', () => {
    render(<MemoryRouter initialEntries={['/auth/accept']}><AcceptInvite /></MemoryRouter>)
    expect(screen.getByText(/invalid or missing invite token/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeDisabled()
  })
})
