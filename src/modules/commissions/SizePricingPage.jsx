import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { apiError, getCommissionConfig, updateCommissionConfig } from '../../api/client'

const { Title, Text } = Typography

const BRAND = '#1B8A5A'

const MODES = [
  { code: 'air', label: 'Air', rateCode: 'SIZE-AIR' },
  { code: 'road', label: 'Land', rateCode: 'SIZE-ROAD' },
  { code: 'sea', label: 'Sea', rateCode: 'SIZE-SEA' },
]

const SIZE_SORT_ORDER = -100
const UNLIMITED_WEIGHT_MAX = 999999.99

let keySeq = 0
const nextKey = () => `t${Date.now()}_${keySeq++}`

function emptyPrices() {
  return Object.fromEntries(MODES.map((m) => [m.code, { amount: 0, perKgOver: 0 }]))
}

function templateTiers() {
  return [
    { key: nextKey(), code: 'S', label: 'Small', maxKg: 1, prices: emptyPrices() },
    { key: nextKey(), code: 'M', label: 'Medium', maxKg: 5, prices: emptyPrices() },
    { key: nextKey(), code: 'L', label: 'Large', maxKg: 15, prices: emptyPrices() },
    { key: nextKey(), code: 'XL', label: 'Extra large', maxKg: null, prices: emptyPrices() },
  ]
}

function isSizeRow(row, mode) {
  return (
    !String(row.custAcNo || '').trim() &&
    String(row.rateCode || '').toUpperCase() === mode.rateCode
  )
}

function normMode(m) {
  const v = String(m || '').toLowerCase()
  return v === 'land' ? 'road' : v
}

/** Merge the per-mode SIZE-* rate rows back into one shared tier table. */
function tiersFromRows(rowsByMode) {
  const order = []
  const byCode = {}
  MODES.forEach((m) => {
    const row = rowsByMode[m.code]
    const tiers = row?.formulaJson?.tiers
    if (!Array.isArray(tiers)) return
    tiers.forEach((t) => {
      const code = String(t.code || '').toUpperCase()
      if (!code) return
      if (!byCode[code]) {
        byCode[code] = {
          key: nextKey(),
          code,
          label: t.label || '',
          maxKg: t.maxKg == null ? null : Number(t.maxKg),
          prices: emptyPrices(),
        }
        order.push(code)
      }
      byCode[code].prices[m.code] = {
        amount: Number(t.amount || 0),
        perKgOver: Number(t.perKgOver || 0),
      }
    })
  })
  const list = order.map((c) => byCode[c])
  list.sort((a, b) => {
    if (a.maxKg == null) return 1
    if (b.maxKg == null) return -1
    return a.maxKg - b.maxKg
  })
  return list
}

function validateTiers(tiers) {
  const errors = []
  const warnings = []
  const seen = new Set()
  let prev = 0
  tiers.forEach((t, i) => {
    const n = i + 1
    const code = String(t.code || '').trim().toUpperCase()
    if (!code) errors.push(`Row ${n}: size code is required.`)
    else if (seen.has(code)) errors.push(`Row ${n}: size code "${code}" is used more than once.`)
    seen.add(code)
    if (t.maxKg == null) {
      if (i !== tiers.length - 1) errors.push(`Row ${n}: only the last size can be unlimited.`)
    } else {
      if (!(t.maxKg > 0)) errors.push(`Row ${n}: max weight must be above 0 kg.`)
      else if (t.maxKg <= prev) {
        errors.push(`Row ${n}: max weight ${t.maxKg} kg must be greater than the previous size (${prev} kg).`)
      }
      prev = Math.max(prev, Number(t.maxKg) || 0)
    }
  })
  if (tiers.length && tiers[tiers.length - 1].maxKg != null) {
    warnings.push(
      `No unlimited size: parcels above ${prev} kg will be charged at the last size's price.`,
    )
  }
  return { errors, warnings }
}

function kg(v) {
  return Number(Number(v || 0).toFixed(3)).toString()
}

