import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addManifestMember,
  apiError,
  closeManifest,
  getManifest,
  listManifests,
  listMaster,
  removeManifestMember,
  saveManifest,
} from '../api/client'

function tierLabel(tier) {
  if (tier === 'baby') return 'Baby'
  if (tier === 'mother') return 'Mother'
  if (tier === 'father') return 'Father'
  return tier || '—'
}

export default function ManifestStationPage() {
  const [locId, setLocId] = useState('')
  const [destLoc, setDestLoc] = useState('')
  const [carrier, setCarrier] = useState('')
  const [remarks, setRemarks] = useState('')
  const [mfgDt, setMfgDt] = useState(() => new Date().toISOString().slice(0, 10))
  const [activeMfg, setActiveMfg] = useState('')
  const [detail, setDetail] = useState(null)
  const [scanCode, setScanCode] = useState('')
  const scanRef = useRef(null)
  const [list, setList] = useState([])
  const [filterStatus, setFilterStatus] = useState('OPEN')
  const [hubs, setHubs] = useState([])
  const [dps, setDps] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState('')

  const manifest = detail?.manifest || null
  const members = manifest?.members || []
  const linehaulEstimate = manifest?.linehaulEstimate || null
  const linehaulCost =
    manifest?.linehaulCost != null
      ? Number(manifest.linehaulCost)
      : linehaulEstimate?.amount != null
        ? Number(linehaulEstimate.amount)
        : 0
  const isOpen = manifest?.isOpen !== false && ['OPEN', 'APR', ''].includes(String(manifest?.mfgStatus || 'OPEN').toUpperCase())

  const refreshList = useCallback(async () => {
    const data = await listManifests({
      status: filterStatus || undefined,
      limit: 40,
    })
    setList(data?.items || [])
  }, [filterStatus])

  async function loadManifest(mfgNo) {
    const code = String(mfgNo || '').trim().toUpperCase()
    if (!code) return
    setBusy(true)
    setMessage('')
    try {
      const data = await getManifest(code)
      setDetail(data)
      setActiveMfg(data?.manifest?.mfgNo || code)
      const m = data?.manifest
      if (m) {
        setLocId(m.locId || '')
        setDestLoc(m.destLoc || '')
        setCarrier(m.carrier || '')
        setRemarks(m.remarks || '')
        setMfgDt(m.mfgDt ? String(m.mfgDt).slice(0, 10) : mfgDt)
      }
      setOk(`Loaded ${code}`)
      queueMicrotask(() => scanRef.current?.focus())
    } catch (err) {
      setDetail(null)
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    listMaster('hubs').then((d) => setHubs(d?.rows || [])).catch(() => setHubs([]))
    listMaster('delivery-points').then((d) => setDps(d?.rows || [])).catch(() => setDps([]))
  }, [])

  useEffect(() => {
    refreshList().catch(() => setList([]))
  }, [refreshList])

  const hubOptions = useMemo(
    () =>
      (hubs || [])
        .map((h) => ({
          code: h.hubCode || h.hub_code || h.code,
          name: h.hubName || h.hub_name || h.name || '',
        }))
        .filter((h) => h.code),
    [hubs]
  )
  const dpOptions = useMemo(
    () =>
      (dps || [])
        .map((d) => ({
          code: d.deliveryPointCode || d.delivery_point_code || d.code || d.zoneCode,
          name: d.deliveryPointName || d.delivery_point_name || d.name || '',
        }))
        .filter((d) => d.code),
    [dps]
  )

  async function onCreate(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setOk('')
    try {
      const data = await saveManifest({
        locId: locId || undefined,
        destLoc,
        carrier: carrier || undefined,
        remarks: remarks || undefined,
        mfgDt,
      })
      const mfg = data?.mfgNo || data?.manifest?.manifest?.mfgNo || data?.manifest?.mfgNo
      setOk(data?.message || `Created ${mfg}`)
      await loadManifest(mfg)
      await refreshList()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onSaveHeader(e) {
    e.preventDefault()
    if (!activeMfg) return
    setBusy(true)
    setMessage('')
    try {
      const data = await saveManifest({
        mfgNo: activeMfg,
        locId: locId || undefined,
        destLoc,
        carrier: carrier || undefined,
        remarks: remarks || undefined,
        mfgDt,
      })
      setDetail(data?.manifest || (await getManifest(activeMfg)))
      setOk(data?.message || 'Saved')
      await refreshList()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onScan(e) {
    e.preventDefault()
    const code = scanCode.trim().toUpperCase()
    if (!code || !activeMfg) {
      setMessage('Create or load a manifesto first, then scan a seal or CN.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const data = await addManifestMember(activeMfg, code, { locId: locId || undefined })
      setDetail(data?.manifest || (await getManifest(activeMfg)))
      setScanCode('')
      setOk(data?.message || `Added ${code}`)
      await refreshList()
      queueMicrotask(() => scanRef.current?.focus())
    } catch (err) {
      setMessage(apiError(err))
      setScanCode('')
      queueMicrotask(() => scanRef.current?.focus())
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(key) {
    if (!activeMfg || !key) return
    setBusy(true)
    setMessage('')
    try {
      const data = await removeManifestMember(activeMfg, key)
      setDetail(data?.manifest || (await getManifest(activeMfg)))
      setOk(`Removed ${key}`)
      await refreshList()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onClose() {
    if (!activeMfg) return
    if (!window.confirm(`Close / depart manifesto ${activeMfg}? Leaf CNs become MNF; seals go in transit.`)) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const data = await closeManifest(activeMfg, { locId: locId || undefined })
      setDetail(data?.manifest || (await getManifest(activeMfg)))
      setOk(
        `${data?.message || 'Closed'}` +
          (data?.cnUpdated != null ? ` · ${data.cnUpdated} CN updated` : '') +
          (data?.cnFailed ? ` · ${data.cnFailed} failed` : '')
      )
      await refreshList()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Manifest Station</h1>
          <p className="text-muted mb-0">
            Load sealed seals (baby / mother / father) or loose CNs, then close to cascade MNF / in-transit.
          </p>
        </div>
      </div>

      {message ? <div className="alert alert-danger py-2">{message}</div> : null}
      {ok ? <div className="alert alert-success py-2">{ok}</div> : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header"><strong>Create manifesto</strong></div>
            <div className="card-body">
              <form onSubmit={onCreate} className="vstack gap-2">
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label">Origin</label>
                    <input
                      className="form-control"
                      value={locId}
                      onChange={(e) => setLocId(e.target.value.toUpperCase())}
                      list="mfg-origin-hubs"
                      placeholder="Hub / branch"
                    />
                    <datalist id="mfg-origin-hubs">
                      {hubOptions.map((h) => (
                        <option key={h.code} value={h.code}>{h.name}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-control" value={mfgDt} onChange={(e) => setMfgDt(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="form-label">Destination</label>
                  <input
                    className="form-control"
                    value={destLoc}
                    onChange={(e) => setDestLoc(e.target.value.toUpperCase())}
                    list="mfg-dest-codes"
                    placeholder="Hub / DP / area"
                    required
                  />
                  <datalist id="mfg-dest-codes">
                    {hubOptions.map((h) => (
                      <option key={`h-${h.code}`} value={h.code}>{h.name || 'hub'}</option>
                    ))}
                    {dpOptions.map((d) => (
                      <option key={`d-${d.code}`} value={d.code}>{d.name || 'DP'}</option>
                    ))}
                  </datalist>
                  <div className="form-text">Hub for linehaul; DP/area for within-city.</div>
                </div>
                <div className="row g-2">
                  <div className="col-md-7">
                    <label className="form-label">Carrier</label>
                    <input className="form-control" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label">Linehaul cost</label>
                    <input className="form-control" value="From commission" disabled readOnly />
                    <div className="form-text">Auto from Commission Settings after members are added.</div>
                  </div>
                </div>
                <div>
                  <label className="form-label">Remarks</label>
                  <input className="form-control" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy || !destLoc}>
                  Create (auto MFG no.)
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Recent</strong>
              <select
                className="form-select form-select-sm w-auto"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
                <option value="">All</option>
              </select>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: 320, overflow: 'auto' }}>
              {list.length === 0 ? (
                <div className="list-group-item text-muted small">No manifests.</div>
              ) : (
                list.map((item) => (
                  <button
                    type="button"
                    key={item.mfgNo}
                    className={`list-group-item list-group-item-action ${activeMfg === item.mfgNo ? 'active' : ''}`}
                    onClick={() => loadManifest(item.mfgNo)}
                  >
                    <div className="d-flex justify-content-between">
                      <strong>{item.mfgNo}</strong>
                      <span className="badge text-bg-light border">{item.mfgStatus}</span>
                    </div>
                    <div className="small opacity-75">
                      {item.locId || '—'} → {item.destLoc || '—'} · {item.mfgDt || ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <strong>{activeMfg ? `Manifesto ${activeMfg}` : 'Load / scan'}</strong>
              {manifest ? (
                <span className="badge text-bg-secondary">{manifest.mfgStatus}</span>
              ) : null}
            </div>
            <div className="card-body vstack gap-3">
              {!activeMfg ? (
                <div className="text-muted">Create a manifesto or select one from the list.</div>
              ) : (
                <>
                  {isOpen ? (
                    <form onSubmit={onSaveHeader} className="row g-2 align-items-end">
                      <div className="col-md-4">
                        <label className="form-label">Origin</label>
                        <input className="form-control" value={locId} onChange={(e) => setLocId(e.target.value.toUpperCase())} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Dest</label>
                        <input className="form-control" value={destLoc} onChange={(e) => setDestLoc(e.target.value.toUpperCase())} required />
                      </div>
                      <div className="col-md-4">
                        <button type="submit" className="btn btn-outline-secondary w-100" disabled={busy}>Save header</button>
                      </div>
                    </form>
                  ) : null}

                  <div className="d-flex flex-wrap gap-3 small">
                    <span>
                      Members: <strong>{manifest?.memberCount ?? members.length}</strong>
                    </span>
                    <span>
                      Leaf CNs: <strong>{manifest?.leafCnCount ?? 0}</strong>
                    </span>
                    <span>
                      Linehaul: <strong>RM {Number(linehaulCost || 0).toFixed(2)}</strong>
                      {linehaulEstimate?.hint ? (
                        <span className="text-muted"> · {linehaulEstimate.hint}</span>
                      ) : null}
                    </span>
                    {manifest?.carrier ? <span>Carrier: {manifest.carrier}</span> : null}
                  </div>

                  {isOpen ? (
                    <form onSubmit={onScan} className="d-flex gap-2">
                      <input
                        ref={scanRef}
                        className="form-control form-control-lg"
                        placeholder="Scan seal (BS-/MS-/FS-) or CN…"
                        value={scanCode}
                        onChange={(e) => setScanCode(e.target.value)}
                        disabled={busy}
                        autoFocus
                      />
                      <button type="submit" className="btn btn-primary" disabled={busy || !scanCode.trim()}>
                        Add
                      </button>
                    </form>
                  ) : (
                    <div className="alert alert-secondary py-2 mb-0 small">
                      Closed — members locked. Print via Reports → Print Manifest.
                    </div>
                  )}

                  <div>
                    <div className="fw-semibold mb-2">Members</div>
                    {members.length === 0 ? (
                      <div className="text-muted small">No members yet.</div>
                    ) : (
                      <ul className="list-group">
                        {members.map((m) => (
                          <li
                            key={`${m.memberType}-${m.memberKey}`}
                            className="list-group-item d-flex justify-content-between align-items-start"
                          >
                            <div>
                              <span className="badge text-bg-light border me-1">{m.memberType}</span>
                              <strong>{m.memberKey}</strong>
                              {m.seal ? (
                                <div className="small text-muted">
                                  {tierLabel(m.seal.tier)} · {m.seal.lifecycle}
                                  {m.seal.destHubCode ? ` · hub ${m.seal.destHubCode}` : ''}
                                  {m.seal.destDeliveryPoint ? ` · DP ${m.seal.destDeliveryPoint}` : ''}
                                  {m.seal.destAreaCode ? ` · area ${m.seal.destAreaCode}` : ''}
                                  {' · '}
                                  {m.leafCnCount ?? m.seal.cnCount ?? 0} CN
                                </div>
                              ) : null}
                              {m.cn ? (
                                <div className="small text-muted">
                                  {m.cn.status || '—'}
                                  {m.cn.dest ? ` · ${m.cn.dest}` : ''}
                                  {m.cn.pcs ? ` · ${m.cn.pcs} pcs` : ''}
                                </div>
                              ) : null}
                            </div>
                            {isOpen ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={busy}
                                onClick={() => onRemove(m.memberKey)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {isOpen ? (
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={busy || members.length === 0}
                      onClick={onClose}
                    >
                      Close / Depart
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
