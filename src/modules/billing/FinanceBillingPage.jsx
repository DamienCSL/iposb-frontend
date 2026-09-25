import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Steps,
  message,
} from 'antd'
import {
  EyeOutlined,
  FilePdfOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  apiError,
  generateInvoice,
  generateSystemCode,
  getBilling,
  getBillingPdfUrl,
  invoiceCatalog,
  listBilling,
  previewInvoice,
  saveBilling,
  setInvoicePaymentStatus,
  voidBilling,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'
import { money } from '../../ui/bits'

const { Title, Text, Paragraph } = Typography
const BRAND = '#1B8A5A'

const DOC_TYPES = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'do', label: 'Delivery Orders' },
  { key: 'credit-notes', label: 'Credit Notes' },
  { key: 'debit-notes', label: 'Debit Notes' },
  { key: 'agent-in', label: 'Drop Point Money In' },
  { key: 'agent-out', label: 'Drop Point Money Out' },
  { key: 'agent-credit', label: 'Drop Point Credit' },
  { key: 'agent-debit', label: 'Drop Point Debit' },
]

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

const LIST_CONFIG = {
  invoices: {
    title: 'Invoice List',
    filters: [
      { name: 'inv_no', label: 'Invoice No' },
      { name: 'cust_ac_no', label: 'Customer' },
      {
        name: 'inv_status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'UPD', label: 'Unpaid' },
          { value: 'PAY', label: 'Paid' },
        ],
      },
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
    idKey: 'inv_no',
  },
  do: {
    title: 'Delivery Order List',
    filters: [
      { name: 'dn_no', label: 'DN No' },
      { name: 'cust_ac_no', label: 'Customer' },
    ],
    columns: [
      ['dn_no', 'DN Number'],
      ['cust_ac_no', 'Customer'],
      ['dn_dt', 'Date'],
      ['cn_origin', 'Origin'],
      ['cn_dstn', 'Dest'],
      ['cn_status', 'Status'],
    ],
    idKey: 'dn_no',
  },
  'credit-notes': {
    title: 'Credit Note List',
    filters: [
      { name: 'credit_note_no', label: 'Note No' },
      { name: 'cust_ac_no', label: 'Customer' },
    ],
    columns: [
      ['credit_note_no', 'Note No'],
      ['cust_ac_no', 'Customer'],
      ['credit_note_date', 'Date'],
      ['total_amount', 'Amount', 'money'],
      ['invoice_no', 'Invoice'],
      ['reason', 'Reason'],
    ],
    idKey: 'credit_note_no',
  },
  'debit-notes': {
    title: 'Debit Note List',
    filters: [
      { name: 'debit_note_no', label: 'Note No' },
      { name: 'cust_ac_no', label: 'Customer' },
    ],
    columns: [
      ['debit_note_no', 'Note No'],
      ['cust_ac_no', 'Customer'],
      ['debit_note_date', 'Date'],
      ['total_amount', 'Amount', 'money'],
      ['invoice_no', 'Invoice'],
      ['reason', 'Reason'],
    ],
    idKey: 'debit_note_no',
  },
  'agent-in': { title: 'Drop Point Money In', filters: DROP_POINT_FILTERS, columns: DROP_POINT_COLS, idKey: 'bilyet_no' },
  'agent-out': { title: 'Drop Point Money Out', filters: DROP_POINT_FILTERS, columns: DROP_POINT_COLS, idKey: 'bilyet_no' },
  'agent-credit': { title: 'Drop Point Credit Note', filters: DROP_POINT_FILTERS, columns: DROP_POINT_COLS, idKey: 'bilyet_no' },
  'agent-debit': { title: 'Drop Point Debit Note', filters: DROP_POINT_FILTERS, columns: DROP_POINT_COLS, idKey: 'bilyet_no' },
}

const today = () => new Date().toISOString().slice(0, 10)
const ym = () => new Date().toISOString().slice(0, 7).replace('-', '')

