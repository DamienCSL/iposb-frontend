import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { apiError, listStaff, verifyStaff } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import ListPageLayout from '../../components/ListPageLayout'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

export default function StaffPage() {
  const { can, isAdmin, user } = useAuth()
  const canVerify = isAdmin // Super Admin / Admin only

  const [tab, setTab] = useState('pending') // 'pending' | 'verified' | 'all'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  // Verify action modal (approve, reject, revoke)
  const [verifyModal, setVerifyModal] = useState({ open: false, action: null, staff: null })
  const [verifying, setVerifying] = useState(false)
  const [form] = Form.useForm()

  async function loadData() {
    setLoading(true)
    try {
      const res = await listStaff(tab)
      setRows(res?.data || res?.staff || res?.rows || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tab])

  function openAction(action, staff) {
    form.resetFields()
    setVerifyModal({ open: true, action, staff })
  }

  async function handleVerifySubmit(values) {
    const { action, staff } = verifyModal
    if (!staff?.id) return
    setVerifying(true)
    try {
      await verifyStaff(staff.id, action, values.note)
      message.success(`Staff verification updated: ${action}`)
      setVerifyModal({ open: false, action: null, staff: null })
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setVerifying(false)
    }
  }

  const columns = [
    {
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (v, r) => (
        <div>
          <strong style={{ color: '#0F1B2D' }}>{v || r.name || r.username}</strong>
          <div style={{ fontSize: 11, color: '#6B7280' }}>ID: {r.id || r.driver_id || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Role / Position',
      dataIndex: 'role',
      key: 'role',
      render: (v, r) => <Tag color="blue">{v || r.type || 'Driver / Courier'}</Tag>,
    },
    {
      title: 'Contact Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (v) => v || '—',
    },
    {
      title: 'Branch / Hub',
      key: 'branch',
      render: (_, r) => r.branch_code || r.hub_code || 'BKI',
    },
    {
      title: 'License / IC',
      key: 'ic',
      render: (_, r) => r.ic_no || r.license_no || 'Verified Doc',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const isAppr = r.is_verified || r.status === 'VERIFIED'
        return <StatusTag status={isAppr ? 'VERIFIED' : 'UNVERIFIED'} />
      },
    },
    {
      title: 'Admin Verification Action',
      key: 'actions',
      align: 'right',
      render: (_, r) => {
        const isAppr = r.is_verified || r.status === 'VERIFIED'
        return canVerify ? (
          <Space size="small">
            {!isAppr ? (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => openAction('approve', r)}
                  style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => openAction('reject', r)}
                >
                  Reject
                </Button>
              </>
            ) : (
              <Button
                size="small"
                danger
                onClick={() => openAction('revoke', r)}
              >
                Revoke Access
              </Button>
            )}
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Admin only</Text>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0F1B2D', letterSpacing: '-0.3px' }}>
            Staff Verification Queue
          </h2>
          <div style={{ fontSize: 12, color: '#5B6B7C', marginTop: 2 }}>
            Review pending courier, driver, and dispatcher registrations before app authorization.
          </div>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
        </Space>
      </div>

      <Card size="small" style={{ borderRadius: 8 }} bodyStyle={{ padding: '12px 16px' }}>
        <Radio.Group
          value={tab}
          onChange={(e) => setTab(e.target.value)}
          buttonStyle="solid"
        >
          <Radio.Button value="pending">Pending Verifications</Radio.Button>
          <Radio.Button value="verified">Verified Staff</Radio.Button>
          <Radio.Button value="all">All Registrations</Radio.Button>
        </Radio.Group>
      </Card>

      <DataTable
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: 'No staff registrations matching this filter' }}
      />

      {/* Approve / Reject / Revoke Modal */}
      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: verifyModal.action === 'approve' ? '#1B8A5A' : '#D4380D' }} />
            <span style={{ textTransform: 'capitalize' }}>{verifyModal.action} Staff Member</span>
          </Space>
        }
        open={verifyModal.open}
        onCancel={() => setVerifyModal({ open: false, action: null, staff: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleVerifySubmit}>
          <Paragraph style={{ fontSize: 13, color: '#5B6B7C' }}>
            You are performing action <strong>{verifyModal.action?.toUpperCase()}</strong> on registration for{' '}
            <strong>{verifyModal.staff?.full_name || verifyModal.staff?.name}</strong>.
          </Paragraph>

          <Form.Item
            label="Verification Note / Reason"
            name="note"
            rules={[{ required: verifyModal.action !== 'approve', message: 'Note required for rejection or revocation' }]}
          >
            <Input.TextArea rows={3} placeholder="Add an audit note or rationale (e.g. Identity verified via Driving License)" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button onClick={() => setVerifyModal({ open: false, action: null, staff: null })}>Cancel</Button>
            <Button
              type="primary"
              danger={verifyModal.action !== 'approve'}
              htmlType="submit"
              loading={verifying}
              style={verifyModal.action === 'approve' ? { background: '#1B8A5A', borderColor: '#1B8A5A' } : {}}
            >
              Confirm {verifyModal.action}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
