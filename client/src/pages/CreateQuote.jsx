import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import QuoteForm, { buildEditFields, serializeProduct } from '../components/QuoteForm'

function buildIntakeRecord(f) {
  return {
    customer: {
      name: f.customer_name || null,
      email: f.customer_email || null,
      event_purpose: f.event_purpose || null,
      deadline: f.deadline || null,
      rush: f.rush || false,
      returning: f.returning || false,
    },
    products: (f.products || []).map(serializeProduct),
    notes: f.notes || null,
    local_pickup: f.local_pickup || false,
    shipping_address: f.shipping_address || null,
    shipping_city: f.shipping_city || null,
    shipping_state: f.shipping_state || null,
    shipping_zip: f.shipping_zip || null,
    status: 'READY_FOR_PRICING',
    flags: [],
    missing_fields: [],
  }
}

export default function CreateQuote() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('form') // 'form' | 'inquiry'
  const [formFields, setFormFields] = useState(buildEditFields({}))
  const [rawInput, setRawInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()

  // Pre-link customer if ?customer= is in the URL (e.g. from CustomerProfile "+ New Quote" button)
  useEffect(() => {
    const customerId = searchParams.get('customer')
    if (!customerId) return
    fetch(`/api/customers/${customerId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(c => {
        if (!c) return
        setFormFields(prev => ({
          ...prev,
          customer_id: c.id,
          linked_customer: c,
          customer_name: c.company_name,
          customer_email: c.contact_email || '',
        }))
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmitForm(e) {
    e.preventDefault()
    const f = formFields
    if (!f.customer_name.trim() || !f.customer_email.trim() || !f.project_name.trim()) {
      setError('Customer name, email, and project name are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        customerName: f.customer_name.trim(),
        customerEmail: f.customer_email.trim(),
        projectName: f.project_name.trim(),
        intake_record: buildIntakeRecord(f),
      }
      if (f.customer_id) body.customer_id = f.customer_id
      if (f.selected_supplier) body.selected_supplier = f.selected_supplier

      const res = await fetch('/api/quotes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create quote')
      navigate(`/quotes/${data.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  async function handleSubmitInquiry(e) {
    e.preventDefault()
    if (!rawInput.trim()) {
      setError('Please paste the customer inquiry.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: rawInput.trim() }),
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
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-on-surface">New Quote</h1>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-surface-container-low rounded p-1 mb-6 w-fit">
          <button
            type="button"
            onClick={() => { setMode('form'); setError(null) }}
            className={`text-sm px-4 py-1.5 rounded transition-colors ${mode === 'form' ? 'bg-surface text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Fill out form
          </button>
          <button
            type="button"
            onClick={() => { setMode('inquiry'); setError(null) }}
            className={`text-sm px-4 py-1.5 rounded transition-colors ${mode === 'inquiry' ? 'bg-surface text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Paste inquiry
          </button>
        </div>

        {/* Form mode */}
        {mode === 'form' && (
          <form onSubmit={handleSubmitForm} className="space-y-5">
            <div className="bg-surface-container-low rounded border border-outline-variant/40 overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant/20 bg-surface-container">
                <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">Quote Details</p>
              </div>
              <div className="p-5">
                <QuoteForm fields={formFields} setFields={setFormFields} />
              </div>
            </div>

            {error && (
              <div className="bg-error-container text-on-error-container text-sm rounded p-3">{error}</div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Link to="/" className="text-sm text-on-surface-variant hover:text-on-surface">Cancel</Link>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-on-primary text-sm font-medium px-6 py-2.5 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                {submitting ? 'Creating…' : 'Create Quote'}
              </button>
            </div>
          </form>
        )}

        {/* Inquiry mode */}
        {mode === 'inquiry' && (
          <form onSubmit={handleSubmitInquiry} className="space-y-5">
            <div className="bg-surface-container-low rounded border border-outline-variant/40 overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant/20 bg-surface-container">
                <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">Customer Inquiry</p>
                <p className="text-xs text-on-surface-variant mt-1">Paste the customer's email, DM, or message — the AI will interpret it into quote details.</p>
              </div>
              <div className="p-5">
                <textarea
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  placeholder="Paste the customer's email, DM, or inquiry here. Include garment style, quantity, colors, decoration method, and any other details."
                  rows={12}
                  maxLength={10000}
                  className="w-full bg-surface rounded px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
                <p className="text-xs text-on-surface-variant mt-1 text-right">{rawInput.length}/10,000 characters</p>
              </div>
            </div>

            {error && (
              <div className="bg-error-container text-on-error-container text-sm rounded p-3">{error}</div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Link to="/" className="text-sm text-on-surface-variant hover:text-on-surface">Cancel</Link>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-on-primary text-sm font-medium px-6 py-2.5 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                {submitting ? 'Creating…' : 'Create Quote'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
