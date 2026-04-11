import React, { useEffect, useState } from 'react'
import CustomerPicker from './CustomerPicker'
import InkColorSelect from './InkColorSelect'
import { OSP_STOCK_COLORS } from '../constants/ospStockColors'

// ─── Constants ────────────────────────────────────────────────────────────────
export const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
export const YOUTH_SIZES = ['YXS', 'YS', 'YM', 'YL', 'YXL']
export const TODDLER_SIZES = ['2T', '4T', '6T']
export const PRODUCT_TYPES = ['adult', 'youth', 'toddler', 'headwear']

// Canonical size sort order for dynamic sizes fetched from SS API
const SIZE_ORDER = ['2T', '4T', '6T', 'YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

// ─── Size helpers ─────────────────────────────────────────────────────────────
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

export function serializeSizeBreakdown(sizes) {
  const parts = Object.entries(sizes).filter(([, v]) => v && String(v).trim() !== '')
  if (!parts.length) return null
  return parts.map(([k, v]) => `${k}:${v}`).join(', ')
}

// ─── Normalization ────────────────────────────────────────────────────────────
// Converts both old (product/decoration/edge_cases) and new (products[]) intake_record formats
export function normalizeIntakeRecord(ir) {
  if (!ir) return { customer: {}, products: [], flags: [], status: 'READY_FOR_PRICING' }
  if (Array.isArray(ir.products)) return ir
  // Legacy single-product format → wrap in array
  return {
    customer: ir.customer ?? {},
    products: [{
      brand_style: ir.product?.brand_style ?? null,
      quantity: ir.product?.quantity ?? null,
      colors: ir.product?.colors ?? [],
      size_breakdown: ir.product?.size_breakdown ?? null,
      youth_sizes: ir.product?.youth_sizes ?? false,
      decoration: ir.decoration ?? {},
      edge_cases: ir.edge_cases ?? {},
    }],
    flags: ir.flags ?? [],
    status: ir.status ?? 'READY_FOR_PRICING',
  }
}

// Fee per custom PMS color, keyed by manufacturer. Informational — server-side config is authoritative.
const CUSTOM_PMS_FEE = { OSP: 20, REDWALL: 0 }

// ─── Product field builders ───────────────────────────────────────────────────
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
      : [{ name: 'left chest', color_count: 1, print_size: 'STANDARD', ink_colors: [] }]
    ).map(l => ({
      name: l.name || '',
      color_count: l.color_count ?? l.colorCount ?? 1,
      print_size: l.print_size || l.printSize || 'STANDARD',
      ink_colors: (Array.isArray(l.ink_colors) ? l.ink_colors : Array.isArray(l.inkColors) ? l.inkColors : []).map(c => typeof c === 'string' ? { name: c, custom: false } : c),
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

export function buildEmptyProduct({ expanded = true } = {}) {
  return productToFields({}, expanded)
}

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

export function buildEditFields(q) {
  const ir = normalizeIntakeRecord(q.intake_record)
  const c = ir.customer || {}
  const products = ir.products.length
    ? ir.products.map((p, i) => productToFields(p, i === 0))
    : [buildEmptyProduct({ expanded: true })]
  return {
    customer_id: q.customer_id || null,
    linked_customer: null, // populated at runtime by QuoteForm when loading an existing linked customer
    customer_name: q.customer_name || '',
    customer_email: q.customer_email || '',
    project_name: q.project_name || '',
    event_purpose: c.event_purpose || '',
    deadline: c.deadline || '',
    rush: c.rush || false,
    returning: c.returning || false,
    selected_supplier: q.selected_supplier || q.recommended_supplier || 'OSP',
    notes: ir.notes || '',
    // Shipping is quote-level; fall back to first product's edge_cases for old records
    local_pickup: ir.local_pickup ?? ir.products[0]?.edge_cases?.local_pickup ?? false,
    shipping_address: ir.shipping_address || ir.products[0]?.edge_cases?.shipping_address || '',
    shipping_city: ir.shipping_city || ir.products[0]?.edge_cases?.shipping_city || '',
    shipping_state: ir.shipping_state || ir.products[0]?.edge_cases?.shipping_state || '',
    shipping_zip: ir.shipping_zip || ir.products[0]?.edge_cases?.shipping_zip || '',
    products,
  }
}

// ─── Shared input components ───────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 border-b border-outline-variant/20 pb-2 ${className}`}>
      <span className="text-xs text-on-surface-variant">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm bg-surface border border-outline-variant rounded px-3 py-1.5 text-on-surface placeholder:text-[#cacaca] focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}

function Check({ id, label, checked, onChange }) {
  return (
    <div className="flex gap-3 py-2 items-center border-b border-outline-variant/20">
      <input type="checkbox" id={id} checked={!!checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-primary shrink-0" />
      <label htmlFor={id} className="text-xs text-on-surface-variant cursor-pointer">{label}</label>
    </div>
  )
}

// ─── Product card ─────────────────────────────────────────────────────────────
function ProductCard({ product, index, onChange, onRemove, canRemove, selectedSupplier }) {
  const expanded = product._expanded ?? true
  const [showMiscPrint, setShowMiscPrint] = useState(false)
  const [dynamicSizes, setDynamicSizes] = useState(null)
  const [dynamicColors, setDynamicColors] = useState(null)
  const lastFetchedStyle = React.useRef(null)

  useEffect(() => {
    const style = product.brand_style?.trim()
    if (!style) {
      setDynamicSizes(null)
      setDynamicColors(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/garments/lookup?style=${encodeURIComponent(style)}&color=`, { signal: controller.signal })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data.skus) || !data.skus.length) {
            setDynamicSizes(null)
            setDynamicColors(null)
            return
          }
          const sizes = [...new Set(data.skus.map(s => s.size))].sort((a, b) => {
            const ai = SIZE_ORDER.indexOf(a)
            const bi = SIZE_ORDER.indexOf(b)
            if (ai === -1 && bi === -1) return 0
            if (ai === -1) return 1
            if (bi === -1) return -1
            return ai - bi
          })
          const colors = [...new Set(data.skus.map(s => s.color))].filter(Boolean).sort()
          const styleChanged = lastFetchedStyle.current !== null
          lastFetchedStyle.current = style
          setDynamicSizes(sizes)
          setDynamicColors(colors)
          if (styleChanged) onChange({ ...product, sizes: {}, colors: '' })
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setDynamicSizes(null)
            setDynamicColors(null)
          }
        })
    }, 500)
    return () => { clearTimeout(timer); controller.abort() }
  }, [product.brand_style]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, val) {
    onChange({ ...product, [key]: val })
  }
  function toggle() {
    onChange({ ...product, _expanded: !expanded })
  }

  const currentSizes = dynamicSizes || (
    product.product_type === 'youth' ? YOUTH_SIZES
    : product.product_type === 'toddler' ? TODDLER_SIZES
    : ADULT_SIZES
  )

  const summary = [
    product.brand_style,
    product.colors,
    product.quantity ? `${product.quantity} units` : null,
    product.decoration_method,
  ].filter(Boolean).join(' · ')

  return (
    <div className="border border-outline-variant/40 rounded overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-surface-container cursor-pointer select-none"
        onClick={toggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold text-primary uppercase tracking-wider shrink-0">Product {index + 1}</span>
          {!expanded && summary && (
            <span className="text-xs text-on-surface-variant truncate">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-on-surface-variant hover:text-error transition-colors px-2 py-0.5 rounded hover:bg-error-container/20"
            >
              Remove
            </button>
          )}
          <span className="text-on-surface-variant text-sm">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {/* Card body */}
      {expanded && (
        <div className="p-4 space-y-5 border-t border-outline-variant/20">
          {/* Product fields */}
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Garment</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Garment style" value={product.brand_style} onChange={v => set('brand_style', v)} placeholder="e.g. 3001CVC, Gildan 5000" />
              <Field label="Quantity" type="number" value={product.quantity} onChange={v => set('quantity', v)} placeholder="e.g. 60" />
              {dynamicColors ? (
                <div className="flex flex-col gap-1 border-b border-outline-variant/20 pb-2 col-span-2">
                  <span className="text-xs text-on-surface-variant">Color</span>
                  <select
                    value={product.colors || ''}
                    onChange={e => set('colors', e.target.value)}
                    className="text-sm bg-surface border border-outline-variant rounded px-3 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— Select a color —</option>
                    {dynamicColors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ) : (
                <Field label="Colors" value={product.colors} onChange={v => set('colors', v)} placeholder="Navy, White (comma-separated)" className="col-span-2" />
              )}
            </div>
            {/* Product type selector */}
            <div className="flex gap-3 py-2 items-center border-b border-outline-variant/20 mt-3">
              <label htmlFor={`type-${index}`} className="text-xs text-on-surface-variant w-28 shrink-0">Product Type</label>
              <select
                id={`type-${index}`}
                value={product.product_type || 'adult'}
                onChange={e => onChange({ ...product, product_type: e.target.value, sizes: {} })}
                className="flex-1 text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="adult">Adult</option>
                <option value="youth">Youth</option>
                <option value="toddler">Toddler</option>
                <option value="headwear">Headwear</option>
              </select>
            </div>

            {/* Size grid */}
            {product.product_type !== 'headwear' && (() => {
              const sizeSum = Object.values(product.sizes || {}).map(v => parseInt(v, 10) || 0).reduce((a, b) => a + b, 0)
              const totalQty = parseInt(product.quantity, 10) || 0
              const sizeMismatch = sizeSum > 0 && sizeSum !== totalQty
              return (
                <div className="border-b border-outline-variant/20 pb-3 mt-3">
                  <p className="text-xs text-on-surface-variant mb-2">Size breakdown <span className="text-on-surface-variant/60">(qty per size)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {currentSizes.map(size => (
                      <div key={size} className="flex flex-col items-center gap-1">
                        <span className={`text-xs font-medium ${['2XL', '3XL', '4XL', '5XL'].includes(size) ? 'text-secondary' : 'text-on-surface-variant'}`}>{size}</span>
                        <input
                          type="number" min="0"
                          title={`${size} size quantity`}
                          value={product.sizes?.[size] || ''}
                          onChange={e => set('sizes', { ...product.sizes, [size]: e.target.value })}
                          className="w-14 text-sm text-center bg-surface border border-outline-variant rounded px-1 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                  {sizeMismatch && (
                    <p role="alert" className="text-sm text-red-600 mt-2">
                      Size quantities add up to {sizeSum}, but total quantity is {totalQty}.
                    </p>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Decoration */}
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Decoration</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex gap-3 py-2 items-center border-b border-outline-variant/20">
                <span className="text-xs text-on-surface-variant w-28 shrink-0">Method</span>
                <select
                  value={product.decoration_method}
                  onChange={e => set('decoration_method', e.target.value)}
                  className="flex-1 text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="SCREEN_PRINT">Screen Print</option>
                  <option value="DTF">DTF</option>
                  <option value="DTG">DTG</option>
                  <option value="EMBROIDERY">Embroidery</option>
                </select>
              </div>
              <div className="flex gap-3 py-2 items-center border-b border-outline-variant/20">
                <span className="text-xs text-on-surface-variant w-28 shrink-0">Artwork status</span>
                <select
                  value={product.artwork_status}
                  onChange={e => set('artwork_status', e.target.value)}
                  className="flex-1 text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="READY">Print ready</option>
                  <option value="NEEDS_REVISION">Needs revision</option>
                  <option value="NEEDS_VECTORIZATION">Needs vectorization</option>
                  <option value="NOT_PROVIDED">Not provided</option>
                </select>
              </div>
              {product.decoration_method === 'EMBROIDERY' && (
                <Field label="Stitch count" type="number" value={product.stitch_count} onChange={v => set('stitch_count', v)} placeholder="e.g. 8000" />
              )}
            </div>

            {/* Print location details */}
            <p className="text-xs text-on-surface-variant mb-2">Print location details</p>
            <div className="space-y-3">
              {product.locations.map((loc, li) => (
                <div key={li} className="bg-surface rounded border border-outline-variant/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant w-16 shrink-0">Location</span>
                    <select
                      value={loc.name}
                      onChange={e => set('locations', product.locations.map((l, j) => j === li ? { ...l, name: e.target.value } : l))}
                      className="flex-1 text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="left chest">Left Chest</option>
                      <option value="right chest">Right Chest</option>
                      <option value="center chest">Center Chest</option>
                      <option value="full front">Full Front</option>
                      <option value="full back">Full Back</option>
                      <option value="left sleeve">Left Sleeve</option>
                      <option value="right sleeve">Right Sleeve</option>
                      <option value="other">Other</option>
                    </select>
                    {product.locations.length > 1 && (
                      <button type="button" onClick={() => set('locations', product.locations.filter((_, j) => j !== li))} className="text-on-surface-variant hover:text-error text-xs ml-1">✕</button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant w-16 shrink-0"># of colors</span>
                    <input
                      type="number" min="1" max="12"
                      value={loc.color_count}
                      onChange={e => set('locations', product.locations.map((l, j) => j === li ? { ...l, color_count: parseInt(e.target.value) || 1 } : l))}
                      className="w-20 text-sm text-center bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      title="Number of ink colors"
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-on-surface-variant w-16 shrink-0 pt-1.5">Colors</span>
                    <div className="flex-1">
                      <InkColorSelect
                        value={loc.ink_colors || []}
                        onChange={inkColors => set('locations', product.locations.map((l, j) => j === li ? { ...l, ink_colors: inkColors } : l))}
                        stockColors={selectedSupplier === 'OSP' ? OSP_STOCK_COLORS : null}
                        customFee={CUSTOM_PMS_FEE[selectedSupplier] ?? 0}
                      />
                    </div>
                  </div>
                  {showMiscPrint
                    ? <Field label="Special inks / effects" value={product.special_inks} onChange={v => set('special_inks', v)} placeholder="add misc print details, comma separated" />
                    : <button type="button" onClick={() => setShowMiscPrint(true)} className="text-xs text-on-surface-variant hover:text-primary underline underline-offset-2 text-left">misc print details</button>
                  }
                </div>
              ))}
              <button
                type="button"
                onClick={() => set('locations', [...product.locations, { name: 'left chest', color_count: 1, print_size: 'STANDARD', ink_colors: [] }])}
                className="text-xs text-primary hover:underline"
              >
                + Add location
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────
export default function QuoteForm({ fields, setFields }) {
  const hasScreenPrint = (fields.products || []).some(p => p.decoration_method === 'SCREEN_PRINT')

  // Load linked customer record on mount if customer_id is set but linked_customer is not yet populated
  useEffect(() => {
    if (fields.customer_id && !fields.linked_customer) {
      fetch(`/api/customers/${fields.customer_id}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(c => { if (c) setFields(f => ({ ...f, linked_customer: c })) })
        .catch(() => {})
    }
  }, [fields.customer_id]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateProduct(i, newProduct) {
    setFields(f => ({ ...f, products: f.products.map((p, j) => j === i ? newProduct : p) }))
  }

  function addProduct() {
    setFields(f => ({
      ...f,
      // Collapse all existing cards, then add new expanded one
      products: [...f.products.map(p => ({ ...p, _expanded: false })), buildEmptyProduct({ expanded: true })],
    }))
  }

  function removeProduct(i) {
    setFields(f => ({ ...f, products: f.products.filter((_, j) => j !== i) }))
  }

  return (
    <div className="space-y-6">

      {/* Customer */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Account</p>
        <CustomerPicker
          linkedCustomerId={fields.customer_id}
          linkedCustomer={fields.linked_customer}
          onLink={c => setFields(f => ({
            ...f,
            customer_id: c.id,
            linked_customer: c,
            customer_name: c.company_name,
            customer_email: c.contact_email || f.customer_email,
          }))}
          onUnlink={() => setFields(f => ({
            ...f,
            customer_id: null,
            linked_customer: null,
            customer_name: '',
            customer_email: '',
          }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" value={fields.customer_name} onChange={v => setFields(f => ({ ...f, customer_name: v }))} placeholder="Name or organization" />
          <Field label="Email" type="email" value={fields.customer_email} onChange={v => setFields(f => ({ ...f, customer_email: v }))} placeholder="customer@example.com" />
          <Field label="Project name" value={fields.project_name} onChange={v => setFields(f => ({ ...f, project_name: v }))} placeholder="e.g. Staff Shirts 2026" />
          <Field label="Event / purpose" value={fields.event_purpose} onChange={v => setFields(f => ({ ...f, event_purpose: v }))} placeholder="e.g. Company retreat" />
          <Field label="Deadline" value={fields.deadline} onChange={v => setFields(f => ({ ...f, deadline: v }))} placeholder="e.g. May 15" />
          <Check id="rush" label="Rush order" checked={fields.rush} onChange={v => setFields(f => ({ ...f, rush: v }))} />
        </div>

        {/* Preferred manufacturer — quote-level, shown when any product is screen print */}
        {hasScreenPrint && (
          <div className="flex gap-3 py-2 items-center border-b border-outline-variant/20 mt-2">
            <span className="text-xs text-on-surface-variant w-40 shrink-0">Preferred manufacturer</span>
            <div className="flex gap-6">
              {['OSP', 'REDWALL'].map(s => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="selected_supplier"
                    value={s}
                    checked={fields.selected_supplier === s}
                    onChange={() => setFields(f => ({ ...f, selected_supplier: s }))}
                    className="accent-primary"
                  />
                  <span className="text-sm text-on-surface">{s === 'REDWALL' ? 'Redwall' : 'OSP'}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Products */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Products</p>
          <button
            type="button"
            onClick={addProduct}
            className="text-xs font-medium text-primary border border-primary/40 rounded px-3 py-1 hover:bg-primary/5 transition-colors"
          >
            + Add Product
          </button>
        </div>
        <div className="space-y-3">
          {(fields.products || []).map((product, i) => (
            <ProductCard
              key={i}
              product={product}
              index={i}
              onChange={p => updateProduct(i, p)}
              onRemove={() => removeProduct(i)}
              canRemove={i > 0}
              selectedSupplier={fields.selected_supplier}
            />
          ))}
        </div>
      </div>

      {/* Shipping */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Shipping Destination</p>
        <Check id="local-pickup" label="Local pickup" checked={fields.local_pickup} onChange={v => setFields(f => ({ ...f, local_pickup: v }))} />
        <div className={`grid grid-cols-2 gap-3 mt-2 transition-opacity ${fields.local_pickup ? 'opacity-40 pointer-events-none' : ''}`}>
          <Field label="Address" value={fields.shipping_address} onChange={v => setFields(f => ({ ...f, shipping_address: v }))} placeholder="123 Main St" className="col-span-2" />
          <Field label="City" value={fields.shipping_city} onChange={v => setFields(f => ({ ...f, shipping_city: v }))} placeholder="City" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" value={fields.shipping_state} onChange={v => setFields(f => ({ ...f, shipping_state: v }))} placeholder="WI" />
            <Field label="ZIP" value={fields.shipping_zip} onChange={v => setFields(f => ({ ...f, shipping_zip: v }))} placeholder="53202" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Notes</p>
        <textarea
          value={fields.notes || ''}
          onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
          placeholder="Any additional notes for this quote…"
          rows={3}
          className="w-full text-sm bg-surface border border-outline-variant rounded px-3 py-2 text-on-surface placeholder:text-[#cacaca] focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
      </div>

    </div>
  )
}
