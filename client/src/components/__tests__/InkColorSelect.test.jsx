// client/src/components/__tests__/InkColorSelect.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import InkColorSelect from '../InkColorSelect'

const stockColors = [
  { name: 'PANTONE 286 C', hex: '#003DA5' },
  { name: 'PANTONE 485 C', hex: '#CD212A' },
]

describe('InkColorSelect', () => {
  it('renders placeholder when value is empty', () => {
    render(<InkColorSelect value={[]} onChange={() => {}} stockColors={stockColors} customFee={20} />)
    expect(screen.getByText('Ink colors…')).toBeInTheDocument()
  })

  it('renders chips for each selected color', () => {
    const value = [{ name: 'PANTONE 286 C', custom: false }]
    render(<InkColorSelect value={value} onChange={() => {}} stockColors={stockColors} customFee={20} />)
    expect(screen.getByText('PANTONE 286 C')).toBeInTheDocument()
  })

  it('shows stock palette when opened', async () => {
    const user = userEvent.setup()
    render(<InkColorSelect value={[]} onChange={() => {}} stockColors={stockColors} customFee={20} />)
    await user.click(screen.getByText('Ink colors…'))
    expect(screen.getByText('PANTONE 286 C')).toBeInTheDocument()
    expect(screen.getByText('PANTONE 485 C')).toBeInTheDocument()
  })

  it('calls onChange with added stock color when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<InkColorSelect value={[]} onChange={onChange} stockColors={stockColors} customFee={20} />)
    await user.click(screen.getByText('Ink colors…'))
    await user.click(screen.getByText('PANTONE 286 C'))
    expect(onChange).toHaveBeenCalledWith([{ name: 'PANTONE 286 C', custom: false }])
  })

  it('calls onChange removing a color when × is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const value = [{ name: 'PANTONE 286 C', custom: false }]
    render(<InkColorSelect value={value} onChange={onChange} stockColors={stockColors} customFee={20} />)
    await user.click(screen.getByRole('button', { name: '✕' }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('adds a custom PMS color on Enter and marks it custom: true', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<InkColorSelect value={[]} onChange={onChange} stockColors={stockColors} customFee={20} />)
    await user.click(screen.getByText('Ink colors…'))
    await user.click(screen.getByText(/Custom PMS/i))
    await user.type(screen.getByPlaceholderText('e.g. PMS 286 C'), 'PMS Crimson Red{Enter}')
    expect(onChange).toHaveBeenCalledWith([{ name: 'PMS Crimson Red', custom: true }])
  })

  it('shows fee warning when custom color present and customFee > 0', () => {
    const value = [{ name: 'PMS Custom', custom: true }]
    render(<InkColorSelect value={value} onChange={() => {}} stockColors={stockColors} customFee={20} />)
    expect(screen.getByText('+$20 custom PMS fee')).toBeInTheDocument()
  })

  it('shows no fee warning when customFee is 0', () => {
    const value = [{ name: 'PMS Custom', custom: true }]
    render(<InkColorSelect value={value} onChange={() => {}} stockColors={stockColors} customFee={0} />)
    expect(screen.queryByText(/custom PMS fee/)).not.toBeInTheDocument()
  })

  it('shows no stock palette when stockColors is null', async () => {
    const user = userEvent.setup()
    render(<InkColorSelect value={[]} onChange={() => {}} stockColors={null} customFee={20} />)
    await user.click(screen.getByText('Ink colors…'))
    expect(screen.queryByPlaceholderText('Search colors…')).not.toBeInTheDocument()
    expect(screen.getByText(/Custom PMS/i)).toBeInTheDocument()
  })

  it('filters stock colors by search text', async () => {
    const user = userEvent.setup()
    render(<InkColorSelect value={[]} onChange={() => {}} stockColors={stockColors} customFee={20} />)
    await user.click(screen.getByText('Ink colors…'))
    await user.type(screen.getByPlaceholderText('Search colors…'), '286')
    expect(screen.getByText('PANTONE 286 C')).toBeInTheDocument()
    expect(screen.queryByText('PANTONE 485 C')).not.toBeInTheDocument()
  })
})
