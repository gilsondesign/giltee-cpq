import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'

// Mock fetch for /api/auth/me — unauthenticated
global.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 401,
  json: async () => ({ error: 'Authentication required' })
})

describe('App routing', () => {
  it('redirects unauthenticated users to /auth/login', async () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    // AuthGuard shows loading first, then redirects to /auth/login
    // The Login page renders the Giltee logo image
    await screen.findByAltText('Giltee')
  })
})
