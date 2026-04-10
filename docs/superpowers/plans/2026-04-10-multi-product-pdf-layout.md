# Multi-Product PDF Quote Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap each product's PDF sections in a bordered card for multi-product quotes, while leaving single-product quotes unchanged.

**Architecture:** Branch on `products.length` inside `buildDocDefinition`. Extract a `buildProductContent(pi)` inner closure that builds Order Summary + Print Locations + Pricing nodes for any product index. Add a `wrapInProductCard(n, qty, nodes)` inner closure that wraps those nodes in a green-bordered pdfmake table card. Single-product quotes use `buildProductContent(0)` output directly; multi-product quotes wrap each in a card.

**Tech Stack:** Node.js, pdfmake 0.2.9, Jest

---

## File Map

| File | Change |
|------|--------|
| `server/services/pdfService.js` | Export `buildDocDefinition`; add `buildProductContent` + `wrapInProductCard` inner helpers; refactor assembly; remove dead product-0-only variables |
| `server/__tests__/pdfService.test.js` | Add `MULTI_PRODUCT_QUOTE` fixture; add 5 card-layout tests |

---

## Task 1: Write failing tests

**Files:**
- Modify: `server/__tests__/pdfService.test.js`
- Modify: `server/services/pdfService.js:785` (exports line)

- [ ] **Step 1: Export `buildDocDefinition` from pdfService.js**

  In `server/services/pdfService.js`, change the final line:
  ```js
  // Before:
  module.exports = { generateQuotePDF }

  // After:
  module.exports = { generateQuotePDF, buildDocDefinition }
  ```

- [ ] **Step 2: Add the multi-product fixture to the test file**

  Add this constant after `SAMPLE_QUOTE` (after line 37) in `server/__tests__/pdfService.test.js`:
  ```js
  const MULTI_PRODUCT_QUOTE = {
    id: 'GL-00002',
    customer_name: 'Acme Corp',
    customer_email: 'orders@acme.com',
    project_name: 'Company Retreat 2026',
    intake_record: {
      customer: { name: 'Acme Corp', email: 'orders@acme.com', event_purpose: 'Retreat' },
      products: [
        {
          brand_style: 'Gildan 5000',
          quantity: 48,
          colors: ['Forest Green'],
          decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front Center', colorCount: 3 }] },
          edge_cases: {},
        },
        {
          brand_style: 'Port Authority J317',
          quantity: 24,
          colors: ['Black'],
          decoration: { method: 'EMBROIDERY', locations: [{ name: 'Left Chest', colorCount: 1 }] },
          edge_cases: {},
        },
      ],
    },
    garment_data: [
      { style: 'Gildan 5000', requestedColor: 'Forest Green', available: true },
      { style: 'Port Authority J317', requestedColor: 'Black', available: true },
    ],
    pricing_osp: [
      { perUnitGarment: 4.50, perUnitDecoration: 2.10, setupFees: { screenSetup: 45 }, orderTotal: 361.80, flags: [] },
      { perUnitGarment: 38.00, perUnitDecoration: 8.50, setupFees: { digitizing: 50 }, orderTotal: 1166.00, flags: [] },
    ],
    pricing_redwall: [
      { perUnitGarment: 5.00, perUnitDecoration: 2.50, setupFees: { screenSetup: 60 }, orderTotal: 420.00, flags: [] },
      { perUnitGarment: 40.00, perUnitDecoration: 9.00, setupFees: { digitizing: 60 }, orderTotal: 1236.00, flags: [] },
    ],
    recommended_supplier: 'OSP',
    created_at: '2026-04-10T00:00:00Z',
  }
  ```

- [ ] **Step 3: Add the card layout test suite**

  Append this `describe` block at the end of `server/__tests__/pdfService.test.js`:
  ```js
  describe('pdfService.buildDocDefinition — multi-product card layout', () => {
    // Helper: find card table nodes in doc content
    function findCardTables(doc) {
      return doc.content.filter(node =>
        node?.table?.body?.[0]?.[0]?.fillColor === '#104F42' &&
        node?.table?.body?.[0]?.[0]?.columns?.[0]?.text?.startsWith('Product ')
      )
    }

    it('single-product quote: no product card tables in content', () => {
      const doc = pdfService.buildDocDefinition(SAMPLE_QUOTE, 'OSP')
      expect(findCardTables(doc)).toHaveLength(0)
    })

    it('multi-product quote: content has one card table per product', () => {
      const doc = pdfService.buildDocDefinition(MULTI_PRODUCT_QUOTE, 'OSP')
      expect(findCardTables(doc)).toHaveLength(2)
    })

    it('multi-product card headers show correct product numbers', () => {
      const doc = pdfService.buildDocDefinition(MULTI_PRODUCT_QUOTE, 'OSP')
      const cards = findCardTables(doc)
      expect(cards[0].table.body[0][0].columns[0].text).toBe('Product 1')
      expect(cards[1].table.body[0][0].columns[0].text).toBe('Product 2')
    })

    it('multi-product card headers show correct unit counts', () => {
      const doc = pdfService.buildDocDefinition(MULTI_PRODUCT_QUOTE, 'OSP')
      const cards = findCardTables(doc)
      expect(cards[0].table.body[0][0].columns[1].text).toBe('48 units')
      expect(cards[1].table.body[0][0].columns[1].text).toBe('24 units')
    })

    it('multi-product quote renders to PDF without throwing', async () => {
      const buffer = await pdfService.generateQuotePDF(MULTI_PRODUCT_QUOTE, 'OSP')
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(1024)
    })
  })
  ```

