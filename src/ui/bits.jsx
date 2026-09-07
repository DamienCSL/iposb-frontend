import { useState } from 'react'
import { apiError, generateSystemCode } from '../api/client'

export function Alert({ error, ok }) {
  if (error) return <div className="alert alert-danger">{error}</div>
  if (ok) return <div className="alert alert-success">{ok}</div>
  return null
}

export function Pager({ page, totalPages, onPage }) {
  if (!totalPages || totalPages <= 1) return null
  const start = Math.max(1, page - 5)
  const end = Math.min(totalPages, page + 5)
  const nums = []
  for (let i = start; i <= end; i += 1) nums.push(i)
  return (
    <nav>
      <ul className="pagination pagination-sm justify-content-center mt-3">
        {nums.map((n) => (
          <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
            <button type="button" className="page-link" onClick={() => onPage(n)}>
              {n}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function money(v) {
  const n = Number(v || 0)
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(n)
}

/**
 * Text input with optional "Generate by system" for identity / document codes.
 */
export function SystemCodeField({
  value,
  onChange,
  kind,
  resource,
  branchCode,
  required = false,
  disabled = false,
  readOnly = false,
  maxLength,
  placeholder,
  className = 'form-control',
  size = '',
  onError,
}) {
  const [busy, setBusy] = useState(false)

  async function onGenerate() {
    if (busy || disabled || readOnly) return
    setBusy(true)
    try {
      const body = { kind }
      if (resource) body.resource = resource
      if (branchCode) body.branchCode = branchCode
      const r = await generateSystemCode(body)
      onChange(r.code || '')
    } catch (e) {
      if (onError) onError(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const btnClass = size === 'sm' ? 'btn btn-outline-secondary btn-sm' : 'btn btn-outline-secondary'
  const inputClass = size === 'sm' && !className.includes('form-control-sm')
    ? `${className} form-control-sm`
    : className

  return (
    <div className="input-group">
      <input
        className={inputClass}
        value={value ?? ''}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {!readOnly && !disabled ? (
        <button
          type="button"
          className={btnClass}
          onClick={onGenerate}
          disabled={busy}
          title="Generate by system"
        >
          {busy ? '…' : 'Generate'}
        </button>
      ) : null}
    </div>
  )
}
