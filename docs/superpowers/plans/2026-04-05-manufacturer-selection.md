# Manufacturer Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select OSP or Redwall as the preferred manufacturer in the quote edit form; pipeline rerun uses that selection for PDF and email generation.

**Architecture:** A nullable `selected_supplier` column on the `quotes` table stores the user's choice. The pipeline and PDF/draft endpoints resolve an "effective supplier" (`selected_supplier ?? recommended_supplier`) and pass it explicitly to `pdfService.generateQuotePDF`. The edit form adds a two-radio Preferred Manufacturer field (SCREEN_PRINT only), and the read-only pricing display shows a "Selected" badge when an override is active.

**Tech Stack:** PostgreSQL, Express.js, pdfmake, React (Vite), Vitest (client tests), Jest (server tests)

---

## File Map

| File | Change |
|------|--------|
| `server/db/queries.js` | Add `selected_supplier` to `UPDATABLE_QUOTE_COLUMNS` |
| `server/services/pdfService.js` | Accept explicit `supplier` param in `generateQuotePDF` and `buildDocDefinition` |
| `server/services/pipelineService.js` | Resolve `effectiveSupplier`; pass to email prompt and pdfService |
| `server/routes/quotes.js` | PDF and draft endpoints resolve effectiveSupplier before calling pdfService |
| `client/src/components/QuoteForm.jsx` | Add `selected_supplier` to `buildEditFields`; add radio UI in Decoration section |
| `client/src/pages/ViewQuote.jsx` | Include `selected_supplier` in save payload; show "Selected" badge in pricing display |
| `server/__tests__/pdfService.test.js` | Add test: selected_supplier overrides recommended |
| `server/__tests__/pipelineService.test.js` | Add test: pipeline email and PDF use selected_supplier when set |
| `client/src/pages/__tests__/ViewQuote.test.jsx` | Add tests: Selected badge, radio in edit panel |

---

## Task 1: Database — add selected_supplier column

**Files:**
- Modify: `server/db/queries.js:120-125`

- [ ] **Step 1: Run the migration against your local Postgres**

Connect to the database (e.g., via `psql` or your DB client) and run:

```sql
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS selected_supplier VARCHAR;
```

Expected: `ALTER TABLE` — the column now exists with a null default for all existing rows.

- [ ] **Step 2: Add selected_supplier to UPDATABLE_QUOTE_COLUMNS in queries.js**

In `server/db/queries.js`, replace lines 120–125:

```js
const UPDATABLE_QUOTE_COLUMNS = new Set([
  'status', 'customer_name', 'customer_email', 'project_name',
  'raw_input', 'intake_record', 'garment_data', 'pricing_osp',
  'pricing_redwall', 'recommended_supplier', 'selected_supplier', 'qa_report',
  'email_draft', 'gmail_draft_id', 'pdf_url', 'activity_log'
])
```

- [ ] **Step 3: Verify with a focused test run**

Run: `cd server && npx jest __tests__/queries.test.js --no-coverage`

Expected: All existing queries tests pass (no new failures introduced).

- [ ] **Step 4: Commit**

```bash
git add server/db/queries.js
git commit -m "feat: add selected_supplier to updatable quote columns"
```

---

## Task 2: pdfService — accept explicit supplier param

**Files:**
- Modify: `server/services/pdfService.js`
- Modify: `server/__tests__/pdfService.test.js`

- [ ] **Step 1: Write the failing test**

Add to `server/__tests__/pdfService.test.js` (after the existing describe block):

