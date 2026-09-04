import { useEffect, useMemo, useState } from 'react'
import {
  accrueCommission,
  advanceCommissionWithdrawal,
  apiError,
  getCommissionConfig,
  listCommissionWithdrawals,
  listCommissions,
  listPartnerWallets,
  requestCommissionWithdrawal,
  updateCommissionConfig,
  verifyCommission,
} from '../api/client'
import { Alert, money } from '../ui/bits'

const TABS = [
  { id: 'rates', label: 'Rate settings' },
  { id: 'ledger', label: 'Commission ledger' },
  { id: 'wallets', label: 'Partner wallets' },
  { id: 'withdrawals', label: 'Withdrawals' },
]

const ROLE_ICONS = {
  drop_point: 'bi-shop',
  driver: 'bi-truck',
  dispatcher: 'bi-headset',
}

function fieldValue(config, field) {
  if (!config) return ''
  if (field.type === 'bool') {
    return config[field.key] === true || config[field.key] === 1 || config[field.key] === '1'
  }
  const v = config[field.key]
  return v == null ? '' : v
}

export default function CommissionPage() {
  const [tab, setTab] = useState('rates')
  const [config, setConfig] = useState(null)
  const [draft, setDraft] = useState({})
  const [roleTab, setRoleTab] = useState('drop_point')
  const [saving, setSaving] = useState(false)
  const [ledger, setLedger] = useState({ rows: [], total: 0 })
  const [wallets, setWallets] = useState({ rows: [] })
  const [withdrawals, setWithdrawals] = useState({ rows: [] })
  const [status, setStatus] = useState('PROCESSING')
  const [cn, setCn] = useState('')
  const [accrueCn, setAccrueCn] = useState('')
  const [withdrawForm, setWithdrawForm] = useState({ partnerCode: '', amount: '', note: '' })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const roles = useMemo(() => config?.roles || [], [config])
  const activeRole = roles.find((r) => r.id === roleTab) || roles[0]

  function syncDraft(cfg) {
    const next = {}
    for (const role of cfg?.roles || []) {
      for (const field of role.fields || []) {
        next[field.key] = fieldValue(cfg, field)
      }
    }
    setDraft(next)
  }

  async function load() {
    setError('')
    try {
      const cfg = await getCommissionConfig()
      setConfig(cfg)
      syncDraft(cfg)
      if (!roles.length && cfg.roles?.[0]) setRoleTab(cfg.roles[0].id)
      if (tab === 'ledger') {
        setLedger(await listCommissions({ status: status === 'ALL' ? '' : status, cn: cn || undefined }))
      } else if (tab === 'wallets') {
        setWallets(await listPartnerWallets())
      } else if (tab === 'withdrawals') {
        setWithdrawals(await listCommissionWithdrawals({ status: 'ALL' }))
      }
    } catch (e) {
      setError(apiError(e))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status])

  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function onSaveRates(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setOk('')
    try {
      const payload = {}
      for (const role of roles) {
        for (const field of role.fields || []) {
          let v = draft[field.key]
          if (field.type === 'bool') v = !!v
          payload[field.key] = v
        }
      }
      const r = await updateCommissionConfig(payload)
      setConfig(r.config || r)
      syncDraft(r.config || r)
      setOk('Commission rates saved. New deliveries will use these amounts.')
    } catch (err) {
      setError(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onVerify(id) {
    try {
      await verifyCommission(id)
      setOk('Commission verified and released to wallet.')
      load()
    } catch (e) {
      setError(apiError(e))
    }
  }

  async function onAccrue(e) {
    e.preventDefault()
    if (!accrueCn.trim()) return
    try {
      const r = await accrueCommission(accrueCn.trim().toUpperCase())
      setOk(r.skipped ? `Skipped: ${r.reason}` : `Commission accrued for ${r.cnNo}`)
      setAccrueCn('')
      load()
    } catch (err) {
      setError(apiError(err))
    }
  }

  async function onWithdraw(e) {
    e.preventDefault()
    try {
      await requestCommissionWithdrawal(withdrawForm.partnerCode, {
        amount: withdrawForm.amount,
        note: withdrawForm.note,
      })
      setOk('Withdrawal requested.')
      setWithdrawForm({ partnerCode: '', amount: '', note: '' })
      load()
    } catch (err) {
      setError(apiError(err))
    }
  }

  async function onAdvance(id, action) {
    try {
      await advanceCommissionWithdrawal(id, action)
      setOk(`Withdrawal ${action}.`)
      load()
    } catch (e) {
      setError(apiError(e))
    }
  }

  const rows = ledger.rows || []
  const walletRows = wallets.rows || []
  const wdRows = withdrawals.rows || []

  return (
    <div>
      <h3 className="mb-2">Commission & Partner Wallets</h3>
      <p className="text-muted mb-3">
        Set how much drop points, drivers, and dispatchers earn when a parcel is delivered.
        Changes apply to new accruals — already posted lines are not rewritten.
      </p>
      <Alert error={error} ok={ok} />

      <div className="d-flex flex-wrap gap-2 mb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rates' && (
        <form onSubmit={onSaveRates}>
          <div className="row g-3">
            <div className="col-lg-3">
              <div className="list-group sticky-top" style={{ top: '1rem' }}>
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    className={`list-group-item list-group-item-action ${roleTab === role.id ? 'active' : ''}`}
                    onClick={() => setRoleTab(role.id)}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className={`bi ${ROLE_ICONS[role.id] || 'bi-cash-coin'}`} />
                      <div>
                        <div className="fw-semibold">{role.label}</div>
                        <div className={`small ${roleTab === role.id ? 'text-white-50' : 'text-muted'}`}>
                          {(role.fields || []).length} settings
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="card mt-3 border-0 bg-light">
                <div className="card-body small">
                  <div className="fw-semibold mb-1">Quick summary</div>
                  {config?.bpDwellEnabled ? (
                    <div>
                      BP dwell T0–T5:{' '}
                      {[config.bpDwellTiers?.T0, config.bpDwellTiers?.T1, config.bpDwellTiers?.T2,
                        config.bpDwellTiers?.T3, config.bpDwellTiers?.T4, config.bpDwellTiers?.T5]
                        .map((v) => money(v)).join(' · ')}
                    </div>
                  ) : (
                    <div>BP flat delivery {money(config?.deliveryPerKg)}/kg</div>
                  )}
                  <div className="mt-1">
                    Driver {config?.driverEnabled ? money(config.driverPerDelivery) : 'off'} ·
                    Dispatcher {config?.dispatcherEnabled ? money(config.dispatcherPerDelivery) : 'off'}
                  </div>
                  <div className="mt-1 text-muted">
                    {config?.withdrawalWindowOpen ? 'Withdrawal window open' : 'Withdrawal window closed'}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-9">
              {activeRole ? (
                <div className="card shadow-sm">
                  <div className="card-header bg-white">
                    <div className="d-flex align-items-center gap-2">
                      <i className={`bi ${ROLE_ICONS[activeRole.id] || 'bi-cash-coin'} fs-5`} />
                      <div>
                        <h5 className="mb-0">{activeRole.label}</h5>
                        <div className="small text-muted">{activeRole.hint}</div>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      {(activeRole.fields || []).map((field) => (
                        <div
                          key={field.key}
                          className={field.type === 'bool' ? 'col-12' : 'col-md-6'}
                        >
                          {field.type === 'bool' ? (
                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`cf-${field.key}`}
                                checked={!!draft[field.key]}
                                onChange={(e) => setField(field.key, e.target.checked)}
                              />
                              <label className="form-check-label" htmlFor={`cf-${field.key}`}>
                                <span className="fw-semibold">{field.label}</span>
                                {field.hint ? (
                                  <div className="small text-muted">{field.hint}</div>
                                ) : null}
                              </label>
                            </div>
                          ) : (
                            <>
                              <label className="form-label" htmlFor={`cf-${field.key}`}>
                                {field.label}
                              </label>
                              <div className="input-group">
                                {field.type === 'money' ? (
                                  <span className="input-group-text">RM</span>
                                ) : null}
                                <input
                                  id={`cf-${field.key}`}
                                  type="number"
                                  step={field.type === 'money' ? '0.01' : '1'}
                                  min="0"
                                  className="form-control"
                                  value={draft[field.key] ?? ''}
                                  onChange={(e) => setField(field.key, e.target.value)}
                                />
                                {field.type === 'int' && /day/i.test(field.label) ? (
                                  <span className="input-group-text">days</span>
                                ) : null}
                              </div>
                              {field.hint ? (
                                <div className="form-text">{field.hint}</div>
                              ) : null}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card-footer bg-white d-flex justify-content-between align-items-center">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => syncDraft(config)}
                      disabled={saving}
                    >
                      Reset changes
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? 'Saving…' : 'Save commission rates'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="alert alert-light border">Loading rate settings…</div>
              )}

              {activeRole?.id === 'drop_point' ? (
                <div className="alert alert-info mt-3 mb-0 small">
                  <strong>How BP dwell pay works:</strong> clock starts when the parcel arrives at the
                  destination warehouse (HUB / station). Same-day delivery = T0 (highest). Each overnight
                  stay steps down. Approved returns use the return rate. Max hold is an ops SLA — force-return
                  automation can follow later.
                </div>
              ) : null}
              {activeRole?.id === 'driver' ? (
                <div className="alert alert-info mt-3 mb-0 small">
                  Paid to partner code <code>DRV-&#123;driverId&#125;</code> for the assigned courier when POD
                  succeeds. Pickup pay is stored for later use; delivery pay accrues today.
                </div>
              ) : null}
              {activeRole?.id === 'dispatcher' ? (
                <div className="alert alert-info mt-3 mb-0 small">
                  Paid to partner code <code>DSP-&#123;dispatcherId&#125;</code> for the staff who assigned the
                  job, when the consignment is delivered.
                </div>
              ) : null}
            </div>
          </div>
        </form>
      )}

      {tab === 'ledger' && (
        <>
          <div className="card mb-3"><div className="card-body">
            <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); load() }}>
              <div className="col-md-3">
                <label className="form-label small">Status</label>
                <select className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {['PROCESSING', 'AVAILABLE', 'ALL'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small">CN filter</label>
                <input className="form-control form-control-sm" value={cn} onChange={(e) => setCn(e.target.value.toUpperCase())} />
              </div>
              <div className="col-md-2"><button className="btn btn-primary btn-sm" type="submit">Filter</button></div>
            </form>
          </div></div>

          <div className="card mb-3"><div className="card-body">
            <form className="row g-2 align-items-end" onSubmit={onAccrue}>
              <div className="col-md-4">
                <label className="form-label small">Manual accrue (delivered / returned CN)</label>
                <input className="form-control form-control-sm" value={accrueCn} onChange={(e) => setAccrueCn(e.target.value.toUpperCase())} placeholder="CN number" />
              </div>
              <div className="col-md-2"><button className="btn btn-outline-primary btn-sm" type="submit">Accrue</button></div>
            </form>
          </div></div>

          <div className="table-responsive">
            <table className="table table-sm table-striped table-bordered align-middle">
              <thead className="table-dark">
                <tr>
                  <th>CN</th>
                  <th>Partner</th>
                  <th>Line</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-muted py-3">No commission lines</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.cnNo}</td>
                    <td>
                      <div>{r.partnerCode}</div>
                      <div className="small text-muted">{partnerTypeLabel(r.partnerCode)}</div>
                    </td>
                    <td>
                      <div>{r.lineDesc}</div>
                      <div className="small text-muted">{r.lineCode}</div>
                    </td>
                    <td>{r.qty}</td>
                    <td>{money(r.rate)}</td>
                    <td className="fw-semibold">{money(r.amount)}</td>
                    <td>
                      <span className={`badge ${r.status === 'AVAILABLE' ? 'text-bg-success' : 'text-bg-warning'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === 'PROCESSING' && (
                        <button type="button" className="btn btn-sm btn-outline-success" onClick={() => onVerify(r.id)}>
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'wallets' && (
        <div className="table-responsive">
          <table className="table table-sm table-striped table-bordered">
            <thead className="table-dark">
              <tr><th>Partner</th><th>Type</th><th>Available</th><th>Pending</th></tr>
            </thead>
            <tbody>
              {walletRows.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted py-3">No wallets yet</td></tr>
              ) : walletRows.map((w) => (
                <tr key={w.partnerCode}>
                  <td>{w.partnerCode}</td>
                  <td>{w.partnerType || partnerTypeLabel(w.partnerCode)}</td>
                  <td>{money(w.balance)}</td>
                  <td>{money(w.pendingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'withdrawals' && (
        <>
          <div className="card mb-3"><div className="card-body">
            <form className="row g-2 align-items-end" onSubmit={onWithdraw}>
              <div className="col-md-3">
                <label className="form-label small">Partner code</label>
                <input className="form-control form-control-sm" required value={withdrawForm.partnerCode} onChange={(e) => setWithdrawForm({ ...withdrawForm, partnerCode: e.target.value.toUpperCase() })} placeholder="e.g. DRV-12 or DSP-3" />
              </div>
              <div className="col-md-2">
                <label className="form-label small">Amount</label>
                <input type="number" step="0.01" className="form-control form-control-sm" required value={withdrawForm.amount} onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Note</label>
                <input className="form-control form-control-sm" value={withdrawForm.note} onChange={(e) => setWithdrawForm({ ...withdrawForm, note: e.target.value })} />
              </div>
              <div className="col-md-2"><button className="btn btn-primary btn-sm" type="submit">Request</button></div>
            </form>
          </div></div>

          <div className="table-responsive">
            <table className="table table-sm table-striped table-bordered">
              <thead className="table-dark">
                <tr><th>Request</th><th>Partner</th><th>Amount</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {wdRows.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted py-3">No withdrawals</td></tr>
                ) : wdRows.map((w) => (
                  <tr key={w.id}>
                    <td>{w.requestNo}</td>
                    <td>{w.partnerCode}</td>
                    <td>{money(w.amount)}</td>
                    <td>{w.status}</td>
                    <td className="text-nowrap">
                      {w.status === 'REQUESTED' && <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => onAdvance(w.id, 'approve')}>Approve</button>}
                      {w.status === 'APPROVED' && <button type="button" className="btn btn-sm btn-outline-warning me-1" onClick={() => onAdvance(w.id, 'paid')}>Paid</button>}
                      {w.status === 'PAID' && <button type="button" className="btn btn-sm btn-outline-success me-1" onClick={() => onAdvance(w.id, 'cleared')}>Cleared</button>}
                      {['REQUESTED', 'APPROVED'].includes(w.status) && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onAdvance(w.id, 'reject')}>Reject</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function partnerTypeLabel(code) {
  const c = String(code || '')
  if (c.startsWith('DRV-')) return 'Driver'
  if (c.startsWith('DSP-')) return 'Dispatcher'
  if (c.startsWith('HUB-')) return 'Hub / lorry'
  return 'Drop point'
}
