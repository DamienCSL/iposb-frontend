import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  apiError,
  assignDriver,
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
  const [jobType, setJobType] = useState('delivery')
  const [driverId, setDriverId] = useState('')
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState('')
  const [planInfo, setPlanInfo] = useState(null)

  useEffect(() => {
    getDispatchDrivers().then(setDrivers).catch(() => setDrivers([]))
  }, [])

  useEffect(() => {
    if (!cnNo) {
      setCn(null)
      setPlanInfo(null)
      return
    }
    let cancelled = false
    setMessage('')
    getTracking(cnNo)
      .then((data) => {
        if (!cancelled) {
          if (data?.found === false) {
            setCn(null)
            setMessage(`Consignment ${cnNo} was not found.`)
            return
          }
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
    planDispatch(cnNo, false)
      .then((plan) => {
        if (!cancelled) setPlanInfo(plan)
      })
      .catch(() => {
        if (!cancelled) setPlanInfo(null)
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
    setPlanInfo(null)
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
      setPlanInfo(plan)
      const ctype = plan?.path?.coverageType || ''
      const disp = plan?.path?.deliveryDispatcherName || plan?.staff?.deliveryDispatcher?.fullName
      const area = plan?.path?.destinationArea
      const bits = []
      if (ctype === 'needs_assign') {
        bits.push('needs a manual first-mile driver pick at the origin delivery point')
      } else if (plan?.autoAssign?.applied) {
        bits.push(`first-mile auto-assigned to ${plan.staff?.pickup?.fullName || 'driver'}`)
      } else if (plan?.autoAssign?.result?.error) {
        bits.push(plan.autoAssign.result.error)
      }
      if (area && disp) {
        bits.push(`last-mile area ${area} → dispatcher ${disp}`)
      } else if (area) {
        bits.push(`last-mile area ${area} (no dispatcher assigned yet)`)
      } else if (plan?.path?.destinationService === 'DOORSTEP') {
        bits.push('no last-mile area matched — set area keywords or pick area on the CN')
      }
      if (bits.length === 0) {
        throw new Error('No matching delivery-point driver.')
      }
      setOk(`${cnNo}: ${bits.join('; ')}.`)
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <h3 className="mb-1">Driver Assignment</h3>
        <p className="text-muted mb-0">
          First-mile locks to the origin delivery point / drop. Last-mile matches the receiver address to an
          Area under the destination delivery point, then assigns that Area’s dispatcher.
        </p>
      </div>

      {message ? <div className="alert alert-danger">{message}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}

      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={findCn}>
            <div className="col-md-8">
              <label className="form-label">Consignment No</label>
              <input
                className="form-control"
                value={cnInput}
                onChange={(e) => setCnInput(e.target.value.toUpperCase())}
                placeholder="CN number"
                required
              />
            </div>
            <div className="col-md-4">
              <button type="submit" className="btn btn-outline-primary w-100">
                Load
              </button>
            </div>
          </form>
        </div>
      </div>

      {cn ? (
        <>
          <div className="card mb-3">
            <div className="card-header bg-white">
              <strong>Consignment</strong>
            </div>
            <div className="card-body">
              <div className="row g-2 small">
                <div className="col-md-3">
                  <div className="text-muted">CN</div>
                  <div className="fw-semibold">{cn.cnNo || cnNo}</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Status</div>
                  <div>{cn.cnStatus || cn.status || '—'}</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Origin DP</div>
                  <div>{cn.originZone || cn.origin_zone || '—'}</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Dest DP</div>
                  <div>{cn.destinationZone || cn.destination_zone || '—'}</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Dest Area</div>
                  <div>{planInfo?.path?.destinationArea || cn.destination_area_code || '—'}</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Last-mile Dispatcher</div>
                  <div>{planInfo?.path?.deliveryDispatcherName || '—'}</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Pickup target</div>
                  <div>
                    {planInfo?.path?.pickupTargetLat != null
                      ? `${Number(planInfo.path.pickupTargetLat).toFixed(5)}, ${Number(planInfo.path.pickupTargetLng).toFixed(5)}`
                      : '—'}
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Delivery target</div>
                  <div>
                    {planInfo?.path?.deliveryTargetLat != null
                      ? `${Number(planInfo.path.deliveryTargetLat).toFixed(5)}, ${Number(planInfo.path.deliveryTargetLng).toFixed(5)}`
                      : '—'}
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Suggested pickup</div>
                  <div>
                    {planInfo?.staff?.pickup?.fullName || '—'}
                    {planInfo?.staff?.pickup?.distanceKm != null ? (
                      <span className="text-muted">
                        {' '}
                        · {Number(planInfo.staff.pickup.distanceKm).toFixed(1)} km · score{' '}
                        {planInfo.staff.pickup.matchScore}
                      </span>
                    ) : planInfo?.staff?.pickup?.matchScore != null ? (
                      <span className="text-muted"> · score {planInfo.staff.pickup.matchScore}</span>
                    ) : null}
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted">Suggested delivery</div>
                  <div>
                    {planInfo?.staff?.delivery?.fullName || '—'}
                    {planInfo?.staff?.delivery?.distanceKm != null ? (
                      <span className="text-muted">
                        {' '}
                        · {Number(planInfo.staff.delivery.distanceKm).toFixed(1)} km · score{' '}
                        {planInfo.staff.delivery.matchScore}
                      </span>
                    ) : planInfo?.staff?.delivery?.matchScore != null ? (
                      <span className="text-muted"> · score {planInfo.staff.delivery.matchScore}</span>
                    ) : null}
                  </div>
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
                        {d.distanceKm != null ? ` | ${Number(d.distanceKm).toFixed(1)}km` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    Available drivers from `t_driver`. After plan, nearer drivers score higher when coords exist.
                  </div>
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
                    Plans first-mile courier and matches destination area → dispatcher for doorstep delivery.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}








