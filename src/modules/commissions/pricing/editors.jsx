import {
  Alert,
  Button,
  Checkbox,
  Col,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { MODES } from './pricingModel'

const { Text } = Typography

const BRAND = '#1B8A5A'

let keySeq = 0
const nextKey = () => `k${Date.now()}_${keySeq++}`

const num = (v, d = 0) => (v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v))
const kg = (v) => Number(num(v).toFixed(3)).toString()
const m3 = (v) => Number(num(v).toFixed(4)).toString()

function Field({ label, extra, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>{label}</div>
      {children}
      {extra ? <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{extra}</div> : null}
    </div>
  )
}

function Money({ value, onChange, step = 0.5, precision = 2, addon = 'RM', ...rest }) {
  return (
    <InputNumber
      min={0}
      step={step}
      precision={precision}
      value={value}
      onChange={(v) => onChange(v == null ? 0 : v)}
      addonBefore={addon === 'RM' ? 'RM' : undefined}
      addonAfter={addon !== 'RM' && addon ? addon : undefined}
      style={{ width: '100%' }}
      {...rest}
    />
  )
}

function Kg(props) {
  return <Money step={0.5} precision={3} addon="kg" {...props} />
}

function rangeText(rows, i) {
  const lower = i > 0 ? num(rows[i - 1].maxKg) : 0
  const t = rows[i]
  if (t.maxKg == null) return `Above ${kg(lower)} kg`
  return i === 0 ? `Up to ${kg(t.maxKg)} kg` : `${kg(lower)} – ${kg(t.maxKg)} kg`
}

function ascendingErrors(rows, label, mode) {
  const errors = []
  let prev = 0
  rows.forEach((r, i) => {
    const max = num(r.maxKg, -1)
    if (!(max > 0)) errors.push(`${mode}: ${label} ${i + 1} needs a max weight above 0 kg.`)
    else if (max <= prev) errors.push(`${mode}: ${label} ${i + 1} (${kg(max)} kg) must be heavier than the one before (${kg(prev)} kg).`)
    prev = Math.max(prev, max)
  })
  return errors
}

/** Editable list of { maxKg, amount } rows (weight bands, early tiers). */
function KgPriceTable({ rows, onChange, itemLabel }) {
  const patch = (key, p) => onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const add = () => {
    const last = rows.length ? num(rows[rows.length - 1].maxKg) : 0
    onChange([...rows, { key: nextKey(), maxKg: Math.round((last + 0.5) * 1000) / 1000, amount: 0 }])
  }
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Table
        size="small"
        bordered
        pagination={false}
        rowKey="key"
        dataSource={rows}
        locale={{ emptyText: `No ${itemLabel}s yet` }}
        columns={[
          { title: '#', width: 40, render: (_, __, i) => <Text type="secondary">{i + 1}</Text> },
          { title: 'Weight range', width: 140, render: (_, __, i) => <Text style={{ fontSize: 12 }}>{rangeText(rows, i)}</Text> },
          {
            title: 'Max weight',
            width: 160,
            render: (_, r) => <Kg size="small" value={r.maxKg} onChange={(v) => patch(r.key, { maxKg: v })} />,
          },
          {
            title: 'Price',
            width: 150,
            render: (_, r) => <Money size="small" value={r.amount} onChange={(v) => patch(r.key, { amount: v })} />,
          },
          {
            title: '',
            width: 44,
            render: (_, r) => (
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange(rows.filter((x) => x.key !== r.key))} />
            ),
          },
        ]}
      />
      <Button size="small" icon={<PlusOutlined />} onClick={add}>
        Add {itemLabel}
      </Button>
    </Space>
  )
}

const withKeys = (list) => (Array.isArray(list) ? list : []).map((r) => ({ key: nextKey(), maxKg: num(r.maxKg), amount: num(r.amount) }))
const stripKeys = (list) => list.map((r) => ({ maxKg: num(r.maxKg), amount: num(r.amount) }))

/**
 * Formula whose parameters are set independently per transport mode (shown as tabs).
 */
