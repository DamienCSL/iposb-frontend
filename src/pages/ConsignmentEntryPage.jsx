import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiError, getCnLookups, getCodRecord, getConsignment, quoteConsignment, saveConsignment, saveMaster, searchCustomers, generateSystemCode } from '../api/client'
import SearchableSelect from '../components/SearchableSelect'
import { Alert, money, SystemCodeField } from '../ui/bits'

function zoneCode(z) {
  return z?.delivery_point_code || z?.zone_code || ''
}

function zoneName(z) {
  return z?.delivery_point_name || z?.zone_name || zoneCode(z)
}

function zoneHub(z) {
  return z?.hub_code || z?.branch_code || ''
}

function ChoiceGroup({ value, options, onChange }) {
  return (
    <div className="cn-choice-group" role="group">
      {options.map((opt) => {
        const active = value === opt.code
        return (
          <button
            key={opt.code}
            type="button"
            className={`cn-choice ${active ? 'active' : ''}`}
            onClick={() => onChange(opt.code)}
            aria-pressed={active}
          >
            <span className="cn-choice-label">{opt.label}</span>
            {opt.hint ? <span className="cn-choice-hint">{opt.hint}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

function Section({ title, step, children, hint }) {
  return (
    <div className="card cn-section mb-3">
      <div className="card-header bg-white d-flex align-items-baseline gap-2">
        {step != null ? <span className="cn-step">{step}</span> : null}
        <div>
          <strong>{title}</strong>
          {hint ? <div className="text-muted small">{hint}</div> : null}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

function CustomerPicker({ value, onSelect, onError }) {
  const [q, setQ] = useState(value || '')
  const [hits, setHits] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    cust_ac_no: '',
    cust_name: '',
    cust_tel: '',
    cust_email: '',
    cust_addr1: '',
  })
  const timer = useRef(null)
  const boxRef = useRef(null)

  useEffect(() => {
    setQ(value || '')
  }, [value])

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function search(term) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const t = String(term || '').trim()
      if (t.length < 1) {
        setHits([])
        return
      }
      setBusy(true)
      try {
        const r = await searchCustomers(t)
        setHits(r.customers || [])
        setOpen(true)
      } catch (err) {
        if (onError) onError(apiError(err))
        setHits([])
      } finally {
        setBusy(false)
      }
    }, 250)
  }

  async function createCustomer(e) {
    e.preventDefault()
    setCreating(true)
    try {
      let ac = String(draft.cust_ac_no || '').trim().toUpperCase()
      if (!ac) {
        const gen = await generateSystemCode({ kind: 'cust_ac_no', resource: 'customers' })
        ac = gen.code
      }
      await saveMaster('customers', { ...draft, cust_ac_no: ac, cust_status: 'A' })
      onSelect({
        cust_ac_no: ac,
        cust_name: draft.cust_name,
        cust_tel: draft.cust_tel,
      })
      setQ(ac)
      setShowNew(false)
      setDraft({ cust_ac_no: '', cust_name: '', cust_tel: '', cust_email: '', cust_addr1: '' })
      setOpen(false)
    } catch (err) {
      if (onError) onError(apiError(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={boxRef} className="cn-customer-picker">
      <div className="input-group">
        <input
          className="form-control"
          required
          value={q}
          placeholder="Search name, phone, or account…"
          onChange={(e) => {
            const v = e.target.value
            setQ(v)
            onSelect({ cust_ac_no: v.toUpperCase() })
            search(v)
          }}
          onFocus={() => {
            if (hits.length) setOpen(true)
            if (q) search(q)
          }}
        />
        <button type="button" className="btn btn-outline-secondary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Cancel' : 'New'}
        </button>
      </div>
      {busy ? <div className="form-text">Searching…</div> : null}
      {open && hits.length > 0 ? (
        <div className="cn-customer-menu list-group shadow-sm">
          {hits.map((c) => (
            <button
              key={c.cust_ac_no}
              type="button"
              className="list-group-item list-group-item-action py-2"
              onClick={() => {
                onSelect(c)
                setQ(c.cust_ac_no)
                setOpen(false)
              }}
            >
              <strong>{c.cust_ac_no}</strong> — {c.cust_name}
              {c.cust_tel ? <span className="text-muted"> · {c.cust_tel}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {showNew ? (
        <form className="border rounded p-3 mt-2 bg-light" onSubmit={createCustomer}>
          <div className="fw-semibold mb-2">Register customer</div>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label small mb-0">Account (optional)</label>
              <SystemCodeField
                size="sm"
                value={draft.cust_ac_no}
                kind="cust_ac_no"
                resource="customers"
                placeholder="Generate or leave blank"
                onChange={(v) => setDraft((d) => ({ ...d, cust_ac_no: String(v || '').toUpperCase() }))}
                onError={onError}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-0">Name</label>
              <input
                className="form-control form-control-sm"
                required
                value={draft.cust_name}
                onChange={(e) => setDraft((d) => ({ ...d, cust_name: e.target.value }))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-0">Phone</label>
              <input
                className="form-control form-control-sm"
                value={draft.cust_tel}
                onChange={(e) => setDraft((d) => ({ ...d, cust_tel: e.target.value }))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-0">Email</label>
              <input
                className="form-control form-control-sm"
                type="email"
                value={draft.cust_email}
                onChange={(e) => setDraft((d) => ({ ...d, cust_email: e.target.value }))}
              />
            </div>
            <div className="col-md-8">
              <label className="form-label small mb-0">Address</label>
              <input
                className="form-control form-control-sm"
                value={draft.cust_addr1}
                onChange={(e) => setDraft((d) => ({ ...d, cust_addr1: e.target.value }))}
              />
            </div>
            <div className="col-12">
              <button className="btn btn-sm btn-primary" type="submit" disabled={creating}>
                {creating ? 'Saving…' : 'Save customer & use'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="form-text">
          Search an existing account, or click <strong>New</strong> to register for loyalty / billing.
        </div>
      )}
    </div>
  )
}

function emptyForm() {
  return {
    cn_no: '',
    cust_ac_no: '',
    srv_typ: 'STD',
    pkg_typ: 'P',
    cn_origin: '',
    cn_dstn: '',
    origin_zone: '',
    destination_zone: '',
    destination_area_code: '',
    origin_drop_point_id: '',
    destination_drop_point_id: '',
    origin_service: 'DROP_COUNTER',
    destination_service: 'DOORSTEP',
    sender_address: '',
    remarks: '',
    pu_dt: new Date().toISOString().slice(0, 10),
    cn_wt: '',
    cn_pcs: '1',
    spec_handle: 'N',
    spec_cd: '',
    spec_amt: '',
    consignee: '',
    consigner: '',
    recp_name: '',
    pay_mode: 'PPD',
    cash_amt: '',
    transport_mode: 'road',
    linehaul_mode: '',
    vessel_name: '',
    voyage_ref: '',
    sailing_date: '',
    port_origin: '',
    port_destination: '',
  }
}

export default function ConsignmentEntryPage() {
  const [params, setParams] = useSearchParams()
  const preset = (params.get('cn') || '').toUpperCase()
  const [lookups, setLookups] = useState({
    locations: [],
    zones: [],
    areas: [],
    dropPoints: [],
    serviceTypes: [],
    transportModes: [],
  })
  const [form, setForm] = useState(() => emptyForm())
  const [isExisting, setIsExisting] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [quote, setQuote] = useState(null)
  const [codInfo, setCodInfo] = useState(null)
  const [savedFreight, setSavedFreight] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const quoteTimer = useRef(null)
  const bootstrapped = useRef(false)

  useEffect(() => {
    getCnLookups()
      .then(setLookups)
      .catch((err) => setError(apiError(err) || 'Could not load dropdown options.'))
  }, [])

  // Overnight (OND) is operational, not bookable at entry — coerce away if present.
  useEffect(() => {
    const code = String(form.srv_typ || '').toUpperCase()
    if (['OND', 'OVN', 'OVERNIGHT'].includes(code)) {
      setForm((f) => ({ ...f, srv_typ: 'STD' }))
    }
  }, [form.srv_typ])

  useEffect(() => {
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
        transport_mode: form.transport_mode || 'road',
        linehaul_mode: form.linehaul_mode || '',
        spec_handle: form.spec_handle,
        spec_amt: form.spec_amt,
        pu_dt: form.pu_dt,
      })
        .then(setQuote)
        .catch(() => setQuote(null))
    }, 400)
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current)
    }
  }, [form])

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    if (preset) {
      loadCn(preset)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  function applyCnRow(cnNo, existing) {
    setForm({
      cn_no: cnNo,
      cust_ac_no: existing?.cust_ac_no || '',
      srv_typ: existing?.srv_typ || 'STD',
      pkg_typ: existing?.pkg_typ || 'P',
      cn_origin: existing?.cn_origin || '',
      cn_dstn: existing?.cn_dstn || '',
      origin_zone: existing?.origin_zone || '',
      destination_zone: existing?.destination_zone || '',
      destination_area_code: existing?.destination_area_code || '',
      origin_drop_point_id: existing?.origin_drop_point_id || '',
      destination_drop_point_id: existing?.destination_drop_point_id || '',
      origin_service: existing?.origin_service || 'DROP_COUNTER',
      destination_service: existing?.destination_service || 'DOORSTEP',
      sender_address: existing?.sender_address || '',
      remarks: existing?.remarks || '',
      pu_dt: (existing?.pu_dt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      cn_wt: existing?.cn_wt || '',
      cn_pcs: existing?.cn_pcs || '1',
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
    setIsExisting(Boolean(existing))
    setShowAdvanced(Boolean(existing?.transport_mode && existing.transport_mode !== 'road'))
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

  async function loadCn(cn) {
    setError('')
    setOk('')
    const cnNo = String(cn || form.cn_no || '').trim().toUpperCase()
    if (!cnNo) {
      setError('Enter a consignment number to load.')
      return
    }
    setLoading(true)
    try {
      const existing = (await getConsignment(cnNo)).cn
      applyCnRow(cnNo, existing)
      setParams({ cn: cnNo })
      setOk(`Loaded existing consignment ${cnNo}.`)
    } catch {
      setError(`No consignment found for ${cnNo}. Keep typing to create a new one, or Generate a number.`)
      applyCnRow(cnNo, null)
      setParams({ cn: cnNo })
    } finally {
      setLoading(false)
    }
  }

  function startNew() {
    setError('')
    setOk('')
    setQuote(null)
    setCodInfo(null)
    setSavedFreight(null)
    setShowAdvanced(false)
    setIsExisting(false)
    setForm(emptyForm())
    setParams({})
  }

  async function onSave(e) {
    e.preventDefault()
    setError('')
    setOk('')
    if (!String(form.cn_no || '').trim()) {
      setError('Generate or enter a consignment number first.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        cn_no: String(form.cn_no).trim().toUpperCase(),
        recp_name: form.recp_name || form.consignee,
      }
      const r = await saveConsignment(payload)
      setOk(r.message)
      if (r.quote) setQuote(r.quote)
      setIsExisting(true)
      setParams({ cn: payload.cn_no })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(apiError(err))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function pickOriginDp(code) {
    const z = zoneOptions.find((x) => zoneCode(x) === code)
    setForm((f) => ({
      ...f,
      origin_zone: code,
      cn_origin: zoneHub(z) || f.cn_origin,
      origin_drop_point_id: '',
    }))
  }

  function pickDestDp(code) {
    const z = zoneOptions.find((x) => zoneCode(x) === code)
    setForm((f) => ({
      ...f,
      destination_zone: code,
      cn_dstn: zoneHub(z) || f.cn_dstn,
      destination_drop_point_id: '',
      destination_area_code: '',
    }))
  }

  function pickOriginDrop(dropId) {
    const d = (lookups.dropPoints || []).find((x) => String(x.id) === String(dropId))
    const dpCode = d?.delivery_point_code || ''
    const z = dpCode ? zoneOptions.find((x) => zoneCode(x) === dpCode) : null
    setForm((f) => ({
      ...f,
      origin_drop_point_id: dropId,
      origin_zone: dpCode || f.origin_zone,
      cn_origin: zoneHub(z) || d?.hub_code || d?.branch_code || f.cn_origin,
    }))
  }

  const pickupDrops = useMemo(() => {
    const all = (lookups.dropPoints || []).filter((d) => {
      const typ = String(d.drop_type || 'both').toLowerCase()
      return ['pickup', 'both', ''].includes(typ)
    })
    if (!form?.origin_zone) return all
    const matched = all.filter((d) => !d.delivery_point_code || d.delivery_point_code === form.origin_zone)
    // If nothing under this DP yet, still show all pickup drops so staff can book
    return matched.length > 0 ? matched : all
  }, [lookups.dropPoints, form?.origin_zone])

  const deliveryDrops = useMemo(() => {
    const all = (lookups.dropPoints || []).filter((d) => {
      const typ = String(d.drop_type || 'both').toLowerCase()
      return ['delivery', 'both', ''].includes(typ)
    })
    if (!form?.destination_zone) return all
    const matched = all.filter((d) => !d.delivery_point_code || d.delivery_point_code === form.destination_zone)
    return matched.length > 0 ? matched : all
  }, [lookups.dropPoints, form?.destination_zone])

  const destAreas = useMemo(() => {
    const all = lookups.areas || []
    if (!form?.destination_zone) return all
    const matched = all.filter((a) => String(a.delivery_point_code || '') === String(form.destination_zone))
    return matched.length > 0 ? matched : all
  }, [lookups.areas, form?.destination_zone])

  const zoneOptions = lookups.zones?.length ? lookups.zones : (lookups.deliveryPoints || [])
  const serviceTypeOptions = (lookups.serviceTypes?.length
    ? lookups.serviceTypes
    : [
        { code: 'STD', cd_desc: 'Standard' },
        { code: 'EXP', cd_desc: 'Express' },
      ]
  ).filter((s) => {
    const code = String(s.code || '').toUpperCase()
    const desc = String(s.cd_desc || s.label || '').toUpperCase()
    return !['OND', 'OVN', 'OVERNIGHT'].includes(code) && !desc.includes('OVERNIGHT')
  })

  const originServices = lookups.originServices?.length
    ? lookups.originServices
    : [
        { code: 'DROP_COUNTER', label: 'Drop at counter', hint: 'Customer leaves parcel at a drop point' },
        { code: 'ADDRESS_PICKUP', label: 'Address pickup', hint: 'Courier collects from sender address' },
      ]
  const destinationServices = lookups.destinationServices?.length
    ? lookups.destinationServices
    : [
        { code: 'DOORSTEP', label: 'Doorstep delivery', hint: 'Deliver to receiver address' },
        { code: 'SELF_COLLECT', label: 'Self-collect', hint: 'Receiver picks up at a drop point' },
      ]
  const transportModes = lookups.transportModes?.length
    ? lookups.transportModes
    : [
        { code: 'road', label: 'Road / Land' },
        { code: 'sea', label: 'Sea / Ferry' },
        { code: 'air', label: 'Air' },
        { code: 'multi', label: 'Multimodal' },
      ]
  const showSeaFields =
    form?.transport_mode === 'sea' || (form?.transport_mode === 'multi' && form?.linehaul_mode === 'sea')

  const originLabel = useMemo(() => {
    const z = zoneOptions.find((x) => zoneCode(x) === form?.origin_zone)
    return z ? `${zoneCode(z)} · ${zoneName(z)}` : form?.origin_zone || '—'
  }, [zoneOptions, form?.origin_zone])

  const destLabel = useMemo(() => {
    const z = zoneOptions.find((x) => zoneCode(x) === form?.destination_zone)
    return z ? `${zoneCode(z)} · ${zoneName(z)}` : form?.destination_zone || '—'
  }, [zoneOptions, form?.destination_zone])

  const canQuote = form && form.cust_ac_no && form.cn_origin && form.cn_dstn && parseFloat(form.cn_wt) > 0

  return (
    <div className="cn-entry">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="mb-1">
            {isExisting && form.cn_no ? `Edit ${form.cn_no}` : 'New consignment'}
          </h3>
          <p className="text-muted mb-0">
            Fill the steps below. Delivery points set hubs automatically.
          </p>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={startNew}>
          New CN
        </button>
      </div>

      <Alert error={error} ok={ok} />

      <form onSubmit={onSave} className="cn-entry-form pb-5">
          <Section step={1} title="Basics" hint="CN number, customer, service, and parcel size">
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label">Consignment number</label>
                <div className="d-flex gap-2 flex-wrap">
                  <div className="flex-grow-1" style={{ minWidth: '12rem' }}>
                    <SystemCodeField
                      required
                      maxLength={20}
                      value={form.cn_no}
                      kind="cn_no"
                      placeholder="Generate or type CN number"
                      onChange={(v) => {
                        setIsExisting(false)
                        set('cn_no', String(v || '').toUpperCase())
                      }}
                      onError={setError}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    disabled={loading || !String(form.cn_no || '').trim()}
                    onClick={() => loadCn(form.cn_no)}
                  >
                    {loading ? '…' : 'Load'}
                  </button>
                </div>
                <div className="form-text">Generate for a new CN, or type an existing number and Load to edit.</div>
              </div>
              <div className="col-md-5">
                <label className="form-label">Customer account</label>
                <CustomerPicker
                  value={form.cust_ac_no}
                  onError={setError}
                  onSelect={(c) => {
                    setForm((f) => ({
                      ...f,
                      cust_ac_no: String(c.cust_ac_no || '').toUpperCase(),
                      consigner: c.cust_name || f.consigner,
                    }))
                  }}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Service</label>
                <select className="form-select" value={form.srv_typ} onChange={(e) => set('srv_typ', e.target.value)}>
                  {serviceTypeOptions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.cd_desc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Package</label>
                <select className="form-select" value={form.pkg_typ} onChange={(e) => set('pkg_typ', e.target.value)}>
                  <option value="P">Parcel</option>
                  <option value="D">Document</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Pickup date</label>
                <input type="date" className="form-control" value={form.pu_dt} onChange={(e) => set('pu_dt', e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  className="form-control"
                  value={form.cn_wt}
                  onChange={(e) => set('cn_wt', e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Pieces</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-control"
                  value={form.cn_pcs}
                  onChange={(e) => set('cn_pcs', e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Payment</label>
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
                  <option value="COD">Cash on Delivery</option>
                </select>
              </div>
              {form.pay_mode === 'COD' ? (
                <div className="col-md-3">
                  <label className="form-label">COD collect (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={form.cash_amt}
                    onChange={(e) => set('cash_amt', e.target.value)}
                    placeholder={quote?.total != null ? String(quote.total) : 'Uses freight total if blank'}
                  />
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            step={2}
            title="Route"
            hint="Pick delivery points — hubs fill in automatically"
          >
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Origin delivery point</label>
                <SearchableSelect
                  required
                  value={form.origin_zone}
                  placeholder="Search origin delivery point…"
                  options={zoneOptions.map((z) => {
                    const code = zoneCode(z)
                    return {
                      value: code,
                      label: `${code} — ${zoneName(z)} (${zoneHub(z) || '—'})`,
                    }
                  })}
                  onChange={(code) => pickOriginDp(code)}
                />
                <div className="form-text">
                  Hub: <strong>{form.cn_origin || '—'}</strong>
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Destination delivery point</label>
                <SearchableSelect
                  required
                  value={form.destination_zone}
                  placeholder="Search destination delivery point…"
                  options={zoneOptions.map((z) => {
                    const code = zoneCode(z)
                    return {
                      value: code,
                      label: `${code} — ${zoneName(z)} (${zoneHub(z) || '—'})`,
                    }
                  })}
                  onChange={(code) => pickDestDp(code)}
                />
                <div className="form-text">
                  Hub: <strong>{form.cn_dstn || '—'}</strong>
                </div>
              </div>
              <div className="col-12">
                <div className="cn-route-summary">
                  <span>{originLabel}</span>
                  <span className="cn-route-arrow" aria-hidden>
                    →
                  </span>
                  <span>{destLabel}</span>
                </div>
              </div>
            </div>
          </Section>

          <Section step={3} title="First mile" hint="How the parcel enters the network">
            <ChoiceGroup
              value={form.origin_service || 'DROP_COUNTER'}
              options={originServices}
              onChange={(mode) =>
                setForm((f) => ({
                  ...f,
                  origin_service: mode,
                  origin_drop_point_id: mode === 'DROP_COUNTER' ? f.origin_drop_point_id : '',
                  sender_address: mode === 'ADDRESS_PICKUP' ? f.sender_address : '',
                }))
              }
            />
            <div className="row g-3 mt-1">
              {form.origin_service === 'DROP_COUNTER' ? (
                <div className="col-md-8">
                  <label className="form-label">Drop point</label>
                  <SearchableSelect
                    value={form.origin_drop_point_id}
                    placeholder="Search drop counter…"
                    options={pickupDrops.map((d) => ({
                      value: String(d.id),
                      label: `${d.drop_code} — ${d.drop_name}${d.delivery_point_code ? ` · ${d.delivery_point_code}` : ''}`,
                    }))}
                    onChange={(id) => pickOriginDrop(id)}
                  />
                  <div className="form-text">Choosing a drop point also sets the origin delivery point.</div>
                </div>
              ) : (
                <div className="col-12">
                  <label className="form-label">Pickup address</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    required
                    value={form.sender_address || ''}
                    onChange={(e) => set('sender_address', e.target.value)}
                    placeholder="Full sender address for collection"
                  />
                </div>
              )}
              <div className="col-md-6">
                <label className="form-label">Sender / consigner</label>
                <input
                  className="form-control"
                  value={form.consigner}
                  onChange={(e) => set('consigner', e.target.value)}
                  placeholder="Sender name"
                />
              </div>
            </div>
          </Section>

          <Section step={4} title="Last mile" hint="How the receiver gets the parcel">
            <ChoiceGroup
              value={form.destination_service || 'DOORSTEP'}
              options={destinationServices}
              onChange={(mode) =>
                setForm((f) => ({
                  ...f,
                  destination_service: mode,
                  destination_drop_point_id: mode === 'SELF_COLLECT' ? f.destination_drop_point_id : '',
                  destination_area_code: mode === 'DOORSTEP' ? f.destination_area_code : '',
                  remarks: mode === 'DOORSTEP' ? f.remarks : '',
                }))
              }
            />
            <div className="row g-3 mt-1">
              <div className="col-md-6">
                <label className="form-label">Receiver / consignee</label>
                <input
                  className="form-control"
                  value={form.consignee}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((f) => ({ ...f, consignee: v, recp_name: v }))
                  }}
                  placeholder="Receiver name"
                />
              </div>
              {form.destination_service === 'SELF_COLLECT' ? (
                <div className="col-md-6">
                  <label className="form-label">Self-collect drop point</label>
                  <SearchableSelect
                    value={form.destination_drop_point_id}
                    placeholder="Search self-collect drop…"
                    options={deliveryDrops.map((d) => ({
                      value: String(d.id),
                      label: `${d.drop_code} — ${d.drop_name}`,
                    }))}
                    onChange={(id) => set('destination_drop_point_id', id)}
                  />
                </div>
              ) : (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Destination area</label>
                    <SearchableSelect
                      value={form.destination_area_code || ''}
                      placeholder="Search area (or leave blank to auto-match)…"
                      emptyLabel="Auto-match from address"
                      options={destAreas.map((a) => ({
                        value: a.area_code,
                        label: `${a.area_code} — ${a.area_name}`,
                      }))}
                      onChange={(code) => set('destination_area_code', code)}
                    />
                    <div className="form-text">Optional — assigns the area’s dispatcher for delivery.</div>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Delivery address</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      required
                      value={form.remarks || ''}
                      onChange={(e) => set('remarks', e.target.value)}
                      placeholder="Full receiver address (used to match area keywords if area is blank)"
                    />
                  </div>
                </>
              )}
            </div>
          </Section>

          <div className="card cn-section mb-3">
            <button
              type="button"
              className="card-header bg-white border-0 w-100 text-start d-flex justify-content-between align-items-center"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              <strong>Advanced (optional)</strong>
              <span className="text-muted small">{showAdvanced ? 'Hide' : 'Transport · special handling'}</span>
            </button>
            {showAdvanced ? (
              <div className="card-body border-top">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Transport mode</label>
                    <select
                      className="form-select"
                      value={form.transport_mode || 'road'}
                      onChange={(e) => {
                        const mode = e.target.value
                        setForm((f) => ({
                          ...f,
                          transport_mode: mode,
                          linehaul_mode: mode === 'multi' ? f.linehaul_mode || 'sea' : '',
                          ...(mode !== 'sea' && !(mode === 'multi' && (f.linehaul_mode || 'sea') === 'sea')
                            ? {
                                vessel_name: '',
                                voyage_ref: '',
                                sailing_date: '',
                                port_origin: '',
                                port_destination: '',
                              }
                            : {}),
                        }))
                      }}
                    >
                      {transportModes.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.label || m.cd_desc || m.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.transport_mode === 'multi' ? (
                    <div className="col-md-3">
                      <label className="form-label">Linehaul mode</label>
                      <select
                        className="form-select"
                        value={form.linehaul_mode || 'sea'}
                        onChange={(e) => set('linehaul_mode', e.target.value)}
                      >
                        <option value="road">Road / Land</option>
                        <option value="sea">Sea / Ferry</option>
                        <option value="air">Air</option>
                      </select>
                    </div>
                  ) : null}
                  {showSeaFields ? (
                    <>
                      <div className="col-md-3">
                        <label className="form-label">Vessel</label>
                        <input
                          className="form-control"
                          value={form.vessel_name || ''}
                          onChange={(e) => set('vessel_name', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Voyage ref</label>
                        <input
                          className="form-control"
                          value={form.voyage_ref || ''}
                          onChange={(e) => set('voyage_ref', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Sailing date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={form.sailing_date || ''}
                          onChange={(e) => set('sailing_date', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Port origin</label>
                        <input
                          className="form-control"
                          value={form.port_origin || ''}
                          onChange={(e) => set('port_origin', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Port destination</label>
                        <input
                          className="form-control"
                          value={form.port_destination || ''}
                          onChange={(e) => set('port_destination', e.target.value)}
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="col-md-3">
                    <label className="form-label">Special handling</label>
                    <select
                      className="form-select"
                      value={form.spec_handle}
                      onChange={(e) => set('spec_handle', e.target.value)}
                    >
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </select>
                  </div>
                  {form.spec_handle === 'Y' ? (
                    <>
                      <div className="col-md-3">
                        <label className="form-label">Handling code</label>
                        <input
                          className="form-control"
                          maxLength={10}
                          value={form.spec_cd}
                          onChange={(e) => set('spec_cd', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Handling amount (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          value={form.spec_amt}
                          onChange={(e) => set('spec_amt', e.target.value)}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {savedFreight?.total != null && Number(savedFreight.total) > 0 ? (
            <div className="card mb-3 border-secondary">
              <div className="card-body py-2 small">
                Saved freight: <strong>{money(savedFreight.total)}</strong>
                {savedFreight.invNo ? ` · Invoice ${savedFreight.invNo}` : ''}
              </div>
            </div>
          ) : null}

          {form.pay_mode === 'COD' && codInfo ? (
            <div className="card mb-3 border-warning">
              <div className="card-body py-2 small d-flex justify-content-between flex-wrap gap-2">
                <span>
                  COD {codInfo.status || 'PENDING'}: expected {money(codInfo.expectedAmt)}
                </span>
                <Link to={`/billing/cod?cn=${encodeURIComponent(form.cn_no)}`}>Open COD</Link>
              </div>
            </div>
          ) : null}

          <div className="cn-sticky-bar">
            <div className="cn-sticky-inner">
              <div className="cn-sticky-quote">
                {quote ? (
                  <>
                    <span className="text-muted small">
                      {quote.source === 'delivery_fee' ? 'Delivery fee' : 'Freight'}
                    </span>
                    <strong className="fs-5">{money(quote.total)}</strong>
                    {quote.rateLabel ? (
                      <span className="small text-muted">{quote.rateLabel}</span>
                    ) : null}
                    {form.pay_mode === 'COD' ? (
                      <span className="small text-muted">
                        COD {money(form.cash_amt || quote.total)}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted small">
                    {canQuote ? 'Calculating quote…' : 'Enter customer, hubs/DPs, and weight for a quote'}
                  </span>
                )}
              </div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={startNew}>
                  Clear
                </button>
                <button className="btn btn-primary px-4" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save consignment'}
                </button>
              </div>
            </div>
          </div>
        </form>
    </div>
  )
}
