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
