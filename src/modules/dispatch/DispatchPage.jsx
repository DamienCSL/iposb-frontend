import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CarOutlined,
  GlobalOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, useSearchParams } from 'react-router-dom'
import {
  apiError,
  assign3pl,
  assignDriver,
  get3plPartners,
  getDispatchDrivers,
  getDispatchJobs,
  getTracking,
  getUncoveredJobs,
  planDispatch,
} from '../../api/client'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

const BRAND = '#1B8A5A'

const REMOTE_FILTERS = [
  { key: 'all', label: 'All open' },
  { key: 'uncovered', label: 'Uncovered (HQ)' },
  { key: '3pl', label: 'Assigned 3PL' },
  { key: 'unresolved', label: 'Not classified' },
]

function driverKey(d) {
  return String(d.driverId ?? d.driver_id ?? d.id ?? '')
}

function driverLabel(d) {
  const name = d.fullName || d.full_name || d.name || `Driver ${driverKey(d)}`
  const bits = [name]
  if (d.locId || d.loc_id) bits.push(d.locId || d.loc_id)
  if (d.routeCd || d.route_cd) bits.push(d.routeCd || d.route_cd)
  if (d.distanceKm != null) bits.push(`${Number(d.distanceKm).toFixed(1)} km`)
  return bits.join(' · ')
}

function cnKeyOf(row) {
  return String(row?.consignment_no || row?.cn_no || row?.cnNo || '').toUpperCase()
}

