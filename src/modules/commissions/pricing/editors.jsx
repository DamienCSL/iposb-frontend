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
  Select,
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

const flatEditor = perMode({
  defaults: () => ({ flatAmount: 0, includedKg: 0, perKgOver: 0 }),
  fromRow: (row) => {
    const j = row.formulaJson || {}
    return { flatAmount: num(j.flatAmount), includedKg: num(j.includedKg), perKgOver: num(j.perKgOver) }
  },
  toParams: (p) => ({
    formulaJson: { flatAmount: num(p.flatAmount), includedKg: num(p.includedKg), perKgOver: num(p.perKgOver) },
  }),
  validateParams: (p, mode) =>
    num(p.flatAmount) > 0 || num(p.perKgOver) > 0 ? [] : [`${mode}: set a flat fee or an RM/kg above.`],
  Form: ({ params: p, onChange }) => (
    <Row gutter={[16, 12]}>
      <Col xs={24} sm={8}>
        <Field label="Flat fee" extra="Covers the included weight">
          <Money value={p.flatAmount} onChange={(v) => onChange({ flatAmount: v })} />
        </Field>
      </Col>
      <Col xs={24} sm={8}>
        <Field label="Included weight" extra="e.g. 15 kg">
          <Kg value={p.includedKg} onChange={(v) => onChange({ includedKg: v })} />
        </Field>
      </Col>
      <Col xs={24} sm={8}>
        <Field label="Per kg above included" extra="Charged on every kg over">
          <Money value={p.perKgOver} step={0.1} precision={4} onChange={(v) => onChange({ perKgOver: v })} />
        </Field>
      </Col>
    </Row>
  ),
})

