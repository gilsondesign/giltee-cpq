import { useState, useEffect } from 'react'
import { SettingsShell } from './Admin'

const MANUFACTURERS = ['OSP', 'REDWALL']
const COLOR_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function tierLabel(tier) {
  if (tier.max === null) return `${tier.min}+`
  return `${tier.min}-${tier.max}`
}

function CellInput({ value, onChange }) {
  if (value === null) {
    return <span className="block w-full text-center text-on-surface-variant/50 text-xs py-1.5">n/a</span>
  }
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full text-xs text-center bg-transparent border-0 focus:outline-none focus:bg-primary/5 rounded py-1.5 text-on-surface"
    />
  )
}

function FeeInput({ label, value, onChange, note }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
      <span className="text-xs text-on-surface">{label}{note && <span className="text-on-surface-variant"> {note}</span>}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-on-surface-variant">$</span>
        <input
          type="number"
          step="1"
          min="0"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-16 text-xs text-right bg-surface border border-outline-variant rounded px-2 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  )
}

export default function AdminPricing() {
  const [activeTab, setActiveTab] = useState('OSP')
  const [config, setConfig] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setConfig(null)
    setSaveMsg(null)
    setError(null)
    fetch(`/api/pricing/${activeTab}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load pricing config')
        return r.json()
      })
      .then(data => {
        setConfig(data.config)
        setMeta({ source: data.source, updated_at: data.updated_at, updated_by: data.updated_by })
        setLoading(false)
      })
      .catch(() => { setError('Failed to load pricing config'); setLoading(false) })
  }, [activeTab])

  function updateTierCost(tierIdx, colorIdx, value) {
    setConfig(prev => {
      const tiers = prev.tiers.map((t, i) => {
        if (i !== tierIdx) return t
        const costs = [...t.costs]
        costs[colorIdx] = value
        return { ...t, costs }
      })
      return { ...prev, tiers }
    })
  }

  function updateFee(key, value) {
    setConfig(prev => ({ ...prev, fees: { ...prev.fees, [key]: value } }))
  }

  function updatePrintSize(size, key, value) {
    setConfig(prev => ({
      ...prev,
      printSizes: { ...prev.printSizes, [size]: { ...prev.printSizes[size], [key]: value } }
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    setError(null)
    try {
      const res = await fetch(`/api/pricing/${activeTab}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setMeta({ source: 'db', updated_at: data.updated_at, updated_by: data.updated_by })
      setSaveMsg(`Saved at ${new Date(data.updated_at).toLocaleTimeString()}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsShell>
      {/* Manufacturer tabs */}
      <div className="flex gap-2 mb-6">
        {MANUFACTURERS.map(mfg => (
          <button
            key={mfg}
            role="tab"
            aria-selected={activeTab === mfg}
            onClick={() => setActiveTab(mfg)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
              activeTab === mfg
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {mfg}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(n => <div key={n} className="h-10 bg-surface-container-low rounded animate-pulse" />)}
        </div>
      )}

      {error && <div className="bg-error-container text-on-error-container text-sm rounded p-3 mb-4">{error}</div>}

      {!loading && config && (
        <div className="flex gap-6 items-start">

          {/* Left: Printing cost grid */}
          <div className="flex-1 bg-surface-container-low rounded border border-outline-variant/40 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="text-left px-3 py-2 font-bold tracking-wider text-xs w-24">PRINTING</th>
                  {COLOR_COUNTS.map(c => (
                    <th key={c} className="text-center px-1 py-2 font-bold w-16">{c}c</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.tiers.map((tier, tierIdx) => (
                  <tr key={tierIdx} className="border-b border-outline-variant/20 hover:bg-surface-container/30">
                    <td className="px-3 py-1 font-semibold text-on-surface whitespace-nowrap">{tierLabel(tier)}</td>
                    {COLOR_COUNTS.map((_, colorIdx) => (
                      <td key={colorIdx} className="px-1 py-0.5 border-l border-outline-variant/10">
                        <CellInput
                          value={tier.costs[colorIdx] !== undefined ? tier.costs[colorIdx] : null}
                          onChange={v => updateTierCost(tierIdx, colorIdx, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Static 7500+ row */}
                <tr className="border-b border-outline-variant/20 bg-surface-container/20">
                  <td className="px-3 py-1 font-semibold text-on-surface">7500+</td>
                  {COLOR_COUNTS.map(c => (
                    <td key={c} className="px-1 py-1.5 border-l border-outline-variant/10 text-center text-on-surface-variant/60">call</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right: Fees + Print Sizes */}
          <div className="w-64 space-y-4 shrink-0">

            {/* FEES */}
            <div className="bg-surface-container-low rounded border border-outline-variant/40 p-4">
              <div className="text-xs font-bold text-on-primary bg-primary px-3 py-1.5 rounded -mx-4 -mt-4 mb-3 tracking-wider">FEES</div>
              <FeeInput label="Screen fee per color" value={config.fees.screenFeePerColor} onChange={v => updateFee('screenFeePerColor', v)} />
              <FeeInput label="Repeat screen per color" value={config.fees.repeatScreenPerColor} onChange={v => updateFee('repeatScreenPerColor', v)} />
              <FeeInput label="Ink switch (limit 1 per 25pc)" value={config.fees.inkSwitch} onChange={v => updateFee('inkSwitch', v)} />
              <FeeInput label="Custom PMS ink color" value={config.fees.customPmsInk} onChange={v => updateFee('customPmsInk', v)} />
              <FeeInput label="Art cleanup" value={config.fees.artCleanup ?? 0} onChange={v => updateFee('artCleanup', v)} />
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
                <span className="text-xs text-on-surface">Screen fees waived at</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={config.fees.screenFeeWaivedAt ?? ''}
                    onChange={e => updateFee('screenFeeWaivedAt', parseFloat(e.target.value) || 0)}
                    className="w-16 text-xs text-right bg-surface border border-outline-variant rounded px-2 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-[#cacaca]"
                    placeholder="e.g. 96"
                  />
                  <span className="text-xs text-on-surface-variant">pc</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <label htmlFor={`underbase-${activeTab}`} className="text-xs text-on-surface cursor-pointer">Charge for underbase</label>
                <input
                  id={`underbase-${activeTab}`}
                  type="checkbox"
                  checked={config.fees.chargeForUnderbase ?? false}
                  onChange={e => updateFee('chargeForUnderbase', e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* PRINT SIZES */}
            <div className="bg-surface-container-low rounded border border-outline-variant/40 p-4">
              <div className="text-xs font-bold text-on-primary bg-primary px-3 py-1.5 rounded -mx-4 -mt-4 mb-3 tracking-wider">PRINT SIZES</div>
              <div className="grid grid-cols-3 gap-1 text-xs font-semibold text-on-surface-variant mb-2">
                <span></span><span className="text-center">rate</span><span className="text-center">screen</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center py-1.5 border-b border-outline-variant/20 text-xs">
                <span className="text-on-surface">Standard<br/><span className="text-on-surface-variant">(up to 12x15")</span></span>
                <span className="text-center text-on-surface-variant">—</span>
                <span className="text-center text-on-surface-variant">—</span>
              </div>
              {[
                ['oversized', 'Oversized', '(up to 13x22")'],
                ['jumbo', 'Jumbo', '(up to 17x28")'],
              ].map(([key, label, sub]) => (
                <div key={key} className="grid grid-cols-3 gap-1 items-center py-1.5 border-b border-outline-variant/20 last:border-0 text-xs">
                  <span className="text-on-surface">{label}<br/><span className="text-on-surface-variant">{sub}</span></span>
                  <div className="flex items-center justify-center gap-0.5">
                    <input
                      type="number" min="0" step="1"
                      value={config.printSizes[key].surchargePercent}
                      onChange={e => updatePrintSize(key, 'surchargePercent', parseFloat(e.target.value) || 0)}
                      className="w-10 text-xs text-center bg-surface border border-outline-variant rounded px-1 py-0.5 focus:outline-none"
                    />
                    <span className="text-on-surface-variant">%</span>
                  </div>
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-on-surface-variant">+$</span>
                    <input
                      type="number" min="0" step="1"
                      value={config.printSizes[key].screenFee}
                      onChange={e => updatePrintSize(key, 'screenFee', parseFloat(e.target.value) || 0)}
                      className="w-10 text-xs text-center bg-surface border border-outline-variant rounded px-1 py-0.5 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Save + status */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-on-primary text-sm font-medium py-2 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saveMsg && <p className="text-xs text-secondary text-center">{saveMsg}</p>}
              {meta?.source === 'db' && meta.updated_by && (
                <p className="text-xs text-on-surface-variant text-center">
                  Last updated by {meta.updated_by}
                </p>
              )}
              {meta?.source === 'default' && (
                <p className="text-xs text-on-surface-variant text-center italic">Using default values</p>
              )}
            </div>

          </div>
        </div>
      )}
    </SettingsShell>
  )
}
