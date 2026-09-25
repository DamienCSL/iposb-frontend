import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Typography,
  message,
} from 'antd'
import {
  DollarCircleOutlined,
  ReloadOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import {
  apiError,
  collectCod,
  listCod,
  remitCod,
  settleCod,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'
import { money } from '../../ui/bits'

const { Title, Text } = Typography
const BRAND = '#1B8A5A'

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending collection' },
  { key: 'COLLECTED', label: 'Collected' },
  { key: 'REMITTED', label: 'Remitted' },
  { key: 'SETTLED', label: 'Settled' },
]

function cnOf(r) {
  return String(r?.cnNo || r?.cn_no || r?.consignment_no || '').toUpperCase()
}

function expectedOf(r) {
  return Number(r?.expectedAmt ?? r?.cod_amt ?? r?.amount ?? 0)
}

function collectedOf(r) {
  return Number(r?.collectedAmt ?? r?.collected_amt ?? 0)
}

export default function CodPage() {
  const { isAdmin, user } = useAuth()
  const canManageCod =
    isAdmin ||
    ['Invoice', 'Finance', 'Droppoint Manager', 'Super Admin', 'Admin'].includes(user?.role)

  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ pending: 0, collected: 0, remitted: 0, settled: 0 })

  const [actionModal, setActionModal] = useState({ open: false, type: null, record: null })
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [actionForm] = Form.useForm()

  async function loadData() {
    setLoading(true)
    try {
      const q = {}
      if (statusFilter !== 'ALL') q.status = statusFilter
      if (search) q.search = search
      const res = await listCod(q)
      const records = res?.data || res?.rows || res?.items || []
      setRows(Array.isArray(records) ? records : [])

      const stats = { pending: 0, collected: 0, remitted: 0, settled: 0 }
      records.forEach((r) => {
        const amt = expectedOf(r)
        const st = String(r.status || r.cod_status || 'PENDING').toUpperCase()
        if (st === 'PENDING') stats.pending += amt
        else if (st === 'COLLECTED') stats.collected += collectedOf(r) || amt
        else if (st === 'REMITTED') stats.remitted += collectedOf(r) || amt
        else if (st === 'SETTLED') stats.settled += collectedOf(r) || amt
      })
      setSummary(res?.summary || stats)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search])

  function openAction(type, record) {
    actionForm.resetFields()
    if (type === 'COLLECT') {
      actionForm.setFieldsValue({
        amount: expectedOf(record),
        drop_point_code: record.dropPointCode || record.drop_point_code || '',
        recipient_name: record.recipientName || record.recpName || record.recp_name || '',
        note: '',
      })
    } else if (type === 'REMIT') {
      actionForm.setFieldsValue({ bilyet_no: record.remittanceRef || '' })
    } else {
      actionForm.setFieldsValue({ note: '' })
    }
    setActionModal({ open: true, type, record })
  }

  async function handleActionSubmit(values) {
    const { type, record } = actionModal
    const cn = cnOf(record)
    if (!cn) return
    setActionSubmitting(true)
    try {
      if (type === 'COLLECT') {
        if (!values.drop_point_code) {
          message.warning('Drop point code is required for counter collection.')
          return
        }
        await collectCod(cn, {
          amount: values.amount,
          collected_amt: values.amount,
          drop_point_code: values.drop_point_code,
          recipient_name: values.recipient_name,
          note: values.note,
        })
        message.success(`COD collected for ${cn}`)
      } else if (type === 'REMIT') {
        if (!values.bilyet_no) {
          message.warning('Bilyet number is required. Create Money In under Drop Point billing first if needed.')
          return
        }
        await remitCod(cn, { bilyet_no: values.bilyet_no })
        message.success(`COD remitted for ${cn}`)
      } else if (type === 'SETTLE') {
        await settleCod(cn, { note: values.note })
        message.success(`COD settled for ${cn}`)
      }
      setActionModal({ open: false, type: null, record: null })
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActionSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'CN',
      key: 'cn',
      render: (_, r) => (
        <Link to={`/ops/consignments/${encodeURIComponent(cnOf(r))}`}>
          <Text code style={{ color: BRAND }}>{cnOf(r)}</Text>
        </Link>
      ),
    },
    {
      title: 'Customer / Consignee',
      key: 'party',
      render: (_, r) => (
        <div>
          <div>{r.custAcNo || r.cust_ac_no || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.recpName || r.recp_name || r.recipientName || ''}</Text>
        </div>
      ),
    },
    {
      title: 'Expected',
      key: 'expected',
      align: 'right',
      render: (_, r) => money(expectedOf(r)),
    },
    {
      title: 'Collected',
      key: 'collected',
      align: 'right',
      render: (_, r) => money(collectedOf(r)),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => <StatusTag status={r.status || r.cod_status || 'PENDING'} />,
    },
    {
      title: 'Drop point',
      key: 'dp',
      render: (_, r) => r.dropPointCode || r.drop_point_code || '—',
    },
    {
      title: 'Collected at',
      key: 'at',
      render: (_, r) => (r.collectedAt || r.collected_at ? String(r.collectedAt || r.collected_at).slice(0, 16) : '—'),
    },
    {
      title: 'Bilyet',
      key: 'bilyet',
      render: (_, r) => r.remittanceRef || r.remittance_ref || '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, r) => {
        if (!canManageCod) return null
        const st = String(r.status || r.cod_status || 'PENDING').toUpperCase()
        return (
          <Space wrap>
            {st === 'PENDING' ? (
              <Button size="small" type="primary" style={{ background: BRAND, borderColor: BRAND }} onClick={() => openAction('COLLECT', r)}>
                Collect
              </Button>
            ) : null}
            {st === 'COLLECTED' ? (
              <Button size="small" onClick={() => openAction('REMIT', r)}>Remit</Button>
            ) : null}
            {st === 'REMITTED' ? (
              <Button size="small" onClick={() => openAction('SETTLE', r)}>Settle</Button>
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>COD Reconciliation</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Collect at drop point → remit with bilyet → settle. Create{' '}
            <Link to="/ops/billing/agent-in?mode=entry">Drop Point Money In</Link> before remitting.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>Refresh</Button>
      </div>

      <Alert
        type="info"
        showIcon
        message="Damien COD flow"
        description="API rows use camelCase (cnNo, expectedAmt, dropPointCode). Counter collect requires drop_point_code; remit requires bilyet_no."
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Pending" value={summary.pending} prefix={<DollarCircleOutlined />} precision={2} valueStyle={{ color: '#D97706' }} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Collected" value={summary.collected} precision={2} valueStyle={{ color: '#1668DC' }} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Remitted" value={summary.remitted} precision={2} valueStyle={{ color: BRAND }} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Settled" value={summary.settled} prefix={<WalletOutlined />} precision={2} /></Card>
        </Col>
      </Row>

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          {STATUS_TABS.map((t) => (
            <Button
              key={t.key}
              type={statusFilter === t.key ? 'primary' : 'default'}
              style={statusFilter === t.key ? { background: BRAND, borderColor: BRAND } : undefined}
              onClick={() => setStatusFilter(t.key)}
            >
              {t.label}
            </Button>
          ))}
          <Input.Search
            allowClear
            placeholder="Search CN / customer"
            style={{ width: 240 }}
            onSearch={(v) => setSearch(v)}
          />
        </Space>
        <DataTable
          loading={loading}
          rowKey={(r) => cnOf(r) || r.id}
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'No COD records in this status' }}
        />
      </Card>

      <Modal
        title={
          actionModal.type === 'COLLECT'
            ? `Collect COD — ${cnOf(actionModal.record)}`
            : actionModal.type === 'REMIT'
              ? `Remit COD — ${cnOf(actionModal.record)}`
              : `Settle COD — ${cnOf(actionModal.record)}`
        }
        open={actionModal.open}
        onCancel={() => setActionModal({ open: false, type: null, record: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={actionForm} layout="vertical" onFinish={handleActionSubmit}>
          {actionModal.type === 'COLLECT' ? (
            <>
              <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="RM" />
              </Form.Item>
              <Form.Item
                name="drop_point_code"
                label="Drop point code"
                rules={[{ required: true, message: 'Drop point code is required' }]}
              >
                <Input placeholder="e.g. DP-KUL-01" />
              </Form.Item>
              <Form.Item name="recipient_name" label="Recipient name">
                <Input />
              </Form.Item>
              <Form.Item name="note" label="Note">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          ) : null}
          {actionModal.type === 'REMIT' ? (
            <Form.Item
              name="bilyet_no"
              label="Bilyet No (Money In)"
              rules={[{ required: true, message: 'Bilyet number is required' }]}
              extra={<Link to="/ops/billing/agent-in?mode=entry">Create Drop Point Money In</Link>}
            >
              <Input placeholder="Bilyet number" />
            </Form.Item>
          ) : null}
          {actionModal.type === 'SETTLE' ? (
            <Form.Item name="note" label="Note">
              <Input.TextArea rows={2} />
            </Form.Item>
          ) : null}
          <Space>
            <Button onClick={() => setActionModal({ open: false, type: null, record: null })}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={actionSubmitting} style={{ background: BRAND, borderColor: BRAND }}>
              Confirm
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
