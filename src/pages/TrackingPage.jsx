import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { PlusOutlined, ClearOutlined, StopOutlined } from '@ant-design/icons'
import { apiError, getTracking } from '../api/client'
import CancelConsignmentModal from '../components/CancelConsignmentModal'
import DataTable from '../components/DataTable'
import StatusTag from '../components/StatusTag'
import { money } from '../ui/bits'

const { Title, Text } = Typography
const { TextArea } = Input

const SESSION_KEY = 'fms.ops.cn_tracking'
const MAX_TABS = 50
const BRAND_GREEN = '#1B8A5A'

function parseCnCodes(raw) {
  const parts = String(raw || '')
    .split(/[\s,;|]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
  const out = []
  for (const p of parts) {
    if (!out.includes(p)) out.push(p)
    if (out.length >= MAX_TABS) break
  }
  return out
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const list = Array.isArray(parsed?.list) ? parsed.list.map((c) => String(c).toUpperCase()) : []
    const tab = String(parsed?.tab || '')
    return { list, tab: list.includes(tab) ? tab : list[list.length - 1] || '' }
  } catch {
    return { list: [], tab: '' }
  }
}

function saveSession(list, tab) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ list, tab, updated_at: Date.now() }))
}

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

function serviceModeLabel(code) {
  const map = {
    DROP_COUNTER: 'Drop at counter',
    ADDRESS_PICKUP: 'Address pickup',
    DOORSTEP: 'Doorstep delivery',
    SELF_COLLECT: 'Self-collect at drop point',
  }
  const key = String(code || '').toUpperCase()
  return map[key] || code || '—'
}

function dash(value) {
  if (value == null || value === '') return '—'
  return String(value)
}

function coverageLabel(type) {
  const key = String(type || '').toLowerCase()
  const map = {
    own_dp: 'Own delivery point (company pickup)',
    '3pl': '3PL partner coverage',
    uncovered: 'Uncovered — needs assignment',
    needs_assign: 'Needs manual first-mile assign',
  }
  return map[key] || dash(type)
}

function stepGlance(step) {
  const code = String(step?.code || '').toUpperCase()
  const raw = String(step?.label || step?.code || '')
  const roles = {
    ODP: 'Origin DP',
    HUB: 'Via hub',
    DHUB: 'Dest hub',
    DDP: 'Dest DP',
    AREA: 'Last-mile area',
    DP: 'Self-collect',
    DL: 'Delivery',
  }
  const role = roles[code] || code
  const m = raw.match(/\b([A-Z0-9][A-Z0-9._-]{1,})\s*$/i)
  let place = m ? m[1] : ''
  if (code === 'DL') {
    place = raw.replace(/^Doorstep delivery in\s+/i, '').replace(/^Receiver\s+/i, '') || place
  }
  return { role, place: place || raw, detail: raw }
}

