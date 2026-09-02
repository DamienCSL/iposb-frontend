import { useEffect, useState } from 'react'
import { apiError, getWalletLedger } from '../api/client'
import { Alert, money } from '../ui/bits'

export default function WalletPage() {
  const [custAcNo, setCustAcNo] = useState('')
  const [mobileUserId, setMobileUserId] = useState('')
  const [data, setData] = useState({ wallet: null, entries: [] })
  const [error, setError] = useState('')

  async function load(e) {
    e?.preventDefault()
    setError('')
    if (!custAcNo && !mobileUserId) {
      setError('Enter a customer account or mobile user id.')
      return
    }
    try {
      const params = {}
      if (custAcNo) params.cust_ac_no = custAcNo
      if (mobileUserId) params.mobile_user_id = mobileUserId
      setData(await getWalletLedger(params))
    } catch (err) {
      setError(apiError(err))
    }
  }

  useEffect(() => {
    if (custAcNo || mobileUserId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wallet = data.wallet
  const entries = data.entries || []

  return (
    <div>
      <h3 className="mb-3">Customer Wallet</h3>
      <p className="text-muted">View wallet balance and refund ledger entries from order cancellations.</p>
      <Alert error={error} />

      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={load}>
            <div className="col-md-4">
              <label className="form-label">Customer account</label>
              <input className="form-control" value={custAcNo} onChange={(e) => setCustAcNo(e.target.value)} placeholder="e.g. C0001" />
            </div>
            <div className="col-md-3">
              <label className="form-label">Mobile user id</label>
              <input className="form-control" value={mobileUserId} onChange={(e) => setMobileUserId(e.target.value)} placeholder="optional" />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary" type="submit">Load</button>
            </div>
          </form>
        </div>
      </div>

      {wallet && (
        <div className="card mb-3 border-success">
          <div className="card-body py-2 d-flex justify-content-between align-items-center">
            <strong>Balance</strong>
            <span className="fs-5">{money(wallet.balance)}</span>
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark">
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Balance</th>
              <th>CN</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted py-3">No ledger entries</td></tr>
            ) : entries.map((e) => (
              <tr key={e.id}>
                <td>{String(e.createdAt || '').slice(0, 16)}</td>
                <td>{e.type}</td>
                <td>{money(e.amount)}</td>
                <td>{money(e.balanceAfter)}</td>
                <td>{e.cnNo || '—'}</td>
                <td>{e.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
