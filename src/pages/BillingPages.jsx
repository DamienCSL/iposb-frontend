import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiError, generateInvoice, getBilling, listBilling, previewInvoice, saveBilling } from '../api/client'
import { Alert, Pager, SystemCodeField, money } from '../ui/bits'

const DROP_POINT_COLS = [
  ['bilyet_no', 'Bilyet No'],
  ['agent_cd', 'Drop Point'],
  ['bilyet_dt', 'Date'],
  ['amt', 'Amount', 'money'],
  ['bilyet_status', 'Status'],
]
const DROP_POINT_FILTERS = [
  { name: 'agent_cd', label: 'Drop Point' },
  { name: 'bilyet_no', label: 'Bilyet No' },
]

const CONFIG = {
  invoices: {
    title: 'Invoice List',
    filters: [
      { name: 'inv_no', label: 'Invoice No' },
      { name: 'cust_ac_no', label: 'Customer' },
      { name: 'inv_status', label: 'Status', type: 'select', options: [['', 'All'], ['UPD', 'Unpaid'], ['PAY', 'Paid']] },
    ],
    columns: [
      ['inv_no', 'Invoice Number'],
      ['cust_ac_no', 'Customer'],
      ['inv_dt', 'Date'],
      ['yr_month', 'Month'],
      ['tot_inv_amt', 'Total', 'money'],
      ['bal_inv_amt', 'Balance', 'money'],
      ['inv_status', 'Status'],
    ],
  },
  do: {
    title: 'Delivery Order List',
    filters: [{ name: 'dn_no', label: 'DN No' }, { name: 'cust_ac_no', label: 'Customer' }],
    columns: [['dn_no', 'DN Number'], ['cust_ac_no', 'Customer'], ['dn_dt', 'Date'], ['cn_origin', 'Origin'], ['cn_dstn', 'Dest'], ['cn_status', 'Status']],
  },
  receipts: {
    title: 'Receipt List',
    filters: [{ name: 'inv_no', label: 'Invoice No' }, { name: 'cust_ac_no', label: 'Customer' }],
    columns: [['inv_no', 'Invoice'], ['cust_ac_no', 'Customer'], ['pay_dt', 'Date'], ['pay_amt', 'Amount', 'money'], ['pay_typ', 'Type'], ['pay_status', 'Status']],
  },
  'credit-notes': {
    title: 'Credit Note List',
    filters: [{ name: 'credit_note_no', label: 'Note No' }, { name: 'cust_ac_no', label: 'Customer' }],
    columns: [['credit_note_no', 'Note No'], ['cust_ac_no', 'Customer'], ['credit_note_date', 'Date'], ['total_amount', 'Amount', 'money'], ['invoice_no', 'Invoice'], ['reason', 'Reason']],
  },
  'debit-notes': {
    title: 'Debit Note List',
    filters: [{ name: 'debit_note_no', label: 'Note No' }, { name: 'cust_ac_no', label: 'Customer' }],
    columns: [['debit_note_no', 'Note No'], ['cust_ac_no', 'Customer'], ['debit_note_date', 'Date'], ['total_amount', 'Amount', 'money'], ['invoice_no', 'Invoice'], ['reason', 'Reason']],
  },
  'agent-in': { title: 'Drop Point Money In List', filters: DROP_POINT_FILTERS, columns: DROP_POINT_COLS },
  'agent-out': { title: 'Drop Point Money Out List', filters: DROP_POINT_FILTERS, columns: DROP_POINT_COLS },
  'agent-credit': { title: 'Drop Point Credit Note List', filters: DROP_POINT_FILTERS, columns: DROP_POINT_COLS },
  'agent-debit': { title: 'Drop Point Debit Note List', filters: DROP_POINT_FILTERS, columns: DROP_POINT_COLS },
}

const today = () => new Date().toISOString().slice(0, 10)
const ym = () => new Date().toISOString().slice(0, 7).replace('-', '')

