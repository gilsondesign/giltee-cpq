import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import QuoteForm, { buildEditFields, serializeProduct, normalizeIntakeRecord } from '../components/QuoteForm'
import { calcProfitPerUnit, calcProductTotal } from '../utils/profitCalc'

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
  const [profitMode, setProfitMode] = useState('per_shirt')
  const [profitValue, setProfitValue] = useState('0')
  const [qaChecking, setQaChecking] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null) // 'approve' | 'revoke' | null
  const [approveLoading, setApproveLoading] = useState(false)
  const [approveError, setApproveError] = useState(null)

  function saveProfitSettings(mode, value) {
    fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profit_mode: mode, profit_value: parseFloat(value) || 0 }),
    }).catch(() => {}) // silent — live calc doesn't require save success
  }

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

  useEffect(() => {
    if (quote) {
      setProfitMode(quote.profit_mode || 'per_shirt')
      setProfitValue(String(quote.profit_value ?? 0))
    }
  }, [quote?.id, quote?.profit_mode, quote?.profit_value])

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

      const intake_record = {
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

      const hasScreenPrint = (f.products || []).some(p => p.decoration_method === 'SCREEN_PRINT')
      const updates = {
        intake_record,
        customer_name: f.customer_name || null,
        customer_email: f.customer_email || null,
        project_name: f.project_name || null,
        selected_supplier: hasScreenPrint ? (f.selected_supplier || null) : null,
      }
      if (['ready', 'error', 'approved'].includes(quote.status)) {
        updates.status = 'draft'
        updates.approved_at = null
        updates.approved_by = null
      }

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

      // Re-run QA in the background if the quote has already been priced
      const hasPricing = data.pricing_osp?.length > 0 || data.pricing_redwall?.length > 0
      if (hasPricing) {
        setQaChecking(true)
        fetch(`/api/quotes/${id}/qa`, { method: 'POST', credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(result => { if (result?.qa_report) setQuote(prev => ({ ...prev, qa_report: result.qa_report })) })
          .catch(() => {})
          .finally(() => setQaChecking(false))
      }
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

  async function handleApprove() {
    setApproveLoading(true)
    setApproveError(null)
    try {
      const res = await fetch(`/api/quotes/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Approval failed')
      setQuote(data)
      setConfirmModal(null)
    } catch (err) {
      setApproveError(err.message)
    } finally {
      setApproveLoading(false)
    }
  }

  async function handleRevoke() {
    setApproveLoading(true)
    setApproveError(null)
    try {
      const res = await fetch(`/api/quotes/${id}/revoke`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Revocation failed')
      setQuote(data)
      setConfirmModal(null)
    } catch (err) {
      setApproveError(err.message)
    } finally {
      setApproveLoading(false)
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
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">← Back</Link>
        </div>
      </div>
    )
  }

  const canRun = ['draft', 'error'].includes(quote.status)
  const canEdit = quote.status !== 'processing'
  const intake = normalizeIntakeRecord(quote.intake_record)
  const products = intake.products || []
  // Normalize garment/pricing to arrays for backward compat
  const garmentArr = Array.isArray(quote.garment_data) ? quote.garment_data : (quote.garment_data ? [quote.garment_data] : [])
  const ospArr = Array.isArray(quote.pricing_osp) ? quote.pricing_osp : (quote.pricing_osp ? [quote.pricing_osp] : [])
  const rwArr = Array.isArray(quote.pricing_redwall) ? quote.pricing_redwall : (quote.pricing_redwall ? [quote.pricing_redwall] : [])
  // Legacy compat for modal display (single-product totals shown in existing cards)
  const osp = ospArr[0] || {}
  const redwall = rwArr[0] || {}
  const qa = quote.qa_report || {}
  const activeSupplier = quote.selected_supplier || quote.recommended_supplier
  function matchesSupplier(item) {
    if (!item.supplier || item.supplier === 'BOTH') return true
    return item.supplier === activeSupplier
  }
  const qaFailed = (qa.failed || []).filter(matchesSupplier)
  const qaUnverified = (qa.unable_to_verify || []).filter(matchesSupplier)
  const logs = Array.isArray(quote.activity_log) ? quote.activity_log : []

  const activePricingArr = activeSupplier === 'REDWALL' ? rwArr : ospArr
  const totalQty = products.reduce((s, p) => s + (p.quantity || 0), 0)
  const grandTotal = activePricingArr.reduce((s, pricing, i) => {
    if (!pricing) return s
    const qty = products[i]?.quantity || 0
    const profit = calcProfitPerUnit({
      mode: profitMode,
      value: profitValue,
      garmentPerUnit: pricing.perUnitGarment || 0,
      decorationPerUnit: pricing.perUnitDecoration || 0,
      totalQty,
    })
    return s + calcProductTotal({
      garmentPerUnit: pricing.perUnitGarment || 0,
      decorationPerUnit: pricing.perUnitDecoration || 0,
      profitPerUnit: profit,
      qty,
      setupFees: pricing.setupFees,
    })
  }, 0)

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Back link */}
        <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface mb-4 inline-block">
          ← Back
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
                {/* Approve Quote / Revoke Approval */}
                {quote.status === 'ready' && (
                  <button
                    onClick={() => setConfirmModal('approve')}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors"
                  >
                    Approve Quote
                  </button>
                )}
                {quote.status === 'approved' && (
                  <button
                    onClick={() => setConfirmModal('revoke')}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  >
                    Revoke Approval
                  </button>
                )}
                {/* Quote Quality — always available */}
                {(() => {
                  const issueCount = qaFailed.length
                  const hasIssues = issueCount > 0
                  const label = hasIssues
                    ? `Quote Quality · ${issueCount} issue${issueCount !== 1 ? 's' : ''}`
                    : 'Quote Quality'
                  return (
                    <button
                      onClick={() => setPanel('qa')}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded border border-outline-variant hover:bg-surface-container-low transition-colors ${qaChecking ? 'text-on-surface-variant/40' : hasIssues ? 'text-error' : 'text-on-surface-variant'}`}
                    >
                      {qaChecking && (
                        <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {label}
                    </button>
                  )
                })()}

                {/* Output buttons — disabled until quote is ready */}
                <div className="flex rounded border border-outline-variant overflow-hidden">
                  {[
                    { key: 'email', label: 'Email Draft' },
                    { key: 'pdf', label: 'Quote PDF' },
                  ].map(({ key, label }) => {
                    const isReady = ['ready', 'approved'].includes(quote.status)
                    return (
                      <button
                        key={key}
                        onClick={() => setPanel(key)}
                        disabled={!isReady}
                        title={!isReady ? 'Run the quote first' : undefined}
                        className="text-xs font-medium px-3 py-2 border-r border-outline-variant last:border-r-0 hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
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
              {['ready', 'error', 'approved'].includes(quote.status) && (
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


        {/* Products */}
        {!editing && products.length > 0 && (
          <>
            <SectionLabel>Products</SectionLabel>
            <div className="space-y-3">
              {products.map((prod, pi) => {
                const dec = prod.decoration || {}
                const ec = prod.edge_cases || {}
                const garment = garmentArr[pi] || {}
                return (
                  <div key={pi} className="bg-surface-container-low rounded p-4">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
                      Product {pi + 1}{prod.brand_style ? ` — ${prod.brand_style}` : ''}
                    </p>
                    <InfoRow label="Garment" value={prod.brand_style} />
                    <InfoRow label="Quantity" value={prod.quantity} />
                    <InfoRow label="Colors" value={(prod.colors || []).join(', ')} />
                    {prod.size_breakdown && (
                      <div className="flex gap-4 py-2 border-b border-outline-variant/20">
                        <span className="text-xs text-on-surface-variant w-40 shrink-0">Size breakdown</span>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {prod.size_breakdown.split(',').map(s => s.trim()).filter(Boolean).map((entry, i) => (
                            <span key={i} className="text-sm text-on-surface font-mono">{entry}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <InfoRow label="Decoration" value={dec.method} />
                    <InfoRow
                      label="Locations"
                      value={(dec.locations || []).map((l, i) => {
                        const inkNames = (l.ink_colors || l.inkColors || [])
                        const stockNames = inkNames.filter(c => !c.custom).map(c => c.name)
                        const customNames = inkNames.filter(c => c.custom).map(c => c.name)
                        const colorStr = [
                          ...stockNames,
                          ...customNames.map(n => `${n} (custom)`),
                        ].join(', ')
                        return (
                          <span key={i}>
                            {i > 0 && <span className="text-on-surface-variant">, </span>}
                            {l.name} ({l.color_count || l.colorCount || '?'}c{colorStr ? `: ${colorStr}` : ''})
                          </span>
                        )
                      })}
                    />
                    {ec.dark_garment && <InfoRow label="Dark garment" value="Yes" />}
                    {ec.individual_names && <InfoRow label="Individual names" value="Yes" />}
                    {ec.extended_sizes && <InfoRow label="Extended sizes" value="Yes (2XL+)" />}
                    {garment.style && (
                      <div className="flex gap-4 py-2 border-b border-outline-variant/20 last:border-0">
                        <span className="text-xs text-on-surface-variant w-40 shrink-0">Availability</span>
                        {garment.available
                          ? (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-secondary)]">
                              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                              {garment.style}{garment.requestedColor ? ` in ${garment.requestedColor}` : ''}{garment.standardPrice != null ? ` — ${formatCurrency(garment.standardPrice)}/unit` : ''}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-error">
                              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                              {garment.style} — {garment.available === false ? 'not available' : 'not confirmed'}
                            </span>
                          )
                        }
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Profit Margin Editor — builder only, never in PDF/email */}
        {!editing && ospArr.length > 0 && (
          <>
            <SectionLabel>Profit Margin</SectionLabel>
            <div className="bg-surface-container-low rounded p-4 mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Segmented toggle */}
                <div className="flex rounded overflow-hidden border border-outline-variant w-fit">
                  {[
                    { key: 'per_shirt', label: '$ per Shirt' },
                    { key: 'percent', label: '% of Cost' },
                    { key: 'fixed_total', label: '$ Total' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setProfitMode(key)
                        setProfitValue('0')
                        saveProfitSettings(key, 0)
                      }}
                      className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                        profitMode === key
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Value input */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">
                    {profitMode === 'percent' ? '%' : '$'}
                  </span>
                  <input
                    id="profit-value"
                    aria-label="Profit value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={profitValue}
                    onChange={e => setProfitValue(e.target.value)}
                    onBlur={e => saveProfitSettings(profitMode, e.target.value)}
                    className="w-24 text-sm bg-surface border border-outline-variant rounded px-3 py-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-on-surface-variant">
                    {profitMode === 'per_shirt' ? 'per shirt' : profitMode === 'percent' ? 'of cost' : 'total profit'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Pricing */}
        {!editing && (ospArr.length > 0 && ospArr.some(p => p?.orderTotal != null)) && (
          <>
            <SectionLabel>Pricing</SectionLabel>
            {/* Itemized cost breakdown per product */}
            <div className="bg-surface-container-low rounded p-4 mb-3 space-y-4">
              {activePricingArr.map((pricing, i) => {
                if (!pricing) return null
                const prod = products[i]
                const qty = prod?.quantity || 0
                const garment = pricing.perUnitGarment || 0
                const decoration = pricing.perUnitDecoration || 0
                const profit = calcProfitPerUnit({
                  mode: profitMode,
                  value: profitValue,
                  garmentPerUnit: garment,
                  decorationPerUnit: decoration,
                  totalQty,
                })
                const perUnit = Math.round((garment + decoration + profit) * 100) / 100
                const productTotal = calcProductTotal({ garmentPerUnit: garment, decorationPerUnit: decoration, profitPerUnit: profit, qty, setupFees: pricing.setupFees })
                const label = products.length > 1
                  ? `Product ${i + 1}${prod?.brand_style ? ` — ${prod.brand_style}` : ''}`
                  : (prod?.brand_style || 'Product')

                return (
                  <div key={i} className={i > 0 ? 'border-t border-outline-variant/20 pt-4' : ''}>
                    {products.length > 1 && (
                      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">{label}</p>
                    )}
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Garment Cost</span>
                        <span className="text-on-surface">{formatCurrency(garment)}<span className="text-xs text-on-surface-variant">/unit</span></span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Decoration Cost ({activeSupplier === 'REDWALL' ? 'Redwall' : 'OSP'})</span>
                        <span className="text-on-surface">{formatCurrency(decoration)}<span className="text-xs text-on-surface-variant">/unit</span></span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Giltee Profit</span>
                        <span className="text-on-surface">{formatCurrency(profit)}<span className="text-xs text-on-surface-variant">/unit</span></span>
                      </div>
                      <div className="flex justify-between border-t border-outline-variant/20 pt-1 mt-1">
                        <span className="text-on-surface font-medium">Per Unit Total</span>
                        <span className="text-on-surface font-medium">{formatCurrency(perUnit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Product Total <span className="text-xs">({qty} units)</span></span>
                        <span className="text-on-surface font-medium">{formatCurrency(productTotal)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-between border-t-2 border-outline-variant/40 pt-3 mt-2">
                <span className="text-base font-bold text-on-surface">Quote Grand Total</span>
                <span className="text-base font-bold text-on-surface">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
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
                  {panel === 'qa' ? 'Quote Quality' : panel === 'email' ? 'Email Draft' : 'Quote PDF'}
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
                  <div className="p-5 space-y-5">
                    {/* Status banner */}
                    <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                      qa.status === 'APPROVED' ? 'bg-[color:var(--color-secondary-container,#d2f4d3)] text-[color:var(--color-on-secondary-container,#1a3a1b)]'
                      : qa.status === 'BLOCKED' ? 'bg-error-container text-on-error-container'
                      : 'bg-surface-container text-on-surface'
                    }`}>
                      {qa.status === 'APPROVED' ? (
                        <svg className="w-5 h-5 shrink-0 text-[color:var(--color-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : qa.status === 'BLOCKED' ? (
                        <svg className="w-5 h-5 shrink-0 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 shrink-0 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                      )}
                      <div>
                        <p className="text-sm font-bold">
                          {qa.status === 'APPROVED' ? 'Approved' : qa.status === 'BLOCKED' ? 'Blocked' : 'Needs Fixes'}
                        </p>
                        {qa.passed_count != null && (
                          <p className="text-xs opacity-70 mt-0.5">
                            {qa.passed_count} of {qa.total_checks || qa.total_count || '?'} checks passed
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Failed checks */}
                    {qaFailed.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-error uppercase tracking-wider mb-2">Issues</p>
                        <div className="space-y-2">
                          {qaFailed.map((f, i) => (
                            <div key={i} className="flex gap-3 bg-error-container/40 border border-error/20 rounded-lg px-3 py-2.5">
                              <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                              <div>
                                <p className="text-xs font-semibold text-error">{f.check}</p>
                                <p className="text-xs text-on-surface mt-0.5">{f.issue}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unable to verify */}
                    {qaUnverified.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Could Not Verify</p>
                        <div className="space-y-2">
                          {qaUnverified.map((u, i) => (
                            <div key={i} className="flex gap-3 bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5">
                              <svg className="w-4 h-4 text-on-surface-variant shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                              </svg>
                              <div>
                                <p className="text-xs font-semibold text-on-surface">{u.check}</p>
                                <p className="text-xs text-on-surface-variant mt-0.5">{u.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reviewer notes */}
                    {qa.reviewer_notes && (
                      <div className="border-t border-outline-variant/20 pt-4">
                        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Notes</p>
                        <p className="text-sm text-on-surface leading-relaxed">{qa.reviewer_notes}</p>
                      </div>
                    )}

                    {/* Alternative manufacturer cost nudge */}
                    {(() => {
                      const altSupplier = activeSupplier === 'REDWALL' ? 'OSP' : 'Redwall'
                      const altArr = activeSupplier === 'REDWALL' ? ospArr : rwArr
                      const activeDecoTotal = activePricingArr.reduce((s, p) => s + (p?.perUnitDecoration || 0), 0)
                      const altDecoTotal = altArr.reduce((s, p) => s + (p?.perUnitDecoration || 0), 0)
                      const hasAlt = altArr.some(p => p?.perUnitDecoration != null)
                      if (!hasAlt || altDecoTotal >= activeDecoTotal) return null
                      const savings = activeDecoTotal - altDecoTotal
                      return (
                        <div className="border-t border-outline-variant/20 pt-4">
                          <div className="flex gap-3 bg-secondary-fixed/30 border border-secondary/20 rounded-lg px-3 py-2.5">
                            <svg className="w-4 h-4 text-secondary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            <div>
                              <p className="text-xs font-semibold text-secondary">Lower decoration cost available</p>
                              <p className="text-xs text-on-surface mt-0.5">
                                {altSupplier} decoration is {formatCurrency(altDecoTotal)}/unit vs {formatCurrency(activeDecoTotal)}/unit with {activeSupplier === 'REDWALL' ? 'Redwall' : 'OSP'} — saving {formatCurrency(savings)}/unit.
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
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

        {/* ── Confirm Modal ───────────────────────────────────────────── */}
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/60 backdrop-blur-sm">
            <div className="bg-surface-container rounded border border-outline-variant shadow-xl p-6 w-full max-w-sm mx-4">
              <h2 className="text-base font-semibold text-on-surface mb-2">
                {confirmModal === 'approve' ? 'Approve this quote?' : 'Revoke approval?'}
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                {confirmModal === 'approve'
                  ? 'This marks the quote as approved. You can revoke approval at any time.'
                  : 'This returns the quote to Ready status.'}
              </p>
              {approveError && (
                <p className="text-xs text-error mb-4">{approveError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setConfirmModal(null); setApproveError(null) }}
                  disabled={approveLoading}
                  className="text-sm px-4 py-2 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal === 'approve' ? handleApprove : handleRevoke}
                  disabled={approveLoading}
                  className="text-sm px-4 py-2 rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {approveLoading ? 'Working…' : confirmModal === 'approve' ? 'Approve' : 'Revoke'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
