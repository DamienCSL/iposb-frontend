import React, { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  MoonOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  apiError,
  approveOvernightRequest,
  createOvernightRequest,
  listOvernightRequests,
  rejectOvernightRequest,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'

const { Title, Text } = Typography

function statusColor(s) {
  if (s === 'PENDING') return 'gold'
  if (s === 'APPROVED') return 'green'
  if (s === 'REJECTED') return 'red'
  return 'default'
}

export default function OvernightRequestsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { isAdmin, user } = useAuth()
  const canReview =
    isAdmin || ['Operation', 'Super Admin', 'Admin', 'Hub Manager'].includes(user?.role)

  const statusFilter = (params.get('status') || 'PENDING').toUpperCase()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [acting, setActing] = useState(false)
  const [rejectForm] = Form.useForm()
  const [approveForm] = Form.useForm()
  const [createForm] = Form.useForm()

  async function load(nextPage = page) {
    setLoading(true)
    try {
      const res = await listOvernightRequests({
        status: statusFilter,
        page: nextPage,
        per_page: 25,
      })
      setRows(res?.rows || [])
      setPendingCount(res?.pendingCount ?? 0)
      setTotal(res?.total ?? 0)
      setPage(res?.page ?? nextPage)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  function setStatus(status) {
    const next = new URLSearchParams(params)
    next.set('status', status)
    setParams(next, { replace: true })
  }

  async function onApprove(values) {
    if (!active) return
    setActing(true)
    try {
      await approveOvernightRequest(active.id, {
        note: values?.note || '',
        locId: values?.locId || undefined,
      })
      message.success(`Approved — OVN applied on ${active.consignmentNo}`)
      setApproveOpen(false)
      setActive(null)
      approveForm.resetFields()
      load()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActing(false)
    }
  }

  async function onReject(values) {
    if (!active) return
    setActing(true)
    try {
      await rejectOvernightRequest(active.id, { note: values.note })
      message.success(`Rejected overnight request for ${active.consignmentNo}`)
      setRejectOpen(false)
      setActive(null)
      rejectForm.resetFields()
      load()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActing(false)
    }
  }

  async function onCreate(values) {
    setActing(true)
    try {
      const res = await createOvernightRequest({
        cn_no: String(values.cn_no || '').trim().toUpperCase(),
        reason: values.reason || '',
        loc_id: values.locId || '',
        force: Boolean(values.force),
      })
      message.success(`Overnight request created for ${res?.request?.consignmentNo || values.cn_no}`)
      setCreateOpen(false)
      createForm.resetFields()
      setStatus('PENDING')
      load(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActing(false)
    }
  }

  const columns = [
    {
      title: 'CN',
      dataIndex: 'consignmentNo',
      key: 'consignmentNo',
      render: (v) => (
        <Link to={`/ops/consignments/${encodeURIComponent(v)}`} style={{ fontFamily: 'monospace', fontWeight: 700 }}>
          {v}
        </Link>
      ),
    },
    {
      title: 'Request',
      dataIndex: 'requestStatus',
      key: 'requestStatus',
      width: 110,
      render: (v) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: 'CN status',
      key: 'cnStatus',
      width: 120,
      render: (_, r) => <StatusTag status={r.currentStatus || r.statusAtRequest} />,
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => (
        <Text style={{ fontSize: 13 }}>
          {r.origin || '—'} → {r.destination || '—'}
        </Text>
      ),
    },
    {
      title: 'Recipient',
      dataIndex: 'recipientName',
      key: 'recipientName',
      render: (v) => v || '—',
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Requested by',
      key: 'requested',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.requestedBy || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.requestedAt ? String(r.requestedAt).slice(0, 16).replace('T', ' ') : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 220,
      render: (_, r) => {
        if (r.requestStatus !== 'PENDING' || !canReview) {
          return (
            <Button size="small" onClick={() => navigate(`/ops/consignments/${encodeURIComponent(r.consignmentNo)}`)}>
              Open CN
            </Button>
          )
        }
        return (
          <Space size="small">
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
              onClick={() => {
                setActive(r)
                approveForm.setFieldsValue({ note: r.reason || '', locId: r.locId || '' })
                setApproveOpen(true)
              }}
            >
              Approve
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                setActive(r)
                rejectForm.resetFields()
                setRejectOpen(true)
              }}
            >
              Reject
            </Button>
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
            <MoonOutlined style={{ marginRight: 8, color: '#1B8A5A' }} />
            Overnight Scan Requests
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Dispatcher overnight hold requests. Approve applies OVN (awaiting redelivery); reject closes with a note.
          </Text>
        </div>
        <Space wrap>
          <Badge count={pendingCount} offset={[0, 4]}>
            <Button
              type={statusFilter === 'PENDING' ? 'primary' : 'default'}
              onClick={() => setStatus('PENDING')}
              style={statusFilter === 'PENDING' ? { background: '#1B8A5A', borderColor: '#1B8A5A' } : undefined}
            >
              Pending
            </Button>
          </Badge>
          <Select
            value={statusFilter}
            style={{ width: 140 }}
            onChange={setStatus}
            options={[
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'ALL', label: 'All' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load()}>
            Refresh
          </Button>
          {canReview ? (
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              New request
            </Button>
          ) : null}
        </Space>
      </div>

      {!canReview ? (
        <Alert
          type="info"
          showIcon
          message="View only"
          description="Approve / reject requires Admin, Hub Manager, or Operation role."
        />
      ) : null}

      <Card size="small" style={{ borderRadius: 8 }}>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{
            current: page,
            pageSize: 25,
            total,
            showSizeChanger: false,
            onChange: (p) => load(p),
          }}
        />
      </Card>

      <Modal
        title={`Approve overnight — ${active?.consignmentNo || ''}`}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        footer={null}
        destroyOnClose
      >
        {active ? (
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Current status">
              <StatusTag status={active.currentStatus || active.statusAtRequest} />
            </Descriptions.Item>
            <Descriptions.Item label="Dispatcher">{active.requestedBy || '—'}</Descriptions.Item>
            <Descriptions.Item label="Reason">{active.reason || '—'}</Descriptions.Item>
          </Descriptions>
        ) : null}
        <Form form={approveForm} layout="vertical" onFinish={onApprove}>
          <Form.Item name="locId" label="Scan location (optional)">
            <Input placeholder="e.g. BKI" allowClear />
          </Form.Item>
          <Form.Item name="note" label="Note on OVN scan">
            <Input.TextArea rows={2} placeholder="Held overnight — awaiting redelivery" />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={acting} style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}>
              Approve & apply OVN
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`Reject overnight — ${active?.consignmentNo || ''}`}
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={rejectForm} layout="vertical" onFinish={onReject}>
          <Form.Item
            name="note"
            label="Rejection reason"
            rules={[{ required: true, message: 'Reason is required' }]}
          >
            <Input.TextArea rows={3} placeholder="Why this overnight hold is not approved" />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button type="primary" danger htmlType="submit" loading={acting}>
              Reject request
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="Create overnight request"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={onCreate}>
          <Form.Item
            name="cn_no"
            label="Consignment number"
            rules={[{ required: true, message: 'CN is required' }]}
          >
            <Input placeholder="e.g. MOB2609000001" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="locId" label="Location">
            <Input placeholder="e.g. BKI" allowClear />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={2} placeholder="Failed delivery / after hours / weather…" />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="Must request before 3:00 PM"
            description="Flow rule: overnight hold before 3 PM. Use force only for emergency overrides."
          />
          <Form.Item name="force" valuePropName="checked">
            <Checkbox>Force override (after 3 PM emergency)</Checkbox>
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={acting} style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}>
              Submit
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
