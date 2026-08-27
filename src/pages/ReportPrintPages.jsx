import { useEffect, useState } from 'react'
import { apiError, getPrint, getReport } from '../api/client'
import { Alert, money } from '../ui/bits'

export function ReportPage({ kind, title }) {
  const [form, setForm] = useState({ date_from: '', date_to: '', code: '' })
  const [data, setData] = useState({ rows: [], lookups: [] })
  const [error, setError] = useState('')

  function load(e) {
    e?.preventDefault()
    getReport(kind, form).then(setData).catch((err) => setError(apiError(err)))
  }

  useEffect(() => { load() }, [kind])

  return (
    <div>
      <h3 className="mb-3">{title}</h3>
      <Alert error={error} />
      <form className="row g-2 mb-3" onSubmit={load}>
        <div className="col-md-3">
          <select className="form-select form-select-sm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
            <option value="">All</option>
            {(data.lookups || []).map((l) => <option key={l.code} value={l.code}>{l.code} {l.name || ''}</option>)}
          </select>
        </div>
        <div className="col-md-2"><input type="date" className="form-control form-control-sm" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} /></div>
        <div className="col-md-2"><input type="date" className="form-control form-control-sm" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} /></div>
        <div className="col-md-2"><button className="btn btn-primary btn-sm" type="submit">Run</button></div>
      </form>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark"><tr><th>CN</th><th>Status</th><th>Origin</th><th>Dest</th><th>Pcs</th><th>Wt</th><th>Amount</th><th>Date</th></tr></thead>
          <tbody>
            {(data.rows || []).map((r) => (
              <tr key={r.cn_no}>
                <td>{r.cn_no}</td><td>{r.cn_status}</td><td>{r.cn_origin}</td><td>{r.cn_dstn}</td>
                <td>{r.cn_pcs}</td><td>{r.cn_wt}</td><td>{money(r.tot_cn_amt)}</td><td>{r.cn_dt_tm}</td>
              </tr>
            ))}
            {(data.rows || []).length === 0 ? <tr><td colSpan={8} className="text-muted">No records.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PrintPage({ kind, title, idLabel }) {
  const [id, setId] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function run(e) {
    e.preventDefault()
    try {
      setData(await getPrint(kind, id))
    } catch (err) {
      setError(apiError(err))
    }
  }

  return (
    <div>
      <h3 className="mb-3">{title}</h3>
      <Alert error={error} />
      <form className="row g-2 mb-3" onSubmit={run}>
        <div className="col-md-4"><input className="form-control" placeholder={idLabel} value={id} onChange={(e) => setId(e.target.value)} required /></div>
        <div className="col-md-2"><button className="btn btn-primary" type="submit">Print preview</button></div>
      </form>
      {data && !data.row ? (
        <div className="alert alert-warning">No record found for that number.</div>
      ) : data?.row ? (
        <div className="card">
          <div className="card-header d-flex justify-content-between">
            <strong>{data.title}</strong>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => window.print()}>Print</button>
          </div>
          <div className="card-body">
            <table className="table table-sm">
              <tbody>
                {Object.entries(data.row).map(([k, v]) => (
                  <tr key={k}><th style={{ width: 220 }}>{k}</th><td>{v == null ? '—' : String(v)}</td></tr>
                ))}
              </tbody>
            </table>
            {(data.lines || []).length ? (
              <table className="table table-sm">
                <thead><tr>{Object.keys(data.lines[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                <tbody>
                  {data.lines.map((l, i) => <tr key={i}>{Object.values(l).map((v, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      ) : <p className="text-muted">Enter a number to preview.</p>}
    </div>
  )
}
