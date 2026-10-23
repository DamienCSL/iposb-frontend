import React, { useEffect, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FireOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  apiError,
  assignPickup,
  autoAssignPickups,
  getDispatchDrivers,
  getPickupsQueue,
  getPickupsWaiting,
  listMaster,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { isDroppointManager } from '../../auth/rbac'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

export default function PickupsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { can, isAdmin, user } = useAuth()
  const isDpManager = isDroppointManager(user?.role)
  const canAssign = isAdmin
    || ['Operation', 'Super Admin', 'Admin', 'Droppoint Manager', 'Hub Manager', 'Storekeeper'].includes(user?.role)
    || can('pickups')
    || can('dispatch')

  const tabFromUrl = params.get('tab') || 'waiting'
  const activeTab = ['waiting', 'queue'].includes(tabFromUrl) ? tabFromUrl : 'waiting'
  const [loading, setLoading] = useState(false)

  // Data lists
  const [waitingList, setWaitingList] = useState([])
  const [queueList, setQueueList] = useState([])
  const [drivers, setDrivers] = useState([])
  const [dropPoints, setDropPoints] = useState([])
  const [zones, setZones] = useState([])
  const [locations, setLocations] = useState([])

  // Manual Assign Modal
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [selectedCn, setSelectedCn] = useState(null)
  const [selectedPickup, setSelectedPickup] = useState(null)
  const [assignForm] = Form.useForm()
  const [assigning, setAssigning] = useState(false)

  // Auto-Assign Modal & Result State
  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [autoForm] = Form.useForm()
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoResult, setAutoResult] = useState(null)

  async function loadData() {
    setLoading(true)
    try {
      const [waitingRes, queueRes, drvRes, dpRes, zoneRes, branchRes, hubRes] = await Promise.all([
        getPickupsWaiting().catch(() => ({ data: [] })),
        getPickupsQueue().catch(() => ({ data: [] })),
        getDispatchDrivers().catch(() => []),
        listMaster('drop-points').catch(() => ({ data: [] })),
        listMaster('zones').catch(() => ({ data: [] })),
        listMaster('branches').catch(() => ({ data: [] })),
        listMaster('hubs').catch(() => ({ data: [] })),
      ])

      setWaitingList(waitingRes?.data || waitingRes?.consignments || waitingRes?.rows || [])
      setQueueList(queueRes?.data || queueRes?.consignments || queueRes?.rows || [])
      setDrivers(Array.isArray(drvRes) ? drvRes : drvRes?.drivers || [])
      setDropPoints(dpRes?.data || dpRes?.rows || [])
      const locationRows = [
        ...(branchRes?.data || branchRes?.rows || []),
        ...(hubRes?.data || hubRes?.rows || []),
      ]
      setLocations(locationRows)
      const zoneRows = zoneRes?.data || zoneRes?.rows || []
      setZones(zoneRows.length > 0 ? zoneRows : locationRows.map((location) => ({
        zone_code: location.branch_code || location.hub_code || location.loc_id || location.code,
        zone_name: location.branch_name || location.hub_name || location.loc_name || location.name,
      })))
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Manual Assign
  function openManualAssign(record) {
    setSelectedCn(record.cn_no || record.consignment_no || record.id)
    setSelectedPickup(record)
    assignForm.resetFields()
    setManualModalOpen(true)
  }

  async function handleManualSubmit(values) {
    if (!selectedCn) return
    if (!values.driver_id && !values.dp_code) {
      message.warning(canAssignDropPoint(selectedPickup)
        ? 'Select a courier or a drop point station.'
        : 'Select a courier to collect this pickup / seal.')
      return
    }
    setAssigning(true)
    try {
      const res = await assignPickup(selectedCn, values)
      const sealNo = res?.seal_no || res?.sealNo
      const members = res?.member_cns || res?.memberCnNos
      message.success(
        sealNo
          ? `Seal ${sealNo} assigned${Array.isArray(members) ? ` (${members.length} CN)` : ''}`
          : `Pickup for ${selectedCn} assigned successfully`,
      )
      setManualModalOpen(false)
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setAssigning(false)
    }
  }

  function pickupTokens(record) {
    return [
      record?.origin_zone,
      record?.agent_cd,
      record?.origin_drop_code,
      record?.origin_delivery_point,
      record?.origin_branch,
      record?.from_branch,
    ]
      .map((v) => String(v || '').trim().toUpperCase())
      .filter(Boolean)
  }

  function driverPreferredTokens(driver) {
    const prefs = driver.preferredZones || driver.preferred_zones || []
    const list = Array.isArray(prefs)
      ? prefs
      : String(prefs || '').split(/[,|;]+/)
    return [
      ...list.map((v) => String(v || '').trim().toUpperCase()),
      String(driver.locId || driver.loc_id || '').trim().toUpperCase(),
      String(driver.routeCd || driver.route_cd || '').trim().toUpperCase(),
    ].filter(Boolean)
  }

  function alreadyAtDropPoint(record) {
    if (!record) return false
    if (record.already_at_drop_point === true || record.alreadyAtDropPoint === true) return true
    const svc = String(record.origin_service || record.originService || '').toUpperCase()
    const dropId = Number(record.origin_drop_point_id || record.originDropPointId || 0)
    return dropId > 0 || svc === 'DROP_COUNTER'
  }

  function canAssignDropPoint(record) {
    if (!record) return true
    if (record.can_assign_drop_point === false || record.canAssignDropPoint === false) return false
    if (alreadyAtDropPoint(record)) return false
    const svc = String(record.origin_service || record.originService || '').toUpperCase()
    return svc !== 'DROP_COUNTER'
  }

  const matchedDrivers = drivers.filter((driver) => {
    if (!selectedPickup) return true
    const homeDp = Number(driver.homeDropPointId || driver.home_drop_point_id || 0)
    const originDp = Number(selectedPickup.origin_drop_point_id || selectedPickup.originDropPointId || 0)
    if (homeDp > 0 && originDp > 0 && homeDp === originDp) return true

    const tokens = pickupTokens(selectedPickup)
    const prefs = driverPreferredTokens(driver)
    if (tokens.length === 0 || prefs.length === 0) {
      const origin = String(selectedPickup.origin_branch || selectedPickup.from_branch || '').trim().toUpperCase()
      const driverBranch = String(driver.locId || driver.loc_id || '').trim().toUpperCase()
      return !origin || !driverBranch || origin === driverBranch
    }
    return tokens.some((t) => prefs.includes(t))
  })
  // If zone metadata is incomplete, still let ops pick any available courier rather than an empty list.
  const compatibleDrivers = matchedDrivers.length > 0 ? matchedDrivers : drivers

  // Auto-Assign Submit
  async function handleAutoAssignSubmit(values) {
    setAutoAssigning(true)
    try {
      const res = await autoAssignPickups(values)
      const count = res?.assigned ?? res?.assigned_count ?? res?.total_assigned ?? 0
      message.success(res?.message || `Auto-assigned ${count} pickups`)
      setAutoResult(res)
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setAutoAssigning(false)
    }
  }

  function selectPickupTab(next) {
    setParams(next === 'waiting' ? {} : { tab: next }, { replace: true })
  }

  const waitingColumns = [
    {
      title: 'CN Number',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (val, r) => (
        <span
          style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A', cursor: 'pointer' }}
          onClick={() => navigate(`/ops/consignments/tracking?cn=${encodeURIComponent(val || r.id)}&tab=${encodeURIComponent(val || r.id)}`)}
        >
          {val || r.id}
        </span>
      ),
    },
    {
      title: 'Shipper',
      dataIndex: 'sender_name',
      key: 'sender_name',
      render: (val, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{val || r.consigner || r.senderName || r.cust_name || '—'}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>
            {r.consignee_name || r.consignee || r.origin_addr || r.senderAddress || '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Origin',
      dataIndex: 'from_branch',
      key: 'from_branch',
      render: (v, r) => (
        <div>
          <Tag color="blue">{v || r.origin_branch || r.origin_zone || '—'}</Tag>
          {r.origin_drop_code || r.origin_drop_name ? (
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
              Drop {r.origin_drop_code || ''}{r.origin_drop_name ? ` · ${r.origin_drop_name}` : ''}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Collect as',
      key: 'collect_unit',
      render: (_, r) => {
        const sealed = r.is_sealed || (r.seal_no && ['sealed', 'in_transit', 'arrived'].includes(String(r.seal_lifecycle || '').toLowerCase()))
        if (sealed) {
          return (
            <Tag color="purple">
              Seal {r.seal_no}{r.seal_cn_count ? ` · ${r.seal_cn_count} CN` : ''}
            </Tag>
          )
        }
        if (alreadyAtDropPoint(r)) {
          return <Tag color="cyan">At drop point</Tag>
        }
        return <Tag>CN pickup</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'cn_status',
      key: 'cn_status',
      render: (v) => <StatusTag status={v || 'WAITING_PICKUP'} />,
    },
    {
      title: 'Ready Since',
      dataIndex: 'cn_date',
      key: 'cn_date',
      render: (v, r) => (
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          {v || r.pu_dt || (r.created_at ? String(r.created_at).slice(0, 16) : '—')}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          icon={<SendOutlined />}
          disabled={!canAssign}
          onClick={() => openManualAssign(r)}
          style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
        >
          Assign
        </Button>
      ),
    },
  ]

  const queueColumns = [
    {
      title: 'CN Number',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (val, r) => (
        <span
          style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A', cursor: 'pointer' }}
          onClick={() => navigate(`/ops/consignments/tracking?cn=${encodeURIComponent(val || r.id)}&tab=${encodeURIComponent(val || r.id)}`)}
        >
          {val || r.id}
        </span>
      ),
    },
    {
      title: 'Assigned Courier / DP',
      key: 'agent',
      render: (_, r) => {
        const isDp = Boolean(r.dp_code || r.dp_id || r.drop_point_name)
        const name = r.driver_name || r.courier_name || r.drop_point_name || r.dp_code || r.agent_name || 'Assigned'
        return (
          <Space>
            <Avatar
              size="small"
              icon={isDp ? <EnvironmentOutlined /> : <CarOutlined />}
              style={{ backgroundColor: isDp ? '#0891B2' : '#1668DC' }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {isDp ? `Drop Point${r.assignment_type ? ` · ${r.assignment_type}` : ''}` : `Field Courier${r.assignment_type ? ` · ${r.assignment_type}` : ''}`}
              </div>
            </div>
          </Space>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v, r) => <StatusTag status={v || r.cn_status || 'ASSIGNED'} />,
    },
    {
      title: 'Assigned At',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      render: (v) => <span style={{ fontSize: 12, color: '#6B7280' }}>{v ? String(v).slice(0, 16) : 'Just now'}</span>,
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, r) => (
        <Button
          size="small"
          onClick={() => openManualAssign(r)}
          disabled={!canAssign}
        >
          Reassign
        </Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0F1B2D', letterSpacing: '-0.3px' }}>
            Pickup Assignment Queue
          </h2>
          <div style={{ fontSize: 12, color: '#5B6B7C', marginTop: 2 }}>
            First-mile waiting / assigned pickups (Damien `/ops/pickups*`). For plan + last-mile + 3PL use{' '}
            <Link to="/ops/dispatch?tab=assign">Dispatch & 3PL</Link>.
          </div>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          {canAssign && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => {
                autoForm.resetFields()
                setAutoResult(null)
                const homeDp = dropPoints.find(
                  (dp) => Number(dp.id) === Number(user?.homeDropPointId || 0)
                )
                if (isDpManager && homeDp?.drop_code) {
                  autoForm.setFieldsValue({
                    dp_code: homeDp.drop_code,
                    max_per_courier: 15,
                  })
                }
                setAutoModalOpen(true)
              }}
              style={{ background: '#1668DC', borderColor: '#1668DC' }}
            >
              {isDpManager ? 'Auto-Batch Outbound' : 'Batch Auto-Assign'}
            </Button>
          )}
        </Space>
      </div>

      {/* KPI Overview Strip */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Waiting Pickup"
              value={waitingList.length}
              valueStyle={{ color: '#D97706', fontWeight: 700 }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Active In Queue"
              value={queueList.length}
              valueStyle={{ color: '#1668DC', fontWeight: 700 }}
              prefix={<CarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Available Couriers"
              value={drivers.length}
              valueStyle={{ color: '#1B8A5A', fontWeight: 700 }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Active Drop Points"
              value={dropPoints.length}
              valueStyle={{ color: '#0891B2', fontWeight: 700 }}
              prefix={<EnvironmentOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs Container */}
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={selectPickupTab}
          items={[
            {
              key: 'waiting',
              label: (
                <Space>
                  <span>Waiting Pickups</span>
                  <Badge count={waitingList.length} style={{ backgroundColor: '#D97706' }} />
                </Space>
              ),
              children: (
                <DataTable
                  columns={waitingColumns}
                  dataSource={waitingList}
                  rowKey="cn_no"
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: 'No pending pickup jobs waiting for assignment' }}
                />
              ),
            },
            {
              key: 'queue',
              label: (
                <Space>
                  <span>Assigned Queue</span>
                  <Badge count={queueList.length} style={{ backgroundColor: '#1668DC' }} />
                </Space>
              ),
              children: (
                <DataTable
                  columns={queueColumns}
                  dataSource={queueList}
                  rowKey="cn_no"
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: 'No assigned pickups currently active in queue' }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Manual Assignment Modal */}
      <Modal
        title={`Assign Pickup — CN ${selectedCn}`}
        open={manualModalOpen}
        onCancel={() => setManualModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={assignForm} layout="vertical" onFinish={handleManualSubmit}>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
            {selectedPickup?.seal_no && (selectedPickup?.is_sealed || ['sealed', 'in_transit', 'arrived'].includes(String(selectedPickup?.seal_lifecycle || '').toLowerCase())) ? (
              <>
                This consignment is in sealed bag <Tag color="purple">{selectedPickup.seal_no}</Tag>
                {selectedPickup.seal_cn_count ? ` (${selectedPickup.seal_cn_count} CN)` : ''}.
                Assigning a courier offers the <strong>seal</strong> as one collect job.
              </>
            ) : alreadyAtDropPoint(selectedPickup) ? (
              <>
                Parcel is already at drop point
                {selectedPickup?.origin_drop_code ? ` ${selectedPickup.origin_drop_code}` : ''}.
                Assign a courier to collect it — do not re-assign to another drop point.
              </>
            ) : (
              <>Select an available courier{canAssignDropPoint(selectedPickup) ? ', or hand the pickup to a drop point station' : ''}.</>
            )}
          </div>

          <Form.Item
            label="Assign Courier Driver"
            name="driver_id"
            extra={compatibleDrivers.length === 0 ? 'No courier matches this origin / preferred zone / home drop point.' : undefined}
          >
            <Select
              placeholder={compatibleDrivers.length ? 'Search courier…' : 'No matching couriers'}
              allowClear
              showSearch
              optionFilterProp="label"
              options={compatibleDrivers.map((d) => ({
                label: `${d.full_name || d.fullName || d.name || `Driver ${d.driver_id || d.driverId || d.id}`} (${d.route_cd || d.routeCd || 'Floating'}${d.locId || d.loc_id ? ` · ${d.locId || d.loc_id}` : ''}${d.homeDropPointId || d.home_drop_point_id ? ` · home DP #${d.homeDropPointId || d.home_drop_point_id}` : ''})`,
                value: d.driver_id || d.driverId || d.id,
              }))}
            />
          </Form.Item>

          {canAssignDropPoint(selectedPickup) ? (
            <>
              <Divider plain style={{ margin: '8px 0 16px 0', fontSize: 12, color: '#9CA3AF' }}>OR</Divider>

              <Form.Item label="Assign Drop Point Station" name="dp_code">
                <Select
                  placeholder="Choose a drop point station"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={dropPoints.map((dp) => ({
                    label: `${dp.drop_name} (${dp.drop_code})`,
                    value: dp.drop_code,
                  }))}
                />
              </Form.Item>
            </>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button onClick={() => setManualModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={assigning}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              Confirm Assignment
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Batch Auto-Assign Modal */}
      <Modal
        title={<Space><ThunderboltOutlined style={{ color: '#1668DC' }} /> Load-Balanced Batch Auto-Assign</Space>}
        open={autoModalOpen}
        onCancel={() => setAutoModalOpen(false)}
        footer={null}
        width={560}
      >
        <Form form={autoForm} layout="vertical" onFinish={handleAutoAssignSubmit}>
          <Paragraph style={{ fontSize: 13, color: '#5B6B7C' }}>
            {isDpManager
              ? 'Auto-batch outbound consignments from your drop point to matching couriers. Sealed baby bags are assigned as one pickup job.'
              : 'Auto-assign unassigned consignments to available couriers in the specified zone. The system applies equalized round-robin load distribution.'}
          </Paragraph>

          {!isDpManager ? (
            <Row gutter={12}>
              <Col span={10}>
                <Form.Item label="Target Branch / Hub" name="branch_code">
                  <Select
                    placeholder="All locations"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={locations.map((location) => {
                      const code = location.branch_code || location.hub_code || location.loc_id || location.code
                      const name = location.branch_name || location.hub_name || location.loc_name || location.name || code
                      return { label: `${name} (${code})`, value: code }
                    }).filter((option) => option.value)}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Target Zone" name="zone_code">
                  <Select
                    placeholder="Select zone (optional)"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={zones.map((z) => {
                      const code = z.zone_code || z.delivery_point_code || z.area_code
                      const name = z.zone_name || z.delivery_point_name || z.area_name || code
                      return { label: `${name} (${code})`, value: code }
                    }).filter((option) => option.value)}
                  />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item
                  label="Max per Courier"
                  name="max_per_courier"
                  initialValue={15}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <Form.Item
              label="Max per Courier"
              name="max_per_courier"
              initialValue={15}
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          )}

          <Form.Item
            label={isDpManager ? 'Your Drop Point' : 'Restricted to Drop Point (Optional)'}
            name="dp_code"
            rules={isDpManager ? [{ required: true, message: 'Home drop point required' }] : undefined}
          >
            <Select
              placeholder={isDpManager ? 'Home drop point' : 'All Drop Points'}
              allowClear={!isDpManager}
              disabled={isDpManager}
              options={dropPoints.map((dp) => ({
                label: `${dp.drop_name} (${dp.drop_code})`,
                value: dp.drop_code,
              }))}
            />
          </Form.Item>

          {/* Per-courier breakdown card (strictly required by PRD 6.7) */}
          {autoResult && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                background: '#F0FDF4',
                borderColor: '#BBF7D0',
                borderRadius: 6,
              }}
            >
              <div style={{ fontWeight: 600, color: '#166534', marginBottom: 8 }}>
                Assignment Results ({autoResult.assigned ?? autoResult.assigned_count ?? autoResult.total_assigned ?? 0} consignments
                {autoResult.skipped ? `, ${autoResult.skipped} skipped` : ''}):
              </div>
              <div style={{ fontSize: 12, color: '#374151' }}>
                {autoResult.couriers && Object.keys(autoResult.couriers).length > 0 ? (
                  <Descriptions column={1} size="small">
                    {Object.entries(autoResult.couriers).map(([name, count]) => (
                      <Descriptions.Item key={name} label={name}>
                        <Tag color="green"><strong>{count}</strong> parcels assigned</Tag>
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                ) : (
                  <Text type="secondary">No unassigned parcels matched criteria</Text>
                )}
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setAutoModalOpen(false)}>Close</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={autoAssigning}
              style={{ background: '#1668DC', borderColor: '#1668DC' }}
            >
              Execute Auto-Assign
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
