import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ADULT_SIZES,
  YOUTH_SIZES,
  TODDLER_SIZES,
  PRODUCT_TYPES,
  parseSizeBreakdown,
  serializeSizeBreakdown,
  buildEmptyProduct,
  serializeProduct,
  buildEditFields,
} from '../QuoteForm'
import QuoteForm from '../QuoteForm'

describe('constants', () => {
  it('TODDLER_SIZES contains 2T, 4T, 6T', () => {
    expect(TODDLER_SIZES).toEqual(['2T', '4T', '6T'])
  })

  it('PRODUCT_TYPES contains all four types', () => {
    expect(PRODUCT_TYPES).toEqual(['adult', 'youth', 'toddler', 'headwear'])
  })
})

describe('parseSizeBreakdown', () => {
  it('parses adult sizes', () => {
    const result = parseSizeBreakdown('S:10, M:20, L:15')
    expect(result['S']).toBe('10')
    expect(result['M']).toBe('20')
    expect(result['L']).toBe('15')
  })

  it('parses youth sizes', () => {
    const result = parseSizeBreakdown('YS:5, YM:10, YL:8')
    expect(result['YS']).toBe('5')
    expect(result['YM']).toBe('10')
    expect(result['YL']).toBe('8')
  })

  it('parses toddler sizes 2T, 4T, 6T', () => {
    const result = parseSizeBreakdown('2T:6, 4T:8, 6T:4')
    expect(result['2T']).toBe('6')
    expect(result['4T']).toBe('8')
    expect(result['6T']).toBe('4')
  })

  it('returns empty strings for unprovided sizes', () => {
    const result = parseSizeBreakdown(null)
    expect(result['S']).toBe('')
    expect(result['XL']).toBe('')
  })
})

describe('buildEmptyProduct', () => {
  it('defaults product_type to adult', () => {
    const p = buildEmptyProduct()
    expect(p.product_type).toBe('adult')
  })
})

describe('serializeProduct', () => {
  it('writes product_type and does not write youth_sizes', () => {
    const p = buildEmptyProduct()
    p.product_type = 'youth'
    const serialized = serializeProduct(p)
    expect(serialized.product_type).toBe('youth')
    expect(serialized.youth_sizes).toBeUndefined()
  })

  it('serializes headwear with null size_breakdown', () => {
    const p = buildEmptyProduct()
    p.product_type = 'headwear'
    p.sizes = {}
    const serialized = serializeProduct(p)
    expect(serialized.product_type).toBe('headwear')
    expect(serialized.size_breakdown).toBeNull()
  })
})

describe('buildEditFields backwards compat', () => {
  it('maps youth_sizes: true to product_type: youth', () => {
    const q = {
      intake_record: {
        products: [{ brand_style: '3001CVC', youth_sizes: true, quantity: 24, colors: [], decoration: {}, edge_cases: {} }],
      }
    }
    const fields = buildEditFields(q)
    expect(fields.products[0].product_type).toBe('youth')
  })

  it('defaults to adult when no product_type or youth_sizes', () => {
    const q = {
      intake_record: {
        products: [{ brand_style: '3001CVC', quantity: 24, colors: [], decoration: {}, edge_cases: {} }],
      }
    }
    const fields = buildEditFields(q)
    expect(fields.products[0].product_type).toBe('adult')
  })
})

