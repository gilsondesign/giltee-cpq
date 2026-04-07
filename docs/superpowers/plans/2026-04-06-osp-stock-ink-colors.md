# OSP Stock Ink Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-location ink color selection to the quote form, waiving the custom PMS fee when OSP stock Pantone colors are chosen.

**Architecture:** A new `InkColorSelect` component handles multi-select with swatches on each print location row. The `ink_colors` array is stored inside each location object in `intake_record` (JSONB — no schema migration). `pipelineService` passes `inkColors` to `pricingService`, which counts `{ custom: true }` entries across all locations and multiplies by the manufacturer's `customPmsInk` fee.

**Tech Stack:** React + Tailwind (client), Node/Express + Jest (server), Vitest + Testing Library (client tests)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `client/src/constants/ospStockColors.js` | 81 OSP stock Pantone colors `[{name, hex}]` |
| Create | `client/src/components/InkColorSelect.jsx` | Searchable multi-select with swatches + custom PMS entry |
| Create | `client/src/components/__tests__/InkColorSelect.test.jsx` | Unit tests for InkColorSelect |
| Modify | `client/src/components/QuoteForm.jsx` | Add `ink_colors` to location state; render InkColorSelect per location |
| Modify | `client/src/pages/ViewQuote.jsx` | Show ink color names in read-only location display |
| Modify | `server/services/pipelineService.js` | Pass `inkColors` in location mapping to pricingService |
| Modify | `server/services/pricingService.js` | Calculate custom PMS fee per manufacturer |
| Modify | `server/__tests__/pricingService.test.js` | Add custom PMS fee tests |

---

## Task 1: Create stock color constants

**Files:**
- Create: `client/src/constants/ospStockColors.js`

- [ ] **Step 1: Create the constants file**

