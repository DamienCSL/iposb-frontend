import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  apiError,
  closeSeal,
  createSeal,
  getSealPack,
  listMaster,
  listSeals,
  openSeal,
  packSealScan,
  removeSealMember,
  scanSeal,
} from '../api/client'

const SCAN_STATUSES = [
  { code: 'GWD', label: 'Goods Outward (depart)' },
  { code: 'INB', label: 'In transit' },
  { code: 'ARR', label: 'Arrive origin hub' },
  { code: 'HUB', label: 'Arrive dest hub' },
  { code: 'SHB', label: 'At delivery station' },
  { code: 'SRT', label: 'Sorting' },
  { code: 'MNF', label: 'Manifested / linehaul' },
]

function tierLabel(tier) {
  if (tier === 'baby') return 'Baby'
  if (tier === 'mother') return 'Mother'
  if (tier === 'father') return 'Father'
  return tier || '—'
}

function MemberTree({ members, depth = 0 }) {
  if (!Array.isArray(members) || members.length === 0) {
    return <div className="text-muted small">No members yet.</div>
  }
  return (
    <ul className="list-unstyled mb-0" style={{ paddingLeft: depth ? '1rem' : 0 }}>
      {members.map((m) => (
        <li key={`${m.memberType}-${m.memberKey}`} className="mb-1">
          <span className="badge text-bg-light border me-1">{m.memberType}</span>
          <strong>{m.memberKey}</strong>
          {m.seal ? (
            <span className="text-muted small ms-1">
              ({tierLabel(m.seal.tier)} · {m.seal.lifecycle} · {m.seal.cnCount} CN)
            </span>
          ) : null}
          {m.seal?.members?.length ? <MemberTree members={m.seal.members} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  )
}

export default function SealStationPage() {
  const [tier, setTier] = useState('baby')
  const [destArea, setDestArea] = useState('')
  const [destDp, setDestDp] = useState('')
  const [destHub, setDestHub] = useState('')
  const [originDp, setOriginDp] = useState('')
  const [originHub, setOriginHub] = useState('')
  const [locId, setLocId] = useState('')
  const [activeSealNo, setActiveSealNo] = useState('')
  const [seal, setSeal] = useState(null)
  const [pack, setPack] = useState(null)
  const [packBarcode, setPackBarcode] = useState('')
  const [scanStatus, setScanStatus] = useState('GWD')
  const packInputRef = useRef(null)
  const [list, setList] = useState([])
  const [areas, setAreas] = useState([])
  const [dps, setDps] = useState([])
  const [hubs, setHubs] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState('')
  const [filterTier, setFilterTier] = useState('')

  function applyPack(data) {
    setPack(data || null)
    setSeal(data?.seal || null)
    if (data?.seal?.sealNo) setActiveSealNo(data.seal.sealNo)
  }

  const refreshList = useCallback(async () => {
    const data = await listSeals({
      tier: filterTier || undefined,
      limit: 40,
    })
    setList(data?.items || [])
  }, [filterTier])

  useEffect(() => {
    listMaster('areas').then((d) => setAreas(d?.rows || [])).catch(() => setAreas([]))
    listMaster('delivery-points').then((d) => setDps(d?.rows || [])).catch(() => setDps([]))
    listMaster('hubs').then((d) => setHubs(d?.rows || [])).catch(() => setHubs([]))
  }, [])

  useEffect(() => {
    refreshList().catch(() => setList([]))
  }, [refreshList])

  async function loadSeal(sealNo) {
    const code = String(sealNo || '').trim().toUpperCase()
    if (!code) return
    setBusy(true)
    setMessage('')
    try {
      const data = await getSealPack(code)
      applyPack(data)
      setOk(data?.session?.message || `Loaded ${code}`)
      queueMicrotask(() => packInputRef.current?.focus())
    } catch (err) {
      setSeal(null)
      setPack(null)
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onCreate(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setOk('')
    try {
      const body = {
        tier,
        destAreaCode: destArea || undefined,
        destDeliveryPoint: destDp || undefined,
        destHubCode: destHub || undefined,
        originDeliveryPoint: originDp || undefined,
        originHubCode: originHub || locId || undefined,
        locId: locId || originHub || undefined,
      }
      const data = await createSeal(body)
      applyPack(await getSealPack(data?.seal?.sealNo || ''))
      setOk(`Created ${data?.seal?.sealNo} — ${data?.seal?.sealNo ? 'ready to pack-scan' : ''}`)
      await refreshList()
      queueMicrotask(() => packInputRef.current?.focus())
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onPackScan(e) {
    e.preventDefault()
    const code = packBarcode.trim().toUpperCase()
    if (!code) return

    // No active seal yet: treat first scan as seal barcode to start session
    let target = activeSealNo
    if (!target && (code.startsWith('BS-') || code.startsWith('MS-') || code.startsWith('FS-'))) {
      target = code
      setActiveSealNo(code)
    }
    if (!target) {
      setMessage('Scan a seal barcode first (BS-… / MS-… / FS-…), or load an open seal.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const data = await packSealScan(target, code, { locId: locId || originHub || undefined })
      applyPack(data)
      setPackBarcode('')
      setOk(data?.message || 'Scanned')
      await refreshList()
      queueMicrotask(() => packInputRef.current?.focus())
    } catch (err) {
      setMessage(apiError(err))
      setPackBarcode('')
      queueMicrotask(() => packInputRef.current?.focus())
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveMember(key) {
    if (!activeSealNo || !key) return
    setBusy(true)
    setMessage('')
    try {
      await removeSealMember(activeSealNo, key)
      applyPack(await getSealPack(activeSealNo))
      setOk(`Removed ${key}`)
      await refreshList()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onClose() {
    if (!activeSealNo) return
    setBusy(true)
    setMessage('')
    try {
      await closeSeal(activeSealNo)
      applyPack(await getSealPack(activeSealNo))
      setOk(`Sealed ${activeSealNo} — ready to scan / print label`)
      await refreshList()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onScan(e) {
    e.preventDefault()
    if (!activeSealNo) return
    setBusy(true)
    setMessage('')
    try {
      const data = await scanSeal(activeSealNo, {
        status: scanStatus,
        locId: locId || destHub || originHub || undefined,
      })
      applyPack(await getSealPack(activeSealNo))
      setOk(
        `Cascade ${scanStatus}: ${data?.cnUpdated || 0} CN updated` +
          (data?.cnFailed ? `, ${data.cnFailed} failed` : '')
      )
      await refreshList()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onOpen() {
    if (!activeSealNo) return
    setBusy(true)
    setMessage('')
    try {
      await openSeal(activeSealNo, {
        locId: locId || seal?.destHubCode || undefined,
      })
      applyPack(await getSealPack(activeSealNo))
      setOk(`Opened ${activeSealNo}`)
      await refreshList()
    } catch (err) {
      setMessage(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  function printLabel() {
    if (!seal) return
    const w = window.open('', '_blank', 'width=420,height=520')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>${seal.sealNo}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px}
        .code{font-size:28px;font-weight:800;letter-spacing:0.04em}
        .meta{margin-top:12px;font-size:14px;line-height:1.5}
        .tier{text-transform:uppercase;color:#64748b;font-size:12px;font-weight:700}
      </style></head><body>
      <div class="tier">${tierLabel(seal.tier)} seal</div>
      <div class="code">${seal.sealNo}</div>
      <div class="meta">
        <div><strong>Label:</strong> ${seal.label || ''}</div>
        <div><strong>Lifecycle:</strong> ${seal.lifecycle || ''}</div>
        ${seal.destAreaCode ? `<div><strong>Dest area:</strong> ${seal.destAreaCode}</div>` : ''}
        ${seal.destDeliveryPoint ? `<div><strong>Dest DP:</strong> ${seal.destDeliveryPoint}</div>` : ''}
        ${seal.destHubCode ? `<div><strong>Dest hub:</strong> ${seal.destHubCode}</div>` : ''}
        <div><strong>Members:</strong> ${seal.memberCount || 0} · <strong>CNs:</strong> ${seal.cnCount || 0}</div>
      </div>
      <script>window.print()</script>
      </body></html>`)
    w.document.close()
  }

  const areaOptions = useMemo(
    () =>
      (areas || []).map((a) => ({
        code: a.areaCode || a.area_code || a.code,
        name: a.areaName || a.area_name || a.name || '',
      })).filter((a) => a.code),
    [areas]
  )
  const dpOptions = useMemo(
    () =>
      (dps || []).map((d) => ({
        code: d.deliveryPointCode || d.delivery_point_code || d.code || d.zoneCode,
        name: d.deliveryPointName || d.delivery_point_name || d.name || '',
      })).filter((d) => d.code),
    [dps]
  )
  const hubOptions = useMemo(
    () =>
      (hubs || []).map((h) => ({
        code: h.hubCode || h.hub_code || h.code,
        name: h.hubName || h.hub_name || h.name || '',
      })).filter((h) => h.code),
    [hubs]
  )

  const lifecycle = seal?.lifecycle || ''
  const canAdd = lifecycle === 'open'
  const canClose = lifecycle === 'open'
  const canScan = ['sealed', 'in_transit', 'arrived'].includes(lifecycle)
  const canOpen = ['sealed', 'in_transit', 'arrived'].includes(lifecycle)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Seal Station</h1>
          <p className="text-muted mb-0">
            Scan seal → pack expected CNs/child seals → close → transit-scan the bag.
          </p>
        </div>
      </div>

      {message ? <div className="alert alert-danger py-2">{message}</div> : null}
      {ok ? <div className="alert alert-success py-2">{ok}</div> : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header"><strong>Create seal</strong></div>
            <div className="card-body">
              <form onSubmit={onCreate} className="vstack gap-2">
                <div>
                  <label className="form-label">Tier</label>
                  <select className="form-select" value={tier} onChange={(e) => setTier(e.target.value)}>
                    <option value="baby">Baby — dest area (CNs)</option>
                    <option value="mother">Mother — dest DP (baby seals)</option>
                    <option value="father">Father — dest hub (mother seals, origin hub only)</option>
                  </select>
                </div>
                {tier === 'baby' ? (
                  <div>
                    <label className="form-label">Dest area</label>
                    <select className="form-select" value={destArea} onChange={(e) => setDestArea(e.target.value)} required>
                      <option value="">Select area…</option>
                      {areaOptions.map((a) => (
                        <option key={a.code} value={a.code}>{a.code}{a.name ? ` — ${a.name}` : ''}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {tier === 'mother' ? (
                  <div>
                    <label className="form-label">Dest delivery point</label>
                    <select className="form-select" value={destDp} onChange={(e) => setDestDp(e.target.value)} required>
                      <option value="">Select DP…</option>
                      {dpOptions.map((d) => (
                        <option key={d.code} value={d.code}>{d.code}{d.name ? ` — ${d.name}` : ''}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {tier === 'father' ? (
                  <div>
                    <label className="form-label">Dest hub</label>
                    <select className="form-select" value={destHub} onChange={(e) => setDestHub(e.target.value)} required>
                      <option value="">Select hub…</option>
                      {hubOptions.map((h) => (
                        <option key={h.code} value={h.code}>{h.code}{h.name ? ` — ${h.name}` : ''}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label">Origin DP (optional)</label>
                    <input className="form-control" value={originDp} onChange={(e) => setOriginDp(e.target.value.toUpperCase())} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Origin / scan hub</label>
                    <input
                      className="form-control"
                      value={originHub || locId}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase()
                        setOriginHub(v)
                        setLocId(v)
                      }}
                      placeholder={tier === 'father' ? 'Required for father' : 'e.g. BKI'}
                      required={tier === 'father'}
                    />
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" disabled={busy}>Create</button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Recent seals</strong>
              <select
                className="form-select form-select-sm"
                style={{ width: '8rem' }}
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
              >
                <option value="">All tiers</option>
                <option value="baby">Baby</option>
                <option value="mother">Mother</option>
                <option value="father">Father</option>
              </select>
            </div>
            <div className="table-responsive" style={{ maxHeight: 320 }}>
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Seal</th>
                    <th>Tier</th>
                    <th>Life</th>
                    <th>CNs</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr><td colSpan={4} className="text-muted">No seals yet.</td></tr>
                  ) : (
                    list.map((s) => (
                      <tr
                        key={s.sealNo}
                        role="button"
                        className={s.sealNo === activeSealNo ? 'table-active' : ''}
                        onClick={() => loadSeal(s.sealNo)}
                      >
                        <td><code>{s.sealNo}</code></td>
                        <td>{tierLabel(s.tier)}</td>
                        <td>{s.lifecycle}</td>
                        <td>{s.cnCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <strong>Active seal</strong>
              <form
                className="d-flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  loadSeal(activeSealNo)
                }}
              >
                <input
                  className="form-control form-control-sm"
                  style={{ width: '11rem' }}
                  placeholder="BS-… / MS-… / FS-…"
                  value={activeSealNo}
                  onChange={(e) => setActiveSealNo(e.target.value.toUpperCase())}
                />
                <button className="btn btn-sm btn-outline-secondary" type="submit" disabled={busy}>Load</button>
              </form>
            </div>
            <div className="card-body">
              {pack?.session?.active ? (
                <div className="alert alert-primary py-2 mb-3">
                  <strong>{pack.session.message}</strong>
                  {pack.progress ? (
                    <div className="small mt-1">
                      Packed {pack.progress.scanned}/{pack.progress.expected}
                      {pack.progress.remaining ? ` · ${pack.progress.remaining} remaining` : ' · complete'}
                      {pack.progress.extra ? ` · ${pack.progress.extra} extra` : ''}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!seal ? (
                <div>
                  <div className="text-muted mb-2">
                    Scan a seal barcode below to start packing, or create/load a seal.
                  </div>
                  <form onSubmit={onPackScan} className="d-flex gap-2">
                    <input
                      ref={packInputRef}
                      className="form-control form-control-lg"
                      placeholder="Scan seal BS-… / MS-… / FS-…"
                      value={packBarcode}
                      onChange={(e) => setPackBarcode(e.target.value.toUpperCase())}
                      autoFocus
                    />
                    <button className="btn btn-primary" type="submit" disabled={busy}>Start</button>
                  </form>
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                    <div>
                      <div className="text-muted small text-uppercase">{tierLabel(seal.tier)} · {seal.lifecycle}</div>
                      <div className="fs-4 fw-bold font-monospace">{seal.sealNo}</div>
                      <div className="small">{seal.label}</div>
                      <div className="small text-muted mt-1">
                        Members {seal.memberCount} · CNs {seal.cnCount}
                        {seal.parentSealNo ? <> · Parent {seal.parentSealNo}</> : null}
                      </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={printLabel}>
                        Print label
                      </button>
                      {canClose ? (
                        <button type="button" className="btn btn-warning btn-sm" disabled={busy} onClick={onClose}>
                          Close seal
                        </button>
                      ) : null}
                      {canOpen ? (
                        <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={onOpen}>
                          Open seal
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {canAdd ? (
                    <form onSubmit={onPackScan} className="mb-3">
                      <label className="form-label fw-semibold">Pack scan</label>
                      <div className="d-flex gap-2">
                        <input
                          ref={packInputRef}
                          className="form-control form-control-lg"
                          placeholder={
                            seal.tier === 'baby'
                              ? 'Scan CN (or re-scan this seal)'
                              : seal.tier === 'mother'
                                ? 'Scan baby seal BS-…'
                                : 'Scan mother seal MS-…'
                          }
                          value={packBarcode}
                          onChange={(e) => setPackBarcode(e.target.value.toUpperCase())}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
                          Add
                        </button>
                      </div>
                      <div className="form-text">
                        Scanner wedge works here — Enter submits. Wrong dest area/DP/hub is rejected.
                      </div>
                    </form>
                  ) : null}

                  {canAdd && Array.isArray(pack?.expected) ? (
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <div className="fw-semibold">Expected packing list</div>
                        {pack.progress?.complete ? (
                          <span className="badge text-bg-success">Ready to close</span>
                        ) : null}
                      </div>
                      {pack.expected.length === 0 ? (
                        <div className="text-muted small">
                          No open consignments/seals match this destination yet.
                        </div>
                      ) : (
                        <div className="table-responsive" style={{ maxHeight: 280 }}>
                          <table className="table table-sm mb-0 align-middle">
                            <thead>
                              <tr>
                                <th style={{ width: '2.5rem' }}></th>
                                <th>Code</th>
                                <th>Detail</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pack.expected.map((item) => (
                                <tr
                                  key={item.memberKey}
                                  className={item.scanned ? 'table-success' : ''}
                                >
                                  <td>{item.scanned ? '✓' : '○'}</td>
                                  <td><code>{item.memberKey}</code></td>
                                  <td className="small">{item.label}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {pack.extras?.length ? (
                        <div className="small text-warning mt-2">
                          Extra (not on expected list):{' '}
                          {pack.extras.map((x) => x.memberKey).join(', ')}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mb-3">
                    <div className="fw-semibold mb-1">Contents</div>
                    <MemberTree members={seal.members} />
                    {canAdd && seal.members?.length ? (
                      <div className="mt-2">
                        {seal.members.map((m) => (
                          <button
                            key={`rm-${m.memberKey}`}
                            type="button"
                            className="btn btn-link btn-sm text-danger p-0 me-3"
                            disabled={busy}
                            onClick={() => onRemoveMember(m.memberKey)}
                          >
                            Remove {m.memberKey}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {canScan ? (
                    <form onSubmit={onScan} className="border-top pt-3">
                      <div className="fw-semibold mb-2">Transit scan (cascades to all CNs)</div>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-5">
                          <label className="form-label">Status</label>
                          <select className="form-select" value={scanStatus} onChange={(e) => setScanStatus(e.target.value)}>
                            {SCAN_STATUSES.map((s) => (
                              <option key={s.code} value={s.code}>{s.code} — {s.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Location</label>
                          <input
                            className="form-control"
                            value={locId}
                            onChange={(e) => setLocId(e.target.value.toUpperCase())}
                            placeholder="BKI / SDK"
                          />
                        </div>
                        <div className="col-md-3">
                          <button className="btn btn-primary w-100" type="submit" disabled={busy}>Scan seal</button>
                        </div>
                      </div>
                    </form>
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
