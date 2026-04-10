# Approve Quote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a formal `approved` status to quotes, with an Approve Quote button on the detail view, a simple confirm modal, a Revoke Approval button, and updated status badges everywhere.

**Architecture:** New DB columns (`approved_at`, `approved_by`) + two new Express endpoints (`/approve`, `/revoke`) + UI changes in `ViewQuote.jsx` and `StatusBadge.jsx`. Approval is reversible, requires `ready` status, available to all users.

**Tech Stack:** Node/Express, PostgreSQL, React 18, Tailwind CSS, Jest (server), Vitest + Testing Library (client)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `server/db/migrations/002_add_approval_columns.sql` | **Create** | New migration: approved_at, approved_by columns |
| `server/db/schema.sql` | **Modify** | Add approved_at, approved_by to quotes table definition |
| `server/db/queries.js` | **Modify** | Add approved_at, approved_by to UPDATABLE_QUOTE_COLUMNS |
| `server/routes/quotes.js` | **Modify** | Add `approved` to VALID_STATUSES; add /approve and /revoke endpoints |
| `server/__tests__/quotes.test.js` | **Modify** | Add 401 tests for /approve and /revoke |
| `client/src/components/StatusBadge.jsx` | **Modify** | Add `approved` style |
| `client/src/components/__tests__/StatusBadge.test.jsx` | **Modify** | Add `approved` to statuses list test |
| `client/src/pages/ViewQuote.jsx` | **Modify** | Add state, handlers, Approve/Revoke buttons, confirm modal, fix isReady, extend edit behavior |
| `client/src/pages/__tests__/ViewQuote.test.jsx` | **Modify** | Add approved fixture + approval flow tests |

---

## Task 1: DB Migration and Schema Update

**Files:**
- Create: `server/db/migrations/002_add_approval_columns.sql`
- Modify: `server/db/schema.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- server/db/migrations/002_add_approval_columns.sql
-- Migration: add approval tracking columns to quotes table
-- Run once against your Postgres database:
--   psql $DATABASE_URL -f server/db/migrations/002_add_approval_columns.sql

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by  VARCHAR(255);
```

- [ ] **Step 2: Update schema.sql to document the new columns**

In `server/db/schema.sql`, find the quotes table definition and add the two new columns after `profit_value`:

```sql
  profit_mode          TEXT        NOT NULL DEFAULT 'per_shirt',
  profit_value         NUMERIC     NOT NULL DEFAULT 0,
  approved_at          TIMESTAMP,
  approved_by          VARCHAR(255)
```

Also update the status comment on line 70 (the `-- Quotes` section header comment) to read:

```sql
-- Quotes — status values: draft | processing | ready | error | sent | approved
```

- [ ] **Step 3: Apply the migration to your local database**

Run in a terminal:
```bash
psql $DATABASE_URL -f server/db/migrations/002_add_approval_columns.sql
```
Or if using Rancher Desktop Postgres (substitute your actual DB connection):
```bash
psql -h localhost -U postgres -d giltee_dev -f "server/db/migrations/002_add_approval_columns.sql"
```

Expected output:
```
ALTER TABLE
```

- [ ] **Step 4: Commit**

```bash
git add server/db/migrations/002_add_approval_columns.sql server/db/schema.sql
git commit -m "feat: add approved_at and approved_by columns to quotes"
```

---

## Task 2: Server — Valid Statuses + Updatable Columns + Auth Tests

**Files:**
- Modify: `server/routes/quotes.js` (VALID_STATUSES only)
- Modify: `server/db/queries.js`
- Modify: `server/__tests__/quotes.test.js`

- [ ] **Step 1: Write the failing tests**

In `server/__tests__/quotes.test.js`, add these three tests after the existing `POST /api/quotes/:id/run — unauthenticated` describe block:

```js
describe('POST /api/quotes/:id/approve — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).post('/api/quotes/GL-00001/approve')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/quotes/:id/revoke — unauthenticated', () => {
  it('returns 401 when no session', async () => {
    const res = await request(app).post('/api/quotes/GL-00001/revoke')
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/quotes/:id with status=approved — unauthenticated', () => {
  it('returns 401 when no session (approved is a valid status)', async () => {
    const res = await request(app)
      .patch('/api/quotes/GL-00001')
      .send({ status: 'approved' })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm run test:server -- --testPathPattern=quotes
```

