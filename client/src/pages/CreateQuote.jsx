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
