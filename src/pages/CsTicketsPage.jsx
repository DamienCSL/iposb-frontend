import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiError, closeCsTicket, getCsTicket, listCsTickets, replyCsTicket } from '../api/client'
import { Alert } from '../ui/bits'

export default function CsTicketsPage() {
  const [params, setParams] = useSearchParams()
  const id = Number(params.get('id') || 0)
  const [filters, setFilters] = useState({
    queue: params.get('queue') || 'waiting',
    q: params.get('q') || '',
    awb: params.get('awb') || '',
    category: params.get('category') || '',
  })
  const [inbox, setInbox] = useState({ tickets: [], summary: {}, categories: {} })
  const [detail, setDetail] = useState(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    listCsTickets(Object.fromEntries(params.entries())).then(setInbox).catch((e) => setError(apiError(e)))
    if (id) getCsTicket(id).then(setDetail).catch(() => setDetail(null))
    else setDetail(null)
  }, [params, id])

  async function sendReply(e) {
    e.preventDefault()
    if (!id || !reply.trim()) return
    try {
      await replyCsTicket(id, reply)
      setReply('')
      setOk('Reply sent.')
      setDetail(await getCsTicket(id))
    } catch (err) {
      setError(apiError(err))
    }
  }

  const tickets = inbox.tickets || []
  const summary = inbox.summary || {}

  return (
    <div>
      <h3 className="mb-3">Customer Service Tickets</h3>
      <Alert error={error} ok={ok} />
      <div className="d-flex gap-2 mb-3">
        {['waiting', 'in_progress', 'closed', 'all'].map((q) => (
          <button key={q} type="button" className={`btn btn-sm ${filters.queue === q ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setFilters({ ...filters, queue: q }); setParams({ ...filters, queue: q }) }}>
            {q === 'waiting' ? `Pending (${summary.waiting || 0})` : q === 'in_progress' ? `Processing (${summary.in_progress || 0})` : q === 'closed' ? `Processed (${summary.closed || 0})` : 'All'}
          </button>
        ))}
      </div>
      <div className="card mb-3"><div className="card-body">
        <form className="row g-2" onSubmit={(e) => { e.preventDefault(); setParams(filters) }}>
          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></div>
          <div className="col-md-2"><input className="form-control form-control-sm" placeholder="AWB / CN" value={filters.awb} onChange={(e) => setFilters({ ...filters, awb: e.target.value })} /></div>
          <div className="col-md-2">
            <select className="form-select form-select-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {Object.entries(inbox.categories || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-2"><button className="btn btn-primary btn-sm" type="submit">Filter</button></div>
        </form>
      </div></div>
      <div className="row">
        <div className={id ? 'col-md-6' : 'col-12'}>
          <div className="table-responsive">
            <table className="table table-sm table-striped table-bordered">
              <thead className="table-dark"><tr><th>Ticket</th><th>CN</th><th>Customer</th><th>Queue</th><th></th></tr></thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>{t.ticketNo || t.id}</td>
                    <td>{t.cnNo}</td>
                    <td>{t.customerName || t.fullName || ''}</td>
                    <td>{t.csQueue || t.status}</td>
                    <td><Link className="btn btn-sm btn-outline-primary" to={`/cs/tickets?${new URLSearchParams({ ...Object.fromEntries(params.entries()), id: t.id })}`}>Open</Link></td>
                  </tr>
                ))}
                {tickets.length === 0 ? <tr><td colSpan={5} className="text-muted">No tickets.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        {detail ? (
          <div className="col-md-6">
            <div className="card">
              <div className="card-header d-flex justify-content-between">
                <strong>{detail.ticket?.ticketNo || detail.ticket?.id}</strong>
                <button className="btn btn-sm btn-outline-danger" onClick={async () => {
                  try {
                    await closeCsTicket(id)
                    setOk('Closed.')
                    setDetail(await getCsTicket(id))
                  } catch (err) {
                    setError(apiError(err))
                  }
                }}>Close ticket</button>
              </div>
              <div className="card-body" style={{ maxHeight: 360, overflow: 'auto' }}>
                {(detail.messages || []).map((m) => (
                  <div key={m.id || m.created_at} className="mb-2">
                    <div className="small text-muted">{m.senderName || m.senderRole || m.from_role} · {m.createdAt || m.created_at || m.at}</div>
                    <div>{m.body || m.message}</div>
                  </div>
                ))}
              </div>
              <div className="card-footer">
                <form onSubmit={sendReply}>
                  <textarea className="form-control mb-2" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to customer" />
                  <button className="btn btn-primary btn-sm" type="submit">Send reply</button>
                </form>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
