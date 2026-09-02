import { useEffect, useState } from 'react'
import { apiError, getCancellationConfig } from '../api/client'
import { Alert, money } from '../ui/bits'

export default function CancellationPolicyPage() {
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getCancellationConfig()
      .then(setConfig)
      .catch((e) => setError(apiError(e)))
  }, [])

  return (
    <div>
      <h3 className="mb-3">Cancellation &amp; processing fees</h3>
      <p className="text-muted">
        Fixed processing-fee tiers per client specification. Admin users cannot modify these percentages.
        Eligible requests are processed immediately — no manual approval workflow.
      </p>
      <Alert error={error} />

      {!config ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="table-responsive mb-4">
            <table className="table table-sm table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>Parcel stage</th>
                  <th style={{ width: '8rem' }}>Processing fee</th>
                </tr>
              </thead>
              <tbody>
                {(config.tiers || []).map((tier) => (
                  <tr key={tier.tier}>
                    <td>{tier.label}</td>
                    <td>{tier.feePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Policy</h5>
              <ul className="mb-0">
                <li>Customers may request cancellation after pickup or drop-off at a service point.</li>
                <li>
                  <strong>Blocked:</strong> once the parcel is in transit or handed to the courier for delivery.
                </li>
                <li>After deducting the processing fee, the remaining amount is refunded to the customer wallet.</li>
                <li>All cancellations are recorded in the audit log with fee, refund, and credit note references.</li>
                <li>
                  <strong>Not for address changes.</strong> To change the delivery address, create a new order/CN.
                </li>
                <li>
                  At the 0% tier, the parcel is still at the service point — the customer may self-collect instead of
                  cancelling.
                </li>
              </ul>
            </div>
          </div>

          <p className="text-muted small mt-3">
            Example: RM 100 order at 30% tier → processing fee {money(30)}, wallet refund {money(70)}.
          </p>
        </>
      )}
    </div>
  )
}