- [ ] **Step 4: Run tests to confirm the right tests fail**

  Run: `cd server && npx jest __tests__/pdfService.test.js --no-coverage`

  Expected:
  - `single-product quote: no product card tables in content` — **PASS** (no cards currently)
  - `multi-product quote: content has one card table per product` — **FAIL**
  - `multi-product card headers show correct product numbers` — **FAIL**
  - `multi-product card headers show correct unit counts` — **FAIL**
  - `multi-product quote renders to PDF without throwing` — **PASS** (current code handles arrays without throwing)
  - All pre-existing tests — **PASS**

- [ ] **Step 5: Commit**

  ```bash
  git add server/__tests__/pdfService.test.js server/services/pdfService.js
  git commit -m "test: add multi-product PDF card layout tests (failing)"
  ```

---

## Task 2: Implement card layout

**Files:**
- Modify: `server/services/pdfService.js`

- [ ] **Step 1: Add `buildProductContent` inner function inside `buildDocDefinition`**

  Add this function after `getProfitPerUnit` (after line 366, before the `// ── Header` comment) in `server/services/pdfService.js`:

  ```js
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
  ```

- [ ] **Step 2: Add `wrapInProductCard` inner function**

  Add this function immediately after `buildProductContent` (still inside `buildDocDefinition`):

  ```js
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
  ```

- [ ] **Step 3: Replace the product assembly block with branching logic**

  In `buildDocDefinition`, delete the sections for product 0 and the additional products loop, and replace with this block. Place it between the `getProfitPerUnit` function and the `// ── Header` comment:

  ```js
  // ── Product sections (branched on count) ──────────────────────────────────
  const productSections = []
  if (products.length === 1) {
    productSections.push(...buildProductContent(0))
  } else {
    for (let pi = 0; pi < products.length; pi++) {
      productSections.push(wrapInProductCard(pi + 1, products[pi].quantity || 0, buildProductContent(pi)))
    }
  }
  ```

- [ ] **Step 4: Delete the now-dead code blocks**

  Remove each of the following from `buildDocDefinition` (they are all replaced by `buildProductContent` and `productSections`):

  **a) Product 0 variable block** — delete lines 335–350:
  ```js
  // For single-product backward compat in the rest of the function
  const product = products[0] || {}
  const decoration = product.decoration || {}
  const edgeCases = product.edge_cases || {}
  const garment = garmentArr[0] || {}
  const ospPricing = ospArr[0] || null
  const rwPricing = rwArr[0] || null

  const qty = product.quantity || 0
  const method = decoration.method || 'SCREEN_PRINT'
  const locations = (decoration.locations || []).filter(l => l.name)
  const sizes = parseSizeBreakdown(product.size_breakdown)

  const garmentStyle = garment.style || product.brand_style || '—'
  const garmentColor = garment.requestedColor || (product.colors || [])[0] || '—'

  const activePricing = resolvedSupplier === 'REDWALL' ? rwPricing : ospPricing
  ```

  **b) `sizeTable`, `summarySection`, `locationsSection`, `pricingSection`** — delete lines 428–510:
  ```js
  // ── Order Summary ──────────────────────────────────────────────────────────
  const sizeTable = ...   // through end of
  // ── Pricing ────────────────────────────────────────────────────────────────
  const pricingSection = [ ... ]
  ```

  **c) `additionalProductSections` loop** — delete lines 635–705:
  ```js
  // ─── Additional products (2, 3, …) ───────────────────────────────────────
  const additionalProductSections = []
  for (let pi = 1; pi < products.length; pi++) {
    ...
  }
  ```

- [ ] **Step 5: Update the document `content` array**

  In the `return { ... content: [ ... ] }` block, replace:
  ```js
  content: [
    // ── Page 1 ────────────────────────────────────────────────────────────
    ...headerContent,
    ...customerSection,
    ...summarySection,
    ...locationsSection,
    ...pricingSection,

    // ── Additional products ───────────────────────────────────────────────
    ...additionalProductSections,
    ...combinedTotalSection,
    ...
  ]
  ```

  With:
  ```js
  content: [
    // ── Page 1 ────────────────────────────────────────────────────────────
    ...headerContent,
    ...customerSection,
    ...productSections,
    ...combinedTotalSection,
    ...
  ]
  ```

  Leave everything from `{ text: '', pageBreak: 'before' }` onward untouched.

- [ ] **Step 6: Run all tests**

  Run: `cd server && npx jest __tests__/pdfService.test.js --no-coverage`

  Expected: ALL tests pass, including the 4 previously failing card tests.

  If any test fails:
  - Check that `buildProductContent` is defined _before_ `wrapInProductCard` (both inside `buildDocDefinition`)
  - Check that `productSections` is assembled _after_ both helpers are defined
  - Verify `module.exports` includes `buildDocDefinition`

- [ ] **Step 7: Commit**

  ```bash
  git add server/services/pdfService.js
  git commit -m "feat: bordered product cards in multi-product PDF quotes"
  ```
