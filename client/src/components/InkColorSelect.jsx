// client/src/components/InkColorSelect.jsx
import { useState, useRef, useEffect } from 'react'

export default function InkColorSelect({ value = [], onChange, stockColors = null, customFee = 0 }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCustomEntry, setShowCustomEntry] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setShowCustomEntry(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = (stockColors || []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggleStock(color) {
    const idx = value.findIndex(v => v.name === color.name)
    if (idx >= 0) onChange(value.filter((_, i) => i !== idx))
    else onChange([...value, { name: color.name, custom: false }])
  }

  function addCustom() {
    const name = customInput.trim()
    if (!name) return
    onChange([...value, { name, custom: true }])
    setCustomInput('')
    setShowCustomEntry(false)
  }

  function removeColor(i) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  const customCount = value.filter(v => v.custom).length
  const hasCustom = customCount > 0

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        className="flex flex-wrap gap-1 items-center min-h-[32px] text-sm bg-surface border border-outline-variant rounded px-2 py-1 cursor-pointer hover:border-primary/50"
      >
        {value.length === 0 && (
          <span className="text-on-surface-variant text-xs">Ink colors…</span>
        )}
        {value.map((c, i) => {
          const stock = (stockColors || []).find(s => s.name === c.name)
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${
                c.custom
                  ? 'border-amber-600/60 text-amber-400'
                  : 'border-outline-variant text-on-surface'
              }`}
            >
              {stock && (
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-white/10"
                  style={{ background: stock.hex }}
                />
              )}
              {c.name}
              <button
                type="button"
                aria-label="✕"
                onClick={e => { e.stopPropagation(); removeColor(i) }}
                className="text-on-surface-variant hover:text-error ml-0.5 leading-none"
              >
                ✕
              </button>
            </span>
          )
        })}
        <span className="ml-auto text-on-surface-variant text-[10px] pl-1">▾</span>
      </div>

      {/* Fee warning */}
      {hasCustom && customFee > 0 && (
        <p className="text-xs text-amber-400 mt-0.5">
          +${customFee * customCount} custom PMS fee
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-surface border border-outline-variant rounded shadow-xl">
          {stockColors && stockColors.length > 0 && (
            <>
              <div className="p-2 border-b border-outline-variant/30">
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search colors…"
                  className="w-full text-xs bg-surface border border-outline-variant rounded px-2 py-1 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <p className="px-3 pt-1.5 pb-0.5 text-[10px] text-on-surface-variant uppercase tracking-wide">
                  Stock — no upcharge
                </p>
                {filtered.map(c => {
                  const selected = value.some(v => v.name === c.name)
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => toggleStock(c)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-container ${
                        selected ? 'text-primary' : 'text-on-surface'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-sm border border-white/10 flex-shrink-0"
                        style={{ background: c.hex }}
                      />
                      <span className="flex-1">{c.name}</span>
                      {selected && <span className="text-primary text-[10px]">✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="border-t border-outline-variant/30 p-2">
            {!showCustomEntry ? (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowCustomEntry(true) }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-amber-400 hover:bg-surface-container rounded"
              >
                <span className="w-4 h-4 border border-dashed border-amber-600 rounded-sm flex-shrink-0 flex items-center justify-center text-[8px]">
                  ✎
                </span>
                Custom PMS…{customFee > 0 ? ` (+$${customFee})` : ''}
              </button>
            ) : (
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustom()}
                  placeholder="e.g. PMS 286 C"
                  className="flex-1 text-xs bg-surface border border-amber-600/60 rounded px-2 py-1 text-amber-400 placeholder:text-amber-900 focus:outline-none"
                  onClick={e => e.stopPropagation()}
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="text-xs text-amber-400 px-1.5 hover:text-amber-300"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