```js
// client/src/constants/ospStockColors.js
// Extracted from osp-stock-colors.ase — OSP's official stock Pantone palette.
// Hex values are screen approximations for UI display only.
export const OSP_STOCK_COLORS = [
  { name: 'PANTONE Warm Red C',     hex: '#F9423A' },
  { name: 'PANTONE 485 C',          hex: '#CD212A' },
  { name: 'PANTONE 185 C',          hex: '#E4002B' },
  { name: 'PANTONE 199 C',          hex: '#CE0037' },
  { name: 'PANTONE 200 C',          hex: '#BA0C2F' },
  { name: 'PANTONE 201 C',          hex: '#9D2235' },
  { name: 'PANTONE 202 C',          hex: '#862633' },
  { name: 'PANTONE 221 C',          hex: '#D2006E' },
  { name: 'PANTONE 222 C',          hex: '#A50050' },
  { name: 'PANTONE 1675 C',         hex: '#9E4A06' },
  { name: 'PANTONE 159 C',          hex: '#BE5400' },
  { name: 'PANTONE 1665 C',         hex: '#E35205' },
  { name: 'PANTONE 172 C',          hex: '#FA4616' },
  { name: 'PANTONE Orange 021 C',   hex: '#FE5000' },
  { name: 'PANTONE 151 C',          hex: '#FF8200' },
  { name: 'PANTONE 144 C',          hex: '#ED7D00' },
  { name: 'PANTONE 1485 C',         hex: '#FF8F1C' },
  { name: 'PANTONE 131 C',          hex: '#C69214' },
  { name: 'PANTONE 110 C',          hex: '#B58500' },
  { name: 'PANTONE 1375 C',         hex: '#FF9E1B' },
  { name: 'PANTONE 143 C',          hex: '#EFB758' },
  { name: 'PANTONE 1235 C',         hex: '#FFB81C' },
  { name: 'PANTONE 123 C',          hex: '#FFC72C' },
  { name: 'PANTONE 109 C',          hex: '#FFD100' },
  { name: 'PANTONE Yellow C',       hex: '#FEDD00' },
  { name: 'PANTONE 100 C',          hex: '#F2E86D' },
  { name: 'PANTONE 376 C',          hex: '#84BD00' },
  { name: 'PANTONE 368 C',          hex: '#78BE20' },
  { name: 'PANTONE 354 C',          hex: '#00AE42' },
  { name: 'PANTONE 362 C',          hex: '#4C9A2A' },
  { name: 'PANTONE 355 C',          hex: '#007A33' },
  { name: 'PANTONE 356 C',          hex: '#006B3F' },
  { name: 'PANTONE 357 C',          hex: '#285C4D' },
  { name: 'PANTONE 560 C',          hex: '#3D5B51' },
  { name: 'PANTONE 377 C',          hex: '#6B7C38' },
  { name: 'PANTONE 7748 C',         hex: '#8A7B4F' },
  { name: 'PANTONE 364 C',          hex: '#4B7A25' },
  { name: 'PANTONE 574 C',          hex: '#7A8C6E' },
  { name: 'PANTONE 328 C',          hex: '#007A6E' },
  { name: 'PANTONE 326 C',          hex: '#00B398' },
  { name: 'PANTONE 319 C',          hex: '#00B2A9' },
  { name: 'PANTONE 311 C',          hex: '#00A3D9' },
  { name: 'PANTONE 306 C',          hex: '#00B5E2' },
  { name: 'PANTONE 298 C',          hex: '#41B6E6' },
  { name: 'PANTONE 292 C',          hex: '#69B3E7' },
  { name: 'PANTONE 542 C',          hex: '#6CACE4' },
  { name: 'PANTONE 646 C',          hex: '#7BA7BC' },
  { name: 'PANTONE Process Blue C', hex: '#0085CA' },
  { name: 'PANTONE 285 C',          hex: '#0071CE' },
  { name: 'PANTONE 300 C',          hex: '#0057B8' },
  { name: 'PANTONE 286 C',          hex: '#003DA5' },
  { name: 'PANTONE Reflex Blue C',  hex: '#001489' },
  { name: 'PANTONE 281 C',          hex: '#00337F' },
  { name: 'PANTONE 296 C',          hex: '#002D62' },
  { name: 'PANTONE Violet C',       hex: '#440099' },
  { name: 'PANTONE 269 C',          hex: '#5C2D91' },
  { name: 'PANTONE 255 C',          hex: '#6D2077' },
  { name: 'PANTONE 265 C',          hex: '#8246AF' },
  { name: 'PANTONE 213 C',          hex: '#E5007E' },
  { name: 'PANTONE 210 C',          hex: '#F4A0B5' },
  { name: 'PANTONE 176 C',          hex: '#FFA3B0' },
  { name: 'PANTONE 162 C',          hex: '#FFAF8A' },
  { name: 'PANTONE 712 C',          hex: '#F5C6A0' },
  { name: 'PANTONE 728 C',          hex: '#C8A882' },
  { name: 'PANTONE 7508 C',         hex: '#D4B483' },
  { name: 'PANTONE 7510 C',         hex: '#C49A6C' },
  { name: 'PANTONE 7557 C',         hex: '#9E7B3C' },
  { name: 'PANTONE 160 C',          hex: '#A05C34' },
  { name: 'PANTONE 1395 C',         hex: '#8C5A2E' },
  { name: 'PANTONE 1685 C',         hex: '#7A3B2E' },
  { name: 'PANTONE 464 C',          hex: '#7A5C38' },
  { name: 'PANTONE 462 C',          hex: '#5C4A2A' },
  { name: 'PANTONE 161 C',          hex: '#6B3F26' },
  { name: 'PANTONE 4625 C',         hex: '#4A2B20' },
  { name: 'PANTONE 427 C',          hex: '#D0D3D4' },
  { name: 'PANTONE 428 C',          hex: '#C1C6C8' },
  { name: 'PANTONE 429 C',          hex: '#A2AAAD' },
  { name: 'PANTONE 430 C',          hex: '#7F8C8D' },
  { name: 'PANTONE 431 C',          hex: '#5B6770' },
  { name: 'PANTONE 432 C',          hex: '#404B5A' },
  { name: 'PANTONE 426 C',          hex: '#2C2A29' },
]
```

- [ ] **Step 2: Commit**

```bash
git add client/src/constants/ospStockColors.js
git commit -m "feat: add OSP stock Pantone color constants"
```

---

## Task 2: Build InkColorSelect component (TDD)

