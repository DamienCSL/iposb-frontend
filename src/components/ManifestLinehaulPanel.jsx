import { useCallback, useEffect, useState } from 'react'
import {
  apiError,
  arriveManifest,
  assignLinehaulDriver,
  getManifestTrip,
  listLinehaulDrivers,
} from '../api/client'

const STATUS_LABEL = {
  LOADING: ['Loading', 'secondary'],
  READY_FOR_PICKUP: ['Ready for pickup', 'info'],
  IN_TRANSIT: ['In transit', 'primary'],
  HANDED_OVER: ['Handed over', 'warning'],
  RECEIVED: ['Received', 'success'],
}

const ISSUE_TYPES = ['DELAY', 'BREAKDOWN', 'ACCIDENT', 'SEAL_DAMAGED', 'SHORTAGE']

function fmt(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 16).replace('T', ' ')
}

function toLocalInput(dt) {
  if (!dt) return ''
  return String(dt).slice(0, 16).replace(' ', 'T')
}

export default function ManifestLinehaulPanel({ mfgNo, manifest, onChanged }) {
  const [trip, setTrip] = useState(null)
  const [tripError, setTripError] = useState('')
  const [drivers, setDrivers] = useState([])
  const [driverId, setDriverId] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [etaAt, setEtaAt] = useState('')
  const [scannedText, setScannedText] = useState('')
  const [arrival, setArrival] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState('')

  const mfgStatus = String(manifest?.mfgStatus || '').toUpperCase()
  const canAssign = trip && ['LOADING', 'READY_FOR_PICKUP'].includes(trip.status)
  const canReceive = ['CLOSED', 'ARRIVED'].includes(mfgStatus)

  const loadTrip = useCallback(async () => {
    if (!mfgNo) return
    try {
      const data = await getManifestTrip(mfgNo)
      setTrip(data)
      setTripError('')
      setDriverId(data?.driver?.driverId ? String(data.driver.driverId) : '')
      setVehicleNo(data?.vehicleNo || '')
      setEtaAt(toLocalInput(data?.etaAt))
    } catch (err) {
      setTrip(null)
      setTripError(apiError(err))
    }
  }, [mfgNo])

  useEffect(() => {
    setArrival(null)
    setScannedText('')
    setMessage('')
    setOk('')
    loadTrip()
  }, [loadTrip])

  useEffect(() => {
    if (!canAssign || drivers.length) return
    listLinehaulDrivers()
      .then((d) => setDrivers(d?.items || []))
      .catch(() => setDrivers([]))
  }, [canAssign, drivers.length])

  async function onAssign(e) {
    e.preventDefault()
    if (!driverId) return
    setBusy(true)
    setMessage('')
    setOk('')
    try {
      const data = await assignLinehaulDriver(mfgNo, {
        driverId: Number(driverId),
        vehicleNo: vehicleNo || undefined,
        etaAt: etaAt || undefined,
      })
      setTrip(data?.trip || null)
      setOk(data?.message || 'Driver assigned')
      onChanged?.()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onReceive() {
    const scanned = scannedText
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    const prompt = scanned.length
      ? `Receive ${scanned.length} scanned item(s) on ${mfgNo}?`
      : `Receive everything on ${mfgNo}? Every seal / CN will be scanned HUB.`
    if (!window.confirm(prompt)) return
    setBusy(true)
    setMessage('')
    setOk('')
    try {
      const data = await arriveManifest(mfgNo, scanned.length ? { scanned } : {})
      setArrival(data)
      setOk(data?.message || 'Received')
      setScannedText('')
      await loadTrip()
      onChanged?.()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!mfgNo) return null

  const [statusText, statusTone] = STATUS_LABEL[trip?.status] || [trip?.status || '—', 'secondary']
  const loc = trip?.lastLocation
  const issues = (trip?.events || []).filter((ev) => ISSUE_TYPES.includes(ev.type))

  return (
    <div className="card mb-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <strong>Linehaul trip</strong>
        {trip ? <span className={`badge text-bg-${statusTone}`}>{statusText}</span> : null}
      </div>
      <div className="card-body vstack gap-3">
        {message ? <div className="alert alert-danger py-2 mb-0">{message}</div> : null}
        {ok ? <div className="alert alert-success py-2 mb-0">{ok}</div> : null}
        {tripError ? <div className="alert alert-warning py-2 mb-0 small">{tripError}</div> : null}

        {trip ? (
          <div className="row g-2 small">
            <div className="col-sm-6">
              Route: <strong>{trip.origin?.code || '—'}</strong> → <strong>{trip.destination?.code || '—'}</strong>
            </div>
            <div className="col-sm-6">
              Driver: <strong>{trip.driver?.fullName || 'Not assigned'}</strong>
              {trip.driver?.phone ? <span className="text-muted"> · {trip.driver.phone}</span> : null}
            </div>
            <div className="col-sm-6">Vehicle: <strong>{trip.vehicleNo || '—'}</strong></div>
            <div className="col-sm-6">ETA: <strong>{fmt(trip.etaAt)}</strong></div>
            <div className="col-sm-6">Picked up: {fmt(trip.pickedUpAt)}</div>
            <div className="col-sm-6">Handed over: {fmt(trip.handedOverAt)}</div>
            {loc?.lat != null && loc?.lng != null ? (
              <div className="col-12">
                Last GPS:{' '}
                <a
                  href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}
                </a>
                {loc.recordedAt ? <span className="text-muted"> · {fmt(loc.recordedAt)}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {issues.length ? (
          <div className="alert alert-warning py-2 mb-0 small">
            <strong>{issues.length} issue(s) reported.</strong> Latest: {issues[issues.length - 1].type}
            {issues[issues.length - 1].note ? ` — ${issues[issues.length - 1].note}` : ''}
          </div>
        ) : null}

        {canAssign ? (
          <form onSubmit={onAssign} className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label">Linehaul driver</label>
              <select className="form-select" value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
                <option value="">Select driver…</option>
                {drivers.map((d) => (
                  <option key={d.driverId} value={d.driverId}>
                    {d.fullName}
                    {d.activeManifest && d.activeManifest !== mfgNo ? ` (on ${d.activeManifest})` : ''}
                    {!d.isAvailable ? ' · unavailable' : ''}
                  </option>
                ))}
              </select>
              {drivers.length === 0 ? (
                <div className="form-text">No linehaul drivers. Set Driver type = Linehaul in Driver Management.</div>
              ) : null}
            </div>
            <div className="col-md-3">
              <label className="form-label">Vehicle no.</label>
              <input className="form-control" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} />
            </div>
            <div className="col-md-4">
              <label className="form-label">ETA</label>
              <input type="datetime-local" className="form-control" value={etaAt} onChange={(e) => setEtaAt(e.target.value)} />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-outline-primary" disabled={busy || !driverId}>
                {trip?.driver ? 'Update assignment' : 'Assign driver'}
              </button>
            </div>
          </form>
        ) : null}

        {canReceive ? (
          <div className="border-top pt-3">
            <div className="fw-semibold mb-1">Receive at destination</div>
            <textarea
              className="form-control mb-2"
              rows={2}
              placeholder="Optional: scan seal / CN numbers taken off the truck (one per line). Leave blank to receive everything."
              value={scannedText}
              onChange={(e) => setScannedText(e.target.value)}
              disabled={busy}
            />
            <button type="button" className="btn btn-success" disabled={busy} onClick={onReceive}>
              Receive / Arrive
            </button>
          </div>
        ) : null}

        {arrival ? (
          <div className="small vstack gap-1">
            <div>
              Received <strong>{arrival.received?.length || 0}</strong>
              {' · '}already received {arrival.alreadyReceived?.length || 0}
              {' · '}pending <strong>{arrival.pending?.length || 0}</strong>
            </div>
            {arrival.pending?.length ? (
              <div className="text-warning">Pending: {arrival.pending.join(', ')}</div>
            ) : null}
            {arrival.unexpected?.length ? (
              <div className="text-danger">Not on this manifest: {arrival.unexpected.join(', ')}</div>
            ) : null}
            {arrival.failed?.length ? (
              <div className="text-danger">
                Failed:{' '}
                {arrival.failed.map((f) => (typeof f === 'string' ? f : `${f.memberKey || ''} (${f.error || ''})`)).join(', ')}
              </div>
            ) : null}
          </div>
        ) : null}

        {trip?.events?.length ? (
          <div>
            <div className="fw-semibold mb-1 small">Trip log</div>
            <ul className="list-group list-group-flush small">
              {trip.events.map((ev, i) => (
                <li key={`${ev.type}-${ev.at}-${i}`} className="list-group-item px-0 py-1">
                  <span className={`badge me-2 text-bg-${ISSUE_TYPES.includes(ev.type) ? 'warning' : 'light border'}`}>
                    {ev.type}
                  </span>
                  {ev.note || ''}
                  <span className="text-muted"> · {fmt(ev.at)}{ev.driverName ? ` · ${ev.driverName}` : ''}</span>
                  {ev.photoUrl ? (
                    <a className="ms-2" href={ev.photoUrl} target="_blank" rel="noreferrer">photo</a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
