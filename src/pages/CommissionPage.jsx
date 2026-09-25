import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  BankOutlined,
  CalculatorOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SettingOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import {
  accrueCommission,
  advanceCommissionWithdrawal,
  apiError,
  calculateCommission,
  getCommissionConfig,
  listCommissionWithdrawals,
  listCommissions,
  listPartnerWallets,
  previewCommission,
  requestCommissionWithdrawal,
  updateCommissionConfig,
  verifyCommission,
} from '../api/client'
import DataTable from '../components/DataTable'
import StatusTag from '../components/StatusTag'
import CodeLookupField from '../components/CodeLookupField'
import { money } from '../ui/bits'
import { useLocation, useNavigate, Link } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const BRAND = '#1B8A5A'

const FEE_MODES = [
  { code: 'air', label: 'Air' },
  { code: 'road', label: 'Land' },
  { code: 'sea', label: 'Sea' },
]

const FORMULA_TYPES = [
  { value: 'base_pcs_kg', label: 'Base + pcs + kg', hint: 'Fee = Base + (pcs × RM/pc) + (kg × RM/kg)' },
  { value: 'flat_then_per_kg', label: 'Flat then /kg', hint: 'Flat for first N kg, then RM/kg over (e.g. Labuan)' },
  { value: 'band_table', label: 'Weight band table', hint: 'Fixed RM per 0.5 kg band (+ optional over steps)' },
  { value: 'step_linear', label: 'Step / linear', hint: 'Early tiers + step amount every X kg (e.g. Sarawak)' },
  { value: 'size_pct', label: 'Size × %', hint: 'S/M/L/XL base × pct% (+ over kg) — remote Value Express' },
]

const MATRIX_MODES = [
  { code: '*', label: 'All modes' },
  ...FEE_MODES,
]

function defaultFormulaJson(type) {
  switch (type) {
    case 'flat_then_per_kg':
      return { flatAmount: 18, includedKg: 15, perKgOver: 1.5 }
    case 'band_table':
      return {
        bands: [
          { maxKg: 0.5, amount: 5.5 },
          { maxKg: 1.0, amount: 5.5 },
        ],
        overKg: 11,
        overStepKg: 0.5,
        overStepAmount: 4.5,
      }
    case 'step_linear':
      return {
        tiers: [
          { maxKg: 1.0, amount: 10.6 },
          { maxKg: 1.5, amount: 19.08 },
        ],
        stepFromKg: 1.5,
        stepKg: 0.5,
        stepAmount: 4.24,
        anchorAmount: 19.08,
        capKg: 11,
        overStepKg: 0.5,
        overStepAmount: 4.5,
      }
    case 'size_pct':
      return {
        sizes: { S: 25, M: 40, L: 55, XL: 70 },
        pct: 40,
        includedKg: 20,
        perKgOver: 2,
        defaultSize: 'M',
      }
    default:
      return {}
  }
}

function mergeFormulaParams(type, raw) {
  const base = defaultFormulaJson(type)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  if (type === 'base_pcs_kg') return {}
  if (type === 'size_pct') {
    return {
      ...base,
      ...raw,
      sizes: { ...base.sizes, ...(raw.sizes || {}) },
    }
  }
  if (type === 'band_table') {
    return {
      ...base,
      ...raw,
      bands: Array.isArray(raw.bands) && raw.bands.length ? raw.bands : base.bands,
    }
  }
  if (type === 'step_linear') {
    return {
      ...base,
      ...raw,
      tiers: Array.isArray(raw.tiers) && raw.tiers.length
        ? raw.tiers
        : (Array.isArray(raw.bands) && raw.bands.length ? raw.bands : base.tiers),
    }
  }
  return { ...base, ...raw }
}

function formulaTypeLabel(type) {
  return FORMULA_TYPES.find((t) => t.value === type)?.label || type || 'Base + pcs + kg'
}

function RmInput({ value, onChange, min = 0, step = 0.01, ...rest }) {
  return (
    <InputNumber
      min={min}
      step={step}
      style={{ width: '100%' }}
      value={value}
      onChange={(v) => onChange(v == null ? 0 : v)}
      {...rest}
    />
  )
}

function fieldValue(config, field) {
  if (!config) return ''
  if (field.type === 'bool') {
    return config[field.key] === true || config[field.key] === 1 || config[field.key] === '1'
  }
  const v = config[field.key]
  return v == null ? '' : v
}

function emptyFeeRow(overrides = {}) {
  return {
    id: 0,
    transportMode: 'road',
    rateCode: '',
    custAcNo: '',
    origin: '',
    destination: '',
    serviceType: '',
    pcsMin: 1,
    pcsMax: 999999,
    weightMin: 0,
    weightMax: 9999.9,
    baseAmount: 0,
    perPiece: 0,
    perKg: 0,
    formulaType: 'base_pcs_kg',
    formulaJson: {},
    description: '',
    isActive: false,
    sortOrder: 10,
    effDate: '',
    expryDt: '',
    commissionFeeBase: '',
    ...overrides,
  }
}

function emptyCustomerFeeRow() {
  return emptyFeeRow({
    rateCode: 'CUST',
    isActive: true,
    sortOrder: 20,
  })
}

function publicBandSummary(row) {
  const mode = FEE_MODES.find((m) => m.code === (row.transportMode || 'road'))?.label || row.transportMode || '—'
  const lane = [row.origin, row.destination].filter(Boolean).join(' → ') || 'Nationwide'
  const pcs = `${row.pcsMin ?? 1}–${row.pcsMax ?? 999999} pcs`
  const kg = `${row.weightMin ?? 0}–${row.weightMax ?? 9999.9} kg`
  return `${row.rateCode || '—'} · ${mode} · ${lane} · ${pcs} · ${kg}`
}

function clonePublicBandForCustomer(publicRow, custAcNo = '') {
  const copy = emptyCustomerFeeRow()
  const fields = [
    'transportMode', 'rateCode', 'origin', 'destination', 'serviceType',
    'pcsMin', 'pcsMax', 'weightMin', 'weightMax',
    'baseAmount', 'perPiece', 'perKg',
    'formulaType', 'description', 'isActive', 'sortOrder',
  ]
  for (const k of fields) {
    if (publicRow[k] != null && publicRow[k] !== '') {
      copy[k] = publicRow[k]
    }
  }
  copy.formulaJson = publicRow.formulaJson && typeof publicRow.formulaJson === 'object'
    ? JSON.parse(JSON.stringify(publicRow.formulaJson))
    : {}
  copy.custAcNo = (custAcNo || '').toUpperCase()
  copy.id = 0
  copy.effDate = ''
  copy.expryDt = ''
  copy.commissionFeeBase = ''
  const code = String(publicRow.rateCode || '').trim()
  copy.rateCode = code !== '' && !code.endsWith('-CUST') ? `${code}-CUST` : 'CUST'
  const baseDesc = String(publicRow.description || publicRow.rateCode || 'public band').trim()
  copy.description = baseDesc ? `Customer copy of ${baseDesc}` : 'Customer copy of public band'
  return copy
}

function roleLabel(code, catalog) {
  const hit = (catalog || []).find((r) => r.code === code)
  return hit?.label || code
}

function formatRate(r) {
  const code = String(r.lineCode || '')
  if (code.startsWith('PCT_')) {
    const n = Number(r.rate)
    return `${Number.isFinite(n) ? n : r.rate}%`
  }
  return money(r.rate)
}

function partnerTypeLabel(code) {
  const c = String(code || '')
  if (c.startsWith('DRV-')) return 'Driver'
  if (c.startsWith('DSP-')) return 'Dispatcher'
  if (c.startsWith('HUB-')) return 'Hub / linehaul'
  if (c.startsWith('DPT-')) return 'Delivery point'
  return 'Drop point'
}

function SaveFooter({ saving, onReset, label = 'Save settings' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
      <Button onClick={onReset} disabled={saving}>
        Reset changes
      </Button>
      <Button type="primary" htmlType="submit" loading={saving} style={{ background: BRAND, borderColor: BRAND }}>
        {saving ? 'Saving…' : label}
      </Button>
    </div>
  )
}

const COMMISSION_TABS = ['rates', 'calculator', 'ledger', 'wallets', 'withdrawals']

function tabFromLocation(pathname, search) {
  const seg = String(pathname || '').split('/').filter(Boolean).pop()
  if (COMMISSION_TABS.includes(seg)) return seg
  const q = new URLSearchParams(search || '').get('tab')
  if (COMMISSION_TABS.includes(q)) return q
  return 'rates'
}