function perMode({ defaults, fromRow, toParams, validateParams, Form }) {
  return {
    fromRows(rowsByMode) {
      return Object.fromEntries(
        MODES.map((m) => [m.code, rowsByMode[m.code] ? fromRow(rowsByMode[m.code]) : defaults()]),
      )
    },
    paramsForMode: (draft, modeCode) => toParams(draft[modeCode] || defaults()),
    validate(draft, enabledModes) {
      const errors = []
      MODES.filter((m) => enabledModes[m.code]).forEach((m) => {
        errors.push(...validateParams(draft[m.code] || defaults(), m.label))
      })
      return { errors, warnings: [] }
    },
    Editor({ draft, setDraft, enabledModes, focusMode, onFocusMode }) {
      const update = (modeCode, patch) =>
        setDraft((d) => ({ ...d, [modeCode]: { ...(d[modeCode] || defaults()), ...patch } }))
      return (
        <Tabs
          activeKey={focusMode}
          onChange={onFocusMode}
          items={MODES.map((m) => ({
            key: m.code,
            label: (
              <Space size={6}>
                <span>{m.label}</span>
                {enabledModes[m.code] ? <Tag color="green">On</Tag> : <Tag>Off</Tag>}
              </Space>
            ),
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {!enabledModes[m.code] ? (
                  <Alert
                    type="info"
                    showIcon
                    message={`${m.label} is off for this formula. You can still prepare the prices; turn it on above to use them.`}
                  />
                ) : null}
                <Space wrap size={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Copy prices from</Text>
                  {MODES.filter((o) => o.code !== m.code).map((o) => (
                    <Button
                      key={o.code}
                      size="small"
                      onClick={() =>
                        setDraft((d) => ({ ...d, [m.code]: JSON.parse(JSON.stringify(d[o.code] || defaults())) }))
                      }
                    >
                      {o.label}
                    </Button>
                  ))}
                </Space>
                <Form params={draft[m.code] || defaults()} onChange={(p) => update(m.code, p)} />
              </Space>
            ),
          }))}
        />
      )
    },
  }
}

const baseEditor = perMode({
  defaults: () => ({ baseAmount: 0, perPiece: 0, perKg: 0 }),
  fromRow: (row) => ({ baseAmount: num(row.baseAmount), perPiece: num(row.perPiece), perKg: num(row.perKg) }),
  toParams: (p) => ({ baseAmount: num(p.baseAmount), perPiece: num(p.perPiece), perKg: num(p.perKg), formulaJson: {} }),
  validateParams: (p, mode) =>
    num(p.baseAmount) > 0 || num(p.perPiece) > 0 || num(p.perKg) > 0
      ? []
      : [`${mode}: set at least one of base, RM/pc or RM/kg.`],
  Form: ({ params: p, onChange }) => (
    <Row gutter={[16, 12]}>
      <Col xs={24} sm={8}>
        <Field label="Base fee" extra="Charged once per shipment">
          <Money value={p.baseAmount} onChange={(v) => onChange({ baseAmount: v })} />
        </Field>
      </Col>
      <Col xs={24} sm={8}>
        <Field label="Per piece" extra="× number of pieces">
          <Money value={p.perPiece} step={0.1} precision={4} onChange={(v) => onChange({ perPiece: v })} />
        </Field>
      </Col>
      <Col xs={24} sm={8}>
        <Field label="Per kg" extra="× chargeable weight">
          <Money value={p.perKg} step={0.1} precision={4} onChange={(v) => onChange({ perKg: v })} />
        </Field>
      </Col>
    </Row>
  ),
})

