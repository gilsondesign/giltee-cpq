import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'

export default function Ledger() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') || ''

  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('search', searchQuery)
    const qs = params.toString() ? `?${params.toString()}` : ''
    fetch(`/api/quotes${qs}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load quotes')
        return r.json()
      })
      .then(data => { setQuotes(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [searchQuery])

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Quotes</h1>
            <p className="text-on-surface-variant text-sm mt-0.5">
              {loading ? 'Loading…' : `${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`}
            </p>
            {searchQuery && (
              <p className="text-xs text-on-surface-variant mt-1">
                Searching for "<strong>{searchQuery}</strong>" — <Link to="/" className="text-primary hover:underline">clear</Link>
              </p>
            )}
          </div>
          <Link
            to="/quotes/new"
            className="bg-primary text-on-primary text-sm font-medium px-4 py-2 rounded hover:bg-primary-container transition-colors"
          >
            New Quote
          </Link>
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
                  <th className="text-left px-4 py-3 text-xs font-bold tracking-wider text-on-surface-variant uppercase">Account</th>
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
