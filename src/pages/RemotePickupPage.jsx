import { useQuery } from '@tanstack/react-query'
import { getUncoveredJobs } from '../api/client'

export default function RemotePickupPage() {
  const q = useQuery({
    queryKey: ['uncovered'],
    queryFn: getUncoveredJobs,
    retry: false,
  })

  const jobs = q.data?.jobs || []

  return (
    <div>
      <h1 className="page-title">Remote / 3PL Pickup</h1>
      <p className="lede">Uncovered pickups from GET /api/dispatch/uncovered.</p>

      {q.isLoading ? <p className="muted">Loading…</p> : null}
      {q.isError ? (
        <div className="alert">{q.error?.response?.data?.error || q.error.message}</div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>CN</th>
              <th>Coverage</th>
              <th>Area / notes</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.cnNo || j.cn_no || JSON.stringify(j)}>
                <td>{j.cnNo || j.cn_no}</td>
                <td>{j.coverageType || j.pickup_owner_type || 'uncovered'}</td>
                <td>{j.address || j.remarks || j.areaName || '—'}</td>
              </tr>
            ))}
            {!q.isLoading && jobs.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  No uncovered jobs.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