Expected: `POST /api/quotes/:id/approve — unauthenticated` → FAIL (404, route doesn't exist yet)
`POST /api/quotes/:id/revoke — unauthenticated` → FAIL (404)
`PATCH with status=approved` → this one may pass already (401 from auth, not 400 from validation)

- [ ] **Step 3: Add `approved` to VALID_STATUSES in routes/quotes.js**

In `server/routes/quotes.js`, find line 70:
```js
const VALID_STATUSES = new Set(['draft', 'processing', 'ready', 'error', 'sent'])
```
Change to:
```js
const VALID_STATUSES = new Set(['draft', 'processing', 'ready', 'error', 'sent', 'approved'])
```

- [ ] **Step 4: Add approved_at and approved_by to UPDATABLE_QUOTE_COLUMNS in queries.js**

In `server/db/queries.js`, find lines 120-126:
```js
const UPDATABLE_QUOTE_COLUMNS = new Set([
  'status', 'customer_name', 'customer_email', 'project_name',
  'raw_input', 'intake_record', 'garment_data', 'pricing_osp',
  'pricing_redwall', 'recommended_supplier', 'selected_supplier', 'qa_report',
  'email_draft', 'gmail_draft_id', 'pdf_url', 'activity_log', 'customer_id',
  'profit_mode', 'profit_value'
])
```
Change to:
```js
const UPDATABLE_QUOTE_COLUMNS = new Set([
  'status', 'customer_name', 'customer_email', 'project_name',
  'raw_input', 'intake_record', 'garment_data', 'pricing_osp',
  'pricing_redwall', 'recommended_supplier', 'selected_supplier', 'qa_report',
  'email_draft', 'gmail_draft_id', 'pdf_url', 'activity_log', 'customer_id',
  'profit_mode', 'profit_value', 'approved_at', 'approved_by'
])
```

- [ ] **Step 5: Run the tests to confirm the right failures**

```bash
npm run test:server -- --testPathPattern=quotes
```

Expected:
- `PATCH with status=approved` → PASS (returns 401 from auth, no longer 400 from validation)
- `POST /approve — unauthenticated` → FAIL with 404 (route not added until Task 3 — this is expected)
- `POST /revoke — unauthenticated` → FAIL with 404 (same reason)

The two 404 failures confirm the routes don't exist yet. Task 3 adds them.

- [ ] **Step 6: Commit the valid-statuses and updatable-columns changes**

```bash
git add server/routes/quotes.js server/db/queries.js
git commit -m "feat: add approved to valid statuses and updatable quote columns"
```

---

## Task 3: Server — /approve and /revoke Endpoints

**Files:**
- Modify: `server/routes/quotes.js`
- Modify: `server/__tests__/quotes.test.js`

- [ ] **Step 1: Add the /approve and /revoke route handlers to routes/quotes.js**

Add these two blocks immediately before `module.exports = router` at line 173:

```js
// POST /api/quotes/:id/approve — mark quote as approved
router.post('/:id/approve', async (req, res, next) => {
  try {
    const quote = await queries.getQuote(req.params.id)
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    if (quote.status !== 'ready') {
      return res.status(400).json({ error: 'Quote must be ready to approve' })
    }
    const updated = await queries.updateQuote(req.params.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: req.user?.email || req.user?.name || 'Unknown',
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// POST /api/quotes/:id/revoke — revert approved quote back to ready
router.post('/:id/revoke', async (req, res, next) => {
  try {
    const quote = await queries.getQuote(req.params.id)
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    if (quote.status !== 'approved') {
      return res.status(400).json({ error: 'Quote must be approved to revoke' })
    }
    const updated = await queries.updateQuote(req.params.id, {
      status: 'ready',
      approved_at: null,
      approved_by: null,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2: Run all server tests and verify the three new tests now pass**

```bash
npm run test:server -- --testPathPattern=quotes
```

Expected output: all tests pass including:
- `POST /api/quotes/:id/approve — unauthenticated` → PASS (401)
- `POST /api/quotes/:id/revoke — unauthenticated` → PASS (401)
- `PATCH /api/quotes/:id with status=approved — unauthenticated` → PASS (401)

- [ ] **Step 3: Run full server test suite to verify no regressions**

```bash
npm run test:server
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/routes/quotes.js server/__tests__/quotes.test.js
git commit -m "feat: add /approve and /revoke endpoints for quote approval"
```

---

## Task 4: Client — StatusBadge approved Style

**Files:**
- Modify: `client/src/components/__tests__/StatusBadge.test.jsx`
- Modify: `client/src/components/StatusBadge.jsx`

- [ ] **Step 1: Write the failing test**

In `client/src/components/__tests__/StatusBadge.test.jsx`, update the `renders all statuses without crashing` test to include `approved`:

```js
it('renders all statuses without crashing', () => {
  const statuses = ['draft', 'processing', 'ready', 'error', 'sent', 'approved']
  statuses.forEach(status => {
    const { unmount } = render(<StatusBadge status={status} />)
    expect(screen.getByText(status)).toBeInTheDocument()
    unmount()
  })
})
```

Also add a dedicated test:

```js
it('renders the approved status text', () => {
  render(<StatusBadge status="approved" />)
  expect(screen.getByText('approved')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npm run test:client -- StatusBadge
```

Expected: FAIL — "approved" status renders with the fallback style, not a dedicated style. The text test will pass (it still renders the text), but this confirms the style is not yet defined. Note: the test will actually PASS since StatusBadge renders unknown statuses with the fallback style. That's fine — the style change has no test-visible behavior beyond text rendering. Move to Step 3.

- [ ] **Step 3: Add the approved style to StatusBadge.jsx**

In `client/src/components/StatusBadge.jsx`, replace the `STATUS_STYLES` object:

```js
const STATUS_STYLES = {
  draft:      'bg-surface-container-highest text-on-surface-variant',
  processing: 'bg-secondary-fixed/30 text-secondary',
  ready:      'bg-secondary-fixed text-primary',
  error:      'bg-error-container text-on-error-container',
  sent:       'bg-primary text-on-primary',
  approved:   'bg-tertiary-container text-on-tertiary-container',
}
```

- [ ] **Step 4: Run the client tests and verify all pass**

```bash
npm run test:client -- StatusBadge
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/StatusBadge.jsx client/src/components/__tests__/StatusBadge.test.jsx
git commit -m "feat: add approved status style to StatusBadge"
```

---

## Task 5: Client — ViewQuote Approval UI

**Files:**
- Modify: `client/src/pages/__tests__/ViewQuote.test.jsx`
- Modify: `client/src/pages/ViewQuote.jsx`

### Step 1-2: Write failing tests

- [ ] **Step 1: Add MOCK_QUOTE_APPROVED fixture and import userEvent at top of ViewQuote.test.jsx**

At the top of `client/src/pages/__tests__/ViewQuote.test.jsx`, the `userEvent` import already exists. Add the `MOCK_QUOTE_APPROVED` fixture after `MOCK_QUOTE_MULTI`:

```js
const MOCK_QUOTE_APPROVED = {
  ...MOCK_QUOTE_READY,
  status: 'approved',
  approved_at: '2026-04-10T14:00:00Z',
  approved_by: 'adam@giltee.com',
}
```

- [ ] **Step 2: Add the approval UI tests**

Add these describe blocks at the end of `client/src/pages/__tests__/ViewQuote.test.jsx`:

```js
describe('ViewQuote — approval buttons', () => {
  it('shows Approve Quote button when status is ready', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /approve quote/i })).toBeInTheDocument()
    )
  })

  it('does not show Approve Quote button when status is draft', async () => {
    renderViewQuote(MOCK_QUOTE_DRAFT)
    await waitFor(() => screen.getByRole('button', { name: /run quote/i }))
    expect(screen.queryByRole('button', { name: /approve quote/i })).not.toBeInTheDocument()
  })

  it('shows Revoke Approval button when status is approved', async () => {
    renderViewQuote(MOCK_QUOTE_APPROVED)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /revoke approval/i })).toBeInTheDocument()
    )
  })

  it('does not show Approve Quote button when status is approved', async () => {
    renderViewQuote(MOCK_QUOTE_APPROVED)
    await waitFor(() => screen.getByRole('button', { name: /revoke approval/i }))
    expect(screen.queryByRole('button', { name: /approve quote/i })).not.toBeInTheDocument()
  })

  it('clicking Approve Quote opens the confirm modal', async () => {
    const user = userEvent.setup()
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => screen.getByRole('button', { name: /approve quote/i }))
    await user.click(screen.getByRole('button', { name: /approve quote/i }))
    expect(screen.getByText('Approve this quote?')).toBeInTheDocument()
  })

  it('clicking Revoke Approval opens the confirm modal', async () => {
    const user = userEvent.setup()
    renderViewQuote(MOCK_QUOTE_APPROVED)
    await waitFor(() => screen.getByRole('button', { name: /revoke approval/i }))
    await user.click(screen.getByRole('button', { name: /revoke approval/i }))
    expect(screen.getByText('Revoke approval?')).toBeInTheDocument()
  })

  it('confirming Approve calls POST /approve', async () => {
    const user = userEvent.setup()
    const approvedQuote = { ...MOCK_QUOTE_READY, status: 'approved', approved_at: '2026-04-10T14:00:00Z', approved_by: 'adam@giltee.com' }
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_QUOTE_READY })  // initial GET
      .mockResolvedValueOnce({ ok: true, json: async () => approvedQuote })      // POST /approve
    render(
      <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn() }}>
        <MemoryRouter initialEntries={['/quotes/GL-00001']}>
          <Routes>
            <Route path="/quotes/:id" element={<ViewQuote />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )
    await waitFor(() => screen.getByRole('button', { name: /approve quote/i }))
    await user.click(screen.getByRole('button', { name: /approve quote/i }))
    await user.click(screen.getByRole('button', { name: /^approve$/i }))
    await waitFor(() => {
      const calls = global.fetch.mock.calls
      const approveCall = calls.find(([url]) => url.includes('/approve'))
      expect(approveCall).toBeDefined()
      expect(approveCall[1].method).toBe('POST')
    })
  })

  it('edit on an approved quote sends approved_at: null and approved_by: null', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_QUOTE_APPROVED })                    // initial GET
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...MOCK_QUOTE_APPROVED, status: 'draft' }) }) // PATCH save
    render(
      <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn() }}>
        <MemoryRouter initialEntries={['/quotes/GL-00001']}>
          <Routes>
            <Route path="/quotes/:id" element={<ViewQuote />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )
    await waitFor(() => screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => {
      const calls = global.fetch.mock.calls
      const patchCall = calls.find(([, opts]) => opts?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      const body = JSON.parse(patchCall[1].body)
      expect(body.status).toBe('draft')
      expect(body.approved_at).toBeNull()
      expect(body.approved_by).toBeNull()
    })
  })
})
```

- [ ] **Step 3: Run the tests and verify they all fail**

```bash
npm run test:client -- ViewQuote
```

Expected: 8 new tests FAIL (buttons don't exist yet, modal doesn't exist yet).

### Step 4-9: Implement ViewQuote changes

- [ ] **Step 4: Add three new state variables to ViewQuote.jsx**

In `client/src/pages/ViewQuote.jsx`, after line 47 (`const [qaChecking, setQaChecking] = useState(false)`), add:

```js
const [confirmModal, setConfirmModal] = useState(null) // 'approve' | 'revoke' | null
const [approveLoading, setApproveLoading] = useState(false)
const [approveError, setApproveError] = useState(null)
```

- [ ] **Step 5: Add handleApprove and handleRevoke functions**

In `ViewQuote.jsx`, after the `handleRunPipeline` function (after line 196), add:

```js
async function handleApprove() {
  setApproveLoading(true)
  setApproveError(null)
  try {
    const res = await fetch(`/api/quotes/${id}/approve`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Approval failed')
    setQuote(data)
  } catch (err) {
    setApproveError(err.message)
  } finally {
    setApproveLoading(false)
    setConfirmModal(null)
  }
}

async function handleRevoke() {
  setApproveLoading(true)
  setApproveError(null)
  try {
    const res = await fetch(`/api/quotes/${id}/revoke`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Revocation failed')
    setQuote(data)
  } catch (err) {
    setApproveError(err.message)
  } finally {
    setApproveLoading(false)
    setConfirmModal(null)
  }
}
```

- [ ] **Step 6: Update handleSave to drop approved → draft and clear approval fields**

In `ViewQuote.jsx`, find line 150:
```js
if (['ready', 'error'].includes(quote.status)) updates.status = 'draft'
```
Replace with:
```js
if (['ready', 'error', 'approved'].includes(quote.status)) {
  updates.status = 'draft'
  updates.approved_at = null
  updates.approved_by = null
}
```

- [ ] **Step 7: Update the edit panel hint to include approved status**

In `ViewQuote.jsx`, find line 377:
```jsx
{['ready', 'error'].includes(quote.status) && (
  <span className="text-xs text-on-surface-variant">Saving resets to draft — re-run pipeline after</span>
)}
```
Replace with:
```jsx
{['ready', 'error', 'approved'].includes(quote.status) && (
  <span className="text-xs text-on-surface-variant">Saving resets to draft — re-run pipeline after</span>
)}
```

- [ ] **Step 8: Fix Email Draft / Quote PDF buttons to stay enabled when approved**

In `ViewQuote.jsx`, find inside the output buttons map (around line 322):
```js
const isReady = quote.status === 'ready'
```
Replace with:
```js
const isReady = ['ready', 'approved'].includes(quote.status)
```

- [ ] **Step 9: Add Approve Quote / Revoke Approval buttons to the action buttons row**

In `ViewQuote.jsx`, find the action buttons area. The `{!editing && (` block starts around line 292. Inside it, find the first line of the `<div className="flex items-center gap-2">` which currently opens with the Quote Quality button comment at line 294.

Add the Approve/Revoke buttons immediately **before** the `{/* Quote Quality — always available */}` comment:

```jsx
{/* Approve Quote / Revoke Approval */}
{quote.status === 'ready' && (
  <button
    onClick={() => setConfirmModal('approve')}
    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors"
  >
    Approve Quote
  </button>
)}
{quote.status === 'approved' && (
  <button
    onClick={() => setConfirmModal('revoke')}
    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors"
  >
    Revoke Approval
  </button>
)}
```

- [ ] **Step 10: Add the confirm modal**

In `ViewQuote.jsx`, find the closing `</div>` of the outermost `<div className="min-h-screen bg-surface">` wrapper (the very last `</div>` in the component return). Add the modal just before it:

```jsx
        {/* ── Confirm Modal ───────────────────────────────────────────── */}
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/60 backdrop-blur-sm">
            <div className="bg-surface-container rounded-xl border border-outline-variant shadow-xl p-6 w-full max-w-sm mx-4">
              <h2 className="text-base font-semibold text-on-surface mb-2">
                {confirmModal === 'approve' ? 'Approve this quote?' : 'Revoke approval?'}
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                {confirmModal === 'approve'
                  ? 'This marks the quote as approved. You can revoke approval at any time.'
                  : 'This returns the quote to Ready status.'}
              </p>
              {approveError && (
                <p className="text-xs text-error mb-4">{approveError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setConfirmModal(null); setApproveError(null) }}
                  disabled={approveLoading}
                  className="text-sm px-4 py-2 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal === 'approve' ? handleApprove : handleRevoke}
                  disabled={approveLoading}
                  className="text-sm px-4 py-2 rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {approveLoading ? 'Working…' : confirmModal === 'approve' ? 'Approve' : 'Revoke'}
                </button>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 11: Run the client tests and verify all pass**

```bash
npm run test:client -- ViewQuote
```

Expected: all tests pass including the 8 new approval tests.

- [ ] **Step 12: Run the full test suite to verify no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 13: Commit**

```bash
git add client/src/pages/ViewQuote.jsx client/src/pages/__tests__/ViewQuote.test.jsx
git commit -m "feat: add Approve Quote button, revoke, confirm modal, and approved status to ViewQuote"
```

---

## Task 6: Manual Verification

- [ ] **Step 1: Open a quote in the browser and run the pipeline** (`http://localhost:5173`)

Confirm the quote reaches `ready` status. You should see the green "Approve Quote" button to the left of "Quote Quality".

- [ ] **Step 2: Click Approve Quote**

Confirm the modal appears: "Approve this quote?" with Cancel / Approve buttons.

- [ ] **Step 3: Click Approve**

Confirm:
- Modal closes
- Status badge changes to "approved" (green-toned badge)
- "Approve Quote" button replaced by "Revoke Approval" (outlined/muted)
- Email Draft and Quote PDF buttons remain enabled

- [ ] **Step 4: Navigate to the Ledger**

Confirm the quote shows the green "approved" badge in the status column.

- [ ] **Step 5: Return to the quote and click Edit**

Confirm:
- Edit panel opens
- Hint reads "Saving resets to draft — re-run pipeline after"
- Saving drops status to `draft` and both approval columns are cleared

- [ ] **Step 6: Run the pipeline again, approve the quote, then click Revoke Approval**

Confirm the modal appears: "Revoke approval?" with Cancel / Revoke buttons. Clicking Revoke returns the quote to `ready` status.

- [ ] **Step 7: Final commit if any tweaks were needed**

```bash
git add -p  # review any last changes
git commit -m "fix: approval UI tweaks from manual verification"
```
```
