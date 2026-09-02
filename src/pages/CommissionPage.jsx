import { useEffect, useState } from 'react'
import {
  accrueCommission,
  advanceCommissionWithdrawal,
  apiError,
  getCommissionConfig,
  listCommissionWithdrawals,
  listCommissions,
  listPartnerWallets,
  requestCommissionWithdrawal,
  verifyCommission,
} from '../api/client'
import { Alert, money } from '../ui/bits'

const TABS = ['ledger', 'wallets', 'withdrawals']

export default function CommissionPage() {
  const [tab, setTab] = useState('ledger')
  const [config, setConfig] = useState(null)
  const [ledger, setLedger] = useState({ rows: [], total: 0 })
  const [wallets, setWallets] = useState({ rows: [] })
  const [withdrawals, setWithdrawals] = useState({ rows: [] })
  const [status, setStatus] = useState('PROCESSING')
  const [cn, setCn] = useState('')
  const [accrueCn, setAccrueCn] = useState('')
  const [withdrawForm, setWithdrawForm] = useState({ partnerCode: '', amount: '', note: '' })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function load() {
    setError('')
    try {
      const cfg = await getCommissionConfig()
      setConfig(cfg)
      if (tab === 'ledger') {
        setLedger(await listCommissions({ status: status === 'ALL' ? '' : status, cn: cn || undefined }))
      } else if (tab === 'wallets') {
        setWallets(await listPartnerWallets())
      } else {
        setWithdrawals(await listCommissionWithdrawals({ status: 'ALL' }))
      }
    } catch (e) {
      setError(apiError(e))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status])

  async function onVerify(id) {
    try {
      await verifyCommission(id)
      setOk('Commission verified and released to wallet.')
      load()
    } catch (e) {
      setError(apiError(e))
    }
  }

  async function onAccrue(e) {
    e.preventDefault()
    if (!accrueCn.trim()) return
    try {
      const r = await accrueCommission(accrueCn.trim().toUpperCase())
      setOk(r.skipped ? `Skipped: ${r.reason}` : `Commission accrued for ${r.cnNo}`)
      setAccrueCn('')
      load()
    } catch (err) {
      setError(apiError(err))
    }
  }

  async function onWithdraw(e) {
    e.preventDefault()
    try {
      await requestCommissionWithdrawal(withdrawForm.partnerCode, {
        amount: withdrawForm.amount,
        note: withdrawForm.note,
      })
      setOk('Withdrawal requested.')
      setWithdrawForm({ partnerCode: '', amount: '', note: '' })
      load()
    } catch (err) {
      setError(apiError(err))
    }
  }

  async function onAdvance(id, action) {
    try {
      await advanceCommissionWithdrawal(id, action)
      setOk(`Withdrawal ${action}.`)
      load()
    } catch (e) {
      setError(apiError(e))
    }
  }

  const rows = ledger.rows || []
  const walletRows = wallets.rows || []
  const wdRows = withdrawals.rows || []

  return (
    <div>
      <h3 className="mb-3">Commission & Partner Wallets</h3>
      <p className="text-muted">
        Partner payouts on delivery: hub-count, lorry (RM/kg), delivery (RM/kg).
        Verify processing lines to release funds; withdrawals allowed days 1–5 and 15–19.
      </p>
      {config && (
        <p className="small text-muted">
          Rates: hub tier1 {config.hubTier1Rate}/pc (≤{config.hubTier1MaxPcs} pcs),
          tier2 {config.hubTier2Rate}/pc · lorry {config.lorryPerKg}/kg · delivery {config.deliveryPerKg}/kg
          {config.withdrawalWindowOpen ? ' · withdrawal window open' : ' · withdrawal window closed'}
        </p>
      )}
      <Alert error={error} ok={ok} />

      <div className="d-flex gap-2 mb-3">
        {TABS.map((t) => (
          <button key={t} type="button" className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTab(t)}>
            {t === 'ledger' ? 'Commission ledger' : t === 'wallets' ? 'Partner wallets' : 'Withdrawals'}
          </button>
        ))}
      </div>

      {tab === 'ledger' && (
        <>
          <div className="card mb-3"><div className="card-body">
            <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); load() }}>
              <div className="col-md-3">
                <label className="form-label small">Status</label>
                <select className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {['PROCESSING', 'AVAILABLE', 'ALL'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small">CN filter</label>
                <input className="form-control form-control-sm" value={cn} onChange={(e) => setCn(e.target.value.toUpperCase())} />
              </div>
              <div className="col-md-2"><button className="btn btn-primary btn-sm" type="submit">Filter</button></div>
            </form>
          </div></div>

          <div className="card mb-3"><div className="card-body">
            <form className="row g-2 align-items-end" onSubmit={onAccrue}>
              <div className="col-md-4">
                <label className="form-label small">Manual accrue (delivered CN)</label>
                <input className="form-control form-control-sm" value={accrueCn} onChange={(e) => setAccrueCn(e.target.value.toUpperCase())} placeholder="CN number" />
              </div>
              <div className="col-md-2"><button className="btn btn-outline-primary btn-sm" type="submit">Accrue</button></div>
            </form>
          </div></div>

          <div className="table-responsive">
            <table className="table table-sm table-striped table-bordered">
              <thead className="table-dark">
                <tr><th>CN</th><th>Partner</th><th>Line</th><th>Qty</th><th>Amount</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={7} className="text-center text-muted py-3">No commission lines</td></tr> : rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.cnNo}</td>
                    <td>{r.partnerCode}</td>
                    <td>{r.lineDesc}</td>
                    <td>{r.qty}</td>
                    <td>{money(r.amount)}</td>
                    <td>{r.status}</td>
                    <td>{r.status === 'PROCESSING' && <button type="button" className="btn btn-sm btn-outline-success" onClick={() => onVerify(r.id)}>Verify</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'wallets' && (
        <div className="table-responsive">
          <table className="table table-sm table-striped table-bordered">
            <thead className="table-dark"><tr><th>Partner</th><th>Type</th><th>Available</th><th>Pending</th></tr></thead>
            <tbody>
              {walletRows.length === 0 ? <tr><td colSpan={4} className="text-center text-muted py-3">No wallets yet</td></tr> : walletRows.map((w) => (
                <tr key={w.partnerCode}>
                  <td>{w.partnerCode}</td>
                  <td>{w.partnerType}</td>
                  <td>{money(w.balance)}</td>
                  <td>{money(w.pendingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'withdrawals' && (
        <>
          <div className="card mb-3"><div className="card-body">
            <form className="row g-2 align-items-end" onSubmit={onWithdraw}>
              <div className="col-md-3">
                <label className="form-label small">Partner code</label>
                <input className="form-control form-control-sm" required value={withdrawForm.partnerCode} onChange={(e) => setWithdrawForm({ ...withdrawForm, partnerCode: e.target.value.toUpperCase() })} />
              </div>
              <div className="col-md-2">
                <label className="form-label small">Amount</label>
                <input type="number" step="0.01" className="form-control form-control-sm" required value={withdrawForm.amount} onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Note</label>
                <input className="form-control form-control-sm" value={withdrawForm.note} onChange={(e) => setWithdrawForm({ ...withdrawForm, note: e.target.value })} />
              </div>
              <div className="col-md-2"><button className="btn btn-primary btn-sm" type="submit">Request</button></div>
            </form>
          </div></div>

          <div className="table-responsive">
            <table className="table table-sm table-striped table-bordered">
              <thead className="table-dark"><tr><th>Request</th><th>Partner</th><th>Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {wdRows.length === 0 ? <tr><td colSpan={5} className="text-center text-muted py-3">No withdrawals</td></tr> : wdRows.map((w) => (
                  <tr key={w.id}>
                    <td>{w.requestNo}</td>
                    <td>{w.partnerCode}</td>
                    <td>{money(w.amount)}</td>
                    <td>{w.status}</td>
                    <td className="text-nowrap">
                      {w.status === 'REQUESTED' && <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => onAdvance(w.id, 'approve')}>Approve</button>}
                      {w.status === 'APPROVED' && <button type="button" className="btn btn-sm btn-outline-warning me-1" onClick={() => onAdvance(w.id, 'paid')}>Paid</button>}
                      {w.status === 'PAID' && <button type="button" className="btn btn-sm btn-outline-success me-1" onClick={() => onAdvance(w.id, 'cleared')}>Cleared</button>}
                      {['REQUESTED', 'APPROVED'].includes(w.status) && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onAdvance(w.id, 'reject')}>Reject</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
