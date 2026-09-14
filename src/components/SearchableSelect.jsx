import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Searchable dropdown for codes / masters.
 * @param {{
 *   value: string|number|null|undefined,
 *   options: Array<{ value: string|number, label: string, [key: string]: any }>,
 *   onChange: (value: string, option: object|null) => void,
 *   placeholder?: string,
 *   size?: 'sm'|'',
 *   disabled?: boolean,
 *   allowClear?: boolean,
 *   emptyLabel?: string,
 * }} props
 */
export default function SearchableSelect({
  value,
  options = [],
  onChange,
  placeholder = 'Search…',
  size = '',
  disabled = false,
  allowClear = true,
  emptyLabel = '— select —',
}) {
  const id = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value ?? '')) || null,
    [options, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => {
      const hay = `${o.value} ${o.label}`.toLowerCase()
      return hay.includes(q)
    })
  }, [options, query])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const inputClass = size === 'sm' ? 'form-control form-control-sm' : 'form-control'
  const btnClass = size === 'sm' ? 'btn btn-outline-secondary btn-sm' : 'btn btn-outline-secondary'

  function pick(opt) {
    onChange(opt ? String(opt.value) : '', opt || null)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={`ss-select${open ? ' open' : ''}`} ref={rootRef}>
      <div className="input-group">
        <input
          id={id}
          type="text"
          className={inputClass}
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : selected ? selected.label : ''}
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered[0]) pick(filtered[0])
            }
          }}
          autoComplete="off"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          role="combobox"
        />
        {allowClear && selected && !disabled ? (
          <button
            type="button"
            className={btnClass}
            title="Clear"
            onClick={() => pick(null)}
          >
            &times;
          </button>
        ) : null}
        <button
          type="button"
          className={btnClass}
          disabled={disabled}
          aria-label="Toggle options"
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
        </button>
      </div>

      {open ? (
        <div className="ss-menu" id={`${id}-list`} role="listbox">
          <button type="button" className="ss-option muted" onClick={() => pick(null)}>
            {emptyLabel}
          </button>
          {filtered.length === 0 ? (
            <div className="ss-empty">No matches</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                className={`ss-option${String(opt.value) === String(value ?? '') ? ' active' : ''}`}
                onClick={() => pick(opt)}
              >
                <span className="ss-code">{opt.value}</span>
                <span className="ss-label">{opt.label}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
