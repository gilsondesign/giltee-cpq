import { useState, useEffect, useRef } from 'react'

export default function CustomerPicker({ linkedCustomerId, linkedCustomer, onLink, onUnlink }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        // silently ignore search errors
      }
    }, 200)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(customer) {
    onLink(customer)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  if (linkedCustomerId && linkedCustomer) {
    return (
      <div className="flex items-center justify-between bg-secondary-container/30 border border-secondary-container rounded-lg px-4 py-3 mb-3">
        <div>
          <div className="font-semibold text-on-surface text-sm">{linkedCustomer.company_name}</div>
          <div className="text-xs text-on-surface-variant mt-0.5">
            Acct #{linkedCustomer.account_id} · {linkedCustomer.contact_email || '—'}
          </div>
        </div>
        <button
          type="button"
          onClick={onUnlink}
          aria-label="Unlink customer"
          className="text-xs text-on-surface-variant hover:text-error ml-4"
        >
          ✕ unlink
        </button>
      </div>
    )
  }

  return (
    <div className="relative mb-3" ref={containerRef}>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-on-surface-variant">Link to account</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by company or acct #…"
          className="text-sm bg-surface border border-outline-variant rounded px-3 py-1.5 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface border border-outline-variant/40 rounded shadow-lg">
          {results.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20 last:border-0"
            >
              <div>
                <span className="font-semibold text-on-surface">{c.company_name}</span>
                {c.contact_email && (
                  <span className="text-on-surface-variant text-xs ml-2">· {c.contact_email}</span>
                )}
              </div>
              <span className="font-mono text-xs text-on-surface-variant">{c.account_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