const stepEditor = perMode({
  defaults: () => ({
    tiers: withKeys([{ maxKg: 1, amount: 0 }]),
    stepFromKg: 1,
    stepKg: 0.5,
    stepAmount: 0,
    anchorAmount: 0,
    capKg: 0,
    overStepKg: 0.5,
    overStepAmount: 0,
  }),
  fromRow: (row) => {
    const j = row.formulaJson || {}
    return {
      tiers: withKeys(j.tiers || j.bands),
      stepFromKg: num(j.stepFromKg),
      stepKg: num(j.stepKg, 0.5),
      stepAmount: num(j.stepAmount),
      anchorAmount: num(j.anchorAmount),
      capKg: num(j.capKg),
      overStepKg: num(j.overStepKg, 0.5),
      overStepAmount: num(j.overStepAmount),
    }
  },
  toParams: (p) => ({
    formulaJson: {
      tiers: stripKeys(p.tiers || []),
      stepFromKg: num(p.stepFromKg),
      stepKg: num(p.stepKg, 0.5),
      stepAmount: num(p.stepAmount),
      anchorAmount: num(p.anchorAmount),
      capKg: num(p.capKg),
      overStepKg: num(p.overStepKg, 0.5),
      overStepAmount: num(p.overStepAmount),
    },
  }),
  validateParams: (p, mode) => {
    const errors = ascendingErrors(p.tiers || [], 'tier', mode)
    if (!(p.tiers || []).length && !(num(p.stepAmount) > 0)) {
      errors.push(`${mode}: add an early tier or a price per step.`)
    }
    return errors
  },
  Form: ({ params: p, onChange }) => (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Text strong>Early tiers (flat price)</Text>
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
          Light parcels pay the flat price of the first tier they fit in.
        </Text>
        <KgPriceTable rows={p.tiers || []} itemLabel="tier" onChange={(rows) => onChange({ tiers: rows })} />
      </div>
      <div>
        <Text strong>After the early tiers</Text>
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
          Fee = starting fee + price per step × number of steps above the "steps start at" weight.
        </Text>
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={6}>
            <Field label="Steps start at">
              <Kg value={p.stepFromKg} onChange={(v) => onChange({ stepFromKg: v })} />
            </Field>
          </Col>
          <Col xs={24} sm={6}>
            <Field label="Starting fee" extra="Fee at the start weight">
              <Money value={p.anchorAmount} onChange={(v) => onChange({ anchorAmount: v })} />
            </Field>
          </Col>
          <Col xs={24} sm={6}>
            <Field label="Step size">
              <Kg value={p.stepKg} onChange={(v) => onChange({ stepKg: v })} />
            </Field>
          </Col>
          <Col xs={24} sm={6}>
            <Field label="Price per step">
              <Money value={p.stepAmount} step={0.1} precision={4} onChange={(v) => onChange({ stepAmount: v })} />
            </Field>
          </Col>
        </Row>
      </div>
      <div>
        <Text strong>Cap (optional)</Text>
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
          Above the cap weight, normal steps stop and the over-cap step price applies instead.
        </Text>
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={8}>
            <Field label="Cap weight" extra="0 = no cap">
              <Kg value={p.capKg} onChange={(v) => onChange({ capKg: v })} />
            </Field>
          </Col>
          <Col xs={24} sm={8}>
            <Field label="Over-cap step size">
              <Kg value={p.overStepKg} onChange={(v) => onChange({ overStepKg: v })} />
            </Field>
          </Col>
          <Col xs={24} sm={8}>
            <Field label="Over-cap price per step">
              <Money value={p.overStepAmount} onChange={(v) => onChange({ overStepAmount: v })} />
            </Field>
          </Col>
        </Row>
      </div>
    </Space>
  ),
})

/* ── Size tiers (by weight): one shared size table, prices per mode ───────── */

function emptyPrices() {
  return Object.fromEntries(MODES.map((m) => [m.code, { amount: 0, perKgOver: 0 }]))
}

function starterSizes() {
  return [
    { key: nextKey(), code: 'S', label: 'Small', maxKg: 1, prices: emptyPrices() },
    { key: nextKey(), code: 'M', label: 'Medium', maxKg: 5, prices: emptyPrices() },
    { key: nextKey(), code: 'L', label: 'Large', maxKg: 15, prices: emptyPrices() },
    { key: nextKey(), code: 'XL', label: 'Extra large', maxKg: null, prices: emptyPrices() },
  ]
}

const byWeight = (a, b) => {
  if (a.maxKg == null) return 1
  if (b.maxKg == null) return -1
  return a.maxKg - b.maxKg
}

