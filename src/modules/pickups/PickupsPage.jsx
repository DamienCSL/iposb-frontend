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
import { useNavigate } from 'react-router-dom'
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
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

export default function PickupsPage() {
  const navigate = useNavigate()
  const { can, isAdmin, user } = useAuth()
  const canAssign = isAdmin || ['Operation', 'Super Admin', 'Admin', 'Droppoint Manager', 'Hub Manager'].includes(user?.role)

  const [activeTab, setActiveTab] = useState('waiting') // 'waiting' | 'queue'
  const [loading, setLoading] = useState(false)

  // Data lists
  const [waitingList, setWaitingList] = useState([])
  const [queueList, setQueueList] = useState([])
  const [drivers, setDrivers] = useState([])
  const [dropPoints, setDropPoints] = useState([])
  const [zones, setZones] = useState([])

  // Manual Assign Modal
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [selectedCn, setSelectedCn] = useState(null)
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
      const [waitingRes, queueRes, drvRes, dpRes, zoneRes] = await Promise.all([
        getPickupsWaiting().catch(() => ({ data: [] })),
        getPickupsQueue().catch(() => ({ data: [] })),
        getDispatchDrivers().catch(() => []),
        listMaster('drop-points').catch(() => ({ data: [] })),
        listMaster('zones').catch(() => ({ data: [] })),
      ])

      setWaitingList(waitingRes?.data || waitingRes?.consignments || waitingRes?.rows || [])
      setQueueList(queueRes?.data || queueRes?.consignments || queueRes?.rows || [])
      setDrivers(Array.isArray(drvRes) ? drvRes : drvRes?.drivers || [])
      setDropPoints(dpRes?.data || dpRes?.rows || [])
      setZones(zoneRes?.data || zoneRes?.rows || [])
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
    setSelectedCn(record.cn_no || record.id)
    assignForm.resetFields()
    setManualModalOpen(true)
  }

  async function handleManualSubmit(values) {
    if (!selectedCn) return
    setAssigning(true)
    try {
      await assignPickup(selectedCn, values)
      message.success(`Pickup for ${selectedCn} assigned successfully`)
      setManualModalOpen(false)
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setAssigning(false)
    }
  }

  // Auto-Assign Submit
  async function handleAutoAssignSubmit(values) {
    setAutoAssigning(true)
    try {
      const res = await autoAssignPickups(values)
      message.success(`Auto-assigned ${res?.assigned_count || res?.total_assigned || 0} pickups`)
      setAutoResult(res)
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setAutoAssigning(false)
    }
  }

  const waitingColumns = [
    {
      title: 'CN Number',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (val, r) => (
        <span
          style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A', cursor: 'pointer' }}
          onClick={() => navigate(`/ops/consignments/${encodeURIComponent(val || r.id)}`)}
        >
          {val || r.id}
        </span>
      ),
    },
    {
      title: 'Pickup Address / Shipper',
      dataIndex: 'consigner',
      key: 'consigner',
      render: (val, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{val || r.senderName || r.cust_name || '—'}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{r.origin_addr || r.senderAddress || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Origin Zone',
      dataIndex: 'origin_zone',
      key: 'origin_zone',
      render: (v) => <Tag color="blue">{v || 'DEFAULT'}</Tag>,
    },
    {
      title: 'Parcels',
      key: 'parcels',
      render: (_, r) => `${r.cn_pcs || 1} pcs (${r.cn_wt || 1} kg)`,
    },
    {
      title: 'Ready Since',
      dataIndex: 'pu_dt',
      key: 'pu_dt',
      render: (v, r) => (
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          {v || (r.created_at ? String(r.created_at).slice(0, 16) : '—')}
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
          onClick={() => navigate(`/ops/consignments/${encodeURIComponent(val || r.id)}`)}
        >
          {val || r.id}
        </span>
      ),
    },
    {
      title: 'Assigned Courier / DP',
      key: 'agent',
      render: (_, r) => {
        const name = r.driver_name || r.courier_name || r.drop_point_name || r.agent_name || 'Assigned'
        const isDp = Boolean(r.drop_point_name)
        return (
          <Space>
            <Avatar
              size="small"
              icon={isDp ? <EnvironmentOutlined /> : <CarOutlined />}
              style={{ backgroundColor: isDp ? '#0891B2' : '#1668DC' }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{isDp ? 'Drop Point' : 'Field Courier'}</div>
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
            Dispatch fleet couriers and route pickup jobs from booking clients.
          </div>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
          {canAssign && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => {
                autoForm.resetFields()
                setAutoResult(null)
                setAutoModalOpen(true)
              }}
              style={{ background: '#1668DC', borderColor: '#1668DC' }}
            >
              Batch Auto-Assign
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
          onChange={(k) => setActiveTab(k)}
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
            Select either an available courier or a local station drop point to handle the pickup:
          </div>

          <Form.Item label="Assign Courier Driver" name="driver_id">
            <Select
              placeholder="Choose a courier driver"
              allowClear
              options={drivers.map((d) => ({
                label: `${d.full_name || d.name} (${d.route_cd || 'Floating'})`,
                value: d.driver_id || d.id,
              }))}
            />
          </Form.Item>

          <Divider plain style={{ margin: '8px 0 16px 0', fontSize: 12, color: '#9CA3AF' }}>OR</Divider>

          <Form.Item label="Assign Drop Point Station" name="dp_code">
            <Select
              placeholder="Choose a drop point station"
              allowClear
              options={dropPoints.map((dp) => ({
                label: `${dp.drop_name} (${dp.drop_code})`,
                value: dp.drop_code,
              }))}
            />
          </Form.Item>

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
            Auto-assign unassigned consignments to available couriers in the specified zone.
            The system applies equalized round-robin load distribution.
          </Paragraph>

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="Target Zone" name="zone_code">
                <Select
                  placeholder="Select zone (optional)"
                  allowClear
                  options={zones.map((z) => ({
                    label: `${z.zone_name || z.zone_code} (${z.zone_code})`,
                    value: z.zone_code,
                  }))}
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

          <Form.Item label="Restricted to Drop Point (Optional)" name="dp_code">
            <Select
              placeholder="All Drop Points"
              allowClear
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
                Assignment Results ({autoResult.assigned_count || autoResult.total_assigned || 0} consignments):
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
