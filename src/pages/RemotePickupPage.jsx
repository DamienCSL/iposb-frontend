import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiError, assign3pl, get3plPartners, getUncoveredJobs, planDispatch } from '../api/client'

const TABS = {
  all: 'All open',
  uncovered: 'Uncovered (HQ)',
  '3pl': 'Assigned 3PL',
  unresolved: 'Not classified',
}

export default function RemotePickupPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'all'
  const [partnerByCn, setPartnerByCn] = useState({})
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState('')

  const jobsQuery = useQuery({
    queryKey: ['uncovered'],
    queryFn: getUncoveredJobs,
    retry: false,
  })
  const partnersQuery = useQuery({
    queryKey: ['3pl-partners'],
    queryFn: get3plPartners,
    retry: false,
  })

  const allJobs = jobsQuery.data?.jobs || []
  const partners = partnersQuery.data || []
  const jobs = useMemo(() => {
    if (tab === '3pl') return allJobs.filter((j) => (j.pickup_owner_type || '') === '3pl')
    if (tab === 'uncovered') return allJobs.filter((j) => (j.pickup_owner_type || '') === 'uncovered')
    if (tab === 'unresolved') return allJobs.filter((j) => !String(j.pickup_owner_type || '').trim())
    return allJobs
  }, [allJobs, tab])

  async function resolveCoverage(cnNo) {
    setMessage('')
    setOk('')
    try {
      const plan = await planDispatch(cnNo, true)
      const ctype = plan?.path?.coverageType || ''
      if (ctype === '3pl') {
        setOk(`${cnNo} matched 3PL coverage${plan.path?.['3plPartnerName'] ? ': ' + plan.path['3plPartnerName'] : ''}.`)
      } else if (ctype === 'uncovered') {
        setOk(`${cnNo} is uncovered — HQ must pick a 3PL partner or override to a driver.`)
      } else if (plan?.autoAssign?.applied) {
        setOk(`${cnNo} auto-assigned to ${plan.staff?.pickup?.fullName || 'driver'}.`)
      } else {
        setOk(
          `${cnNo} coverage resolved as own DP${plan.path?.lockedDropCode ? ' (' + plan.path.lockedDropCode + ')' : ''}.`,
        )
      }
      jobsQuery.refetch()
    } catch (err) {
      setMessage(apiError(err))
    }
  }

  async function onAssign3pl(cnNo) {
    const partnerId = Number(partnerByCn[cnNo] || 0)
    if (!partnerId) {
      setMessage('Select a 3PL partner.')
      return
    }
    setMessage('')
    setOk('')
    try {
      const result = await assign3pl({ cnNo, partnerId })
      setOk(`${cnNo} assigned to 3PL ${result.partnerName || result.partnerCode || ''}`)
      jobsQuery.refetch()
    } catch (err) {
      setMessage(apiError(err))
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Remote / 3PL Pickup Queue</h3>
          <p className="text-muted mb-0">
            Uncovered and third-party pickups stay here. Auto-assign never picks the nearest own DP for these CNs.
          </p>
        </div>
        <Link className="btn btn-outline-secondary btn-sm" to="/dispatch/assign">
          Driver assignment
        </Link>
      </div>

      {message || jobsQuery.isError ? (
        <div className="alert alert-danger">{message || apiError(jobsQuery.error)}</div>
      ) : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}

      <ul className="nav nav-pills mb-3">
        {Object.entries(TABS).map(([key, label]) => (
          <li className="nav-item" key={key}>
            <button
              type="button"
              className={`nav-link ${tab === key ? 'active' : ''}`}
              onClick={() => setParams({ tab: key })}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      <div className="card">
        <div className="card-body table-responsive">
          <table className="table table-sm table-bordered align-middle">
            <thead className="table-light">
              <tr>
                <th>CN</th>
                <th>Owner</th>
                <th>Coverage</th>
                <th>Origin / sender</th>
                <th>3PL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const cnKey = String(j.consignment_no || j.cn_no || '')
                const owner = String(j.pickup_owner_type || '')
                return (
                  <tr key={cnKey}>
                    <td>
                      <Link to={`/dispatch/assign?cn_no=${encodeURIComponent(cnKey)}`}>
                        <code>{cnKey}</code>
                      </Link>
                      <div className="small text-muted">{j.cn_status || ''}</div>
                    </td>
                    <td>
                      {owner === '3pl' ? (
                        <span className="badge text-bg-info">3PL</span>
                      ) : owner === 'uncovered' ? (
                        <span className="badge text-bg-warning">Uncovered</span>
                      ) : (
                        <span className="badge text-bg-secondary">Unresolved</span>
                      )}
                    </td>
                    <td className="small">
                      {j.area_code || ''}
                      {j.area_name ? <div className="text-muted">{j.area_name}</div> : null}
                    </td>
                    <td className="small">
                      {j.cn_origin || ''}
                      {j.origin_zone ? <span className="text-muted"> / {j.origin_zone}</span> : null}
                      <div>{j.sender_address || j.consigner || ''}</div>
                    </td>
                    <td className="small">{j.partner_name || j.partner_code || ''}</td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => resolveCoverage(cnKey)}>
                        Resolve coverage
                      </button>
                      {owner !== '3pl' ? (
                        <div className="d-inline-flex gap-1 align-items-center mt-1">
                          <select
                            className="form-select form-select-sm"
                            value={partnerByCn[cnKey] || ''}
                            onChange={(e) => setPartnerByCn((prev) => ({ ...prev, [cnKey]: e.target.value }))}
                          >
                            <option value="">3PL…</option>
                            {partners.map((p) => (
                              <option key={p.id} value={p.id}>
                                {(p.partner_code || '') + ' — ' + (p.partner_name || '')}
                              </option>
                            ))}
                          </select>
                          <button className="btn btn-sm btn-outline-success" onClick={() => onAssign3pl(cnKey)}>
                            Assign 3PL
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
              {!jobsQuery.isLoading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No CNs in this queue.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