function RouteNode({ kind, code, name }) {
  const label = kind === 'origin' ? 'From' : kind === 'dest' ? 'To' : 'Via'
  return (
    <div
      style={{
        flex: '1 1 120px',
        minWidth: 100,
        padding: '10px 12px',
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F1B2D', marginTop: 2 }}>{code || '—'}</div>
      {name ? (
        <div style={{ fontSize: 12, color: '#5B6B7C', marginTop: 2 }}>{name}</div>
      ) : null}
    </div>
  )
}

function ServicePill({ label, value, wide }) {
  return (
    <div
      style={{
        flex: wide ? '1 1 100%' : '1 1 140px',
        minWidth: wide ? '100%' : 140,
        padding: '8px 10px',
        background: '#FFFFFF',
        border: '1px solid #E5E8EB',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#0F1B2D', fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  )
}

export default function TrackingPage() {
  const [params] = useSearchParams()
  const initial = useMemo(() => loadSession(), [])
  const [cn, setCn] = useState('')
  const [bulk, setBulk] = useState('')
  const [list, setList] = useState(initial.list)
  const [active, setActive] = useState(initial.tab)
  const [panels, setPanels] = useState({})
  const [loading, setLoading] = useState(false)
  const [cancelCn, setCancelCn] = useState(null)
  const [cancelMsg, setCancelMsg] = useState('')

  useEffect(() => {
    const fromQuery = parseCnCodes(params.get('cn') || '')
    const tabHint = String(params.get('tab') || '').toUpperCase()
    if (fromQuery.length) {
      const next = []
      for (const code of fromQuery) {
        if (!next.includes(code) && next.length < MAX_TABS) next.push(code)
      }
      const tab = next.includes(tabHint) ? tabHint : next[next.length - 1]
      persist(next, tab)
      loadPanel(tab)
      return
    }
    if (initial.tab) {
      loadPanel(initial.tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist(nextList, nextTab) {
    setList(nextList)
    setActive(nextTab)
    saveSession(nextList, nextTab)
  }

  async function loadPanel(code) {
    setLoading(true)
    try {
      const data = await getTracking(code)
      if (data?.found === false) {
        setPanels((prev) => ({
          ...prev,
          [code]: { found: false, error: null },
        }))
      } else {
        setPanels((prev) => ({ ...prev, [code]: { found: true, data } }))
      }
    } catch (err) {
      const status = err?.response?.status
      setPanels((prev) => ({
        ...prev,
        [code]: {
          found: false,
          error: status === 404 ? null : apiError(err),
        },
      }))
    } finally {
      setLoading(false)
    }
  }

  async function addCodes(codes) {
    if (codes.length === 0) return
    const next = [...list]
    for (const code of codes) {
      if (!next.includes(code) && next.length < MAX_TABS) next.push(code)
    }
    const tab = codes[codes.length - 1]
    persist(next, tab)
    await loadPanel(tab)
  }

  async function onSubmit(e) {
    e?.preventDefault?.()
    const fromSingle = parseCnCodes(cn)
    const fromBulk = parseCnCodes(bulk)
    const codes = [...fromSingle, ...fromBulk.filter((c) => !fromSingle.includes(c))]
    if (!codes.length) {
      message.warning('Enter at least one consignment number.')
      return
    }
    setCn('')
    setBulk('')
    await addCodes(codes)
  }

  function clearAll() {
    Modal.confirm({
      title: 'Clear all open consignment tabs?',
      content: 'This removes remembered tabs for this session.',
      okText: 'Clear all',
      okButtonProps: { danger: true },
      onOk: () => {
        persist([], '')
        setPanels({})
        sessionStorage.removeItem(SESSION_KEY)
      },
    })
  }

  function closeTab(code) {
    const next = list.filter((c) => c !== code)
    const tab = active === code ? next[next.length - 1] || '' : active
    persist(next, tab)
    if (tab && !panels[tab]) loadPanel(tab)
  }

  function selectTab(code) {
    persist(list, code)
    if (!panels[code]) loadPanel(code)
  }

  const panel = panels[active]
  const data = panel?.data
  const cancellation = data?.cancellation
  const route = data?.route || null
  const assignment = data?.assignment || null
  const sealChain = data?.sealChain || null
  const routeSteps = Array.isArray(route?.steps) ? route.steps : []
  const transportLegs = Array.isArray(data?.transportLegs) ? data.transportLegs : []
  const events = Array.isArray(data?.timeline) ? [...data.timeline].reverse() : []
  const failedAttempts = Array.isArray(data?.scanAttempts) ? data.scanAttempts : []

  const transportColumns = [
    { title: '#', key: 'seq', width: 48, render: (_, leg, i) => leg.seq || i + 1 },
    { title: 'Mode', key: 'mode', render: (_, leg) => leg.modeLabel || leg.mode || '—' },
    { title: 'From', key: 'from', render: (_, leg) => leg.from || leg.fromCode || '—' },
    { title: 'To', key: 'to', render: (_, leg) => leg.to || leg.toCode || '—' },
    {
      title: 'Vessel / voyage',
      key: 'vessel',
      render: (_, leg) => [leg.vesselName, leg.voyageRef].filter(Boolean).join(' / ') || '—',
    },
    { title: 'Status', key: 'status', render: (_, leg) => (leg.status ? <StatusTag status={leg.status} /> : '—') },
  ]

  const eventColumns = [
    {
      title: 'No.',
      key: 'no',
      width: 56,
      render: (_, __, i) => <Text type="secondary">{events.length - i}</Text>,
    },
    {
      title: 'Scanning Time',
      key: 'at',
      width: 168,
      render: (_, ev) => <span style={{ whiteSpace: 'nowrap' }}>{formatWhen(ev.at)}</span>,
    },
    {
      title: 'Scanning Type',
      key: 'type',
      width: 180,
      render: (_, ev) => (
        <div>
          <StatusTag status={ev.statusCode} text={ev.scanningType || ev.shortLabel} />
          {ev.statusCode ? (
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4, fontFamily: 'monospace' }}>{ev.statusCode}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Tracking Record',
      key: 'record',
      render: (_, ev) => (
        <div>
          {ev.trackingRecord || ev.customerLabel || ev.note || '—'}
          {ev.location ? (
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{ev.location}</div>
          ) : null}
          {ev.evidenceUrl ? (
            <div style={{ marginTop: 4 }}>
              <a href={ev.evidenceUrl} target="_blank" rel="noreferrer">
                View proof photo
              </a>
            </div>
          ) : null}
        </div>
      ),
    },
  ]

  const failedColumns = [
    {
      title: 'Time',
      key: 'at',
      width: 168,
      render: (_, row) => <span style={{ whiteSpace: 'nowrap' }}>{formatWhen(row.at)}</span>,
    },
    { title: 'Attempted', key: 'attempted', render: (_, row) => row.attemptedStatus || '—' },
    {
      title: 'Error',
      key: 'error',
      render: (_, row) => <Text type="danger">{row.errorMessage || row.errorCode || '—'}</Text>,
    },
    {
      title: 'Proof',
      key: 'proof',
      width: 100,
      render: (_, row) =>
        row.evidenceUrl ? (
          <a href={row.evidenceUrl} target="_blank" rel="noreferrer">
            View photo
          </a>
        ) : (
          '—'
        ),
    },
  ]

  const tabItems = list.map((code) => {
    const p = panels[code]
    const missing = p && !p.found
    const scanLabel = p?.data?.scanningType || ''
    return {
      key: code,
      label: (
        <Space size={6}>
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: code === active ? BRAND_GREEN : undefined }}>
            {code}
          </span>
          {missing ? (
            <Tag color="error" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
              ?
            </Tag>
          ) : scanLabel ? (
            <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{scanLabel}</Tag>
          ) : null}
        </Space>
      ),
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
          Consignment Tracking
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Look up status history across multiple CNs. Open tabs are remembered for this session.
        </Text>
      </div>

      {cancelMsg ? (
        <Alert type="success" showIcon closable message={cancelMsg} onClose={() => setCancelMsg('')} />
      ) : null}

      <Card size="small" style={{ borderRadius: 8 }}>
        <form onSubmit={onSubmit}>
          <Row gutter={[12, 12]} align="bottom">
            <Col xs={24} md={8}>
              <div style={{ marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>
                  Add consignment
                </Text>
              </div>
              <Input
                value={cn}
                onChange={(e) => setCn(e.target.value)}
                placeholder="e.g. BBB0810000001"
                autoFocus
                allowClear
              />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                {list.length
                  ? 'Adds another tab. Open tabs are remembered when you leave this page.'
                  : 'Track one CN, then add more. Tabs are kept until you clear them or log out.'}
              </Text>
            </Col>
            <Col xs={24} md={10}>
              <div style={{ marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>
                  Or paste multiple
                </Text>
              </div>
              <TextArea
                rows={2}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder="One per line, or comma / space separated"
                allowClear
              />
            </Col>
            <Col xs={24} md={6}>
              <Space wrap>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ background: BRAND_GREEN, borderColor: BRAND_GREEN }}>
                  {list.length ? 'Add to tabs' : 'Track'}
                </Button>
                {list.length ? (
                  <Button icon={<ClearOutlined />} onClick={clearAll}>
                    Clear all
                  </Button>
                ) : null}
              </Space>
            </Col>
          </Row>
        </form>
      </Card>

      {list.length === 0 ? (
        <Alert
          type="info"
          showIcon
          message="No consignments open"
          description="Enter one or more consignment numbers to open tracking tabs. Your open tabs are saved for this login — leave FMS and come back anytime."
        />
      ) : (
        <>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {list.length} consignment{list.length === 1 ? '' : 's'} open (max {MAX_TABS}) · remembered for this session
          </Text>

          <Card size="small" style={{ borderRadius: 8 }} bodyStyle={{ paddingTop: 8, paddingBottom: 0 }}>
            <Tabs
              type="editable-card"
              hideAdd
              size="small"
              activeKey={active}
              onChange={selectTab}
              onEdit={(targetKey, action) => {
                if (action === 'remove') closeTab(String(targetKey))
              }}
              items={tabItems}
            />
          </Card>

          {loading && !panel ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spin tip="Looking up…" />
            </div>
          ) : null}

          {panel?.error ? (
            <Alert type="error" showIcon message="Tracking query failed" description={panel.error} />
          ) : panel && !panel.found ? (
            <Alert
              type="warning"
              showIcon
              message="Consignment not found"
              description={
                <>
                  Consignment number <Text strong style={{ fontFamily: 'monospace', color: BRAND_GREEN }}>{active}</Text> not
                  found. Close this tab or try another number.
                </>
              }
            />
          ) : data ? (
            <Spin spinning={loading}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card
                  size="small"
                  style={{ borderRadius: 8 }}
                  title={
                    <Space wrap>
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 16, color: BRAND_GREEN }}>
                        CN: {data.cnNo || active}
                      </Text>
                      <StatusTag status={data.statusCode} text={data.scanningType || data.shortLabel} />
                    </Space>
                  }
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="Origin">
                          <div>
                            {data.origin || '—'}
                            {data.originName ? (
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {data.originName}
                                </Text>
                              </div>
                            ) : null}
                            {data.originZone ? (
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Zone {data.originZone}
                                </Text>
                              </div>
                            ) : null}
                          </div>
                        </Descriptions.Item>
                        <Descriptions.Item label="Destination">
                          <div>
                            {data.destination || '—'}
                            {data.dstnName ? (
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {data.dstnName}
                                </Text>
                              </div>
                            ) : null}
                            {data.destinationZone ? (
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Zone {data.destinationZone}
                                </Text>
                              </div>
                            ) : null}
                          </div>
                        </Descriptions.Item>
                        <Descriptions.Item label="Recipient">{data.recipientName || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Location">{data.location || '—'}</Descriptions.Item>
                      </Descriptions>
                    </Col>
                    <Col xs={24} md={12}>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="Status">
                          <Space direction="vertical" size={4}>
                            <Space wrap>
                              <StatusTag status={data.statusCode} text={data.scanningType || data.shortLabel} />
                              {data.statusCode ? (
                                <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                  {data.statusCode}
                                </Text>
                              ) : null}
                            </Space>
                            {data.customerLabel ? (
                              <Text style={{ fontWeight: 500 }}>{data.customerLabel}</Text>
                            ) : null}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="Payment">
                          <div>
                            {data.isCod || data.payMode === 'COD' ? (
                              <Tag color="orange">COD</Tag>
                            ) : (
                              <Tag>{data.payMode || 'PPD'}</Tag>
                            )}
                            {data.isCod || data.payMode === 'COD' ? (
                              <div style={{ fontSize: 12, marginTop: 6 }}>
                                Status: <Text strong>{data.codStatus || 'PENDING'}</Text>
                                {data.expectedAmt != null ? <> · Due {money(data.expectedAmt)}</> : null}
                                {data.collectedAmt != null && Number(data.collectedAmt) > 0 ? (
                                  <> · Collected {money(data.collectedAmt)}</>
                                ) : null}
                                <div style={{ marginTop: 4 }}>
                                  <Link to={`/ops/cod?cn=${encodeURIComponent(data.cnNo || active)}`}>
                                    Open COD outstanding
                                  </Link>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </Descriptions.Item>
                        <Descriptions.Item label="Delivery Date">{data.podDate || '—'}</Descriptions.Item>
                      </Descriptions>
                    </Col>
                  </Row>
                </Card>

                {route || assignment ? (
                  <Row gutter={[12, 12]}>
                    <Col xs={24} lg={12}>
                      <Card
                        size="small"
                        style={{ borderRadius: 8, height: '100%' }}
                        title={
                          <Space wrap>
                            <span>Order route</span>
                            {data.transportModeLabel || data.transportMode ? (
                              <Tag>{data.transportModeLabel || data.transportMode}</Tag>
                            ) : null}
                            {route?.preferredRouteCd ? (
                              <Tag color="blue">{route.preferredRouteCd}</Tag>
                            ) : null}
                          </Space>
                        }
                      >
                        {route?.error ? (
                          <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 12 }}
                            message={`Could not plan path: ${route.error}`}
                          />
                        ) : null}

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'stretch',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 12,
                          }}
                        >
                          <RouteNode
                            kind="origin"
                            code={route?.originZone || route?.originHubCode || data.origin}
                            name={route?.originZoneName}
                          />
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 4px',
                              color: '#64748B',
                              fontSize: 12,
                              fontFamily: 'monospace',
                              minWidth: 48,
                            }}
                            aria-hidden="true"
                          >
                            {[
                              route?.viaHubCode &&
                              route.viaHubCode !== (route?.destHubCode || route?.destHubBooked)
                                ? route.viaHubCode
                                : null,
                              route?.destHubCode || route?.destHubBooked || data.destination,
                            ]
                              .filter(Boolean)
                              .filter((v, i, a) => a.indexOf(v) === i)
                              .join(' → ') || '···'}
                          </div>
                          <RouteNode
                            kind="dest"
                            code={route?.destinationZone || route?.destHubCode || data.destination}
                            name={
                              [
                                route?.destinationZoneName,
                                route?.destinationArea
                                  ? route.destinationAreaName || route.destinationArea
                                  : null,
                              ]
                                .filter(Boolean)
                                .filter((v, i, a) => a.indexOf(v) === i)
                                .join(' · ') || null
                            }
                          />
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                          <ServicePill
                            label="Pickup"
                            value={serviceModeLabel(route?.originService || assignment?.originService)}
                          />
                          <ServicePill
                            label="Delivery"
                            value={serviceModeLabel(route?.destinationService || assignment?.destinationService)}
                          />
                          {route?.destinationArea ? (
                            <ServicePill
                              wide
                              label="Area"
                              value={
                                <>
                                  {route.destinationArea}
                                  {route.destinationAreaName ? ` — ${route.destinationAreaName}` : ''}
                                </>
                              }
                            />
                          ) : null}
                        </div>

                        {routeSteps.length === 0 ? (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            No planned route steps yet.
                          </Text>
                        ) : (
                          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                            {routeSteps.map((step, idx) => {
                              const g = stepGlance(step)
                              return (
                                <li
                                  key={`${step.step}-${step.code}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: 8,
                                    padding: '6px 0',
                                    borderBottom: idx < routeSteps.length - 1 ? '1px solid #F1F5F9' : 'none',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: '50%',
                                      background: '#F0FDF4',
                                      color: BRAND_GREEN,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {idx + 1}
                                  </span>
                                  <Text strong style={{ fontSize: 12, minWidth: 88 }}>
                                    {g.role}
                                  </Text>
                                  <Text style={{ fontSize: 12 }} title={g.detail}>
                                    {g.place}
                                  </Text>
                                </li>
                              )
                            })}
                          </ol>
                        )}

                        {data.originDropLabel || data.destDropLabel ? (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 16,
                              marginTop: 12,
                              paddingTop: 12,
                              borderTop: '1px solid #F1F5F9',
                            }}
                          >
                            {data.originDropLabel ? (
                              <div>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                                  Origin drop
                                </Text>
                                <Text style={{ fontSize: 13 }}>{data.originDropLabel}</Text>
                              </div>
                            ) : null}
                            {data.destDropLabel ? (
                              <div>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                                  Dest drop
                                </Text>
                                <Text style={{ fontSize: 13 }}>{data.destDropLabel}</Text>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card size="small" style={{ borderRadius: 8, height: '100%' }} title="Assigned details">
                        <Descriptions column={1} size="small" bordered>
                          <Descriptions.Item label="Assigned driver">
                            <div>
                              {assignment?.assignedDriverName ||
                                (assignment?.assignedDriverId
                                  ? `Driver #${assignment.assignedDriverId}`
                                  : '—')}
                              {assignment?.assignedDriverRoute ? (
                                <Text type="secondary"> · route {assignment.assignedDriverRoute}</Text>
                              ) : null}
                              {assignment?.assignedDriverPhone ? (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {assignment.assignedDriverPhone}
                                  </Text>
                                </div>
                              ) : null}
                            </div>
                          </Descriptions.Item>
                          <Descriptions.Item label="Assignment">
                            <div>
                              {assignment?.assignmentAcceptedLabel || '—'}
                              {assignment?.assignedAt ? (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {formatWhen(assignment.assignedAt)}
                                  </Text>
                                </div>
                              ) : null}
                            </div>
                          </Descriptions.Item>
                          <Descriptions.Item label="Last-mile dispatcher">
                            <div>
                              {assignment?.deliveryDispatcherName ||
                                assignment?.deliveryDispatcherCode ||
                                '—'}
                              {assignment?.deliveryDispatcherCode && assignment?.deliveryDispatcherName ? (
                                <Text type="secondary"> ({assignment.deliveryDispatcherCode})</Text>
                              ) : null}
                              {assignment?.dispatcherAreaCode ? (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    Area {assignment.dispatcherAreaCode}
                                  </Text>
                                </div>
                              ) : null}
                              {assignment?.dispatcherDeliveryPoint ? (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    DP {assignment.dispatcherDeliveryPoint}
                                  </Text>
                                </div>
                              ) : null}
                            </div>
                          </Descriptions.Item>
                          <Descriptions.Item label="Dest area">
                            {assignment?.destinationAreaCode
                              ? `${assignment.destinationAreaCode}${
                                  assignment.destinationAreaName
                                    ? ` — ${assignment.destinationAreaName}`
                                    : ''
                                }`
                              : '—'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Pickup coverage">
                            <div>
                              {assignment?.coverageTypeLabel ||
                                coverageLabel(assignment?.coverageType || assignment?.pickupOwnerType)}
                              {assignment?.coverageReason ? (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {assignment.coverageReason}
                                  </Text>
                                </div>
                              ) : null}
                            </div>
                          </Descriptions.Item>
                          <Descriptions.Item label="Origin drop">
                            {dash(assignment?.originDropLabel || data.originDropLabel)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Dest drop">
                            {dash(assignment?.destDropLabel || data.destDropLabel)}
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>
                    </Col>
                  </Row>
                ) : null}

                {sealChain && (sealChain.baby || sealChain.mother || sealChain.father) ? (
                  <Card size="small" style={{ borderRadius: 8 }} title="Seal packaging">
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      {sealChain.father ? (
                        <div
                          style={{
                            padding: '10px 12px',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            minWidth: 140,
                          }}
                        >
                          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Father</div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: BRAND_GREEN }}>
                            {sealChain.father.sealNo}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {sealChain.father.destHubCode || '—'} · {sealChain.father.lifecycle}
                          </Text>
                        </div>
                      ) : null}
                      {sealChain.father && sealChain.mother ? (
                        <span style={{ color: '#94A3B8', fontSize: 18 }} aria-hidden="true">
                          ⊃
                        </span>
                      ) : null}
                      {sealChain.mother ? (
                        <div
                          style={{
                            padding: '10px 12px',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            minWidth: 140,
                          }}
                        >
                          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Mother</div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: BRAND_GREEN }}>
                            {sealChain.mother.sealNo}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {sealChain.mother.destDeliveryPoint || '—'} · {sealChain.mother.lifecycle}
                          </Text>
                        </div>
                      ) : null}
                      {sealChain.mother && sealChain.baby ? (
                        <span style={{ color: '#94A3B8', fontSize: 18 }} aria-hidden="true">
                          ⊃
                        </span>
                      ) : null}
                      {sealChain.baby ? (
                        <div
                          style={{
                            padding: '10px 12px',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            minWidth: 140,
                          }}
                        >
                          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Baby</div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: BRAND_GREEN }}>
                            {sealChain.baby.sealNo}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {sealChain.baby.destAreaCode || '—'} · {sealChain.baby.lifecycle}
                          </Text>
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ) : null}

                {transportLegs.length > 0 ? (
                  <Card size="small" style={{ borderRadius: 8 }} title="Transport legs" bodyStyle={{ paddingTop: 0 }}>
                    <DataTable
                      rowKey={(leg, i) => leg.id || `${leg.fromCode}-${leg.toCode}-${i}`}
                      columns={transportColumns}
                      dataSource={transportLegs}
                      pagination={false}
                    />
                  </Card>
                ) : null}

                {cancellation?.cancelled ? (
                  <Card
                    size="small"
                    style={{ borderRadius: 8, borderColor: '#F59E0B' }}
                    title={
                      <Space>
                        <span>Cancellation record</span>
                        <StatusTag status="CAN" text="Cancelled" />
                      </Space>
                    }
                  >
                    <Row gutter={[12, 8]}>
                      <Col xs={24} sm={12} md={6}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          Processing fee
                        </Text>
                        <Text type="danger" strong>
                          {money(cancellation.feeAmt)}
                        </Text>{' '}
                        <Text type="secondary">({cancellation.feePct}%)</Text>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          Wallet refund
                        </Text>
                        <Text strong style={{ color: BRAND_GREEN }}>
                          {money(cancellation.refundAmt)}
                        </Text>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          Credit note
                        </Text>
                        {cancellation.creditNoteNo || '—'}
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          By
                        </Text>
                        {cancellation.cancelledBy || '—'}
                      </Col>
                      {cancellation.reason ? (
                        <Col span={24}>
                          <Text type="secondary">Reason: {cancellation.reason}</Text>
                        </Col>
                      ) : null}
                    </Row>
                  </Card>
                ) : data.statusCode !== 'CAN' ? (
                  <div>
                    <Button danger icon={<StopOutlined />} onClick={() => setCancelCn(active)}>
                      Cancel this consignment…
                    </Button>
                  </div>
                ) : null}

                <Card
                  size="small"
                  style={{ borderRadius: 8 }}
                  title="Tracking Info"
                  extra={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {events.length} event{events.length === 1 ? '' : 's'}
                    </Text>
                  }
                  bodyStyle={{ paddingTop: events.length === 0 ? 16 : 0 }}
                >
                  {events.length === 0 ? (
                    <Alert type="info" showIcon message="No tracking history found." />
                  ) : (
                    <DataTable
                      rowKey={(ev, i) => `${ev.at}-${i}`}
                      columns={eventColumns}
                      dataSource={events}
                      pagination={false}
                    />
                  )}
                </Card>

                {failedAttempts.length > 0 ? (
                  <Card size="small" style={{ borderRadius: 8 }} title="Failed scan attempts" bodyStyle={{ paddingTop: 0 }}>
                    <DataTable
                      rowKey={(row) => row.id || `${row.at}-${row.attemptedStatus}`}
                      columns={failedColumns}
                      dataSource={failedAttempts}
                      pagination={false}
                    />
                  </Card>
                ) : null}
              </div>
            </Spin>
          ) : null}
        </>
      )}

      {cancelCn ? (
        <CancelConsignmentModal
          cn={cancelCn}
          onClose={() => setCancelCn(null)}
          onDone={(result) => {
            setCancelMsg(result.message || 'Cancellation updated.')
            loadPanel(cancelCn)
            setCancelCn(null)
          }}
        />
      ) : null}
    </div>
  )
}