const sizeWeightEditor = {
  fromRows(rowsByMode) {
    const order = []
    const byCode = {}
    let chargeBy = 'shipment'
    MODES.forEach((m) => {
      const row = rowsByMode[m.code]
      if (!row) return
      if (row.formulaJson?.chargeBy === 'piece') chargeBy = 'piece'
      ;(row.formulaJson?.tiers || []).forEach((t) => {
        const code = String(t.code || '').toUpperCase()
        if (!code) return
        if (!byCode[code]) {
          byCode[code] = {
            key: nextKey(),
            code,
            label: t.label || '',
            maxKg: t.maxKg == null ? null : num(t.maxKg),
            flatUpToKg: t.flatUpToKg == null ? null : num(t.flatUpToKg),
            prices: emptyPrices(),
          }
          order.push(code)
        }
        byCode[code].prices[m.code] = { amount: num(t.amount), perKgOver: num(t.perKgOver) }
      })
    })
    const tiers = order.map((c) => byCode[c]).sort(byWeight)
    return { chargeBy, tiers: tiers.length ? tiers : starterSizes() }
  },
  paramsForMode: (draft, modeCode) => ({
    formulaJson: {
      chargeBy: draft.chargeBy,
      tiers: draft.tiers.map((t) => ({
        code: String(t.code).trim().toUpperCase(),
        label: String(t.label || '').trim(),
        maxKg: t.maxKg == null ? null : num(t.maxKg),
        flatUpToKg: t.flatUpToKg == null ? null : num(t.flatUpToKg),
        amount: num(t.prices[modeCode]?.amount),
        perKgOver: num(t.prices[modeCode]?.perKgOver),
      })),
    },
  }),
  validate(draft) {
    const errors = []
    const warnings = []
    const seen = new Set()
    let prev = 0
    const tiers = draft.tiers || []
    if (!tiers.length) errors.push('Add at least one size.')
    tiers.forEach((t, i) => {
      const n = i + 1
      const code = String(t.code || '').trim().toUpperCase()
      if (!code) errors.push(`Row ${n}: size code is required.`)
      else if (seen.has(code)) errors.push(`Row ${n}: size code "${code}" is used more than once.`)
      seen.add(code)
      if (t.flatUpToKg != null) {
        if (t.flatUpToKg <= prev) {
          errors.push(`Row ${n}: "flat covers up to" (${kg(t.flatUpToKg)} kg) must be above where this size starts (${kg(prev)} kg).`)
        } else if (t.maxKg != null && t.flatUpToKg > t.maxKg) {
          errors.push(`Row ${n}: "flat covers up to" (${kg(t.flatUpToKg)} kg) can't be above the size's max weight (${kg(t.maxKg)} kg).`)
        }
      }
      if (t.maxKg == null) {
        if (i !== tiers.length - 1) errors.push(`Row ${n}: only the last size can be unlimited.`)
      } else {
        if (!(t.maxKg > 0)) errors.push(`Row ${n}: max weight must be above 0 kg.`)
        else if (t.maxKg <= prev) errors.push(`Row ${n}: max weight ${kg(t.maxKg)} kg must be greater than the previous size (${kg(prev)} kg).`)
        prev = Math.max(prev, num(t.maxKg))
      }
    })
    if (tiers.length && tiers[tiers.length - 1].maxKg != null) {
      warnings.push(`No unlimited size: parcels above ${kg(prev)} kg will be charged at the last size's price.`)
    }
    return { errors, warnings }
  },
  Editor({ draft, setDraft, enabledModes }) {
    const tiers = draft.tiers || []
    const setTiers = (fn) => setDraft((d) => ({ ...d, tiers: fn(d.tiers || []) }))
    const patchTier = (key, patch) => setTiers((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)))
    const patchPrice = (key, modeCode, patch) =>
      setTiers((list) =>
        list.map((t) => (t.key === key ? { ...t, prices: { ...t.prices, [modeCode]: { ...t.prices[modeCode], ...patch } } } : t)),
      )
    const addTier = () =>
      setTiers((list) => {
        const bounded = list.filter((t) => t.maxKg != null)
        const lastMax = bounded.length ? num(bounded[bounded.length - 1].maxKg) : 0
        const tier = { key: nextKey(), code: '', label: '', maxKg: Math.round((lastMax + 5) * 1000) / 1000, prices: emptyPrices() }
        const u = list.findIndex((t) => t.maxKg == null)
        return u < 0 ? [...list, tier] : [...list.slice(0, u), tier, ...list.slice(u)]
      })
    const setUnlimited = (key, on) =>
      setTiers((list) => {
        const bounded = list.filter((t) => t.maxKg != null && t.key !== key)
        const lastMax = bounded.length ? num(bounded[bounded.length - 1].maxKg) : 0
        if (!on) return list.map((t) => (t.key === key ? { ...t, maxKg: lastMax + 5 } : t))
        const others = list.filter((t) => t.key !== key).map((t) => (t.maxKg == null ? { ...t, maxKg: lastMax + 5 } : t))
        return [...others, { ...list.find((t) => t.key === key), maxKg: null }]
      })
    const small = { size: 'small', min: 0, style: { width: '100%' } }

    const columns = [
      { title: '#', key: 'idx', width: 40, fixed: 'left', render: (_, __, i) => <Text type="secondary">{i + 1}</Text> },
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
            onChange={(e) => patchTier(t.key, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
          />
        ),
      },
      {
        title: 'Label',
        key: 'label',
        width: 140,
        render: (_, t) => (
          <Input size="small" value={t.label} maxLength={40} placeholder="e.g. Small" onChange={(e) => patchTier(t.key, { label: e.target.value })} />
        ),
      },
      {
        title: 'Max weight',
        key: 'maxKg',
        width: 160,
        render: (_, t) => (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {t.maxKg == null ? (
              <Tag color="purple" style={{ margin: 0 }}>Unlimited</Tag>
            ) : (
              <InputNumber {...small} step={0.5} precision={3} value={t.maxKg} addonAfter="kg" onChange={(v) => patchTier(t.key, { maxKg: v == null ? 0 : v })} />
            )}
            <Checkbox checked={t.maxKg == null} onChange={(e) => setUnlimited(t.key, e.target.checked)} style={{ fontSize: 12 }}>
              No upper limit
            </Checkbox>
          </Space>
        ),
      },
      { title: 'Weight range', key: 'range', width: 120, render: (_, __, i) => <Text style={{ fontSize: 12 }}>{rangeText(tiers, i)}</Text> },
      {
        title: (
          <Tooltip title="Optional. The flat price covers the parcel up to this weight; every kg above it is charged at + RM/kg. Leave blank to charge + RM/kg from the start of the size.">
            <span>Flat covers up to</span>
          </Tooltip>
        ),
        key: 'flatUpToKg',
        width: 150,
        render: (_, t, i) => {
          const start = i > 0 ? num(tiers[i - 1].maxKg) : 0
          return (
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <InputNumber
                {...small}
                step={0.5}
                precision={3}
                value={t.flatUpToKg}
                placeholder={`${kg(start)} (start)`}
                addonAfter="kg"
                onChange={(v) => patchTier(t.key, { flatUpToKg: v == null ? null : v })}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t.flatUpToKg != null
                  ? `RM/kg from ${kg(t.flatUpToKg)} kg`
                  : `RM/kg from ${kg(start)} kg`}
              </Text>
            </Space>
          )
        },
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
            width: 105,
            render: (_, t) => (
              <InputNumber {...small} step={0.5} precision={2} value={t.prices[m.code]?.amount} onChange={(v) => patchPrice(t.key, m.code, { amount: v == null ? 0 : v })} />
            ),
          },
          {
            title: (
              <Tooltip title="Optional. Charged per kg above the 'Flat covers up to' weight (or above the start of the size if that is blank).">
                <span>+ RM/kg</span>
              </Tooltip>
            ),
            key: `${m.code}-over`,
            width: 95,
            render: (_, t) => (
              <InputNumber {...small} step={0.1} precision={2} value={t.prices[m.code]?.perKgOver} onChange={(v) => patchPrice(t.key, m.code, { perKgOver: v == null ? 0 : v })} />
            ),
          },
        ],
      })),
      {
        title: '',
        key: 'actions',
        width: 48,
        fixed: 'right',
        render: (_, t) => (
          <Popconfirm title={`Remove size ${t.code || ''}?`} onConfirm={() => setTiers((list) => list.filter((x) => x.key !== t.key))}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
      },
    ]

    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space wrap>
            <Text strong>Size is based on</Text>
            <Radio.Group
              value={draft.chargeBy}
              onChange={(e) => setDraft((d) => ({ ...d, chargeBy: e.target.value }))}
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'shipment', label: 'Whole shipment weight' },
                { value: 'piece', label: 'Weight per piece (price × pieces)' },
              ]}
            />
          </Space>
          <Space wrap>
            <Button size="small" onClick={() => setTiers((list) => [...list].sort(byWeight))}>Sort by weight</Button>
            <Popconfirm title="Replace the table with S / M / L / XL starter sizes?" onConfirm={() => setTiers(() => starterSizes())}>
              <Button size="small">Starter sizes</Button>
            </Popconfirm>
            <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={addTier} style={{ borderColor: BRAND, color: BRAND }}>
              Add size
            </Button>
          </Space>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Each size covers weights above the previous size's max, up to its own max, using the chargeable weight (the higher
          of actual and volumetric). The flat price covers the size up to "Flat covers up to"; heavier parcels in that size
          add + RM/kg for every kg above it. Example: M 5–15 kg, RM 10 flat up to 10 kg, + RM 1/kg → 13 kg costs RM 13.
          {draft.chargeBy === 'piece'
            ? ' With "per piece", the shipment weight is divided by the piece count and the size price is charged for every piece.'
            : ''}
        </Text>
        <Table
          size="small"
          bordered
          rowKey="key"
          columns={columns}
          dataSource={tiers}
          pagination={false}
          scroll={{ x: 1350 }}
          locale={{ emptyText: <Empty description="No sizes yet. Add one or use the starter sizes." /> }}
        />
      </Space>
    )
  },
}

