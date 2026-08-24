import { useQuery } from '@tanstack/react-query'
import { getDispatchJobs } from '../api/client'

export default function DispatchJobsPage() {
  const q = useQuery({
    queryKey: ['dispatch-jobs'],
    queryFn: () => getDispatchJobs(false),
    retry: false,
  })

  const jobs = q.data?.jobs || []

  return (
    <div>
      <h1 className="page-title">Driver Assignment</h1>
      <p className="lede">
        Unassigned jobs from GET /api/dispatch/jobs. Needs PHP API running and{' '}
        <code>VITE_DISPATCH_KEY</code> (or a dispatcher Bearer token later).
      </p>

      {q.isLoading ? <p className="muted">Loading…</p> : null}
      {q.isError ? (
        <div className="alert">{q.error?.response?.data?.error || q.error.message}</div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>CN</th>
              <th>Type</th>
              <th>Status</th>
              <th>Origin / dest</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.cnNo || j.cn_no || JSON.stringify(j)}>
                <td>{j.cnNo || j.cn_no}</td>
                <td>{j.jobType || j.job_type || '—'}</td>
                <td>{j.customerLabel || j.status || '—'}</td>
                <td>
                  {j.origin || j.originLoc || j.from || '—'} → {j.dest || j.destLoc || j.to || '—'}
                </td>
              </tr>
            ))}
            {!q.isLoading && jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No unassigned jobs (or API not reachable).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
