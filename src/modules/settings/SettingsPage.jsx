import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Radio,
  Space,
  Tabs,
  Typography,
  message,
} from 'antd'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import {
  apiError,
  deleteMaster,
  listMaster,
  listStaff,
  saveMaster,
  verifyStaff,
} from '../../api/client'

const { Title, Text } = Typography

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') || 'users'

  // Resource for master CRUD
  const [resource, setResource] = useState(params.get('sub') || 'branches')
  const [masterRows, setMasterRows] = useState([])
  const [masterLoading, setMasterLoading] = useState(false)

  // Staff verification state
  const [staffTab, setStaffTab] = useState('pending')
  const [staffRows, setStaffRows] = useState([])
  const [staffLoading, setStaffLoading] = useState(false)

  // Master Drawer Form
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  async function loadMasterData(resName) {
    setMasterLoading(true)
    try {
      const res = await listMaster(resName)
      setMasterRows(res.rows || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setMasterLoading(false)
    }
  }

  async function loadStaffData(status) {
    setStaffLoading(true)
    try {
      const res = await listStaff(status)
      setStaffRows(res.rows || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setStaffLoading(false)
    }
  }

  useEffect(() => {
    const s = params.get('sub')
    if (s && s !== resource) {
      setResource(s)
    }
  }, [params])

  useEffect(() => {
    if (activeTab === 'staff') {
      loadStaffData(staffTab)
    } else if (activeTab === 'users') {
      loadMasterData('users')
    } else {
      loadMasterData(resource)
    }
  }, [activeTab, resource, staffTab])

  async function handleVerify(id, action) {
    try {
      await verifyStaff(id, action, action === 'reject' ? 'Rejected by FMS admin' : undefined)
      message.success(`Staff account ${action}ed`)
      loadStaffData(staffTab)
    } catch (err) {
      message.error(apiError(err))
    }
  }

  async function handleSaveMaster(values) {
    setSaving(true)
    try {
      await saveMaster(activeTab === 'users' ? 'users' : resource, values, editingItem?.id)
      message.success('Master record saved')
      setDrawerOpen(false)
      form.resetFields()
      setEditingItem(null)
      loadMasterData(activeTab === 'users' ? 'users' : resource)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMaster(id) {
    try {
      await deleteMaster(activeTab === 'users' ? 'users' : resource, id)
      message.success('Record deleted')
      loadMasterData(activeTab === 'users' ? 'users' : resource)
    } catch (err) {
      message.error(apiError(err))
    }
  }

  function openEditDrawer(item = null) {
    setEditingItem(item)
    form.resetFields()
    if (item) {
      form.setFieldsValue(item)
    }
    setDrawerOpen(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#0F1B2D' }}>
            Settings & Master Infrastructure
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Maintain users, approve mobile driver sign-ups, and manage hubs, branches, and routing pools.
          </Text>
        </div>

        {activeTab !== 'staff' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            onClick={() => openEditDrawer()}
          >
            New Record
          </Button>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setParams({ tab: k })}
        items={[
          {
            key: 'users',
            label: (
              <span>
                <TeamOutlined style={{ marginRight: 6 }} />
                Users & Roles
              </span>
            ),
            children: (
              <DataTable
                dataSource={masterRows}
                rowKey="id"
                loading={masterLoading}
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
                  {
                    title: 'Username',
                    dataIndex: 'username',
                    key: 'username',
                    render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
                  },
                  { title: 'Full Name', dataIndex: 'name', key: 'name', render: (v, r) => v || r.full_name || '—' },
                  {
                    title: 'Role',
                    dataIndex: 'role',
                    key: 'role',
                    render: (v) => <StatusTag status={v || 'Staff'} text={v || 'Staff'} color="#1668DC" />,
                  },
                  { title: 'Branch', dataIndex: 'branchCode', key: 'branchCode', render: (v) => v || 'HQ' },
                  {
                    title: 'Actions',
                    key: 'actions',
                    align: 'right',
                    render: (_, r) => (
                      <Space size="small">
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditDrawer(r)} />
                        <Popconfirm title="Delete user?" onConfirm={() => handleDeleteMaster(r.id)}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'staff',
            label: (
              <span>
                <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                Staff Verification
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card size="small" className="table-surface-card" styles={{ body: { padding: '10px 14px' } }}>
                  <Radio.Group
                    value={staffTab}
                    onChange={(e) => setStaffTab(e.target.value)}
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value="pending">Pending Approval</Radio.Button>
                    <Radio.Button value="approved">Approved</Radio.Button>
                    <Radio.Button value="rejected">Rejected</Radio.Button>
                  </Radio.Group>
                </Card>

                <DataTable
                  dataSource={staffRows}
                  rowKey="id"
                  loading={staffLoading}
                  columns={[
                    { title: 'Name', dataIndex: 'full_name', key: 'full_name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
                    { title: 'Email', dataIndex: 'email', key: 'email' },
                    { title: 'Role', dataIndex: 'role', key: 'role', render: (v) => <StatusTag status={v || 'STAFF'} text={v} color="#1B8A5A" /> },
                    {
                      title: 'Verification Status',
                      dataIndex: 'verification_status',
                      key: 'verification_status',
                      render: (v, r) => {
                        const statusVal = v || (r.is_active ? 'approved' : 'pending')
                        return <StatusTag status={statusVal.toUpperCase()} text={statusVal} />
                      },
                    },
                    {
                      title: 'Action',
                      key: 'action',
                      render: (_, r) =>
                        staffTab === 'pending' ? (
                          <Space size="small">
                            <Button
                              size="small"
                              type="primary"
                              icon={<CheckCircleOutlined />}
                              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
                              onClick={() => handleVerify(r.id, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              danger
                              icon={<CloseCircleOutlined />}
                              onClick={() => handleVerify(r.id, 'reject')}
                            >
                              Reject
                            </Button>
                          </Space>
                        ) : null,
                    },
                  ]}
                  locale={{ emptyText: `No ${staffTab} staff registrations found` }}
                />
              </div>
            ),
          },
          {
            key: 'masters',
            label: (
              <span>
                <SettingOutlined style={{ marginRight: 6 }} />
                Network Infrastructure & Routing
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card size="small" className="table-surface-card" styles={{ body: { padding: '10px 14px' } }}>
                  <Radio.Group
                    value={resource}
                    onChange={(e) => {
                      setResource(e.target.value)
                      setParams({ tab: 'masters', sub: e.target.value })
                    }}
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value="branches">Branches</Radio.Button>
                    <Radio.Button value="hubs">Hubs</Radio.Button>
                    <Radio.Button value="drop-points">Drop Points</Radio.Button>
                    <Radio.Button value="3pl">3PL Partners</Radio.Button>
                    <Radio.Button value="routes">Route Table</Radio.Button>
                    <Radio.Button value="zones">Zones</Radio.Button>
                    <Radio.Button value="route-codes">Route Codes</Radio.Button>
                  </Radio.Group>
                </Card>

                <DataTable
                  dataSource={masterRows}
                  rowKey="id"
                  loading={masterLoading}
                  columns={[
                    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
                    {
                      title: 'Code',
                      dataIndex: 'code',
                      key: 'code',
                      render: (v, r) => (
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                          {v || r.hub_code || r.loc_code || r.dp_code || r.route_code || '—'}
                        </span>
                      ),
                    },
                    {
                      title: 'Name / Label',
                      dataIndex: 'name',
                      key: 'name',
                      render: (v, r) => v || r.hub_name || r.loc_name || r.dp_name || r.partner_name || '—',
                    },
                    {
                      title: 'State / Zone',
                      dataIndex: 'state',
                      key: 'state',
                      render: (v, r) => v || r.state_name || r.zone || '—',
                    },
                    {
                      title: 'Actions',
                      key: 'actions',
                      align: 'right',
                      render: (_, r) => (
                        <Space size="small">
                          <Button size="small" icon={<EditOutlined />} onClick={() => openEditDrawer(r)} />
                          <Popconfirm title="Delete master record?" onConfirm={() => handleDeleteMaster(r.id)}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />

      {/* Create / Edit Drawer */}
      <Drawer
        title={editingItem ? `Edit ${resource}` : `New ${resource}`}
        width={420}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
              onClick={() => form.submit()}
              loading={saving}
            >
              Save Record
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSaveMaster}>
          <Form.Item name="code" label="Code (e.g. BKI, SBH325, etc.)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Name / Description" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="state" label="State / Region / Zone">
            <Input />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