**Files:**
- Create: `client/src/components/__tests__/InkColorSelect.test.jsx`
- Create: `client/src/components/InkColorSelect.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run client/src/components/__tests__/InkColorSelect.test.jsx
```

Expected: `FAIL` — `Cannot find module '../InkColorSelect'`

- [ ] **Step 3: Create the component**

```jsx
// client/src/components/InkColorSelect.jsx
import { useState, useRef, useEffect } from 'react'

export default function InkColorSelect({ value = [], onChange, stockColors = null, customFee = 0 }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCustomEntry, setShowCustomEntry] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setShowCustomEntry(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = (stockColors || []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggleStock(color) {
    const idx = value.findIndex(v => v.name === color.name)
    if (idx >= 0) onChange(value.filter((_, i) => i !== idx))
    else onChange([...value, { name: color.name, custom: false }])
  }

  function addCustom() {
    const name = customInput.trim()
    if (!name) return
    onChange([...value, { name, custom: true }])
    setCustomInput('')
    setShowCustomEntry(false)
  }

  function removeColor(i) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  const customCount = value.filter(v => v.custom).length
  const hasCustom = customCount > 0

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        className="flex flex-wrap gap-1 items-center min-h-[32px] text-sm bg-surface border border-outline-variant rounded px-2 py-1 cursor-pointer hover:border-primary/50"
      >
        {value.length === 0 && (
          <span className="text-on-surface-variant text-xs">Ink colors…</span>
        )}
        {value.map((c, i) => {
          const stock = (stockColors || []).find(s => s.name === c.name)
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${
                c.custom
                  ? 'border-amber-600/60 text-amber-400'
                  : 'border-outline-variant text-on-surface'
              }`}
            >
              {stock && (
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-white/10"
                  style={{ background: stock.hex }}
                />
              )}
              {c.name}
              <button
                type="button"
                aria-label="✕"
                onClick={e => { e.stopPropagation(); removeColor(i) }}
                className="text-on-surface-variant hover:text-error ml-0.5 leading-none"
              >
                ✕
              </button>
            </span>
          )
        })}
        <span className="ml-auto text-on-surface-variant text-[10px] pl-1">▾</span>
      </div>

      {/* Fee warning */}
      {hasCustom && customFee > 0 && (
        <p className="text-xs text-amber-400 mt-0.5">
          +${customFee * customCount} custom PMS fee
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-surface border border-outline-variant rounded shadow-xl">
          {stockColors && stockColors.length > 0 && (
            <>
              <div className="p-2 border-b border-outline-variant/30">
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search colors…"
                  className="w-full text-xs bg-surface border border-outline-variant rounded px-2 py-1 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <p className="px-3 pt-1.5 pb-0.5 text-[10px] text-on-surface-variant uppercase tracking-wide">
                  Stock — no upcharge
                </p>
                {filtered.map(c => {
                  const selected = value.some(v => v.name === c.name)
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => toggleStock(c)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-container ${
                        selected ? 'text-primary' : 'text-on-surface'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-sm border border-white/10 flex-shrink-0"
                        style={{ background: c.hex }}
                      />
                      <span className="flex-1">{c.name}</span>
                      {selected && <span className="text-primary text-[10px]">✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="border-t border-outline-variant/30 p-2">
            {!showCustomEntry ? (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowCustomEntry(true) }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-amber-400 hover:bg-surface-container rounded"
              >
                <span className="w-4 h-4 border border-dashed border-amber-600 rounded-sm flex-shrink-0 flex items-center justify-center text-[8px]">
                  ✎
                </span>
                Custom PMS…{customFee > 0 ? ` (+$${customFee})` : ''}
              </button>
            ) : (
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustom()}
                  placeholder="e.g. PMS 286 C"
                  className="flex-1 text-xs bg-surface border border-amber-600/60 rounded px-2 py-1 text-amber-400 placeholder:text-amber-900 focus:outline-none"
                  onClick={e => e.stopPropagation()}
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="text-xs text-amber-400 px-1.5 hover:text-amber-300"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run client/src/components/__tests__/InkColorSelect.test.jsx
```

Expected: all tests `PASS`

- [ ] **Step 5: Commit**

```bash
git add client/src/components/InkColorSelect.jsx client/src/components/__tests__/InkColorSelect.test.jsx
git commit -m "feat: add InkColorSelect component with stock Pantone palette"
```

---

## Task 3: Update QuoteForm to include ink colors in location rows

**Files:**
- Modify: `client/src/components/QuoteForm.jsx`

The changes are in three spots: (1) `productToFields` normalizes `ink_colors`, (2) the default new-location object includes `ink_colors: []`, (3) the location row renders `InkColorSelect`.

- [ ] **Step 1: Add imports at the top of QuoteForm.jsx**

After the existing imports (around line 1-5), add:

```jsx
import InkColorSelect from './InkColorSelect'
import { OSP_STOCK_COLORS } from '../constants/ospStockColors'
```

Also add this constant just inside or just before the `productToFields` function (around line 52):

```js
// Fee per custom PMS color, keyed by manufacturer. Informational — server-side config is authoritative.
const CUSTOM_PMS_FEE = { OSP: 20, REDWALL: 0 }
```

- [ ] **Step 2: Update `productToFields` to normalize `ink_colors` (line ~66-70)**

Replace the `locations` map block:

```js
// OLD (lines 66-70):
locations: (d.locations?.length
  ? d.locations
  : [{ name: 'Front chest', color_count: 1, print_size: 'STANDARD' }]
).map(l => ({
  name: l.name || '',
  color_count: l.color_count ?? l.colorCount ?? 1,
  print_size: l.print_size || l.printSize || 'STANDARD',
})),
```

```js
// NEW:
locations: (d.locations?.length
  ? d.locations
  : [{ name: 'Front chest', color_count: 1, print_size: 'STANDARD' }]
).map(l => ({
  name: l.name || '',
  color_count: l.color_count ?? l.colorCount ?? 1,
  print_size: l.print_size || l.printSize || 'STANDARD',
  ink_colors: l.ink_colors || l.inkColors || [],
})),
```

- [ ] **Step 3: Update the "Add location" default object (line ~330)**

Replace:
```js
// OLD (line ~330):
onClick={() => set('locations', [...product.locations, { name: '', color_count: 1, print_size: 'STANDARD' }])}
```

```js
// NEW:
onClick={() => set('locations', [...product.locations, { name: '', color_count: 1, print_size: 'STANDARD', ink_colors: [] }])}
```

- [ ] **Step 4: Add `InkColorSelect` to the location row (lines ~298-327)**

Inside the location row `div` (after the print size `<select>` and before the delete button), insert:

```jsx
// After the </select> closing tag for print_size and before the delete button:
<InkColorSelect
  value={loc.ink_colors || []}
  onChange={inkColors => set('locations', product.locations.map((l, j) => j === li ? { ...l, ink_colors: inkColors } : l))}
  stockColors={fields.selected_supplier === 'OSP' ? OSP_STOCK_COLORS : null}
  customFee={CUSTOM_PMS_FEE[fields.selected_supplier] ?? 0}
/>
```

The full updated location row block (lines ~298-327) should look like:

```jsx
{product.locations.map((loc, li) => (
  <div key={li} className="flex gap-2 items-center flex-wrap bg-surface rounded px-3 py-2">
    <input
      value={loc.name}
      onChange={e => set('locations', product.locations.map((l, j) => j === li ? { ...l, name: e.target.value } : l))}
      placeholder="Location (e.g. Front chest)"
      className="flex-1 min-w-[120px] text-sm bg-transparent text-on-surface placeholder:text-on-surface-variant focus:outline-none"
    />
    <input
      type="number" min="1" max="12"
      value={loc.color_count}
      onChange={e => set('locations', product.locations.map((l, j) => j === li ? { ...l, color_count: parseInt(e.target.value) || 1 } : l))}
      className="w-14 text-sm text-center bg-transparent border border-outline-variant rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
      title="Ink colors"
    />
    <span className="text-xs text-on-surface-variant">colors</span>
    <select
      value={loc.print_size}
      onChange={e => set('locations', product.locations.map((l, j) => j === li ? { ...l, print_size: e.target.value } : l))}
      className="text-xs bg-surface border border-outline-variant rounded px-1 py-0.5 text-on-surface focus:outline-none"
    >
      <option value="STANDARD">Standard</option>
      <option value="OVERSIZED">Oversized</option>
      <option value="JUMBO">Jumbo</option>
    </select>
    <div className="flex-1 min-w-[160px]">
      <InkColorSelect
        value={loc.ink_colors || []}
        onChange={inkColors => set('locations', product.locations.map((l, j) => j === li ? { ...l, ink_colors: inkColors } : l))}
        stockColors={fields.selected_supplier === 'OSP' ? OSP_STOCK_COLORS : null}
        customFee={CUSTOM_PMS_FEE[fields.selected_supplier] ?? 0}
      />
    </div>
    {product.locations.length > 1 && (
      <button type="button" onClick={() => set('locations', product.locations.filter((_, j) => j !== li))} className="text-on-surface-variant hover:text-error text-xs">✕</button>
    )}
  </div>
))}
```

Note: `fields` is accessible in the product component because it is passed from `QuoteForm` as a prop. Verify `fields` is in scope where this renders — it is passed as `{ fields, setFields }` to `QuoteForm` and used inside `ProductCard`. If `fields` is not in scope inside `ProductCard`, pass `selectedSupplier={fields.selected_supplier}` as a prop to `ProductCard` and use that instead.

- [ ] **Step 5: Verify `ink_colors` is included in serialized output**

Open `client/src/components/__tests__/App.test.jsx` — or the existing QuoteForm / CreateQuote test if one covers form serialization — and verify `serializeProduct` passes `ink_colors` through. The existing `serializeProduct` at line 94 does `p.locations.filter(l => l.name)` which passes location objects as-is, so `ink_colors` is automatically included. Confirm by checking there is no explicit location field whitelist in `serializeProduct` that would drop it.

- [ ] **Step 6: Run client tests**

```bash
npx vitest run
```

Expected: all existing tests pass. Fix any failures before committing.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/QuoteForm.jsx
git commit -m "feat: add ink color selection to quote form location rows"
```

---

## Task 4: Update ViewQuote read-only location display

**Files:**
- Modify: `client/src/pages/ViewQuote.jsx`

The read-only location display is on line 374. It currently renders as a comma-separated string. Update it to include ink color names.

- [ ] **Step 1: Replace the locations InfoRow (line 374)**

Replace:
```jsx
// OLD (line 374):
<InfoRow label="Locations" value={(dec.locations || []).map(l => `${l.name} (${l.color_count || l.colorCount || '?'}c)`).join(', ')} />
```

```jsx
// NEW:
<InfoRow
  label="Locations"
  value={(dec.locations || []).map((l, i) => {
    const inkNames = (l.ink_colors || l.inkColors || [])
    const stockNames = inkNames.filter(c => !c.custom).map(c => c.name)
    const customNames = inkNames.filter(c => c.custom).map(c => c.name)
    const colorStr = [
      ...stockNames,
      ...customNames.map(n => `${n} (custom)`),
    ].join(', ')
    return (
      <span key={i}>
        {i > 0 && <span className="text-on-surface-variant">, </span>}
        {l.name} ({l.color_count || l.colorCount || '?'}c{colorStr ? `: ${colorStr}` : ''})
      </span>
    )
  })}
/>
```

- [ ] **Step 2: Run client tests**

```bash
npx vitest run client/src/pages/__tests__/ViewQuote.test.jsx
```

Expected: existing tests pass. If the ViewQuote test renders a quote with locations, verify the test still passes with the new render output. The `InfoRow` accepts JSX as `value`, so the change is additive — existing test data without `ink_colors` will just show `(2c)` with no color names, which is correct.

- [ ] **Step 3: Run all client tests**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ViewQuote.jsx
git commit -m "feat: show ink color names in quote read-only location display"
```

---

## Task 5: Update pipelineService to pass inkColors to pricingService

**Files:**
- Modify: `server/services/pipelineService.js`

The location mapping is at lines 157-160. Add `inkColors` to the mapped object.

- [ ] **Step 1: Update the location mapping (lines 157-160)**

Replace:
```js
// OLD (lines 157-160):
const locations = (prod.decoration?.locations || []).map(loc => ({
  colorCount: loc.color_count || loc.colorCount || 1,
  printSize: loc.print_size || loc.printSize || 'STANDARD',
}))
```

```js
// NEW:
const locations = (prod.decoration?.locations || []).map(loc => ({
  colorCount: loc.color_count || loc.colorCount || 1,
  printSize: loc.print_size || loc.printSize || 'STANDARD',
  inkColors: loc.ink_colors || loc.inkColors || [],
}))
```

- [ ] **Step 2: Run server tests**

```bash
npx jest server/__tests__/pipelineService.test.js
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/services/pipelineService.js
git commit -m "feat: pass inkColors through pipeline to pricing service"
```

---

## Task 6: Update pricingService to calculate custom PMS fee

**Files:**
- Modify: `server/services/pricingService.js`
- Modify: `server/__tests__/pricingService.test.js`

The `customPmsInk` fee is defined in config (line 79) but currently never applied. Add it to the `calculateScreenPrintQuote` return value.

- [ ] **Step 1: Write the failing tests**

Add these `describe` blocks to `server/__tests__/pricingService.test.js`:

```js
describe('calculateScreenPrintQuote — custom PMS ink fee', () => {
  it('applies no custom PMS fee when all ink colors are stock', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD', inkColors: [
        { name: 'PANTONE 286 C', custom: false },
        { name: 'PANTONE 485 C', custom: false },
      ]}],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.customPmsInk).toBe(0)
    expect(result.redwall.setupFees.customPmsInk).toBe(0)
  })

  it('applies $20 per custom PMS color for OSP', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD', inkColors: [
        { name: 'PANTONE 286 C', custom: false },
        { name: 'PMS Custom Red', custom: true },
      ]}],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.customPmsInk).toBe(20)
    expect(result.osp.orderTotal).toBe(
      result.osp.perUnitTotal * 60 + result.osp.setupFees.screenSetup + 20
    )
  })

  it('applies $40 for two custom PMS colors across two locations', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [
        { colorCount: 1, printSize: 'STANDARD', inkColors: [{ name: 'PMS Custom A', custom: true }] },
        { colorCount: 1, printSize: 'STANDARD', inkColors: [{ name: 'PMS Custom B', custom: true }] },
      ],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.customPmsInk).toBe(40)
  })

  it('calculates Redwall customPmsInk fee using its own config value', async () => {
    // Redwall default customPmsInk is $20 (same as OSP by default).
    // To set it to $0 for Redwall, update via Admin Pricing page — this test just
    // verifies the fee uses the per-manufacturer config, not a shared constant.
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 1, printSize: 'STANDARD', inkColors: [{ name: 'PMS Custom', custom: true }] }],
      isDarkGarment: false,
      isReorder: false,
    })
    // Both use their own config's customPmsInk value (default: 20 each)
    expect(result.redwall.setupFees.customPmsInk).toBe(20)
    expect(result.osp.setupFees.customPmsInk).toBe(20)
  })

  it('treats absent inkColors as zero custom colors', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 2, printSize: 'STANDARD' }],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.setupFees.customPmsInk).toBe(0)
  })

  it('adds a flag message when OSP custom PMS fee applies', async () => {
    const result = await pricingService.calculateScreenPrintQuote({
      quantity: 60,
      garmentCostPerUnit: 4.50,
      locations: [{ colorCount: 1, printSize: 'STANDARD', inkColors: [{ name: 'PMS Custom', custom: true }] }],
      isDarkGarment: false,
      isReorder: false,
    })
    expect(result.osp.flags.some(f => f.includes('custom PMS'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest server/__tests__/pricingService.test.js --testNamePattern="custom PMS"
```

Expected: `FAIL` — `result.osp.setupFees.customPmsInk is undefined`

- [ ] **Step 3: Update `calculateScreenPrintQuote` in pricingService.js**

The full updated function body — insert after line 211 (after `redwallSetupFee` calculation) and update the return statement:

```js
// After redwallSetupFee calculation (after line 211), insert:

  // ── Custom PMS ink fee ─────────────────────────────────────────────────────
  const customPmsCount = locations.reduce((sum, loc) =>
    sum + (loc.inkColors || []).filter(c => c.custom).length, 0)

  const ospCustomPmsFee = round2(customPmsCount * ospFees.customPmsInk)
  const redwallCustomPmsFee = round2(customPmsCount * redwallFees.customPmsInk)
```

Then update the order totals (currently lines ~215-216) to include the custom PMS fee:

```js
// Replace:
  const ospTotal = round2(ospPerUnit * quantity + ospSetupFee)
  const redwallTotal = round2(redwallPerUnit * quantity + redwallSetupFee)

// With:
  const ospTotal = round2(ospPerUnit * quantity + ospSetupFee + ospCustomPmsFee)
  const redwallTotal = round2(redwallPerUnit * quantity + redwallSetupFee + redwallCustomPmsFee)
```

Then update the flags and return statement. Replace the section from `if (isDarkGarment)` through the end of `calculateScreenPrintQuote` (lines ~218-242):

```js
  if (isDarkGarment) {
    flags.push('Dark garment: underbase added to color count for pricing.')
  }

  const ospFlags = [...flags]
  const redwallFlags = [...flags]
  if (ospCustomPmsFee > 0) {
    ospFlags.push(`${customPmsCount} custom PMS color(s) (+$${ospCustomPmsFee.toFixed(2)})`)
  }
  if (redwallCustomPmsFee > 0) {
    redwallFlags.push(`${customPmsCount} custom PMS color(s) (+$${redwallCustomPmsFee.toFixed(2)})`)
  }

  return {
    osp: {
      perUnitGarment: garmentCostPerUnit,
      perUnitDecoration: totalOspDecoration,
      perUnitProfit,
      perUnitTotal: ospPerUnit,
      setupFees: { screenSetup: ospSetupFee, customPmsInk: ospCustomPmsFee },
      orderTotal: ospTotal,
      flags: ospFlags,
    },
    redwall: {
      perUnitGarment: garmentCostPerUnit,
      perUnitDecoration: totalRedwallDecoration,
      perUnitProfit,
      perUnitTotal: redwallPerUnit,
      setupFees: { screenSetup: redwallSetupFee, customPmsInk: redwallCustomPmsFee },
      orderTotal: redwallTotal,
      flags: redwallFlags,
    },
    recommended: ospTotal <= redwallTotal ? 'OSP' : 'REDWALL',
  }
```

Also update the JSDoc at line ~163-169 to document the new `inkColors` field:

```js
/**
 * Calculate screen print pricing for both OSP and Redwall.
 *
 * @param {{
 *   quantity: number,
 *   garmentCostPerUnit: number,
 *   locations: Array<{
 *     colorCount: number,
 *     printSize: 'STANDARD'|'OVERSIZED'|'JUMBO',
 *     inkColors?: Array<{ name: string, custom: boolean }>
 *   }>,
 *   isDarkGarment: boolean,
 *   isReorder: boolean,
 * }} params
 */
```

- [ ] **Step 4: Run all pricing tests**

```bash
npx jest server/__tests__/pricingService.test.js
```

Expected: all tests `PASS`

- [ ] **Step 5: Run all server tests**

```bash
npm run test:server
```

Expected: all tests pass. Fix any failures before committing.

- [ ] **Step 6: Commit**

```bash
git add server/services/pricingService.js server/__tests__/pricingService.test.js
git commit -m "feat: calculate custom PMS ink fee per color in screen print pricing"
```

---

## Task 7: Full test run and smoke check

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all client and server tests pass.

- [ ] **Step 2: Manual smoke check — create a quote**

Start the app (`npm run dev` or equivalent), open Create Quote, add a SCREEN_PRINT product with OSP selected:
1. Verify the ink color selector appears on each location row
2. Select a stock Pantone — confirm no fee warning
3. Add a custom PMS — confirm amber fee warning appears
4. Save the quote and reopen it — confirm ink colors are displayed in the location row
5. Recalculate pricing — confirm `customPmsInk` appears in setup fees for orders with custom colors

- [ ] **Step 3: Commit final state if anything was adjusted**

```bash
git add -p
git commit -m "fix: smoke check adjustments for ink color feature"
```
