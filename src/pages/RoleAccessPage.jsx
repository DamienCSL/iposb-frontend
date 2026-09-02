import { useEffect, useMemo, useState } from 'react'
import { apiError, getRbacModules, getRbacRoles, updateRbacRole } from '../api/client'
import { Alert } from '../ui/bits'

const LOCKED_ROLES = new Set(['Super Admin'])

/** Plain-language hints for each job role */
const ROLE_HINTS = {
  'Super Admin': 'Full access to everything. This role is protected and cannot be changed.',
  Admin: 'Head office staff who oversee most daily work, billing, and user setup.',
  'Hub Manager': 'Runs hub scanning, consignments, and dispatch at a hub.',
  'Droppoint Manager': 'Manages drop-point collections, bilyet, and local stock.',
  Operation: 'Operations desk — consignments, dispatch, and status reports.',
  Agent: 'Drop-point agent — consignments, summaries, and drop-point money.',
  Invoice: 'Billing team — invoices, receipts, credit notes, and COD.',
  CSL: 'Customer service — tickets and consignment lookup.',
  Others: 'Limited or custom access — configure modules below.',
}

/** Icons + friendly descriptions (non-technical) */
const MODULE_META = {
  consignments: {
    icon: 'bi-box-seam',
    hint: 'Create, search, track, and cancel shipments',
  },
  dispatch: {
    icon: 'bi-truck',
    hint: 'Assign drivers and manage remote / 3PL pickups',
  },
  summaries: {
    icon: 'bi-bar-chart-line',
    hint: 'View status summaries and operational reports',
  },
  customerService: {
    icon: 'bi-headset',
    hint: 'Handle customer tickets and inquiries',
  },
  billing: {
    icon: 'bi-receipt',
    hint: 'Invoices, receipts, wallets, COD, and commissions',
  },
  dropPoints: {
    icon: 'bi-geo-alt',
    hint: 'Drop points, coverage areas, and partner settings',
  },
  customerReports: {
    icon: 'bi-graph-up',
    hint: 'Customer and drop-point summary reports',
  },
  reports: {
    icon: 'bi-printer',
    hint: 'Print manifests, consignments, and billing documents',
  },
  users: {
    icon: 'bi-people',
    hint: 'Add and manage staff login accounts',
  },
  branches: {
    icon: 'bi-building',
    hint: 'Branch locations and settings',
  },
  hubs: {
    icon: 'bi-diagram-3',
    hint: 'Scan hubs and hub configuration',
  },
  staff: {
    icon: 'bi-person-badge',
    hint: 'Approve app sign-ups; manage drivers and dispatchers',
  },
  routing: {
    icon: 'bi-signpost-split',
    hint: 'Zones, routes, and route codes for planning',
  },
}

const GROUP_META = {
  Operations: { icon: 'bi-gear-wide-connected', subtitle: 'Daily shipping and customer work' },
  Finance: { icon: 'bi-cash-stack', subtitle: 'Money, invoices, and refunds' },
  Network: { icon: 'bi-pin-map', subtitle: 'Drop points and coverage' },
  Reports: { icon: 'bi-file-earmark-text', subtitle: 'Printouts and summaries' },
  Administration: { icon: 'bi-shield-check', subtitle: 'Setup for managers and IT' },
  Other: { icon: 'bi-grid', subtitle: 'Other areas' },
}

