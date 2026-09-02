import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiError, getCnLookups, getConsignment, quoteConsignment, saveConsignment } from '../api/client'
import { Alert, money } from '../ui/bits'

export default function ConsignmentEntryPage() {
  const [params] = useSearchParams()
  const preset = (params.get('cn') || '').toUpperCase()
  const [lookups, setLookups] = useState({ locations: [], zones: [], dropPoints: [], serviceTypes: [] })
  const [inquiry, setInquiry] = useState({ cn_no: preset, rc: 'N' })
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [quote, setQuote] = useState(null)
  const quoteTimer = useRef(null)

  useEffect(() => {
    getCnLookups().then(setLookups).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form) {
      setQuote(null)
      return
    }
    const wt = parseFloat(form.cn_wt)
    if (!form.cust_ac_no || !form.cn_origin || !form.cn_dstn || !wt || wt <= 0) {
      setQuote(null)
      return
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(() => {
      quoteConsignment({
        cust_ac_no: form.cust_ac_no,
        srv_typ: form.srv_typ,
        pkg_typ: form.pkg_typ,
        cn_origin: form.cn_origin,
        cn_dstn: form.cn_dstn,
        cn_wt: wt,
        cn_pcs: form.cn_pcs,
        spec_handle: form.spec_handle,
        spec_amt: form.spec_amt,
        pu_dt: form.pu_dt,
      })
        .then(setQuote)
        .catch(() => setQuote(null))
    }, 400)
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }
  }, [form])

  useEffect(() => {
    if (preset) lookup(preset, 'N')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  async function lookup(cn, rc) {
    setError('')
    setOk('')
    const cnNo = (cn || inquiry.cn_no).trim().toUpperCase()
    if (!cnNo) {
      setError('Please enter a Consignment Number.')
      return
    }
    let existing = null
    try {
      existing = (await getConsignment(cnNo)).cn
    } catch {
      existing = null
    }
    const origin = existing?.cn_origin || (rc === 'N' ? 'BKI' : '')
    const dstn = existing?.cn_dstn || (rc === 'Y' ? 'BKI' : '')
    setForm({
      cn_no: cnNo,
      cust_ac_no: existing?.cust_ac_no || '',
      srv_typ: existing?.srv_typ || 'STD',
      pkg_typ: existing?.pkg_typ || 'P',
      cn_origin: origin,
      cn_dstn: dstn,
      origin_zone: existing?.origin_zone || '',
      destination_zone: existing?.destination_zone || '',
      origin_drop_point_id: existing?.origin_drop_point_id || '',
      destination_drop_point_id: existing?.destination_drop_point_id || '',
      pu_dt: (existing?.pu_dt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      cn_wt: existing?.cn_wt || '',
      cn_pcs: existing?.cn_pcs || '',
      spec_handle: existing?.spec_handle || 'N',
      spec_cd: existing?.oda_cd || '',
      spec_amt: existing?.spec_amt || '',
      consignee: existing?.consignee || '',
      consigner: existing?.consigner || '',
      recp_name: existing?.recp_name || '',
      pay_mode: existing?.ppd_cct === 'COD' ? 'COD' : 'PPD',
      cash_amt: existing?.cash_amt || '',
    })
  }

  async function onSave(e) {
    e.preventDefault()
    setError('')
    try {
      const r = await saveConsignment(form)
      setOk(r.message)
      if (r.quote) setQuote(r.quote)
    } catch (err) {
      setError(apiError(err))
    }
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const pickupDrops = (lookups.dropPoints || []).filter((d) => ['pickup', 'both', ''].includes(String(d.drop_type || 'both').toLowerCase()))
  const deliveryDrops = (lookups.dropPoints || []).filter((d) => ['delivery', 'both', ''].includes(String(d.drop_type || 'both').toLowerCase()))

  return (
    <div>
      <h3 className="mb-3">{form ? 'Consignment Entry — Edit / Create' : 'Consignment Entry'}</h3>
      <p className="text-muted">
        {form
          ? 'Fill in the consignment details below, then save. Already-billed consignments cannot be changed.'
          : 'Look up an existing consignment number to edit it, or enter a new number to create one. Zones and drop points help routing / dispatch.'}
      </p>
      <Alert error={error} ok={ok} />

      {!form ? (
        <div className="card">
          <div className="card-body">
            <form className="row g-3 align-items-end" onSubmit={(e) => { e.preventDefault(); lookup(inquiry.cn_no, inquiry.rc) }}>
              <div className="col-md-4">
                <label className="form-label">Consignment Number</label>
                <input className="form-control" required maxLength={20} value={inquiry.cn_no} onChange={(e) => setInquiry({ ...inquiry, cn_no: e.target.value })} placeholder="e.g. BBB0810000001" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Return Consignment to Headquarters</label>
                <select className="form-select" value={inquiry.rc} onChange={(e) => setInquiry({ ...inquiry, rc: e.target.value })}>
                  <option value="N">No — outbound from headquarters</option>
                  <option value="Y">Yes — return / inbound to headquarters</option>
                </select>
              </div>
              <div className="col-md-4">
                <button className="btn btn-primary" type="submit">Look Up / Continue</button>{' '}
                <button className="btn btn-outline-secondary" type="button" onClick={() => setInquiry({ cn_no: '', rc: 'N' })}>Clear</button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <form onSubmit={onSave}>
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Consignment Number</label>
                  <input className="form-control" value={form.cn_no} readOnly />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Customer Account Number</label>
                  <input className="form-control" value={form.cust_ac_no} onChange={(e) => set('cust_ac_no', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Service Type</label>
                  <select className="form-select" value={form.srv_typ} onChange={(e) => set('srv_typ', e.target.value)}>
                    {(lookups.serviceTypes || []).map((s) => <option key={s.code} value={s.code}>{s.cd_desc}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Package Type</label>
                  <select className="form-select" value={form.pkg_typ} onChange={(e) => set('pkg_typ', e.target.value)}>
                    <option value="P">Parcel</option>
                    <option value="D">Document</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Origin Branch</label>
                  <select className="form-select" required value={form.cn_origin} onChange={(e) => set('cn_origin', e.target.value)}>
                    <option value="">— select —</option>
                    {(lookups.locations || []).map((l) => <option key={l.loc_id} value={l.loc_id}>{l.loc_id} — {l.loc_name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Destination Branch</label>
                  <select className="form-select" required value={form.cn_dstn} onChange={(e) => set('cn_dstn', e.target.value)}>
                    <option value="">— select —</option>
                    {(lookups.locations || []).map((l) => <option key={l.loc_id} value={l.loc_id}>{l.loc_id} — {l.loc_name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Origin Zone</label>
                  <select className="form-select" value={form.origin_zone} onChange={(e) => {
                    const z = lookups.zones.find((x) => x.zone_code === e.target.value)
                    setForm((f) => ({ ...f, origin_zone: e.target.value, cn_origin: z?.branch_code || f.cn_origin }))
                  }}>
                    <option value="">— none —</option>
                    {(lookups.zones || []).map((z) => <option key={z.zone_code} value={z.zone_code}>{z.zone_code} — {z.zone_name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Destination Zone</label>
                  <select className="form-select" value={form.destination_zone} onChange={(e) => {
                    const z = lookups.zones.find((x) => x.zone_code === e.target.value)
                    setForm((f) => ({ ...f, destination_zone: e.target.value, cn_dstn: z?.branch_code || f.cn_dstn }))
                  }}>
                    <option value="">— none —</option>
                    {(lookups.zones || []).map((z) => <option key={z.zone_code} value={z.zone_code}>{z.zone_code} — {z.zone_name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Origin Drop Point</label>
                  <select className="form-select" value={form.origin_drop_point_id} onChange={(e) => set('origin_drop_point_id', e.target.value)}>
                    <option value="">— none —</option>
                    {pickupDrops.filter((d) => !form.cn_origin || !d.branch_code || d.branch_code === form.cn_origin).map((d) => (
                      <option key={d.id} value={d.id}>{d.drop_code} — {d.drop_name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Destination Drop Point</label>
                  <select className="form-select" value={form.destination_drop_point_id} onChange={(e) => set('destination_drop_point_id', e.target.value)}>
                    <option value="">— none —</option>
                    {deliveryDrops.filter((d) => !form.cn_dstn || !d.branch_code || d.branch_code === form.cn_dstn).map((d) => (
                      <option key={d.id} value={d.id}>{d.drop_code} — {d.drop_name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Pickup Date</label>
                  <input type="date" className="form-control" value={form.pu_dt} onChange={(e) => set('pu_dt', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Weight (kilograms)</label>
                  <input type="number" step="0.1" className="form-control" value={form.cn_wt} onChange={(e) => set('cn_wt', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Number of Pieces</label>
                  <input type="number" className="form-control" value={form.cn_pcs} onChange={(e) => set('cn_pcs', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Special Handling Required</label>
                  <select className="form-select" value={form.spec_handle} onChange={(e) => set('spec_handle', e.target.value)}>
                    <option value="N">No</option>
                    <option value="Y">Yes</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Special Handling Code</label>
                  <input className="form-control" maxLength={10} value={form.spec_cd} onChange={(e) => set('spec_cd', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Special Handling Amount (RM)</label>
                  <input type="number" step="0.01" className="form-control" value={form.spec_amt} onChange={(e) => set('spec_amt', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={form.pay_mode || 'PPD'} onChange={(e) => set('pay_mode', e.target.value)}>
                    <option value="PPD">Prepaid / Account</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                  </select>
                </div>
                {form.pay_mode === 'COD' && (
                  <div className="col-md-3">
                    <label className="form-label">COD Amount (RM)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.cash_amt}
                      onChange={(e) => set('cash_amt', e.target.value)}
                      placeholder={quote?.total != null ? String(quote.total) : 'Uses freight quote if blank'}
                    />
                  </div>
                )}
                <div className="col-md-3">
                  <label className="form-label">Consignee Name</label>
                  <input className="form-control" value={form.consignee} onChange={(e) => set('consignee', e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Consigner Name</label>
                  <input className="form-control" value={form.consigner} onChange={(e) => set('consigner', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          {quote ? (
            <div className="card mb-3 border-success">
              <div className="card-header bg-success-subtle"><strong>Freight quote</strong> <span className="text-muted small">({quote.rateLabel || quote.source})</span></div>
              <div className="card-body py-2">
                <div className="row g-2 small">
                  {(quote.charges || []).map((c) => (
                    <div className="col-md-4" key={c.chargeCode}>{c.chargeDesc}: {money(c.amount)}</div>
                  ))}
                  <div className="col-md-4"><strong>Subtotal:</strong> {money(quote.subtotal)}</div>
                  <div className="col-md-4"><strong>SST ({quote.taxRate}%):</strong> {quote.taxRate > 0 ? money(quote.taxAmount) : '—'}</div>
                  <div className="col-md-4"><strong>Total:</strong> {money(quote.total)}</div>
                </div>
              </div>
            </div>
          ) : null}
          <div className="text-center">
            <button className="btn btn-primary" type="submit">Save Consignment</button>{' '}
            <button className="btn btn-secondary" type="button" onClick={() => setForm(null)}>Back to Inquiry</button>
          </div>
        </form>
      )}
    </div>
  )
}
