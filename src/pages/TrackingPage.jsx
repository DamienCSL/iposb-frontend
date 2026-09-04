import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiError, getTracking } from '../api/client'
import CancelConsignmentModal from '../components/CancelConsignmentModal'
import { money } from '../ui/bits'

const SESSION_KEY = 'fms.ops.cn_tracking'
const MAX_TABS = 50

function parseCnCodes(raw) {
  const parts = String(raw || '')
    .split(/[\s,;|]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
  const out = []
  for (const p of parts) {
    if (!out.includes(p)) out.push(p)
    if (out.length >= MAX_TABS) break
  }
  return out
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const list = Array.isArray(parsed?.list) ? parsed.list.map((c) => String(c).toUpperCase()) : []
    const tab = String(parsed?.tab || '')
    return { list, tab: list.includes(tab) ? tab : list[list.length - 1] || '' }
  } catch {
    return { list: [], tab: '' }
  }
}

function saveSession(list, tab) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ list, tab, updated_at: Date.now() }))
}

function toneBadge(tone) {
  switch (tone) {
    case 'success':
      return 'bg-success'
    case 'danger':
      return 'bg-danger'
    case 'warning':
      return 'bg-warning text-dark'
    case 'primary':
      return 'bg-primary'
    case 'info':
      return 'bg-info text-dark'
    default:
      return 'bg-secondary'
  }
}

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

