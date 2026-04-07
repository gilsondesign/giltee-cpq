import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'

function StatPill({ value, label }) {
  return (
    <div className="bg-surface-container rounded-lg px-4 py-3 text-center min-w-[80px]">
      <div className="text-xl font-bold text-primary">{value ?? '—'}</div>
      <div className="text-xs text-on-surface-variant uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <>
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface">{value || <span className="text-on-surface-variant italic">—</span>}</span>
    </>
  )
}

function CustomerStatusBadge({ status }) {
  const styles = {
    active:   'bg-secondary-container text-on-secondary-container',
    inactive: 'bg-surface-container text-on-surface-variant',
    prospect: 'bg-tertiary-container text-on-tertiary-container',
  }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] || styles.inactive}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
    </span>
  )
}

function SectionHeader({ title }) {
  return <div className="text-xs font-bold text-primary uppercase tracking-widest mb-3">{title}</div>
}

const QUOTE_STATUS_COLORS = {
  ready:      'bg-secondary-container text-on-secondary-container',
  draft:      'bg-surface-container text-on-surface-variant',
  processing: 'bg-tertiary-container text-on-tertiary-container',
  sent:       'bg-secondary-container text-on-secondary-container',
  error:      'bg-error-container text-on-error-container',
}

export default function CustomerProfile() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    fetch(`/api/customers/${id}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Customer not found')
        return r.json()
      })
      .then(data => { setCustomer(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [id])

  function startEdit() {
    setEditFields({ ...customer })
    setEditing(true)
    setSaveError(null)
  }

  function cancelEdit() {
    setEditing(false)
    setEditFields({})
    setSaveError(null)
  }

  async function saveEdit() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setCustomer(data)
      setEditing(false)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function set(key, val) {
    setEditFields(prev => ({ ...prev, [key]: val }))
  }

  const f = editing ? editFields : customer

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar />
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-3">
          {[1, 2, 3].map(n => <div key={n} className="h-16 bg-surface-container-low rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar />
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link to="/customers" className="text-xs text-on-surface-variant hover:text-on-surface mb-4 inline-block">← Back</Link>
          <div className="bg-error-container text-on-error-container text-sm rounded p-3">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/customers" className="text-xs text-on-surface-variant hover:text-on-surface">← Back</Link>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={cancelEdit}
                  className="text-xs border border-outline-variant bg-surface rounded px-3 py-1.5 text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="text-xs bg-primary text-on-primary rounded px-3 py-1.5 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={startEdit}
                className="text-xs border border-outline-variant bg-surface rounded px-3 py-1.5 text-on-surface-variant hover:text-on-surface"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <div className="bg-error-container text-on-error-container text-sm rounded p-3 mb-4">{saveError}</div>
        )}

        {/* Header */}
        <div className="bg-surface-container-low rounded border border-outline-variant/40 p-6 mb-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              {editing ? (
                <input
                  value={f.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  className="text-2xl font-bold text-on-surface bg-surface border border-outline-variant rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <h1 className="text-2xl font-bold text-on-surface">{f.company_name}</h1>
              )}
              <p className="text-xs text-on-surface-variant mt-1">
                {(() => { const p = (f.contacts || []).find(c => c.primary) || (f.contacts || [])[0]; return `Acct #${f.account_id}${p?.email ? ' · ' + p.email : ''}${p?.phone ? ' · ' + p.phone : ''}` })()}
              </p>
            </div>
            {editing ? (
              <select
                value={f.account_status}
                onChange={e => set('account_status', e.target.value)}
                className="text-xs bg-surface border border-outline-variant rounded px-2 py-1 text-on-surface focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            ) : (
              <CustomerStatusBadge status={f.account_status} />
            )}
          </div>
          <div className="flex gap-3 mt-4 flex-wrap">
            <StatPill value={customer.totalOrders} label="Orders" />
            <StatPill value={customer.totalUnits} label="Units" />
            <StatPill value={customer.avgOrderSize ?? '—'} label="Avg Size" />
            {customer.lastOrder && (
              <Link to={`/quotes/${customer.lastOrder.id}`}>
                <StatPill value={customer.lastOrder.id} label="Last Order" />
              </Link>
            )}
          </div>
        </div>

        {/* Two-col body */}
        <div className="grid grid-cols-2 gap-6">

          {/* Left column */}
          <div className="space-y-6">

            {/* Contact Information */}
            <div className="bg-surface-container-low rounded border border-outline-variant/40 p-5">
              <SectionHeader title="Contact Information" />
              {editing ? (
                <div className="space-y-3">
                  {(f.contacts || []).map((contact, i) => (
                    <div key={i} className="border border-outline-variant/40 rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        {contact.primary
                          ? <span className="text-xs font-semibold text-primary">Primary</span>
                          : <button type="button" onClick={() => set('contacts', f.contacts.map((c, j) => ({ ...c, primary: j === i })))} className="text-xs text-on-surface-variant hover:text-primary">Make Primary</button>
                        }
                        {f.contacts.length > 1 && !contact.primary && (
                          <button type="button" onClick={() => set('contacts', f.contacts.filter((_, j) => j !== i))} className="text-xs text-error-container bg-error-container/20 hover:bg-error-container/40 px-2 py-0.5 rounded">Remove</button>
                        )}
                      </div>
                      {[['name', 'Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'text']].map(([key, label, type]) => (
                        <input
                          key={key}
                          type={type}
                          placeholder={label}
                          value={contact[key] || ''}
                          onChange={e => set('contacts', f.contacts.map((c, j) => j === i ? { ...c, [key]: e.target.value } : c))}
                          className="w-full text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ))}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => set('contacts', [...(f.contacts || []), { name: '', email: '', phone: '', primary: !(f.contacts?.length > 0) }])}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add Contact
                  </button>
                  <div className="border-t border-outline-variant/30 pt-3 mt-1 grid grid-cols-2 gap-3">
                    {[['billing_address', 'Billing Address', 'text'], ['shipping_address', 'Shipping Address', 'text']].map(([key, label, type]) => (
                      <div key={key} className="flex flex-col gap-1 col-span-2">
                        <span className="text-xs text-on-surface-variant">{label}</span>
                        <input type={type} value={f[key] || ''} onChange={e => set(key, e.target.value)}
                          className="text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(f.contacts || []).length > 0 ? [...(f.contacts || [])].sort((a, b) => b.primary - a.primary).map((contact, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">{contact.name || '—'}</span>
                        {contact.primary && (f.contacts || []).length > 1 && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Primary</span>
                        )}
                      </div>
                      {contact.email && <div className="text-on-surface-variant">{contact.email}</div>}
                      {contact.phone && <div className="text-on-surface-variant">{contact.phone}</div>}
                    </div>
                  )) : <span className="text-xs text-on-surface-variant italic">No contacts</span>}
                  {(f.billing_address || f.shipping_address) && (
                    <div className="border-t border-outline-variant/30 pt-3 grid grid-cols-[110px_1fr] gap-y-2 text-xs">
                      {f.billing_address && <InfoRow label="Billing" value={f.billing_address} />}
                      {f.shipping_address && <InfoRow label="Shipping" value={f.shipping_address} />}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Account Notes */}
            <div className="bg-surface-container-low rounded border border-outline-variant/40 p-5">
              <SectionHeader title="Account Notes" />
              {editing ? (
                <textarea
                  value={f.account_notes || ''}
                  onChange={e => set('account_notes', e.target.value)}
                  rows={4}
                  className="w-full text-sm bg-surface border border-outline-variant rounded px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
              ) : (
                <p className="text-xs text-on-surface leading-relaxed">
                  {f.account_notes || <span className="text-on-surface-variant italic">No notes</span>}
                </p>
              )}
            </div>

          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Order History */}
            <div className="bg-surface-container-low rounded border border-outline-variant/40 p-5">
              <SectionHeader title="Order History" />
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant">Reorder Likelihood</span>
                    <select value={f.reorder_likelihood || ''} onChange={e => set('reorder_likelihood', e.target.value)}
                      className="text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none">
                      <option value="">—</option>
                      <option>High</option><option>Medium</option><option>Low</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant">Next Expected Order</span>
                    <input
                      value={f.next_expected_order || ''}
                      onChange={e => set('next_expected_order', e.target.value)}
                      placeholder="Summer 2026"
                      className="text-sm bg-surface border border-outline-variant rounded px-2 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[130px_1fr] gap-y-2 text-xs">
                  <InfoRow label="Reorder Likelihood" value={f.reorder_likelihood} />
                  <InfoRow label="Next Expected" value={f.next_expected_order} />
                </div>
              )}
            </div>

            {/* Quotes */}
            <div className="bg-surface-container-low rounded border border-outline-variant/40 p-5">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader title="Quotes" />
                <Link
                  to={`/quotes/new?customer=${customer.id}`}
                  className="text-xs bg-primary text-on-primary rounded px-3 py-1.5 hover:bg-primary-container transition-colors"
                >
                  + New Quote
                </Link>
              </div>
              {customer.quotes?.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <div className="grid grid-cols-[100px_1fr_90px] gap-2 px-3 pb-1 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                    <span>Quote #</span>
                    <span>Project</span>
                    <span>Status</span>
                  </div>
                  {customer.quotes.map(q => (
                    <Link
                      key={q.id}
                      to={`/quotes/${q.id}`}
                      className="grid grid-cols-[100px_1fr_90px] gap-2 items-center text-xs px-3 py-2 bg-surface rounded hover:bg-surface-container transition-colors"
                    >
                      <span className="font-semibold text-primary">{q.id}</span>
                      <span className="text-on-surface truncate">{q.project_name || '—'}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${QUOTE_STATUS_COLORS[q.status] || QUOTE_STATUS_COLORS.draft}`}>
                        {q.status}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic">No quotes yet.</p>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