const bandEditor = perMode({
  defaults: () => ({ bands: withKeys([{ maxKg: 0.5, amount: 0 }, { maxKg: 1, amount: 0 }]), overKg: 0, overStepKg: 0.5, overStepAmount: 0 }),
  fromRow: (row) => {
    const j = row.formulaJson || {}
    return {
      bands: withKeys(j.bands),
      overKg: num(j.overKg),
      overStepKg: num(j.overStepKg, 0.5),
      overStepAmount: num(j.overStepAmount),
    }
  },
  toParams: (p) => ({
    formulaJson: {
      bands: stripKeys(p.bands || []),
      overKg: num(p.overKg),
      overStepKg: num(p.overStepKg, 0.5),
      overStepAmount: num(p.overStepAmount),
    },
  }),
  validateParams: (p, mode) => {
    const bands = p.bands || []
    if (!bands.length) return [`${mode}: add at least one weight band.`]
    return ascendingErrors(bands, 'band', mode)
  },
  Form: ({ params: p, onChange }) => {
    const bands = p.bands || []
    const lastMax = bands.length ? num(bands[bands.length - 1].maxKg) : 0
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Text strong>Weight bands</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
            The parcel is charged the price of the first band its weight fits in.
          </Text>
          <KgPriceTable rows={bands} itemLabel="band" onChange={(rows) => onChange({ bands: rows })} />
        </div>
        <div>
          <Text strong>Above the bands</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
            Heavier parcels pay the last band, plus a fixed amount for every step of kg above the threshold.
          </Text>
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={8}>
              <Field label="Threshold" extra={`0 = last band (${kg(lastMax)} kg)`}>
                <Kg value={p.overKg} onChange={(v) => onChange({ overKg: v })} />
              </Field>
            </Col>
            <Col xs={24} sm={8}>
              <Field label="Step size">
                <Kg value={p.overStepKg} onChange={(v) => onChange({ overStepKg: v })} />
              </Field>
            </Col>
            <Col xs={24} sm={8}>
              <Field label="Price per step" extra="0 = no extra charge">
                <Money value={p.overStepAmount} onChange={(v) => onChange({ overStepAmount: v })} />
              </Field>
            </Col>
          </Row>
        </div>
      </Space>
    )
  },
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

const sizePctEditor = perMode({
  defaults: () => ({
    sizes: ['S', 'M', 'L', 'XL'].map((code) => ({ key: nextKey(), code, amount: 0 })),
    pct: 100,
    includedKg: 0,
    perKgOver: 0,
    defaultSize: 'M',
  }),
  fromRow: (row) => {
    const j = row.formulaJson || {}
    const sizes = Object.entries(j.sizes || {}).map(([code, amount]) => ({ key: nextKey(), code, amount: num(amount) }))
    return {
      sizes,
      pct: num(j.pct, 100),
      includedKg: num(j.includedKg),
      perKgOver: num(j.perKgOver),
      defaultSize: j.defaultSize || sizes[0]?.code || 'M',
    }
  },
  toParams: (p) => ({
    formulaJson: {
      sizes: Object.fromEntries((p.sizes || []).filter((s) => s.code).map((s) => [s.code.toUpperCase(), num(s.amount)])),
      pct: num(p.pct, 100),
      includedKg: num(p.includedKg),
      perKgOver: num(p.perKgOver),
      defaultSize: String(p.defaultSize || 'M').toUpperCase(),
    },
  }),
  validateParams: (p, mode) => {
    const errors = []
    const codes = (p.sizes || []).map((s) => String(s.code || '').toUpperCase())
    if (!codes.length) errors.push(`${mode}: add at least one size.`)
    if (codes.some((c) => !c)) errors.push(`${mode}: every size needs a code.`)
    if (new Set(codes).size !== codes.length) errors.push(`${mode}: size codes must be unique.`)
    return errors
  },
  Form: ({ params: p, onChange }) => {
    const sizes = p.sizes || []
    const patch = (key, s) => onChange({ sizes: sizes.map((x) => (x.key === key ? { ...x, ...s } : x)) })
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="The size comes from the package size chosen on the booking. Use Size tiers (by weight) if you want sizes picked from the weight automatically."
        />
        <div>
          <Text strong>Size base prices</Text>
          <Table
            size="small"
            bordered
            pagination={false}
            rowKey="key"
            dataSource={sizes}
            style={{ marginTop: 8 }}
            columns={[
              {
                title: 'Size code',
                width: 140,
                render: (_, s) => (
                  <Input
                    size="small"
                    value={s.code}
                    maxLength={8}
                    onChange={(e) => patch(s.key, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  />
                ),
              },
              {
                title: 'Base price',
                width: 160,
                render: (_, s) => <Money size="small" value={s.amount} onChange={(v) => patch(s.key, { amount: v })} />,
              },
              {
                title: 'Charged',
                render: (_, s) => (
                  <Text style={{ fontSize: 12 }}>RM {((num(s.amount) * num(p.pct, 100)) / 100).toFixed(2)}</Text>
                ),
              },
              {
                title: '',
                width: 44,
                render: (_, s) => (
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange({ sizes: sizes.filter((x) => x.key !== s.key) })} />
                ),
              },
            ]}
          />
          <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => onChange({ sizes: [...sizes, { key: nextKey(), code: '', amount: 0 }] })}>
            Add size
          </Button>
        </div>
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={6}>
            <Field label="Charge % of base" extra="e.g. 40">
              <InputNumber min={0} step={1} value={p.pct} addonAfter="%" style={{ width: '100%' }} onChange={(v) => onChange({ pct: v ?? 0 })} />
            </Field>
          </Col>
          <Col xs={24} sm={6}>
            <Field label="Default size" extra="When the booking has no size">
              <Select
                value={p.defaultSize}
                style={{ width: '100%' }}
                onChange={(v) => onChange({ defaultSize: v })}
                options={sizes.filter((s) => s.code).map((s) => ({ value: s.code, label: s.code }))}
              />
            </Field>
          </Col>
          <Col xs={24} sm={6}>
            <Field label="Included weight">
              <Kg value={p.includedKg} onChange={(v) => onChange({ includedKg: v })} />
            </Field>
          </Col>
          <Col xs={24} sm={6}>
            <Field label="Per kg above included">
              <Money value={p.perKgOver} step={0.1} precision={4} onChange={(v) => onChange({ perKgOver: v })} />
            </Field>
          </Col>
        </Row>
      </Space>
    )
  },
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
          byCode[code] = { key: nextKey(), code, label: t.label || '', maxKg: t.maxKg == null ? null : num(t.maxKg), prices: emptyPrices() }
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
              <Tooltip title="Optional. Added per kg above the start of this size's range. Use it on the unlimited size.">
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
          of actual and volumetric).
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
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="No sizes yet. Add one or use the starter sizes." /> }}
        />
      </Space>
    )
  },
}

export const FORMULA_EDITORS = {
  base_pcs_kg: baseEditor,
  flat_then_per_kg: flatEditor,
  band_table: bandEditor,
  step_linear: stepEditor,
  size_pct: sizePctEditor,
  size_weight: sizeWeightEditor,
}
