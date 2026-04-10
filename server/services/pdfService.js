const PdfPrinter = require('pdfmake')
const fs = require('fs')
const path = require('path')

// ─── Colors ───────────────────────────────────────────────────────────────────
const FOREST_GREEN = '#104F42'
const WHITE = '#FFFFFF'
const NEAR_BLACK = '#111827'
const MID_GRAY = '#6B7280'
const LIGHT_GRAY = '#E5E7EB'
const STRIPE = '#F9FAFB'
const TOTAL_BG = '#F0FDF4'

// ─── Fonts ────────────────────────────────────────────────────────────────────
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}

const printer = new PdfPrinter(fonts)

// ─── Logo ─────────────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../../client/public/giltee-logo-white.svg')
const logoSvg = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH, 'utf8') : null

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}`
}

function round2(n) { return Math.round(n * 100) / 100 }

function calcPdfProfitPerUnit(mode, value, garmentPerUnit, decorationPerUnit, totalQty) {
  const v = Number(value) || 0
  if (mode === 'per_shirt') return v
  if (mode === 'percent') return round2((garmentPerUnit + decorationPerUnit) * v / 100)
  if (mode === 'fixed_total') return totalQty > 0 ? round2(v / totalQty) : 0
  return 0
}

function parseSizeBreakdown(str) {
  if (!str || typeof str !== 'string') return []
  return str.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const [size, qty] = entry.split(':').map(s => s.trim())
      return { size: size || '?', qty: parseInt(qty, 10) || 0 }
    })
    .filter(e => e.size)
}

function labelDecoration(method) {
  return { SCREEN_PRINT: 'Screen Print', DTF: 'Direct-to-Film (DTF)', DTG: 'Direct-to-Garment (DTG)', EMBROIDERY: 'Embroidery' }[method] || method || '—'
}

function labelArtwork(status) {
  return {
    READY: 'Ready / Approved',
    NEEDS_REVISION: 'Needs Revision',
    NEEDS_VECTORIZATION: 'Needs Vectorization',
    NOT_PROVIDED: 'Not Yet Provided',
    UNKNOWN: 'Unknown',
  }[status] || status || '—'
}

// ─── Low-level building blocks ────────────────────────────────────────────────

function secLabel(text) {
  return {
    text: text.toUpperCase(),
    fontSize: 7.5,
    bold: true,
    color: FOREST_GREEN,
    characterSpacing: 1.5,
    margin: [0, 14, 0, 6],
  }
}

function miniLabel(text) {
  return { text: text.toUpperCase(), fontSize: 7, color: MID_GRAY, characterSpacing: 1, margin: [0, 4, 0, 2] }
}

// Two-column label/value table
function infoGrid(rows) {
  return {
    table: {
      widths: [130, '*'],
      body: rows.map(([label, value]) => [
        { text: label, fontSize: 8, color: MID_GRAY, margin: [0, 3, 6, 3] },
        { text: (value !== null && value !== undefined && value !== '') ? String(value) : '—', fontSize: 9, color: NEAR_BLACK, margin: [0, 3, 0, 3] },
      ]),
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 0.5,
      hLineColor: () => LIGHT_GRAY,
      vLineWidth: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
  }
}

// Standard table layout
const stdLayout = {
  hLineColor: () => LIGHT_GRAY,
  vLineWidth: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
}

function thCell(text, opts = {}) {
  return {
    text,
    fontSize: 8,
    bold: true,
    color: WHITE,
    fillColor: FOREST_GREEN,
    margin: [4, 5, 4, 5],
    ...opts,
  }
}

function cell(text, opts = {}) {
  return { text: text !== null && text !== undefined ? String(text) : '—', fontSize: 9, margin: [4, 4, 4, 4], ...opts }
}

// ─── Pricing row builders ─────────────────────────────────────────────────────

// Returns array of 4-cell row arrays for a single pricing block
function buildPricingRows(pricing, qty, garmentStyle, method) {
  if (!pricing) return []
  const rows = []

  // Garment line
  rows.push([
    cell(garmentStyle || 'Garment'),
    cell(qty, { alignment: 'center' }),
    cell(fmt(pricing.perUnitGarment), { alignment: 'right' }),
    cell(fmt((pricing.perUnitGarment || 0) * qty), { alignment: 'right' }),
  ])

  // Decoration line
  if (pricing.perUnitDecoration != null && pricing.perUnitDecoration > 0) {
    rows.push([
      cell(labelDecoration(method)),
      cell(qty, { alignment: 'center' }),
      cell(fmt(pricing.perUnitDecoration), { alignment: 'right' }),
      cell(fmt((pricing.perUnitDecoration || 0) * qty), { alignment: 'right' }),
    ])
  }

  // One-time fees
  const fees = pricing.setupFees || {}
  const feeLines = [
    [fees.screenSetup, 'Screen setup fee'],
    [fees.dtfSetup, 'DTF setup fee'],
    [fees.dtgSetup, 'DTG setup fee'],
    [fees.digitizing, 'Digitizing fee'],
    [fees.rushFee, 'Rush order fee'],
    [fees.artFee, 'Artwork fee'],
    [fees.inkChange, 'Ink change fee'],
  ]
  for (const [amount, label] of feeLines) {
    if (amount && Number(amount) > 0) {
      rows.push([
        cell(label),
        cell('—', { alignment: 'center', color: MID_GRAY }),
        cell('—', { alignment: 'right', color: MID_GRAY }),
        cell(fmt(amount), { alignment: 'right' }),
      ])
    }
  }

  return rows
}

// Single-supplier 4-col pricing table
function singlePricingTable(pricing, qty, garmentStyle, method, profitPerUnit = 0) {
  const dataRows = buildPricingRows(pricing, qty, garmentStyle, method)
  // Compute adjusted order total using user-set profit (not pipeline orderTotal)
  const setupTotal = Object.values(pricing?.setupFees || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  const adjustedOrderTotal = round2(
    ((pricing?.perUnitGarment || 0) + (pricing?.perUnitDecoration || 0) + profitPerUnit) * qty + setupTotal
  )
  return {
    table: {
      widths: ['*', 50, 75, 75],
      headerRows: 1,
      body: [
        [thCell('ITEM'), thCell('QTY', { alignment: 'center' }), thCell('UNIT PRICE', { alignment: 'right' }), thCell('TOTAL', { alignment: 'right' })],
        ...dataRows.map((row, i) => row.map(c => ({ ...c, fillColor: (i + 1) % 2 === 0 ? STRIPE : null }))),
        [
          { text: 'ORDER TOTAL', bold: true, fontSize: 10, colSpan: 3, fillColor: TOTAL_BG, margin: [4, 6, 4, 6] },
          {}, {},
          { text: fmt(adjustedOrderTotal), bold: true, fontSize: 10, alignment: 'right', fillColor: TOTAL_BG, margin: [4, 6, 4, 6] },
        ],
      ],
    },
    layout: stdLayout,
  }
}

// Dual-supplier scenario pricing table (6 columns: item | qty | osp unit | osp total | rw unit | rw total)
function scenarioPricingTable(ospPricing, rwPricing, qty, garmentStyle, method, activeSupplier) {
  const ospRows = buildPricingRows(ospPricing, qty, garmentStyle, method)
  const rwRows = buildPricingRows(rwPricing, qty, garmentStyle, method)
  const maxRows = Math.max(ospRows.length, rwRows.length)
  const blank = { text: '', margin: [4, 4, 4, 4] }

  const ospActive = activeSupplier !== 'REDWALL'
  const rwActive = activeSupplier === 'REDWALL'

  const dataRows = []
  for (let i = 0; i < maxRows; i++) {
    const o = ospRows[i]
    const r = rwRows[i]
    const bg = (i + 1) % 2 === 0 ? STRIPE : null
    dataRows.push([
      o ? { ...o[0], fillColor: bg } : { ...blank, fillColor: bg },
      o ? { ...o[1], fillColor: bg } : { ...blank, fillColor: bg },
      o ? { ...o[2], fillColor: bg } : { ...blank, fillColor: bg },
      o ? { ...o[3], fillColor: bg } : { ...blank, fillColor: bg },
      r ? { ...r[2], fillColor: bg } : { ...blank, fillColor: bg },
      r ? { ...r[3], fillColor: bg } : { ...blank, fillColor: bg },
    ])
  }

  return {
    table: {
      widths: ['*', 42, 64, 64, 64, 64],
      headerRows: 2,
      body: [
        // Scenario label row
        [
          { text: '', border: [false, false, false, false], fillColor: null },
          { text: '', border: [false, false, false, false], fillColor: null },
          {
            text: ospActive ? '✓  OSP  (ACTIVE)' : 'OSP',
            colSpan: 2, alignment: 'center', bold: true, fontSize: 8,
            color: ospActive ? WHITE : MID_GRAY,
            fillColor: ospActive ? FOREST_GREEN : '#E5E7EB',
            margin: [4, 4, 4, 4],
          },
          {},
          {
            text: rwActive ? '✓  REDWALL  (ACTIVE)' : 'REDWALL',
            colSpan: 2, alignment: 'center', bold: true, fontSize: 8,
            color: rwActive ? WHITE : MID_GRAY,
            fillColor: rwActive ? FOREST_GREEN : '#E5E7EB',
            margin: [4, 4, 4, 4],
          },
          {},
        ],
        // Column headers
        [
          thCell('ITEM'),
          thCell('QTY', { alignment: 'center' }),
          thCell('UNIT', { alignment: 'right' }),
          thCell('TOTAL', { alignment: 'right' }),
          thCell('UNIT', { alignment: 'right' }),
          thCell('TOTAL', { alignment: 'right' }),
        ],
        ...dataRows,
        // Totals row
        [
          { text: 'ORDER TOTAL', bold: true, fontSize: 10, colSpan: 3, fillColor: TOTAL_BG, margin: [4, 6, 4, 6] },
          {}, {},
          { text: fmt(ospPricing?.orderTotal), bold: true, fontSize: 10, alignment: 'right', fillColor: TOTAL_BG, margin: [4, 6, 4, 6] },
          { text: '', fillColor: TOTAL_BG, margin: [4, 6, 4, 6] },
          { text: fmt(rwPricing?.orderTotal), bold: true, fontSize: 10, alignment: 'right', fillColor: TOTAL_BG, margin: [4, 6, 4, 6] },
        ],
      ],
    },
    layout: {
      hLineColor: () => LIGHT_GRAY,
      vLineWidth: (i) => (i === 4 ? 0.5 : 0),
      vLineColor: () => '#D1D5DB',
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  }
}

// ─── Normalize helpers ────────────────────────────────────────────────────────

function normalizeIntakeRecord(ir) {
  if (!ir) return { customer: {}, products: [] }
  if (Array.isArray(ir.products)) return ir
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
  }
}

function normalizeArr(v) {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') return [v]
  return []
}

// ─── Document builder ─────────────────────────────────────────────────────────

function buildDocDefinition(quote, supplier) {
  const intake = normalizeIntakeRecord(quote.intake_record)
  const customer = intake.customer || {}
  const products = intake.products || []

  const garmentArr = normalizeArr(quote.garment_data)
  const ospArr = normalizeArr(quote.pricing_osp)
  const rwArr = normalizeArr(quote.pricing_redwall)

  const resolvedSupplier = supplier || quote.recommended_supplier || 'OSP'
  const isRush = !!(customer.rush)

  const quoteDate = new Date(quote.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const validThru = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Profit settings from quote (defaults: per_shirt, $0)
  const profitMode = quote.profit_mode || 'per_shirt'
  const profitValue = Number(quote.profit_value) || 0
  const totalQty = products.reduce((s, p) => s + (p.quantity || 0), 0)

  function getProfitPerUnit(pricing) {
    if (!pricing) return 0
    return calcPdfProfitPerUnit(
      profitMode, profitValue,
      pricing.perUnitGarment || 0,
      pricing.perUnitDecoration || 0,
      totalQty,
    )
  }

  // ── Per-product content builder ────────────────────────────────────────────
  function buildProductContent(pi) {
    const prod = products[pi] || {}
    const dec = prod.decoration || {}
    const g = garmentArr[pi] || {}
    const osp_i = ospArr[pi] || null
    const rw_i = rwArr[pi] || null
    const qty_i = prod.quantity || 0
    const method_i = dec.method || 'SCREEN_PRINT'
    const locs_i = (dec.locations || []).filter(l => l.name)
    const sizes_i = parseSizeBreakdown(prod.size_breakdown)
    const gStyle = g.style || prod.brand_style || '—'
    const gColor = g.requestedColor || (prod.colors || [])[0] || '—'
    const active_i = resolvedSupplier === 'REDWALL' ? rw_i : osp_i

    const sizeTable_i = sizes_i.length > 0
      ? {
          table: {
            widths: sizes_i.map(() => '*'),
            body: [
              sizes_i.map(s => ({ text: s.size, fontSize: 8, bold: true, color: MID_GRAY, alignment: 'center', fillColor: '#F3F4F6', margin: [3, 3, 3, 3] })),
              sizes_i.map(s => ({ text: String(s.qty), fontSize: 9, alignment: 'center', margin: [3, 3, 3, 3] })),
            ],
          },
          layout: {
            hLineColor: () => LIGHT_GRAY,
            vLineColor: () => LIGHT_GRAY,
            paddingTop: () => 0,
            paddingBottom: () => 0,
          },
        }
      : { text: 'Not specified', fontSize: 8, color: MID_GRAY, italics: true }

    const summary = [
      secLabel('Order Summary'),
      {
        columns: [
          infoGrid([
            ['Garment Style', gStyle],
            ['Color', gColor],
            ['Quantity', qty_i ? `${qty_i} units` : null],
            ['Decoration', labelDecoration(method_i)],
            ['Artwork Status', labelArtwork(dec.artwork_status)],
          ]),
          {
            stack: [
              miniLabel('Size Breakdown'),
              sizeTable_i,
            ],
            width: 210,
          },
        ],
        columnGap: 24,
      },
    ]

    const locations = locs_i.length > 0
      ? [
          secLabel('Print Locations'),
          {
            table: {
              widths: ['*', 60, 70, '*'],
              headerRows: 1,
              body: [
                [
                  thCell('LOCATION'),
                  thCell('COLORS', { alignment: 'center' }),
                  thCell('SIZE', { alignment: 'center' }),
                  thCell('NOTES'),
                ],
                ...locs_i.map((loc, i) => {
                  const colors = loc.color_count || loc.colorCount || 1
                  const printSize = loc.print_size || loc.printSize || 'STANDARD'
                  const bg = i % 2 === 1 ? STRIPE : null
                  return [
                    cell(loc.name, { fillColor: bg }),
                    cell(colors, { alignment: 'center', fillColor: bg }),
                    cell(printSize, { alignment: 'center', fillColor: bg }),
                    cell(loc.notes || '', { color: MID_GRAY, fillColor: bg }),
                  ]
                }),
              ],
            },
            layout: stdLayout,
          },
        ]
      : []

    const pricing = [
      secLabel('Pricing'),
      singlePricingTable(active_i, qty_i, gStyle, method_i, getProfitPerUnit(active_i)),
      ...(active_i?.flags?.length
        ? active_i.flags.map(f => ({ text: `* ${f}`, fontSize: 7.5, color: MID_GRAY, italics: true, margin: [0, 3, 0, 0] }))
        : []),
    ]

    return [...summary, ...locations, ...pricing]
  }

  // ── Product card wrapper (multi-product only) ──────────────────────────────
  function wrapInProductCard(n, qty_i, contentNodes) {
    return {
      table: {
        widths: ['*'],
        body: [
          [
            {
              columns: [
                { text: `Product ${n}`, bold: true, fontSize: 9, color: WHITE, margin: [6, 5, 0, 5] },
                { text: `${qty_i} units`, fontSize: 7, color: '#D1FAE5', alignment: 'right', margin: [0, 6, 6, 5] },
              ],
              fillColor: FOREST_GREEN,
              border: [true, true, true, false],
            },
          ],
          [
            {
              stack: contentNodes,
              margin: [6, 0, 6, 6],
              border: [true, false, true, true],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1.5,
        vLineWidth: () => 1.5,
        hLineColor: () => FOREST_GREEN,
        vLineColor: () => FOREST_GREEN,
        paddingTop: () => 0,
        paddingBottom: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
      },
      margin: [0, 8, 0, 4],
    }
  }

  // ── Product sections (branched on count) ──────────────────────────────────
  const productSections = []
  if (products.length === 1) {
    productSections.push(...buildProductContent(0))
  } else {
    for (let pi = 0; pi < products.length; pi++) {
      productSections.push(wrapInProductCard(pi + 1, products[pi].quantity || 0, buildProductContent(pi)))
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerContent = [
    // Green band drawn via canvas
    {
      canvas: [{ type: 'rect', x: -40, y: -40, w: 595, h: 90, color: FOREST_GREEN }],
      margin: [0, 0, 0, 0],
    },
    // Logo + quote metadata over the band
    {
      columns: [
        logoSvg
          ? { svg: logoSvg, width: 120, margin: [0, 8, 0, 8] }
          : { text: 'GILTEE', fontSize: 20, bold: true, color: WHITE, margin: [0, 10, 0, 10] },
        {
          stack: [
            { text: 'CUSTOM APPAREL QUOTE', fontSize: 13, bold: true, color: WHITE, alignment: 'right' },
            { text: `Quote #${quote.id}`, fontSize: 9, color: WHITE, alignment: 'right', margin: [0, 3, 0, 0] },
            { text: `Date: ${quoteDate}`, fontSize: 9, color: WHITE, alignment: 'right' },
            { text: `Valid through: ${validThru}`, fontSize: 9, color: WHITE, alignment: 'right' },
            ...(isRush ? [{ text: '  RUSH ORDER  ', fontSize: 8, bold: true, background: '#F59E0B', color: '#111827', alignment: 'right', margin: [0, 4, 0, 0] }] : []),
          ],
        },
      ],
      margin: [0, -78, 0, 20],
    },
  ]

  // ── Shipping ───────────────────────────────────────────────────────────────
  const isLocalPickup = !!(intake.local_pickup)
  const shippingAddressParts = isLocalPickup ? [] : [
    intake.shipping_address,
    intake.shipping_city && intake.shipping_state
      ? `${intake.shipping_city}, ${intake.shipping_state}${intake.shipping_zip ? ' ' + intake.shipping_zip : ''}`
      : (intake.shipping_city || intake.shipping_state || null),
  ].filter(Boolean)
  const shippingValue = isLocalPickup
    ? 'Local pickup'
    : shippingAddressParts.length > 0
      ? shippingAddressParts.join('\n')
      : null

  // ── Customer Info ──────────────────────────────────────────────────────────
  const customerSection = [
    secLabel('Customer Information'),
    {
      columns: [
        infoGrid([
          ['Name / Organization', customer.name || quote.customer_name],
          ['Email', customer.email || quote.customer_email],
        ]),
        infoGrid([
          ['Event / Purpose', customer.event_purpose || quote.project_name],
          ['In-Hands Date', customer.deadline || null],
          ...(shippingValue != null ? [['Ship To', shippingValue]] : []),
        ]),
      ],
      columnGap: 24,
    },
  ]

  // ─── PAGE 2 ───────────────────────────────────────────────────────────────

  // ── Decoration Details (all products) ────────────────────────────────────
  const decorationSection = []
  products.forEach((prod, pi) => {
    const dec = prod.decoration || {}
    const ec = prod.edge_cases || {}
    const prefix = products.length > 1 ? `Product ${pi + 1} — ` : ''
    const decRows = [
      [`${prefix}Decoration Method`, labelDecoration(dec.method)],
      ['Artwork Status', labelArtwork(dec.artwork_status)],
    ]
    if (dec.stitch_count) decRows.push(['Stitch Count', `${Number(dec.stitch_count).toLocaleString()} stitches`])
    if (dec.special_inks?.length) decRows.push(['Special Inks / Effects', dec.special_inks.join(', ')])
    if (ec.dark_garment) decRows.push(['Dark Garment', 'Yes — underbase added to color count'])
    if (ec.individual_names) decRows.push(['Individual Names / Numbers', 'Yes — personalization required per piece'])
    if (ec.extended_sizes) decRows.push(['Extended Sizes (2XL+)', 'Yes — may carry an additional per-unit charge'])
    const productType = prod.product_type || (prod.youth_sizes ? 'youth' : null)
    if (productType && productType !== 'adult') {
      const label = productType.charAt(0).toUpperCase() + productType.slice(1)
      decRows.push(['Product Type', label])
    }
    decorationSection.push(
      secLabel(products.length > 1 ? `Decoration Details — Product ${pi + 1}` : 'Decoration Details'),
      infoGrid(decRows),
    )
  })

  // ── Garment Availability (all products) ──────────────────────────────────
  const availabilityRows = garmentArr
    .map((g, pi) => {
      if (g.available == null) return null
      const prod = products[pi] || {}
      const gStyle = g.style || prod.brand_style || '—'
      const gColor = g.requestedColor || (prod.colors || [])[0] || '—'
      return [
        products.length > 1 ? `Product ${pi + 1}: ${gStyle} / ${gColor}` : `${gStyle} / ${gColor}`,
        g.available ? 'Confirmed available' : 'Not confirmed — requires manual check',
      ]
    })
    .filter(Boolean)

  const availabilitySection = availabilityRows.length > 0
    ? [secLabel('Garment Availability'), infoGrid(availabilityRows)]
    : []

  // ── Production Timeline ────────────────────────────────────────────────────
  const timelineRows = [
    ['Standard Turnaround', '10–14 business days after artwork approval and payment received'],
  ]
  if (isRush) timelineRows.push(['Rush Turnaround', '5–7 business days — subject to production availability'])
  timelineRows.push(['Artwork Proof', 'Sent for approval within 1–2 business days of payment'])

  const timelineSection = [
    secLabel('Production Timeline'),
    infoGrid(timelineRows),
  ]

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notesSection = intake.notes
    ? [
        secLabel('Notes'),
        { text: intake.notes, fontSize: 9, color: NEAR_BLACK, margin: [0, 0, 0, 4], lineHeight: 1.4 },
      ]
    : []

  // ── Terms & Conditions ─────────────────────────────────────────────────────
  const tcItems = [
    '1. Artwork approval is required before production begins. Giltee is not responsible for errors in customer-approved artwork.',
    '2. Printed colors may vary from on-screen appearance due to screen calibration and print process differences.',
    '3. Payment is due in full before production begins. Orders over $500 may require a 50% deposit to hold the production slot.',
    '4. This quote is valid for 30 days from the issue date. Pricing is subject to change after expiration.',
    '5. Rush orders are subject to production availability and carry a 15–25% surcharge on the order total.',
    '6. Extended sizes (2XL and above) may carry an additional $1–$3 per-unit charge depending on garment style and availability.',
    '7. A standard 2% damage allowance applies per print location. Giltee will reprint or credit defective pieces above this threshold.',
    '8. Cancellations after artwork approval are subject to a cancellation fee of up to 50% of the total order value.',
  ]
  const half = Math.ceil(tcItems.length / 2)

  const tcSection = [
    secLabel('Terms & Conditions'),
    {
      columns: [
        {
          stack: tcItems.slice(0, half).map(t => ({ text: t, fontSize: 7.5, color: MID_GRAY, margin: [0, 0, 0, 5] })),
        },
        {
          stack: tcItems.slice(half).map(t => ({ text: t, fontSize: 7.5, color: MID_GRAY, margin: [0, 0, 0, 5] })),
        },
      ],
      columnGap: 20,
      margin: [0, 0, 0, 6],
    },
  ]

  // ── Signature Block ────────────────────────────────────────────────────────
  function sigLine(label, lineWidth) {
    return {
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 14, x2: lineWidth, y2: 14, lineWidth: 0.5, lineColor: '#D1D5DB' }] },
        { text: label, fontSize: 7.5, color: MID_GRAY, margin: [0, 3, 0, 0] },
      ],
    }
  }

  const signatureSection = [
    secLabel('Approval & Authorization'),
    {
      text: `By signing below, you authorize Giltee Apparel Co. to proceed with production of this order as quoted. Quote #${quote.id}.`,
      fontSize: 8,
      color: MID_GRAY,
      margin: [0, 0, 0, 12],
    },
    {
      columns: [
        sigLine('Customer Signature', 175),
        sigLine('Print Name', 175),
        sigLine('Date', 100),
      ],
      columnGap: 20,
    },
  ]

  // ─── Combined total row (multi-product) ───────────────────────────────────
  const combinedTotalSection = products.length > 1 ? [
    secLabel('Combined Order Total'),
    {
      table: {
        widths: ['*', 120],
        body: [
          ...(ospArr.length > 0 ? [[
            cell('Combined Order Total', { bold: true, fontSize: 11 }),
            cell(fmt((resolvedSupplier === 'REDWALL' ? rwArr : ospArr).reduce((s, pricing, i) => {
              if (!pricing) return s
              const qty_i = (products[i]?.quantity) || 0
              const profitPerUnit_i = getProfitPerUnit(pricing)
              const setupTotal_i = Object.values(pricing.setupFees || {}).reduce((sf, v) => sf + (Number(v) || 0), 0)
              return s + round2(((pricing.perUnitGarment || 0) + (pricing.perUnitDecoration || 0) + profitPerUnit_i) * qty_i + setupTotal_i)
            }, 0)), { bold: true, fontSize: 11, alignment: 'right' }),
          ]] : []),
        ],
      },
      layout: { hLineColor: () => LIGHT_GRAY, vLineWidth: () => 0, paddingTop: () => 4, paddingBottom: () => 4 },
    },
  ] : []

  // ─── Assemble document ────────────────────────────────────────────────────

  return {
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: NEAR_BLACK },
    pageMargins: [40, 40, 40, 50],
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Giltee Apparel Co.  |  custom@giltee.com  |  giltee.com', fontSize: 7, color: '#9CA3AF', margin: [40, 10, 0, 0] },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#9CA3AF', alignment: 'right', margin: [0, 10, 40, 0] },
      ],
    }),
    content: [
      // ── Page 1 ────────────────────────────────────────────────────────────
      ...headerContent,
      ...customerSection,
      ...productSections,
      ...combinedTotalSection,

      // ── Page 2 (details) ──────────────────────────────────────────────────
      { text: '', pageBreak: 'before' },
      ...decorationSection,
      ...availabilitySection,
      ...notesSection,
      ...timelineSection,
      ...tcSection,
      ...signatureSection,
    ],
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a Giltee quote PDF.
 * @param {object} quoteData — quote record from the database
 * @param {string} [supplier] — 'OSP' or 'REDWALL'; falls back to recommended_supplier
 * @returns {Promise<Buffer>}
 */
function generateQuotePDF(quoteData, supplier) {
  return new Promise((resolve, reject) => {
    const docDef = buildDocDefinition(quoteData, supplier)
    const doc = printer.createPdfKitDocument(docDef)
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

module.exports = { generateQuotePDF, buildDocDefinition }
