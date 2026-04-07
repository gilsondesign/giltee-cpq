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