const baseCbmEditor = perMode({
  defaults: () => ({ baseAmount: 0, perPiece: 0, perM3: 0 }),
  fromRow: (row) => ({
    baseAmount: num(row.baseAmount),
    perPiece: num(row.perPiece),
    perM3: num(row.formulaJson?.perM3 ?? row.perKg),
  }),
  toParams: (p) => ({
    baseAmount: num(p.baseAmount),
    perPiece: num(p.perPiece),
    perKg: 0,
    formulaJson: { perM3: num(p.perM3) },
  }),
  validateParams: (p, mode) =>
    num(p.baseAmount) > 0 || num(p.perPiece) > 0 || num(p.perM3) > 0
      ? []
      : [`${mode}: set at least one of base, RM/pc or RM/m³.`],
  Form: ({ params: p, onChange }) => (
    <Row gutter={[16, 12]}>
      <Col xs={24} sm={8}>
        <Field label="Base fee" extra="Charged once per shipment">
          <Money value={p.baseAmount} onChange={(v) => onChange({ baseAmount: v })} />
        </Field>
      </Col>
      <Col xs={24} sm={8}>
        <Field label="Per piece" extra="× number of pieces">
          <Money value={p.perPiece} step={0.1} precision={4} onChange={(v) => onChange({ perPiece: v })} />
        </Field>
      </Col>
      <Col xs={24} sm={8}>
        <Field label="Per m³" extra="× cubic metres (from L×W×H)">
          <Money value={p.perM3} step={1} precision={4} onChange={(v) => onChange({ perM3: v })} />
        </Field>
      </Col>
    </Row>
  ),
})