/** Mirrors DeliveryFeeCalculator::calcSizeWeight on the API. */
function quoteSize(tiers, chargeBy, modeCode, pcs, weight) {
  if (!tiers.length) return null
  const perPiece = chargeBy === 'piece'
  const units = perPiece ? Math.max(1, pcs || 1) : 1
  const unitWeight = perPiece ? (weight || 0) / units : weight || 0
  let idx = tiers.findIndex((t) => t.maxKg == null || unitWeight <= Number(t.maxKg) + 1e-9)
  if (idx < 0) idx = tiers.length - 1
  const tier = tiers[idx]
  const lowerKg = idx > 0 ? Number(tiers[idx - 1].maxKg || 0) : 0
  const price = tier.prices?.[modeCode] || { amount: 0, perKgOver: 0 }
  const overKg = price.perKgOver > 0 ? Math.max(0, unitWeight - lowerKg) : 0
  const unitBase = Math.round(Number(price.amount || 0) * 100) / 100
  const unitOver = Math.round(overKg * Number(price.perKgOver || 0) * 100) / 100
  const basePart = Math.round(unitBase * units * 100) / 100
  const overPart = Math.round(unitOver * units * 100) / 100
  return {
    tier,
    lowerKg,
    units,
    unitWeight,
    overKg,
    basePart,
    overPart,
    total: Math.round((basePart + overPart) * 100) / 100,
  }
}

function rangeText(tiers, i) {
  const lower = i > 0 ? Number(tiers[i - 1].maxKg || 0) : 0
  const t = tiers[i]
  if (t.maxKg == null) return `Above ${kg(lower)} kg`
  return i === 0 ? `Up to ${kg(t.maxKg)} kg` : `${kg(lower)} – ${kg(t.maxKg)} kg`
}

