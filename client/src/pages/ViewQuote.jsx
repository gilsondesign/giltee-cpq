import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import QuoteForm, { buildEditFields, serializeSizeBreakdown } from '../components/QuoteForm'

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
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [panel, setPanel] = useState(null) // 'qa' | 'email' | 'pdf' | null
  const [sendingDraft, setSendingDraft] = useState(false)
  const [draftResult, setDraftResult] = useState(null) // { draftId } | { error }

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

  async function handleSendDraft() {
    setSendingDraft(true)
    setDraftResult(null)
    try {
      const res = await fetch(`/api/quotes/${id}/draft`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create draft')
      setQuote(q => ({ ...q, gmail_draft_id: data.draftId }))
      setDraftResult({ draftId: data.draftId })
    } catch (err) {
      setDraftResult({ error: err.message })
    } finally {
      setSendingDraft(false)
    }
  }

  function startEditing() {
    setEditFields(buildEditFields(quote))
    setSaveError(null)
    setPanel(null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const f = editFields

      // Build intake_record from form fields
      const intake_record = {
        customer: {
          name: f.customer_name || null,
          email: f.customer_email || null,
          event_purpose: f.event_purpose || null,
          deadline: f.deadline || null,
          rush: f.rush || false,
          returning: f.returning || false,
        },
        product: {
          brand_style: f.brand_style || null,
          quantity: f.quantity ? parseInt(f.quantity, 10) : null,
          colors: f.colors ? f.colors.split(',').map(s => s.trim()).filter(Boolean) : [],
          size_breakdown: serializeSizeBreakdown(f.sizes),
          youth_sizes: f.youth_sizes || false,
        },
        decoration: {
          method: f.decoration_method || null,
          locations: f.locations.filter(l => l.name),
          artwork_status: f.artwork_status || 'UNKNOWN',
          special_inks: f.special_inks ? f.special_inks.split(',').map(s => s.trim()).filter(Boolean) : [],
          stitch_count: f.stitch_count ? parseInt(f.stitch_count, 10) : null,
        },
        edge_cases: {
          extended_sizes: f.extended_sizes || false,
          dark_garment: f.dark_garment || false,
          individual_names: f.individual_names || false,
          shipping_destination: f.shipping_destination || null,
        },
        status: 'READY_FOR_PRICING',
        flags: [],
        missing_fields: [],
      }

      const updates = {
        intake_record,
        customer_name: f.customer_name || null,
        customer_email: f.customer_email || null,
        project_name: f.project_name || null,
        selected_supplier: f.decoration_method === 'SCREEN_PRINT' ? (f.selected_supplier || null) : null,
      }
      if (['ready', 'error'].includes(quote.status)) updates.status = 'draft'

      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setQuote(data)
      setEditing(false)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

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
  const canEdit = quote.status !== 'processing'
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

          {/* Action buttons */}
          <div className="flex flex-col items-end gap-2">
            {!editing && (
              <div className="flex items-center gap-2">
                {/* Output buttons — disabled until quote is ready */}
                <div className="flex rounded border border-outline-variant overflow-hidden">
                  {[
                    { key: 'qa', label: 'QA Report' },
                    { key: 'email', label: 'Email Draft' },
                    { key: 'pdf', label: 'Quote PDF' },
                  ].map(({ key, label }) => {
                    const isReady = quote.status === 'ready'
                    return (
                      <button
                        key={key}
                        onClick={() => setPanel(key)}
                        disabled={!isReady}
                        title={!isReady ? 'Run the quote first' : undefined}
                        className="text-xs font-medium px-3 py-2 border-r border-outline-variant last:border-r-0 text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {canEdit && (
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1.5 border border-outline-variant text-on-surface-variant text-sm font-medium px-4 py-2 rounded hover:bg-surface-container-low transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                    Edit
                  </button>
                )}
                {canRun && (
                  <button
                    onClick={handleRunPipeline}
                    disabled={running}
                    className="bg-primary text-on-primary text-sm font-medium px-5 py-2 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
                  >
                    {running ? 'Running…' : 'Run Quote'}
                  </button>
                )}
              </div>
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

        {/* ── Edit panel ───────────────────────────────────────────────────── */}
        {editing && (
          <div className="bg-surface-container-low rounded border border-outline-variant/40 mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/20 bg-surface-container">
              <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">Edit Quote</p>
              {['ready', 'error'].includes(quote.status) && (
                <span className="text-xs text-on-surface-variant">Saving resets to draft — re-run pipeline after</span>
              )}
            </div>

            <div className="p-5">
              <QuoteForm fields={editFields} setFields={setEditFields} />
            </div>


            {saveError && (
              <p className="px-5 pb-3 text-sm text-error">{saveError}</p>
            )}

            <div className="flex items-center gap-3 px-5 py-4 border-t border-outline-variant/20 bg-surface-container">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary text-on-primary text-sm font-medium px-5 py-2 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}


        {/* Intake record */}
        {intake.product && (
          <>
            <SectionLabel>Intake Record</SectionLabel>
            <div className="bg-surface-container-low rounded p-4">
              <InfoRow label="Garment" value={product.brand_style} />
              <InfoRow label="Quantity" value={product.quantity} />
              <InfoRow label="Colors" value={(product.colors || []).join(', ')} />
              {product.size_breakdown && (
                <div className="flex gap-4 py-2 border-b border-outline-variant/20">
                  <span className="text-xs text-on-surface-variant w-40 shrink-0">Size breakdown</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {product.size_breakdown.split(',').map(s => s.trim()).filter(Boolean).map((entry, i) => (
                      <span key={i} className="text-sm text-on-surface font-mono">{entry}</span>
                    ))}
                  </div>
                </div>
              )}
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
              <InfoRow label="Style" value={garment.resolvedStyle || garment.style} />
              {garment.brandName && <InfoRow label="Brand" value={garment.brandName} />}
              <InfoRow label="Color" value={garment.requestedColor} />
              <InfoRow label="Available" value={garment.available ? '✓ In stock' : '✗ Not available'} />
              <InfoRow label="Base price" value={formatCurrency(garment.standardPrice)} />
              {intake.edge_cases?.extended_sizes && garment.extendedSkus?.length > 0 && (
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
                  <div className="flex items-center gap-1.5">
                    {quote.recommended_supplier === 'OSP' && (
                      <span className="text-xs bg-secondary-fixed text-primary px-2 py-0.5 rounded font-medium">Recommended</span>
                    )}
                    {quote.selected_supplier === 'OSP' && quote.selected_supplier !== quote.recommended_supplier && (
                      <span className="text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-medium">Selected</span>
                    )}
                  </div>
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
                    <div className="flex items-center gap-1.5">
                      {quote.recommended_supplier === 'REDWALL' && (
                        <span className="text-xs bg-secondary-fixed text-primary px-2 py-0.5 rounded font-medium">Recommended</span>
                      )}
                      {quote.selected_supplier === 'REDWALL' && quote.selected_supplier !== quote.recommended_supplier && (
                        <span className="text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-medium">Selected</span>
                      )}
                    </div>
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

        {/* Output modal */}
        {panel && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => { setPanel(null); setDraftResult(null) }}
          >
            <div
              className={`bg-surface rounded-lg shadow-xl flex flex-col overflow-hidden ${panel === 'pdf' ? 'w-[860px] max-h-[90vh]' : 'w-[640px] max-h-[80vh]'}`}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 bg-surface-container shrink-0">
                <p className="text-sm font-semibold text-on-surface">
                  {panel === 'qa' ? 'QA Report' : panel === 'email' ? 'Email Draft' : 'Quote PDF'}
                </p>
                <button onClick={() => { setPanel(null); setDraftResult(null) }} className="text-on-surface-variant hover:text-on-surface transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto flex-1">
                {panel === 'qa' && (
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
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
                      <div className="space-y-1 mb-3">
                        {qa.failed.map((f, i) => (
                          <p key={i} className="text-xs text-on-error-container bg-error-container rounded px-3 py-1.5">
                            <span className="font-medium">{f.check}:</span> {f.issue}
                          </p>
                        ))}
                      </div>
                    )}
                    {qa.reviewer_notes && (
                      <p className="text-xs text-on-surface-variant italic">{qa.reviewer_notes}</p>
                    )}
                  </div>
                )}

                {panel === 'email' && (
                  <div className="p-5">
                    <pre className="text-sm text-on-surface whitespace-pre-wrap font-sans leading-relaxed">
                      {quote.email_draft}
                    </pre>

                    <div className="mt-5 pt-4 border-t border-outline-variant/20 flex items-center gap-3">
                      <button
                        onClick={handleSendDraft}
                        disabled={sendingDraft || !!draftResult?.draftId}
                        className="flex items-center gap-2 bg-primary text-on-primary text-sm font-medium px-4 py-2 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                        {sendingDraft ? 'Saving to Gmail…' : draftResult?.draftId ? 'Saved to Gmail' : 'Save to Gmail Drafts'}
                      </button>

                      {draftResult?.draftId && (
                        <p className="text-xs text-secondary">
                          ✓ Draft saved with PDF attached
                          {quote.gmail_draft_id && <span className="text-on-surface-variant ml-2 font-mono">({quote.gmail_draft_id})</span>}
                        </p>
                      )}
                      {draftResult?.error && (
                        <p className="text-xs text-error">{draftResult.error}</p>
                      )}
                    </div>
                  </div>
                )}

                {panel === 'pdf' && (
                  <>
                    <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/20 bg-surface-container-low shrink-0">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-error shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <span className="text-sm text-on-surface font-medium">{quote.id} Quote.pdf</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-medium hover:underline">
                          Open in new tab
                        </a>
                        <a
                          href={`/api/quotes/${quote.id}/pdf?download=true`}
                          className="flex items-center gap-1.5 bg-primary text-on-primary text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-container transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Download
                        </a>
                      </div>
                    </div>
                    <iframe
                      src={`/api/quotes/${quote.id}/pdf`}
                      className="w-full"
                      style={{ height: '680px', border: 'none' }}
                      title="Quote PDF Preview"
                    />
                    {quote.pdf_url && (
                      <p className="text-xs text-on-surface-variant px-5 py-3">
                        Also saved to{' '}
                        <a href={quote.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Google Drive
                        </a>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
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
                  <span className={entry.error ? 'text-error' : 'text-on-surface'}>
                    {entry.message}
                    {entry.error && <span className="block text-error/80 mt-0.5 font-mono">{entry.error}</span>}
                  </span>
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
