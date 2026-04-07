# Product Type & Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Include youth sizes" checkbox on quote products with a Product Type selector (Adult / Youth / Toddler / Headwear) that shows appropriate size inputs and warns the user when an adult garment style is entered on a Youth or Toddler product.

**Architecture:** All changes are additive — `product_type` is a new field that coexists with the old `youth_sizes` boolean for backwards compatibility. The QuoteForm reads existing `youth_sizes: true` as `product_type: 'youth'` on load, and writes only `product_type` going forward. Style-type mismatch detection is done on the frontend by calling the existing `GET /api/garments/lookup` endpoint and inspecting the returned `skus[].size` values.

**Tech Stack:** React 18, TailwindCSS, Vitest + @testing-library/react (frontend); Express.js, pipelineService.js prompt update, pdfService.js label update (backend).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `client/src/components/QuoteForm.jsx` | Modify | Add `product_type`, TODDLER_SIZES, type selector, size grid switching, style mismatch warning, backwards compat |
| `client/src/components/__tests__/QuoteForm.test.jsx` | Create | Unit tests for QuoteForm helpers and ProductCard behavior |
| `server/services/pipelineService.js` | Modify | Add `product_type` to Claude schema prompt, add `2T, 4T, 6T` size codes |
| `server/services/pdfService.js` | Modify | Replace `youth_sizes` flag display with `product_type` label |

---

## Task 1: QuoteForm — constants, parseSizeBreakdown, serialization, backwards compat

**Files:**
- Modify: `client/src/components/QuoteForm.jsx:1-105`
- Create: `client/src/components/__tests__/QuoteForm.test.jsx`

This task touches only the pure helper functions at the top of QuoteForm — no UI changes yet. It establishes the foundation that all later tasks build on.

- [ ] **Step 1: Write failing tests**

Create `client/src/components/__tests__/QuoteForm.test.jsx`:

```jsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/components/__tests__/QuoteForm.test.jsx 2>&1 | tail -10
```

Expected: FAIL — `TODDLER_SIZES is not exported`, `PRODUCT_TYPES is not exported`, `product_type` missing

- [ ] **Step 3: Update QuoteForm.jsx — constants**

In `client/src/components/QuoteForm.jsx`, replace lines 4–6 (the constants block) with:

```js
// ─── Constants ────────────────────────────────────────────────────────────────
export const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
export const YOUTH_SIZES = ['YXS', 'YS', 'YM', 'YL', 'YXL']
export const TODDLER_SIZES = ['2T', '4T', '6T']
export const PRODUCT_TYPES = ['adult', 'youth', 'toddler', 'headwear']
```

- [ ] **Step 4: Update parseSizeBreakdown to accept toddler sizes**

Replace the existing `parseSizeBreakdown` function (lines 9–22):

```js
export function parseSizeBreakdown(breakdown) {
  const result = {}
  ADULT_SIZES.forEach(s => { result[s] = '' })
  if (!breakdown) return result
  const pairs = String(breakdown).split(/[,;\s]+/).filter(Boolean)
  pairs.forEach(pair => {
    const match = pair.match(/^([A-Z0-9]+)[:\-](\d+)$/i)
    if (match) {
      const key = match[1].toUpperCase()
      if (key in result || YOUTH_SIZES.includes(key) || TODDLER_SIZES.includes(key)) result[key] = match[2]
    }
  })
  return result
}
```

- [ ] **Step 5: Update productToFields — add product_type, backwards compat**

In `productToFields` (currently lines 53–79), add `product_type` derived from `p.product_type` or the old `p.youth_sizes` fallback. Replace that function:

```js
function productToFields(p, expanded = false) {
  const d = p.decoration || {}
  const e = p.edge_cases || {}
  // Backwards compat: old records have youth_sizes: true instead of product_type
  const product_type = p.product_type || (p.youth_sizes ? 'youth' : 'adult')
  return {
    product_type,
    brand_style: p.brand_style || '',
    quantity: p.quantity != null ? String(p.quantity) : '',
    colors: (p.colors || []).join(', '),
    sizes: parseSizeBreakdown(p.size_breakdown),
    decoration_method: d.method || 'SCREEN_PRINT',
    locations: (d.locations?.length
      ? d.locations
      : [{ name: 'Front chest', color_count: 1, print_size: 'STANDARD' }]
    ).map(l => ({
      name: l.name || '',
      color_count: l.color_count ?? l.colorCount ?? 1,
      print_size: l.print_size || l.printSize || 'STANDARD',
    })),
    artwork_status: d.artwork_status || 'UNKNOWN',
    special_inks: (d.special_inks || []).join(', '),
    stitch_count: d.stitch_count != null ? String(d.stitch_count) : '',
    extended_sizes: e.extended_sizes || false,
    dark_garment: e.dark_garment || false,
    individual_names: e.individual_names || false,
    _expanded: expanded,
  }
}
```