export default function SizePricingPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState(null)
  const [tiers, setTiers] = useState([])
  const [chargeBy, setChargeBy] = useState('shipment')
  const [enabledModes, setEnabledModes] = useState({ air: false, road: false, sea: false })
  const [deliveryFeeEnabled, setDeliveryFeeEnabled] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [testWeight, setTestWeight] = useState(3)
  const [testPcs, setTestPcs] = useState(1)

  const sizeRows = useMemo(() => {
    const rows = config?.deliveryFeeRates || []
    return Object.fromEntries(MODES.map((m) => [m.code, rows.find((r) => isSizeRow(r, m)) || null]))
  }, [config])

  function applyConfig(cfg) {
    setConfig(cfg)
    const rows = cfg?.deliveryFeeRates || []
    const byMode = Object.fromEntries(MODES.map((m) => [m.code, rows.find((r) => isSizeRow(r, m)) || null]))
    const loaded = tiersFromRows(byMode)
    setTiers(loaded.length ? loaded : templateTiers())
    const firstRow = MODES.map((m) => byMode[m.code]).find(Boolean)
    setChargeBy(firstRow?.formulaJson?.chargeBy === 'piece' ? 'piece' : 'shipment')
    setEnabledModes(Object.fromEntries(MODES.map((m) => [m.code, Boolean(byMode[m.code]?.isActive)])))
    setDeliveryFeeEnabled(Boolean(cfg?.deliveryFeeEnabled))
    setDirty(false)
  }

  async function load() {
    setLoading(true)
    try {
      applyConfig(await getCommissionConfig())
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const { errors, warnings } = useMemo(() => validateTiers(tiers), [tiers])

  function patchTier(key, patch) {
    setTiers((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)))
    setDirty(true)
  }

  function patchPrice(key, modeCode, patch) {
    setTiers((list) =>
      list.map((t) =>
        t.key === key
          ? { ...t, prices: { ...t.prices, [modeCode]: { ...t.prices[modeCode], ...patch } } }
          : t,
      ),
    )
    setDirty(true)
  }

  function addTier() {
    setTiers((list) => {
      const bounded = list.filter((t) => t.maxKg != null)
      const lastMax = bounded.length ? Number(bounded[bounded.length - 1].maxKg) : 0
      const tier = {
        key: nextKey(),
        code: '',
        label: '',
        maxKg: Math.round((lastMax + 5) * 1000) / 1000,
        prices: emptyPrices(),
      }
      const unlimitedIdx = list.findIndex((t) => t.maxKg == null)
      if (unlimitedIdx < 0) return [...list, tier]
      return [...list.slice(0, unlimitedIdx), tier, ...list.slice(unlimitedIdx)]
    })
    setDirty(true)
  }

  function removeTier(key) {
    setTiers((list) => list.filter((t) => t.key !== key))
    setDirty(true)
  }

  function setUnlimited(key, on) {
    setTiers((list) => {
      const idx = list.findIndex((t) => t.key === key)
      if (idx < 0) return list
      if (!on) {
        const bounded = list.filter((t) => t.maxKg != null && t.key !== key)
        const lastMax = bounded.length ? Number(bounded[bounded.length - 1].maxKg) : 0
        return list.map((t) => (t.key === key ? { ...t, maxKg: lastMax + 5 } : t))
      }
      const others = list
        .filter((t) => t.key !== key)
        .map((t) => (t.maxKg == null ? { ...t, maxKg: 0 } : t))
      return [...others, { ...list[idx], maxKg: null }]
    })
    setDirty(true)
  }

  function sortByWeight() {
    setTiers((list) =>
      [...list].sort((a, b) => {
        if (a.maxKg == null) return 1
        if (b.maxKg == null) return -1
        return a.maxKg - b.maxKg
      }),
    )
    setDirty(true)
  }

  function useTemplate() {
    setTiers(templateTiers())
    setDirty(true)
  }

  async function save() {
    if (errors.length) {
      message.error('Fix the size table errors before saving')
      return
    }
    const formulaTiers = (modeCode) =>
      tiers.map((t) => ({
        code: String(t.code).trim().toUpperCase(),
        label: String(t.label || '').trim(),
        maxKg: t.maxKg == null ? null : Number(t.maxKg),
        amount: Number(t.prices[modeCode]?.amount || 0),
        perKgOver: Number(t.prices[modeCode]?.perKgOver || 0),
      }))
    const rows = MODES.filter((m) => enabledModes[m.code] || sizeRows[m.code]).map((m) => {
      const existing = sizeRows[m.code] || {}
      return {
        ...existing,
        id: existing.id || undefined,
        transportMode: m.code,
        rateCode: m.rateCode,
        custAcNo: '',
        origin: '',
        destination: '',
        serviceType: '',
        pcsMin: 0,
        pcsMax: 999999,
        weightMin: 0,
        weightMax: UNLIMITED_WEIGHT_MAX,
        baseAmount: 0,
        perPiece: 0,
        perKg: 0,
        formulaType: 'size_weight',
        formulaJson: { chargeBy, tiers: formulaTiers(m.code) },
        description: existing.description || `Size pricing (${m.label})`,
        isActive: Boolean(enabledModes[m.code]),
        sortOrder: SIZE_SORT_ORDER,
      }
    })
    const body = { deliveryFeeEnabled }
    if (rows.length) body.deliveryFeeRates = rows
    setSaving(true)
    try {
      const res = await updateCommissionConfig(body)
      message.success('Size pricing saved')
      if (res?.config) applyConfig(res.config)
      else await load()
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  const otherPublicRows = useMemo(() => {
    const rows = config?.deliveryFeeRates || []
    return Object.fromEntries(
      MODES.map((m) => [
        m.code,
        rows.filter(
          (r) =>
            r.isActive &&
            !isSizeRow(r, m) &&
            !String(r.custAcNo || '').trim() &&
            !String(r.origin || '').trim() &&
            !String(r.destination || '').trim() &&
            !String(r.serviceType || '').trim() &&
            normMode(r.transportMode) === m.code,
        ),
      ]),
    )
  }, [config])

  const priceInput = { size: 'small', min: 0, style: { width: '100%' } }

  const columns = [
    {
      title: '#',
      key: 'idx',
      width: 40,
      fixed: 'left',
      render: (_, __, i) => <Text type="secondary">{i + 1}</Text>,
    },
    {
      title: 'Size code',
      key: 'code',
      width: 100,
      fixed: 'left',
      render: (_, t) => (
        <Input
          size="small"
          value={t.code}
          maxLength={16}
          placeholder="e.g. S"
          onChange={(e) =>
            patchTier(t.key, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })
          }
        />
      ),
    },
    {
      title: 'Label',
      key: 'label',
      width: 150,
      render: (_, t) => (
        <Input
          size="small"
          value={t.label}
          maxLength={40}
          placeholder="e.g. Small"
          onChange={(e) => patchTier(t.key, { label: e.target.value })}
        />
      ),
    },
    {
      title: 'Max weight (kg)',
      key: 'maxKg',
      width: 170,
      render: (_, t) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {t.maxKg == null ? (
            <Tag color="purple" style={{ margin: 0 }}>
              Unlimited
            </Tag>
          ) : (
            <InputNumber
              {...priceInput}
              step={0.5}
              precision={3}
              value={t.maxKg}
              addonAfter="kg"
              onChange={(v) => patchTier(t.key, { maxKg: v == null ? 0 : v })}
            />
          )}
          <Checkbox
            checked={t.maxKg == null}
            onChange={(e) => setUnlimited(t.key, e.target.checked)}
            style={{ fontSize: 12 }}
          >
            No upper limit
          </Checkbox>
        </Space>
      ),
    },
    {
      title: 'Weight range',
      key: 'range',
      width: 130,
      render: (_, __, i) => <Text style={{ fontSize: 12 }}>{rangeText(tiers, i)}</Text>,
    },
    ...MODES.map((m) => ({
      title: (
        <Space size={6}>
          <span>{m.label}</span>
          {enabledModes[m.code] ? <Tag color="green">On</Tag> : <Tag>Off</Tag>}
        </Space>
      ),
      key: m.code,
      children: [
        {
          title: 'Price (RM)',
          key: `${m.code}-amount`,
          width: 110,
          render: (_, t) => (
            <InputNumber
              {...priceInput}
              step={0.5}
              precision={2}
              value={t.prices[m.code]?.amount}
              onChange={(v) => patchPrice(t.key, m.code, { amount: v == null ? 0 : v })}
            />
          ),
        },
        {
          title: (
            <Tooltip title="Optional. Added per kg above the start of this size's range. Use it on the unlimited size.">
              <span>+ RM/kg</span>
            </Tooltip>
          ),
          key: `${m.code}-over`,
          width: 100,
          render: (_, t) => (
            <InputNumber
              {...priceInput}
              step={0.1}
              precision={2}
              value={t.prices[m.code]?.perKgOver}
              onChange={(v) => patchPrice(t.key, m.code, { perKgOver: v == null ? 0 : v })}
            />
          ),
        },
      ],
    })),
    {
      title: '',
      key: 'actions',
      width: 50,
      fixed: 'right',
      render: (_, t) => (
        <Popconfirm title={`Remove size ${t.code || ''}?`} onConfirm={() => removeTier(t.key)}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const testResults = MODES.map((m) => ({
    mode: m,
    result: errors.length ? null : quoteSize(tiers, chargeBy, m.code, testPcs, testWeight),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link to="/ops/commissions/rates">
            <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0 }}>
              Rate settings
            </Button>
          </Link>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
            Size pricing
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Define parcel sizes by weight and set the customer delivery fee for each size per transport mode.
            The size is picked automatically from the chargeable weight.
          </Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Reload
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={save}
            loading={saving}
            disabled={!dirty || errors.length > 0}
            style={{ background: BRAND, borderColor: BRAND }}
          >
            Save
          </Button>
        </Space>
      </div>

      {!deliveryFeeEnabled ? (
        <Alert
          type="warning"
          showIcon
          message="Delivery-fee quoting is off"
          description={
            <Space wrap>
              <span>Live quotes use the public tariff until this is on, so size prices won't be charged.</span>
              <Switch
                checked={deliveryFeeEnabled}
                onChange={(v) => {
                  setDeliveryFeeEnabled(v)
                  setDirty(true)
                }}
                checkedChildren="On"
                unCheckedChildren="Off"
              />
              <Text type="secondary">(saved with this page)</Text>
            </Space>
          }
        />
      ) : null}

      <Card
        size="small"
        title="Where size pricing applies"
        styles={{ body: { padding: 16 } }}
      >
        <Row gutter={[16, 12]}>
          {MODES.map((m) => {
            const others = otherPublicRows[m.code] || []
            return (
              <Col xs={24} md={8} key={m.code}>
                <Card size="small" style={{ background: enabledModes[m.code] ? '#f6ffed' : '#fafafa' }}>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Text strong>{m.label}</Text>
                      <Switch
                        checked={enabledModes[m.code]}
                        onChange={(v) => {
                          setEnabledModes((s) => ({ ...s, [m.code]: v }))
                          setDirty(true)
                        }}
                        checkedChildren="Size pricing"
                        unCheckedChildren="Off"
                      />
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Rate code <Text code>{m.rateCode}</Text>
                      {sizeRows[m.code] ? '' : ' (created on save)'}
                    </Text>
                    {enabledModes[m.code] ? (
                      <Text style={{ fontSize: 12 }}>
                        Applies to every {m.label} lane. Customer overrides and {m.label} bands with an origin,
                        destination or service type set still take priority.
                        {others.length ? ` Takes over from: ${others.map((r) => r.rateCode).join(', ')}.` : ''}
                      </Text>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {m.label} keeps using the bands on Rate settings.
                      </Text>
                    )}
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      </Card>

      <Card
        size="small"
        title="Size table"
        extra={
          <Space wrap>
            <Button size="small" onClick={sortByWeight}>
              Sort by weight
            </Button>
            <Popconfirm title="Replace the table with S / M / L / XL starter sizes?" onConfirm={useTemplate}>
              <Button size="small">Starter sizes</Button>
            </Popconfirm>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<PlusOutlined />}
              onClick={addTier}
              style={{ borderColor: BRAND, color: BRAND }}
            >
              Add size
            </Button>
          </Space>
        }
        styles={{ body: { padding: 16 } }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Text strong>Size is based on</Text>
            <Radio.Group
              value={chargeBy}
              onChange={(e) => {
                setChargeBy(e.target.value)
                setDirty(true)
              }}
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'shipment', label: 'Whole shipment weight' },
                { value: 'piece', label: 'Weight per piece (price × pieces)' },
              ]}
            />
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Each size covers weights above the previous size's max, up to its own max. The chargeable weight
            (the higher of actual and volumetric) is used.
            {chargeBy === 'piece'
              ? ' With "per piece", the shipment weight is divided by the piece count, and the size price is charged for every piece.'
              : ''}
          </Text>

          {errors.length ? (
            <Alert
              type="error"
              showIcon
              message="Fix these before saving"
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              }
            />
          ) : null}
          {warnings.map((w) => (
            <Alert key={w} type="warning" showIcon message={w} />
          ))}

          <Table
            size="small"
            bordered
            rowKey="key"
            columns={columns}
            dataSource={tiers}
            pagination={false}
            loading={loading}
            scroll={{ x: 1250 }}
            locale={{ emptyText: <Empty description="No sizes yet. Add one or use the starter sizes." /> }}
          />
        </Space>
      </Card>

      <Card size="small" title="Test a parcel" styles={{ body: { padding: 16 } }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <span>Chargeable weight</span>
            <InputNumber min={0} step={0.5} value={testWeight} onChange={(v) => setTestWeight(v ?? 0)} addonAfter="kg" />
            <span>Pieces</span>
            <InputNumber min={1} step={1} value={testPcs} onChange={(v) => setTestPcs(v ?? 1)} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Uses the unsaved table above. Before SST and other surcharges.
            </Text>
          </Space>
          <Row gutter={[12, 12]}>
            {testResults.map(({ mode, result }) => (
              <Col xs={24} md={8} key={mode.code}>
                <Card size="small" title={mode.label} extra={enabledModes[mode.code] ? null : <Tag>Off</Tag>}>
                  {result ? (
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="Size">
                        <Tag color="blue">{result.tier.code || '?'}</Tag>
                        {result.tier.label}
                      </Descriptions.Item>
                      <Descriptions.Item label="Range">{rangeText(tiers, tiers.indexOf(result.tier))}</Descriptions.Item>
                      <Descriptions.Item label="Size price">
                        RM {result.basePart.toFixed(2)}
                        {result.units > 1 ? ` (${result.units} pcs)` : ''}
                      </Descriptions.Item>
                      {result.overPart > 0 ? (
                        <Descriptions.Item label={`Above ${kg(result.lowerKg)} kg`}>
                          {kg(result.overKg)} kg → RM {result.overPart.toFixed(2)}
                        </Descriptions.Item>
                      ) : null}
                      <Descriptions.Item label="Delivery fee">
                        <Text strong style={{ color: BRAND }}>
                          RM {result.total.toFixed(2)}
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>
                  ) : (
                    <Text type="secondary">Fix the size table to preview.</Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      </Card>
    </div>
  )
}