const ENTRIES = {
  invoices: {
    title: 'Invoice Entry',
    extra: 'Generate an invoice from unbilled consignments for a customer.',
    submit: 'Generate Invoice',
    defaults: () => ({ yr_month: ym() }),
    fields: [
      { name: 'cust_ac_no', label: 'Customer Account', required: true },
      { name: 'yr_month', label: 'Year Month (YYYYMM)', required: true },
    ],
  },
  do: {
    title: 'Delivery Order Entry',
    submit: 'Save',
    defaults: () => ({ dn_dt: today(), pkg_typ: 'P', cn_origin: 'BKI', spec_handle: 'N', cn_pcs: '1', cn_wt: '1' }),
    fields: [
      { name: 'dn_no', label: 'DN Number', required: true, generate: 'dn_no' },
      { name: 'cust_ac_no', label: 'Customer Account', required: true },
      { name: 'dn_dt', label: 'Date', type: 'date' },
      { name: 'batch_no', label: 'Batch No', generate: 'batch_no' },
      { name: 'pkg_typ', label: 'Package', type: 'select', options: [['P', 'Parcel'], ['D', 'Document']] },
      { name: 'cn_origin', label: 'Origin' },
      { name: 'cn_dstn', label: 'Destination' },
      { name: 'cn_pcs', label: 'Pieces', type: 'number' },
      { name: 'cn_wt', label: 'Weight (kg)', type: 'number' },
      { name: 'spec_handle', label: 'Special Handle', type: 'select', options: [['N', 'No'], ['Y', 'Yes']] },
      { name: 'spec_amt', label: 'Special Amount', type: 'number' },
    ],
  },
  receipts: {
    title: 'Receipt Entry',
    submit: 'Post Receipt',
    defaults: () => ({ pay_dt: today(), pay_typ: 'CASH', loc_id: 'BKI' }),
    fields: [
      { name: 'cust_ac_no', label: 'Customer Account', required: true },
      { name: 'inv_no', label: 'Invoice No', required: true },
      { name: 'pay_amt', label: 'Amount', type: 'number', required: true },
      { name: 'pay_dt', label: 'Date', type: 'date' },
      { name: 'pay_typ', label: 'Type', type: 'select', options: [['CASH', 'Cash'], ['CHQ', 'Cheque'], ['TT', 'Bank Transfer']] },
      { name: 'loc_id', label: 'Location' },
      { name: 'bank_cd', label: 'Bank' },
      { name: 'chq_no', label: 'Cheque No' },
    ],
  },
  'credit-notes': {
    title: 'Credit Note Entry',
    submit: 'Save',
    defaults: () => ({ credit_note_date: today() }),
    fields: [
      { name: 'credit_note_no', label: 'Credit Note No', required: true, generate: 'credit_note_no' },
      { name: 'cust_ac_no', label: 'Customer Account', required: true },
      { name: 'credit_note_date', label: 'Date', type: 'date' },
      { name: 'total_amount', label: 'Amount', type: 'number', required: true },
      { name: 'invoice_no', label: 'Invoice No' },
      { name: 'reason', label: 'Reason', col: 'col-md-6' },
    ],
  },
  'debit-notes': {
    title: 'Debit Note Entry',
    submit: 'Save',
    defaults: () => ({ debit_note_date: today() }),
    fields: [
      { name: 'debit_note_no', label: 'Debit Note No', required: true, generate: 'debit_note_no' },
      { name: 'cust_ac_no', label: 'Customer Account', required: true },
      { name: 'debit_note_date', label: 'Date', type: 'date' },
      { name: 'total_amount', label: 'Amount', type: 'number', required: true },
      { name: 'invoice_no', label: 'Invoice No' },
      { name: 'reason', label: 'Reason', col: 'col-md-6' },
    ],
  },
  'agent-in': {
    title: 'Drop Point Money In',
    extra: 'Record a bilyet payment received from a drop point.',
    submit: 'Save',
    defaults: () => ({ bilyet_dt: today() }),
    fields: [
      { name: 'agent_cd', label: 'Drop Point Code', required: true },
      { name: 'bilyet_no', label: 'Bilyet No', required: true, generate: 'bilyet_no' },
      { name: 'bilyet_dt', label: 'Date', type: 'date' },
      { name: 'amt', label: 'Amount', type: 'number', required: true },
    ],
  },
  'agent-out': {
    title: 'Drop Point Money Out',
    extra: 'Record a bilyet payment paid out to a drop point.',
    submit: 'Save',
    defaults: () => ({ bilyet_dt: today() }),
    fields: [
      { name: 'agent_cd', label: 'Drop Point Code', required: true },
      { name: 'bilyet_no', label: 'Bilyet No', required: true, generate: 'bilyet_no' },
      { name: 'bilyet_dt', label: 'Date', type: 'date' },
      { name: 'amt', label: 'Amount', type: 'number', required: true },
    ],
  },
  'agent-credit': {
    title: 'Drop Point Credit Note',
    submit: 'Save',
    defaults: () => ({ bilyet_dt: today() }),
    fields: [
      { name: 'agent_cd', label: 'Drop Point Code', required: true },
      { name: 'bilyet_no', label: 'Note No', required: true, generate: 'bilyet_no' },
      { name: 'bilyet_dt', label: 'Date', type: 'date' },
      { name: 'amt', label: 'Amount', type: 'number', required: true },
    ],
  },
  'agent-debit': {
    title: 'Drop Point Debit Note',
    submit: 'Save',
    defaults: () => ({ bilyet_dt: today() }),
    fields: [
      { name: 'agent_cd', label: 'Drop Point Code', required: true },
      { name: 'bilyet_no', label: 'Note No', required: true, generate: 'bilyet_no' },
      { name: 'bilyet_dt', label: 'Date', type: 'date' },
      { name: 'amt', label: 'Amount', type: 'number', required: true },
    ],
  },
}