const ENTRY_CONFIG = {
  invoices: {
    title: 'Invoice Entry',
    extra: 'Generate an invoice from unbilled consignments. After generation, mark it Paid or Unpaid on the invoice list.',
    submit: 'Generate Invoice',
  },
  do: {
    title: 'Delivery Order Entry',
    submit: 'Save DO',
    defaults: () => ({ dn_dt: today(), pkg_typ: 'P', cn_origin: 'BKI', spec_handle: 'N', cn_pcs: 1, cn_wt: 1 }),
    fields: [
      { name: 'dn_no', label: 'DN Number', required: true, generate: 'dn_no' },
      { name: 'cust_ac_no', label: 'Customer Account', required: true },
      { name: 'dn_dt', label: 'Date', type: 'date' },
      { name: 'batch_no', label: 'Batch No', generate: 'batch_no' },
      { name: 'pkg_typ', label: 'Package', type: 'select', options: [{ value: 'P', label: 'Parcel' }, { value: 'D', label: 'Document' }] },
      { name: 'cn_origin', label: 'Origin' },
      { name: 'cn_dstn', label: 'Destination' },
      { name: 'cn_pcs', label: 'Pieces', type: 'number' },
      { name: 'cn_wt', label: 'Weight (kg)', type: 'number' },
      { name: 'spec_handle', label: 'Special Handle', type: 'select', options: [{ value: 'N', label: 'No' }, { value: 'Y', label: 'Yes' }] },
      { name: 'spec_amt', label: 'Special Amount', type: 'number' },
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
      { name: 'reason', label: 'Reason' },
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
      { name: 'reason', label: 'Reason' },
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
  return r[k] ?? '—'
}

function rowId(row, idKey) {
  return String(row?.[idKey] || row?.id || '')
}

export default function FinanceBillingPage() {
  const { doc: pathDoc, id: pathId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const canVoid = isAdmin

  const activeDoc = DOC_TYPES.some((d) => d.key === pathDoc) ? pathDoc : 'invoices'
  const listCfg = LIST_CONFIG[activeDoc] || LIST_CONFIG.invoices
  const entryCfg = ENTRY_CONFIG[activeDoc]
  const mode = params.get('mode') === 'entry' ? 'entry' : 'list'

  const [filters, setFilters] = useState({})
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 })
  const [loading, setLoading] = useState(false)

  const [detailOpen, setDetailOpen] = useState(Boolean(pathId))
  const [activeItem, setActiveItem] = useState(null)
  const [detailLines, setDetailLines] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [entryForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // Invoice generate wizard: Customer → Pricing → Components → Generate
  const [invForm, setInvForm] = useState({ cust_ac_no: '', yr_month: ym(), date_from: '', date_to: '' })
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState({})
  const [previewBusy, setPreviewBusy] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [catalog, setCatalog] = useState({ schemes: [], components: [], customer: null })
  const [pricingScheme, setPricingScheme] = useState('walk_in')
  const [invComponents, setInvComponents] = useState([])

  const [voidModal, setVoidModal] = useState({ open: false, item: null })
  const [voiding, setVoiding] = useState(false)
  const [voidForm] = Form.useForm()
  const [payBusyId, setPayBusyId] = useState('')

  useEffect(() => {
    if (pathDoc === 'receipts') {
      navigate('/ops/billing/invoices', { replace: true })
    }
  }, [pathDoc, navigate])

  useEffect(() => {
    const next = {}
    for (const f of listCfg.filters || []) {
      next[f.name] = params.get(f.name) || ''
    }
    setFilters(next)
    setPreview(null)
    setSelected({})
    setWizardStep(0)
    setCatalog({ schemes: [], components: [], customer: null })
    setPricingScheme('walk_in')
    setInvComponents([])
    if (entryCfg?.defaults) {
      entryForm.setFieldsValue(entryCfg.defaults())
    } else {
      entryForm.resetFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc])

  useEffect(() => {
    if (activeDoc !== 'invoices' || mode !== 'entry') return
    invoiceCatalog({})
      .then((data) => {
        setCatalog((c) => ({
          ...c,
          schemes: data.schemes || [],
          components: data.components || [],
        }))
      })
      .catch(() => {})
  }, [activeDoc, mode])

  async function fetchList(page = 1, pageSize = pagination.pageSize) {
    setLoading(true)
    try {
      const q = { page, perPage: pageSize }
      for (const [k, v] of Object.entries(filters)) {
        if (v) q[k] = v
      }
      const res = await listBilling(activeDoc, q)
      const records = res?.rows || res?.data || []
      setRows(records)
      setPagination({
        current: Number(res?.page || page),
        pageSize: Number(res?.perPage || pageSize),
        total: Number(res?.total || records.length),
      })
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'list') fetchList(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc, mode, filters])

  async function openDetail(id) {
    if (!id) return
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await getBilling(activeDoc, id)
      setActiveItem(res?.row || res?.data || res || {})
      setDetailLines(res?.lines || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (pathId) openDetail(pathId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathId, activeDoc])

  function setMode(next) {
    const nextParams = { ...Object.fromEntries(params.entries()), mode: next === 'entry' ? 'entry' : undefined }
    if (next !== 'entry') delete nextParams.mode
    setParams(nextParams, { replace: true })
  }

  function applyFilters() {
    const next = { page: '1' }
    for (const [k, v] of Object.entries(filters)) {
      if (v) next[k] = v
    }
    if (mode === 'entry') next.mode = 'entry'
    setParams(next, { replace: true })
    fetchList(1)
  }

  async function generateCode(field, kind) {
    try {
      const res = await generateSystemCode({ kind })
      const code = res?.code || res?.value || res?.generated || ''
      if (code) entryForm.setFieldValue(field, code)
      else message.warning('No code returned')
    } catch (err) {
      message.error(apiError(err))
    }
  }

  async function loadInvoicePreview() {
    if (!invForm.cust_ac_no.trim()) {
      message.warning('Customer account is required.')
      return
    }
    setPreviewBusy(true)
    try {
      const [data, cat] = await Promise.all([
        previewInvoice({
          cust_ac_no: invForm.cust_ac_no.trim(),
          date_from: invForm.date_from || undefined,
          date_to: invForm.date_to || undefined,
          pricing_scheme: pricingScheme || undefined,
        }),
        invoiceCatalog({ cust_ac_no: invForm.cust_ac_no.trim() }),
      ])
      setPreview(data)
      const sel = {}
      ;(data.rows || []).forEach((r) => {
        sel[r.cn_no] = true
      })
      setSelected(sel)

      const schemes = cat.schemes || catalog.schemes || []
      const components = cat.components || catalog.components || []
      setCatalog({
        schemes,
        components,
        customer: cat.customer || data.customer || null,
      })
      const scheme =
        data.pricingScheme ||
        cat.customer?.invoice_pricing_scheme ||
        pricingScheme ||
        'walk_in'
      setPricingScheme(scheme)
      const preferred =
        (Array.isArray(data.components) && data.components.length ? data.components : null) ||
        (Array.isArray(cat.customer?.invoice_components) && cat.customer.invoice_components.length
          ? cat.customer.invoice_components
          : null) ||
        schemes.find((s) => s.scheme_code === scheme)?.defaultComponents ||
        []
      setInvComponents(preferred)
      setWizardStep(1)
    } catch (err) {
      message.error(apiError(err))
      setPreview(null)
    } finally {
      setPreviewBusy(false)
    }
  }

  function applySchemeDefaults(schemeCode) {
    setPricingScheme(schemeCode)
    const scheme = (catalog.schemes || []).find((s) => s.scheme_code === schemeCode)
    if (scheme?.defaultComponents?.length) {
      setInvComponents(scheme.defaultComponents)
    }
  }

  const picked = useMemo(
    () => (preview?.rows || []).filter((r) => selected[r.cn_no]),
    [preview, selected],
  )
  const pickedSubtotal = picked.reduce((sum, r) => sum + Number(r.tot_cn_amt || 0), 0)
  const pickedTaxable = picked.reduce(
    (sum, r) => sum + (String(r.tax_exempt || 'N').toUpperCase() === 'Y' ? 0 : Number(r.tot_cn_amt || 0)),
    0,
  )
  const taxRate = Number(preview?.taxRate || 0)
  const pickedTax = taxRate > 0 ? Math.round(pickedTaxable * taxRate) / 100 : 0
  const pickedTotal = Math.round((pickedSubtotal + pickedTax) * 100) / 100

  async function onGenerateInvoice() {
    const cnNos = picked.map((r) => r.cn_no)
    if (!cnNos.length) {
      message.warning('Select at least one consignment.')
      return
    }
    if (!pricingScheme) {
      message.warning('Select a pricing scheme.')
      return
    }
    setPreviewBusy(true)
    try {
      const r = await generateInvoice({
        cust_ac_no: invForm.cust_ac_no.trim(),
        yr_month: invForm.yr_month,
        cn_nos: cnNos,
        pricing_scheme: pricingScheme,
        components: invComponents,
        invoice_attn: catalog.customer?.invoice_attn || undefined,
        invoice_terms: catalog.customer?.invoice_terms || undefined,
      })
      message.success(r.message || `Invoice ${r.invoiceNo || r.id} created.`)
      setWizardStep(0)
      setPreview(null)
      setSelected({})
      fetchList(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setPreviewBusy(false)
    }
  }

  async function onSaveEntry(values) {
    setSaving(true)
    try {
      const r = await saveBilling(activeDoc, values)
      message.success(r.message || 'Saved.')
      if (entryCfg?.defaults) entryForm.setFieldsValue(entryCfg.defaults())
      else entryForm.resetFields()
      setMode('list')
      fetchList(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onToggleInvoicePaid(row, paid) {
    const id = rowId(row, 'inv_no') || String(row?.invoice_no || '')
    if (!id) return
    setPayBusyId(id)
    try {
      const r = await setInvoicePaymentStatus(id, paid)
      message.success(r.message || (paid ? 'Marked as Paid.' : 'Marked as Unpaid.'))
      await fetchList(pagination.current)
      if (detailOpen && (rowId(activeItem, 'inv_no') === id || activeItem?.invoice_no === id)) {
        await openDetail(id)
      }
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setPayBusyId('')
    }
  }

  async function onVoid(values) {
    const id = rowId(voidModal.item, listCfg.idKey)
    if (!id) return
    setVoiding(true)
    try {
      await voidBilling(activeDoc, id, values.reason || values.note || 'Voided by operations')
      message.success(`Voided ${id}`)
      setVoidModal({ open: false, item: null })
      setDetailOpen(false)
      fetchList(pagination.current)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setVoiding(false)
    }
  }

  const listColumns = [
    ...(listCfg.columns || []).map(([key, title, kind]) => ({
      title,
      key,
      dataIndex: key,
      render: (_, r) => {
        if (key === listCfg.idKey) {
          return (
            <Button
              type="link"
              style={{ padding: 0, fontFamily: 'JetBrains Mono, monospace', color: BRAND }}
              onClick={() => {
                navigate(`/ops/billing/${activeDoc}/${encodeURIComponent(rowId(r, listCfg.idKey))}`)
                openDetail(rowId(r, listCfg.idKey))
              }}
            >
              {cellValue(r, key, kind)}
            </Button>
          )
        }
        if (kind === 'money') return money(r[key])
        if (String(key).includes('status')) return <StatusTag status={r[key]} />
        return cellValue(r, key, kind)
      },
    })),
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, r) => {
        const id = rowId(r, listCfg.idKey)
        const status = String(r.inv_status || '').toUpperCase()
        const isInvoice = activeDoc === 'invoices'
        const canMarkPaid = isInvoice && status === 'UPD'
        const canMarkUnpaid = isInvoice && status === 'PAY'
        return (
          <Space wrap size={4}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => { navigate(`/ops/billing/${activeDoc}/${encodeURIComponent(id)}`); openDetail(id) }} />
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              href={getBillingPdfUrl(activeDoc, id)}
              target="_blank"
              rel="noreferrer"
            />
            {canMarkPaid ? (
              <Button
                size="small"
                type="primary"
                loading={payBusyId === id}
                style={{ background: BRAND, borderColor: BRAND }}
                onClick={() => onToggleInvoicePaid(r, true)}
              >
                Mark Paid
              </Button>
            ) : null}
            {canMarkUnpaid ? (
              <Button
                size="small"
                loading={payBusyId === id}
                onClick={() => onToggleInvoicePaid(r, false)}
              >
                Mark Unpaid
              </Button>
            ) : null}
            {canVoid ? (
              <Button
                size="small"
                danger
                onClick={() => {
                  voidForm.resetFields()
                  setVoidModal({ open: true, item: r })
                }}
              >
                Void
              </Button>
            ) : null}
          </Space>
        )
      },
    },
  ]

  function renderInvoiceEntry() {
    const schemeOptions = (catalog.schemes || []).map((s) => ({
      value: s.scheme_code,
      label: s.scheme_label,
      description: s.description,
    }))
    const componentOptions = (catalog.components || []).map((c) => ({
      value: c.component_code,
      label: c.component_label,
      group: c.component_group,
    }))

    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Generate invoice"
          description="Select Customer → Select Pricing Scheme → Select Invoice Components → Generate Invoice"
        />
        <Steps
          size="small"
          current={wizardStep}
          items={[
            { title: 'Customer' },
            { title: 'Pricing scheme' },
            { title: 'Components' },
            { title: 'Generate' },
          ]}
          style={{ marginBottom: 8 }}
        />

        <Card size="small" title="1. Select customer">
          <Row gutter={12} align="bottom">
            <Col xs={24} md={6}>
              <Form.Item label="Customer Account" required style={{ marginBottom: 0 }}>
                <Input
                  value={invForm.cust_ac_no}
                  placeholder="e.g. C0001"
                  onChange={(e) => setInvForm((f) => ({ ...f, cust_ac_no: e.target.value }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Year Month" required style={{ marginBottom: 0 }}>
                <Input value={invForm.yr_month} onChange={(e) => setInvForm((f) => ({ ...f, yr_month: e.target.value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Date From" style={{ marginBottom: 0 }}>
                <Input type="date" value={invForm.date_from} onChange={(e) => setInvForm((f) => ({ ...f, date_from: e.target.value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Date To" style={{ marginBottom: 0 }}>
                <Input type="date" value={invForm.date_to} onChange={(e) => setInvForm((f) => ({ ...f, date_to: e.target.value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Button type="primary" loading={previewBusy} onClick={loadInvoicePreview} style={{ background: BRAND, borderColor: BRAND }}>
                Load unbilled CNs
              </Button>
            </Col>
          </Row>
          {catalog.customer ? (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              {catalog.customer.cust_name} · default scheme: {catalog.customer.invoice_pricing_scheme || 'walk_in'}
              {catalog.customer.invoice_terms ? ` · terms: ${catalog.customer.invoice_terms}` : ''}
            </Text>
          ) : null}
        </Card>

        {preview ? (
          <>
            <Card size="small" title="2. Select pricing scheme">
              <Select
                style={{ width: '100%', maxWidth: 480 }}
                value={pricingScheme}
                options={schemeOptions.map((s) => ({
                  value: s.value,
                  label: s.description ? `${s.label} — ${s.description}` : s.label,
                }))}
                onChange={applySchemeDefaults}
              />
              <div style={{ marginTop: 12 }}>
                <Button type="primary" onClick={() => setWizardStep(2)} style={{ background: BRAND, borderColor: BRAND }}>
                  Continue to components
                </Button>
              </div>
            </Card>

            <Card size="small" title="3. Select invoice components">
              <Checkbox.Group
                style={{ width: '100%' }}
                value={invComponents}
                onChange={(vals) => setInvComponents(vals)}
              >
                <Row gutter={[8, 8]}>
                  {componentOptions.map((c) => (
                    <Col key={c.value} xs={24} sm={12} md={8}>
                      <Checkbox value={c.value}>
                        {c.label}
                        <Tag style={{ marginLeft: 6 }}>{c.group}</Tag>
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
              {!componentOptions.length ? (
                <Alert type="warning" showIcon message="Component catalog empty — run migration 055, or defaults will still apply on generate." />
              ) : null}
              <div style={{ marginTop: 12 }}>
                <Space>
                  <Button onClick={() => setWizardStep(1)}>Back</Button>
                  <Button type="primary" onClick={() => setWizardStep(3)} style={{ background: BRAND, borderColor: BRAND }}>
                    Continue to generate
                  </Button>
                </Space>
              </div>
            </Card>

            <Card
              size="small"
              title={`4. Generate — ${preview.count ?? (preview.rows || []).length} unbilled, ${picked.length} selected`}
              extra={
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      const sel = {}
                      ;(preview.rows || []).forEach((r) => {
                        sel[r.cn_no] = true
                      })
                      setSelected(sel)
                    }}
                  >
                    Select all
                  </Button>
                  <Button size="small" onClick={() => setSelected({})}>
                    Clear
                  </Button>
                </Space>
              }
            >
              <Table
                size="small"
                rowKey="cn_no"
                pagination={false}
                dataSource={preview.rows || []}
                columns={[
                  {
                    title: '',
                    width: 40,
                    render: (_, r) => (
                      <Checkbox
                        checked={Boolean(selected[r.cn_no])}
                        onChange={() => setSelected((s) => ({ ...s, [r.cn_no]: !s[r.cn_no] }))}
                      />
                    ),
                  },
                  { title: 'CN', dataIndex: 'cn_no' },
                  { title: 'Date', render: (_, r) => String(r.cn_dt_tm || '').slice(0, 10) },
                  { title: 'Route', render: (_, r) => `${r.cn_origin || '—'} → ${r.cn_dstn || '—'}` },
                  { title: 'Pcs', dataIndex: 'cn_pcs' },
                  { title: 'Wt', dataIndex: 'cn_wt' },
                  { title: 'Amount', render: (_, r) => money(r.tot_cn_amt) },
                  {
                    title: 'Tax',
                    render: (_, r) => (String(r.tax_exempt || 'N').toUpperCase() === 'Y' ? 'Exempt' : 'Std'),
                  },
                ]}
                locale={{ emptyText: 'No unbilled consignments for this customer.' }}
              />
              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col span={8}>
                  <Text strong>Subtotal:</Text> {money(pickedSubtotal)}
                </Col>
                <Col span={8}>
                  <Text strong>SST ({taxRate}%):</Text> {taxRate > 0 ? money(pickedTax) : '—'}
                </Col>
                <Col span={8}>
                  <Text strong>Grand total:</Text> {money(pickedTotal)}
                </Col>
              </Row>
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                Scheme: <Tag color="green">{pricingScheme}</Tag>
                Components: {invComponents.length ? invComponents.join(', ') : 'scheme defaults'}
              </Paragraph>
              <Space style={{ marginTop: 12 }}>
                <Button onClick={() => setWizardStep(2)}>Back</Button>
                <Button
                  type="primary"
                  style={{ background: BRAND, borderColor: BRAND }}
                  disabled={!picked.length}
                  loading={previewBusy}
                  onClick={onGenerateInvoice}
                >
                  Generate Invoice
                </Button>
              </Space>
            </Card>
          </>
        ) : null}
      </Space>
    )
  }

  function renderGenericEntry() {
    if (!entryCfg?.fields) return <Alert type="warning" message="No entry form for this document." />
    return (
      <Card size="small" title={entryCfg.title}>
        {entryCfg.extra ? <Paragraph type="secondary">{entryCfg.extra}</Paragraph> : null}
        <Form form={entryForm} layout="vertical" onFinish={onSaveEntry} initialValues={entryCfg.defaults?.() || {}}>
          <Row gutter={12}>
            {entryCfg.fields.map((f) => (
              <Col key={f.name} xs={24} md={f.name === 'reason' ? 24 : 8}>
                <Form.Item
                  name={f.name}
                  label={f.label}
                  rules={f.required ? [{ required: true, message: `${f.label} is required` }] : undefined}
                >
                  {f.generate ? (
                    <Space.Compact style={{ width: '100%' }}>
                      <Input />
                      <Button
                        onClick={(e) => {
                          e.preventDefault()
                          generateCode(f.name, f.generate)
                        }}
                      >
                        Generate
                      </Button>
                    </Space.Compact>
                  ) : f.type === 'select' ? (
                    <Select options={f.options || []} />
                  ) : f.type === 'number' ? (
                    <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                  ) : f.type === 'date' ? (
                    <Input type="date" />
                  ) : (
                    <Input />
                  )}
                </Form.Item>
              </Col>
            ))}
          </Row>
          <Button type="primary" htmlType="submit" loading={saving} style={{ background: BRAND, borderColor: BRAND }}>
            {entryCfg.submit || 'Save'}
          </Button>
        </Form>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>Billing Documents</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Damien invoice generate, paid/unpaid status, DO, credit/debit notes, and drop-point bilyets.
            {' '}
            <Link to="/ops/billing/customer-wallet">Customer wallet</Link>
            {' · '}
            <Link to={`/ops/billing/${activeDoc}/tracking`}>Tracking lookup</Link>
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => (mode === 'list' ? fetchList(pagination.current) : null)} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: BRAND, borderColor: BRAND }}
            onClick={() => setMode('entry')}
          >
            New / Entry
          </Button>
        </Space>
      </div>

      <Card size="small">
        <Tabs
          activeKey={activeDoc}
          onChange={(k) => navigate(`/ops/billing/${k}${mode === 'entry' ? '?mode=entry' : ''}`)}
          items={DOC_TYPES.map((d) => ({ key: d.key, label: d.label }))}
        />
        <Tabs
          activeKey={mode}
          onChange={setMode}
          items={[
            { key: 'list', label: 'List' },
            { key: 'entry', label: 'Entry' },
          ]}
        />

        {mode === 'list' ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small">
              <Row gutter={12} align="bottom">
                {(listCfg.filters || []).map((f) => (
                  <Col key={f.name} xs={24} md={6}>
                    <Form.Item label={f.label} style={{ marginBottom: 0 }}>
                      {f.type === 'select' ? (
                        <Select
                          value={filters[f.name] || ''}
                          options={f.options}
                          onChange={(v) => setFilters((prev) => ({ ...prev, [f.name]: v }))}
                        />
                      ) : (
                        <Input
                          value={filters[f.name] || ''}
                          onChange={(e) => setFilters((prev) => ({ ...prev, [f.name]: e.target.value }))}
                          allowClear
                        />
                      )}
                    </Form.Item>
                  </Col>
                ))}
                <Col xs={24} md={4}>
                  <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters} style={{ background: BRAND, borderColor: BRAND }}>
                    Filter
                  </Button>
                </Col>
              </Row>
            </Card>
            <DataTable
              loading={loading}
              rowKey={(r) => rowId(r, listCfg.idKey) || JSON.stringify(r)}
              dataSource={rows}
              columns={listColumns}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                onChange: (p, ps) => fetchList(p, ps),
              }}
              locale={{ emptyText: `No ${listCfg.title.toLowerCase()} found` }}
            />
          </Space>
        ) : activeDoc === 'invoices' ? (
          renderInvoiceEntry()
        ) : (
          renderGenericEntry()
        )}
      </Card>

      <Drawer
        title={`Document ${pathId || rowId(activeItem, listCfg.idKey) || ''}`}
        open={detailOpen}
        width={560}
        onClose={() => {
          setDetailOpen(false)
          navigate(`/ops/billing/${activeDoc}`)
        }}
      >
        {detailLoading ? (
          <Text type="secondary">Loading…</Text>
        ) : activeItem ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              {Object.entries(activeItem)
                .filter(([, v]) => v != null && v !== '')
                .slice(0, 20)
                .map(([k, v]) => (
                  <Descriptions.Item key={k} label={k}>
                    {k === 'inv_status' ? <StatusTag status={v} /> : String(v)}
                  </Descriptions.Item>
                ))}
            </Descriptions>
            {activeDoc === 'invoices' && String(activeItem.inv_status || '').toUpperCase() !== 'VOID' ? (
              <Space>
                {String(activeItem.inv_status || '').toUpperCase() !== 'PAY' ? (
                  <Button
                    type="primary"
                    loading={payBusyId === rowId(activeItem, 'inv_no')}
                    style={{ background: BRAND, borderColor: BRAND }}
                    onClick={() => onToggleInvoicePaid(activeItem, true)}
                  >
                    Mark as Paid
                  </Button>
                ) : (
                  <Button
                    loading={payBusyId === rowId(activeItem, 'inv_no')}
                    onClick={() => onToggleInvoicePaid(activeItem, false)}
                  >
                    Mark as Unpaid
                  </Button>
                )}
              </Space>
            ) : null}
            {detailLines.length ? (
              <Table
                size="small"
                pagination={false}
                rowKey={(_, i) => i}
                dataSource={detailLines}
                columns={Object.keys(detailLines[0] || {}).slice(0, 6).map((k) => ({
                  title: k,
                  dataIndex: k,
                  render: (v) => (typeof v === 'number' ? money(v) : String(v ?? '')),
                }))}
              />
            ) : null}
          </Space>
        ) : (
          <Text type="secondary">No detail</Text>
        )}
      </Drawer>

      <Modal
        title="Void document"
        open={voidModal.open}
        onCancel={() => setVoidModal({ open: false, item: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={voidForm} layout="vertical" onFinish={onVoid}>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Reason required' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button onClick={() => setVoidModal({ open: false, item: null })}>Cancel</Button>
            <Popconfirm title="Confirm void?" onConfirm={() => voidForm.submit()}>
              <Button danger type="primary" loading={voiding}>Void</Button>
            </Popconfirm>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
