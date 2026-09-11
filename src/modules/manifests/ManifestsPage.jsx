import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import {
  api,
  apiError,
  attachManifestConsignments,
  createManifest,
  detachManifestConsignment,
  getManifest,
  listManifests,
  listMaster,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import ListPageLayout from '../../components/ListPageLayout'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

const SYSTEM_DEFAULTS = [
  { code: 'BKI', name: 'Kota Kinabalu Hub (Gateway)' },
  { code: 'KUL', name: 'Headquarters Gateway' },
  { code: 'TWU', name: 'Tawau Branch' },
  { code: 'SDK', name: 'Sandakan Hub' },
  { code: 'KCH', name: 'Kuching Hub / Branch' },
  { code: 'PEN', name: 'Penang Branch' },
  { code: 'JHB', name: 'Johor Bahru Branch' },
  { code: 'IPH', name: 'Ipoh Branch' },
  { code: 'KTN', name: 'Kuantan Branch' },
]

export default function ManifestsPage() {
  const { mfg: routeMfg } = useParams()
  const navigate = useNavigate()
  const { can, isAdmin, user } = useAuth()
  const canOperate = isAdmin || ['Operation', 'Hub Manager', 'Super Admin', 'Admin'].includes(user?.role)

  const [manifests, setManifests] = useState([])
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])

  // Detail Drawer / Modal
  const [activeMfg, setActiveMfg] = useState(routeMfg || null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [attachCnInput, setAttachCnInput] = useState('')
  const [attaching, setAttaching] = useState(false)

  // Create Manifest Modal
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm()

  const branchOptions = useMemo(() => {
    const nodeMap = new Map()
    SYSTEM_DEFAULTS.forEach((d) => nodeMap.set(d.code, { label: `${d.name} (${d.code})`, value: d.code }))

    branches.forEach((b) => {
      const code = b.branch_code || b.hub_code || b.code
      const name = b.branch_name || b.hub_name || b.name || code
      if (code) {
        nodeMap.set(code, { label: `${name} (${code})`, value: code })
      }
    })

    return Array.from(nodeMap.values())
  }, [branches])

  async function loadManifests() {
    setLoading(true)
    try {
      const [mRes, bRes, hRes] = await Promise.all([
        listManifests().catch(() => ({ data: [] })),
        api.get('/branches').catch(() => api.get('/ops/admin/branches')).catch(() => ({ data: [] })),
        api.get('/hubs').catch(() => api.get('/ops/admin/hubs')).catch(() => ({ data: [] })),
      ])
      setManifests(mRes?.data || mRes?.manifests || mRes?.rows || [])

      const rawBranches = bRes?.data?.branches || bRes?.data?.rows || (Array.isArray(bRes?.data) ? bRes.data : [])
      const rawHubs = hRes?.data?.hubs || hRes?.data?.rows || (Array.isArray(hRes?.data) ? hRes.data : [])
      setBranches([...rawBranches, ...rawHubs])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(mfgCode) {
    if (!mfgCode) return
    setActiveMfg(mfgCode)
    setDetailLoading(true)
    try {
      const res = await getManifest(mfgCode)
      setDetailData(res?.data || res?.manifest || res || {})
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadManifests()
    if (routeMfg) {
      loadDetail(routeMfg)
    }
  }, [routeMfg])

  async function handleCreate(values) {
    setCreating(true)
    try {
      const payload = {
        mfg_type: values.mfg_type || 'LINEHAUL',
        loc_id: values.origin_branch || 'BKI',
        origin_branch: values.origin_branch || 'BKI',
        dest_loc: values.dest_branch,
        dest_branch: values.dest_branch,
        carrier: values.vehicle_no || 'Scheduled Dispatch',
        vehicle_no: values.vehicle_no,
        remarks: values.remarks,
      }
      const res = await createManifest(payload)
      message.success(`Manifest ${res?.mfgNo || res?.mfg_no || ''} created successfully`)
      setCreateOpen(false)
      createForm.resetFields()
      loadManifests()
      const newMfg = res?.mfgNo || res?.mfg_no || res?.manifest_no
      if (newMfg) {
        loadDetail(newMfg)
      }
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleAttachConsignment() {
    const cn = attachCnInput.trim()
    if (!cn || !activeMfg) return
    setAttaching(true)
    try {
      await attachManifestConsignments(activeMfg, { cns: [cn] })
      message.success(`Consignment ${cn} attached to manifest ${activeMfg}`)
      setAttachCnInput('')
      loadDetail(activeMfg)
      loadManifests()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setAttaching(false)
    }
  }

  async function handleDetachConsignment(cn) {
    if (!activeMfg || !cn) return
    try {
      await detachManifestConsignment(activeMfg, cn)
      message.success(`Consignment ${cn} detached from manifest`)
      loadDetail(activeMfg)
      loadManifests()
    } catch (err) {
      message.error(apiError(err))
    }
  }

  const columns = [
    {
      title: 'Manifest Number',
      dataIndex: 'mfg_no',
      key: 'mfg_no',
      render: (val, r) => (
        <span
          style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A', cursor: 'pointer' }}
          onClick={() => loadDetail(val || r.manifest_no || r.id)}
        >
          {val || r.manifest_no || r.id}
        </span>
      ),
    },
    {
      title: 'Origin → Dest',
      key: 'route',
      render: (_, r) => (
        <span>
          {r.origin_hub || r.origin_branch || 'BKI'} → <strong>{r.dest_hub || r.dest_branch || 'SDK'}</strong>
        </span>
      ),
    },
    {
      title: 'Type / Transport',
      dataIndex: 'mfg_type',
      key: 'mfg_type',
      render: (v, r) => <Tag color="blue">{v || r.transport_mode || 'LINEHAUL'}</Tag>,
    },
    {
      title: 'Consignments Attached',
      key: 'count',
      render: (_, r) => {
        const count = r.cn_count || (Array.isArray(r.consignments) ? r.consignments.length : 0)
        return <Tag color="green">{count} CNs</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <StatusTag status={v || 'ACTIVE'} />,
    },
    {
      title: 'Created Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => <span style={{ fontSize: 12, color: '#6B7280' }}>{v ? String(v).slice(0, 10) : 'Today'}</span>,
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => loadDetail(r.mfg_no || r.manifest_no || r.id)}
        >
          Open Manifest
        </Button>
      ),
    },
  ]

  const attachedCns = detailData?.consignments || detailData?.items || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ListPageLayout
        title="Hub Manifests"
        subtitle="Inbound and outbound transport manifests, transit sorting containers, and gateway departures."
        searchPlaceholder="Search manifest number..."
        actions={[
          {
            key: 'refresh',
            label: 'Refresh',
            icon: <ReloadOutlined />,
            onClick: loadManifests,
          },
        ]}
        onNewClick={canOperate ? () => setCreateOpen(true) : undefined}
        newButtonText="Create Manifest"
        columns={columns}
        dataSource={manifests}
        loading={loading}
        rowKey="mfg_no"
        pagination={{ pageSize: 15 }}
        emptyText="No manifests found"
        emptyDescription="Create a new manifest to group consignments for linehaul dispatch."
      />

      {/* Manifest Detail Drawer */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1B8A5A' }} />
            <span>Manifest: {activeMfg}</span>
            <StatusTag status={detailData?.status || 'ACTIVE'} />
          </Space>
        }
        open={Boolean(activeMfg)}
        onClose={() => setActiveMfg(null)}
        width={720}
      >
        {detailLoading ? (
          <div style={{ padding: 24 }}><Text>Loading manifest details...</Text></div>
        ) : detailData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Manifest No">
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{detailData.mfg_no || activeMfg}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Transport Mode">
                <Tag color="cyan">{detailData.transport_mode || 'ROAD'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Origin Hub">
                {detailData.origin_hub || detailData.origin_branch || 'BKI'}
              </Descriptions.Item>
              <Descriptions.Item label="Destination Hub">
                {detailData.dest_hub || detailData.dest_branch || 'SDK'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Attached CNs">
                <strong>{attachedCns.length} consignments</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Carrier / Vehicle">
                {detailData.vehicle_no || detailData.driver_name || 'Scheduled Dispatch'}
              </Descriptions.Item>
            </Descriptions>

            {/* Quick Attach Consignment Bar */}
            {canOperate && (
              <Card size="small" style={{ background: '#F8FAFC', borderRadius: 6 }}>
                <Text strong style={{ fontSize: 13, color: '#0F1B2D', display: 'block', marginBottom: 8 }}>
                  Attach Consignment to Manifest
                </Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="Scan or enter CN Number (e.g. BKI10028)"
                    value={attachCnInput}
                    onChange={(e) => setAttachCnInput(e.target.value)}
                    onPressEnter={handleAttachConsignment}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    loading={attaching}
                    onClick={handleAttachConsignment}
                    style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
                  >
                    Attach
                  </Button>
                </Space.Compact>
              </Card>
            )}

            {/* Attached Consignments Table */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#0F1B2D', marginBottom: 8 }}>
                Attached Consignments ({attachedCns.length})
              </div>
              <DataTable
                size="small"
                columns={[
                  {
                    title: 'CN Number',
                    dataIndex: 'cn_no',
                    key: 'cn_no',
                    render: (v) => (
                      <span
                        style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A', cursor: 'pointer' }}
                        onClick={() => navigate(`/ops/consignments/${encodeURIComponent(v)}`)}
                      >
                        {v}
                      </span>
                    ),
                  },
                  { title: 'Recipient', dataIndex: 'consignee', key: 'consignee', render: (v, r) => v || r.recipientName || '—' },
                  { title: 'Weight (kg)', dataIndex: 'cn_wt', key: 'cn_wt', render: (v) => `${v || 1} kg` },
                  { title: 'Status', dataIndex: 'cn_status', key: 'cn_status', render: (v) => <StatusTag status={v || 'MNF'} /> },
                  {
                    title: 'Action',
                    key: 'action',
                    align: 'right',
                    render: (_, r) =>
                      canOperate ? (
                        <Popconfirm
                          title="Detach consignment from manifest?"
                          onConfirm={() => handleDetachConsignment(r.cn_no || r.id)}
                          okText="Detach"
                        >
                          <Button size="small" danger icon={<DeleteOutlined />}>
                            Detach
                          </Button>
                        </Popconfirm>
                      ) : null,
                  },
                ]}
                dataSource={attachedCns}
                rowKey="cn_no"
                pagination={false}
                locale={{ emptyText: 'No consignments currently attached to this manifest.' }}
              />
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Create Manifest Modal */}
      <Modal
        title="Create New Linehaul Manifest"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="Manifest Type"
            name="mfg_type"
            initialValue="LINEHAUL"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Linehaul Trunk Manifest', value: 'LINEHAUL' },
                { label: 'Gateway Departure Manifest', value: 'GATEWAY' },
                { label: 'Air Freight Bag Manifest', value: 'AIR' },
                { label: 'Maritime Container Manifest', value: 'SEA' },
              ]}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="Origin Hub / Branch"
                name="origin_branch"
                initialValue="BKI"
                rules={[{ required: true, message: 'Please select origin hub / branch' }]}
              >
                <Select
                  showSearch
                  placeholder="Select origin..."
                  options={branchOptions}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Destination Hub / Branch"
                name="dest_branch"
                rules={[{ required: true, message: 'Please select destination hub / branch' }]}
              >
                <Select
                  showSearch
                  placeholder="Select destination hub / branch..."
                  options={branchOptions}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Transport Mode / Vehicle No" name="vehicle_no">
            <Input placeholder="e.g. Lorry 5-Ton (SAA 1234 B)" />
          </Form.Item>

          <Form.Item label="Dispatch Remarks" name="remarks">
            <Input.TextArea rows={2} placeholder="Optional routing or security seal notes" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={creating}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              Create Manifest
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
