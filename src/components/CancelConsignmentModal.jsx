import { useEffect, useState } from 'react'
import { apiError, cancelConsignment, previewCancellation } from '../api/client'
import { money } from '../ui/bits'

export default function CancelConsignmentModal({ cn, onClose, onDone }) {
  const [preview, setPreview] = useState(null)
  const [reason, setReason] = useState('')
  const [refundToWallet, setRefundToWallet] = useState(true)
  const [confirmNotAddressChange, setConfirmNotAddressChange] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    previewCancellation(cn)
      .then((data) => {
        if (!cancelled) {
          setPreview(data)
          setRefundToWallet(true)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(apiError(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cn])

  async function onSubmit(e) {
    e.preventDefault()
    if (!confirmNotAddressChange) {
      setError('Please confirm this is not an address-change request.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const result = await cancelConsignment(cn, {
        reason: reason.trim(),
        refundToWallet,
        confirmNotAddressChange: true,
      })
      onDone(result)
      onClose()
    } catch (err) {
      setError(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const blocked = preview && !preview.canCancel

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,.35)' }}>
      <div className="modal-dialog modal-lg">
        <form className="modal-content" onSubmit={onSubmit}>
          <div className="modal-header">
            <h5 className="modal-title">Cancel consignment {cn}</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={submitting} />
          </div>
          <div className="modal-body">
            {loading ? <p className="text-muted mb-0">Loading cancellation preview…</p> : null}
            {error ? <div className="alert alert-danger">{error}</div> : null}

            {preview ? (
              <>
                {blocked ? (
                  <div className="alert alert-danger mb-0">
                    {preview.blockReason || 'This consignment cannot be cancelled.'}
                  </div>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Parcel stage</div>
                          <div className="fw-semibold">{preview.tierLabel}</div>
                          <div className="small text-muted">Track status: {preview.status || '—'}</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Order total</div>
                          <div className="fw-semibold">{money(preview.freightAmt)}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Processing fee</div>
                          <div className="fw-semibold text-danger">
                            {preview.feeAmt > 0 ? `${money(preview.feeAmt)} (${preview.feePct}%)` : 'None (0%)'}
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Wallet refund</div>
                          <div className="fw-semibold text-success">{money(preview.refundAmt)}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Processing</div>
                          <div className="fw-semibold">Immediate (no approval)</div>
                        </div>
                      </div>
                    </div>

                    {preview.policy?.selfCollectHint ? (
                      <div className="alert alert-info py-2 small">{preview.policy.selfCollectHint}</div>
                    ) : null}

                    <div className="alert alert-warning py-2 small mb-3">
                      {preview.policy?.addressChangeHint ||
                        'To change the delivery address, create a new order/CN — do not use cancellation.'}
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Reason</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Optional — recorded in audit log"
                      />
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="refund-wallet"
                        checked={refundToWallet}
                        onChange={(e) => setRefundToWallet(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="refund-wallet">
                        Refund {money(preview.refundAmt)} to customer wallet after processing fee
                      </label>
                    </div>

                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="not-address-change"
                        checked={confirmNotAddressChange}
                        onChange={(e) => setConfirmNotAddressChange(e.target.checked)}
                        required
                      />
                      <label className="form-check-label" htmlFor="not-address-change">
                        I confirm this is a cancellation request, not an address change
                      </label>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={submitting}>
              Close
            </button>
            {!blocked && preview ? (
              <button type="submit" className="btn btn-danger" disabled={submitting || loading}>
                Cancel consignment
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