export default function TrackingPage() {
  const [params] = useSearchParams()
  const initial = useMemo(() => loadSession(), [])
  const [cn, setCn] = useState('')
  const [bulk, setBulk] = useState('')
  const [list, setList] = useState(initial.list)
  const [active, setActive] = useState(initial.tab)
  const [panels, setPanels] = useState({})
  const [loading, setLoading] = useState(false)
  const [cancelCn, setCancelCn] = useState(null)
  const [cancelMsg, setCancelMsg] = useState('')

  useEffect(() => {
    const fromQuery = parseCnCodes(params.get('cn') || '')
    const tabHint = String(params.get('tab') || '').toUpperCase()
    if (fromQuery.length) {
      const next = []
      for (const code of fromQuery) {
        if (!next.includes(code) && next.length < MAX_TABS) next.push(code)
      }
      const tab = next.includes(tabHint) ? tabHint : next[next.length - 1]
      persist(next, tab)
      loadPanel(tab)
      return
    }
    if (initial.tab) {
      loadPanel(initial.tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist(nextList, nextTab) {
    setList(nextList)
    setActive(nextTab)
    saveSession(nextList, nextTab)
  }

  async function loadPanel(code) {
    setLoading(true)
    try {
      const data = await getTracking(code)
      setPanels((prev) => ({ ...prev, [code]: { found: true, data } }))
    } catch (err) {
      const status = err?.response?.status
      setPanels((prev) => ({
        ...prev,
        [code]: {
          found: false,
          error: status === 404 ? null : apiError(err),
        },
      }))
    } finally {
      setLoading(false)
    }
  }

  async function addCodes(codes) {
    if (codes.length === 0) return
    const next = [...list]
    for (const code of codes) {
      if (!next.includes(code) && next.length < MAX_TABS) next.push(code)
    }
    const tab = codes[codes.length - 1]
    persist(next, tab)
    await loadPanel(tab)
  }

  async function onSubmit(e) {
    e.preventDefault()
    const fromSingle = parseCnCodes(cn)
    const fromBulk = parseCnCodes(bulk)
    const codes = [...fromSingle, ...fromBulk.filter((c) => !fromSingle.includes(c))]
    setCn('')
    setBulk('')
    await addCodes(codes)
  }

  function clearAll() {
    if (!window.confirm('Clear all open consignment tabs?')) return
    persist([], '')
    setPanels({})
    sessionStorage.removeItem(SESSION_KEY)
  }

  function closeTab(code) {
    const next = list.filter((c) => c !== code)
    const tab = active === code ? next[next.length - 1] || '' : active
    persist(next, tab)
    if (tab && !panels[tab]) loadPanel(tab)
  }

  function selectTab(code) {
    persist(list, code)
    if (!panels[code]) loadPanel(code)
  }

  const panel = panels[active]
  const data = panel?.data
  const cancellation = data?.cancellation
  const events = Array.isArray(data?.timeline) ? [...data.timeline].reverse() : []
  const failedAttempts = Array.isArray(data?.scanAttempts) ? data.scanAttempts : []

  return (
    <div>
      <h3 className="mb-3">Consignment Tracking</h3>
      {cancelMsg ? <div className="alert alert-success">{cancelMsg}</div> : null}

      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={onSubmit}>
            <div className="col-md-4">
              <label className="form-label">Add consignment</label>
              <input
                type="text"
                className="form-control"
                value={cn}
                onChange={(e) => setCn(e.target.value)}
                placeholder="e.g. BBB0810000001"
                autoFocus
              />
              <div className="form-text">
                {list.length
                  ? 'Adds another tab. Open tabs are remembered when you leave this page.'
                  : 'Track one CN, then add more. Tabs are kept until you clear them or log out.'}
              </div>
            </div>
            <div className="col-md-5">
              <label className="form-label">Or paste multiple</label>
              <textarea
                className="form-control"
                rows={2}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder="One per line, or comma / space separated"
              />
            </div>
            <div className="col-md-3 d-flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-plus-lg" /> {list.length ? 'Add to tabs' : 'Track'}
              </button>
              {list.length ? (
                <button type="button" className="btn btn-outline-secondary" onClick={clearAll}>
                  Clear all
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="alert alert-light border">
          Enter one or more consignment numbers to open tracking tabs. Your open tabs are saved for this login —
          leave FMS and come back anytime.
        </div>
      ) : (
        <>
          <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
            <div className="text-muted small">
              {list.length} consignment{list.length === 1 ? '' : 's'} open (max {MAX_TABS}) · remembered for this
              session
            </div>
          </div>

          <div className="trk-tabs" role="tablist">
            {list.map((code) => {
              const p = panels[code]
              const missing = p && !p.found
              const scanLabel = p?.data?.scanningType || ''
              return (
                <button
                  key={code}
                  type="button"
                  className={`trk-tab${code === active ? ' active' : ''}${missing ? ' missing' : ''}`}
                  onClick={() => selectTab(code)}
                >
                  <span className="tab-label">{code}</span>
                  {missing ? (
                    <span className="badge text-bg-danger" style={{ fontSize: '0.65rem' }}>
                      ?
                    </span>
                  ) : scanLabel ? (
                    <span className="badge text-bg-light border" style={{ fontSize: '0.65rem' }}>
                      {scanLabel}
                    </span>
                  ) : null}
                  <span
                    className="tab-close"
                    title="Close tab"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(code)
                    }}
                  >
                    &times;
                  </span>
                </button>
              )
            })}
          </div>

          {loading && !panel ? <p className="text-muted">Looking up…</p> : null}

          {panel?.error ? (
            <div className="alert alert-danger">Tracking query failed: {panel.error}</div>
          ) : panel && !panel.found ? (
            <div className="alert alert-warning">
              Consignment number <strong>{active}</strong> not found. Close this tab or try another number.
            </div>
          ) : data ? (
            <>
              <div className="card mb-3">
                <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h5 className="mb-0">CN: {data.cnNo || active}</h5>
                  <span className={`badge ${toneBadge(data.scanningTone)}`}>{data.scanningType || data.shortLabel}</span>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <table className="table table-sm">
                        <tbody>
                          <tr>
                            <th width="150">Origin</th>
                            <td>{data.origin || '—'}</td>
                          </tr>
                          <tr>
                            <th>Destination</th>
                            <td>{data.destination || '—'}</td>
                          </tr>
                          <tr>
                            <th>Recipient</th>
                            <td>{data.recipientName || '—'}</td>
                          </tr>
                          <tr>
                            <th>Location</th>
                            <td>{data.location || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="col-md-6">
                      <table className="table table-sm">
                        <tbody>
                          <tr>
                            <th width="150">Status</th>
                            <td>
                              <span className={`badge ${toneBadge(data.scanningTone)}`}>
                                {data.scanningType || data.shortLabel}
                              </span>
                              <span className="text-muted small ms-1">{data.statusCode}</span>
                              <div className="mt-1">{data.customerLabel}</div>
                            </td>
                          </tr>
                          <tr>
                            <th>Payment</th>
                            <td>
                              {data.isCod || data.payMode === 'COD' ? (
                                <span className="badge text-bg-warning">COD</span>
                              ) : (
                                <span className="badge text-bg-light border">{data.payMode || 'PPD'}</span>
                              )}
                              {(data.isCod || data.payMode === 'COD') ? (
                                <div className="small mt-1">
                                  Status: <strong>{data.codStatus || 'PENDING'}</strong>
                                  {data.expectedAmt != null ? <> · Due {money(data.expectedAmt)}</> : null}
                                  {data.collectedAmt != null && Number(data.collectedAmt) > 0 ? (
                                    <> · Collected {money(data.collectedAmt)}</>
                                  ) : null}
                                  <div className="mt-1">
                                    <Link to={`/billing/cod?cn=${encodeURIComponent(data.cnNo || active)}`}>
                                      Open COD outstanding
                                    </Link>
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                          <tr>
                            <th>Delivery Date</th>
                            <td>{data.podDate || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {cancellation?.cancelled ? (
                <div className="card mb-3 border-warning">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <strong>Cancellation record</strong>
                    <span className="badge bg-danger">Cancelled</span>
                  </div>
                  <div className="card-body">
                    <div className="row g-2 small">
                      <div className="col-md-3">
                        Processing fee:{' '}
                        <strong className="text-danger">{money(cancellation.feeAmt)}</strong> ({cancellation.feePct}%)
                      </div>
                      <div className="col-md-3">
                        Wallet refund: <strong className="text-success">{money(cancellation.refundAmt)}</strong>
                      </div>
                      <div className="col-md-3">Credit note: {cancellation.creditNoteNo || '—'}</div>
                      <div className="col-md-3">By: {cancellation.cancelledBy || '—'}</div>
                      {cancellation.reason ? (
                        <div className="col-12 text-muted">Reason: {cancellation.reason}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : data.statusCode !== 'CAN' ? (
                <div className="mb-3">
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setCancelCn(active)}>
                    Cancel this consignment…
                  </button>
                </div>
              ) : null}

              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="mb-0">Tracking Info</h5>
                <span className="text-muted small">
                  {events.length} event{events.length === 1 ? '' : 's'}
                </span>
              </div>
              {events.length === 0 ? (
                <div className="alert alert-secondary">No tracking history found.</div>
              ) : (
                <div className="table-responsive trk-table">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: '3.5rem' }}>No.</th>
                        <th style={{ width: '10.5rem' }}>Scanning Time</th>
                        <th style={{ width: '11rem' }}>Scanning Type</th>
                        <th>Tracking Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev, i) => (
                        <tr key={`${ev.at}-${i}`}>
                          <td className="text-muted">{events.length - i}</td>
                          <td className="text-nowrap">{formatWhen(ev.at)}</td>
                          <td>
                            <div className={`trk-type tone-${ev.scanningTone || 'muted'}`}>
                              {ev.scanningType || ev.shortLabel}
                            </div>
                            <div className="trk-code">{ev.statusCode}</div>
                          </td>
                          <td>
                            {ev.trackingRecord || ev.customerLabel || ev.note || '—'}
                            {ev.location ? <div className="text-muted small mt-1">{ev.location}</div> : null}
                            {ev.evidenceUrl ? (
                              <div className="mt-1">
                                <a href={ev.evidenceUrl} target="_blank" rel="noreferrer" className="small">
                                  <i className="bi bi-image" /> View proof photo
                                </a>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {failedAttempts.length > 0 ? (
                <>
                  <h5 className="mb-2 mt-4">Failed scan attempts</h5>
                  <div className="table-responsive trk-table mb-3">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Attempted</th>
                          <th>Error</th>
                          <th>Proof</th>
                        </tr>
                      </thead>
                      <tbody>
                        {failedAttempts.map((row) => (
                          <tr key={row.id || `${row.at}-${row.attemptedStatus}`}>
                            <td className="text-nowrap">{formatWhen(row.at)}</td>
                            <td>{row.attemptedStatus || '—'}</td>
                            <td>
                              <span className="text-danger">{row.errorMessage || row.errorCode}</span>
                            </td>
                            <td>
                              {row.evidenceUrl ? (
                                <a href={row.evidenceUrl} target="_blank" rel="noreferrer" className="small">
                                  View photo
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {cancelCn ? (
        <CancelConsignmentModal
          cn={cancelCn}
          onClose={() => setCancelCn(null)}
          onDone={(result) => {
            setCancelMsg(result.message || 'Cancellation updated.')
            loadPanel(cancelCn)
            setCancelCn(null)
          }}
        />
      ) : null}
    </div>
  )
}
