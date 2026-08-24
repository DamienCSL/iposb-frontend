import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  apiError,
  assign3pl,
  assignDriver,
  get3plPartners,
  getDispatchDrivers,
  getTracking,
  planDispatch,
} from '../api/client'

export default function DispatchJobsPage() {
  const [params, setParams] = useSearchParams()
  const cnFromUrl = (params.get('cn_no') || '').toUpperCase()
  const [cnInput, setCnInput] = useState(cnFromUrl)
  const [cnNo, setCnNo] = useState(cnFromUrl)
  const [cn, setCn] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [partners, setPartners] = useState([])
  const [jobType, setJobType] = useState('delivery')
  const [driverId, setDriverId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getDispatchDrivers().then(setDrivers).catch(() => setDrivers([]))
    get3plPartners().then(setPartners).catch(() => setPartners([]))
  }, [])

  useEffect(() => {
    if (!cnNo) {
      setCn(null)
      return
    }
    let cancelled = false
    setMessage('')
    getTracking(cnNo)
      .then((data) => {
        if (!cancelled) {
          setCn(data)
          setJobType('delivery')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCn(null)
          setMessage(apiError(err) || `Consignment ${cnNo} was not found.`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [cnNo])

  function findCn(e) {
    e.preventDefault()
    const next = cnInput.trim().toUpperCase()
    setParams(next ? { cn_no: next } : {})
    setCnNo(next)
    setOk('')
  }

  async function onAssign(e) {
    e.preventDefault()
    const driver = drivers.find((d) => String(d.driverId) === String(driverId))
    if (!driver) {
      setMessage('Please select a driver.')
      return
    }
    setBusy(true)
    setMessage('')
    setOk('')
    try {
      await assignDriver({
        cnNo,
        driverId: driver.driverId,
        firebaseUid: driver.firebaseUid || '',
        jobType,
      })
      setOk(`Consignment ${cnNo} assigned to ${driver.fullName}.`)
      const data = await getTracking(cnNo)
      setCn(data)
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onAuto() {
    setBusy(true)
    setMessage('')
    setOk('')
    try {
      const plan = await planDispatch(cnNo, true)
      const ctype = plan?.path?.coverageType || ''
      if (ctype === '3pl') {
        setOk(`${cnNo} is a 3PL coverage area — assigned to ${plan.path?.['3plPartnerName'] || 'the mapped partner'}.`)
      } else if (ctype === 'uncovered') {
        setOk(`${cnNo} is uncovered. Use a 3PL partner below or keep it in the HQ queue.`)
      } else if (plan?.autoAssign?.applied) {
        setOk(`${cnNo} auto-assigned to ${plan.staff?.pickup?.fullName || 'driver'}.`)
      } else {
        throw new Error(plan?.autoAssign?.result?.error || 'No matching own-DP driver.')
      }
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onAssign3pl(e) {
    e.preventDefault()
    if (!partnerId) {
      setMessage('Please select a 3PL partner.')
      return
    }
    setBusy(true)
    setMessage('')
    setOk('')
    try {
      const result = await assign3pl({ cnNo, partnerId: Number(partnerId) })
      setOk(`Consignment ${cnNo} assigned to 3PL ${result.partnerName || result.partnerCode || ''}`)
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Driver Assignment</h3>
          <p className="text-muted mb-0">
            Own-DP pickups auto-assign to that station’s couriers. Remote / uncovered pickups go to a 3PL — never the
            nearest own DP.
          </p>
        </div>
        <Link className="btn btn-outline-secondary btn-sm" to="/dispatch/remote">
          Remote / 3PL queue
        </Link>
      </div>

      {message ? <div className="alert alert-danger">{message}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}

      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={findCn}>
            <div className="col-md-4">
              <label className="form-label">Consignment Number</label>
              <input
                type="text"
                className="form-control"
                value={cnInput}
                onChange={(e) => setCnInput(e.target.value)}
                placeholder="Enter CN number"
                autoFocus
              />
            </div>
            <div className="col-md-3">
              <button type="submit" className="btn btn-primary">
                Find Consignment
              </button>{' '}
              <Link to="/dispatch/assign" className="btn btn-outline-secondary" onClick={() => { setCnInput(''); setCnNo(''); setCn(null); setParams({}) }}>
                Reset
              </Link>
            </div>
          </form>
        </div>
      </div>

      {cn ? (
        <>
          <div className="card mb-3">
            <div className="card-header bg-white">
              <strong>Consignment Detail</strong>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="small text-muted">Consignment Number</div>
                  <div className="fw-semibold">{cn.cnNo}</div>
                </div>
                <div className="col-md-2">
                  <div className="small text-muted">Status</div>
                  <div>
                    <span className="badge bg-secondary">{cn.statusCode}</span>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="small text-muted">Origin</div>
                  <div className="fw-semibold">{cn.origin || '—'}</div>
                </div>
                <div className="col-md-2">
                  <div className="small text-muted">Destination</div>
                  <div className="fw-semibold">{cn.destination || '—'}</div>
                </div>
                <div className="col-md-3">
                  <div className="small text-muted">Recipient</div>
                  <div className="fw-semibold">{cn.recipientName || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-white">
              <strong>Assign To Driver</strong>
            </div>
            <div className="card-body">
              <form className="row g-3 align-items-end" onSubmit={onAssign}>
                <div className="col-md-3">
                  <label className="form-label">Job Type</label>
                  <select className="form-select" value={jobType} onChange={(e) => setJobType(e.target.value)}>
                    <option value="delivery">Delivery</option>
                    <option value="pickup">Pickup</option>
                    <option value="pipeline">Pipeline</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Driver</label>
                  <select className="form-select" value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
                    <option value="">Select a driver</option>
                    {drivers.map((d) => (
                      <option key={d.driverId} value={d.driverId}>
                        {d.fullName}
                        {d.locId ? ` | ${d.locId}` : ''}
                        {d.routeCd ? ` | ${d.routeCd}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="form-text">Showing available drivers from `t_driver`.</div>
                </div>
                <div className="col-md-3">
                  <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                    Assign Driver
                  </button>
                </div>
              </form>
              <div className="row g-3 align-items-end mt-1">
                <div className="col-md-3">
                  <button type="button" className="btn btn-outline-success w-100" disabled={busy} onClick={onAuto}>
                    Auto-assign
                  </button>
                </div>
                <div className="col-md-9">
                  <div className="form-text mt-2">
                    Own DP → that station’s courier. Mapped 3PL area → partner. Uncovered → HQ queue (never nearest DP).
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header bg-white">
              <strong>Assign Third-party Courier</strong>
            </div>
            <div className="card-body">
              {partners.length === 0 ? (
                <div className="text-muted">
                  No active 3PL partners. Add them under Administration → 3PL Partners.
                </div>
              ) : (
                <form className="row g-3 align-items-end" onSubmit={onAssign3pl}>
                  <div className="col-md-8">
                    <label className="form-label">3PL partner</label>
                    <select className="form-select" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
                      <option value="">Select a partner</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {(p.partner_code || '') + ' — ' + (p.partner_name || '')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <button type="submit" className="btn btn-info text-white w-100" disabled={busy}>
                      Assign 3PL
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
