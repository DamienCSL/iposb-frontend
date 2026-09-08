import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Timeline,
  Typography,
  message,
} from 'antd'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  MessageOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { apiError, closeCsTicket, getCsTicket, listCsTickets, replyCsTicket } from '../../api/client'

const { Title, Text } = Typography

export default function SupportPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get('id') || 0)

  const [queue, setQueue] = useState(params.get('queue') || 'waiting')
  const [search, setSearch] = useState(params.get('q') || '')
  const [inbox, setInbox] = useState({ tickets: [], summary: {}, categories: {} })
  const [loading, setLoading] = useState(false)

  // Ticket Detail Drawer
  const [detail, setDetail] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(Boolean(selectedId))
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  async function fetchTickets() {
    setLoading(true)
    try {
      const q = { queue }
      if (search) q.q = search
      const res = await listCsTickets(q)
      setInbox(res || { tickets: [], summary: {} })
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
      setDetail(res)
    } catch (err) {
      message.error(apiError(err))
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [queue])

  useEffect(() => {
    if (selectedId) openTicket(selectedId)
  }, [selectedId])

  async function handleSendReply() {
    if (!detail?.id || !replyText.trim()) return
    setReplying(true)
    try {
      await replyCsTicket(detail.id, replyText)
      message.success('Reply submitted')
      setReplyText('')
      const updated = await getCsTicket(detail.id)
      setDetail(updated)
      fetchTickets()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setReplying(false)
    }
  }

  async function handleCloseTicket() {
    if (!detail?.id) return
    try {
      await closeCsTicket(detail.id)
      message.success('Ticket marked as resolved and closed')
      setDrawerOpen(false)
      fetchTickets()
    } catch (err) {
      message.error(apiError(err))
    }
  }

  const tickets = inbox.tickets || []
  const summary = inbox.summary || {}

  const columns = [
    {
      title: 'Ticket #',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (v) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>#{v}</span>
      ),
    },
    {
      title: 'Customer / User',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1F2937' }}>{v || r.user_email || 'Customer'}</div>
          {r.phone && <div style={{ fontSize: 11, color: '#6B7280' }}>{r.phone}</div>}
        </div>
      ),
    },
    {
      title: 'Subject / Issue',
      dataIndex: 'subject',
      key: 'subject',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v || r.category || 'Support Inquiry'}</div>
          {r.awb && (
            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#1B8A5A' }}>
              AWB: {r.awb}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Queue Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => {
        if (v === 'waiting' || v === 'open') return <StatusTag status="PENDING" text="Pending" color="#D97706" />
        if (v === 'in_progress') return <StatusTag status="PROCESSING" text="Processing" color="#1668DC" />
        return <StatusTag status="CLOSED" text="Processed" color="#1B8A5A" />
      },
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => <span style={{ fontSize: 12, color: '#6B7280' }}>{v || '—'}</span>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button size="small" type="link" onClick={() => openTicket(r.id)}>
          View & Reply
        </Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Module Title Header */}
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
            Customer Service & Inquiries
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Manage delivery inquiries, damaged parcel disputes, customer tickets, and direct replies.
          </Text>
        </div>

        <Button icon={<ReloadOutlined />} onClick={fetchTickets} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Queue Filter Bar */}
      <Card
        size="small"
        bodyStyle={{ padding: '10px 14px' }}
        style={{ borderRadius: 6, borderColor: '#E5E7EB' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Radio.Group
            value={queue}
            onChange={(e) => {
              setQueue(e.target.value)
              setParams({ queue: e.target.value })
            }}
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="waiting">
              Pending ({summary.waiting || 0})
            </Radio.Button>
            <Radio.Button value="in_progress">
              Processing ({summary.in_progress || 0})
            </Radio.Button>
            <Radio.Button value="closed">
              Processed ({summary.closed || 0})
            </Radio.Button>
            <Radio.Button value="all">All Inquiries</Radio.Button>
          </Radio.Group>

          <Input
            placeholder="Search by ticket #, customer, AWB…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchTickets}
            prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
            style={{ width: 280 }}
            size="small"
            allowClear
          />
        </div>
      </Card>

      {/* Ticket List Table */}
      <DataTable
        columns={columns}
        dataSource={tickets}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: 'No tickets in this queue' }}
      />

      {/* Ticket Detail & Thread Drawer */}
      <Drawer
        title={detail ? `Ticket #${detail.id}: ${detail.subject || detail.category || 'Inquiry'}` : 'Ticket'}
        width={520}
        onClose={() => {
          setDrawerOpen(false)
          setParams({ queue })
        }}
        open={drawerOpen}
        extra={
          detail?.status !== 'closed' && (
            <Button size="small" type="primary" danger onClick={handleCloseTicket}>
              Close & Resolve
            </Button>
          )
        }
      >
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Metadata Card */}
            <div
              style={{
                padding: '10px 14px',
                background: '#F9FAFB',
                borderRadius: 6,
                border: '1px solid #E5E7EB',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{detail.customer_name || 'Customer'}</span>
                <StatusTag status={detail.status || 'OPEN'} text={detail.status || 'open'} />
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                Email: {detail.user_email || '—'} · Phone: {detail.phone || '—'}
              </div>
              {detail.awb && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Related Consignment:{' '}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A' }}>
                    {detail.awb}
                  </span>
                </div>
              )}
            </div>

            {/* Conversation Messages */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Conversation Thread</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#F3F4F6',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#4B5563', marginBottom: 4 }}>
                    Customer Message
                  </div>
                  <div>{detail.body || detail.message || detail.description || 'No initial message body.'}</div>
                </div>

                {(detail.messages || []).map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      background: msg.is_staff ? '#ECFDF5' : '#F3F4F6',
                      border: msg.is_staff ? '1px solid #A7F3D0' : '1px solid #E5E7EB',
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12, color: msg.is_staff ? '#1B8A5A' : '#4B5563', marginBottom: 4 }}>
                      {msg.sender_name || (msg.is_staff ? 'IPOSB Staff' : 'Customer')}
                    </div>
                    <div>{msg.body || msg.content}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reply Input */}
            {detail.status !== 'closed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input.TextArea
                  rows={3}
                  placeholder="Type official reply to customer…"
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
          <Empty description="No ticket selected" />
        )}
      </Drawer>
    </div>
  )
}
