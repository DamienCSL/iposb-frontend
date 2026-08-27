import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiError, getImportBatch, listImportBatches } from '../api/client'
import { Alert, Pager } from '../ui/bits'

const statusBadge = (s) => (s === 'ok' ? 'bg-success' : s === 'partial' ? 'bg-warning text-dark' : s === 'failed' ? 'bg-danger' : 'bg-secondary')
const statusLabel = (s) => (s === 'ok' ? 'No issues' : s === 'partial' ? 'Some rows failed' : s === 'failed' ? 'Import failed' : s)

export default function ImportLogPage() {
  const [params, setParams] = useSearchParams()
  const id = Number(params.get('id') || 0)
  const q = params.get('q') || ''
  const page = Number(params.get('page') || 1)
  const [list, setList] = useState({ rows: [], totalPages: 1 })
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState(q)
  const [error, setError] = useState('')

  useEffect(() => {
    listImportBatches({ q, page }).then(setList).catch((e) => setError(apiError(e)))
    if (id) getImportBatch(id).then(setDetail).catch(() => setDetail(null))
    else setDetail(null)
  }, [q, page, id])

  const batch = detail?.batch
  const errors = detail?.errors || []

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h3 className="mb-0">Import Error Log</h3>
          <p className="text-muted mb-0">Review why consignment spreadsheet rows were skipped or failed.</p>
        </div>
        <Link className="btn btn-outline-secondary btn-sm" to="/consignments">Back to Consignment List</Link>
      </div>
      <Alert error={error} />
      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setParams({ q: search, page: 1, id: id || undefined }) }}>
            <div className="col-md-4">
              <label className="form-label">Search</label>
              <input className="form-control form-control-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="File name, user, or summary" />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary btn-sm" type="submit">Search</button>{' '}
              <Link className="btn btn-outline-secondary btn-sm" to="/consignments/import-log">Reset</Link>
            </div>
          </form>
        </div>
      </div>

      {batch ? (
        <div className={`card mb-3 border-${batch.status === 'ok' ? 'success' : 'danger'}`}>
          <div className="card-header d-flex justify-content-between">
            <strong>Import #{batch.id}</strong>
            <span className={`badge ${statusBadge(batch.status)}`}>{statusLabel(batch.status)}</span>
          </div>
          <div className="card-body">
            <div className="row g-3 small">
              <div className="col-md-3"><strong>When</strong><br />{batch.created_at}</div>
              <div className="col-md-3"><strong>File</strong><br />{batch.file_name || '—'}</div>
              <div className="col-md-2"><strong>Imported by</strong><br />{batch.imported_by || '—'}</div>
              <div className="col-md-4"><strong>Result</strong><br />{batch.summary}</div>
            </div>
            {errors.length ? (
              <div className="table-responsive mt-3">
                <table className="table table-sm table-striped table-bordered">
                  <thead className="table-dark"><tr><th>Excel row</th><th>Consignment Number</th><th>Issue</th><th>Why it failed</th></tr></thead>
                  <tbody>
                    {errors.map((err) => (
                      <tr key={err.id}>
                        <td>{err.row_no}</td>
                        <td>{err.cn_no ? <Link to={`/consignments/tracking?cn=${encodeURIComponent(err.cn_no)}`}>{err.cn_no}</Link> : '—'}</td>
                        <td>{err.error_code}</td>
                        <td>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="alert alert-success mt-3 mb-0">This import had no row errors.</div>}
          </div>
        </div>
      ) : null}

      <h5 className="mb-2">Recent imports</h5>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark"><tr><th>When</th><th>File</th><th>By</th><th>Created</th><th>Updated</th><th>Issues</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(list.rows || []).map((b) => (
              <tr key={b.id} className={id === Number(b.id) ? 'table-warning' : ''}>
                <td className="text-nowrap">{b.created_at}</td>
                <td>{b.file_name}</td>
                <td>{b.imported_by}</td>
                <td>{b.created_count}</td>
                <td>{b.updated_count}</td>
                <td>{b.error_count}</td>
                <td><span className={`badge ${statusBadge(b.status)}`}>{statusLabel(b.status)}</span></td>
                <td><Link className="btn btn-sm btn-outline-primary" to={`/consignments/import-log?id=${b.id}`}>View</Link></td>
              </tr>
            ))}
            {(list.rows || []).length === 0 ? <tr><td colSpan={8} className="text-muted">No imports yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={list.totalPages || 1} onPage={(p) => setParams({ q, page: p, id: id || undefined })} />
    </div>
  )
}
