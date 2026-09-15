import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  addCsReminder,
  apiError,
  assignCsTicket,
  closeCsTicket,
  createCsTicket,
  getCsTicket,
  listCsTickets,
  processCsTicket,
  reopenCsTicket,
  replyCsTicket,
  startCsTicket,
} from '../../api/client'

const { Title, Text } = Typography

const QUEUE_TO_STATUS = {
  waiting: 'PENDING',
  in_progress: 'PROCESSING',
  processed: 'PROCESSED',
  closed: 'CLOSED',
  reopened: 'REOPENED',
  all: undefined,
}

function statusTag(status) {
  const s = String(status || '').toUpperCase()
  if (s === 'PENDING' || s === 'REOPENED') return <StatusTag status="PENDING" text={s} color="#D97706" />
  if (s === 'PROCESSING') return <StatusTag status="PROCESSING" text={s} color="#1668DC" />
  if (s === 'PROCESSED') return <StatusTag status="PAID" text={s} color="#0EA5E9" />
  if (s === 'CLOSED') return <StatusTag status="CLOSED" text={s} color="#1B8A5A" />
  return <StatusTag status={s || 'OPEN'} text={s || '—'} />
}

export default function SupportPage() {
  const navigate = useNavigate()
  const { id: routeId } = useParams()
  const [params, setParams] = useSearchParams()
  const selectedId = Number(routeId || params.get('id') || 0)

  const [queue, setQueue] = useState(params.get('queue') || 'waiting')
  const [category, setCategory] = useState(params.get('category') || undefined)
  const [search, setSearch] = useState(params.get('q') || '')
  const [tickets, setTickets] = useState([])
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0 })
  const [loading, setLoading] = useState(false)

  const [detail, setDetail] = useState(null)
  const [messages, setMessages] = useState([])
  const [reminders, setReminders] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(Boolean(selectedId))
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm()

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignForm] = Form.useForm()
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderForm] = Form.useForm()

  async function fetchTickets(page = pagination.page) {
    setLoading(true)
    try {
      const q = {
        page,
        per_page: pagination.per_page,
      }
      const status = QUEUE_TO_STATUS[queue]
      if (status) q.status = status
      if (search) q.search = search
      if (category) q.category = category
      const res = await listCsTickets(q)
      const rows = res?.data || res?.tickets || (Array.isArray(res) ? res : [])
      const pag = res?.pagination || {}
      setTickets(rows)
      setPagination({
        page: pag.page || page,
        per_page: pag.per_page || pagination.per_page,
        total: pag.total || rows.length,
      })
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  async function openTicket(id) {
    setParams({ id: String(id), queue })
    setDrawerOpen(true)
    try {
      const res = await getCsTicket(id)
      const ticket = res?.ticket || res
      setDetail(ticket)
      setMessages(res?.messages || ticket?.messages || [])
      setReminders(res?.reminders || [])
    } catch (err) {
      message.error(apiError(err))
    }
  }

  useEffect(() => {
    fetchTickets(1)
  }, [queue, category])

  useEffect(() => {
    if (selectedId) openTicket(selectedId)
  }, [selectedId])

  async function refreshDetail() {
    if (!detail?.id) return
    const res = await getCsTicket(detail.id)
    setDetail(res?.ticket || res)
    setMessages(res?.messages || [])
    setReminders(res?.reminders || [])
    fetchTickets()
  }

  async function handleSendReply() {
    if (!detail?.id || !replyText.trim()) return
    setReplying(true)
    try {
      await replyCsTicket(detail.id, replyText.trim())
      message.success('Reply submitted')
      setReplyText('')
      await refreshDetail()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setReplying(false)
    }
  }

  async function runAction(fn, okMsg) {
    if (!detail?.id) return
    setActionBusy(true)
    try {
      await fn()
      message.success(okMsg)
      await refreshDetail()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function handleCreate(values) {
    setCreating(true)
    try {
      const res = await createCsTicket(values)
      message.success(`Ticket ${res?.ticket_no || res?.id} created`)
      setCreateOpen(false)
      createForm.resetFields()
      await fetchTickets(1)
      if (res?.id) openTicket(res.id)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleAssign(values) {
    setActionBusy(true)
    try {
      await assignCsTicket(detail.id, values)
      message.success('Ticket assigned')
      setAssignOpen(false)
      assignForm.resetFields()
      await refreshDetail()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function handleReminder(values) {
    setActionBusy(true)
    try {
      await addCsReminder(detail.id, values)
      message.success('Reminder scheduled')
      setReminderOpen(false)
      reminderForm.resetFields()
      await refreshDetail()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActionBusy(false)
    }
  }

  const status = String(detail?.status || '').toUpperCase()

  const columns = [
    {
      title: 'Ticket #',
      dataIndex: 'ticket_no',
      key: 'ticket_no',
      width: 140,
      render: (v, r) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
          {v || `#${r.id}`}
        </span>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.callback_name || r.customer_code || 'Customer'}</div>
          {(r.callback_number || r.callback_phone) && (
            <div style={{ fontSize: 11, color: '#6B7280' }}>{r.callback_number || r.callback_phone}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Issue',
      key: 'issue',
      render: (_, r) => {
        const cn = r.awb || r.cn_no
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{r.problem_type || r.category || 'Support Inquiry'}</div>
            {cn && (
              <span
                style={{ fontSize: 11, fontFamily: 'monospace', color: '#1B8A5A', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/ops/consignments/${encodeURIComponent(cn)}`)
                }}
              >
                CN: {cn}
              </span>
            )}
          </div>
        )
      },
    },
    {
      title: 'Urgency',
      dataIndex: 'urgency',
      key: 'urgency',
      width: 100,
      render: (v) => <Tag color={v === 'CRITICAL' || v === 'HIGH' ? 'red' : 'default'}>{v || '—'}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => statusTag(v),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => <span style={{ fontSize: 12, color: '#6B7280' }}>{v ? String(v).slice(0, 16) : '—'}</span>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button size="small" type="link" onClick={() => openTicket(r.id)}>
          Open
        </Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#0F1B2D' }}>
            Customer Service & Inquiries
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Live CS tickets from the database — create, assign, process, reply, and close.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchTickets()} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            onClick={() => setCreateOpen(true)}
          >
            New ticket
          </Button>
        </Space>
      </div>

      <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Radio.Group
            value={queue}
            onChange={(e) => {
              setQueue(e.target.value)
              setParams({ queue: e.target.value })
            }}
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="waiting">Pending</Radio.Button>
            <Radio.Button value="in_progress">Processing</Radio.Button>
            <Radio.Button value="processed">Processed</Radio.Button>
            <Radio.Button value="closed">Closed</Radio.Button>
            <Radio.Button value="all">All</Radio.Button>
          </Radio.Group>

          <Space wrap>
            <Select
              placeholder="Category"
              allowClear
              value={category}
              onChange={(val) => {
                setCategory(val)
                setParams({ queue, category: val || undefined })
              }}
              style={{ width: 160 }}
              size="small"
              options={[
                { label: 'Delivery', value: 'DELIVERY' },
                { label: 'Billing', value: 'BILLING' },
                { label: 'Damaged', value: 'DAMAGED' },
                { label: 'Pickup', value: 'PICKUP' },
                { label: 'Address', value: 'ADDRESS' },
              ]}
            />
            <Input
              placeholder="Search ticket #, CN, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => fetchTickets(1)}
              prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
              style={{ width: 240 }}
              size="small"
              allowClear
            />
          </Space>
        </div>
      </Card>

      <DataTable
        columns={columns}
        dataSource={tickets}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.per_page,
          total: pagination.total,
          onChange: (p) => fetchTickets(p),
        }}
        locale={{ emptyText: 'No tickets in this queue' }}
      />

      <Drawer
        title={detail ? `${detail.ticket_no || `#${detail.id}`}: ${detail.problem_type || detail.category || 'Inquiry'}` : 'Ticket'}
        width={560}
        onClose={() => {
          setDrawerOpen(false)
          setParams({ queue })
        }}
        open={drawerOpen}
        extra={
          <Space wrap>
            {status === 'PENDING' || status === 'REOPENED' ? (
              <Button size="small" loading={actionBusy} onClick={() => runAction(() => startCsTicket(detail.id), 'Ticket started')}>
                Start
              </Button>
            ) : null}
            {status === 'PROCESSING' ? (
              <Button size="small" loading={actionBusy} onClick={() => runAction(() => processCsTicket(detail.id), 'Marked processed')}>
                Process
              </Button>
            ) : null}
            {status !== 'CLOSED' ? (
              <Button size="small" danger type="primary" loading={actionBusy} onClick={() => runAction(() => closeCsTicket(detail.id), 'Ticket closed')}>
                Close
              </Button>
            ) : (
              <Button size="small" loading={actionBusy} onClick={() => runAction(() => reopenCsTicket(detail.id), 'Ticket reopened')}>
                Reopen
              </Button>
            )}
          </Space>
        }
      >
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: 6, border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{detail.callback_name || detail.customer_code || 'Customer'}</span>
                {statusTag(detail.status)}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                Phone: {detail.callback_phone || '—'} · Channel: {detail.channel || '—'} · Urgency: {detail.urgency || '—'}
              </div>
              {(detail.cn_no || detail.awb) && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  CN:{' '}
                  <span
                    style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => navigate(`/ops/consignments/${encodeURIComponent(detail.cn_no || detail.awb)}`)}
                  >
                    {detail.cn_no || detail.awb}
                  </span>
                </div>
              )}
              {detail.issue_description && (
                <div style={{ marginTop: 8, fontSize: 13 }}>{detail.issue_description}</div>
              )}
              <Space wrap style={{ marginTop: 10 }}>
                <Button size="small" onClick={() => setAssignOpen(true)}>Assign</Button>
                <Button size="small" onClick={() => setReminderOpen(true)}>Add reminder</Button>
              </Space>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Conversation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>No replies yet.</Text>
                ) : (
                  messages.map((msg) => {
                    const isStaff = String(msg.sender_type || '').toLowerCase() === 'agent' || msg.is_staff
                    return (
                      <div
                        key={msg.id || `${msg.created_at}-${msg.body}`}
                        style={{
                          padding: '10px 12px',
                          background: isStaff ? '#ECFDF5' : '#F3F4F6',
                          border: isStaff ? '1px solid #A7F3D0' : '1px solid #E5E7EB',
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 12, color: isStaff ? '#1B8A5A' : '#4B5563', marginBottom: 4 }}>
                          {msg.sender_name || (isStaff ? 'Staff' : 'Customer')}
                          {msg.created_at ? ` · ${String(msg.created_at).slice(0, 16)}` : ''}
                        </div>
                        <div>{msg.body || msg.content}</div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {reminders.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Reminders</div>
                {reminders.map((r) => (
                  <div key={r.id} style={{ fontSize: 12, color: '#4B5563', marginBottom: 4 }}>
                    {r.scheduled_at} · {r.channel || 'EMAIL'} · {r.note || r.reminder_type || '—'}
                  </div>
                ))}
              </div>
            )}

            {status !== 'CLOSED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input.TextArea
                  rows={3}
                  placeholder="Type official reply…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  style={{ background: '#1B8A5A', borderColor: '#1B8A5A', alignSelf: 'flex-end' }}
                  onClick={handleSendReply}
                  loading={replying}
                >
                  Send Reply
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Text type="secondary">Loading ticket…</Text>
        )}
      </Drawer>

      <Modal
        title="Create CS ticket"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={creating}
        okText="Create"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} initialValues={{ channel: 'WALK_IN', urgency: 'MEDIUM', category: 'DELIVERY' }}>
          <Form.Item name="cn_no" label="Consignment #">
            <Input placeholder="Optional CN / AWB" />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'DELIVERY', label: 'Delivery' },
                { value: 'BILLING', label: 'Billing' },
                { value: 'DAMAGED', label: 'Damaged' },
                { value: 'PICKUP', label: 'Pickup' },
                { value: 'ADDRESS', label: 'Address' },
              ]}
            />
          </Form.Item>
          <Form.Item name="problem_type" label="Problem type">
            <Input placeholder="e.g. Delay, Wrong address" />
          </Form.Item>
          <Form.Item name="issue_description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="callback_name" label="Callback name">
            <Input />
          </Form.Item>
          <Form.Item name="callback_phone" label="Callback phone">
            <Input />
          </Form.Item>
          <Form.Item name="urgency" label="Urgency">
            <Select options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="channel" label="Channel">
            <Select options={['WALK_IN', 'PHONE', 'EMAIL', 'WHATSAPP', 'APP'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Assign ticket" open={assignOpen} onCancel={() => setAssignOpen(false)} onOk={() => assignForm.submit()} confirmLoading={actionBusy}>
        <Form form={assignForm} layout="vertical" onFinish={handleAssign}>
          <Form.Item name="assigned_dp" label="Assigned drop point / DP code" rules={[{ required: true }]}>
            <Input placeholder="e.g. DP-KK01" />
          </Form.Item>
          <Form.Item name="responsible_agent_id" label="Responsible agent ID">
            <Input placeholder="Optional numeric agent id" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Add reminder" open={reminderOpen} onCancel={() => setReminderOpen(false)} onOk={() => reminderForm.submit()} confirmLoading={actionBusy}>
        <Form form={reminderForm} layout="vertical" onFinish={handleReminder} initialValues={{ channel: 'EMAIL', reminder_type: 'MANUAL' }}>
          <Form.Item name="scheduled_at" label="Scheduled at (YYYY-MM-DD HH:mm:ss)" rules={[{ required: true }]}>
            <Input placeholder="2026-09-16 09:00:00" />
          </Form.Item>
          <Form.Item name="channel" label="Channel">
            <Select options={['EMAIL', 'SMS', 'PHONE', 'WHATSAPP'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
