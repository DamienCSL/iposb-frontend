import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { apiError, completeReturn, getReturn, initiateReturn, listReturns, updateReturnStatus } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import ListPageLayout from '../../components/ListPageLayout'
import StatusTag from '../../components/StatusTag'
import { MaskedPhone } from '../admin/MasterAdminPage'

const { Title, Text } = Typography

export default function ReturnsPage() {
  const navigate = useNavigate()
  const { can, isAdmin, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(undefined)

  const isPic = ['Super Admin', 'Admin', 'Hub Manager', 'Droppoint Manager', 'Operation'].includes(user?.role) ||
    user?.role?.toLowerCase().includes('manager') ||
    user?.role?.toLowerCase().includes('pic')
  const canManageReturns = Boolean(isAdmin || isPic || can('admin'))

  // Initiate Return Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // Detail Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState(null)
  const [trackingHistory, setTrackingHistory] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')

  async function loadData(page = pagination.current, pageSize = pagination.pageSize) {
    setLoading(true)
    try {
      const q = { page, per_page: pageSize }
      if (search) q.search = search
      if (status) q.status = status
      const res = await listReturns(q)
      const rows = res?.data || res?.returns || (Array.isArray(res) ? res : [])
      const pag = res?.pagination || {}
      setData(rows)
      setPagination({
        current: pag.page || page,
        pageSize: pag.per_page || pageSize,
        total: pag.total || rows.length,
      })
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(1)
  }, [search, status])

  async function handleOpenDetail(cn) {
    setLoadingDetail(true)
    setDrawerOpen(true)
    setSelectedReturn(null)
    setTrackingHistory([])
    try {
      const res = await getReturn(cn)
      setSelectedReturn(res?.return || res?.data || res)
      setTrackingHistory(res?.tracking || [])
      setNextStatus(res?.return?.status || res?.data?.status || res?.status || '')
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleStatusUpdate() {
    const cn = selectedReturn?.cn_no || selectedReturn?.cn
    if (!cn || !nextStatus) return
    setStatusUpdating(true)
    try {
      await updateReturnStatus(cn, { status: nextStatus, note: statusNote })
      message.success(`Return status updated to ${nextStatus}`)
      setStatusNote('')
      await handleOpenDetail(cn)
      loadData(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleCompleteReturn() {
    const cn = selectedReturn?.cn_no || selectedReturn?.cn
    if (!cn) return
    setStatusUpdating(true)
    try {
      await completeReturn(cn)
      message.success(`Return completed for ${cn}`)
      await handleOpenDetail(cn)
      loadData(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleInitiateSubmit(values) {
    setSubmitting(true)
    try {
      await initiateReturn(values.cn, { reason: values.reason, note: values.note })
      message.success(`Return initiated for ${values.cn}`)
      setModalOpen(false)
      form.resetFields()
      loadData(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'Consignment / Return Ref',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (val, r) => {
        const cn = val || r.cn
        return (
          <Space direction="vertical" size={2}>
            <span
              style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A', cursor: 'pointer' }}
              onClick={() => navigate(`/ops/consignments/${encodeURIComponent(cn)}`)}
            >
              {cn}
            </span>
            {r.return_no && (
              <Tag color="orange" style={{ fontSize: 11, padding: '0 4px', width: 'fit-content' }}>
                {r.return_no}
              </Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Return Status',
      dataIndex: 'status',
      key: 'status',
      render: (val) => <StatusTag status={val || 'INITIATED'} />,
    },
    {
      title: 'Sender (Return Shipper)',
      dataIndex: 'sender_name',
      key: 'sender_name',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#111827' }}>
            {v || r.consigner || r.senderName || r.shipper || '—'}
          </div>
          {(r.sender_phone || r.customer_phone) && (
            <div style={{ marginTop: 2 }}>
              <MaskedPhone phone={r.sender_phone || r.customer_phone} canReveal={canManageReturns} />
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Original Recipient',
      dataIndex: 'consignee_name',
      key: 'consignee_name',
      render: (v, r) => (
        <div>
          <div style={{ color: '#374151' }}>
            {v || r.consignee || r.recipientName || '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Return Path',
      key: 'route',
      render: (_, r) => {
        const from = r.origin_branch || r.from_branch
        const to = r.destination_branch || r.to_branch
        if (!from && !to) return <span style={{ color: '#9CA3AF' }}>—</span>
        return (
          <Space size={4}>
            <Tag color="blue">{from || '—'}</Tag>
            <span style={{ color: '#9CA3AF' }}>→</span>
            <Tag color="cyan">{to || '—'}</Tag>
          </Space>
        )
      },
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (v, r) => (
        <div>
          <Tag color="volcano">{v || 'FAILED_DELIVERY'}</Tag>
          {r.reason_note && (
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2, maxWidth: 200 }} className="truncate">
              {r.reason_note}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Initiated At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => (v ? String(v).slice(0, 16) : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, r) => {
        const cn = r.cn_no || r.cn
        return (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(cn)}>
              Audit Dossier
            </Button>
            <Button
              size="small"
              type="primary"
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
              onClick={() => navigate(`/ops/consignments/${encodeURIComponent(cn)}`)}
            >
              Consignment
            </Button>
          </Space>
        )
      },
    },
  ]

  return (
    <ListPageLayout
      title="Return-to-Sender (RTS) Management"
      subtitle="Track, initiate, audit, and reconcile parcel returns after delivery failure"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadData(1)} loading={loading}>
            Refresh
          </Button>
          {canManageReturns && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ background: '#D97706', borderColor: '#D97706' }}
              onClick={() => setModalOpen(true)}
            >
              Initiate RTS
            </Button>
          )}
        </Space>
      }
    >
      <Card style={{ borderRadius: 8, marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={14} md={10}>
            <Input
              placeholder="Search by CN, Return ID, or shipper…"
              prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={10} md={8}>
            <Select
              placeholder="Filter by Return Status"
              style={{ width: '100%' }}
              allowClear
              value={status}
              onChange={setStatus}
              options={[
                { value: 'INITIATED', label: 'INITIATED — Return Initiated' },
                { value: 'IN_TRANSIT', label: 'IN_TRANSIT — In Return Transit' },
                { value: 'ARRIVED_HUB', label: 'ARRIVED_HUB — At Hub' },
                { value: 'OUT_FOR_RETURN', label: 'OUT_FOR_RETURN — Out for Redelivery to Sender' },
                { value: 'RETURNED', label: 'RETURNED — Successfully Returned' },
                { value: 'CANCELLED', label: 'CANCELLED — Return Aborted' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <DataTable
        columns={columns}
        dataSource={data}
        rowKey={(r) => r.return_no || r.cn_no || r.cn || r.id}
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, size) => loadData(page, size),
          showTotal: (total) => `Total ${total} return records`,
        }}
      />

      {/* Initiate Return Modal */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#D97706' }} />
            <span>Initiate Return to Sender</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleInitiateSubmit}>
          <Form.Item
            label="Consignment Number (CN)"
            name="cn"
            rules={[{ required: true, message: 'Please enter CN number' }]}
          >
            <Input placeholder="e.g. BBB0810000006" />
          </Form.Item>
          <Form.Item
            label="Return Reason"
            name="reason"
            rules={[{ required: true, message: 'Please select or enter reason' }]}
          >
            <Select
              placeholder="Select primary reason"
              options={[
                { value: 'FAILED_DELIVERY', label: 'Failed Delivery — Multiple attempts exhausted' },
                { value: 'WRONG_ADDRESS', label: 'Wrong / Incomplete Destination Address' },
                { value: 'RECIPIENT_REFUSED', label: 'Recipient Refused Delivery at Doorstep' },
                { value: 'DAMAGED_IN_TRANSIT', label: 'Damaged in transit — Recall to sender' },
                { value: 'SHIPPER_RECALL', label: 'Shipper Requested Immediate Recall' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Detailed Notes / Audit Remark" name="note">
            <Input.TextArea rows={3} placeholder="Provide specific operational context or customer statement..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ background: '#D97706', borderColor: '#D97706' }}
            >
              Initiate Return
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Return Detail Drawer */}
      <Drawer
        title={
          <Space>
            <RollbackOutlined style={{ color: '#D97706' }} />
            <span>Return Audit Dossier</span>
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
      >
        {loadingDetail ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <SyncOutlined spin style={{ fontSize: 24, color: '#1B8A5A' }} />
            <div style={{ marginTop: 8, color: '#6B7280' }}>Loading return dossier...</div>
          </div>
        ) : selectedReturn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Consignment #">
                <strong style={{ fontFamily: 'monospace', color: '#1B8A5A' }}>
                  {selectedReturn.cn || selectedReturn.cn_no}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Return Reference #">
                <Tag color="orange">{selectedReturn.return_no || '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Current Status">
                <StatusTag status={selectedReturn.status || 'INITIATED'} />
              </Descriptions.Item>
              <Descriptions.Item label="Return Reason">
                <div>
                  <Tag color="volcano">{selectedReturn.reason || 'FAILED_DELIVERY'}</Tag>
                  {selectedReturn.reason_note && (
                    <div style={{ marginTop: 4, color: '#4B5563', fontSize: 13 }}>
                      {selectedReturn.reason_note}
                    </div>
                  )}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Shipper (Sender)">
                <div>
                  <strong>{selectedReturn.sender_name || selectedReturn.consigner || '—'}</strong>
                  {(selectedReturn.sender_phone || selectedReturn.customer_phone) && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Contact: </Text>
                      <MaskedPhone
                        phone={selectedReturn.sender_phone || selectedReturn.customer_phone}
                        canReveal={canManageReturns}
                      />
                    </div>
                  )}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Recipient (Failed Delivery)">
                <div>{selectedReturn.consignee_name || selectedReturn.consignee || '—'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Return Flow">
                <span>
                  <Tag color="blue">{selectedReturn.origin_branch || selectedReturn.from_branch || '—'}</Tag>
                  →
                  <Tag color="cyan">{selectedReturn.destination_branch || selectedReturn.to_branch || '—'}</Tag>
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Initiated By">
                <Tag>{selectedReturn.initiated_by || 'Staff'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Initiated Timestamp">
                {selectedReturn.created_at || '—'}
              </Descriptions.Item>
            </Descriptions>

            {canManageReturns && !['RETURNED', 'CANCELLED'].includes(selectedReturn.status) && (
              <Card size="small" title="Advance Return Status">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Select
                    value={nextStatus || selectedReturn.status}
                    onChange={setNextStatus}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'INITIATED', label: 'INITIATED — Return initiated' },
                      { value: 'IN_TRANSIT', label: 'IN_TRANSIT — Moving back to sender' },
                      { value: 'ARRIVED_HUB', label: 'ARRIVED_HUB — Arrived at return hub' },
                      { value: 'OUT_FOR_RETURN', label: 'OUT_FOR_RETURN — Out for return delivery' },
                      { value: 'RETURNED', label: 'RETURNED — Returned to sender' },
                      { value: 'CANCELLED', label: 'CANCELLED — Return aborted' },
                    ]}
                  />
                  <Input.TextArea
                    rows={2}
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Checkpoint note, location, or scan reference"
                  />
                  <Button type="primary" loading={statusUpdating} onClick={handleStatusUpdate}>
                    Update Return Status
                  </Button>
                  {['OUT_FOR_RETURN', 'ARRIVED_HUB', 'IN_TRANSIT'].includes(selectedReturn.status) && (
                    <Button
                      loading={statusUpdating}
                      icon={<CheckCircleOutlined />}
                      onClick={handleCompleteReturn}
                      style={{ background: '#1B8A5A', borderColor: '#1B8A5A', color: '#fff' }}
                    >
                      Complete return (mark RETURNED)
                    </Button>
                  )}
                </Space>
              </Card>
            )}

            {/* Tracking Milestones */}
            <div>
              <Title level={5} style={{ fontSize: 14, marginBottom: 12 }}>
                Return Tracking Checkpoints
              </Title>
              {trackingHistory.length > 0 ? (
                <Timeline
                  items={trackingHistory.map((t, idx) => ({
                    color: idx === 0 ? 'green' : 'blue',
                    children: (
                      <div>
                        <div>
                          <strong>{t.status}</strong>
                          {t.location && <span style={{ color: '#6B7280', marginLeft: 6 }}>@{t.location}</span>}
                        </div>
                        {t.note && <div style={{ fontSize: 12, color: '#4B5563' }}>{t.note}</div>}
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                          {t.created_at} {t.scanned_by ? `by ${t.scanned_by}` : ''}
                        </div>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <div style={{ fontSize: 13, color: '#9CA3AF' }}>No checkpoint milestones logged yet.</div>
              )}
            </div>
          </div>
        ) : (
          <Empty description="No return record found" />
        )}
      </Drawer>
    </ListPageLayout>
  )
}