Note: `youth_sizes` is removed from this object. It is no longer part of in-memory product state.

- [ ] **Step 6: Update buildEmptyProduct**

Replace `buildEmptyProduct` (currently line 81–83):

```js
export function buildEmptyProduct({ expanded = true } = {}) {
  return productToFields({}, expanded)
}
```

No change needed — it calls `productToFields({})` which now returns `product_type: 'adult'` by default. ✓

- [ ] **Step 7: Update serializeProduct — write product_type, not youth_sizes**

Replace `serializeProduct` (currently lines 85–105):

```js
export function serializeProduct(p) {
  const isHeadwear = p.product_type === 'headwear'
  return {
    product_type: p.product_type || 'adult',
    brand_style: p.brand_style || null,
    quantity: p.quantity ? parseInt(p.quantity, 10) : null,
    colors: p.colors ? p.colors.split(',').map(s => s.trim()).filter(Boolean) : [],
    size_breakdown: isHeadwear ? null : serializeSizeBreakdown(p.sizes),
    decoration: {
      method: p.decoration_method || null,
      locations: p.locations.filter(l => l.name),
      artwork_status: p.artwork_status || 'UNKNOWN',
      special_inks: p.special_inks ? p.special_inks.split(',').map(s => s.trim()).filter(Boolean) : [],
      stitch_count: p.stitch_count ? parseInt(p.stitch_count, 10) : null,
    },
    edge_cases: {
      extended_sizes: p.extended_sizes || false,
      dark_garment: p.dark_garment || false,
      individual_names: p.individual_names || false,
    },
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/components/__tests__/QuoteForm.test.jsx 2>&1 | tail -10
```

Expected: all tests passing

- [ ] **Step 9: Commit**

```bash
git add client/src/components/QuoteForm.jsx client/src/components/__tests__/QuoteForm.test.jsx
git commit -m "feat: add product_type to QuoteForm — constants, parseSizeBreakdown, serialization"
```

---

## Task 2: QuoteForm — Product Type selector + size grid switching

**Files:**
- Modify: `client/src/components/QuoteForm.jsx` — `ProductCard` component (lines ~161–342)

This task replaces the youth checkbox with the type selector and makes the size grid respond to the selected type. No S&S validation yet.

- [ ] **Step 1: Write failing tests**

