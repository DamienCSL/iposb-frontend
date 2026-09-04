import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiError, getCnLookups, getCodRecord, getConsignment, quoteConsignment, saveConsignment } from '../api/client'
import { Alert, money } from '../ui/bits'

export default function ConsignmentEntryPage() {
  const [params] = useSearchParams()
  const preset = (params.get('cn') || '').toUpperCase()
  const [lookups, setLookups] = useState({ locations: [], zones: [], dropPoints: [], serviceTypes: [], transportModes: [] })
  const [inquiry, setInquiry] = useState({ cn_no: preset, rc: 'N' })
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [quote, setQuote] = useState(null)
  const [codInfo, setCodInfo] = useState(null)
  const [savedFreight, setSavedFreight] = useState(null)
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
      transport_mode: existing?.transport_mode || 'road',
      linehaul_mode: existing?.linehaul_mode || '',
      vessel_name: existing?.vessel_name || '',
      voyage_ref: existing?.voyage_ref || '',
      sailing_date: (existing?.sailing_date || '').slice(0, 10) || '',
      port_origin: existing?.port_origin || '',
      port_destination: existing?.port_destination || '',
    })
    setSavedFreight(
      existing
        ? {
            total: existing.tot_cn_amt,
            tax: existing.cn_tax_amt,
            invFlag: existing.cn_inv_flg,
            invNo: existing.inv_no,
          }
        : null,
    )
    setCodInfo(null)
    if (existing?.ppd_cct === 'COD') {
      getCodRecord(cnNo)
        .then((r) => setCodInfo(r.cod || r))
        .catch(() => setCodInfo(null))
    }
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
  const transportModes = lookups.transportModes?.length
    ? lookups.transportModes
    : [
        { code: 'road', label: 'Road / Land' },
        { code: 'sea', label: 'Sea / Ferry' },
        { code: 'air', label: 'Air' },
        { code: 'multi', label: 'Multimodal (combined)' },
      ]
  const showSeaFields = form?.transport_mode === 'sea' || (form?.transport_mode === 'multi' && form?.linehaul_mode === 'sea')

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
                  <label className="form-label">Transport Mode</label>
                  <select
                    className="form-select"
                    value={form.transport_mode || 'road'}
                    onChange={(e) => {
                      const mode = e.target.value
                      setForm((f) => ({
                        ...f,
                        transport_mode: mode,
                        linehaul_mode: mode === 'multi' ? (f.linehaul_mode || 'sea') : '',
                        ...(mode !== 'sea' && !(mode === 'multi' && (f.linehaul_mode || 'sea') === 'sea')
                          ? { vessel_name: '', voyage_ref: '', sailing_date: '', port_origin: '', port_destination: '' }
                          : {}),
                      }))
                    }}
                  >
                    {transportModes.map((m) => (
                      <option key={m.code} value={m.code}>{m.label || m.cd_desc || m.code}</option>
                    ))}
                  </select>
                </div>
                {form.transport_mode === 'multi' && (
                  <div className="col-md-3">
                    <label className="form-label">Linehaul (trunk) Mode</label>
                    <select className="form-select" value={form.linehaul_mode || 'sea'} onChange={(e) => set('linehaul_mode', e.target.value)}>
                      <option value="road">Road / Land</option>
                      <option value="sea">Sea / Ferry</option>
                      <option value="air">Air</option>
                    </select>
                  </div>
                )}
                {showSeaFields && (
                  <>
                    <div className="col-md-3">
                      <label className="form-label">Vessel Name</label>
                      <input className="form-control" value={form.vessel_name || ''} onChange={(e) => set('vessel_name', e.target.value)} placeholder="e.g. MV Sabah Link" />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Voyage / Sailing Ref</label>
                      <input className="form-control" value={form.voyage_ref || ''} onChange={(e) => set('voyage_ref', e.target.value)} placeholder="e.g. SL-240901" />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Sailing Date</label>
                      <input type="date" className="form-control" value={form.sailing_date || ''} onChange={(e) => set('sailing_date', e.target.value)} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Port Origin</label>
                      <input className="form-control" value={form.port_origin || ''} onChange={(e) => set('port_origin', e.target.value)} placeholder="e.g. KK Port" />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Port Destination</label>
                      <input className="form-control" value={form.port_destination || ''} onChange={(e) => set('port_destination', e.target.value)} placeholder="e.g. Labuan" />
                    </div>
                  </>
                )}
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
                  <select
                    className="form-select"
                    value={form.pay_mode || 'PPD'}
                    onChange={(e) => {
                      const mode = e.target.value
                      setForm((f) => ({
                        ...f,
                        pay_mode: mode,
                        cash_amt: mode === 'COD' ? f.cash_amt : '',
                      }))
                      if (mode !== 'COD') setCodInfo(null)
                    }}
                  >
                    <option value="PPD">Prepaid / Account</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                  </select>
                </div>
                {form.pay_mode === 'COD' && (
                  <div className="col-md-3">
                    <label className="form-label">Collect from consignee (RM)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.cash_amt}
                      onChange={(e) => set('cash_amt', e.target.value)}
                      placeholder={quote?.total != null ? String(quote.total) : 'Defaults to freight total'}
                    />
                    <div className="form-text">Cash the courier must collect at POD. Leave blank to use freight quote.</div>
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
          {savedFreight?.total != null && Number(savedFreight.total) > 0 ? (
            <div className="card mb-3 border-secondary">
              <div className="card-header"><strong>Saved freight on CN</strong></div>
              <div className="card-body py-2 small">
                <div className="row g-2">
                  <div className="col-md-3">Total: <strong>{money(savedFreight.total)}</strong></div>
                  <div className="col-md-3">Tax: {money(savedFreight.tax || 0)}</div>
                  <div className="col-md-3">Invoice flag: {savedFreight.invFlag || 'V'}</div>
                  <div className="col-md-3">Invoice #: {savedFreight.invNo || '—'}</div>
                </div>
              </div>
            </div>
          ) : null}
          {form.pay_mode === 'COD' && codInfo ? (
            <div className="card mb-3 border-warning">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>COD collection</strong>
                <span className={`badge ${codInfo.status === 'PENDING' ? 'text-bg-warning' : codInfo.status === 'SETTLED' ? 'text-bg-success' : 'text-bg-primary'}`}>
                  {codInfo.status || 'PENDING'}
                </span>
              </div>
              <div className="card-body py-2 small">
                Expected {money(codInfo.expectedAmt)} · Collected {codInfo.collectedAmt > 0 ? money(codInfo.collectedAmt) : '—'}
                {' · '}
                <Link to={`/billing/cod?cn=${encodeURIComponent(form.cn_no)}`}>Open COD outstanding</Link>
              </div>
            </div>
          ) : null}
          {quote ? (
            <div className="card mb-3 border-success">
              <div className="card-header bg-success-subtle"><strong>Live freight quote</strong> <span className="text-muted small">({quote.rateLabel || quote.source})</span></div>
              <div className="card-body py-2">
                <div className="row g-2 small">
                  {(quote.charges || []).map((c) => (
                    <div className="col-md-4" key={c.chargeCode}>{c.chargeDesc}: {money(c.amount)}</div>
                  ))}
                  <div className="col-md-4"><strong>Subtotal:</strong> {money(quote.subtotal)}</div>
                  <div className="col-md-4"><strong>SST ({quote.taxRate}%):</strong> {quote.taxRate > 0 ? money(quote.taxAmount) : '—'}</div>
                  <div className="col-md-4"><strong>Total:</strong> {money(quote.total)}</div>
                  {form.pay_mode === 'COD' ? (
                    <div className="col-12 text-muted">
                      COD collect amount: {money(form.cash_amt || quote.total)} (courier collects at delivery)
                    </div>
                  ) : null}
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