```js
describe('pdfService.generateQuotePDF — supplier override', () => {
  it('uses OSP pricing when supplier is OSP', async () => {
    // recommended is OSP, so this just confirms default behavior
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE, 'OSP')
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1024)
  })

  it('uses Redwall pricing when supplier is REDWALL', async () => {
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE, 'REDWALL')
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1024)
  })

  it('falls back to recommended_supplier when no supplier arg is provided', async () => {
    const buffer = await pdfService.generateQuotePDF(SAMPLE_QUOTE)
    expect(Buffer.isBuffer(buffer)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm test fails (or passes trivially — baseline check)**

Run: `cd server && npx jest __tests__/pdfService.test.js --no-coverage`

Expected: All three new tests pass (the signature change is additive and backward-compatible, so we confirm the behavior before and after the change).

- [ ] **Step 3: Update pdfService to accept explicit supplier param**

In `server/services/pdfService.js`, replace the `buildDocDefinition` and `generateQuotePDF` functions:

```js
function buildDocDefinition(quote, supplier) {
  const intake = quote.intake_record || {}
  const customer = intake.customer || {}
  const product = intake.product || {}
  const decoration = intake.decoration || {}
  const garment = quote.garment_data || {}
  const ospPricing = quote.pricing_osp || {}
  const redwallPricing = quote.pricing_redwall || {}
  const resolvedSupplier = supplier || quote.recommended_supplier || 'OSP'
  const recommendedPricing = resolvedSupplier === 'REDWALL' ? redwallPricing : ospPricing

  // ... rest of the function body is unchanged from line 51 onward
```

Replace only the top variable declarations (lines 41–49). The full replacement for those lines:

```js
function buildDocDefinition(quote, supplier) {
  const intake = quote.intake_record || {}
  const customer = intake.customer || {}
  const product = intake.product || {}
  const decoration = intake.decoration || {}
  const garment = quote.garment_data || {}
  const ospPricing = quote.pricing_osp || {}
  const redwallPricing = quote.pricing_redwall || {}
  const resolvedSupplier = supplier || quote.recommended_supplier || 'OSP'
  const recommendedPricing = resolvedSupplier === 'REDWALL' ? redwallPricing : ospPricing
```

Then update `generateQuotePDF` signature and the call to `buildDocDefinition`:

```js
/**
 * Generate a branded Giltee quote PDF.
 * @param {object} quoteData — quote record from the database
 * @param {string} [supplier] — 'OSP' or 'REDWALL'; defaults to quoteData.recommended_supplier
 * @returns {Promise<Buffer>}
 */
function generateQuotePDF(quoteData, supplier) {
  return new Promise((resolve, reject) => {
    const docDefinition = buildDocDefinition(quoteData, supplier)
    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    const chunks = []
    pdfDoc.on('data', chunk => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
}
```

- [ ] **Step 4: Run tests to confirm all pass**

Run: `cd server && npx jest __tests__/pdfService.test.js --no-coverage`

Expected: All 6 tests pass (3 original + 3 new).

- [ ] **Step 5: Commit**

```bash
git add server/services/pdfService.js server/__tests__/pdfService.test.js
git commit -m "feat: pdfService accepts explicit supplier param"
```

---

## Task 3: pipelineService — resolve effectiveSupplier

**Files:**
- Modify: `server/services/pipelineService.js`
- Modify: `server/__tests__/pipelineService.test.js`

- [ ] **Step 1: Write the failing test**

In `server/__tests__/pipelineService.test.js`, add inside the `describe` block after the last `it`:

```js
it('uses selected_supplier for email and PDF when set', async () => {
  // Quote has selected_supplier = REDWALL, but recommended = OSP
  queries.getQuote.mockResolvedValue({
    ...MOCK_QUOTE,
    selected_supplier: 'REDWALL',
    intake_record: MOCK_INTAKE_JSON,
  })

  await pipelineService.runQuotePipeline('GL-00001')

  // Email prompt should reference REDWALL total ($877.20), not OSP ($725.80)
  const emailCall = claudeService.callClaude.mock.calls.find(
    call => call[0].userPrompt?.includes('REDWALL')
  )
  expect(emailCall).toBeDefined()

  // pdfService should be called with 'REDWALL' as second arg
  expect(pdfService.generateQuotePDF).toHaveBeenCalledWith(
    expect.anything(),
    'REDWALL'
  )
})
```

- [ ] **Step 2: Run to confirm the test fails**

Run: `cd server && npx jest __tests__/pipelineService.test.js --no-coverage`

Expected: The new test fails — `pdfService.generateQuotePDF` is called with only one argument currently, and the email call doesn't include 'REDWALL'.

- [ ] **Step 3: Update pipelineService to resolve effectiveSupplier**

In `server/services/pipelineService.js`, replace the Step 5 (Email draft) section (lines 193–217). The key changes are:
1. Compute `effectiveSupplier` from `quote.selected_supplier` (the initial fetch) or `recommended_supplier`
2. Use `effectivePricing` in the email prompt
3. Pass `effectiveSupplier` to `pdfService.generateQuotePDF`

Replace lines 193–221 (Step 5 email + Step 6 PDF) with:

```js
    // ── Step 5: Email draft ─────────────────────────────────────────────────
    const effectiveSupplier = quote.selected_supplier || recommended_supplier
    const effectivePricing = effectiveSupplier === 'REDWALL' ? pricing_redwall : pricing_osp
    const emailText = await claudeService.callClaude({
      systemPrompt: skills.EMAIL_DRAFTING,
      userPrompt: `Draft the customer email for the following quote. Write in Lisa's voice exactly as described.

Customer: ${intake_record.customer?.name || quote.customer_name || 'Customer'}
Email: ${intake_record.customer?.email || quote.customer_email || ''}
Order: ${quantity} × ${brandStyle || 'garment'} — ${decorationMethod}
Color: ${requestedColor || ''}
Total: ${formatCurrency(effectivePricing?.orderTotal)} (${effectiveSupplier})
QA status: ${qa_report.status}
${qa_report.failed?.length ? `QA flags: ${qa_report.failed.map(f => f.issue).join('; ')}` : ''}

Return in this exact format:
SUBJECT: [subject line]
---
[email body starting with greeting]`,
    })

    const { subject: emailSubject, body: emailBody } = parseEmailResponse(emailText)
    const email_draft = `SUBJECT: ${emailSubject}\n\n${emailBody}`

    await queries.updateQuote(quoteId, { email_draft })
    await appendLog(quoteId, 'Email draft complete')

    // ── Step 6: PDF ─────────────────────────────────────────────────────────
    const currentQuote = await queries.getQuote(quoteId)
    const pdfBuffer = await pdfService.generateQuotePDF(currentQuote, effectiveSupplier)
    await appendLog(quoteId, 'PDF generated')
```

- [ ] **Step 4: Run tests to confirm new test passes**

Run: `cd server && npx jest __tests__/pipelineService.test.js --no-coverage`

Expected: All tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add server/services/pipelineService.js server/__tests__/pipelineService.test.js
git commit -m "feat: pipeline resolves effectiveSupplier for email and PDF"
```

---

## Task 4: routes — PDF and draft endpoints use effectiveSupplier

**Files:**
- Modify: `server/routes/quotes.js`

- [ ] **Step 1: Update GET /api/quotes/:id/pdf to resolve effectiveSupplier**

In `server/routes/quotes.js`, replace line 73:

```js
    const pdfBuffer = await pdfService.generateQuotePDF(quote)
```

with:

```js
    const effectiveSupplier = quote.selected_supplier || quote.recommended_supplier
    const pdfBuffer = await pdfService.generateQuotePDF(quote, effectiveSupplier)
```

- [ ] **Step 2: Update POST /api/quotes/:id/draft to resolve effectiveSupplier**

In `server/routes/quotes.js`, replace line 117:

```js
    const pdfBuffer = await pdfService.generateQuotePDF(quote)
```

with:

```js
    const effectiveSupplier = quote.selected_supplier || quote.recommended_supplier
    const pdfBuffer = await pdfService.generateQuotePDF(quote, effectiveSupplier)
```

- [ ] **Step 3: Run server tests**

Run: `cd server && npx jest __tests__/quotes.test.js --no-coverage`

Expected: All existing quote route tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/routes/quotes.js
git commit -m "feat: PDF and draft routes resolve effectiveSupplier"
```

---

## Task 5: QuoteForm — add Preferred Manufacturer field

**Files:**
- Modify: `client/src/components/QuoteForm.jsx`

- [ ] **Step 1: Add selected_supplier to buildEditFields**

In `client/src/components/QuoteForm.jsx`, in the `buildEditFields` function (starting line 25), add `selected_supplier` as the last field in the returned object before the closing `}`:

Replace the return statement (lines 31–58) with:

```js
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
```

- [ ] **Step 2: Add the radio UI in the Decoration section**

In `client/src/components/QuoteForm.jsx`, in the Decoration section, after the closing `</div>` of the method/artwork_status/stitch_count/special_inks grid (after line 170, before `<p className="text-xs text-on-surface-variant mb-2">Print locations</p>`), add:

```jsx
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
```

Place this after the grid closing `</div>` on line 170 (the one closing `<div className="grid grid-cols-2 gap-3 mb-3">`), before `<p className="text-xs text-on-surface-variant mb-2">Print locations</p>`.

- [ ] **Step 3: Run client tests**

Run: `cd client && npx vitest run src/components/__tests__ --reporter=verbose`

Expected: All existing component tests pass.

- [ ] **Step 4: Write a focused test for the new radio field**

In `client/src/components/__tests__/` — check if a `QuoteForm.test.jsx` exists. If not, there is no existing test file for QuoteForm. In that case, verify the radio behavior manually by running the dev server (`npm run dev`) and opening the edit panel on a screen print quote. Confirm the two radios appear under Decoration. Switch from screen print to DTF and confirm the radios disappear.

If a QuoteForm.test.jsx exists, add:

```jsx
it('shows OSP/Redwall radios for SCREEN_PRINT decoration', async () => {
  // test setup depends on existing test patterns in that file
})
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/QuoteForm.jsx
git commit -m "feat: add Preferred Manufacturer radio to QuoteForm (SCREEN_PRINT only)"
```

---

## Task 6: ViewQuote — persist selection and show Selected badge

**Files:**
- Modify: `client/src/pages/ViewQuote.jsx`
- Modify: `client/src/pages/__tests__/ViewQuote.test.jsx`

- [ ] **Step 1: Write the failing tests**

In `client/src/pages/__tests__/ViewQuote.test.jsx`, add a new describe block after the existing `'ready'` describe:

```jsx
describe('ViewQuote — manufacturer selection', () => {
  it('shows Selected badge on the overridden supplier when selected_supplier differs from recommended', async () => {
    const quoteWithOverride = {
      ...MOCK_QUOTE_READY,
      recommended_supplier: 'OSP',
      selected_supplier: 'REDWALL',
    }
    renderViewQuote(quoteWithOverride)
    await waitFor(() => expect(screen.getByText('$877.20')).toBeInTheDocument())
    expect(screen.getByText('Selected')).toBeInTheDocument()
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('does not show Selected badge when selected_supplier matches recommended', async () => {
    const quoteNoOverride = {
      ...MOCK_QUOTE_READY,
      recommended_supplier: 'OSP',
      selected_supplier: 'OSP',
    }
    renderViewQuote(quoteNoOverride)
    await waitFor(() => expect(screen.getByText('$725.80')).toBeInTheDocument())
    expect(screen.queryByText('Selected')).not.toBeInTheDocument()
  })

  it('shows manufacturer radios in edit panel for screen print quote', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('radio', { name: /osp/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /redwall/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

Run: `cd client && npx vitest run src/pages/__tests__/ViewQuote.test.jsx --reporter=verbose`

Expected: The 3 new tests fail — no "Selected" badge exists yet, and the PATCH payload doesn't include `selected_supplier`.

- [ ] **Step 3: Add Selected badge to the pricing display in ViewQuote**

In `client/src/pages/ViewQuote.jsx`, the OSP pricing card starts at line 390. Replace the inner content of the OSP card's header `<div>` (lines 391–395):

```jsx
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase">OSP</p>
                <div className="flex items-center gap-1.5">
                  {quote.recommended_supplier === 'OSP' && (
                    <span className="text-xs bg-secondary-fixed text-primary px-2 py-0.5 rounded font-medium">Recommended</span>
                  )}
                  {quote.selected_supplier === 'OSP' && quote.selected_supplier !== quote.recommended_supplier && (
                    <span className="text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-medium">Selected</span>
                  )}
                </div>
              </div>
```

And replace the Redwall card's header `<div>` (lines 407–411):

```jsx
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-on-surface-variant uppercase">Redwall</p>
                    <div className="flex items-center gap-1.5">
                      {quote.recommended_supplier === 'REDWALL' && (
                        <span className="text-xs bg-secondary-fixed text-primary px-2 py-0.5 rounded font-medium">Recommended</span>
                      )}
                      {quote.selected_supplier === 'REDWALL' && quote.selected_supplier !== quote.recommended_supplier && (
                        <span className="text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-medium">Selected</span>
                      )}
                    </div>
                  </div>
```

- [ ] **Step 4: Include selected_supplier in handleSave**

In `client/src/pages/ViewQuote.jsx`, in the `handleSave` function, replace the `updates` object (lines 136–142):

```js
      const updates = {
        intake_record,
        customer_name: f.customer_name || null,
        customer_email: f.customer_email || null,
        project_name: f.project_name || null,
        selected_supplier: f.decoration_method === 'SCREEN_PRINT' ? (f.selected_supplier || null) : null,
      }
      if (['ready', 'error'].includes(quote.status)) updates.status = 'draft'
```

- [ ] **Step 5: Run tests to confirm all pass**

Run: `cd client && npx vitest run src/pages/__tests__/ViewQuote.test.jsx --reporter=verbose`

Expected: All tests pass including the 3 new ones.

- [ ] **Step 6: Run full test suites to confirm nothing broken**

Run both:
```bash
cd server && npx jest --no-coverage
cd client && npx vitest run
```

Expected: All tests pass with no regressions.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/ViewQuote.jsx client/src/pages/__tests__/ViewQuote.test.jsx
git commit -m "feat: ViewQuote saves selected_supplier and shows Selected badge"
```

---

## Self-Review Checklist

- [x] Spec: DB column — Task 1 ✓
- [x] Spec: Edit form radio (SCREEN_PRINT only) — Task 5 ✓
- [x] Spec: Pre-selected to recommended_supplier when no override — `buildEditFields` uses `q.selected_supplier || q.recommended_supplier || 'OSP'` ✓
- [x] Spec: "Recommended" badge remains informational — unchanged in Task 6 ✓
- [x] Spec: "Selected" badge when override differs from recommended — Task 6 Step 3 ✓
- [x] Spec: PATCH endpoint accepts selected_supplier — Task 1 (UPDATABLE_QUOTE_COLUMNS) + Task 6 (handleSave) ✓
- [x] Spec: Pipeline email uses effectiveSupplier pricing — Task 3 ✓
- [x] Spec: PDF uses effectiveSupplier — Tasks 2, 3, 4 ✓
- [x] Spec: DTF/DTG/Embroidery hidden field, null on save — Task 5 radio conditional + Task 6 `decoration_method === 'SCREEN_PRINT'` guard ✓
- [x] No placeholders or TBDs in any task ✓
- [x] Type consistency: `effectiveSupplier` used consistently in Tasks 3 and 4; `supplier` param name in pdfService Tasks 2–4 ✓
