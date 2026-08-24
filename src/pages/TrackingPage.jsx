import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTracking } from '../api/client'

export default function TrackingPage() {
  const [cn, setCn] = useState('')
  const [lookup, setLookup] = useState('')

  const q = useQuery({
    queryKey: ['tracking', lookup],
    queryFn: () => getTracking(lookup),
    enabled: lookup.length > 0,
    retry: false,
  })

  function onSubmit(e) {
    e.preventDefault()
    setLookup(cn.trim())
  }

  const events = q.data?.timeline || q.data?.events || q.data?.history || []
  const list = Array.isArray(events) ? events : []

  return (
    <div>
      <h1 className="page-title">Consignment Tracking</h1>
      <p className="lede">Calls GET /api/tracking/{'{cn}'} on the Laravel API.</p>

      <form className="toolbar" onSubmit={onSubmit}>
        <input
          value={cn}
          onChange={(e) => setCn(e.target.value)}
          placeholder="Consignment number"
          aria-label="Consignment number"
        />
        <button type="submit" className="btn-primary">
          Track
        </button>
      </form>

      {q.isFetching ? <p className="muted">Looking up…</p> : null}
      {q.isError ? <div className="alert">{q.error?.response?.data?.error || q.error.message}</div> : null}

      {q.data && !q.isFetching ? (
        <div className="panel wide">
          <p>
            <strong>CN</strong> {lookup}
            {q.data.customerLabel ? (
              <>
                {' '}
                · <strong>{q.data.customerLabel}</strong>
              </>
            ) : null}
          </p>
          {list.length === 0 ? (
            <pre className="json">{JSON.stringify(q.data, null, 2)}</pre>
          ) : (
            <ol className="timeline">
              {list.map((ev, i) => (
                <li key={i}>
                  <span className="when">{ev.occurredAt || ev.time || ev.upd_dt_tm || ''}</span>
                  <span className="code">{ev.code || ev.status || ev.cn_status || ''}</span>
                  <span>{ev.label || ev.customerLabel || ev.event_description || ev.remarks || ''}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  )
}