export default function CommissionPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialTab = tabFromLocation(location.pathname, location.search)
  const [tab, setTab] = useState(initialTab)
  const [config, setConfig] = useState(null)
  const [draft, setDraft] = useState({})
  const [engineDraft, setEngineDraft] = useState({
    commissionEngine: 'legacy_rm',
    deliveryFeeEnabled: false,
    volumetricDivisor: 6000,
    slaPayee: 'dispatcher',
    commissionPctFeeBase: 'charged',
  })
  const [feeRates, setFeeRates] = useState([])
  const [customerFeeRates, setCustomerFeeRates] = useState([])
  const [pctMatrix, setPctMatrix] = useState([])
  const [slaTiers, setSlaTiers] = useState([])
  const [rateSection, setRateSection] = useState('engine')
  const [saving, setSaving] = useState(false)
  const [ledger, setLedger] = useState({ rows: [], total: 0 })
  const [wallets, setWallets] = useState({ rows: [] })
  const [withdrawals, setWithdrawals] = useState({ rows: [] })
  const [status, setStatus] = useState('PROCESSING')
  const [cn, setCn] = useState('')
  const [accrueCn, setAccrueCn] = useState('')
  const [withdrawForm, setWithdrawForm] = useState({ partnerCode: '', amount: '', note: '' })
  const [calcForm, setCalcForm] = useState({
    transportMode: 'road',
    pcs: '1',
    weight: '5',
    deliveryFee: '',
    custAcNo: '',
    origin: '',
    destination: '',
    packageSize: 'M',
    originService: 'DROP_COUNTER',
    outcome: 'doorstep',
    collectHours: '4',
    cnPreview: '',
  })
  const [calcResult, setCalcResult] = useState(null)
  const [calcCnLines, setCalcCnLines] = useState(null)
  const [calcBusy, setCalcBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formulaEditIdx, setFormulaEditIdx] = useState(null)
  const [formulaEditScope, setFormulaEditScope] = useState('public')
  const [formulaDraft, setFormulaDraft] = useState({ type: 'base_pcs_kg', params: {} })
  const [showFormulaAdvanced, setShowFormulaAdvanced] = useState(false)
  const [copyPublicOpen, setCopyPublicOpen] = useState(false)
  const [copyPublicKeys, setCopyPublicKeys] = useState([])
  const [copyPublicCustAcNo, setCopyPublicCustAcNo] = useState('')

  const roles = useMemo(() => config?.roles || [], [config])
  const franchiseeRoles = useMemo(() => config?.franchiseeRoles || [], [config])

  const navSections = useMemo(() => {
    const franchisee = [
      { id: 'engine', label: 'Engine', hint: 'RM vs %' },
      { id: 'delivery_fee', label: 'Public delivery fee', hint: 'Walk-in / default' },
      { id: 'customer_delivery_fee', label: 'Customer overrides', hint: 'Long-term accounts' },
      { id: 'pct_matrix', label: '% matrix', hint: 'Franchisee splits' },
      { id: 'sla', label: 'Collect SLA', hint: 'T1–T5' },
    ]
    const legacy = (roles || []).map((r) => ({
      id: r.id,
      label: r.label,
      hint: 'Legacy absolute RM',
      role: r,
    }))
    return [...franchisee, ...legacy]
  }, [roles])

  const activeLegacyRole = roles.find((r) => r.id === rateSection)

  function syncDraft(cfg) {
    const next = {}
    for (const role of cfg?.roles || []) {
      for (const field of role.fields || []) {
        next[field.key] = fieldValue(cfg, field)
      }
    }
    setDraft(next)
    setEngineDraft({
      commissionEngine: cfg?.commissionEngine === 'pct_matrix' ? 'pct_matrix' : 'legacy_rm',
      deliveryFeeEnabled: !!cfg?.deliveryFeeEnabled,
      volumetricDivisor: Number(cfg?.volumetricDivisor) > 0 ? Number(cfg.volumetricDivisor) : 6000,
      slaPayee: cfg?.slaPayee || 'dispatcher',
      commissionPctFeeBase: cfg?.commissionPctFeeBase === 'list' ? 'list' : 'charged',
    })
    setFeeRates(Array.isArray(cfg?.deliveryFeeRates) ? cfg.deliveryFeeRates.map((r) => ({ ...r })) : [])
    setCustomerFeeRates(Array.isArray(cfg?.customerDeliveryFeeRates) ? cfg.customerDeliveryFeeRates.map((r) => ({ ...r })) : [])
    setPctMatrix(Array.isArray(cfg?.pctMatrix) ? cfg.pctMatrix.map((r) => ({ ...r })) : [])
    setSlaTiers(Array.isArray(cfg?.slaTiers) ? cfg.slaTiers.map((r) => ({ ...r })) : [])
  }

  async function load() {
    setLoading(true)
    try {
      const cfg = await getCommissionConfig()
      setConfig(cfg)
      syncDraft(cfg)
      if (tab === 'ledger') {
        setLedger(await listCommissions({ status: status === 'ALL' ? '' : status, cn: cn || undefined }))
      } else if (tab === 'wallets') {
        setWallets(await listPartnerWallets())
      } else if (tab === 'withdrawals') {
        setWithdrawals(await listCommissionWithdrawals({ status: 'ALL' }))
      }
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const next = tabFromLocation(location.pathname, location.search)
    if (next !== tab) setTab(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status])

  function selectTab(next) {
    setTab(next)
    navigate(`/ops/commissions/${next}`, { replace: true })
  }

  /** Canvas walkthrough: ADDRESS_PICKUP + doorstep on RM 20 fee (illustrative 10%+10% stacking). */
  function applyWalkthroughPreset() {
    setCalcForm((f) => ({
      ...f,
      transportMode: 'road',
      pcs: '1',
      weight: '5',
      deliveryFee: '20',
      originService: 'ADDRESS_PICKUP',
      outcome: 'doorstep',
      collectHours: '4',
    }))
    setEngineDraft((d) => ({ ...d, commissionEngine: 'pct_matrix' }))
    setPctMatrix((rows) =>
      rows.map((row) => {
        const code = String(row.roleCode || '')
        const mode = String(row.transportMode || '*')
        if (mode !== '*' && mode !== 'road') return row
        if (['origin_drop', 'origin_dp', 'dest_drop', 'dest_dp'].includes(code)) {
          return { ...row, pct: 10, isActive: true }
        }
        return row
      }),
    )
    message.info('Loaded walkthrough: courier pickup + doorstep, fee RM 20, 10% origin/dest drop+DP (draft only).')
  }

  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function publicBandRowKey(row, idx) {
    return String(row.id || `pub-${idx}`)
  }

  function copySinglePublicBand(idx, custAcNo = '') {
    const row = feeRates[idx]
    if (!row) return
    setCustomerFeeRates((rows) => [...rows, clonePublicBandForCustomer(row, custAcNo)])
    setRateSection('customer_delivery_fee')
    message.success('Copied to Customer overrides — set the account and adjust pricing if needed.')
  }

  function applyCopyFromPublicBands() {
    if (!copyPublicKeys.length) {
      message.warning('Select at least one public band to copy.')
      return
    }
    const picked = feeRates.filter((r, i) => copyPublicKeys.includes(publicBandRowKey(r, i)))
    if (!picked.length) {
      message.warning('Selected bands are no longer available — refresh and try again.')
      return
    }
    const newRows = picked.map((r) => clonePublicBandForCustomer(r, copyPublicCustAcNo))
    setCustomerFeeRates((rows) => [...rows, ...newRows])
    setCopyPublicOpen(false)
    setCopyPublicKeys([])
    setCopyPublicCustAcNo('')
    message.success(`Added ${newRows.length} customer band(s). Adjust pricing and save.`)
  }

  function feeRowsForScope(scope) {
    return scope === 'customer' ? customerFeeRates : feeRates
  }

  function setFeeRowsForScope(scope, updater) {
    if (scope === 'customer') {
      setCustomerFeeRates(updater)
    } else {
      setFeeRates(updater)
    }
  }

  function updateFeeRow(idx, patch, scope = 'public') {
    setFeeRowsForScope(scope, (rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function openFormulaEditor(idx, scope = 'public') {
    const row = feeRowsForScope(scope)[idx] || emptyFeeRow(scope === 'customer' ? { custAcNo: '' } : {})
    setFormulaEditScope(scope)
    const type = row.formulaType || 'base_pcs_kg'
    const params = mergeFormulaParams(type, row.formulaJson)
    setFormulaEditIdx(idx)
    setShowFormulaAdvanced(false)
    setFormulaDraft({ type, params })
  }

  function patchFormulaParams(patch) {
    setFormulaDraft((d) => ({ ...d, params: { ...d.params, ...patch } }))
  }

  function setFormulaType(type) {
    setFormulaDraft({ type, params: mergeFormulaParams(type, defaultFormulaJson(type)) })
    setShowFormulaAdvanced(false)
  }

  function applyFormulaEditor() {
    if (formulaEditIdx == null) return
    const type = formulaDraft.type || 'base_pcs_kg'
    let params = type === 'base_pcs_kg' ? {} : mergeFormulaParams(type, formulaDraft.params)
    if (type === 'band_table') {
      const bands = (params.bands || [])
        .map((b) => ({ maxKg: Number(b.maxKg) || 0, amount: Number(b.amount) || 0 }))
        .filter((b) => b.maxKg > 0)
        .sort((a, b) => a.maxKg - b.maxKg)
      if (!bands.length) {
        message.error('Add at least one weight band (max kg + fee).')
        return
      }
      params = { ...params, bands }
    }
    if (type === 'step_linear') {
      const tiers = (params.tiers || [])
        .map((b) => ({ maxKg: Number(b.maxKg) || 0, amount: Number(b.amount) || 0 }))
        .filter((b) => b.maxKg > 0)
        .sort((a, b) => a.maxKg - b.maxKg)
      params = { ...params, tiers }
    }
    updateFeeRow(formulaEditIdx, {
      formulaType: type,
      formulaJson: params,
    }, formulaEditScope)
    setFormulaEditIdx(null)
  }

  function changeFormulaTypeOnRow(idx, type, scope = 'public') {
    const prev = feeRowsForScope(scope)[idx] || {}
    const keep = prev.formulaType === type && prev.formulaJson && Object.keys(prev.formulaJson || {}).length
      ? prev.formulaJson
      : defaultFormulaJson(type)
    updateFeeRow(idx, {
      formulaType: type,
      formulaJson: type === 'base_pcs_kg' ? {} : mergeFormulaParams(type, keep),
    }, scope)
  }

  function patchFeeFormulaJson(idx, patch, scope = 'public') {
    setFeeRowsForScope(scope, (rows) =>
      rows.map((r, i) => {
        if (i !== idx) return r
        const type = r.formulaType || 'base_pcs_kg'
        const current = mergeFormulaParams(type, r.formulaJson)
        return { ...r, formulaJson: { ...current, ...patch } }
      }),
    )
  }

  function formulaPriceSummary(row) {
    const type = row.formulaType || 'base_pcs_kg'
    const p = mergeFormulaParams(type, row.formulaJson)
    if (type === 'band_table') {
      const n = (p.bands || []).length
      const first = p.bands?.[0]
      return n
        ? `${n} bands · from RM ${Number(first?.amount || 0).toFixed(2)}`
        : 'No bands yet'
    }
    if (type === 'step_linear') {
      const n = (p.tiers || []).length
      return `${n} tier(s) · step RM ${Number(p.stepAmount || 0).toFixed(2)} / ${p.stepKg || 0.5} kg`
    }
    if (type === 'size_pct') {
      return `${p.pct || 0}% of size · default ${p.defaultSize || 'M'}`
    }
    return ''
  }

  function renderFeePriceSettings(row, idx, scope = 'public') {
    const type = row.formulaType || 'base_pcs_kg'
    const p = mergeFormulaParams(type, row.formulaJson)
    const mini = { size: 'small', style: { width: '100%' } }

    if (type === 'base_pcs_kg') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, minWidth: 240 }}>
          <div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Base RM</div>
            <InputNumber
              {...mini}
              step={0.01}
              value={row.baseAmount ?? 0}
              onChange={(v) => updateFeeRow(idx, { baseAmount: v }, scope)}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>RM / pc</div>
            <InputNumber
              {...mini}
              step={0.0001}
              value={row.perPiece ?? 0}
              onChange={(v) => updateFeeRow(idx, { perPiece: v }, scope)}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>RM / kg</div>
            <InputNumber
              {...mini}
              step={0.0001}
              value={row.perKg ?? 0}
              onChange={(v) => updateFeeRow(idx, { perKg: v }, scope)}
            />
          </div>
        </div>
      )
    }

    if (type === 'flat_then_per_kg') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, minWidth: 260 }}>
          <div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Flat fee RM</div>
            <InputNumber
              {...mini}
              step={0.01}
              value={p.flatAmount}
              onChange={(v) => patchFeeFormulaJson(idx, { flatAmount: v == null ? 0 : v }, scope)}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Included kg</div>
            <InputNumber
              {...mini}
              step={0.1}
              value={p.includedKg}
              onChange={(v) => patchFeeFormulaJson(idx, { includedKg: v == null ? 0 : v }, scope)}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Extra RM/kg</div>
            <InputNumber
              {...mini}
              step={0.01}
              value={p.perKgOver}
              onChange={(v) => patchFeeFormulaJson(idx, { perKgOver: v == null ? 0 : v }, scope)}
            />
          </div>
        </div>
      )
    }

    if (type === 'size_pct') {
      const sizes = p.sizes || {}
      return (
        <Space direction="vertical" size={6} style={{ width: '100%', minWidth: 280 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {['S', 'M', 'L', 'XL'].map((sz) => (
              <div key={sz}>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>{sz} RM</div>
                <InputNumber
                  {...mini}
                  step={0.01}
                  value={sizes[sz]}
                  onChange={(v) =>
                    patchFeeFormulaJson(idx, { sizes: { ...sizes, [sz]: v == null ? 0 : v } }, scope)
                  }
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>Charge %</div>
              <InputNumber
                {...mini}
                step={1}
                value={p.pct}
                onChange={(v) => patchFeeFormulaJson(idx, { pct: v == null ? 0 : v }, scope)}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>Default size</div>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={p.defaultSize || 'M'}
                onChange={(v) => patchFeeFormulaJson(idx, { defaultSize: v }, scope)}
                options={['S', 'M', 'L', 'XL'].map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>Over RM/kg</div>
              <InputNumber
                {...mini}
                step={0.01}
                value={p.perKgOver}
                onChange={(v) => patchFeeFormulaJson(idx, { perKgOver: v == null ? 0 : v }, scope)}
              />
            </div>
          </div>
        </Space>
      )
    }

    return (
      <Space direction="vertical" size={4} style={{ width: '100%', minWidth: 220 }}>
        <Text style={{ fontSize: 12 }}>{formulaPriceSummary(row)}</Text>
        <Button size="small" type="primary" ghost style={{ borderColor: BRAND, color: BRAND }} onClick={() => openFormulaEditor(idx, scope)}>
          {type === 'band_table' ? 'Edit weight bands…' : 'Edit tiers & steps…'}
        </Button>
      </Space>
    )
  }

  function renderFormulaParamsForm() {
    const type = formulaDraft.type
    const p = formulaDraft.params || {}
    const hint = FORMULA_TYPES.find((t) => t.value === type)?.hint

    if (type === 'base_pcs_kg') {
      return (
        <Alert
          type="info"
          showIcon
          message="Use the Base, RM/pc, and RM/kg columns on the rate row."
          description="No extra parameters needed for this formula."
        />
      )
    }

    if (type === 'flat_then_per_kg') {
      return (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message={hint} />
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item label="Flat fee (RM)" extra="Charge for the first included kg">
                <RmInput value={p.flatAmount} onChange={(v) => patchFormulaParams({ flatAmount: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Included weight (kg)" extra="Weight covered by the flat fee">
                <RmInput value={p.includedKg} step={0.1} onChange={(v) => patchFormulaParams({ includedKg: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Extra per kg (RM)" extra="Only for weight above included">
                <RmInput value={p.perKgOver} step={0.01} onChange={(v) => patchFormulaParams({ perKgOver: v })} />
              </Form.Item>
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Example: flat RM {Number(p.flatAmount || 0).toFixed(2)} for first {p.includedKg || 0} kg,
            then +RM {Number(p.perKgOver || 0).toFixed(2)}/kg over.
          </Text>
        </>
      )
    }

    if (type === 'band_table') {
      const bands = Array.isArray(p.bands) ? p.bands : []
      return (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message={hint} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>Weight bands</Text>
            <Button
              size="small"
              type="dashed"
              onClick={() => {
                const last = bands[bands.length - 1]
                const nextMax = last ? Number(last.maxKg || 0) + 0.5 : 0.5
                patchFormulaParams({
                  bands: [...bands, { maxKg: nextMax, amount: Number(last?.amount || 0) }],
                })
              }}
            >
              Add band
            </Button>
          </div>
          <Table
            size="small"
            pagination={false}
            rowKey={(_, i) => `band-${i}`}
            dataSource={bands}
            locale={{ emptyText: 'No bands yet — click Add band.' }}
            columns={[
              {
                title: 'Up to (kg)',
                width: 140,
                render: (_, row, i) => (
                  <RmInput
                    value={row.maxKg}
                    step={0.1}
                    onChange={(v) => {
                      const next = bands.map((b, idx) => (idx === i ? { ...b, maxKg: v } : b))
                      patchFormulaParams({ bands: next })
                    }}
                  />
                ),
              },
              {
                title: 'Fee (RM)',
                width: 140,
                render: (_, row, i) => (
                  <RmInput
                    value={row.amount}
                    onChange={(v) => {
                      const next = bands.map((b, idx) => (idx === i ? { ...b, amount: v } : b))
                      patchFormulaParams({ bands: next })
                    }}
                  />
                ),
              },
              {
                title: '',
                width: 70,
                render: (_, __, i) => (
                  <Button
                    size="small"
                    danger
                    type="link"
                    disabled={bands.length <= 1}
                    onClick={() => patchFormulaParams({ bands: bands.filter((_, idx) => idx !== i) })}
                  >
                    Remove
                  </Button>
                ),
              },
            ]}
          />
          <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 8, fontSize: 12 }}>
            Optional: charge extra after a weight threshold (e.g. over 11 kg).
          </Paragraph>
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item label="Over threshold (kg)">
                <RmInput value={p.overKg} step={0.1} onChange={(v) => patchFormulaParams({ overKg: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Step size (kg)">
                <RmInput value={p.overStepKg} step={0.1} onChange={(v) => patchFormulaParams({ overStepKg: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="RM per step">
                <RmInput value={p.overStepAmount} onChange={(v) => patchFormulaParams({ overStepAmount: v })} />
              </Form.Item>
            </Col>
          </Row>
        </>
      )
    }

    if (type === 'step_linear') {
      const tiers = Array.isArray(p.tiers) ? p.tiers : []
      return (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message={hint} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>Early flat tiers</Text>
            <Button
              size="small"
              type="dashed"
              onClick={() => {
                const last = tiers[tiers.length - 1]
                const nextMax = last ? Number(last.maxKg || 0) + 0.5 : 1
                patchFormulaParams({
                  tiers: [...tiers, { maxKg: nextMax, amount: Number(last?.amount || 0) }],
                })
              }}
            >
              Add tier
            </Button>
          </div>
          <Table
            size="small"
            pagination={false}
            rowKey={(_, i) => `tier-${i}`}
            dataSource={tiers}
            columns={[
              {
                title: 'Up to (kg)',
                width: 140,
                render: (_, row, i) => (
                  <RmInput
                    value={row.maxKg}
                    step={0.1}
                    onChange={(v) => {
                      const next = tiers.map((b, idx) => (idx === i ? { ...b, maxKg: v } : b))
                      patchFormulaParams({ tiers: next })
                    }}
                  />
                ),
              },
              {
                title: 'Fee (RM)',
                width: 140,
                render: (_, row, i) => (
                  <RmInput
                    value={row.amount}
                    onChange={(v) => {
                      const next = tiers.map((b, idx) => (idx === i ? { ...b, amount: v } : b))
                      patchFormulaParams({ tiers: next })
                    }}
                  />
                ),
              },
              {
                title: '',
                width: 70,
                render: (_, __, i) => (
                  <Button
                    size="small"
                    danger
                    type="link"
                    onClick={() => patchFormulaParams({ tiers: tiers.filter((_, idx) => idx !== i) })}
                  >
                    Remove
                  </Button>
                ),
              },
            ]}
          />
          <Paragraph strong style={{ marginTop: 12, marginBottom: 8 }}>After early tiers</Paragraph>
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item label="Step from (kg)" extra="Weight where stepping starts">
                <RmInput value={p.stepFromKg} step={0.1} onChange={(v) => patchFormulaParams({ stepFromKg: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Every (kg)">
                <RmInput value={p.stepKg} step={0.1} onChange={(v) => patchFormulaParams({ stepKg: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="RM per step">
                <RmInput value={p.stepAmount} onChange={(v) => patchFormulaParams({ stepAmount: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Anchor fee (RM)" extra="Fee at step-from weight">
                <RmInput value={p.anchorAmount} onChange={(v) => patchFormulaParams({ anchorAmount: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Cap (kg)" extra="After this, use over-cap rate">
                <RmInput value={p.capKg} step={0.1} onChange={(v) => patchFormulaParams({ capKg: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Over-cap step (kg)">
                <RmInput value={p.overStepKg} step={0.1} onChange={(v) => patchFormulaParams({ overStepKg: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Over-cap RM / step">
                <RmInput value={p.overStepAmount} onChange={(v) => patchFormulaParams({ overStepAmount: v })} />
              </Form.Item>
            </Col>
          </Row>
        </>
      )
    }

    if (type === 'size_pct') {
      const sizes = p.sizes || {}
      return (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message={hint} />
          <Paragraph strong style={{ marginBottom: 8 }}>Size base rates (RM)</Paragraph>
          <Row gutter={12}>
            {['S', 'M', 'L', 'XL'].map((sz) => (
              <Col xs={12} sm={6} key={sz}>
                <Form.Item label={`Size ${sz}`}>
                  <RmInput
                    value={sizes[sz]}
                    onChange={(v) => patchFormulaParams({ sizes: { ...sizes, [sz]: v } })}
                  />
                </Form.Item>
              </Col>
            ))}
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item label="Charge % of size base" extra="e.g. 40 for Value Express">
                <RmInput value={p.pct} step={1} onChange={(v) => patchFormulaParams({ pct: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Default size">
                <Select
                  value={p.defaultSize || 'M'}
                  onChange={(v) => patchFormulaParams({ defaultSize: v })}
                  options={['S', 'M', 'L', 'XL'].map((s) => ({ value: s, label: s }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Included weight (kg)">
                <RmInput value={p.includedKg} step={0.1} onChange={(v) => patchFormulaParams({ includedKg: v })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Extra per kg over (RM)">
                <RmInput value={p.perKgOver} onChange={(v) => patchFormulaParams({ perKgOver: v })} />
              </Form.Item>
            </Col>
          </Row>
        </>
      )
    }

    return null
  }

  function updateMatrixRow(idx, patch) {
    setPctMatrix((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function updateSlaRow(idx, patch) {
    setSlaTiers((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  async function onSaveRates() {
    setSaving(true)
    try {
      const payload = {
        commissionEngine: engineDraft.commissionEngine,
        deliveryFeeEnabled: !!engineDraft.deliveryFeeEnabled,
        volumetricDivisor: Number(engineDraft.volumetricDivisor) || 6000,
        slaPayee: engineDraft.slaPayee,
        commissionPctFeeBase: engineDraft.commissionPctFeeBase,
        deliveryFeeRates: feeRates,
        customerDeliveryFeeRates: customerFeeRates,
        pctMatrix,
        slaTiers,
      }
      for (const role of roles) {
        for (const field of role.fields || []) {
          let v = draft[field.key]
          if (field.type === 'bool') v = !!v
          payload[field.key] = v
        }
      }
      const r = await updateCommissionConfig(payload)
      setConfig(r.config || r)
      syncDraft(r.config || r)
      message.success('Settings saved. New quotes / accruals use these values (existing ledger lines unchanged).')
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onVerify(id) {
    try {
      await verifyCommission(id)
      message.success('Commission verified and released to wallet.')
      load()
    } catch (e) {
      message.error(apiError(e))
    }
  }

  async function onAccrue() {
    if (!accrueCn.trim()) return
    try {
      const r = await accrueCommission(accrueCn.trim().toUpperCase())
      message.success(r.skipped ? `Skipped: ${r.reason}` : `Commission accrued for ${r.cnNo}`)
      setAccrueCn('')
      load()
    } catch (err) {
      message.error(apiError(err))
    }
  }

  async function onWithdraw() {
    try {
      await requestCommissionWithdrawal(withdrawForm.partnerCode, {
        amount: withdrawForm.amount,
        note: withdrawForm.note,
      })
      message.success('Withdrawal requested.')
      setWithdrawForm({ partnerCode: '', amount: '', note: '' })
      load()
    } catch (err) {
      message.error(apiError(err))
    }
  }

  async function onAdvance(id, action) {
    try {
      await advanceCommissionWithdrawal(id, action)
      message.success(`Withdrawal ${action}.`)
      load()
    } catch (e) {
      message.error(apiError(e))
    }
  }

  async function onCalculate() {
    setCalcBusy(true)
    setCalcCnLines(null)
    try {
      const payload = {
        transportMode: calcForm.transportMode,
        cn_pcs: Number(calcForm.pcs) || 1,
        cn_wt: Number(calcForm.weight) || 0,
        origin: calcForm.origin || undefined,
        destination: calcForm.destination || undefined,
        packageSize: calcForm.packageSize || undefined,
        originService: calcForm.originService,
        outcome: calcForm.outcome,
        collectHours: calcForm.outcome === 'collect' ? Number(calcForm.collectHours) || 0 : undefined,
        commissionEngine: engineDraft.commissionEngine,
        deliveryFeeEnabled: engineDraft.deliveryFeeEnabled,
        slaPayee: engineDraft.slaPayee,
        commissionPctFeeBase: engineDraft.commissionPctFeeBase,
        deliveryFeeRates: feeRates,
        customerDeliveryFeeRates: customerFeeRates,
        pctMatrix,
        slaTiers,
        ...draft,
      }
      if (calcForm.custAcNo.trim()) {
        payload.custAcNo = calcForm.custAcNo.trim().toUpperCase()
      }
      if (calcForm.deliveryFee !== '' && calcForm.deliveryFee != null) {
        payload.deliveryFee = Number(calcForm.deliveryFee)
      }
      const r = await calculateCommission(payload)
      setCalcResult(r)
      message.success('Calculator updated (preview only — nothing posted).')
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setCalcBusy(false)
    }
  }

  async function onPreviewCn() {
    if (!calcForm.cnPreview.trim()) return
    setCalcBusy(true)
    try {
      const r = await previewCommission(calcForm.cnPreview.trim().toUpperCase())
      setCalcCnLines(r.lines || [])
      message.success(`CN preview loaded for ${calcForm.cnPreview.trim().toUpperCase()}`)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setCalcBusy(false)
    }
  }

  const rows = ledger.rows || []
  const walletRows = wallets.rows || []
  const wdRows = withdrawals.rows || []
  const usingPct = engineDraft.commissionEngine === 'pct_matrix'

  function buildFeeColumns(scope) {
    const isCustomer = scope === 'customer'
    const cols = [
    {
      title: 'On',
      width: 50,
      render: (_, row, idx) => (
        <Checkbox checked={!!row.isActive} onChange={(e) => updateFeeRow(idx, { isActive: e.target.checked }, scope)} />
      ),
    },
    ...(isCustomer ? [{
      title: 'Customer',
      width: 160,
      render: (_, row, idx) => (
        <CodeLookupField
          kind="customers"
          size="small"
          allowCustom
          allowClear
          showGenerate={false}
          placeholder="Account no."
          value={row.custAcNo || ''}
          onChange={(v) => updateFeeRow(idx, { custAcNo: (v || '').toUpperCase() }, scope)}
        />
      ),
    },
    {
      title: 'Valid',
      width: 200,
      render: (_, row, idx) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Input
            size="small"
            placeholder="From YYYY-MM-DD"
            value={row.effDate || ''}
            onChange={(e) => updateFeeRow(idx, { effDate: e.target.value }, scope)}
          />
          <Input
            size="small"
            placeholder="Until YYYY-MM-DD"
            value={row.expryDt || ''}
            onChange={(e) => updateFeeRow(idx, { expryDt: e.target.value }, scope)}
          />
        </Space>
      ),
    },
    {
      title: '% base',
      width: 130,
      render: (_, row, idx) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={row.commissionFeeBase || ''}
          onChange={(v) => updateFeeRow(idx, { commissionFeeBase: v || '' }, scope)}
          options={[
            { value: '', label: 'Global default' },
            { value: 'charged', label: 'Charged fee' },
            { value: 'list', label: 'Public list' },
          ]}
        />
      ),
    }] : []),
    {
      title: 'Mode',
      width: 100,
      render: (_, row, idx) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={row.transportMode || 'road'}
          onChange={(v) => updateFeeRow(idx, { transportMode: v }, scope)}
          options={FEE_MODES.map((m) => ({ value: m.code, label: m.label }))}
        />
      ),
    },
    {
      title: 'Code',
      width: 100,
      render: (_, row, idx) => (
        <Input
          size="small"
          value={row.rateCode || ''}
          placeholder="CODE"
          onChange={(e) => updateFeeRow(idx, { rateCode: e.target.value.toUpperCase() }, scope)}
        />
      ),
    },
    {
      title: (
        <span>
          Pcs range
          <div style={{ fontWeight: 400, color: '#8c8c8c', fontSize: 11 }}>min – max</div>
        </span>
      ),
      width: 160,
      render: (_, row, idx) => (
        <Space size={4}>
          <InputNumber
            size="small"
            style={{ width: 64 }}
            value={row.pcsMin ?? 0}
            onChange={(v) => updateFeeRow(idx, { pcsMin: v }, scope)}
          />
          <Text type="secondary">–</Text>
          <InputNumber
            size="small"
            style={{ width: 72 }}
            value={row.pcsMax ?? 999999}
            onChange={(v) => updateFeeRow(idx, { pcsMax: v }, scope)}
          />
        </Space>
      ),
    },
    {
      title: (
        <span>
          Kg range
          <div style={{ fontWeight: 400, color: '#8c8c8c', fontSize: 11 }}>min – max</div>
        </span>
      ),
      width: 160,
      render: (_, row, idx) => (
        <Space size={4}>
          <InputNumber
            size="small"
            step={0.01}
            style={{ width: 64 }}
            value={row.weightMin ?? 0}
            onChange={(v) => updateFeeRow(idx, { weightMin: v }, scope)}
          />
          <Text type="secondary">–</Text>
          <InputNumber
            size="small"
            step={0.01}
            style={{ width: 72 }}
            value={row.weightMax ?? 9999.9}
            onChange={(v) => updateFeeRow(idx, { weightMax: v }, scope)}
          />
        </Space>
      ),
    },
    {
      title: (
        <span>
          Formula
          <div style={{ fontWeight: 400, color: '#8c8c8c', fontSize: 11 }}>changes price fields</div>
        </span>
      ),
      width: 160,
      render: (_, row, idx) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={row.formulaType || 'base_pcs_kg'}
          onChange={(v) => changeFormulaTypeOnRow(idx, v, scope)}
          options={FORMULA_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
      ),
    },
    {
      title: (
        <span>
          Price settings
          <div style={{ fontWeight: 400, color: '#8c8c8c', fontSize: 11 }}>follows formula type</div>
        </span>
      ),
      width: 320,
      render: (_, row, idx) => renderFeePriceSettings(row, idx, scope),
    },
    {
      title: 'Lane / note',
      width: 280,
      render: (_, row, idx) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Input
            size="small"
            placeholder="Description"
            value={row.description || ''}
            onChange={(e) => updateFeeRow(idx, { description: e.target.value }, scope)}
          />
          <Space size={4} style={{ width: '100%' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CodeLookupField
                kind="hubs"
              size="small"
                allowCustom
                allowClear
                showGenerate={false}
                showManageLink={false}
                placeholder="Origin hub"
              value={row.origin || ''}
                onChange={(v) => updateFeeRow(idx, { origin: v }, scope)}
            />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CodeLookupField
                kind="hubs"
              size="small"
                allowCustom
                allowClear
                showGenerate={false}
                showManageLink={false}
                placeholder="Dest hub"
              value={row.destination || ''}
                onChange={(v) => updateFeeRow(idx, { destination: v }, scope)}
            />
            </div>
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Blank = nationwide. <Link to="/ops/admin/hubs">Manage hubs</Link>
          </Text>
        </Space>
      ),
    },
    ...(scope === 'public' ? [{
      title: 'Copy',
      width: 88,
      fixed: 'right',
      render: (_, row, idx) => (
        <Button
          size="small"
          type="link"
          style={{ padding: 0, color: BRAND, whiteSpace: 'nowrap' }}
          onClick={() => copySinglePublicBand(idx)}
        >
          → Customer
        </Button>
      ),
    }] : []),
  ]
    return cols
  }

  const feeColumns = buildFeeColumns('public')
  const customerFeeColumns = buildFeeColumns('customer')

  const matrixColumns = [
    {
      title: 'On',
      width: 50,
      render: (_, row, idx) => (
        <Checkbox checked={!!row.enabled} onChange={(e) => updateMatrixRow(idx, { enabled: e.target.checked })} />
      ),
    },
    {
      title: 'Mode',
      width: 120,
      render: (_, row, idx) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={row.transportMode || '*'}
          onChange={(v) => updateMatrixRow(idx, { transportMode: v })}
          options={MATRIX_MODES.map((m) => ({ value: m.code, label: m.label }))}
        />
      ),
    },
    {
      title: 'Role',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{roleLabel(row.roleCode, franchiseeRoles)}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.roleCode}</Text>
        </div>
      ),
    },
    {
      title: '%',
      width: 130,
      render: (_, row, idx) => (
        <InputNumber
          size="small"
          min={0}
          step={0.0001}
          addonAfter="%"
          style={{ width: '100%' }}
          value={row.pct ?? 0}
          onChange={(v) => updateMatrixRow(idx, { pct: v })}
        />
      ),
    },
    {
      title: 'Note',
      render: (_, row, idx) => (
        <Input
          size="small"
          value={row.description || ''}
          onChange={(e) => updateMatrixRow(idx, { description: e.target.value })}
        />
      ),
    },
  ]

  const slaColumns = [
    {
      title: 'On',
      width: 50,
      render: (_, row, idx) => (
        <Checkbox checked={!!row.enabled} onChange={(e) => updateSlaRow(idx, { enabled: e.target.checked })} />
      ),
    },
    {
      title: 'Tier',
      width: 80,
      render: (_, row) => <Text strong>{row.tierCode}</Text>,
    },
    {
      title: 'Label',
      render: (_, row, idx) => (
        <Input
          size="small"
          value={row.label || ''}
          onChange={(e) => updateSlaRow(idx, { label: e.target.value })}
        />
      ),
    },
    {
      title: 'Max hours',
      width: 130,
      render: (_, row, idx) => (
        <InputNumber
          size="small"
          min={0}
          addonAfter="h"
          style={{ width: '100%' }}
          value={row.maxHours ?? 0}
          onChange={(v) => updateSlaRow(idx, { maxHours: v })}
        />
      ),
    },
    {
      title: '%',
      width: 130,
      render: (_, row, idx) => (
        <InputNumber
          size="small"
          min={0}
          step={0.0001}
          addonAfter="%"
          style={{ width: '100%' }}
          value={row.pct ?? 0}
          onChange={(v) => updateSlaRow(idx, { pct: v })}
        />
      ),
    },
  ]

  const ledgerColumns = [
    {
      title: 'CN',
      dataIndex: 'cnNo',
      key: 'cnNo',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: BRAND }}>{v}</span>
      ),
    },
    {
      title: 'Partner',
      key: 'partner',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.partnerCode}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{partnerTypeLabel(r.partnerCode)}</Text>
        </div>
      ),
    },
    {
      title: 'Line',
      key: 'line',
      render: (_, r) => (
        <div>
          <div>{r.lineDesc}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.lineCode}</Text>
        </div>
      ),
    },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 70 },
    { title: 'Rate', key: 'rate', render: (_, r) => formatRate(r) },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v) => <strong style={{ color: '#0F1B2D' }}>{money(v)}</strong>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <StatusTag status={v} />,
    },
    {
      title: '',
      key: 'action',
      align: 'right',
      render: (_, r) =>
        r.status === 'PROCESSING' ? (
          <Button
            size="small"
            type="primary"
            style={{ background: BRAND, borderColor: BRAND }}
            onClick={() => onVerify(r.id)}
          >
            Verify
          </Button>
        ) : null,
    },
  ]

  const walletColumns = [
    {
      title: 'Partner',
      dataIndex: 'partnerCode',
      key: 'partnerCode',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Type',
      key: 'type',
      render: (_, w) => w.partnerType || partnerTypeLabel(w.partnerCode),
    },
    {
      title: 'Available',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (v) => <strong style={{ color: BRAND }}>{money(v)}</strong>,
    },
    {
      title: 'Pending',
      dataIndex: 'pendingBalance',
      key: 'pendingBalance',
      align: 'right',
      render: (v) => money(v),
    },
  ]

  const withdrawalColumns = [
    { title: 'Request', dataIndex: 'requestNo', key: 'requestNo' },
    { title: 'Partner', dataIndex: 'partnerCode', key: 'partnerCode' },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v) => money(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <StatusTag status={v} />,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, w) => (
        <Space size={4} wrap>
          {w.status === 'REQUESTED' && (
            <Button size="small" type="primary" style={{ background: BRAND, borderColor: BRAND }} onClick={() => onAdvance(w.id, 'approve')}>
              Approve
            </Button>
          )}
          {w.status === 'APPROVED' && (
            <Button size="small" onClick={() => onAdvance(w.id, 'paid')}>Paid</Button>
          )}
          {w.status === 'PAID' && (
            <Button size="small" type="primary" style={{ background: BRAND, borderColor: BRAND }} onClick={() => onAdvance(w.id, 'cleared')}>
              Cleared
            </Button>
          )}
          {['REQUESTED', 'APPROVED'].includes(w.status) && (
            <Button size="small" danger onClick={() => onAdvance(w.id, 'reject')}>Reject</Button>
          )}
        </Space>
      ),
    },
  ]

  const calcLineColumns = [
    {
      title: 'Role',
      key: 'role',
      render: (_, line) => line.roleLabel || line.roleCode,
    },
    {
      title: 'Paid to',
      key: 'paidTo',
      render: (_, line) => {
        if (line.paidTo === 'delivery_point') return <Tag color="blue">Delivery point</Tag>
        if (line.paidTo === 'drop_point') return <Tag>Drop point</Tag>
        if (line.paidTo === 'dispatcher') return <Tag color="cyan">Dispatcher</Tag>
        return <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Line',
      dataIndex: 'lineCode',
      key: 'lineCode',
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '%',
      dataIndex: 'pct',
      key: 'pct',
      align: 'right',
      render: (v) => (v == null ? '—' : `${v}%`),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v) => <strong>{money(v)}</strong>,
    },
  ]

  const cnPreviewColumns = [
    { title: 'Partner', dataIndex: 'partnerCode', key: 'partnerCode' },
    {
      title: 'Line',
      key: 'line',
      render: (_, line) => (
        <div>
          <div>{line.lineDesc}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{line.lineCode}</Text>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v) => money(v),
    },
  ]

  function renderRatesPanel() {
    return (
      <Form layout="vertical" onFinish={onSaveRates}>
        <Row gutter={[8, 12]}>
          <Col xs={24} md={5} lg={4} xl={3}>
            <Card size="small" styles={{ body: { padding: 8 } }} style={{ position: 'sticky', top: 16 }}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                {navSections.map((sec) => {
                  const active = rateSection === sec.id
                  return (
                    <Button
                      key={sec.id}
                      type={active ? 'primary' : 'text'}
                      block
                      style={{
                        textAlign: 'left',
                        height: 'auto',
                        padding: '6px 8px',
                        lineHeight: 1.25,
                        ...(active ? { background: BRAND, borderColor: BRAND } : {}),
                      }}
                      onClick={() => setRateSection(sec.id)}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{sec.label}</div>
                        <div style={{ fontSize: 10, opacity: active ? 0.85 : 0.65 }}>{sec.hint}</div>
                      </div>
                    </Button>
                  )
                })}
              </Space>
              <div style={{ marginTop: 10, padding: 8, background: '#fafafa', borderRadius: 6 }}>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 11 }}>Engine</Text>
                {usingPct ? (
                  <Tag color="success" style={{ margin: 0, fontSize: 11 }}>%</Tag>
                ) : (
                  <Tag style={{ margin: 0, fontSize: 11 }}>Legacy RM</Tag>
                )}
                <div style={{ marginTop: 6, fontSize: 11 }}>
                  Fee quote:{' '}
                  {engineDraft.deliveryFeeEnabled ? (
                    <Text style={{ color: BRAND }}>on</Text>
                  ) : (
                    <Text type="secondary">off</Text>
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
                  {config?.withdrawalWindowOpen ? 'WD open' : 'WD closed'}
                </Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={19} lg={20} xl={21} style={{ minWidth: 0 }}>
            {rateSection === 'engine' && (
              <Card size="small" title="Engine & switches">
                <Paragraph type="secondary" style={{ marginTop: 0 }}>
                  Keep legacy RM until the company confirms franchisee %. Then switch to the matrix.
                  Live seeds stay at <strong>0%</strong> until ops enter real shares — the calculator walkthrough can draft 10% for demos without saving.
                </Paragraph>
                <Form.Item label={<Text strong>Commission engine</Text>}>
                  <Radio.Group
                    value={engineDraft.commissionEngine}
                    onChange={(e) => setEngineDraft((d) => ({ ...d, commissionEngine: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Card size="small" style={{ borderColor: engineDraft.commissionEngine === 'legacy_rm' ? BRAND : undefined }}>
                        <Radio value="legacy_rm">
                          <Text strong>Legacy absolute RM</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>
                            Current hub-count / lorry / BP dwell / flat dispatcher rates (fallback).
                            Driver commission is not used (covered by linehaul / subline).
                          </Text></div>
                        </Radio>
                      </Card>
                      <Card size="small" style={{ borderColor: engineDraft.commissionEngine === 'pct_matrix' ? BRAND : undefined }}>
                        <Radio value="pct_matrix">
                          <Text strong>Franchisee % of delivery fee</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>
                            Mixed accrual by scan event using the % matrix and collect SLA.
                          </Text></div>
                        </Radio>
                      </Card>
                    </Space>
                  </Radio.Group>
                </Form.Item>
                <Form.Item>
                  <Space align="start">
                    <Switch
                      checked={!!engineDraft.deliveryFeeEnabled}
                      onChange={(checked) => setEngineDraft((d) => ({ ...d, deliveryFeeEnabled: checked }))}
                      style={engineDraft.deliveryFeeEnabled ? { background: BRAND } : undefined}
                    />
                    <div>
                      <Text strong>Quote customer delivery fee by transport mode</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Uses Air / Land / Sea bands from the Delivery fee table. When off, uses existing freight quote.
                        </Text>
                      </div>
                    </div>
                  </Space>
                </Form.Item>
                <Form.Item
                  label={<Text strong>Volumetric weight divisor</Text>}
                  extra="Chargeable kg = max(actual, (L×W×H cm) ÷ divisor). Common: 6000 (air), 5000, 4000."
                  style={{ maxWidth: 280 }}
                >
                  <InputNumber
                    min={1}
                    step={100}
                    style={{ width: '100%' }}
                    value={engineDraft.volumetricDivisor}
                    onChange={(v) => setEngineDraft((d) => ({ ...d, volumetricDivisor: v || 6000 }))}
                  />
                </Form.Item>
                <Form.Item
                  label={<Text strong>Collect SLA payee</Text>}
                  extra="Who receives the collect-SLA % when the customer picks up at the drop point."
                  style={{ maxWidth: 320 }}
                >
                  <Select
                    value={engineDraft.slaPayee}
                    onChange={(v) => setEngineDraft((d) => ({ ...d, slaPayee: v }))}
                    options={[
                      { value: 'dispatcher', label: 'Dispatcher' },
                      { value: 'dest_dp', label: 'Destination delivery node' },
                      { value: 'both', label: 'Both' },
                    ]}
                  />
                </Form.Item>
                {usingPct ? (
                  <Form.Item
                    label={<Text strong>Commission % calculated on</Text>}
                    extra="When a long-term customer pays a discounted fee, choose whether franchisee % uses their charged fee or the public list price."
                    style={{ maxWidth: 420 }}
                  >
                    <Select
                      value={engineDraft.commissionPctFeeBase}
                      onChange={(v) => setEngineDraft((d) => ({ ...d, commissionPctFeeBase: v }))}
                      options={[
                        { value: 'charged', label: 'Charged delivery fee (what customer pays)' },
                        { value: 'list', label: 'Public list price (before customer discount)' },
                      ]}
                    />
                  </Form.Item>
                ) : null}
                <SaveFooter saving={saving} onReset={() => syncDraft(config)} />
              </Card>
            )}

            {rateSection === 'delivery_fee' && (
              <Card
                size="small"
                title={
                  <div>
                    <div>Public delivery fee</div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      Default walk-in pricing (Air / Land / Sea). Long-term accounts use Customer overrides; unmatched bands fall back here.
                    </Text>
                  </div>
                }
                extra={
                  <Button size="small" type="primary" style={{ background: BRAND, borderColor: BRAND }} onClick={() => setFeeRates((rows) => [...rows, emptyFeeRow()])}>
                    Add band
                  </Button>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Price fields follow the formula"
                  description={
                    <div>
                      <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                        <li><strong>Base + pcs + kg</strong> — Base / RM per piece / RM per kg</li>
                        <li><strong>Flat then /kg</strong> — Flat fee, included kg, extra RM/kg</li>
                        <li><strong>Size × %</strong> — S/M/L/XL bases, charge %, over kg</li>
                        <li><strong>Band table / Step linear</strong> — summary in the row; edit full bands or tiers in the popup</li>
                      </ul>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Change <strong>Formula</strong> on a row and the <strong>Price settings</strong> column updates automatically.
                      </Text>
                    </div>
                  }
                />
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r, i) => r.id || `new-${i}`}
                  columns={feeColumns}
                  dataSource={feeRates}
                  scroll={{ x: 'max-content' }}
                  style={{ width: '100%' }}
                  locale={{ emptyText: 'No fee bands yet. Add a band for Air, Land, or Sea.' }}
                />
                <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
                  Tip: leave origin/dest blank for nationwide. Band/step formulas use <strong>Edit weight bands…</strong> /
                  <strong> Edit tiers & steps…</strong> for the full table.
                </Paragraph>
                <SaveFooter saving={saving} onReset={() => syncDraft(config)} />
              </Card>
            )}

            {rateSection === 'customer_delivery_fee' && (
              <Card
                size="small"
                title={
                  <div>
                    <div>Customer delivery fee overrides</div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      Private rate bands for long-term accounts. When no customer band matches, quoting falls back to Public delivery fee.
                    </Text>
                  </div>
                }
                extra={
                  <Space size={8} wrap>
                    <Button
                      size="small"
                      onClick={() => {
                        if (!feeRates.length) {
                          message.info('Add public delivery fee bands first, then copy them here.')
                          return
                        }
                        setCopyPublicKeys([])
                        setCopyPublicCustAcNo('')
                        setCopyPublicOpen(true)
                      }}
                    >
                      Copy from public band
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      style={{ background: BRAND, borderColor: BRAND }}
                      onClick={() => setCustomerFeeRates((rows) => [...rows, emptyCustomerFeeRow()])}
                    >
                      Add customer band
                    </Button>
                  </Space>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="How customer pricing works"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      <li>Each row needs a <strong>Customer account</strong> and the same band fields as public rates.</li>
                      <li>Optional <strong>Valid from / until</strong> dates limit when the band applies.</li>
                      <li><strong>% base</strong> overrides the global Engine setting for that row only (charged fee vs public list).</li>
                    </ul>
                  }
                />
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r, i) => r.id || `cust-${i}`}
                  columns={customerFeeColumns}
                  dataSource={customerFeeRates}
                  scroll={{ x: 'max-content' }}
                  style={{ width: '100%' }}
                  locale={{ emptyText: 'No customer overrides yet. Add a band for a long-term account.' }}
                />
                <SaveFooter saving={saving} onReset={() => syncDraft(config)} />
                <Modal
                  title="Copy public bands to customer overrides"
                  open={copyPublicOpen}
                  onCancel={() => {
                    setCopyPublicOpen(false)
                    setCopyPublicKeys([])
                    setCopyPublicCustAcNo('')
                  }}
                  onOk={applyCopyFromPublicBands}
                  okText="Add to customer overrides"
                  okButtonProps={{ style: { background: BRAND, borderColor: BRAND } }}
                  width={760}
                  destroyOnClose
                >
                  <Paragraph type="secondary" style={{ marginTop: 0 }}>
                    Pick one or more public bands to clone. Pricing, formula, and lane rules are copied — set the customer account and tweak amounts after.
                  </Paragraph>
                  <Form.Item label="Customer account (optional)" style={{ marginBottom: 12 }}>
                    <CodeLookupField
                      kind="customers"
                      allowCustom
                      allowClear
                      showGenerate={false}
                      placeholder="Apply to all copied bands"
                      value={copyPublicCustAcNo}
                      onChange={(v) => setCopyPublicCustAcNo((v || '').toUpperCase())}
                    />
                  </Form.Item>
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(r, i) => publicBandRowKey(r, i)}
                    dataSource={feeRates}
                    scroll={{ y: 320 }}
                    locale={{ emptyText: 'No public bands — set them up under Public delivery fee first.' }}
                    rowSelection={{
                      selectedRowKeys: copyPublicKeys,
                      onChange: (keys) => setCopyPublicKeys(keys.map(String)),
                    }}
                    columns={[
                      {
                        title: 'Band',
                        render: (_, row) => (
                          <div>
                            <div style={{ fontWeight: 600 }}>{row.rateCode || '—'}</div>
                            <Text type="secondary" style={{ fontSize: 11 }}>{publicBandSummary(row)}</Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Formula',
                        width: 140,
                        render: (_, row) => formulaTypeLabel(row.formulaType || 'base_pcs_kg'),
                      },
                      {
                        title: 'Pricing',
                        width: 200,
                        render: (_, row) => (
                          <Text style={{ fontSize: 12 }}>{formulaPriceSummary(row)}</Text>
                        ),
                      },
                      {
                        title: 'On',
                        width: 48,
                        render: (_, row) => (row.isActive ? <Tag color="success">Yes</Tag> : <Tag>Off</Tag>),
                      },
                    ]}
                  />
                </Modal>
              </Card>
            )}

            {(rateSection === 'delivery_fee' || rateSection === 'customer_delivery_fee') && (
              <Modal
                title="Edit formula parameters"
                open={formulaEditIdx != null}
                onCancel={() => setFormulaEditIdx(null)}
                onOk={applyFormulaEditor}
                okText="Apply"
                okButtonProps={{ style: { background: BRAND, borderColor: BRAND } }}
                width={720}
                destroyOnClose
                styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
              >
                <Form layout="vertical">
                  <Form.Item
                    label="Formula type"
                    extra={FORMULA_TYPES.find((t) => t.value === formulaDraft.type)?.hint}
                  >
                    <Select
                      value={formulaDraft.type}
                      onChange={setFormulaType}
                      options={FORMULA_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    />
                  </Form.Item>
                  {renderFormulaParamsForm()}
                  {formulaDraft.type !== 'base_pcs_kg' ? (
                    <div style={{ marginTop: 16 }}>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => setShowFormulaAdvanced((v) => !v)}
                      >
                        {showFormulaAdvanced ? 'Hide advanced JSON' : 'Show advanced JSON (IT only)'}
                      </Button>
                      {showFormulaAdvanced ? (
                        <Input.TextArea
                          rows={8}
                          style={{ marginTop: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
                          value={JSON.stringify(formulaDraft.params || {}, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value || '{}')
                              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                                setFormulaDraft((d) => ({ ...d, params: parsed }))
                              }
                            } catch {
                              /* keep typing until valid */
                            }
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </Form>
              </Modal>
            )}

            {rateSection === 'pct_matrix' && (
              <Card
                size="small"
                title={
                  <div>
                    <div>Franchisee % matrix</div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      Each enabled role earns this % of the CN delivery fee into its franchisee wallet.
                      Mode-specific rows override “All modes”.
                    </Text>
                  </div>
                }
              >
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r, i) => r.id || `${r.roleCode}-${i}`}
                  columns={matrixColumns}
                  dataSource={pctMatrix}
                  locale={{ emptyText: 'Matrix not loaded — run migration 045 / reload config.' }}
                />
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 12 }}
                  message="Drop vs delivery point stacking"
                  description={
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      <li>First mile <strong>drop at counter</strong>: origin drop % → origin drop point only</li>
                      <li>First mile <strong>courier pickup</strong>: origin DP own % + origin drop % both → origin delivery point</li>
                      <li>Last mile <strong>self-collect</strong>: dest drop % → dest drop; dest DP own % → dest delivery point</li>
                      <li>Last mile <strong>doorstep</strong>: dest DP own % + dest drop % both → dest delivery point</li>
                    </ul>
                  }
                />
                <SaveFooter saving={saving} onReset={() => syncDraft(config)} />
              </Card>
            )}

            {rateSection === 'sla' && (
              <Card
                size="small"
                title={
                  <div>
                    <div>Collect SLA (T1–T5)</div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      {config?.slaClockHint
                        || 'Clock: parcel arrives at drop point → customer collects. Shorter dwell = higher tier (T1 best).'}
                    </Text>
                  </div>
                }
              >
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r) => r.id || r.tierCode}
                  columns={slaColumns}
                  dataSource={slaTiers}
                  locale={{ emptyText: 'No SLA tiers loaded.' }}
                />
                <SaveFooter saving={saving} onReset={() => syncDraft(config)} />
              </Card>
            )}

            {activeLegacyRole ? (
              <Card
                size="small"
                title={
                  <div>
                    <div>{activeLegacyRole.label}</div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      {activeLegacyRole.hint}
                      {' · '}
                      <Text style={{ color: '#D97706' }}>Legacy RM fallback</Text>
                      {usingPct ? ' (inactive while % matrix engine is on)' : ''}
                    </Text>
                  </div>
                }
              >
                <Row gutter={[12, 12]}>
                  {(activeLegacyRole.fields || []).map((field) => (
                    <Col key={field.key} xs={24} md={field.type === 'bool' ? 24 : 12}>
                      {field.type === 'bool' ? (
                        <Space align="start">
                          <Switch
                            checked={!!draft[field.key]}
                            onChange={(checked) => setField(field.key, checked)}
                            style={draft[field.key] ? { background: BRAND } : undefined}
                          />
                          <div>
                            <Text strong>{field.label}</Text>
                            {field.hint ? <div><Text type="secondary" style={{ fontSize: 12 }}>{field.hint}</Text></div> : null}
                          </div>
                        </Space>
                      ) : (
                        <Form.Item
                          label={field.label}
                          extra={field.hint || undefined}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            min={0}
                            step={field.type === 'money' ? 0.01 : 1}
                            style={{ width: '100%' }}
                            value={draft[field.key] === '' || draft[field.key] == null ? undefined : Number(draft[field.key])}
                            onChange={(v) => setField(field.key, v)}
                            addonBefore={field.type === 'money' ? 'RM' : undefined}
                            addonAfter={field.type === 'int' && /day/i.test(field.label) ? 'days' : undefined}
                          />
                        </Form.Item>
                      )}
                    </Col>
                  ))}
                </Row>
                <SaveFooter saving={saving} onReset={() => syncDraft(config)} label="Save commission rates" />
                {activeLegacyRole.id === 'drop_point' ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 12 }}
                    message="Legacy BP dwell"
                    description="Warehouse nights T0–T5 (absolute RM). Separate from the new collect-SLA clock (hours until customer pickup)."
                  />
                ) : null}
              </Card>
            ) : null}

            {!['engine', 'delivery_fee', 'customer_delivery_fee', 'pct_matrix', 'sla'].includes(rateSection) && !activeLegacyRole ? (
              <Alert type="info" message="Loading rate settings…" showIcon />
            ) : null}
          </Col>
        </Row>
      </Form>
    )
  }

  function renderCalculator() {
    return (
      <Row gutter={12}>
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title="What-if calculator"
            style={{ marginBottom: 12 }}
            extra={
              <Button size="small" onClick={applyWalkthroughPreset}>
                Load RM 20 walkthrough
              </Button>
            }
          >
            <Paragraph type="secondary" style={{ marginTop: 0 }}>
              Uses your <strong>current Rate settings draft</strong> (even if not saved yet). Does not post to wallets.
              Matches the pre-merge split rules: engine, fee bands, % matrix, collect SLA, and drop/DP stacking.
            </Paragraph>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="% matrix accrual (by scan)"
              description={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Pickup → hub sort → linehaul → dest receive → POD/collect. Roles accrue when their event fires
                  (not all at once). Legacy RM still posts the full pack at POD / return.
                </Text>
              }
            />
            <Form layout="vertical" onFinish={onCalculate}>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item label="Transport mode">
                    <Select
                      value={calcForm.transportMode}
                      onChange={(v) => setCalcForm((f) => ({ ...f, transportMode: v }))}
                      options={FEE_MODES.map((m) => ({ value: m.code, label: m.label }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item label="Pieces">
                    <InputNumber
                      min={1}
                      style={{ width: '100%' }}
                      value={Number(calcForm.pcs) || 1}
                      onChange={(v) => setCalcForm((f) => ({ ...f, pcs: String(v ?? 1) }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item label="Weight (kg)">
                    <InputNumber
                      min={0}
                      step={0.01}
                      style={{ width: '100%' }}
                      value={Number(calcForm.weight) || 0}
                      onChange={(v) => setCalcForm((f) => ({ ...f, weight: String(v ?? 0) }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item label="Origin (lane)" extra="Blank matches nationwide bands only">
                    <CodeLookupField
                      kind="hubs"
                      allowCustom
                      allowClear
                      showGenerate={false}
                      showManageLink
                      placeholder="e.g. BKI"
                      value={calcForm.origin}
                      onChange={(v) => setCalcForm((f) => ({ ...f, origin: v }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item label="Destination (lane)">
                    <CodeLookupField
                      kind="hubs"
                      allowCustom
                      allowClear
                      showGenerate={false}
                      showManageLink={false}
                      placeholder="e.g. KCH"
                      value={calcForm.destination}
                      onChange={(v) => setCalcForm((f) => ({ ...f, destination: v }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item label="Package size" extra="Used by Size × % formula">
                    <Select
                      value={calcForm.packageSize}
                      onChange={(v) => setCalcForm((f) => ({ ...f, packageSize: v }))}
                      options={['S', 'M', 'L', 'XL'].map((s) => ({ value: s, label: s }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Customer account (optional)"
                    extra="Long-term account — uses Customer overrides first, then public bands."
                  >
                    <CodeLookupField
                      kind="customers"
                      allowCustom
                      allowClear
                      showGenerate={false}
                      placeholder="e.g. CUST001"
                      value={calcForm.custAcNo}
                      onChange={(v) => setCalcForm((f) => ({ ...f, custAcNo: (v || '').toUpperCase() }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    label="Delivery fee override (optional)"
                    extra="Blank = match active Air/Land/Sea band from Rate settings (if amounts are set)."
                  >
                    <InputNumber
                      min={0}
                      step={0.01}
                      prefix="RM"
                      style={{ width: '100%' }}
                      placeholder="Leave blank to use fee table"
                      value={calcForm.deliveryFee === '' ? undefined : Number(calcForm.deliveryFee)}
                      onChange={(v) => setCalcForm((f) => ({ ...f, deliveryFee: v == null ? '' : String(v) }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="First-mile (pickup type)">
                    <Select
                      value={calcForm.originService}
                      onChange={(v) => setCalcForm((f) => ({ ...f, originService: v }))}
                      options={[
                        { value: 'DROP_COUNTER', label: 'Drop at counter (drop point earns first-mile %)' },
                        { value: 'ADDRESS_PICKUP', label: 'Courier address pickup (first-mile % → delivery point)' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Delivery outcome">
                    <Select
                      value={calcForm.outcome}
                      onChange={(v) => setCalcForm((f) => ({ ...f, outcome: v }))}
                      options={[
                        { value: 'doorstep', label: 'Doorstep POD' },
                        { value: 'collect', label: 'Self-collect at drop point' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                {calcForm.outcome === 'collect' ? (
                  <Col xs={24} md={12}>
                    <Form.Item label="Collect dwell (hours)" extra="DP arrival → customer pickup (SLA tier).">
                      <InputNumber
                        min={0}
                        step={0.1}
                        style={{ width: '100%' }}
                        value={Number(calcForm.collectHours) || 0}
                        onChange={(v) => setCalcForm((f) => ({ ...f, collectHours: String(v ?? 0) }))}
                      />
                    </Form.Item>
                  </Col>
                ) : null}
              </Row>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                Engine in draft: <strong>{usingPct ? '% matrix' : 'Legacy RM'}</strong>
                {' · '}SLA payee: <strong>{engineDraft.slaPayee}</strong>
              </Text>
              <Button type="primary" htmlType="submit" loading={calcBusy} style={{ background: BRAND, borderColor: BRAND }}>
                Calculate split
              </Button>
            </Form>
          </Card>

          <Card size="small" title="Preview real CN (saved rates)">
            <Form layout="inline" onFinish={onPreviewCn} style={{ rowGap: 8 }}>
              <Form.Item label="Consignment no." style={{ flex: 1, marginBottom: 0 }}>
                <Input
                  value={calcForm.cnPreview}
                  placeholder="CN number"
                  onChange={(e) => setCalcForm((f) => ({ ...f, cnPreview: e.target.value.toUpperCase() }))}
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="default" htmlType="submit" loading={calcBusy}>Preview</Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={
              <Space>
                <span>Split result</span>
                {calcResult ? (
                  <Tag color={calcResult.engine === 'pct_matrix' ? 'success' : 'default'}>
                    {calcResult.engine === 'pct_matrix' ? '% matrix' : 'legacy RM'}
                  </Tag>
                ) : null}
              </Space>
            }
            extra={calcResult?.note ? <Text type="secondary" style={{ fontSize: 12 }}>{calcResult.note}</Text> : null}
          >
            {!calcResult ? (
              <Text type="secondary">Enter scenario details and click Calculate split.</Text>
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Row gutter={12}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ height: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Charged delivery fee</Text>
                      <div style={{ fontSize: 22, fontWeight: 600, color: BRAND }}>{money(calcResult.deliveryFee)}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{calcResult.feeLabel}</Text>
                      {calcResult.listDeliveryFee != null && calcResult.listDeliveryFee !== calcResult.deliveryFee ? (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                          Public list: {money(calcResult.listDeliveryFee)}
                        </Text>
                      ) : null}
                      {calcResult.commissionFeeBase ? (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                          % base: {calcResult.commissionFeeBase === 'list' ? 'public list' : 'charged fee'}
                          {calcResult.commissionBasisFee != null ? ` (${money(calcResult.commissionBasisFee)})` : ''}
                        </Text>
                      ) : null}
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ height: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Total commission</Text>
                      <div style={{ fontSize: 22, fontWeight: 600 }}>{money(calcResult.totalCommission)}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {calcResult.pieces} pcs · {calcResult.weight} kg · {calcResult.transportModeLabel}
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ height: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>IPOSB keep</Text>
                      <div style={{ fontSize: 22, fontWeight: 600 }}>
                        {calcResult.iposbKeep == null ? '—' : money(calcResult.iposbKeep)}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {calcResult.iposbKeep == null ? 'N/A on legacy RM' : 'Fee − franchisee total'}
                      </Text>
                    </Card>
                  </Col>
                </Row>

                {calcResult.feeBreakdown ? (
                  <Card size="small" title="Customer delivery fee calculation" style={{ background: '#fafafa' }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      {calcResult.feeBreakdown.rule}
                      {calcResult.feeBreakdown.formulaType
                        ? ` · ${formulaTypeLabel(calcResult.feeBreakdown.formulaType)}`
                        : ''}
                    </Text>
                    {calcResult.feeSource === 'override' ? (
                      <Text>Manual override = <strong>{money(calcResult.feeBreakdown.total)}</strong></Text>
                    ) : calcResult.feeBreakdown.matched ? (
                      <>
                        <Table
                          size="small"
                          pagination={false}
                          rowKey={(r, i) => r.code || r.part || `p-${i}`}
                          dataSource={
                            Array.isArray(calcResult.feeBreakdown.parts) && calcResult.feeBreakdown.parts.length
                              ? [
                                  ...calcResult.feeBreakdown.parts.map((p) => ({
                                    part: p.label || p.code,
                                    how: p.how,
                                    rm: p.amount,
                                  })),
                                  {
                                    part: 'Total delivery fee',
                                    how: calcResult.feeBreakdown.rateCode
                                      ? `Band ${calcResult.feeBreakdown.rateCode}`
                                      : (calcResult.feeLabel || 'Matched band'),
                                    rm: calcResult.feeBreakdown.total,
                                    strong: true,
                                  },
                                ]
                              : [
                            { part: 'Base', how: 'Flat starting charge', rm: calcResult.feeBreakdown.basePart },
                            {
                              part: 'Pieces',
                              how: `${calcResult.feeBreakdown.pieces} pcs × ${Number(calcResult.feeBreakdown.perPiece)} RM/pc`,
                              rm: calcResult.feeBreakdown.piecePart,
                            },
                            {
                              part: 'Weight',
                              how: `${calcResult.feeBreakdown.weight} kg × ${Number(calcResult.feeBreakdown.perKg)} RM/kg`,
                              rm: calcResult.feeBreakdown.kgPart,
                            },
                            {
                              part: 'Total delivery fee',
                              how: calcResult.feeBreakdown.rateCode
                                ? `Band ${calcResult.feeBreakdown.rateCode}`
                                : (calcResult.feeLabel || 'Matched band'),
                              rm: calcResult.feeBreakdown.total,
                              strong: true,
                            },
                                ]
                          }
                          columns={[
                            { title: 'Part', dataIndex: 'part', key: 'part', render: (v, r) => (r.strong ? <strong>{v}</strong> : v) },
                            { title: 'How calculated', dataIndex: 'how', key: 'how', render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
                            { title: 'RM', dataIndex: 'rm', key: 'rm', align: 'right', render: (v, r) => (r.strong ? <strong>{money(v)}</strong> : money(v)) },
                          ]}
                        />
                        <Text code style={{ fontSize: 12 }}>
                          {calcResult.feeBreakdown.formulaPlain || calcResult.feeBreakdown.formula}
                        </Text>
                      </>
                    ) : (
                      <Text type="secondary">
                        No matching active fee band. Enter a manual fee override, or activate a band on
                        Customer delivery fee and leave override blank.
                      </Text>
                    )}
                  </Card>
                ) : null}

                {calcResult.sla ? (
                  <Alert
                    type="info"
                    showIcon
                    message={
                      <span>
                        Collect SLA <strong>{calcResult.sla.tierCode}</strong>
                        {' '}(≤ {calcResult.sla.maxHours}h) → {calcResult.sla.pct}%
                        {calcResult.collectHours != null ? ` · dwell ${calcResult.collectHours}h` : ''}
                      </span>
                    }
                  />
                ) : null}

                {calcResult.originService === 'ADDRESS_PICKUP' ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={
                      <span>
                        Courier pickup: <strong>origin delivery point</strong> earns its own % plus origin drop %
                        (stacked, e.g. 10% + 10% = 20%).
                      </span>
                    }
                  />
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    message={
                      <span>
                        Drop at counter: <strong>origin drop point</strong> earns origin drop % only (origin DP own % not paid).
                      </span>
                    }
                  />
                )}

                {calcResult.outcome === 'doorstep' ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={
                      <span>
                        Doorstep: <strong>dest delivery point</strong> earns its own % plus dest drop % (stacked).
                      </span>
                    }
                  />
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    message={
                      <span>
                        Self-collect: <strong>dest drop</strong> earns dest drop %; <strong>dest delivery point</strong> still earns its own % (feeds the drop).
                      </span>
                    }
                  />
                )}

                <Table
                  size="small"
                  pagination={false}
                  rowKey={(line, i) => `${line.lineCode}-${i}`}
                  columns={calcLineColumns}
                  dataSource={calcResult.lines || []}
                  locale={{ emptyText: 'No commission lines — set % / RM rates or enter a delivery fee.' }}
                />
              </Space>
            )}
          </Card>

          {calcCnLines ? (
            <Card size="small" title="CN accrual preview (saved engine)" style={{ marginTop: 12 }}>
              <Table
                size="small"
                pagination={false}
                rowKey={(line, i) => line.id || i}
                columns={cnPreviewColumns}
                dataSource={calcCnLines}
                locale={{ emptyText: 'No lines for this CN' }}
              />
            </Card>
          ) : null}
        </Col>
      </Row>
    )
  }

  function renderLedger() {
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Card size="small">
          <Form
            layout="vertical"
            onFinish={() => load()}
          >
            <Row gutter={12} align="bottom">
              <Col xs={24} md={6}>
                <Form.Item label="Status" style={{ marginBottom: 0 }}>
                  <Select
                    value={status}
                    onChange={setStatus}
                    options={['PROCESSING', 'AVAILABLE', 'ALL'].map((s) => ({ value: s, label: s }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="CN filter" style={{ marginBottom: 0 }}>
                  <Input value={cn} onChange={(e) => setCn(e.target.value.toUpperCase())} allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button type="primary" htmlType="submit" style={{ background: BRAND, borderColor: BRAND }}>
                  Filter
                </Button>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card size="small">
          <Form layout="vertical" onFinish={onAccrue}>
            <Row gutter={12} align="bottom">
              <Col xs={24} md={8}>
                <Form.Item label="Manual accrue / catch-up (CN)" style={{ marginBottom: 0 }}>
                  <Input
                    value={accrueCn}
                    placeholder="CN number"
                    onChange={(e) => setAccrueCn(e.target.value.toUpperCase())}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button htmlType="submit">Accrue</Button>
              </Col>
            </Row>
          </Form>
        </Card>

        <DataTable
          columns={ledgerColumns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: 'No commission lines' }}
        />
      </Space>
    )
  }

  function renderWallets() {
    return (
      <DataTable
        columns={walletColumns}
        dataSource={walletRows}
        rowKey="partnerCode"
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: 'No wallets yet' }}
      />
    )
  }

  function renderWithdrawals() {
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Card size="small">
          <Form layout="vertical" onFinish={onWithdraw}>
            <Row gutter={12} align="bottom">
              <Col xs={24} md={6}>
                <Form.Item
                  label="Partner code"
                  required
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    required
                    value={withdrawForm.partnerCode}
                    placeholder="e.g. DRV-12 or DSP-3"
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, partnerCode: e.target.value.toUpperCase() })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item label="Amount" required style={{ marginBottom: 0 }}>
                  <InputNumber
                    min={0}
                    step={0.01}
                    style={{ width: '100%' }}
                    value={withdrawForm.amount === '' ? undefined : Number(withdrawForm.amount)}
                    onChange={(v) => setWithdrawForm({ ...withdrawForm, amount: v == null ? '' : String(v) })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Note" style={{ marginBottom: 0 }}>
                  <Input
                    value={withdrawForm.note}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, note: e.target.value })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button type="primary" htmlType="submit" style={{ background: BRAND, borderColor: BRAND }}>
                  Request
                </Button>
              </Col>
            </Row>
          </Form>
        </Card>

        <DataTable
          columns={withdrawalColumns}
          dataSource={wdRows}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: 'No withdrawals' }}
        />
      </Space>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
            Commission & Partner Wallets
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Configure customer delivery fees, franchisee % splits (with drop/DP stacking), collect SLA T1–T5,
            and legacy RM fallback rates. Use the calculator for what-if splits before saving.
          </Text>
          {tab !== 'rates' && tab !== 'calculator' ? (
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <Button size="small" type="primary" style={{ background: BRAND, borderColor: BRAND }} onClick={() => selectTab('rates')}>
                  Open rate settings (split config)
                </Button>
                <Button size="small" onClick={() => selectTab('calculator')}>
                  Open what-if calculator
                </Button>
              </Space>
            </div>
          ) : null}
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
      </div>

      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Tabs
          activeKey={tab}
          onChange={selectTab}
          items={[
            {
              key: 'rates',
              label: (
                <Space>
                  <SettingOutlined />
                  <span>Rate settings</span>
                </Space>
              ),
              children: renderRatesPanel(),
            },
            {
              key: 'calculator',
              label: (
                <Space>
                  <CalculatorOutlined />
                  <span>Calculator</span>
                </Space>
              ),
              children: renderCalculator(),
            },
            {
              key: 'ledger',
              label: (
                <Space>
                  <HistoryOutlined />
                  <span>Commission ledger</span>
                </Space>
              ),
              children: renderLedger(),
            },
            {
              key: 'wallets',
              label: (
                <Space>
                  <WalletOutlined />
                  <span>Partner wallets</span>
                </Space>
              ),
              children: renderWallets(),
            },
            {
              key: 'withdrawals',
              label: (
                <Space>
                  <BankOutlined />
                  <span>Withdrawals</span>
                </Space>
              ),
              children: renderWithdrawals(),
            },
          ]}
        />
      </Card>
    </div>
  )
}