Add these tests to `client/src/components/__tests__/QuoteForm.test.jsx`. Import dependencies at the top of the file (add these imports):

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import QuoteFormWrapper from '../QuoteForm'
import { buildEmptyProduct } from '../QuoteForm'
```

Then add a `describe` block:

```jsx
describe('ProductCard type selector', () => {
  function renderForm(productType = 'adult') {
    const product = { ...buildEmptyProduct(), product_type: productType }
    const fields = {
      customer_id: null, linked_customer: null, customer_name: '', customer_email: '',
      project_name: '', event_purpose: '', deadline: '', rush: false, returning: false,
      selected_supplier: 'OSP', notes: '', local_pickup: false,
      shipping_address: '', shipping_city: '', shipping_state: '', shipping_zip: '',
      products: [product],
    }
    const setFields = vi.fn()
    render(
      <AuthContext.Provider value={{ user: { name: 'Adam', role: 'admin' }, setUser: vi.fn() }}>
        <MemoryRouter>
          <QuoteFormWrapper fields={fields} setFields={setFields} />
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  it('renders Product Type selector with 4 options', () => {
    renderForm()
    expect(screen.getByLabelText(/product type/i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /adult/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /youth/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /toddler/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /headwear/i })).toBeInTheDocument()
  })

  it('shows adult size inputs (XS-5XL) for adult type', () => {
    renderForm('adult')
    expect(screen.getByTitle('XS size quantity')).toBeInTheDocument()
    expect(screen.queryByTitle('YXS size quantity')).not.toBeInTheDocument()
    expect(screen.queryByTitle('2T size quantity')).not.toBeInTheDocument()
  })

  it('shows youth size inputs (YXS-YXL) for youth type', () => {
    renderForm('youth')
    expect(screen.getByTitle('YXS size quantity')).toBeInTheDocument()
    expect(screen.queryByTitle('XS size quantity')).not.toBeInTheDocument()
  })

  it('shows toddler size inputs (2T, 4T, 6T) for toddler type', () => {
    renderForm('toddler')
    expect(screen.getByTitle('2T size quantity')).toBeInTheDocument()
    expect(screen.getByTitle('4T size quantity')).toBeInTheDocument()
    expect(screen.getByTitle('6T size quantity')).toBeInTheDocument()
    expect(screen.queryByTitle('XS size quantity')).not.toBeInTheDocument()
  })

  it('hides size grid for headwear type', () => {
    renderForm('headwear')
    expect(screen.queryByTitle('XS size quantity')).not.toBeInTheDocument()
    expect(screen.queryByTitle('YXS size quantity')).not.toBeInTheDocument()
    expect(screen.queryByTitle('2T size quantity')).not.toBeInTheDocument()
  })

  it('does not show youth checkbox anymore', () => {
    renderForm('adult')
    expect(screen.queryByLabelText(/include youth sizes/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/components/__tests__/QuoteForm.test.jsx 2>&1 | tail -10
```

Expected: FAIL — selector not found, wrong size inputs shown

- [ ] **Step 3: Replace the ProductCard size section in QuoteForm.jsx**

Find this block in `ProductCard` (currently lines ~217–256) — the entire "Size grid" `<div>` ending with the youth checkbox:

```jsx
{/* Size grid */}
<div className="border-b border-outline-variant/20 pb-3 mt-3">
  ...
  <div className="flex items-center gap-2 mt-2">
    <input type="checkbox" id={`youth-${index}`} ...
    <label htmlFor={`youth-${index}`} ...>Include youth sizes</label>
  </div>
</div>
```

Replace that entire block with:

```jsx
{/* Product type selector */}
<div className="flex flex-col gap-1 border-b border-outline-variant/20 pb-3 mt-3">
  <label htmlFor={`type-${index}`} className="text-xs text-on-surface-variant">Product type</label>
  <select
    id={`type-${index}`}
    value={product.product_type || 'adult'}
    onChange={e => {
      set('product_type', e.target.value)
      set('sizes', {})
    }}
    className="text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-40"
  >
    <option value="adult">Adult</option>
    <option value="youth">Youth</option>
    <option value="toddler">Toddler</option>
    <option value="headwear">Headwear</option>
  </select>
</div>

{/* Size grid — shown for apparel types only */}
{product.product_type !== 'headwear' && (
  <div className="border-b border-outline-variant/20 pb-3 mt-3">
    <p className="text-xs text-on-surface-variant mb-2">Size breakdown <span className="text-on-surface-variant/60">(qty per size)</span></p>
    <div className="flex flex-wrap gap-2">
      {(product.product_type === 'youth' ? YOUTH_SIZES
        : product.product_type === 'toddler' ? TODDLER_SIZES
        : ADULT_SIZES
      ).map(size => (
        <div key={size} className="flex flex-col items-center gap-1">
          <span className={`text-xs font-medium ${['2XL', '3XL', '4XL', '5XL'].includes(size) ? 'text-secondary' : 'text-on-surface-variant'}`}>{size}</span>
          <input
            type="number" min="0"
            title={`${size} size quantity`}
            value={product.sizes[size] || ''}
            onChange={e => set('sizes', { ...product.sizes, [size]: e.target.value })}
            className="w-14 text-sm text-center bg-surface border border-outline-variant rounded px-1 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="0"
          />
        </div>
      ))}
    </div>
  </div>
)}
```

Note: The `onChange` for the type selector calls `set` twice. Since `set` calls `onChange({ ...product, [key]: val })` each time, this works correctly — both updates reflect the same prior `product` state snapshot, so clearing sizes is safe here.

Actually, combine the two `set` calls to avoid stale closure. Replace the `onChange`:

```jsx
onChange={e => onChange({ ...product, product_type: e.target.value, sizes: {} })}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/components/__tests__/QuoteForm.test.jsx 2>&1 | tail -10
```

Expected: all tests passing

- [ ] **Step 5: Run full frontend suite**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run 2>&1 | tail -6
```

Expected: all 55 tests passing

- [ ] **Step 6: Commit**

```bash
git add client/src/components/QuoteForm.jsx client/src/components/__tests__/QuoteForm.test.jsx
git commit -m "feat: replace youth checkbox with Product Type selector in QuoteForm"
```

---

## Task 3: QuoteForm — style/type mismatch warning

**Files:**
- Modify: `client/src/components/QuoteForm.jsx` — `ProductCard` component

When `brand_style` is non-empty and `product_type` is `youth` or `toddler`, call `GET /api/garments/lookup?style=<style>&color=<color>` and check if returned SKU sizes include any youth/toddler sizes. If none do, show a warning.

- [ ] **Step 1: Write failing tests**

Add to `client/src/components/__tests__/QuoteForm.test.jsx`:

```jsx
describe('ProductCard style mismatch warning', () => {
  function renderYouthProduct(fetchMock) {
    global.fetch = fetchMock
    const product = {
      ...buildEmptyProduct(),
      product_type: 'youth',
      brand_style: '3001CVC',
      colors: 'Navy',
    }
    const fields = {
      customer_id: null, linked_customer: null, customer_name: '', customer_email: '',
      project_name: '', event_purpose: '', deadline: '', rush: false, returning: false,
      selected_supplier: 'OSP', notes: '', local_pickup: false,
      shipping_address: '', shipping_city: '', shipping_state: '', shipping_zip: '',
      products: [product],
    }
    render(
      <AuthContext.Provider value={{ user: { name: 'Adam', role: 'admin' }, setUser: vi.fn() }}>
        <MemoryRouter>
          <QuoteFormWrapper fields={fields} setFields={vi.fn()} />
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  afterEach(() => vi.resetAllMocks())

  it('shows warning when S&S lookup returns only adult sizes for a youth product', async () => {
    const adultOnlyResponse = {
      available: true,
      skus: [
        { size: 'Small', price: 4.5, qty: 100 },
        { size: 'Medium', price: 4.5, qty: 100 },
        { size: 'Large', price: 4.5, qty: 100 },
      ],
    }
    renderYouthProduct(vi.fn().mockResolvedValue({ ok: true, json: async () => adultOnlyResponse }))
    await waitFor(() => {
      expect(screen.getByText(/youth sizes require a youth garment style/i)).toBeInTheDocument()
    })
  })

  it('does not show warning when S&S lookup returns youth sizes', async () => {
    const youthResponse = {
      available: true,
      skus: [
        { size: 'Youth Small', price: 3.5, qty: 50 },
        { size: 'Youth Medium', price: 3.5, qty: 50 },
      ],
    }
    renderYouthProduct(vi.fn().mockResolvedValue({ ok: true, json: async () => youthResponse }))
    await waitFor(() => {
      // Wait for any fetch to complete — then assert no warning
      expect(screen.queryByText(/youth sizes require a youth garment style/i)).not.toBeInTheDocument()
    })
  })

  it('does not show warning when S&S lookup fails', async () => {
    renderYouthProduct(vi.fn().mockRejectedValue(new Error('network error')))
    // Brief wait — no warning should appear
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText(/youth sizes require a youth garment style/i)).not.toBeInTheDocument()
  })

  it('shows toddler-specific warning for toddler product with adult style', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        available: true,
        skus: [{ size: 'Small', price: 4.5, qty: 100 }],
      }),
    })
    const product = {
      ...buildEmptyProduct(),
      product_type: 'toddler',
      brand_style: '3001CVC',
      colors: 'Navy',
    }
    const fields = {
      customer_id: null, linked_customer: null, customer_name: '', customer_email: '',
      project_name: '', event_purpose: '', deadline: '', rush: false, returning: false,
      selected_supplier: 'OSP', notes: '', local_pickup: false,
      shipping_address: '', shipping_city: '', shipping_state: '', shipping_zip: '',
      products: [product],
    }
    render(
      <AuthContext.Provider value={{ user: { name: 'Adam', role: 'admin' }, setUser: vi.fn() }}>
        <MemoryRouter>
          <QuoteFormWrapper fields={fields} setFields={vi.fn()} />
        </MemoryRouter>
      </AuthContext.Provider>
    )
    await waitFor(() => {
      expect(screen.getByText(/toddler sizes require a toddler garment style/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/components/__tests__/QuoteForm.test.jsx 2>&1 | tail -10
```

Expected: FAIL — no warning element found

- [ ] **Step 3: Add style mismatch validation to ProductCard**

The validation logic runs in a `useEffect` inside `ProductCard`. First, add `useEffect` to the ProductCard import (it's already imported at the top of the file for the main `QuoteForm` component — verify `import { useEffect } from 'react'` is already there). It is — no import change needed.

Add state and effect inside `ProductCard`, right after the `function toggle()` definition (around line ~169):

```jsx
const [styleWarning, setStyleWarning] = useState(null)
```

This requires `useState` — add it to the React import at line 1:

```js
import { useEffect, useState } from 'react'
```

Then add the effect inside `ProductCard` after `styleWarning` state:

```jsx
// Style/type mismatch validation
useEffect(() => {
  const type = product.product_type
  if (type !== 'youth' && type !== 'toddler') {
    setStyleWarning(null)
    return
  }
  const style = product.brand_style?.trim()
  if (!style) {
    setStyleWarning(null)
    return
  }
  const color = product.colors?.split(',')[0]?.trim() || 'White'
  let cancelled = false
  fetch(`/api/garments/lookup?style=${encodeURIComponent(style)}&color=${encodeURIComponent(color)}`, { credentials: 'include' })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (cancelled || !data) return
      const sizeCodes = (data.skus || []).map(s => (s.size || '').toLowerCase())
      const youthTerms = ['youth', 'yxs', 'ys', 'ym', 'yl', 'yxl']
      const toddlerTerms = ['toddler', '2t', '4t', '6t']
      const hasYouthSizes = sizeCodes.some(s => youthTerms.some(t => s.includes(t)))
      const hasToddlerSizes = sizeCodes.some(s => toddlerTerms.some(t => s.includes(t)))
      if (type === 'youth' && !hasYouthSizes) {
        setStyleWarning('Youth sizes require a youth garment style (e.g. 3001YCVC). Update the style or change the product type.')
      } else if (type === 'toddler' && !hasToddlerSizes) {
        setStyleWarning('Toddler sizes require a toddler garment style. Update the style or change the product type.')
      } else {
        setStyleWarning(null)
      }
    })
    .catch(() => setStyleWarning(null))
  return () => { cancelled = true }
}, [product.product_type, product.brand_style])
```

Then render the warning below the style field. Find the `<Field label="Garment style" ...>` line (around line ~212) and add the warning immediately after the closing `/>` of that `Field`:

```jsx
<Field label="Garment style" value={product.brand_style} onChange={v => set('brand_style', v)} placeholder="e.g. 3001CVC, Gildan 5000" />
{styleWarning && (
  <div className="col-span-2 bg-error-container text-on-error-container text-xs rounded px-3 py-2">
    {styleWarning}
  </div>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run src/components/__tests__/QuoteForm.test.jsx 2>&1 | tail -10
```

Expected: all tests passing

- [ ] **Step 5: Run full frontend suite**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run 2>&1 | tail -6
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add client/src/components/QuoteForm.jsx client/src/components/__tests__/QuoteForm.test.jsx
git commit -m "feat: add style/type mismatch warning for youth and toddler products"
```

---

## Task 4: pipelineService.js — update Claude prompt

**Files:**
- Modify: `server/services/pipelineService.js:88–114`

Update the Claude intake prompt schema to use `product_type` instead of `youth_sizes`, and add `2T, 4T, 6T` to the size code list.

- [ ] **Step 1: Update the prompt schema in pipelineService.js**

In `server/services/pipelineService.js`, find the Claude prompt (around lines 88–114). Replace the product schema section:

Current (lines 90–114):
```js
  "products": [
    {
      "brand_style": null,
      "quantity": null,
      "size_breakdown": null,
      "colors": [],
      "youth_sizes": false,
      "decoration": { ... },
      "edge_cases": { ... }
    }
  ],
  ...
  For size_breakdown: extract size quantities (e.g. "10 smalls, 20 mediums" → "S:10, M:20"). Codes: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, YXS, YS, YM, YL, YXL.`,
```

Replace with:
```js
  "products": [
    {
      "brand_style": null,
      "quantity": null,
      "size_breakdown": null,
      "colors": [],
      "product_type": "adult",
      "decoration": {
        "method": null,
        "locations": [],
        "artwork_status": "UNKNOWN",
        "special_inks": [],
        "stitch_count": null
      },
      "edge_cases": { "extended_sizes": false, "dark_garment": null, "individual_names": false, "multiple_garment_colors": false, "garment_color_count": 1, "shipping_destination": null }
    }
  ],
  "flags": [],
  "status": "READY_FOR_PRICING",
  "missing_fields": []
}
If the inquiry mentions multiple garment styles or groups, include one object per product in the "products" array.
For decoration.method use: SCREEN_PRINT, DTF, DTG, or EMBROIDERY
For decoration.locations[].print_size use: STANDARD, OVERSIZED, or JUMBO
For product_type use: adult, youth, toddler, headwear. Infer from context (e.g. youth sizes → youth, hat/cap/beanie → headwear).
For size_breakdown: extract size quantities (e.g. "10 smalls, 20 mediums" → "S:10, M:20"). Codes: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, YXS, YS, YM, YL, YXL, 2T, 4T, 6T.`,
```

- [ ] **Step 2: Verify the server starts without errors**

```bash
node -e "require('./server/services/pipelineService'); console.log('ok')" 2>&1
```

Run from the project root (`c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App`).

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add server/services/pipelineService.js
git commit -m "feat: update pipeline Claude prompt for product_type and toddler sizes"
```

---

## Task 5: pdfService.js — product type label

**Files:**
- Modify: `server/services/pdfService.js:499`

Replace the `youth_sizes` flag display with a product type label.

- [ ] **Step 1: Find and replace the youth_sizes display in pdfService.js**

In `server/services/pdfService.js`, find line 499:

```js
if (ec.youth_sizes || prod.youth_sizes) decRows.push(['Youth Sizes', 'Yes — youth sizing included'])
```

Replace with:

```js
const prodType = prod.product_type || (prod.youth_sizes ? 'youth' : null)
if (prodType && prodType !== 'adult') {
  const typeLabel = prodType === 'youth' ? 'Youth' : prodType === 'toddler' ? 'Toddler' : prodType === 'headwear' ? 'Headwear' : prodType
  decRows.push(['Product Type', typeLabel])
}
```

- [ ] **Step 2: Verify the server starts without errors**

```bash
node -e "require('./server/services/pdfService'); console.log('ok')" 2>&1
```

Expected: `ok`

- [ ] **Step 3: Run the full frontend suite one final time**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npx --prefix client vitest run 2>&1 | tail -6
```

Expected: all tests passing

- [ ] **Step 4: Commit**

```bash
git add server/services/pdfService.js
git commit -m "feat: replace youth_sizes flag with product_type label in PDF"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `TODDLER_SIZES = ['2T', '4T', '6T']` and `PRODUCT_TYPES` exported | Task 1 |
| `parseSizeBreakdown` accepts `2T, 4T, 6T` | Task 1 |
| `product_type` field on product, default `'adult'` | Task 1 |
| `youth_sizes: true` → `product_type: 'youth'` backwards compat | Task 1 |
| `serializeProduct` writes `product_type`, not `youth_sizes` | Task 1 |
| Headwear: `size_breakdown: null` in serialized output | Task 1 |
| Product Type selector with 4 options in ProductCard | Task 2 |
| Changing type clears all size quantities | Task 2 |
| Adult size inputs (XS–5XL) for adult type | Task 2 |
| Youth size inputs (YXS–YXL) for youth type | Task 2 |
| Toddler size inputs (2T, 4T, 6T) for toddler type | Task 2 |
| No size grid for headwear | Task 2 |
| "Include youth sizes" checkbox removed | Task 2 |
| Warning for adult-style on youth product | Task 3 |
| Warning for adult-style on toddler product | Task 3 |
| No warning when S&S returns matching sizes | Task 3 |
| No warning when S&S lookup fails | Task 3 |
| Claude prompt uses `product_type`, adds `2T, 4T, 6T` | Task 4 |
| PDF shows product type label (Youth, Toddler, Headwear) | Task 5 |
| PDF shows nothing extra for Adult (default) | Task 5 |
