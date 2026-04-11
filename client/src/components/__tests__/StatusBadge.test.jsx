import { render, screen } from '@testing-library/react'
import StatusBadge from '../StatusBadge'

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="draft" />)
    expect(screen.getByText('draft')).toBeInTheDocument()
  })

  it('renders all statuses without crashing', () => {
    const statuses = ['draft', 'processing', 'ready', 'error', 'sent', 'approved']
    statuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(screen.getByText(status)).toBeInTheDocument()
      unmount()
    })
  })

  it('handles unknown status gracefully', () => {
    render(<StatusBadge status="unknown" />)
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('renders the approved status with correct style', () => {
    render(<StatusBadge status="approved" />)
    const badge = screen.getByText('approved')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-primary-container')
    expect(badge).toHaveClass('text-on-primary')
  })
})
