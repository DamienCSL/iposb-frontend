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
import { money } from '../ui/bits'
import { useLocation, useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const BRAND = '#1B8A5A'

const FEE_MODES = [
  { code: 'air', label: 'Air' },
  { code: 'road', label: 'Land' },
  { code: 'sea', label: 'Sea' },
]

const MATRIX_MODES = [
  { code: '*', label: 'All modes' },
  ...FEE_MODES,
]

function fieldValue(config, field) {
  if (!config) return ''
  if (field.type === 'bool') {
    return config[field.key] === true || config[field.key] === 1 || config[field.key] === '1'
  }
  const v = config[field.key]
  return v == null ? '' : v
}

function emptyFeeRow() {
  return {
    id: 0,
    transportMode: 'road',
    rateCode: '',
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
    description: '',
    isActive: false,
    sortOrder: 10,
  }
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
    slaPayee: 'dispatcher',
  })
  const [feeRates, setFeeRates] = useState([])
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
    originService: 'DROP_COUNTER',
    outcome: 'doorstep',
    collectHours: '4',
    cnPreview: '',
  })
  const [calcResult, setCalcResult] = useState(null)
  const [calcCnLines, setCalcCnLines] = useState(null)
  const [calcBusy, setCalcBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  const roles = useMemo(() => config?.roles || [], [config])
  const franchiseeRoles = useMemo(() => config?.franchiseeRoles || [], [config])

  const navSections = useMemo(() => {
    const franchisee = [
      { id: 'engine', label: 'Engine & switches', hint: 'legacy RM vs % matrix' },
      { id: 'delivery_fee', label: 'Customer delivery fee', hint: 'Air / Land / Sea tariffs' },
      { id: 'pct_matrix', label: 'Franchisee % matrix', hint: '% of delivery fee' },
      { id: 'sla', label: 'Collect SLA T1–T5', hint: 'DP arrival → customer collect' },
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
      slaPayee: cfg?.slaPayee || 'dispatcher',
    })
    setFeeRates(Array.isArray(cfg?.deliveryFeeRates) ? cfg.deliveryFeeRates.map((r) => ({ ...r })) : [])
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

  function updateFeeRow(idx, patch) {
    setFeeRates((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
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
        slaPayee: engineDraft.slaPayee,
        deliveryFeeRates: feeRates,
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
        originService: calcForm.originService,
        outcome: calcForm.outcome,
        collectHours: calcForm.outcome === 'collect' ? Number(calcForm.collectHours) || 0 : undefined,
        commissionEngine: engineDraft.commissionEngine,
        deliveryFeeEnabled: engineDraft.deliveryFeeEnabled,
        slaPayee: engineDraft.slaPayee,
        deliveryFeeRates: feeRates,
        pctMatrix,
        slaTiers,
        ...draft,
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

  const feeColumns = [
    {
      title: 'On',
      width: 50,
      render: (_, row, idx) => (
        <Checkbox checked={!!row.isActive} onChange={(e) => updateFeeRow(idx, { isActive: e.target.checked })} />
      ),
    },
    {
      title: 'Mode',
      width: 100,
      render: (_, row, idx) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={row.transportMode || 'road'}
          onChange={(v) => updateFeeRow(idx, { transportMode: v })}
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
          onChange={(e) => updateFeeRow(idx, { rateCode: e.target.value.toUpperCase() })}
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
            onChange={(v) => updateFeeRow(idx, { pcsMin: v })}
          />
          <Text type="secondary">–</Text>
          <InputNumber
            size="small"
            style={{ width: 72 }}
            value={row.pcsMax ?? 999999}
            onChange={(v) => updateFeeRow(idx, { pcsMax: v })}
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
            onChange={(v) => updateFeeRow(idx, { weightMin: v })}
          />
          <Text type="secondary">–</Text>
          <InputNumber
            size="small"
            step={0.01}
            style={{ width: 72 }}
            value={row.weightMax ?? 9999.9}
            onChange={(v) => updateFeeRow(idx, { weightMax: v })}
          />
        </Space>
      ),
    },
    {
      title: (
        <span>
          Base
          <div style={{ fontWeight: 400, color: '#8c8c8c', fontSize: 11 }}>flat RM</div>
        </span>
      ),
      width: 90,
      render: (_, row, idx) => (
        <InputNumber
          size="small"
          step={0.01}
          style={{ width: '100%' }}
          value={row.baseAmount ?? 0}
          onChange={(v) => updateFeeRow(idx, { baseAmount: v })}
        />
      ),
    },
    {
      title: (
        <span>
          RM/pc
          <div style={{ fontWeight: 400, color: '#8c8c8c', fontSize: 11 }}>per piece</div>
        </span>
      ),
      width: 90,
      render: (_, row, idx) => (
        <InputNumber
          size="small"
          step={0.0001}
          style={{ width: '100%' }}
          value={row.perPiece ?? 0}
          onChange={(v) => updateFeeRow(idx, { perPiece: v })}
        />
      ),
    },
    {
      title: (
        <span>
          RM/kg
          <div style={{ fontWeight: 400, color: '#8c8c8c', fontSize: 11 }}>per kg</div>
        </span>
      ),
      width: 90,
      render: (_, row, idx) => (
        <InputNumber
          size="small"
          step={0.0001}
          style={{ width: '100%' }}
          value={row.perKg ?? 0}
          onChange={(v) => updateFeeRow(idx, { perKg: v })}
        />
      ),
    },
    {
      title: 'Lane / note',
      render: (_, row, idx) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Input
            size="small"
            placeholder="Description"
            value={row.description || ''}
            onChange={(e) => updateFeeRow(idx, { description: e.target.value })}
          />
          <Space size={4} style={{ width: '100%' }}>
            <Input
              size="small"
              placeholder="Origin"
              value={row.origin || ''}
              onChange={(e) => updateFeeRow(idx, { origin: e.target.value.toUpperCase() })}
            />
            <Input
              size="small"
              placeholder="Dest"
              value={row.destination || ''}
              onChange={(e) => updateFeeRow(idx, { destination: e.target.value.toUpperCase() })}
            />
          </Space>
        </Space>
      ),
    },
  ]

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
        <Row gutter={12}>
          <Col xs={24} lg={6}>
            <Card size="small" style={{ position: 'sticky', top: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
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
                        padding: '8px 12px',
                        ...(active ? { background: BRAND, borderColor: BRAND } : {}),
                      }}
                      onClick={() => setRateSection(sec.id)}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{sec.label}</div>
                        <div style={{ fontSize: 11, opacity: active ? 0.85 : 0.65 }}>{sec.hint}</div>
                      </div>
                    </Button>
                  )
                })}
              </Space>
              <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Active engine</Text>
                {usingPct ? (
                  <Tag color="success">% of delivery fee</Tag>
                ) : (
                  <Tag>Legacy RM (fallback)</Tag>
                )}
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Delivery-fee quoting:{' '}
                  {engineDraft.deliveryFeeEnabled ? (
                    <Text style={{ color: BRAND }}>on</Text>
                  ) : (
                    <Text type="secondary">off</Text>
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {config?.withdrawalWindowOpen ? 'Withdrawal window open' : 'Withdrawal window closed'}
                </Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={18}>
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
                <SaveFooter saving={saving} onReset={() => syncDraft(config)} />
              </Card>
            )}

            {rateSection === 'delivery_fee' && (
              <Card
                size="small"
                title={
                  <div>
                    <div>Customer delivery fee</div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      Price the shipper pays (Air / Land / Sea). Activate bands and turn on quoting in Engine.
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
                  message="Pricing rule"
                  description={
                    <div>
                      <code>Fee = Base + (Pieces × RM/pc) + (Weight kg × RM/kg)</code>
                      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                        <li><strong>Pcs range</strong> — which piece counts this band covers</li>
                        <li><strong>Kg range</strong> — which weights this band covers</li>
                        <li><strong>Base</strong> — flat starting charge (RM)</li>
                        <li><strong>RM/pc</strong> / <strong>RM/kg</strong> — per piece / per kg</li>
                      </ul>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Example: Base 10, RM/pc 2, RM/kg 1, CN = 3 pcs / 5 kg → 10 + (3×2) + (5×1) = <strong>RM 21</strong>
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
                  scroll={{ x: 1100 }}
                  locale={{ emptyText: 'No fee bands yet. Add a band for Air, Land, or Sea.' }}
                />
                <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
                  Tip: Air often uses <strong>RM/pc</strong> only; Land uses <strong>RM/pc + RM/kg</strong>; Sea uses
                  <strong> RM/kg + RM/pc</strong>. Leave origin/dest blank for a nationwide band.
                </Paragraph>
                <SaveFooter saving={saving} onReset={() => syncDraft(config)} />
              </Card>
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

            {!['engine', 'delivery_fee', 'pct_matrix', 'sla'].includes(rateSection) && !activeLegacyRole ? (
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
                      <Text type="secondary" style={{ fontSize: 12 }}>Delivery fee</Text>
                      <div style={{ fontSize: 22, fontWeight: 600, color: BRAND }}>{money(calcResult.deliveryFee)}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{calcResult.feeLabel}</Text>
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
                    </Text>
                    {calcResult.feeSource === 'override' ? (
                      <Text>Manual override = <strong>{money(calcResult.feeBreakdown.total)}</strong></Text>
                    ) : calcResult.feeBreakdown.matched ? (
                      <>
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="part"
                          dataSource={[
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
                          ]}
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