// ─── ProductCard UI tests ─────────────────────────────────────────────────────
describe('ProductCard UI', () => {
  // Mock fetch so CustomerPicker doesn't blow up
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  })
  afterEach(() => vi.resetAllMocks())

  function renderWithProduct(overrides = {}) {
    const product = { ...buildEmptyProduct(), ...overrides }
    const fields = {
      customer_id: null,
      linked_customer: null,
      customer_name: '',
      customer_email: '',
      project_name: '',
      event_purpose: '',
      deadline: '',
      rush: false,
      returning: false,
      selected_supplier: 'OSP',
      notes: '',
      local_pickup: false,
      shipping_address: '',
      shipping_city: '',
      shipping_state: '',
      shipping_zip: '',
      products: [product],
    }
    const setFields = vi.fn()
    return render(<QuoteForm fields={fields} setFields={setFields} />)
  }

  it('renders a product type selector with 4 options', () => {
    renderWithProduct()
    const select = screen.getByLabelText(/product type/i)
    expect(select).toBeInTheDocument()
    const options = within(select).getAllByRole('option')
    expect(options).toHaveLength(4)
    const optionTexts = options.map(o => o.textContent)
    expect(optionTexts).toContain('Adult')
    expect(optionTexts).toContain('Youth')
    expect(optionTexts).toContain('Toddler')
    expect(optionTexts).toContain('Headwear')
  })

  it('shows adult size inputs by default', () => {
    renderWithProduct()
    expect(screen.getByTitle('XS size quantity')).toBeInTheDocument()
    expect(screen.queryByTitle('YS size quantity')).not.toBeInTheDocument()
  })

  it('shows youth size inputs when product_type is youth', () => {
    renderWithProduct({ product_type: 'youth' })
    expect(screen.getByTitle('YS size quantity')).toBeInTheDocument()
    expect(screen.queryByTitle('XS size quantity')).not.toBeInTheDocument()
  })

  it('shows toddler size inputs when product_type is toddler', () => {
    renderWithProduct({ product_type: 'toddler' })
    expect(screen.getByTitle('2T size quantity')).toBeInTheDocument()
    expect(screen.queryByTitle('XS size quantity')).not.toBeInTheDocument()
  })

  it('hides size grid entirely for headwear', () => {
    renderWithProduct({ product_type: 'headwear' })
    expect(screen.queryByTitle('XS size quantity')).not.toBeInTheDocument()
    expect(screen.queryByTitle('YS size quantity')).not.toBeInTheDocument()
    expect(screen.queryByTitle('2T size quantity')).not.toBeInTheDocument()
  })

  it('clears sizes when product type changes', async () => {
    const user = userEvent.setup()
    const fields = {
      customer_id: null,
      linked_customer: null,
      customer_name: '',
      customer_email: '',
      project_name: '',
      event_purpose: '',
      deadline: '',
      rush: false,
      returning: false,
      selected_supplier: 'OSP',
      notes: '',
      local_pickup: false,
      shipping_address: '',
      shipping_city: '',
      shipping_state: '',
      shipping_zip: '',
      products: [{ ...buildEmptyProduct(), product_type: 'adult', sizes: { XS: '5', S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '', '4XL': '', '5XL': '' } }],
    }
    let currentFields = fields
    const setFields = vi.fn(updater => {
      currentFields = typeof updater === 'function' ? updater(currentFields) : updater
    })
    const { rerender } = render(<QuoteForm fields={currentFields} setFields={setFields} />)

    // Change to youth
    const select = screen.getByLabelText(/product type/i)
    await user.selectOptions(select, 'youth')

    // setFields should have been called; get updated product
    expect(setFields).toHaveBeenCalled()
    const lastCall = setFields.mock.calls[setFields.mock.calls.length - 1][0]
    const updatedFields = typeof lastCall === 'function' ? lastCall(currentFields) : lastCall
    expect(updatedFields.products[0].product_type).toBe('youth')
    expect(updatedFields.products[0].sizes).toEqual({})
  })

  it('does not render the old "Include youth sizes" checkbox', () => {
    renderWithProduct()
    expect(screen.queryByLabelText(/include youth sizes/i)).not.toBeInTheDocument()
  })
})

// ─── ProductCard style mismatch warning ──────────────────────────────────────
describe('ProductCard style mismatch warning', () => {
  function renderWithProduct(overrides = {}) {
    const product = { ...buildEmptyProduct(), ...overrides }
    const fields = {
      customer_id: null,
      linked_customer: null,
      customer_name: '',
      customer_email: '',
      project_name: '',
      event_purpose: '',
      deadline: '',
      rush: false,
      returning: false,
      selected_supplier: 'OSP',
      notes: '',
      local_pickup: false,
      shipping_address: '',
      shipping_city: '',
      shipping_state: '',
      shipping_zip: '',
      products: [product],
    }
    const setFields = vi.fn()
    return render(<QuoteForm fields={fields} setFields={setFields} />)
  }

  afterEach(() => vi.restoreAllMocks())

  it('shows youth warning when S&S returns only adult SKUs for youth product', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skus: [{ size: 'S' }, { size: 'M' }, { size: 'L' }] }),
    })
    renderWithProduct({ product_type: 'youth', brand_style: '3001CVC' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Youth sizes require a youth garment style')
  })

  it('shows no warning when S&S returns youth SKUs for youth product', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skus: [{ size: 'YS' }, { size: 'YM' }] }),
    })
    renderWithProduct({ product_type: 'youth', brand_style: '3001YCVC' })
    // Wait a tick for effects to resolve, then confirm no alert
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows toddler warning when S&S returns only adult SKUs for toddler product', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skus: [{ size: 'S' }, { size: 'M' }] }),
    })
    renderWithProduct({ product_type: 'toddler', brand_style: '3001CVC' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Toddler sizes require a toddler garment style')
  })

  it('shows no warning when lookup fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'))
    renderWithProduct({ product_type: 'youth', brand_style: '3001CVC' })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows no warning for adult product type even with brand_style set', async () => {
    // fetch should not be called at all for adult, but mock it in case
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skus: [{ size: 'S' }] }),
    })
    renderWithProduct({ product_type: 'adult', brand_style: '3001CVC' })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
