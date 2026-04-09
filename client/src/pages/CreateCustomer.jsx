import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'

function Field({ label, value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
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

function Textarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="text-sm bg-surface border border-outline-variant rounded px-3 py-2 text-on-surface placeholder:text-[#cacaca] focus:outline-none focus:ring-1 focus:ring-primary resize-y"
      />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-surface-container-low rounded border border-outline-variant/40 overflow-hidden">
      <div className="px-5 py-3 border-b border-outline-variant/20 bg-surface-container">
        <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">{title}</p>
      </div>
      <div className="p-5 grid grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

const EMPTY = {
  account_id: '', company_name: '', account_type: '', account_status: 'active',
  drive_folder_url: '', contact_name: '', contact_email: '', phone: '',
  preferred_contact: '', billing_address: '', shipping_address: '',
  decoration_types: '', garment_vendor_pref: '', pantone_colors: '',
  ink_colors: '', print_locations: '', logo_file_location: '',
  sizing_notes: '', garment_style_prefs: '', reorder_likelihood: '',
  next_expected_order: '', account_notes: '',
}

export default function CreateCustomer() {
  const navigate = useNavigate()
  const [f, setF] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function set(key, val) {
    setF(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!f.account_id.trim() || !f.company_name.trim()) {
      setError('Account ID and company name are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create customer')
      navigate(`/customers/${data.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-8">

        <div className="mb-6">
          <Link to="/customers" className="text-xs text-on-surface-variant hover:text-on-surface mb-3 inline-block">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-on-surface">New Account</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <Section title="Account Identity">
            <Field label="Account ID *" value={f.account_id} onChange={v => set('account_id', v)} placeholder="e.g. 0248" />
            <Field label="Company Name *" value={f.company_name} onChange={v => set('company_name', v)} placeholder="Jim's Trucking" />
            <Field label="Account Type" value={f.account_type} onChange={v => set('account_type', v)} placeholder="e.g. Repeat, Event, Corporate" />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-on-surface-variant">Account Status</span>
              <select
                value={f.account_status}
                onChange={e => set('account_status', e.target.value)}
                className="text-sm bg-surface border border-outline-variant rounded px-3 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
            <Field label="Drive Folder URL" value={f.drive_folder_url} onChange={v => set('drive_folder_url', v)} placeholder="https://drive.google.com/…" className="col-span-2" />
          </Section>

          <Section title="Primary Contact">
            <Field label="Contact Name" value={f.contact_name} onChange={v => set('contact_name', v)} placeholder="Jim Hargrove" />
            <Field label="Email" type="email" value={f.contact_email} onChange={v => set('contact_email', v)} placeholder="jim@example.com" />
            <Field label="Phone" value={f.phone} onChange={v => set('phone', v)} placeholder="(414) 555-0100" />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-on-surface-variant">Preferred Contact</span>
              <select
                value={f.preferred_contact}
                onChange={e => set('preferred_contact', e.target.value)}
                className="text-sm bg-surface border border-outline-variant rounded px-3 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">—</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Text">Text</option>
              </select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-xs text-on-surface-variant">Billing Address</span>
                <textarea
                  value={f.billing_address}
                  onChange={e => set('billing_address', e.target.value)}
                  placeholder="123 Diesel Dr, Milwaukee WI 53202"
                  rows={2}
                  className="text-sm bg-surface border border-outline-variant rounded px-3 py-2 text-on-surface placeholder:text-[#cacaca] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-xs text-on-surface-variant">Shipping Address</span>
                <textarea
                  value={f.shipping_address}
                  onChange={e => set('shipping_address', e.target.value)}
                  placeholder="Same as billing, or enter a different address"
                  rows={2}
                  className="text-sm bg-surface border border-outline-variant rounded px-3 py-2 text-on-surface placeholder:text-[#cacaca] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          </Section>


<Section title="Account Notes">
            <div className="col-span-2">
              <Textarea label="" value={f.account_notes} onChange={v => set('account_notes', v)} placeholder="Any notes about this customer…" rows={4} />
            </div>
          </Section>

          {error && (
            <div className="bg-error-container text-on-error-container text-sm rounded p-3">{error}</div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Link to="/customers" className="text-sm text-on-surface-variant hover:text-on-surface">Cancel</Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-on-primary text-sm font-medium px-6 py-2.5 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
