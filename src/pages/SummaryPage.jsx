import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiError, getSummary } from '../api/client'
import { Alert } from '../ui/bits'

const TITLES = {
  overall: 'Consignment Status Summary',
  status: 'Summary by Status',
  'drop-point': 'Summary by Drop Point',
  agent: 'Summary by Drop Point',
  consignee: 'Summary by Consignee',
  consigner: 'Summary by Consigner',
  shipper: 'Summary by Shipper',
  manifest: 'Summary by Manifest',
  date: 'Summary by Date',
  branch: 'Summary by Branch',
}

export default function SummaryPage({ kind = 'status' }) {
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState({
    date_from: params.get('date_from') || '',
    date_to: params.get('date_to') || '',
    cn_origin: params.get('cn_origin') || '',
  })
  const [data, setData] = useState({ rows: [], totals: {} })
  const [error, setError] = useState('')
  const apiKind = kind === 'overall' ? 'status' : kind

  useEffect(() => {
    getSummary(apiKind, Object.fromEntries(params.entries()))
      .then(setData)
      .catch((e) => setError(apiError(e)))
  }, [apiKind, params])

  return (
    <div>
      <h3 className="mb-3">{TITLES[kind] || 'Status Summary'}</h3>
      <Alert error={error} />
      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setParams(form) }}>
            <div className="col-md-2"><label className="form-label">Date From</label><input type="date" className="form-control form-control-sm" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Date To</label><input type="date" className="form-control form-control-sm" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Origin Branch</label><input className="form-control form-control-sm" maxLength={3} value={form.cn_origin} onChange={(e) => setForm({ ...form, cn_origin: e.target.value })} /></div>
            <div className="col-md-2"><button className="btn btn-primary btn-sm" type="submit">Filter</button></div>
          </form>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark"><tr><th>Key</th><th>Description</th><th>Count</th><th>Total Pieces</th><th>Total Weight (kg)</th><th>%</th></tr></thead>
          <tbody>
            {(data.rows || []).map((r, i) => (
              <tr key={i}>
                <td><span className="badge bg-secondary">{r.key_code || r.cn_status || '—'}</span></td>
                <td>{r.key_label || r.status_desc || ''}</td>
                <td>{r.cnt}</td>
                <td>{r.total_pcs}</td>
                <td>{Number(r.total_wt || 0).toFixed(2)}</td>
                <td>{r.pct}%</td>
              </tr>
            ))}
            {(data.rows || []).length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted">No records found. Load sample data or create consignments first.</td></tr>
            ) : (
              <tr className="table-warning fw-bold">
                <td colSpan={2}>TOTAL</td>
                <td>{data.totals?.cnt}</td>
                <td>{data.totals?.total_pcs}</td>
                <td>{Number(data.totals?.total_wt || 0).toFixed(2)}</td>
                <td>100%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
