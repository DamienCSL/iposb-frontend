import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Col, Popconfirm, Row, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { apiError, getCommissionConfig, updateCommissionConfig } from '../../../api/client'
import PricingTargetBar from './PricingTargetBar'
import {
  FORMULAS,
  MODES,
  activeRowsAt,
  formulaByType,
  isFormulaRow,
  laneLabel,
  lanesForScope,
  modeLabel,
  normMode,
  normTarget,
  rowTarget,
  saveBody,
  scopeLabel,
  targetFromSearch,
  targetSearch,
} from './pricingModel'

const { Title, Text } = Typography

const BRAND = '#1B8A5A'

/**
 * Customer delivery-fee pricing: which formula prices each transport mode, per customer and lane.
 * `embedded` renders without the page header (used inside Commission rate settings).
 */
export default function PricingOverview({ embedded = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState([])
  const [deliveryFeeEnabled, setDeliveryFeeEnabled] = useState(true)
  const [target, setTarget] = useState(() => {
    const t = targetFromSearch(embedded ? '' : location.search)
    return { ...t, origin: '', destination: '', serviceType: '' }
  })

  function applyConfig(cfg) {
    setRows([...(cfg?.deliveryFeeRates || []), ...(cfg?.customerDeliveryFeeRates || [])])
    setDeliveryFeeEnabled(Boolean(cfg?.deliveryFeeEnabled))
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

  async function save(changed, extra = {}, okText = 'Saved') {
    setBusy(true)
    try {
      const res = await updateCommissionConfig(saveBody(changed, extra))
      message.success(okText)
      if (res?.config) applyConfig(res.config)
      else await load()
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const scope = normTarget(target).custAcNo
  const formulaHref = (slug, lane, modeCode) =>
    `/ops/commissions/pricing/${slug}${targetSearch({ ...lane, custAcNo: scope }, modeCode)}`

  const matrix = useMemo(
    () =>
      lanesForScope(rows, scope).map(({ key, target: lane }) => {
        const t = { ...lane, custAcNo: scope }
        return {
          key,
          lane,
          cells: Object.fromEntries(MODES.map((m) => [m.code, activeRowsAt(rows, t, m.code)])),
        }
      }),
    [rows, scope],
  )

  const oldBands = useMemo(() => rows.filter((r) => r.isActive && !isFormulaRow(r)), [rows])

  const fallbackText = (laneIsAll) => {
    if (scope) return laneIsAll ? 'Public pricing' : 'Customer All lanes'
    return laneIsAll ? 'Freight tariff' : 'All lanes'
  }

  const matrixColumns = [
    {
      title: 'Lane',
      key: 'lane',
      width: 200,
      render: (_, r) => <Text strong={r.key === '||'}>{laneLabel(r.lane)}</Text>,
    },
    ...MODES.map((m) => ({
      title: m.label,
      key: m.code,
      render: (_, r) => {
        const active = r.cells[m.code]
        if (!active.length) {
          return (
            <Space direction="vertical" size={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Not set → {fallbackText(r.key === '||')}
              </Text>
              <Link to={formulaHref('base', r.lane, m.code)} style={{ fontSize: 12 }}>
                Set a formula
              </Link>
            </Space>
          )
        }
        return (
          <Space direction="vertical" size={4}>
            {active.map((row) => {
              const f = isFormulaRow(row) ? formulaByType(row.formulaType) : null
              return f ? (
                <Link key={row.id} to={formulaHref(f.slug, r.lane, m.code)}>
                  <Tag color="green" style={{ cursor: 'pointer' }}>
                    {f.title} <RightOutlined style={{ fontSize: 10 }} />
                  </Tag>
                </Link>
              ) : (
                <Tag key={row.id} color="orange">
                  Old band {row.rateCode}
                </Tag>
              )
            })}
            {active.length > 1 ? (
              <Text type="warning" style={{ fontSize: 11 }}>
                Several active. Open a formula and save it to keep just one.
              </Text>
            ) : null}
          </Space>
        )
      },
    })),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!embedded ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Link to="/ops/commissions/rates">
              <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0 }}>
                Rate settings
              </Button>
            </Link>
            <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
              Customer pricing
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Pick one formula per transport mode for the public price, each customer, and any lane overrides.
            </Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Reload
          </Button>
        </div>
      ) : null}

      <Alert
        type={deliveryFeeEnabled ? 'success' : 'warning'}
        showIcon
        message={
          <Space wrap>
            <span>
              Delivery-fee quoting is <strong>{deliveryFeeEnabled ? 'on' : 'off'}</strong>.
              {deliveryFeeEnabled ? ' Live quotes use the formulas below.' : ' Live quotes use the freight tariff, not these formulas.'}
            </span>
            <Switch
              checked={deliveryFeeEnabled}
              loading={busy}
              onChange={(v) => save([], { deliveryFeeEnabled: v }, v ? 'Delivery-fee quoting turned on' : 'Delivery-fee quoting turned off')}
              checkedChildren="On"
              unCheckedChildren="Off"
            />
          </Space>
        }
      />

      <Card size="small" title="Formulas" styles={{ body: { padding: 16 } }}>
        <Row gutter={[12, 12]}>
          {FORMULAS.map((f) => {
            const uses = rows.filter((r) => r.isActive && isFormulaRow(r) && r.formulaType === f.type)
            return (
              <Col xs={24} sm={12} lg={8} key={f.slug}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(formulaHref(f.slug, {}, null))}
                  style={{ height: '100%' }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Text strong>{f.title}</Text>
                      <RightOutlined style={{ color: BRAND }} />
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {f.summary}
                    </Text>
                    {uses.length ? (
                      <Space wrap size={4}>
                        {uses.slice(0, 4).map((r) => (
                          <Tag key={r.id} color="green" style={{ fontSize: 11 }}>
                            {scopeLabel(r.custAcNo)} · {modeLabel(normMode(r.transportMode))}
                          </Tag>
                        ))}
                        {uses.length > 4 ? <Tag style={{ fontSize: 11 }}>+{uses.length - 4} more</Tag> : null}
                      </Space>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 11 }}>Not used yet</Text>
                    )}
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      </Card>

      <Card size="small" title="What's active" styles={{ body: { padding: 16 } }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <PricingTargetBar rows={rows} target={target} onChange={(t) => setTarget({ ...t, origin: '', destination: '', serviceType: '' })} showLane={false} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Quotes check, in order: the customer's lane override, the customer's All lanes, the public lane override, then
            public All lanes. Click a formula to edit it.
          </Text>
          <Table
            size="small"
            bordered
            rowKey="key"
            loading={loading}
            pagination={false}
            columns={matrixColumns}
            dataSource={matrix}
            scroll={{ x: 700 }}
          />
        </Space>
      </Card>

      {oldBands.length ? (
        <Card
          size="small"
          title={`Old bands still active (${oldBands.length})`}
          extra={
            <Popconfirm
              title="Turn off all old bands?"
              description="Modes without a formula will fall back to the freight tariff (or Public pricing for customers)."
              onConfirm={() => save(oldBands.map((r) => ({ ...r, isActive: false })), {}, 'Old bands turned off')}
            >
              <Button size="small" danger loading={busy}>
                Turn off all
              </Button>
            </Popconfirm>
          }
          styles={{ body: { padding: 16 } }}
        >
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Bands from the old rate table. They keep pricing until you turn them off or save a formula for the same mode,
            customer and lane.
          </Text>
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={oldBands}
            scroll={{ x: 700 }}
            columns={[
              { title: 'Code', dataIndex: 'rateCode', width: 140 },
              { title: 'For', width: 140, render: (_, r) => scopeLabel(r.custAcNo) },
              { title: 'Mode', width: 80, render: (_, r) => modeLabel(normMode(r.transportMode)) },
              { title: 'Lane', render: (_, r) => laneLabel(rowTarget(r)) },
              { title: 'Formula', width: 180, render: (_, r) => formulaByType(r.formulaType)?.title || r.formulaType },
              {
                title: '',
                width: 90,
                render: (_, r) => (
                  <Button size="small" onClick={() => save([{ ...r, isActive: false }], {}, `${r.rateCode} turned off`)} loading={busy}>
                    Turn off
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      ) : null}
    </div>
  )
}
