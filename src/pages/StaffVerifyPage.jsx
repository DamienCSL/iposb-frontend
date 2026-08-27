import { useEffect, useState } from 'react'
import { apiError, listStaff, verifyStaff } from '../api/client'
import { Alert } from '../ui/bits'

export default function StaffVerifyPage() {
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  function reload() {
    listStaff(tab).then((d) => setRows(d.rows || [])).catch((e) => setError(apiError(e)))
  }

  useEffect(() => { reload() }, [tab])

  return (
    <div>
      <h3 className="mb-3">Staff Verification</h3>
      <p className="text-muted">Approve driver / dispatcher app sign-ups.</p>
      <Alert error={error} ok={ok} />
      <div className="btn-group mb-3">
        {['pending', 'approved', 'rejected'].map((t) => (
          <button key={t} type="button" className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark"><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.full_name}</td>
                <td>{r.email}</td>
                <td>{r.role}</td>
                <td>{r.verification_status || (r.is_active ? 'approved' : 'pending')}</td>
                <td className="text-nowrap">
                  {tab === 'pending' ? (
                    <>
                      <button className="btn btn-sm btn-success" onClick={async () => {
                        try { await verifyStaff(r.id, 'approve'); setOk('Approved'); reload() } catch (err) { setError(apiError(err)) }
                      }}>Approve</button>{' '}
                      <button className="btn btn-sm btn-outline-danger" onClick={async () => {
                        try { await verifyStaff(r.id, 'reject', 'Rejected in FMS'); setOk('Rejected'); reload() } catch (err) { setError(apiError(err)) }
                      }}>Reject</button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="text-muted">No accounts.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