function emptyCbmPrices() {
  return Object.fromEntries(MODES.map((m) => [m.code, { amount: 0, perM3Over: 0 }]))
}

function starterCbmSizes() {
  return [
    { key: nextKey(), code: 'S', label: '0.5 m³', maxM3: 0.5, prices: emptyCbmPrices() },
    { key: nextKey(), code: 'M', label: '1.0 m³', maxM3: 1.0, prices: emptyCbmPrices() },
    { key: nextKey(), code: 'L', label: '1.5 m³', maxM3: 1.5, prices: emptyCbmPrices() },
    { key: nextKey(), code: 'XL', label: 'Over 1.5 m³', maxM3: null, flatUpToM3: 1.5, prices: emptyCbmPrices() },
  ]
}

const byCbm = (a, b) => {
  if (a.maxM3 == null) return 1
  if (b.maxM3 == null) return -1
  return a.maxM3 - b.maxM3
}

function cbmRangeText(rows, i) {
  const lower = i > 0 ? num(rows[i - 1].maxM3) : 0
  const t = rows[i]
  if (t.maxM3 == null) return `Above ${m3(lower)} m³`
  return i === 0 ? `Up to ${m3(t.maxM3)} m³` : `${m3(lower)} – ${m3(t.maxM3)} m³`
}