export default function DispatchPage() {
  const [params, setParams] = useSearchParams()
  const tabFromUrl = params.get('tab') || 'assign'
  const activeTab = ['assign', 'remote', 'drivers'].includes(tabFromUrl) ? tabFromUrl : 'assign'
  const cnFromUrl = (params.get('cn_no') || '').toUpperCase()
  const remoteFilter = REMOTE_FILTERS.some((f) => f.key === params.get('remote'))
    ? params.get('remote')
    : 'all'

  const [drivers, setDrivers] = useState([])
  const [partners, setPartners] = useState([])
  const [jobs, setJobs] = useState([])
  const [uncoveredJobs, setUncoveredJobs] = useState([])
  const [loading, setLoading] = useState(false)

  // Assign tab (Damien Driver Assignment)
  const [cnInput, setCnInput] = useState(cnFromUrl)
  const [cnNo, setCnNo] = useState(cnFromUrl)
  const [cn, setCn] = useState(null)
  const [planInfo, setPlanInfo] = useState(null)
  const [jobType, setJobType] = useState('delivery')
  const [driverId, setDriverId] = useState('')
  const [busy, setBusy] = useState(false)
  const [driverSearch, setDriverSearch] = useState('')

  // Remote tab
  const [partnerByCn, setPartnerByCn] = useState({})
  const [remoteBusy, setRemoteBusy] = useState(null)

  function selectTab(next) {
    const nextParams = { tab: next }
    if (next === 'assign' && cnNo) nextParams.cn_no = cnNo
    if (next === 'remote' && remoteFilter !== 'all') nextParams.remote = remoteFilter
    setParams(nextParams, { replace: true })
  }

  async function loadLists() {
    setLoading(true)
    try {
      const [drvRes, partRes, jobRes, uncRes] = await Promise.all([
        getDispatchDrivers().catch(() => []),
        get3plPartners().catch(() => []),
        getDispatchJobs(false).catch(() => ({ jobs: [] })),
        getUncoveredJobs().catch(() => ({ jobs: [] })),
      ])
      setDrivers(Array.isArray(drvRes) ? drvRes : drvRes?.drivers || [])
      setPartners(Array.isArray(partRes) ? partRes : partRes?.partners || [])
      setJobs(jobRes?.jobs || [])
      setUncoveredJobs(uncRes?.jobs || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLists()
  }, [])

  useEffect(() => {
    const nextCn = (params.get('cn_no') || '').toUpperCase()
    if (nextCn && nextCn !== cnNo) {
      setCnInput(nextCn)
      setCnNo(nextCn)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    if (!cnNo) {
      setCn(null)
      setPlanInfo(null)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await getTracking(cnNo)
        if (cancelled) return
        if (data?.found === false) {
          setCn(null)
          message.warning(`Consignment ${cnNo} was not found.`)
          return
        }
        setCn(data)
        setJobType('delivery')
      } catch (err) {
        if (!cancelled) {
          setCn(null)
          message.error(apiError(err) || `Consignment ${cnNo} was not found.`)
        }
      }
      try {
        const plan = await planDispatch(cnNo, false)
        if (!cancelled) setPlanInfo(plan)
      } catch {
        if (!cancelled) setPlanInfo(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cnNo])

  function loadCn(e) {
    e?.preventDefault?.()
    const next = cnInput.trim().toUpperCase()
    setParams(
      next ? { tab: 'assign', cn_no: next } : { tab: 'assign' },
      { replace: true },
    )
    setCnNo(next)
    setPlanInfo(null)
  }

  async function onAssign() {
    const driver = drivers.find((d) => driverKey(d) === String(driverId))
    if (!cnNo || !driver) {
      message.warning('Load a consignment and select a driver.')
      return
    }
    setBusy(true)
    try {
      await assignDriver({
        cnNo,
        driverId: Number(driver.driverId ?? driver.driver_id ?? driver.id),
        firebaseUid: driver.firebaseUid || driver.firebase_uid || '',
        jobType,
      })
      message.success(`Consignment ${cnNo} assigned to ${driver.fullName || driver.full_name || driver.name}.`)
      const data = await getTracking(cnNo).catch(() => null)
      if (data) setCn(data)
      loadLists()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onAuto() {
    if (!cnNo) {
      message.warning('Load a consignment first.')
      return
    }
    setBusy(true)
    try {
      const plan = await planDispatch(cnNo, true)
      setPlanInfo(plan)
      const ctype = plan?.path?.coverageType || ''
      const disp = plan?.path?.deliveryDispatcherName || plan?.staff?.deliveryDispatcher?.fullName
      const area = plan?.path?.destinationArea
      const bits = []
      if (ctype === 'needs_assign') {
        bits.push('needs a manual first-mile driver pick at the origin delivery point')
      } else if (plan?.autoAssign?.applied) {
        bits.push(`first-mile auto-assigned to ${plan.staff?.pickup?.fullName || 'driver'}`)
      } else if (plan?.autoAssign?.result?.error) {
        bits.push(plan.autoAssign.result.error)
      }
      if (area && disp) {
        bits.push(`last-mile area ${area} → dispatcher ${disp}`)
      } else if (area) {
        bits.push(`last-mile area ${area} (no dispatcher assigned yet)`)
      } else if (plan?.path?.destinationService === 'DOORSTEP') {
        bits.push('no last-mile area matched — set area keywords or pick area on the CN')
      }
      if (bits.length === 0) {
        throw new Error('No matching delivery-point driver.')
      }
      message.success(`${cnNo}: ${bits.join('; ')}.`)
      loadLists()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function resolveCoverage(cnKey) {
    setRemoteBusy(cnKey)
    try {
      const plan = await planDispatch(cnKey, true)
      const ctype = plan?.path?.coverageType || ''
      if (ctype === '3pl') {
        message.success(
          `${cnKey} matched 3PL coverage${plan.path?.['3plPartnerName'] ? `: ${plan.path['3plPartnerName']}` : ''}.`,
        )
      } else if (ctype === 'uncovered') {
        message.warning(`${cnKey} is uncovered — HQ must pick a 3PL partner or override to a driver.`)
      } else if (plan?.autoAssign?.applied) {
        message.success(`${cnKey} auto-assigned to ${plan.staff?.pickup?.fullName || 'driver'}.`)
      } else {
        message.success(
          `${cnKey} coverage resolved as own DP${plan.path?.lockedDropCode ? ` (${plan.path.lockedDropCode})` : ''}.`,
        )
      }
      loadLists()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setRemoteBusy(null)
    }
  }

  async function onAssign3pl(cnKey) {
    const partnerId = Number(partnerByCn[cnKey] || 0)
    if (!partnerId) {
      message.warning('Select a 3PL partner.')
      return
    }
    setRemoteBusy(cnKey)
    try {
      const result = await assign3pl({ cnNo: cnKey, partnerId })
      message.success(`${cnKey} assigned to 3PL ${result.partnerName || result.partnerCode || ''}`.trim())
      loadLists()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setRemoteBusy(null)
    }
  }

  const filteredDrivers = useMemo(
    () =>
      drivers.filter((d) => {
        if (!driverSearch) return true
        const q = driverSearch.toLowerCase()
        return (
          driverLabel(d).toLowerCase().includes(q) ||
          String(d.phone || '').includes(driverSearch) ||
          String(d.branchCode || d.locId || '').toLowerCase().includes(q)
        )
      }),
    [drivers, driverSearch],
  )

  const remoteJobs = useMemo(() => {
    if (remoteFilter === '3pl') return uncoveredJobs.filter((j) => (j.pickup_owner_type || '') === '3pl')
    if (remoteFilter === 'uncovered') return uncoveredJobs.filter((j) => (j.pickup_owner_type || '') === 'uncovered')
    if (remoteFilter === 'unresolved') return uncoveredJobs.filter((j) => !String(j.pickup_owner_type || '').trim())
    return uncoveredJobs
  }, [uncoveredJobs, remoteFilter])

  function renderAssign() {
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Damien dispatch plan"
          description="First-mile locks to the origin delivery point / drop. Last-mile matches the receiver address to an Area under the destination delivery point, then assigns that Area’s dispatcher."
        />

        <Card size="small" title="Load consignment">
          <Form layout="vertical" onFinish={loadCn}>
            <Row gutter={12} align="bottom">
              <Col xs={24} md={16}>
                <Form.Item label="Consignment No" style={{ marginBottom: 0 }}>
                  <Input
                    value={cnInput}
                    onChange={(e) => setCnInput(e.target.value.toUpperCase())}
                    placeholder="CN number"
                    allowClear
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Button type="primary" htmlType="submit" block icon={<SearchOutlined />} style={{ background: BRAND, borderColor: BRAND }}>
                  Load
                </Button>
              </Col>
            </Row>
          </Form>
        </Card>

        {cn ? (
          <>
            <Card size="small" title={`Consignment ${cn.cnNo || cnNo}`}>
              <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Status">{cn.cnStatus || cn.status || '—'}</Descriptions.Item>
                <Descriptions.Item label="Origin DP">{cn.originZone || cn.origin_zone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Dest DP">{cn.destinationZone || cn.destination_zone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Dest Area">
                  {planInfo?.path?.destinationArea || cn.destination_area_code || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Last-mile dispatcher">
                  {planInfo?.path?.deliveryDispatcherName || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Coverage">
                  {planInfo?.path?.coverageType || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Pickup target">
                  {planInfo?.path?.pickupTargetLat != null
                    ? `${Number(planInfo.path.pickupTargetLat).toFixed(5)}, ${Number(planInfo.path.pickupTargetLng).toFixed(5)}`
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Delivery target">
                  {planInfo?.path?.deliveryTargetLat != null
                    ? `${Number(planInfo.path.deliveryTargetLat).toFixed(5)}, ${Number(planInfo.path.deliveryTargetLng).toFixed(5)}`
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Suggested pickup">
                  {planInfo?.staff?.pickup?.fullName || '—'}
                  {planInfo?.staff?.pickup?.distanceKm != null
                    ? ` · ${Number(planInfo.staff.pickup.distanceKm).toFixed(1)} km · score ${planInfo.staff.pickup.matchScore}`
                    : planInfo?.staff?.pickup?.matchScore != null
                      ? ` · score ${planInfo.staff.pickup.matchScore}`
                      : ''}
                </Descriptions.Item>
                <Descriptions.Item label="Suggested delivery">
                  {planInfo?.staff?.delivery?.fullName || '—'}
                  {planInfo?.staff?.delivery?.distanceKm != null
                    ? ` · ${Number(planInfo.staff.delivery.distanceKm).toFixed(1)} km · score ${planInfo.staff.delivery.matchScore}`
                    : planInfo?.staff?.delivery?.matchScore != null
                      ? ` · score ${planInfo.staff.delivery.matchScore}`
                      : ''}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Assign to driver">
              <Row gutter={12} align="bottom">
                <Col xs={24} md={6}>
                  <Form.Item label="Job type" style={{ marginBottom: 0 }}>
                    <Select
                      value={jobType}
                      onChange={setJobType}
                      options={[
                        { value: 'delivery', label: 'Delivery' },
                        { value: 'pickup', label: 'Pickup' },
                        { value: 'pipeline', label: 'Pipeline' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Driver"
                    style={{ marginBottom: 0 }}
                    extra="Available drivers from t_driver. After plan, nearer drivers score higher when coords exist."
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      value={driverId || undefined}
                      placeholder="Select a driver"
                      onChange={setDriverId}
                      options={drivers.map((d) => ({
                        value: driverKey(d),
                        label: driverLabel(d),
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button
                      type="primary"
                      block
                      loading={busy}
                      onClick={onAssign}
                      style={{ background: BRAND, borderColor: BRAND }}
                    >
                      Assign driver
                    </Button>
                    <Button block icon={<ThunderboltOutlined />} loading={busy} onClick={onAuto}>
                      Auto-assign / plan
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>
          </>
        ) : (
          <Empty description="Enter a CN and click Load to plan first/last-mile assignment." />
        )}

        <Card
          size="small"
          title={
            <Space>
              <span>Unassigned dispatch jobs</span>
              <Badge count={jobs.length} style={{ backgroundColor: '#1668DC' }} />
            </Space>
          }
        >
          <DataTable
            loading={loading}
            dataSource={jobs}
            rowKey={(r) => cnKeyOf(r) || JSON.stringify(r)}
            pagination={{ pageSize: 10 }}
            onRow={(record) => ({
              onClick: () => {
                const key = cnKeyOf(record)
                if (!key) return
                setCnInput(key)
                setParams({ tab: 'assign', cn_no: key }, { replace: true })
                setCnNo(key)
              },
              style: { cursor: 'pointer' },
            })}
            columns={[
              {
                title: 'CN',
                key: 'cn',
                render: (_, r) => (
                  <Text code style={{ color: BRAND }}>{cnKeyOf(r)}</Text>
                ),
              },
              {
                title: 'Status',
                key: 'status',
                render: (_, r) => <StatusTag status={r.cn_status || r.status || 'OPEN'} />,
              },
              {
                title: 'Route',
                key: 'route',
                render: (_, r) => `${r.cn_origin || r.origin || '—'} → ${r.cn_dstn || r.destination || '—'}`,
              },
              {
                title: 'Job',
                key: 'job',
                render: (_, r) => r.job_type || r.jobType || '—',
              },
            ]}
            locale={{ emptyText: 'No unassigned dispatch jobs' }}
          />
        </Card>
      </Space>
    )
  }

  function renderRemote() {
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Remote / 3PL pickup queue"
          description="Uncovered and third-party pickups stay here. Auto-assign never picks the nearest own DP for these CNs. Use Resolve coverage, or manually assign a 3PL partner."
        />

        <Space wrap>
          {REMOTE_FILTERS.map((f) => (
            <Button
              key={f.key}
              type={remoteFilter === f.key ? 'primary' : 'default'}
              style={remoteFilter === f.key ? { background: BRAND, borderColor: BRAND } : undefined}
              onClick={() => {
                const next = { tab: 'remote' }
                if (f.key !== 'all') next.remote = f.key
                setParams(next, { replace: true })
              }}
            >
              {f.label}
              {f.key === 'all' ? ` (${uncoveredJobs.length})` : ''}
            </Button>
          ))}
          <Link to="/ops/dispatch?tab=assign">Driver assignment →</Link>
        </Space>

        <DataTable
          loading={loading}
          dataSource={remoteJobs}
          rowKey={(r) => cnKeyOf(r)}
          pagination={{ pageSize: 15 }}
          columns={[
            {
              title: 'CN',
              key: 'cn',
              render: (_, r) => {
                const key = cnKeyOf(r)
                return (
                  <div>
                    <Link to={`/ops/dispatch?tab=assign&cn_no=${encodeURIComponent(key)}`}>
                      <Text code style={{ color: BRAND }}>{key}</Text>
                    </Link>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>{r.cn_status || ''}</Text></div>
                  </div>
                )
              },
            },
            {
              title: 'Owner',
              key: 'owner',
              render: (_, r) => {
                const owner = String(r.pickup_owner_type || '')
                if (owner === '3pl') return <Tag color="cyan">3PL</Tag>
                if (owner === 'uncovered') return <Tag color="gold">Uncovered</Tag>
                return <Tag>Unresolved</Tag>
              },
            },
            {
              title: 'Coverage / area',
              key: 'area',
              render: (_, r) => (
                <div>
                  <div>{r.area_code || '—'}</div>
                  {r.area_name ? <Text type="secondary" style={{ fontSize: 12 }}>{r.area_name}</Text> : null}
                </div>
              ),
            },
            {
              title: 'Origin / sender',
              key: 'origin',
              render: (_, r) => (
                <div>
                  <div>
                    {r.cn_origin || '—'}
                    {r.origin_zone ? <Text type="secondary"> / {r.origin_zone}</Text> : null}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.sender_address || r.consigner || r.sender_name || ''}
                  </Text>
                </div>
              ),
            },
            {
              title: '3PL',
              key: 'partner',
              render: (_, r) => r.partner_name || r.partner_code || '—',
            },
            {
              title: 'Actions',
              key: 'actions',
              width: 320,
              render: (_, r) => {
                const key = cnKeyOf(r)
                const owner = String(r.pickup_owner_type || '')
                return (
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Button
                      size="small"
                      loading={remoteBusy === key}
                      onClick={() => resolveCoverage(key)}
                    >
                      Resolve coverage
                    </Button>
                    {owner !== '3pl' ? (
                      <Space.Compact style={{ width: '100%' }}>
                        <Select
                          size="small"
                          style={{ flex: 1, minWidth: 140 }}
                          placeholder="3PL partner"
                          value={partnerByCn[key] || undefined}
                          onChange={(v) => setPartnerByCn((prev) => ({ ...prev, [key]: v }))}
                          options={partners.map((p) => ({
                            value: String(p.id),
                            label: `${p.partner_code || p.code || p.id} — ${p.partner_name || p.name || ''}`,
                          }))}
                        />
                        <Button
                          size="small"
                          type="primary"
                          loading={remoteBusy === key}
                          style={{ background: BRAND, borderColor: BRAND }}
                          onClick={() => onAssign3pl(key)}
                        >
                          Assign 3PL
                        </Button>
                      </Space.Compact>
                    ) : null}
                  </Space>
                )
              },
            },
          ]}
          locale={{ emptyText: 'No CNs in this remote queue' }}
        />
      </Space>
    )
  }

  function renderDrivers() {
    return (
      <Card size="small">
        <Input
          placeholder="Search driver by name, phone, branch…"
          value={driverSearch}
          onChange={(e) => setDriverSearch(e.target.value)}
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          style={{ marginBottom: 12, maxWidth: 360 }}
          allowClear
        />
        <DataTable
          loading={loading}
          dataSource={filteredDrivers}
          rowKey={(r) => driverKey(r) || JSON.stringify(r)}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: 'Driver',
              key: 'name',
              render: (_, d) => (
                <Space>
                  <Avatar size="small" style={{ backgroundColor: BRAND }} icon={<UserOutlined />} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.fullName || d.full_name || d.name || '—'}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>ID {driverKey(d)}</Text>
                  </div>
                </Space>
              ),
            },
            {
              title: 'Phone',
              key: 'phone',
              render: (_, d) => (
                <span>
                  <PhoneOutlined style={{ marginRight: 4 }} />
                  {d.phone || '—'}
                </span>
              ),
            },
            {
              title: 'Location / route',
              key: 'loc',
              render: (_, d) => `${d.locId || d.loc_id || d.branchCode || '—'} · ${d.routeCd || d.route_cd || 'Floating'}`,
            },
            {
              title: 'Status',
              key: 'status',
              render: () => <StatusTag status="ACTIVE" text="Available" />,
            },
          ]}
          locale={{ emptyText: 'No available drivers' }}
        />
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
            Dispatch & Fleet Control
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
            Damien driver assignment (plan + auto-assign), remote/3PL coverage, and available courier roster.
            First-mile pickup batching lives under{' '}
            <Link to="/ops/pickups">Pickups Queue</Link>.
          </Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadLists} loading={loading}>
          Refresh
        </Button>
      </div>

      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={selectTab}
          items={[
            {
              key: 'assign',
              label: (
                <Space>
                  <CarOutlined />
                  <span>Driver assignment</span>
                </Space>
              ),
              children: renderAssign(),
            },
            {
              key: 'remote',
              label: (
                <Space>
                  <GlobalOutlined />
                  <span>Remote / 3PL</span>
                  <Badge count={uncoveredJobs.length} overflowCount={99} style={{ backgroundColor: '#D97706' }} />
                </Space>
              ),
              children: renderRemote(),
            },
            {
              key: 'drivers',
              label: (
                <Space>
                  <UserOutlined />
                  <span>Drivers</span>
                  <Badge count={drivers.length} overflowCount={999} style={{ backgroundColor: BRAND }} />
                </Space>
              ),
              children: renderDrivers(),
            },
          ]}
        />
      </Card>
    </div>
  )
}