function cellValue(r, k, kind) {
  if (kind === 'money') return money(r[k])
  if (k === 'cust_ac_no') return `${r.cust_ac_no || ''} ${r.cust_name || ''}`.trim()
  if (k === 'agent_cd') return `${r.agent_cd || ''} ${r.drop_name || r.agent_name || ''}`.trim()
  return r[k] ?? ''
}

export default function BillingListPage({ doc, title }) {
  const cfg = CONFIG[doc] || CONFIG.invoices
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState(() => Object.fromEntries(cfg.filters.map((f) => [f.name, params.get(f.name) || ''])))
  const [data, setData] = useState({ rows: [], page: 1, totalPages: 1 })
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(Object.fromEntries(cfg.filters.map((f) => [f.name, params.get(f.name) || ''])))
    setError('')
    listBilling(doc, Object.fromEntries(params.entries())).then(setData).catch((e) => setError(apiError(e)))
  }, [doc, params, cfg.filters])

  return (
    <div>
      <h3 className="mb-3">{title || cfg.title}</h3>
      <Alert error={error} />
      <div className="card mb-3"><div className="card-body">
        <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); setParams({ ...form, page: 1 }) }}>
          {cfg.filters.map((f) => (
            <div className="col-md-2" key={f.name}>
              <label className="form-label">{f.label}</label>
              {f.type === 'select' ? (
                <select className="form-select form-select-sm" value={form[f.name] || ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input className="form-control form-control-sm" value={form[f.name] || ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="col-md-2"><button className="btn btn-primary btn-sm" type="submit">Search</button></div>
        </form>
      </div></div>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark"><tr>{cfg.columns.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>
            {(data.rows || []).map((r, i) => (
              <tr key={r.inv_no || r.dn_no || r.bilyet_no || r.credit_note_no || r.debit_note_no || i}>
                {cfg.columns.map(([k, , kind]) => (
                  <td key={k}>{cellValue(r, k, kind)}</td>
                ))}
              </tr>
            ))}
            {(data.rows || []).length === 0 ? <tr><td colSpan={cfg.columns.length} className="text-center text-muted">No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <Pager page={Number(params.get('page') || 1)} totalPages={data.totalPages || 1} onPage={(p) => setParams({ ...Object.fromEntries(params.entries()), page: p })} />
    </div>
  )
}

export function InvoiceEntryPage() {
  const [form, setForm] = useState({ cust_ac_no: '', yr_month: ym(), date_from: '', date_to: '' })
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState({})
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadPreview(e) {
    e?.preventDefault()
    setError('')
    setOk('')
    if (!form.cust_ac_no.trim()) {
      setError('Customer account is required.')
      return
    }
    setBusy(true)
    try {
      const data = await previewInvoice({
        cust_ac_no: form.cust_ac_no.trim(),
        date_from: form.date_from || undefined,
        date_to: form.date_to || undefined,
      })
      setPreview(data)
      const sel = {}
      ;(data.rows || []).forEach((r) => { sel[r.cn_no] = true })
      setSelected(sel)
    } catch (err) {
      setError(apiError(err))
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  function toggleAll(on) {
    if (!preview?.rows) return
    const sel = {}
    preview.rows.forEach((r) => { sel[r.cn_no] = on })
    setSelected(sel)
  }

  function toggleOne(cnNo) {
    setSelected((s) => ({ ...s, [cnNo]: !s[cnNo] }))
  }

  const picked = (preview?.rows || []).filter((r) => selected[r.cn_no])
  const pickedSubtotal = picked.reduce((sum, r) => sum + Number(r.tot_cn_amt || 0), 0)
  const pickedTaxable = picked.reduce((sum, r) => sum + (String(r.tax_exempt || 'N').toUpperCase() === 'Y' ? 0 : Number(r.tot_cn_amt || 0)), 0)
  const taxRate = Number(preview?.taxRate || 0)
  const pickedTax = taxRate > 0 ? Math.round(pickedTaxable * taxRate) / 100 : 0
  const pickedTotal = Math.round((pickedSubtotal + pickedTax) * 100) / 100

  async function onGenerate(e) {
    e.preventDefault()
    setError('')
    setOk('')
    const cnNos = picked.map((r) => r.cn_no)
    if (cnNos.length === 0) {
      setError('Select at least one consignment.')
      return
    }
    setBusy(true)
    try {
      const r = await generateInvoice({
        cust_ac_no: form.cust_ac_no.trim(),
        yr_month: form.yr_month,
        cn_nos: cnNos,
      })
      setOk(r.message || `Invoice ${r.invoiceNo || r.id} created.`)
      await loadPreview()
    } catch (err) {
      setError(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h3 className="mb-3">Invoice Entry</h3>
      <p className="text-muted">Generate an on-demand invoice by selecting unbilled consignments for a customer.</p>
      <Alert error={error} ok={ok} />
      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={loadPreview}>
            <div className="col-md-3">
              <label className="form-label">Customer Account</label>
              <input className="form-control" required value={form.cust_ac_no} onChange={(e) => setForm({ ...form, cust_ac_no: e.target.value })} placeholder="e.g. C0001" />
            </div>
            <div className="col-md-2">
              <label className="form-label">Year Month</label>
              <input className="form-control" required value={form.yr_month} onChange={(e) => setForm({ ...form, yr_month: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Date From</label>
              <input type="date" className="form-control" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Date To</label>
              <input type="date" className="form-control" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} />
            </div>
            <div className="col-md-3">
              <button className="btn btn-outline-primary" type="submit" disabled={busy}>Load unbilled CNs</button>
            </div>
          </form>
        </div>
      </div>

      {preview ? (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted">{preview.count} unbilled consignment(s) — {picked.length} selected</span>
            <div>
              <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => toggleAll(true)}>Select all</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleAll(false)}>Clear</button>
            </div>
          </div>
          <div className="table-responsive mb-3">
            <table className="table table-sm table-striped table-bordered">
              <thead className="table-dark">
                <tr>
                  <th style={{ width: 40 }} />
                  <th>CN</th>
                  <th>Date</th>
                  <th>Route</th>
                  <th>Pcs</th>
                  <th>Wt</th>
                  <th>Amount</th>
                  <th>Tax</th>
                </tr>
              </thead>
              <tbody>
                {(preview.rows || []).map((r) => (
                  <tr key={r.cn_no}>
                    <td><input type="checkbox" checked={Boolean(selected[r.cn_no])} onChange={() => toggleOne(r.cn_no)} /></td>
                    <td>{r.cn_no}</td>
                    <td>{String(r.cn_dt_tm || '').slice(0, 10)}</td>
                    <td>{r.cn_origin} → {r.cn_dstn}</td>
                    <td>{r.cn_pcs}</td>
                    <td>{r.cn_wt}</td>
                    <td>{money(r.tot_cn_amt)}</td>
                    <td>{String(r.tax_exempt || 'N').toUpperCase() === 'Y' ? 'Exempt' : 'Std'}</td>
                  </tr>
                ))}
                {(preview.rows || []).length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-muted">No unbilled consignments for this customer.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="card mb-3">
            <div className="card-body row g-2">
              <div className="col-md-3"><strong>Subtotal:</strong> {money(pickedSubtotal)}</div>
              <div className="col-md-3"><strong>SST ({taxRate}%):</strong> {taxRate > 0 ? money(pickedTax) : '—'}</div>
              <div className="col-md-3"><strong>Grand total:</strong> {money(pickedTotal)}</div>
            </div>
          </div>
          <button className="btn btn-primary" type="button" disabled={busy || picked.length === 0} onClick={onGenerate}>Generate Invoice</button>
        </>
      ) : null}
    </div>
  )
}

export function BillingEntryPage({ doc, title }) {
  if (doc === 'invoices') {
    return <InvoiceEntryPage />
  }

  const cfg = ENTRIES[doc]
  const [form, setForm] = useState(() => (cfg?.defaults ? cfg.defaults() : {}))
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    setForm(cfg?.defaults ? cfg.defaults() : {})
    setError('')
    setOk('')
  }, [doc, cfg])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    try {
      const r = await saveBilling(doc, form)
      setOk(r.message || 'Saved.')
    } catch (err) {
      setError(apiError(err))
    }
  }

  if (!cfg) return <div className="alert alert-danger">Unknown billing document.</div>

  return (
    <div>
      <h3 className="mb-3">{title || cfg.title}</h3>
      {cfg.extra ? <p className="text-muted">{cfg.extra}</p> : null}
      <Alert error={error} ok={ok} />
      <div className="card"><div className="card-body">
        <form className="row g-3" onSubmit={onSubmit}>
          {cfg.fields.map((f) => (
            <div className={f.col || 'col-md-3'} key={f.name}>
              <label className="form-label">
                {f.label}
                {f.generate ? <span className="text-muted fw-normal small ms-1">— or generate</span> : null}
              </label>
              {f.type === 'select' ? (
                <select className="form-select" value={form[f.name] || ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                  {(f.options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : f.generate ? (
                <SystemCodeField
                  required={f.required}
                  value={form[f.name] || ''}
                  kind={f.generate}
                  onChange={(v) => setForm({ ...form, [f.name]: v })}
                  onError={setError}
                />
              ) : (
                <input className="form-control" type={f.type || 'text'} required={f.required} value={form[f.name] || ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="col-12"><button className="btn btn-primary" type="submit">{cfg.submit || 'Save'}</button></div>
        </form>
      </div></div>
    </div>
  )
}

export function TrackingLookupPage({ doc, title, idKey }) {
  const [id, setId] = useState('')
  const [row, setRow] = useState(null)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const r = await getBilling(doc, id)
      setRow(r.row)
    } catch (err) {
      setError(apiError(err))
      setRow(null)
    }
  }

  return (
    <div>
      <h3 className="mb-3">{title}</h3>
      <Alert error={error} />
      <form className="row g-2 mb-3" onSubmit={onSubmit}>
        <div className="col-md-4"><input className="form-control" placeholder={idKey} value={id} onChange={(e) => setId(e.target.value)} required /></div>
        <div className="col-md-2"><button className="btn btn-primary" type="submit">Look up</button></div>
      </form>
      {row ? (
        <div className="card"><div className="card-body">
          <table className="table table-sm mb-0">
            <tbody>
              {Object.entries(row).map(([k, v]) => (
                <tr key={k}><th style={{ width: 220 }}>{k}</th><td>{v == null ? '—' : String(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </div></div>
      ) : <p className="text-muted">Enter a number to look up.</p>}
    </div>
  )
}