export default function RoleAccessPage() {
  const [modules, setModules] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState('')
  const [enabled, setEnabled] = useState([])
  const [defaultRoute, setDefaultRoute] = useState('/')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const roleRow = useMemo(
    () => roles.find((r) => r.role === selectedRole),
    [roles, selectedRole],
  )
  const locked = LOCKED_ROLES.has(selectedRole) || Boolean(roleRow?.locked)

  const routeOptions = useMemo(() => {
    const enabledSet = new Set(enabled)
    const opts = [{ value: '/', label: 'Main dashboard', desc: 'Overview when they first log in' }]
    for (const mod of modules) {
      if (enabledSet.has(mod.code) && mod.suggestedRoute && mod.suggestedRoute !== '/') {
        const meta = MODULE_META[mod.code]
        opts.push({
          value: mod.suggestedRoute,
          label: mod.label,
          desc: meta?.hint || `Opens ${mod.label}`,
        })
      }
    }
    return opts
  }, [modules, enabled])

  const groupedModules = useMemo(() => {
    const groups = {}
    for (const mod of modules) {
      if (mod.code === 'roleAccess') continue
      const g = mod.group || 'Other'
      if (!groups[g]) groups[g] = []
      groups[g].push(mod)
    }
    return groups
  }, [modules])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [modRes, roleRes] = await Promise.all([getRbacModules(), getRbacRoles()])
        if (cancelled) return
        setModules(modRes.modules || [])
        const roleList = roleRes.roles || []
        setRoles(roleList)
        const first = roleList.find((r) => !LOCKED_ROLES.has(r.role))?.role || roleList[0]?.role || ''
        setSelectedRole(first)
      } catch (err) {
        if (!cancelled) setError(apiError(err) || err.message || 'Could not load access settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedRole || !roleRow) return
    setEnabled([...(roleRow.modules || [])])
    setDefaultRoute(roleRow.defaultRoute || '/')
    setMessage('')
  }, [selectedRole, roleRow])

  useEffect(() => {
    if (routeOptions.some((o) => o.value === defaultRoute)) return
    setDefaultRoute(routeOptions[0]?.value || '/')
  }, [routeOptions, defaultRoute])

  function toggleModule(code) {
    if (locked) return
    setEnabled((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  function setGroupAll(codes, on) {
    if (locked) return
    setEnabled((prev) => {
      const set = new Set(prev)
      for (const code of codes) {
        if (on) set.add(code)
        else set.delete(code)
      }
      return [...set]
    })
  }

  async function onSave(e) {
    e.preventDefault()
    if (!selectedRole || locked) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await updateRbacRole(selectedRole, { modules: enabled, defaultRoute })
      const updated = res.role
      setRoles((prev) => prev.map((r) => (r.role === updated.role ? updated : r)))
      setMessage(`Access settings saved for “${selectedRole}”. They will see the changes next time they log in.`)
    } catch (err) {
      setError(apiError(err) || err.message || 'Could not save — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="role-access-page">
        <div className="role-access-loading">
          <div className="spinner-border text-success" role="status" />
          <p className="text-muted mt-3 mb-0">Loading access settings…</p>
        </div>
      </div>
    )
  }

  const enabledCount = enabled.length
  const totalModules = modules.filter((m) => m.code !== 'roleAccess').length

  return (
    <div className="role-access-page">
      <header className="role-access-hero mb-4">
        <div className="role-access-hero-icon">
          <i className="bi bi-person-lock" aria-hidden />
        </div>
        <div>
          <h2 className="mb-2">Staff access settings</h2>
          <p className="text-muted mb-0 lead-ish">
            Choose what each job role can see in the system and which page opens when they log in.
            You do not need technical knowledge — just tick the areas they should use.
          </p>
        </div>
      </header>

      {error ? <Alert error={error} /> : null}
      {message ? <Alert ok={message} /> : null}

      {/* Step 1 — Pick a role */}
      <section className="card role-access-section mb-4">
        <div className="card-body">
          <div className="role-access-step">
            <span className="role-access-step-num">1</span>
            <div>
              <h5 className="mb-1">Who are you setting up?</h5>
              <p className="text-muted small mb-0">Select a job role (e.g. Hub Manager, Billing).</p>
            </div>
          </div>

          <div className="role-access-role-grid mt-3">
            {roles.map((r) => {
              const isSelected = r.role === selectedRole
              const isLocked = LOCKED_ROLES.has(r.role) || r.locked
              return (
                <button
                  key={r.role}
                  type="button"
                  className={`role-access-role-card${isSelected ? ' selected' : ''}${isLocked ? ' locked' : ''}`}
                  onClick={() => setSelectedRole(r.role)}
                >
                  <div className="role-access-role-card-top">
                    <i className={`bi ${isLocked ? 'bi-shield-fill-check' : 'bi-person-badge'}`} aria-hidden />
                    {isLocked ? <span className="badge text-bg-secondary ms-auto">Protected</span> : null}
                  </div>
                  <strong>{r.role}</strong>
                  <span className="small text-muted d-block mt-1">
                    {ROLE_HINTS[r.role] || 'Configure module access below.'}
                  </span>
                  {!isLocked ? (
                    <span className="role-access-role-count small">
                      {(r.modules || []).length} area{(r.modules || []).length === 1 ? '' : 's'} allowed
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {locked ? (
        <section className="card role-access-section border-success">
          <div className="card-body text-center py-5">
            <i className="bi bi-shield-lock-fill text-success display-4" aria-hidden />
            <h5 className="mt-3">{selectedRole}</h5>
            <p className="text-muted mb-0 mx-auto" style={{ maxWidth: 420 }}>
              This role always has full access to protect system security. No changes are needed here.
            </p>
          </div>
        </section>
      ) : (
        <form onSubmit={onSave}>
          {/* Step 2 — Modules */}
          <section className="card role-access-section mb-4">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div className="role-access-step mb-0">
                  <span className="role-access-step-num">2</span>
                  <div>
                    <h5 className="mb-1">What can they use?</h5>
                    <p className="text-muted small mb-0">
                      Turn on each part of the system this role should see in the menu.
                    </p>
                  </div>
                </div>
                <div className="role-access-summary-pill">
                  <strong>{enabledCount}</strong> of {totalModules} areas turned on
                </div>
              </div>

              {Object.entries(groupedModules).map(([group, items]) => {
                const gMeta = GROUP_META[group] || GROUP_META.Other
                const codes = items.map((i) => i.code)
                const groupOn = codes.filter((c) => enabled.includes(c)).length
                const allOn = groupOn === codes.length

                return (
                  <div key={group} className="role-access-group mb-4">
                    <div className="role-access-group-head">
                      <div>
                        <i className={`bi ${gMeta.icon} me-2 text-success`} aria-hidden />
                        <strong>{group}</strong>
                        <span className="text-muted small ms-2">{gMeta.subtitle}</span>
                      </div>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setGroupAll(codes, true)}
                        >
                          Allow all
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setGroupAll(codes, false)}
                          disabled={groupOn === 0}
                        >
                          Remove all
                        </button>
                      </div>
                    </div>

                    <div className="role-access-module-grid">
                      {items.map((mod) => {
                        const meta = MODULE_META[mod.code] || { icon: 'bi-app', hint: mod.label }
                        const on = enabled.includes(mod.code)
                        return (
                          <label
                            key={mod.code}
                            className={`role-access-module-card${on ? ' on' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="visually-hidden"
                              checked={on}
                              onChange={() => toggleModule(mod.code)}
                            />
                            <div className="role-access-module-icon">
                              <i className={`bi ${meta.icon}`} aria-hidden />
                            </div>
                            <div className="role-access-module-text">
                              <strong>{mod.label}</strong>
                              <span>{meta.hint}</span>
                            </div>
                            <div className="role-access-toggle" aria-hidden>
                              <span className="role-access-toggle-knob" />
                            </div>
                          </label>
                        )
                      })}
                    </div>
                    <div className="text-muted small mt-1">
                      {groupOn} of {codes.length} allowed in this section
                      {allOn ? ' · all on' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Step 3 — Home page */}
          <section className="card role-access-section mb-4">
            <div className="card-body">
              <div className="role-access-step mb-3">
                <span className="role-access-step-num">3</span>
                <div>
                  <h5 className="mb-1">Where should they land after login?</h5>
                  <p className="text-muted small mb-0">
                    Pick the first screen they see — usually the dashboard or their main work area.
                  </p>
                </div>
              </div>

              <div className="role-access-route-grid">
                {routeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`role-access-route-card${defaultRoute === opt.value ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="defaultRoute"
                      className="visually-hidden"
                      value={opt.value}
                      checked={defaultRoute === opt.value}
                      onChange={() => setDefaultRoute(opt.value)}
                    />
                    <strong>{opt.label}</strong>
                    <span className="small text-muted">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <div className="role-access-save-bar">
            <p className="text-muted small mb-0 me-auto">
              Changes apply to everyone with the <strong>{selectedRole}</strong> role after they sign in again.
            </p>
            <button
              type="submit"
              className="btn btn-primary btn-lg px-4"
              disabled={saving || enabled.length === 0}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Saving…
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle me-2" aria-hidden />
                  Save access for {selectedRole}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      <section className="card role-access-section mt-4">
        <div className="card-body">
          <h5 className="mb-2">
            <i className="bi bi-key me-2 text-success" aria-hidden />
            Try it: demo logins
          </h5>
          <p className="text-muted small mb-3">
            Log out, then sign in as one of these users to see what each role experiences.
            Password for all: <strong>admin123</strong>
          </p>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Job role</th>
                  <th>Username</th>
                  <th>Good for testing</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Super Admin', 'admin', 'Full access — edit Staff Access settings'],
                  ['Admin', 'office_admin', 'Head office — most daily modules'],
                  ['Hub Manager', 'hubmgr01', 'Hub scanning, consignments, dispatch'],
                  ['Drop Point Manager', 'droppoint01', 'Drop points, bilyet, local stock'],
                  ['Operations', 'ops01', 'Consignments, dispatch, summaries'],
                  ['Agent', 'agent01', 'Penang drop-point agent view'],
                  ['Billing', 'inv01', 'Invoices, COD, wallet, commissions'],
                  ['Customer Service', 'csl01', 'CS tickets and tracking'],
                  ['Others', 'staff01', 'Limited access — try your custom settings'],
                ].map(([role, user, note]) => (
                  <tr key={user}>
                    <td>{role}</td>
                    <td>
                      <code>{user}</code>
                    </td>
                    <td className="small text-muted">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
