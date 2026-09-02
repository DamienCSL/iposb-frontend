import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiError, listCancellationLog } from '../api/client'
import { Alert, money, Pager } from '../ui/bits'

export default function CancellationLogPage() {
  const [data, setData] = useState({ rows: [], page: 1, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  async function load(p = page) {
    setError('')
    try {
      const result = await listCancellationLog({ page: p })
      setData(result)
      setPage(result.page || p)
    } catch (e) {
      setError(apiError(e))
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = data.rows || []

  return (
    <div>
      <h3 className="mb-3">Cancellation audit log</h3>
      <p className="text-muted">
        All completed cancellations with processing fee, wallet refund, and credit note references.
        Eligible requests are processed immediately — no manual approval queue.
      </p>
      <Alert error={error} />

      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered align-middle">
          <thead className="table-dark">
            <tr>
              <th>CN</th>
              <th>Customer</th>
              <th>Tier</th>
              <th>Freight</th>
              <th>Processing fee</th>
              <th>Wallet refund</th>
              <th>Credit note</th>
              <th>By / source</th>
              <th>When</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted">
                  No cancellation records yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.cnNo}-${row.cancelledAt}`}>
                  <td>
                    <Link to={`/consignments/tracking?cn=${encodeURIComponent(row.cnNo)}`}>{row.cnNo}</Link>
                  </td>
                  <td>
                    {row.custAcNo}
                    {row.recipientName ? <div className="small text-muted">{row.recipientName}</div> : null}
                  </td>
                  <td>
                    <div className="small">{row.tierLabel}</div>
                    <div className="text-muted small">{row.feePct}%</div>
                  </td>
                  <td>{money(row.freightAmt)}</td>
                  <td className="text-danger">{money(row.feeAmt)}</td>
                  <td className="text-success">{money(row.refundAmt)}</td>
                  <td>{row.creditNoteNo || '—'}</td>
                  <td>
                    <div className="small">{row.cancelledBy || '—'}</div>
                    <div className="text-muted small">{row.source || ''}</div>
                  </td>
                  <td className="small text-nowrap">{row.cancelledAt || '—'}</td>
                  <td className="small">{row.reason || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager page={data.page || 1} totalPages={data.totalPages || 1} onPage={(p) => load(p)} />
    </div>
  )
}