const sizeCbmEditor = {
  fromRows(rowsByMode) {
    const order = []
    const byCode = {}
    let chargeBy = 'shipment'
    MODES.forEach((m) => {
      const row = rowsByMode[m.code]
      if (!row) return
      if (row.formulaJson?.chargeBy === 'piece') chargeBy = 'piece'
      ;(row.formulaJson?.tiers || []).forEach((t) => {
        const code = String(t.code || '').toUpperCase()
        if (!code) return
        if (!byCode[code]) {
          byCode[code] = {
            key: nextKey(),
            code,
            label: t.label || '',
            maxM3: t.maxM3 == null ? null : num(t.maxM3),
            flatUpToM3: t.flatUpToM3 == null ? null : num(t.flatUpToM3),
            prices: emptyCbmPrices(),
          }
          order.push(code)
        }
        byCode[code].prices[m.code] = { amount: num(t.amount), perM3Over: num(t.perM3Over) }
      })
    })
    const tiers = order.map((c) => byCode[c]).sort(byCbm)
    return { chargeBy, tiers: tiers.length ? tiers : starterCbmSizes() }
  },
  paramsForMode: (draft, modeCode) => ({
    formulaJson: {
      chargeBy: draft.chargeBy,
      tiers: draft.tiers.map((t) => ({
        code: String(t.code).trim().toUpperCase(),
        label: String(t.label || '').trim(),
        maxM3: t.maxM3 == null ? null : num(t.maxM3),
        flatUpToM3: t.flatUpToM3 == null ? null : num(t.flatUpToM3),
        amount: num(t.prices[modeCode]?.amount),
        perM3Over: num(t.prices[modeCode]?.perM3Over),
      })),
    },
  }),
  validate(draft) {
    const errors = []
    const warnings = []
    const seen = new Set()
    let prev = 0
    const tiers = draft.tiers || []
    if (!tiers.length) errors.push('Add at least one size.')
    tiers.forEach((t, i) => {
      const n = i + 1
      const code = String(t.code || '').trim().toUpperCase()
      if (!code) errors.push(`Row ${n}: size code is required.`)
      else if (seen.has(code)) errors.push(`Row ${n}: size code "${code}" is used more than once.`)
      seen.add(code)
      if (t.flatUpToM3 != null) {
        if (t.flatUpToM3 <= prev) {
          errors.push(`Row ${n}: "flat covers up to" (${m3(t.flatUpToM3)} m³) must be above where this size starts (${m3(prev)} m³).`)
        } else if (t.maxM3 != null && t.flatUpToM3 > t.maxM3) {
          errors.push(`Row ${n}: "flat covers up to" (${m3(t.flatUpToM3)} m³) can't be above the size's max (${m3(t.maxM3)} m³).`)
        }
      }
      if (t.maxM3 == null) {
        if (i !== tiers.length - 1) errors.push(`Row ${n}: only the last size can be unlimited.`)
      } else {
        if (!(t.maxM3 > 0)) errors.push(`Row ${n}: max volume must be above 0 m³.`)
        else if (t.maxM3 <= prev) errors.push(`Row ${n}: max volume ${m3(t.maxM3)} m³ must be greater than the previous size (${m3(prev)} m³).`)
        prev = Math.max(prev, num(t.maxM3))
      }
    })
    if (tiers.length && tiers[tiers.length - 1].maxM3 != null) {
      warnings.push(`No unlimited size: parcels above ${m3(prev)} m³ will be charged at the last size's price.`)
    }
    return { errors, warnings }
  },
  Editor({ draft, setDraft, enabledModes }) {
    const tiers = draft.tiers || []
    const setTiers = (fn) => setDraft((d) => ({ ...d, tiers: fn(d.tiers || []) }))
    const patchTier = (key, patch) => setTiers((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)))
    const patchPrice = (key, modeCode, patch) =>
      setTiers((list) =>
        list.map((t) => (t.key === key ? { ...t, prices: { ...t.prices, [modeCode]: { ...t.prices[modeCode], ...patch } } } : t)),
      )
    const addTier = () =>
      setTiers((list) => {
        const bounded = list.filter((t) => t.maxM3 != null)
        const lastMax = bounded.length ? num(bounded[bounded.length - 1].maxM3) : 0
        const tier = {
          key: nextKey(),
          code: '',
          label: '',
          maxM3: Math.round((lastMax + 0.5) * 10000) / 10000,
          prices: emptyCbmPrices(),
        }
        const u = list.findIndex((t) => t.maxM3 == null)
        return u < 0 ? [...list, tier] : [...list.slice(0, u), tier, ...list.slice(u)]
      })
    const setUnlimited = (key, on) =>
      setTiers((list) => {
        const bounded = list.filter((t) => t.maxM3 != null && t.key !== key)
        const lastMax = bounded.length ? num(bounded[bounded.length - 1].maxM3) : 0
        if (!on) return list.map((t) => (t.key === key ? { ...t, maxM3: lastMax + 0.5 } : t))
        const current = list.find((t) => t.key === key)
        const others = list.filter((t) => t.key !== key).map((t) => (t.maxM3 == null ? { ...t, maxM3: lastMax + 0.5 } : t))
        return [...others, { ...current, maxM3: null, flatUpToM3: current?.flatUpToM3 ?? lastMax }]
      })
    const small = { size: 'small', min: 0, style: { width: '100%' } }

    const columns = [
      { title: '#', key: 'idx', width: 40, fixed: 'left', render: (_, __, i) => <Text type="secondary">{i + 1}</Text> },
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
            onChange={(e) => patchTier(t.key, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
          />
        ),
      },
      {
        title: 'Label',
        key: 'label',
        width: 140,
        render: (_, t) => (
          <Input size="small" value={t.label} maxLength={40} placeholder="e.g. 0.5 m³" onChange={(e) => patchTier(t.key, { label: e.target.value })} />
        ),
      },
      {
        title: 'Max volume',
        key: 'maxM3',
        width: 160,
        render: (_, t) => (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {t.maxM3 == null ? (
              <Tag color="purple" style={{ margin: 0 }}>Unlimited</Tag>
            ) : (
              <InputNumber {...small} step={0.1} precision={4} value={t.maxM3} addonAfter="m³" onChange={(v) => patchTier(t.key, { maxM3: v == null ? 0 : v })} />
            )}
            <Checkbox checked={t.maxM3 == null} onChange={(e) => setUnlimited(t.key, e.target.checked)} style={{ fontSize: 12 }}>
              No upper limit
            </Checkbox>
          </Space>
        ),
      },
      { title: 'Volume range', key: 'range', width: 130, render: (_, __, i) => <Text style={{ fontSize: 12 }}>{cbmRangeText(tiers, i)}</Text> },
      {
        title: (
          <Tooltip title="Optional. Flat price covers up to this volume; every m³ above it uses + RM/m³.">
            <span>Flat covers up to</span>
          </Tooltip>
        ),
        key: 'flatUpToM3',
        width: 150,
        render: (_, t, i) => {
          const start = i > 0 ? num(tiers[i - 1].maxM3) : 0
          return (
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <InputNumber
                {...small}
                step={0.1}
                precision={4}
                value={t.flatUpToM3}
                placeholder={`${m3(start)} (start)`}
                addonAfter="m³"
                onChange={(v) => patchTier(t.key, { flatUpToM3: v == null ? null : v })}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t.flatUpToM3 != null ? `RM/m³ from ${m3(t.flatUpToM3)} m³` : `RM/m³ from ${m3(start)} m³`}
              </Text>
            </Space>
          )
        },
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
            width: 105,
            render: (_, t) => (
              <InputNumber {...small} step={0.5} precision={2} value={t.prices[m.code]?.amount} onChange={(v) => patchPrice(t.key, m.code, { amount: v == null ? 0 : v })} />
            ),
          },
          {
            title: (
              <Tooltip title="Optional. Charged per m³ above 'Flat covers up to'.">
                <span>+ RM/m³</span>
              </Tooltip>
            ),
            key: `${m.code}-over`,
            width: 95,
            render: (_, t) => (
              <InputNumber {...small} step={1} precision={2} value={t.prices[m.code]?.perM3Over} onChange={(v) => patchPrice(t.key, m.code, { perM3Over: v == null ? 0 : v })} />
            ),
          },
        ],
      })),
      {
        title: '',
        key: 'actions',
        width: 48,
        fixed: 'right',
        render: (_, t) => (
          <Popconfirm title={`Remove size ${t.code || ''}?`} onConfirm={() => setTiers((list) => list.filter((x) => x.key !== t.key))}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
      },
    ]

    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space wrap>
            <Text strong>Size is based on</Text>
            <Radio.Group
              value={draft.chargeBy}
              onChange={(e) => setDraft((d) => ({ ...d, chargeBy: e.target.value }))}
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'shipment', label: 'Whole shipment m³' },
                { value: 'piece', label: 'm³ per piece (price × pieces)' },
              ]}
            />
          </Space>
          <Space wrap>
            <Button size="small" onClick={() => setTiers((list) => [...list].sort(byCbm))}>Sort by m³</Button>
            <Popconfirm title="Replace with 0.5 / 1.0 / 1.5 m³ starter sizes?" onConfirm={() => setTiers(() => starterCbmSizes())}>
              <Button size="small">Starter sizes</Button>
            </Popconfirm>
            <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={addTier} style={{ borderColor: BRAND, color: BRAND }}>
              Add size
            </Button>
          </Space>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Volume is calculated from piece L×W×H (cm) as m³ = (L×W×H) / 1,000,000. Typical sea bands: 0.5 / 1.0 / 1.5 m³.
          {draft.chargeBy === 'piece'
            ? ' With "per piece", shipment m³ is divided by piece count and the size price is charged for every piece.'
            : ''}
        </Text>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 0 }}
          message="Turn on Sea (and optionally Land) above, then set RM prices per band. Air rarely uses m³."
        />
        <Table
          size="small"
          bordered
          rowKey="key"
          columns={columns}
          dataSource={tiers}
          pagination={false}
          scroll={{ x: 1350 }}
          locale={{ emptyText: <Empty description="No sizes yet. Add one or use the starter sizes." /> }}
        />
      </Space>
    )
  },
}

export const FORMULA_EDITORS = {
  base_pcs_kg: baseEditor,
  step_linear: stepEditor,
  size_weight: sizeWeightEditor,
  base_pcs_cbm: baseCbmEditor,
  size_cbm: sizeCbmEditor,
}
