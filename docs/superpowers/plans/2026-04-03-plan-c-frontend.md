# Giltee Quote Generator — Plan C: Frontend Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three stub pages (Ledger, CreateQuote, ViewQuote) with fully functional implementations wired to the Plan B backend API. Clients.jsx remains "Coming Soon" (v2).

**Architecture:** All pages consume the `/api/*` endpoints built in Plan B via `fetch` with `credentials: 'include'`. Auth context (`useAuth`) is already wired in App.jsx. NavBar is already complete. No new routing needed — routes are already in App.jsx.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, React Router v6, Vitest + @testing-library/react

**Design tokens (from tailwind.config.js):**
- Surfaces: `bg-surface` (white), `bg-surface-container-low` (#f8f9fa), `bg-surface-container-highest` (#f1f3f5)
- Text: `text-on-surface` (#1f1b15), `text-on-surface-variant` (#404945)
- Brand: `bg-primary` (#00372c), `text-primary` (#00372c), `bg-primary-container` (#104f42), `text-on-primary` (white)
- Accent: `bg-secondary` (#006d3c), `bg-secondary-fixed` (#87f9af), `text-secondary` (#006d3c)
- Error: `text-error` (#ba1a1a), `bg-error-container` (#ffdad6), `text-on-error-container` (#93000a)
- Border: `border-outline-variant` (#bfc9c4)

**This plan produces:** A working app where users can view all quotes in a filterable ledger, create new quotes from a form, and view a complete quote detail page with pipeline controls and all generated data (intake, garment, pricing, QA, email draft, PDF link, activity log).

**Subsequent plan:** Plan D (optional) — deploy to Render, configure real OAuth, add email sending.

---

## File Map

| File | Responsibility |
|------|----------------|
| `client/src/pages/Ledger.jsx` | Quote list with status filter tabs, search, and status badges |
| `client/src/pages/CreateQuote.jsx` | Form to create a new quote (name, email, project, raw input) |
| `client/src/pages/ViewQuote.jsx` | Full quote detail: pipeline controls, all output sections, activity log |
| `client/src/components/StatusBadge.jsx` | Reusable colored status badge (draft/processing/ready/error/sent) |
| `client/src/pages/__tests__/Ledger.test.jsx` | Ledger tests |
| `client/src/pages/__tests__/CreateQuote.test.jsx` | CreateQuote tests |
| `client/src/pages/__tests__/ViewQuote.test.jsx` | ViewQuote tests |

---

## Task 1: StatusBadge Component

**Files:**
- Create: `client/src/components/StatusBadge.jsx`
- Create: `client/src/components/__tests__/StatusBadge.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/__tests__/StatusBadge.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import StatusBadge from '../StatusBadge'

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="draft" />)
    expect(screen.getByText('draft')).toBeInTheDocument()
  })

  it('renders all statuses without crashing', () => {
    const statuses = ['draft', 'processing', 'ready', 'error', 'sent']
    statuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(screen.getByText(status)).toBeInTheDocument()
      unmount()
    })
  })

  it('handles unknown status gracefully', () => {
    render(<StatusBadge status="unknown" />)
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run test:client -- --reporter=verbose 2>&1 | head -30
```

Expected: FAIL — `Cannot find module '../StatusBadge'`

- [ ] **Step 3: Create `client/src/components/StatusBadge.jsx`**

```jsx
const STATUS_STYLES = {
  draft:      'bg-surface-container-highest text-on-surface-variant',
  processing: 'bg-secondary-fixed/30 text-secondary',
  ready:      'bg-secondary-fixed text-primary',
  error:      'bg-error-container text-on-error-container',
  sent:       'bg-primary text-on-primary',
}

export default function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-surface-container-highest text-on-surface-variant'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run test:client
```

Expected: All tests pass (existing 13 + 3 new = 16).

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && git add client/src/components/StatusBadge.jsx client/src/components/__tests__/StatusBadge.test.jsx && git commit -m "feat: add StatusBadge component for quote status display"
```

---

## Task 2: Ledger Page

**Files:**
- Modify: `client/src/pages/Ledger.jsx` (replace stub)
- Create: `client/src/pages/__tests__/Ledger.test.jsx`

The Ledger is the main dashboard at `/`. It shows all quotes in a table with status filter tabs.

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/__tests__/Ledger.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import Ledger from '../Ledger'

const mockUser = { id: 1, name: 'Adam', email: 'adam@giltee.com', role: 'admin' }

const MOCK_QUOTES = [
  { id: 'GL-00001', status: 'ready', customer_name: 'Kohn Law', project_name: 'Staff Shirts 2026', created_at: '2026-04-01T10:00:00Z', created_by: 'adam@giltee.com' },
  { id: 'GL-00002', status: 'draft', customer_name: 'Acme Corp', project_name: 'Promo Run', created_at: '2026-04-02T09:00:00Z', created_by: 'adam@giltee.com' },
]

function renderLedger() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_QUOTES,
  })
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
      <MemoryRouter>
        <Ledger />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => jest.resetAllMocks())

describe('Ledger', () => {
  it('renders the page heading', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getByText('Quote Ledger')).toBeInTheDocument())
  })

  it('shows quotes after loading', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getByText('Kohn Law')).toBeInTheDocument())
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('shows quote IDs', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getByText('GL-00001')).toBeInTheDocument())
  })

  it('shows a New Quote link', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getByRole('link', { name: /new quote/i })).toBeInTheDocument())
  })

  it('shows status badges', async () => {
    renderLedger()
    await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument())
    expect(screen.getByText('draft')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run test:client
```

Expected: FAIL — 5 Ledger tests failing.

- [ ] **Step 3: Replace `client/src/pages/Ledger.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'

const STATUSES = ['all', 'draft', 'processing', 'ready', 'error', 'sent']

export default function Ledger() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeStatus, setActiveStatus] = useState('all')

  useEffect(() => {
    const params = activeStatus !== 'all' ? `?status=${activeStatus}` : ''
    fetch(`/api/quotes${params}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load quotes')
        return r.json()
      })
      .then(data => { setQuotes(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [activeStatus])

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Quote Ledger</h1>
            <p className="text-on-surface-variant text-sm mt-0.5">
              {loading ? 'Loading…' : `${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            to="/quotes/new"
            className="bg-primary text-on-primary text-sm font-medium px-4 py-2 rounded hover:bg-primary-container transition-colors"
          >
            New Quote
          </Link>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 mb-4 border-b border-outline-variant/30">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeStatus === s
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-error-container text-on-error-container text-sm rounded p-3 mb-4">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-14 bg-surface-container-low rounded animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && quotes.length === 0 && (
          <div className="text-center py-16">
            <p className="text-on-surface-variant text-sm mb-4">
              {activeStatus === 'all' ? 'No quotes yet.' : `No ${activeStatus} quotes.`}
            </p>
            <Link
              to="/quotes/new"
              className="text-sm text-primary font-medium hover:underline"
            >
              Create your first quote →
            </Link>
          </div>
        )}

        {/* Quote table */}
        {!loading && !error && quotes.length > 0 && (
          <div className="bg-surface-container-low rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="text-left px-4 py-3 text-xs font-bold tracking-wider text-on-surface-variant uppercase">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-bold tracking-wider text-on-surface-variant uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold tracking-wider text-on-surface-variant uppercase">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-bold tracking-wider text-on-surface-variant uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold tracking-wider text-on-surface-variant uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q, i) => (
                  <tr
                    key={q.id}
                    className={`hover:bg-surface-container transition-colors ${i < quotes.length - 1 ? 'border-b border-outline-variant/20' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link to={`/quotes/${q.id}`} className="font-mono text-primary hover:underline">
                        {q.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-on-surface">
                      {q.customer_name || <span className="text-on-surface-variant italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {q.project_name || <span className="italic">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">
                      {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run test:client
```

Expected: All 5 Ledger tests PASS. Total: 19 client tests.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && git add client/src/pages/Ledger.jsx client/src/pages/__tests__/Ledger.test.jsx && git commit -m "feat: implement Ledger page with status filter tabs and quote table"
```

---

## Task 3: CreateQuote Page

**Files:**
- Modify: `client/src/pages/CreateQuote.jsx` (replace stub)
- Create: `client/src/pages/__tests__/CreateQuote.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/__tests__/CreateQuote.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import CreateQuote from '../CreateQuote'

const mockUser = { id: 1, name: 'Adam', email: 'adam@giltee.com', role: 'admin' }
const mockNavigate = jest.fn()

jest.mock('react-router-dom', async () => {
  const actual = await jest.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderCreateQuote() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ id: 'GL-00001', status: 'draft' }),
  })
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
      <MemoryRouter>
        <CreateQuote />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => jest.resetAllMocks())

describe('CreateQuote', () => {
  it('renders the page heading', () => {
    renderCreateQuote()
    expect(screen.getByText('New Quote')).toBeInTheDocument()
  })

  it('renders the raw input textarea', () => {
    renderCreateQuote()
    expect(screen.getByPlaceholderText(/paste the customer/i)).toBeInTheDocument()
  })

  it('renders customer name and email fields', () => {
    renderCreateQuote()
    expect(screen.getByPlaceholderText(/customer name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/customer email/i)).toBeInTheDocument()
  })

  it('submits the form and navigates to the new quote', async () => {
    renderCreateQuote()
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText(/paste the customer/i), '60 Bella+Canvas 3001 in Navy')
    await user.click(screen.getByRole('button', { name: /create quote/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/quotes', expect.objectContaining({
        method: 'POST',
      }))
      expect(mockNavigate).toHaveBeenCalledWith('/quotes/GL-00001')
    })
  })

  it('shows an error when submission fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })
    renderCreateQuote()
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText(/paste the customer/i), 'some input')
    await user.click(screen.getByRole('button', { name: /create quote/i }))

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run test:client
```

Expected: FAIL — 5 CreateQuote tests failing.

- [ ] **Step 3: Replace `client/src/pages/CreateQuote.jsx`**

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'

export default function CreateQuote() {
  const navigate = useNavigate()
  const [rawInput, setRawInput] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [projectName, setProjectName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!rawInput.trim() && !customerName.trim()) {
      setError('Please enter the customer inquiry or at least a customer name.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput: rawInput.trim() || null,
          customerName: customerName.trim() || null,
          customerEmail: customerEmail.trim() || null,
          projectName: projectName.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create quote')
      navigate(`/quotes/${data.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface mb-3 inline-block">
            ← Back to ledger
          </Link>
          <h1 className="text-2xl font-bold text-on-surface">New Quote</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Paste the customer's inquiry and Giltee's AI will handle the rest.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Raw input — the main field */}
          <div>
            <label className="block text-xs font-bold tracking-widest text-on-surface-variant uppercase mb-2">
              Customer Inquiry <span className="text-error">*</span>
            </label>
            <textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder="Paste the customer's email, DM, or inquiry here. Include garment style, quantity, colors, decoration method, and any other details."
              rows={8}
              maxLength={10000}
              className="w-full bg-surface-container-low rounded px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            <p className="text-xs text-on-surface-variant mt-1 text-right">
              {rawInput.length}/10,000 characters
            </p>
          </div>

          {/* Optional fields */}
          <div className="bg-surface-container-low rounded p-4 space-y-4">
            <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
              Optional Fields
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="w-full bg-surface rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full bg-surface rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. Staff Shirts 2026, Marathon Run"
                className="w-full bg-surface rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error-container text-on-error-container text-sm rounded p-3">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <Link to="/" className="text-sm text-on-surface-variant hover:text-on-surface">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-on-primary text-sm font-medium px-6 py-2.5 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run test:client
```

Expected: All 5 CreateQuote tests PASS. Total: 24 client tests.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && git add client/src/pages/CreateQuote.jsx client/src/pages/__tests__/CreateQuote.test.jsx && git commit -m "feat: implement CreateQuote page with form and API submission"
```

---

## Task 4: ViewQuote Page

**Files:**
- Modify: `client/src/pages/ViewQuote.jsx` (replace stub)
- Create: `client/src/pages/__tests__/ViewQuote.test.jsx`

This is the most complex page. It shows all pipeline output and has a Run Pipeline button.

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/__tests__/ViewQuote.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import ViewQuote from '../ViewQuote'

const mockUser = { id: 1, name: 'Adam', email: 'adam@giltee.com', role: 'admin' }

const MOCK_QUOTE_DRAFT = {
  id: 'GL-00001',
  status: 'draft',
  customer_name: 'Kohn Law',
  customer_email: 'info@kohnlaw.com',
  project_name: 'Staff Shirts 2026',
  raw_input: '60 Bella+Canvas 3001 Navy, 2-color screen print',
  intake_record: null,
  garment_data: null,
  pricing_osp: null,
  pricing_redwall: null,
  recommended_supplier: null,
  qa_report: null,
  email_draft: null,
  gmail_draft_id: null,
  pdf_url: null,
  activity_log: [],
  created_at: '2026-04-01T10:00:00Z',
  updated_at: '2026-04-01T10:00:00Z',
  created_by: 'adam@giltee.com',
}

const MOCK_QUOTE_READY = {
  ...MOCK_QUOTE_DRAFT,
  status: 'ready',
  intake_record: {
    customer: { name: 'Kohn Law', email: 'info@kohnlaw.com' },
    product: { brand_style: 'Bella+Canvas 3001', quantity: 60, colors: ['Navy'] },
    decoration: { method: 'SCREEN_PRINT', locations: [{ name: 'Front chest', color_count: 2 }] },
    edge_cases: { dark_garment: false },
  },
  garment_data: { style: 'Bella+Canvas 3001', requestedColor: 'Navy', available: true, standardPrice: 4.50 },
  pricing_osp: { perUnitTotal: 11.43, setupFees: { screenSetup: 40 }, orderTotal: 725.80, flags: [] },
  pricing_redwall: { perUnitTotal: 13.02, setupFees: { screenSetup: 96 }, orderTotal: 877.20, flags: [] },
  recommended_supplier: 'OSP',
  qa_report: { status: 'APPROVED', failed: [], reviewer_notes: '' },
  email_draft: 'SUBJECT: Quote — Kohn Law\n\nHi Kohn,\n\nHere is your quote.',
  pdf_url: 'https://drive.google.com/file-123',
  activity_log: [
    { timestamp: '2026-04-01T10:01:00Z', message: 'Pipeline started' },
    { timestamp: '2026-04-01T10:02:00Z', message: 'Pipeline complete' },
  ],
}

function renderViewQuote(quote = MOCK_QUOTE_DRAFT) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => quote,
  })
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
      <MemoryRouter initialEntries={['/quotes/GL-00001']}>
        <Routes>
          <Route path="/quotes/:id" element={<ViewQuote />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => jest.resetAllMocks())

describe('ViewQuote — draft', () => {
  it('renders the quote ID', async () => {
    renderViewQuote()
    await waitFor(() => expect(screen.getByText('GL-00001')).toBeInTheDocument())
  })

  it('shows the customer name', async () => {
    renderViewQuote()
    await waitFor(() => expect(screen.getByText('Kohn Law')).toBeInTheDocument())
  })

  it('shows a Run Pipeline button for draft quotes', async () => {
    renderViewQuote()
    await waitFor(() => expect(screen.getByRole('button', { name: /run pipeline/i })).toBeInTheDocument())
  })
})

describe('ViewQuote — ready', () => {
  it('shows pricing totals', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('$725.80')).toBeInTheDocument())
  })

  it('shows QA status', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText('APPROVED')).toBeInTheDocument())
  })

  it('shows email draft content', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByText(/here is your quote/i)).toBeInTheDocument())
  })

  it('shows PDF link when pdf_url is set', async () => {
    renderViewQuote(MOCK_QUOTE_READY)
    await waitFor(() => expect(screen.getByRole('link', { name: /view pdf/i })).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run test:client
```

Expected: FAIL — 7 ViewQuote tests failing.

- [ ] **Step 3: Replace `client/src/pages/ViewQuote.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'

function formatCurrency(n) {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}`
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase mb-3 mt-6">
      {children}
    </p>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-4 py-2 border-b border-outline-variant/20 last:border-0">
      <span className="text-xs text-on-surface-variant w-40 shrink-0">{label}</span>
      <span className="text-sm text-on-surface">{value ?? '—'}</span>
    </div>
  )
}

export default function ViewQuote() {
  const { id } = useParams()
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)

  const fetchQuote = useCallback(() => {
    fetch(`/api/quotes/${id}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load quote')
        return r.json()
      })
      .then(data => { setQuote(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [id])

  useEffect(() => { fetchQuote() }, [fetchQuote])

  // Poll while processing
  useEffect(() => {
    if (quote?.status !== 'processing') return
    const timer = setInterval(fetchQuote, 3000)
    return () => clearInterval(timer)
  }, [quote?.status, fetchQuote])

  async function handleRunPipeline() {
    setRunning(true)
    setRunError(null)
    try {
      const res = await fetch(`/api/quotes/${id}/run`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pipeline failed')
      setQuote(data)
    } catch (err) {
      setRunError(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="space-y-3">
            {[1, 2, 3].map(n => <div key={n} className="h-10 bg-surface-container-low rounded animate-pulse" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-error-container text-on-error-container text-sm rounded p-4">
            {error || 'Quote not found'}
          </div>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">← Back to ledger</Link>
        </div>
      </div>
    )
  }

  const canRun = ['draft', 'error'].includes(quote.status)
  const intake = quote.intake_record || {}
  const product = intake.product || {}
  const decoration = intake.decoration || {}
  const garment = quote.garment_data || {}
  const osp = quote.pricing_osp || {}
  const redwall = quote.pricing_redwall || {}
  const qa = quote.qa_report || {}
  const logs = Array.isArray(quote.activity_log) ? quote.activity_log : []

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Back link */}
        <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface mb-4 inline-block">
          ← Back to ledger
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold font-mono text-on-surface">{quote.id}</h1>
              <StatusBadge status={quote.status} />
            </div>
            <p className="text-on-surface text-base font-medium">{quote.customer_name || '—'}</p>
            {quote.project_name && (
              <p className="text-on-surface-variant text-sm">{quote.project_name}</p>
            )}
          </div>

          {/* Pipeline button */}
          <div className="flex flex-col items-end gap-2">
            {canRun && (
              <button
                onClick={handleRunPipeline}
                disabled={running}
                className="bg-primary text-on-primary text-sm font-medium px-5 py-2.5 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                {running ? 'Running…' : 'Run Pipeline'}
              </button>
            )}
            {quote.status === 'processing' && (
              <div className="flex items-center gap-2 text-xs text-secondary">
                <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse" />
                Pipeline running…
              </div>
            )}
            {runError && (
              <p className="text-xs text-error max-w-xs text-right">{runError}</p>
            )}
          </div>
        </div>

        {/* Raw Input */}
        {quote.raw_input && (
          <>
            <SectionLabel>Customer Inquiry</SectionLabel>
            <div className="bg-surface-container-low rounded p-4 text-sm text-on-surface whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {quote.raw_input}
            </div>
          </>
        )}

        {/* Intake record */}
        {intake.product && (
          <>
            <SectionLabel>Intake Record</SectionLabel>
            <div className="bg-surface-container-low rounded p-4">
              <InfoRow label="Garment" value={product.brand_style} />
              <InfoRow label="Quantity" value={product.quantity} />
              <InfoRow label="Colors" value={(product.colors || []).join(', ')} />
              <InfoRow label="Decoration" value={decoration.method} />
              <InfoRow label="Locations" value={(decoration.locations || []).map(l => `${l.name} (${l.color_count || l.colorCount || '?'}c)`).join(', ')} />
              <InfoRow label="Dark garment" value={intake.edge_cases?.dark_garment ? 'Yes' : 'No'} />
            </div>
          </>
        )}

        {/* Garment */}
        {garment.style && (
          <>
            <SectionLabel>Garment Availability</SectionLabel>
            <div className="bg-surface-container-low rounded p-4">
              <InfoRow label="Style" value={garment.style} />
              <InfoRow label="Color" value={garment.requestedColor} />
              <InfoRow label="Available" value={garment.available ? '✓ In stock' : '✗ Not available'} />
              <InfoRow label="Base price" value={formatCurrency(garment.standardPrice)} />
              {garment.extendedSkus?.length > 0 && (
                <InfoRow
                  label="Extended sizes"
                  value={garment.extendedSkus.map(s => `${s.size} +${formatCurrency(s.price - garment.standardPrice)}`).join(', ')}
                />
              )}
            </div>
          </>
        )}

        {/* Pricing */}
        {osp.orderTotal != null && (
          <>
            <SectionLabel>Pricing</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {/* OSP */}
              <div className={`rounded p-4 border-2 ${quote.recommended_supplier === 'OSP' ? 'border-primary bg-surface-container-low' : 'border-transparent bg-surface-container-low'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-on-surface-variant uppercase">OSP</p>
                  {quote.recommended_supplier === 'OSP' && (
                    <span className="text-xs bg-secondary-fixed text-primary px-2 py-0.5 rounded font-medium">Recommended</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-on-surface">{formatCurrency(osp.orderTotal)}</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {formatCurrency(osp.perUnitTotal)}/unit
                  {osp.setupFees?.screenSetup > 0 ? ` + ${formatCurrency(osp.setupFees.screenSetup)} setup` : ' (setup waived)'}
                </p>
              </div>
              {/* Redwall */}
              {redwall.orderTotal != null && (
                <div className={`rounded p-4 border-2 ${quote.recommended_supplier === 'REDWALL' ? 'border-primary bg-surface-container-low' : 'border-transparent bg-surface-container-low'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-on-surface-variant uppercase">Redwall</p>
                    {quote.recommended_supplier === 'REDWALL' && (
                      <span className="text-xs bg-secondary-fixed text-primary px-2 py-0.5 rounded font-medium">Recommended</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-on-surface">{formatCurrency(redwall.orderTotal)}</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {formatCurrency(redwall.perUnitTotal)}/unit
                    {redwall.setupFees?.screenSetup > 0 ? ` + ${formatCurrency(redwall.setupFees.screenSetup)} setup` : ' (setup waived)'}
                  </p>
                </div>
              )}
            </div>
            {/* Pricing flags */}
            {osp.flags?.length > 0 && (
              <div className="mt-2 space-y-1">
                {osp.flags.map((f, i) => (
                  <p key={i} className="text-xs text-secondary bg-secondary-fixed/20 rounded px-3 py-1.5">⚠ {f}</p>
                ))}
              </div>
            )}
          </>
        )}

        {/* QA Report */}
        {qa.status && (
          <>
            <SectionLabel>QA Report</SectionLabel>
            <div className="bg-surface-container-low rounded p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-bold ${qa.status === 'APPROVED' ? 'text-secondary' : qa.status === 'BLOCKED' ? 'text-error' : 'text-on-surface'}`}>
                  {qa.status}
                </span>
                {qa.passed_count != null && (
                  <span className="text-xs text-on-surface-variant">
                    {qa.passed_count}/{qa.total_checks || qa.total_count || '?'} checks passed
                  </span>
                )}
              </div>
              {qa.failed?.length > 0 && (
                <div className="space-y-1 mt-2">
                  {qa.failed.map((f, i) => (
                    <p key={i} className="text-xs text-on-error-container bg-error-container rounded px-3 py-1.5">
                      <span className="font-medium">{f.check}:</span> {f.issue}
                    </p>
                  ))}
                </div>
              )}
              {qa.reviewer_notes && (
                <p className="text-xs text-on-surface-variant mt-2 italic">{qa.reviewer_notes}</p>
              )}
            </div>
          </>
        )}

        {/* Email Draft */}
        {quote.email_draft && (
          <>
            <SectionLabel>Email Draft</SectionLabel>
            <div className="bg-surface-container-low rounded p-4">
              <pre className="text-sm text-on-surface whitespace-pre-wrap font-sans leading-relaxed">
                {quote.email_draft}
              </pre>
              {quote.gmail_draft_id && (
                <p className="text-xs text-on-surface-variant mt-3">
                  Gmail draft ID: <span className="font-mono">{quote.gmail_draft_id}</span>
                </p>
              )}
            </div>
          </>
        )}

        {/* PDF / Drive */}
        {quote.pdf_url && (
          <>
            <SectionLabel>Documents</SectionLabel>
            <div className="bg-surface-container-low rounded p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-error shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <a
                href={quote.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary font-medium hover:underline"
              >
                View PDF on Drive
              </a>
            </div>
          </>
        )}

        {/* Activity Log */}
        {logs.length > 0 && (
          <>
            <SectionLabel>Activity Log</SectionLabel>
            <div className="bg-surface-container-low rounded overflow-hidden">
              {logs.map((entry, i) => (
                <div key={i} className={`flex gap-4 px-4 py-2.5 text-xs ${i < logs.length - 1 ? 'border-b border-outline-variant/20' : ''}`}>
                  <span className="text-on-surface-variant shrink-0 font-mono">
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="text-on-surface">{entry.message}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Meta */}
        <div className="mt-8 pt-4 border-t border-outline-variant/30 text-xs text-on-surface-variant flex gap-6">
          <span>Created {new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          {quote.created_by && <span>by {quote.created_by}</span>}
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run test:client
```

Expected: All 7 ViewQuote tests PASS. Total: 31 client tests.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && git add client/src/pages/ViewQuote.jsx client/src/pages/__tests__/ViewQuote.test.jsx && git commit -m "feat: implement ViewQuote page with full pipeline output and run controls"
```

---

## Task 5: NavBar Search Wiring + Final Integration

**Files:**
- Modify: `client/src/components/NavBar.jsx` (wire search to Ledger via URL param)
- No test changes needed — NavBar already tested

The NavBar has a search input that currently does nothing. Wire it so searching navigates to `/?search=<query>`, and update Ledger to read the `search` query param from the URL.

- [ ] **Step 1: Update `client/src/components/NavBar.jsx`** to navigate on search

Read the current NavBar. Find the search input (currently `<input type="text" placeholder="Search ledger..." ...>`).

Replace the search input with a controlled form that navigates on submit:

```jsx
import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function NavBar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  function handleSearch(e) {
    e.preventDefault()
    const q = searchQuery.trim()
    navigate(q ? `/?search=${encodeURIComponent(q)}` : '/')
  }

  return (
    <nav className="bg-surface border-b border-outline-variant/30 px-6 py-0 flex items-center justify-between h-14">
      {/* Left: Wordmark */}
      <NavLink to="/" className="text-primary font-bold text-xl tracking-tight">
        Giltee
      </NavLink>

      {/* Center: Nav links */}
      <div className="flex items-center gap-6">
        {[
          { to: '/', label: 'Dashboard' },
          { to: '/quotes/new', label: 'New Quote' },
          { to: '/clients', label: 'Clients' },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `text-sm font-medium pb-1 border-b-2 transition-colors ${
                isActive
                  ? 'text-primary border-primary'
                  : 'text-on-surface-variant border-transparent hover:text-on-surface'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Right: Search + icons + avatar */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ledger..."
            className="text-sm bg-surface-container-low rounded px-3 py-1.5 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:underline-offset-2 w-44"
          />
        </form>

        {user?.role === 'admin' && (
          <NavLink
            to="/admin/users"
            aria-label="Admin settings"
            className="text-on-surface-variant hover:text-on-surface"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </NavLink>
        )}

        {user && (
          <div
            className="w-8 h-8 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center"
            title={user.name}
          >
            {user.name?.slice(0, 2).toUpperCase() || 'U'}
          </div>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Update `client/src/pages/Ledger.jsx`** to read search from URL

In Ledger.jsx, add `useSearchParams` to read the `?search=` param and pass it to the API:

Add the import at the top:
```jsx
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
```

Then inside the component, add:
```jsx
const [searchParams] = useSearchParams()
const searchQuery = searchParams.get('search') || ''
```

And update the `useEffect` dependency array to include `searchQuery`, and pass it to the fetch URL:
```jsx
useEffect(() => {
  const params = new URLSearchParams()
  if (activeStatus !== 'all') params.set('status', activeStatus)
  if (searchQuery) params.set('search', searchQuery)
  const qs = params.toString() ? `?${params.toString()}` : ''
  fetch(`/api/quotes${qs}`, { credentials: 'include' })
    .then(r => {
      if (!r.ok) throw new Error('Failed to load quotes')
      return r.json()
    })
    .then(data => { setQuotes(data); setLoading(false) })
    .catch(err => { setError(err.message); setLoading(false) })
}, [activeStatus, searchQuery])
```

Also add a search indicator in the header when a search is active:
```jsx
{searchQuery && (
  <p className="text-xs text-on-surface-variant mt-1">
    Searching for "<strong>{searchQuery}</strong>" — <Link to="/" className="text-primary hover:underline">clear</Link>
  </p>
)}
```

- [ ] **Step 3: Run all tests**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm test
```

Expected: All tests pass — server (68+) and client (31+).

The NavBar tests check for wordmark/links/admin gear. If NavBar tests break due to the form wrapper, add `<MemoryRouter>` wrapping in those tests if needed (NavBar now calls `useNavigate`).

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && git add client/src/components/NavBar.jsx client/src/pages/Ledger.jsx && git commit -m "feat: wire NavBar search to Ledger with URL-based filtering"
```

---

## Task 6: Full Test Run + Smoke Test

- [ ] **Step 1: Run full test suite**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm test
```

Expected: All server tests pass + all client tests pass.

- [ ] **Step 2: Start the dev server and smoke test manually**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && npm run dev
```

Manual checks:
1. Visit `http://localhost:5173` → redirects to `/auth/login` → Giltee login page ✓
2. Sign in with admin Google account → redirected to `/` → Ledger page with "No quotes yet" ✓
3. Navigate to `/quotes/new` → CreateQuote form renders ✓
4. Submit a test inquiry → creates quote → redirected to `/quotes/GL-00001` ✓
5. On ViewQuote page → "Run Pipeline" button visible ✓
6. Click "Run Pipeline" → status changes to processing → polls every 3s ✓
7. After pipeline completes → all sections populate (intake, garment, pricing, QA, email, PDF link) ✓
8. Admin gear in NavBar → navigate to `/admin/users` ✓

- [ ] **Step 3: Final commit**

```bash
cd "c:/Users/gilson/OneDrive - Zywave Inc/Documents/Projects/Giltee/Claude Cowork/Quote Generator/Quote Generator App" && git add . && git commit -m "chore: Plan C complete — all frontend pages implemented"
```

---

## Plan C Complete

**What's working after Plan C:**
- Ledger page with status filter tabs, quote table, empty state, loading skeleton
- CreateQuote page with raw input textarea, optional fields, API submission, error handling
- ViewQuote page with full pipeline output: intake record, garment data, pricing comparison (OSP vs Redwall), QA report, email draft, PDF link, activity log
- Run Pipeline button on draft/error quotes with polling while processing
- NavBar search navigates to `/?search=` and Ledger reads it from URL
- StatusBadge component shared across Ledger and ViewQuote
- All 3 page stubs replaced — app is fully functional end to end

**Next: Plan D** (optional) — deploy to Render, configure production Google OAuth, wire Gmail send button to actually send (currently saves as draft).
