export const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
export const YOUTH_SIZES = ['YXS', 'YS', 'YM', 'YL', 'YXL']

export function parseSizeBreakdown(breakdown) {
  const result = {}
  ADULT_SIZES.forEach(s => { result[s] = '' })
  if (!breakdown) return result
  const pairs = String(breakdown).split(/[,;\s]+/).filter(Boolean)
  pairs.forEach(pair => {
    const match = pair.match(/^([A-Z0-9]+)[:\-](\d+)$/i)
    if (match) {
      const key = match[1].toUpperCase()
      if (key in result || YOUTH_SIZES.includes(key)) result[key] = match[2]
    }
  })
  return result
}

export function serializeSizeBreakdown(sizes) {
  const parts = Object.entries(sizes).filter(([, v]) => v && String(v).trim() !== '')
  if (!parts.length) return null
  return parts.map(([k, v]) => `${k}:${v}`).join(', ')
}

export function buildEditFields(q) {
  const ir = q.intake_record || {}
  const c = ir.customer || {}
  const p = ir.product || {}
  const d = ir.decoration || {}
  const e = ir.edge_cases || {}
  return {
    customer_name: q.customer_name || '',
    customer_email: q.customer_email || '',
    project_name: q.project_name || '',
    event_purpose: c.event_purpose || '',
    deadline: c.deadline || '',
    rush: c.rush || false,
    returning: c.returning || false,
    brand_style: p.brand_style || '',
    quantity: p.quantity != null ? String(p.quantity) : '',
    colors: (p.colors || []).join(', '),
    sizes: parseSizeBreakdown(p.size_breakdown),
    youth_sizes: p.youth_sizes || false,
    decoration_method: d.method || 'SCREEN_PRINT',
    locations: (d.locations || [{ name: 'Front chest', color_count: 1, print_size: 'STANDARD' }]).map(l => ({
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
    shipping_destination: e.shipping_destination || '',
    selected_supplier: q.selected_supplier || q.recommended_supplier || 'OSP',
  }
}

function EditField({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1 border-b border-outline-variant/20 pb-2">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm bg-surface border border-outline-variant rounded px-3 py-1.5 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}

export default function QuoteForm({ fields, setFields }) {
  return (
    <div className="space-y-6">

      {/* Customer */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Customer</p>
        <div className="grid grid-cols-2 gap-3">
          <EditField label="Name" value={fields.customer_name} onChange={v => setFields(f => ({ ...f, customer_name: v }))} placeholder="Name or organization" />
          <EditField label="Email" type="email" value={fields.customer_email} onChange={v => setFields(f => ({ ...f, customer_email: v }))} placeholder="customer@example.com" />
          <EditField label="Project name" value={fields.project_name} onChange={v => setFields(f => ({ ...f, project_name: v }))} placeholder="e.g. Staff Shirts 2026" />
          <EditField label="Event / purpose" value={fields.event_purpose} onChange={v => setFields(f => ({ ...f, event_purpose: v }))} placeholder="e.g. Company retreat" />
          <EditField label="Deadline" value={fields.deadline} onChange={v => setFields(f => ({ ...f, deadline: v }))} placeholder="e.g. May 15" />
          <div className="flex gap-4 py-2 items-center">
            <span className="text-xs text-on-surface-variant w-28 shrink-0">Rush order</span>
            <input type="checkbox" checked={!!fields.rush} onChange={e => setFields(f => ({ ...f, rush: e.target.checked }))} className="w-4 h-4 accent-primary" />
          </div>
        </div>
      </div>

      {/* Product */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Product</p>
        <div className="grid grid-cols-2 gap-3">
          <EditField label="Garment style" value={fields.brand_style} onChange={v => setFields(f => ({ ...f, brand_style: v }))} placeholder="e.g. 3001CVC, Gildan 5000" />
          <EditField label="Quantity" type="number" value={fields.quantity} onChange={v => setFields(f => ({ ...f, quantity: v }))} placeholder="e.g. 60" />
          <EditField label="Colors" value={fields.colors} onChange={v => setFields(f => ({ ...f, colors: v }))} placeholder="Navy, White (comma-separated)" />
        </div>
        <div className="border-b border-outline-variant/20 pb-3 mt-3">
          <p className="text-xs text-on-surface-variant mb-2">Size breakdown <span className="text-on-surface-variant/60">(qty per size)</span></p>
          <div className="flex flex-wrap gap-2">
            {ADULT_SIZES.map(size => (
              <div key={size} className="flex flex-col items-center gap-1">
                <span className={`text-xs font-medium ${['2XL', '3XL', '4XL', '5XL'].includes(size) ? 'text-secondary' : 'text-on-surface-variant'}`}>{size}</span>
                <input
                  type="number"
                  min="0"
                  value={fields.sizes[size] || ''}
                  onChange={e => setFields(f => ({ ...f, sizes: { ...f.sizes, [size]: e.target.value } }))}
                  className="w-14 text-sm text-center bg-surface border border-outline-variant rounded px-1 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          {fields.youth_sizes && (
            <div className="flex flex-wrap gap-2 mt-3">
              <p className="w-full text-xs text-on-surface-variant mb-1">Youth sizes</p>
              {YOUTH_SIZES.map(size => (
                <div key={size} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-on-surface-variant">{size}</span>
                  <input
                    type="number"
                    min="0"
                    value={fields.sizes[size] || ''}
                    onChange={e => setFields(f => ({ ...f, sizes: { ...f.sizes, [size]: e.target.value } }))}
                    className="w-14 text-sm text-center bg-surface border border-outline-variant rounded px-1 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input type="checkbox" id="youth_sizes" checked={!!fields.youth_sizes} onChange={e => setFields(f => ({ ...f, youth_sizes: e.target.checked }))} className="w-4 h-4 accent-primary" />
          <label htmlFor="youth_sizes" className="text-xs text-on-surface-variant cursor-pointer">Include youth sizes</label>
        </div>
      </div>

      {/* Decoration */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Decoration</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex gap-4 py-2 items-center border-b border-outline-variant/20">
            <span className="text-xs text-on-surface-variant w-28 shrink-0">Method</span>
            <select value={fields.decoration_method} onChange={e => setFields(f => ({ ...f, decoration_method: e.target.value }))} className="flex-1 text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="SCREEN_PRINT">Screen Print</option>
              <option value="DTF">DTF</option>
              <option value="DTG">DTG</option>
              <option value="EMBROIDERY">Embroidery</option>
            </select>
          </div>
          <div className="flex gap-4 py-2 items-center border-b border-outline-variant/20">
            <span className="text-xs text-on-surface-variant w-28 shrink-0">Artwork status</span>
            <select value={fields.artwork_status} onChange={e => setFields(f => ({ ...f, artwork_status: e.target.value }))} className="flex-1 text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="UNKNOWN">Unknown</option>
              <option value="PRINT_READY">Print ready</option>
              <option value="NEEDS_CREATION">Needs creation</option>
            </select>
          </div>
          {fields.decoration_method === 'EMBROIDERY' && (
            <EditField label="Stitch count" type="number" value={fields.stitch_count} onChange={v => setFields(f => ({ ...f, stitch_count: v }))} placeholder="e.g. 8000" />
          )}
          <EditField label="Special inks" value={fields.special_inks} onChange={v => setFields(f => ({ ...f, special_inks: v }))} placeholder="PMS, metallic (comma-separated)" />
        {fields.decoration_method === 'SCREEN_PRINT' && (
          <div className="flex gap-4 py-2 items-center border-b border-outline-variant/20 col-span-2">
            <span className="text-xs text-on-surface-variant w-28 shrink-0">Preferred manufacturer</span>
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

        <p className="text-xs text-on-surface-variant mb-2">Print locations</p>
        <div className="space-y-2">
          {fields.locations.map((loc, i) => (
            <div key={i} className="flex gap-2 items-center bg-surface rounded px-3 py-2">
              <input
                value={loc.name}
                onChange={e => setFields(f => ({ ...f, locations: f.locations.map((l, j) => j === i ? { ...l, name: e.target.value } : l) }))}
                placeholder="Location name (e.g. Front chest)"
                className="flex-1 text-sm bg-transparent text-on-surface placeholder:text-on-surface-variant focus:outline-none"
              />
              <input
                type="number"
                min="1"
                max="12"
                value={loc.color_count}
                onChange={e => setFields(f => ({ ...f, locations: f.locations.map((l, j) => j === i ? { ...l, color_count: parseInt(e.target.value) || 1 } : l) }))}
                className="w-14 text-sm bg-transparent text-on-surface text-center border border-outline-variant rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                title="Ink colors"
              />
              <span className="text-xs text-on-surface-variant">colors</span>
              <select
                value={loc.print_size}
                onChange={e => setFields(f => ({ ...f, locations: f.locations.map((l, j) => j === i ? { ...l, print_size: e.target.value } : l) }))}
                className="text-xs bg-surface border border-outline-variant rounded px-1 py-0.5 text-on-surface focus:outline-none"
              >
                <option value="STANDARD">Standard</option>
                <option value="OVERSIZED">Oversized</option>
                <option value="JUMBO">Jumbo</option>
              </select>
              {fields.locations.length > 1 && (
                <button type="button" onClick={() => setFields(f => ({ ...f, locations: f.locations.filter((_, j) => j !== i) }))} className="text-on-surface-variant hover:text-error text-xs">✕</button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFields(f => ({ ...f, locations: [...f.locations, { name: '', color_count: 1, print_size: 'STANDARD' }] }))}
            className="text-xs text-primary hover:underline"
          >
            + Add location
          </button>
        </div>
      </div>

      {/* Edge cases */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Edge Cases</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex gap-4 py-2 items-center border-b border-outline-variant/20">
            <span className="text-xs text-on-surface-variant w-36 shrink-0">Extended sizes (2XL+)</span>
            <input type="checkbox" checked={!!fields.extended_sizes} onChange={e => setFields(f => ({ ...f, extended_sizes: e.target.checked }))} className="w-4 h-4 accent-primary" />
          </div>
          <div className="flex gap-4 py-2 items-center border-b border-outline-variant/20">
            <span className="text-xs text-on-surface-variant w-36 shrink-0">Dark garment</span>
            <input type="checkbox" checked={!!fields.dark_garment} onChange={e => setFields(f => ({ ...f, dark_garment: e.target.checked }))} className="w-4 h-4 accent-primary" />
          </div>
          <div className="flex gap-4 py-2 items-center border-b border-outline-variant/20">
            <span className="text-xs text-on-surface-variant w-36 shrink-0">Individual names/numbers</span>
            <input type="checkbox" checked={!!fields.individual_names} onChange={e => setFields(f => ({ ...f, individual_names: e.target.checked }))} className="w-4 h-4 accent-primary" />
          </div>
          <EditField label="Shipping destination" value={fields.shipping_destination} onChange={v => setFields(f => ({ ...f, shipping_destination: v }))} placeholder="City, State or local pickup" />
        </div>
      </div>

    </div>
  )
}
