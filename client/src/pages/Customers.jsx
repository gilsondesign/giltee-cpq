import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
]

function CustomerStatusBadge({ status }) {
  const styles = {
    active:   'bg-secondary-container text-on-secondary-container',
    inactive: 'bg-surface-container text-on-surface-variant',
    prospect: 'bg-tertiary-container text-on-tertiary-container',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] || styles.inactive}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
    </span>
  )
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status !== 'all') params.set('status', status)
    const qs = params.toString() ? `?${params.toString()}` : ''
    setLoading(true)
    fetch(`/api/customers${qs}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load customers')
        return r.json()
      })
      .then(data => { setCustomers(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [search, status])

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Customers</h1>
            <p className="text-on-surface-variant text-sm mt-0.5">
              {loading ? 'Loading…' : `${customers.length} customer${customers.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            to="/customers/new"
            className="bg-primary text-on-primary text-sm font-medium px-4 py-2 rounded hover:bg-primary-container transition-colors"
          >
            + New Customer
          </Link>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company or acct #…"
            className="text-sm bg-surface-container-low rounded px-3 py-1.5 text-on-surface placeholder:text-on-surface-variant focus:outline-none w-64"
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="text-sm bg-surface-container-low border border-outline-variant/30 rounded px-3 py-1.5 text-on-surface focus:outline-none"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container text-sm rounded p-3 mb-4">{error}</div>
        )}

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-14 bg-surface-container-low rounded animate-pulse" />
            ))}
          </div>
        )}

        {!loading && !error && customers.length === 0 && (
          <div className="text-center py-16">
            <p className="text-on-surface-variant text-sm mb-4">No customers yet.</p>
            <Link to="/customers/new" className="text-sm text-primary font-medium hover:underline">
              Add your first customer →
            </Link>
          </div>
        )}

        {!loading && !error && customers.length > 0 && (
          <div className="bg-surface-container-low rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  {['Acct #', 'Company', 'Contact', 'Email', 'Orders', 'Last Order', 'Status'].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-bold tracking-wider text-on-surface-variant uppercase">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-surface-container transition-colors cursor-pointer ${i < customers.length - 1 ? 'border-b border-outline-variant/20' : ''}`}
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-on-surface-variant text-xs">{c.account_id}</td>
                    <td className="px-4 py-3 font-semibold text-on-surface">{c.company_name}</td>
                    <td className="px-4 py-3 text-on-surface">{c.contact_name || <span className="text-on-surface-variant italic">—</span>}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{c.contact_email || <span className="italic">—</span>}</td>
                    <td className="px-4 py-3 font-semibold text-primary text-center">
                      {c.totalOrders > 0 ? c.totalOrders : <span className="text-on-surface-variant">0</span>}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">
                      {c.lastOrder
                        ? <Link to={`/quotes/${c.lastOrder.id}`} className="text-primary hover:underline" onClick={e => e.stopPropagation()}>{c.lastOrder.id}</Link>
                        : <span className="italic">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <CustomerStatusBadge status={c.account_status} />
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
