import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  apiError,
  cancelConsignment,
  downloadCsv,
  exportConsignments,
  getCnLookups,
  importConsignments,
  listConsignments,
} from '../api/client'
import { Alert, Pager, money } from '../ui/bits'

const EXPORT_COLS = {
  cn_no: 'Consignment Number',
  cust_ac_no: 'Customer Account',
  cust_name: 'Customer Name',
  cn_status: 'Status',
  srv_typ: 'Service Type',
  pkg_typ: 'Package Type',
  cn_origin: 'Origin Branch',
  cn_dstn: 'Destination Branch',
  origin_zone: 'Origin Zone',
  destination_zone: 'Destination Zone',
  cn_pcs: 'Pieces',
  cn_wt: 'Weight (kg)',
  pu_dt: 'Pickup Date',
  tot_cn_amt: 'Total Amount (RM)',
  inv_no: 'Invoice Number',
  cn_inv_flg: 'Invoice Flag',
  consigner: 'Consigner',
  consignee: 'Consignee',
  recp_name: 'Recipient',
  cn_dt_tm: 'Created At',
  remarks: 'Remarks',
}

export default function ConsignmentListPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const filters = useMemo(
    () => ({
      cn_no: params.get('cn_no') || '',
      cust_ac_no: params.get('cust_ac_no') || '',
      cn_status: params.get('cn_status') || '',
      cn_origin: params.get('cn_origin') || '',
      date_from: params.get('date_from') || '',
      date_to: params.get('date_to') || '',
      page: Number(params.get('page') || 1),
    }),
    [params],
  )
  const [form, setForm] = useState(filters)
  const [data, setData] = useState({ rows: [], totalPages: 1, page: 1 })
  const [statuses, setStatuses] = useState([])
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [cols, setCols] = useState(Object.keys(EXPORT_COLS))
  const [file, setFile] = useState(null)

  useEffect(() => {
    getCnLookups()
      .then((d) => setStatuses(d.statuses || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setForm(filters)
    setError('')
    listConsignments(filters)
      .then(setData)
      .catch((e) => setError(apiError(e)))
  }, [filters])

  function applyFilters(e) {
    e.preventDefault()
    const next = { ...form, page: 1 }
    Object.keys(next).forEach((k) => {
      if (!next[k]) delete next[k]
    })
    setParams(next)
  }

  async function onCancel(cn) {
    if (!window.confirm(`Cancel consignment ${cn}?`)) return
    try {
      const r = await cancelConsignment(cn)
      setOk(r.message)
      const d = await listConsignments(filters)
      setData(d)
    } catch (e) {
      setError(apiError(e))
    }
  }

  function trackSelected() {
    if (selected.length === 0) return
    const first = selected[0]
    navigate(`/consignments/tracking?cn=${encodeURIComponent(selected.join(','))}&tab=${encodeURIComponent(first)}`)
  }

  async function doExport() {
    try {
      const r = await exportConsignments({ ...filters, cols, selected })
      downloadCsv(r.filename || 'consignments.csv', r.rows || [])
      setShowExport(false)
    } catch (e) {
      setError(apiError(e))
    }
  }

  async function doImport(e) {
    e.preventDefault()
    if (!file) return
    try {
      const r = await importConsignments(file)
      setShowImport(false)
      navigate(`/consignments/import-log?id=${r.batchId}`)
    } catch (err) {
      setError(apiError(err))
    }
  }

  const rows = data.rows || []
  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.cn_no))

  return (
    <div>
      <h3 className="mb-3">Consignment List</h3>
      <p className="text-muted">Search, export, import, or tick consignments and track them together. Billed consignments cannot be cancelled.</p>
      <Alert error={error} ok={ok} />

      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={applyFilters}>
            <div className="col-md-2">
              <label className="form-label">Consignment Number</label>
              <input className="form-control form-control-sm" value={form.cn_no} onChange={(e) => setForm({ ...form, cn_no: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Customer Account</label>
              <input className="form-control form-control-sm" value={form.cust_ac_no} onChange={(e) => setForm({ ...form, cust_ac_no: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Status</label>
              <select className="form-select form-select-sm" value={form.cn_status} onChange={(e) => setForm({ ...form, cn_status: e.target.value })}>
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Origin Branch</label>
              <input className="form-control form-control-sm" maxLength={3} value={form.cn_origin} onChange={(e) => setForm({ ...form, cn_origin: e.target.value })} />
            </div>
            <div className="col-md-1">
              <label className="form-label">Date From</label>
              <input type="date" className="form-control form-control-sm" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} />
            </div>
            <div className="col-md-1">
              <label className="form-label">Date To</label>
              <input type="date" className="form-control form-control-sm" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary btn-sm" type="submit">Search</button>{' '}
              <Link className="btn btn-outline-secondary btn-sm" to="/consignments">Reset</Link>
            </div>
          </form>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <button type="button" className="btn btn-primary btn-sm" onClick={trackSelected}><i className="bi bi-search" /> Track selected</button>
          <button type="button" className="btn btn-success btn-sm" onClick={() => setShowExport(true)}><i className="bi bi-file-earmark-excel" /> Export to Excel</button>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setShowImport(true)}><i className="bi bi-upload" /> Import from Excel</button>
          <a className="btn btn-outline-secondary btn-sm" href={`data:text/csv,${encodeURIComponent(['Consignment Number,Customer Account,Service Type,Package Type,Origin Branch,Destination Branch,Origin Zone,Destination Zone,Pieces,Weight (kg),Pickup Date,Consigner,Consignee,Recipient,Remarks'].join('\n'))}`} download="consignment_import_template.csv"><i className="bi bi-download" /> Download import template</a>
          <Link className="btn btn-outline-danger btn-sm" to="/consignments/import-log"><i className="bi bi-exclamation-octagon" /> Import error log</Link>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered align-middle">
          <thead className="table-dark">
            <tr>
              <th style={{ width: '2.2rem' }}>
                <input className="form-check-input" type="checkbox" checked={allChecked} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.cn_no) : [])} />
              </th>
              <th>Consignment Number</th><th>Customer</th><th>Status</th><th>Service Type</th><th>Package Type</th>
              <th>Origin Branch</th><th>Destination Branch</th><th>Pieces</th><th>Weight (kg)</th>
              <th>Pickup Date</th><th>Total Amount (RM)</th><th>Invoice Number</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={14} className="text-center text-muted">No consignments found. Create one via Consignment Entry, import an Excel file, or load sample data.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.cn_no}>
                <td>
                  <input className="form-check-input" type="checkbox" checked={selected.includes(row.cn_no)} onChange={(e) => {
                    setSelected((prev) => e.target.checked ? [...prev, row.cn_no] : prev.filter((x) => x !== row.cn_no))
                  }} />
                </td>
                <td>{row.cn_no}</td>
                <td>{row.cust_ac_no} {row.cust_name || ''}</td>
                <td><span className="badge bg-secondary">{row.cn_status}</span></td>
                <td>{row.srv_typ}</td>
                <td>{row.pkg_typ === 'D' ? 'Document' : row.pkg_typ === 'P' ? 'Parcel' : row.pkg_typ}</td>
                <td>{row.cn_origin}</td>
                <td>{row.cn_dstn}</td>
                <td>{row.cn_pcs}</td>
                <td>{row.cn_wt}</td>
                <td>{row.pu_dt || ''}</td>
                <td>{money(row.tot_cn_amt)}</td>
                <td>{row.inv_no || ''}</td>
                <td className="text-nowrap">
                  <Link className="btn btn-sm btn-outline-primary" to={`/consignments/tracking?cn=${encodeURIComponent(row.cn_no)}`}>Track</Link>{' '}
                  <Link className="btn btn-sm btn-outline-secondary" to={`/consignments/new?cn=${encodeURIComponent(row.cn_no)}`}>Edit</Link>{' '}
                  {row.cn_status !== 'CAN' && row.cn_inv_flg !== 'B' ? (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onCancel(row.cn_no)}>Cancel</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-muted small mb-2">{selected.length} selected on this page</div>
      <Pager page={data.page || 1} totalPages={data.totalPages || 1} onPage={(p) => setParams({ ...Object.fromEntries(params.entries()), page: p })} />

      {showExport ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,.35)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Export to Excel</h5><button className="btn-close" onClick={() => setShowExport(false)} /></div>
              <div className="modal-body">
                <div className="row g-2">
                  {Object.entries(EXPORT_COLS).map(([k, label]) => (
                    <div className="col-md-4" key={k}>
                      <label className="form-check">
                        <input className="form-check-input" type="checkbox" checked={cols.includes(k)} onChange={(e) => setCols((c) => e.target.checked ? [...c, k] : c.filter((x) => x !== k))} />
                        <span className="form-check-label">{label}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowExport(false)}>Close</button>
                <button className="btn btn-success" onClick={doExport}><i className="bi bi-download" /> Download Excel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showImport ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,.35)' }}>
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={doImport}>
              <div className="modal-header"><h5 className="modal-title">Import from Excel</h5><button type="button" className="btn-close" onClick={() => setShowImport(false)} /></div>
              <div className="modal-body">
                <p className="text-muted small">Upload .xls, .xlsx, or .csv. First row must be column headers.</p>
                <input type="file" className="form-control" accept=".xls,.xlsx,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowImport(false)}>Close</button>
                <button className="btn btn-primary" type="submit">Import</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
