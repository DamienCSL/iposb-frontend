import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  apiError,
  collectCodAtDropPoint,
  listCodCollections,
  remitCod,
  settleCod,
} from '../api/client'
import { Alert, money } from '../ui/bits'

const STATUS_TABS = [
  { key: 'PENDING', label: 'Pending collection' },
  { key: 'COLLECTED', label: 'Collected' },
  { key: 'REMITTED', label: 'Remitted' },
  { key: 'SETTLED', label: 'Settled' },
  { key: 'ALL', label: 'All' },
]

function statusBadge(status) {
  const s = String(status || '').toUpperCase()
  const cls =
    s === 'SETTLED'
      ? 'text-bg-success'
      : s === 'REMITTED'
        ? 'text-bg-info'
        : s === 'COLLECTED'
          ? 'text-bg-primary'
          : 'text-bg-warning'
  return <span className={`badge ${cls}`}>{s || '—'}</span>
}

export default function CodPage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('PENDING')
  const [cnFilter, setCnFilter] = useState((params.get('cn') || '').toUpperCase())
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [actionCn, setActionCn] = useState(null)
  const [collectForm, setCollectForm] = useState({ amount: '', dropPointCode: '', recipientName: '', note: '' })
  const [bilyetNo, setBilyetNo] = useState('')

  async function load() {
    setError('')
    try {
      const data = await listCodCollections({
        status: status === 'ALL' ? '' : status,
        cn: cnFilter || undefined,
      })
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(apiError(err))
    }
  }

  useEffect(() => {
    const fromQuery = (params.get('cn') || '').toUpperCase()
    if (fromQuery) setCnFilter(fromQuery)
  }, [params])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, params])

  useEffect(() => {
    if ((params.get('cn') || '') && cnFilter) {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnFilter])

  async function onCollect(e) {
    e.preventDefault()
    if (!actionCn) return
    try {
      await collectCodAtDropPoint(actionCn, {
        collected_amt: collectForm.amount,
        drop_point_code: collectForm.dropPointCode,
        recipient_name: collectForm.recipientName,
        note: collectForm.note,
      })
      setOk(`COD collected for ${actionCn}`)
      setActionCn(null)
      setCollectForm({ amount: '', dropPointCode: '', recipientName: '', note: '' })
      load()
    } catch (err) {
      setError(apiError(err))
    }
  }

  async function onRemit(cn) {
    const ref = cn === actionCn ? bilyetNo : null
    if (!ref) {
      setActionCn(cn)
      setBilyetNo('')
      return
    }
    try {
      await remitCod(cn, { bilyet_no: ref })
      setOk(`COD remitted for ${cn}`)
      setActionCn(null)
      setBilyetNo('')
      load()
    } catch (err) {
      setError(apiError(err))
    }
  }

  async function onSettle(cn) {
    if (!window.confirm(`Mark ${cn} as settled?`)) return
    try {
      await settleCod(cn)
      setOk(`COD settled for ${cn}`)
      load()
    } catch (err) {
      setError(apiError(err))
    }
  }

  return (
    <div>
      <h3 className="mb-3">COD Outstanding</h3>
      <p className="text-muted">
        Track cash-on-delivery from collection (driver POD or drop point counter) through bilyet remittance to settlement.
        Create Money In (Bilyet) under Drop Points before remitting.
      </p>
      <Alert error={error} ok={ok} />

      <div className="d-flex flex-wrap gap-2 mb-3">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn btn-sm ${status === t.key ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setStatus(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <form
            className="row g-2 align-items-end"
            onSubmit={(e) => { e.preventDefault(); load() }}
          >
            <div className="col-md-4">
              <label className="form-label small mb-0">Consignment number</label>
              <input
                className="form-control form-control-sm"
                value={cnFilter}
                onChange={(e) => setCnFilter(e.target.value.toUpperCase())}
                placeholder="Filter by CN"
              />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary btn-sm" type="submit">Search</button>
            </div>
            <div className="col-md-6 text-md-end small text-muted">{total} record(s)</div>
          </form>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark">
            <tr>
              <th>CN</th>
              <th>Customer</th>
              <th>Recipient</th>
              <th>Freight</th>
              <th>Expected</th>
              <th>Collected</th>
              <th>Status</th>
              <th>Source</th>
              <th>Drop point</th>
              <th>Collected at</th>
              <th>Bilyet</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={12} className="text-muted text-center py-4">No COD records</td></tr>
            ) : rows.map((r) => (
              <tr key={r.cnNo || r.id}>
                <td>
                  <Link to={`/consignments/new?cn=${encodeURIComponent(r.cnNo)}`}>{r.cnNo}</Link>
                  <div className="small">
                    <Link to={`/consignments/tracking?cn=${encodeURIComponent(r.cnNo)}`}>Track</Link>
                  </div>
                </td>
                <td>{r.custAcNo || '—'}</td>
                <td>{r.recpName || r.recipientName || '—'}</td>
                <td>{r.totCnAmt != null ? money(r.totCnAmt) : '—'}</td>
                <td>{money(r.expectedAmt)}</td>
                <td>{r.collectedAmt > 0 ? money(r.collectedAmt) : '—'}</td>
                <td>{statusBadge(r.status)}</td>
                <td>{r.source || '—'}</td>
                <td>{r.dropPointCode || '—'}</td>
                <td>{r.collectedAt ? String(r.collectedAt).slice(0, 16) : '—'}</td>
                <td>{r.remittanceRef || '—'}</td>
                <td className="text-nowrap">
                  {r.status === 'PENDING' && (
                    <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => {
                      setActionCn(r.cnNo)
                      setCollectForm({
                        amount: r.expectedAmt || r.cashAmt || '',
                        dropPointCode: r.dropPointCode || '',
                        recipientName: r.recpName || '',
                        note: '',
                      })
                    }}>
                      Collect
                    </button>
                  )}
                  {r.status === 'COLLECTED' && (
                    <button type="button" className="btn btn-sm btn-outline-warning me-1" onClick={() => { setActionCn(r.cnNo); setBilyetNo('') }}>
                      Remit
                    </button>
                  )}
                  {r.status === 'REMITTED' && (
                    <button type="button" className="btn btn-sm btn-outline-success" onClick={() => onSettle(r.cnNo)}>
                      Settle
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actionCn && collectForm.amount !== undefined && rows.find((r) => r.cnNo === actionCn && r.status === 'PENDING') && (
        <div className="card mt-3 border-primary">
          <div className="card-header">Drop point collection — {actionCn}</div>
          <div className="card-body">
            <form className="row g-3" onSubmit={onCollect}>
              <div className="col-md-3">
                <label className="form-label">Amount (RM)</label>
                <input type="number" step="0.01" className="form-control" required value={collectForm.amount} onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Drop point code</label>
                <input className="form-control" required value={collectForm.dropPointCode} onChange={(e) => setCollectForm({ ...collectForm, dropPointCode: e.target.value.toUpperCase() })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Recipient name</label>
                <input className="form-control" value={collectForm.recipientName} onChange={(e) => setCollectForm({ ...collectForm, recipientName: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Note</label>
                <input className="form-control" value={collectForm.note} onChange={(e) => setCollectForm({ ...collectForm, note: e.target.value })} />
              </div>
              <div className="col-12">
                <button className="btn btn-primary" type="submit">Record collection</button>{' '}
                <button className="btn btn-outline-secondary" type="button" onClick={() => setActionCn(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actionCn && rows.find((r) => r.cnNo === actionCn && r.status === 'COLLECTED') && (
        <div className="card mt-3 border-warning">
          <div className="card-header">Remit to bilyet — {actionCn}</div>
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Bilyet number</label>
                <input className="form-control" value={bilyetNo} onChange={(e) => setBilyetNo(e.target.value)} placeholder="From Money In (Bilyet)" />
              </div>
              <div className="col-md-4">
                <button type="button" className="btn btn-warning" onClick={() => onRemit(actionCn)}>Link bilyet</button>{' '}
                <button type="button" className="btn btn-outline-secondary" onClick={() => setActionCn(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
