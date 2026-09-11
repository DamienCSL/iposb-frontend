import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  DollarCircleOutlined,
  FileDoneOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RightCircleOutlined,
  SearchOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  apiError,
  collectCod,
  getCod,
  listCod,
  remitCod,
  settleCod,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import ListPageLayout from '../../components/ListPageLayout'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

export default function CodPage() {
  const navigate = useNavigate()
  const { can, isAdmin, user } = useAuth()
  const canManageCod =
    isAdmin ||
    ['Invoice', 'Finance', 'Droppoint Manager', 'Super Admin', 'Admin'].includes(user?.role)

  const [statusFilter, setStatusFilter] = useState('ALL') // ALL | PENDING | COLLECTED | REMITTED | SETTLED
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ pending: 0, collected: 0, remitted: 0, settled: 0 })

  // Action Dialog State
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

      const records = res?.data || res?.rows || []
      setRows(records)

      // Calculate totals for summary strip
      const stats = { pending: 0, collected: 0, remitted: 0, settled: 0 }
      records.forEach((r) => {
        const amt = Number(r.cod_amt || r.amount || 0)
        const st = String(r.status || r.cod_status || 'PENDING').toUpperCase()
        if (st === 'PENDING') stats.pending += amt
        else if (st === 'COLLECTED') stats.collected += amt
        else if (st === 'REMITTED') stats.remitted += amt
        else if (st === 'SETTLED') stats.settled += amt
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
  }, [statusFilter, search])

  // Open appropriate action modal (collect, remit, settle)
  function openAction(type, record) {
    actionForm.resetFields()
    actionForm.setFieldsValue({
      amount: record.cod_amt || record.amount || 0,
      collected_by: user?.name || user?.username,
      reference_no: `REF-${record.cn_no}-${Date.now().toString().slice(-4)}`,
    })
    setActionModal({ open: true, type, record })
  }

  async function handleActionSubmit(values) {
    const { type, record } = actionModal
    const cn = record?.cn_no || record?.id
    if (!cn) return
    setActionSubmitting(true)
    try {
      if (type === 'COLLECT') {
        await collectCod(cn, values)
        message.success(`COD collection recorded for CN ${cn}`)
      } else if (type === 'REMIT') {
        await remitCod(cn, values)
        message.success(`COD remitted to branch treasury for CN ${cn}`)
      } else if (type === 'SETTLE') {
        await settleCod(cn, values)
        message.success(`COD settled and marked as completed for CN ${cn}`)
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
      title: 'Customer / Shipper',
      dataIndex: 'consigner',
      key: 'consigner',
      render: (val, r) => val || r.cust_name || r.senderName || '—',
    },
    {
      title: 'Recipient',
      dataIndex: 'consignee',
      key: 'consignee',
      render: (val, r) => val || r.recipientName || '—',
    },
    {
      title: 'COD Amount',
      dataIndex: 'cod_amt',
      key: 'cod_amt',
      align: 'right',
      render: (v, r) => (
        <strong style={{ color: '#0F1B2D', fontSize: 13, fontFamily: 'monospace' }}>
          RM {Number(v || r.amount || 0).toFixed(2)}
        </strong>
      ),
    },
    {
      title: 'COD Status',
      dataIndex: 'status',
      key: 'status',
      render: (v, r) => <StatusTag status={v || r.cod_status || 'PENDING'} />,
    },
    {
      title: 'Linear Lifecycle Action',
      key: 'actions',
      align: 'right',
      render: (_, r) => {
        const currentSt = String(r.status || r.cod_status || 'PENDING').toUpperCase()
        return (
          <Space size="small">
            {/* Step 1: Collect */}
            <Button
              size="small"
              type={currentSt === 'PENDING' ? 'primary' : 'default'}
              disabled={!canManageCod || currentSt !== 'PENDING'}
              onClick={() => openAction('COLLECT', r)}
              style={currentSt === 'PENDING' ? { background: '#1668DC', borderColor: '#1668DC' } : {}}
            >
              Collect
            </Button>

            {/* Step 2: Remit */}
            <Button
              size="small"
              type={currentSt === 'COLLECTED' ? 'primary' : 'default'}
              disabled={!canManageCod || currentSt !== 'COLLECTED'}
              onClick={() => openAction('REMIT', r)}
              style={currentSt === 'COLLECTED' ? { background: '#0891B2', borderColor: '#0891B2' } : {}}
            >
              Remit
            </Button>

            {/* Step 3: Settle */}
            <Button
              size="small"
              type={currentSt === 'REMITTED' ? 'primary' : 'default'}
              disabled={!canManageCod || currentSt !== 'REMITTED'}
              onClick={() => openAction('SETTLE', r)}
              style={currentSt === 'REMITTED' ? { background: '#1B8A5A', borderColor: '#1B8A5A' } : {}}
            >
              Settle
            </Button>
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0F1B2D', letterSpacing: '-0.3px' }}>
            Cash On Delivery (COD) Control
          </h2>
          <div style={{ fontSize: 12, color: '#5B6B7C', marginTop: 2 }}>
            Strict linear reconciliation: Collect from consignee → Remit to hub treasury → Settle to shipper.
          </div>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Summary KPI Strip */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Pending Collection"
              value={summary.pending || 0}
              precision={2}
              prefix="RM"
              valueStyle={{ color: '#D97706', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Collected (At Station)"
              value={summary.collected || 0}
              precision={2}
              prefix="RM"
              valueStyle={{ color: '#1668DC', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Remitted to Treasury"
              value={summary.remitted || 0}
              precision={2}
              prefix="RM"
              valueStyle={{ color: '#0891B2', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Settled & Closed"
              value={summary.settled || 0}
              precision={2}
              prefix="RM"
              valueStyle={{ color: '#1B8A5A', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter / Table Container */}
      <Card size="small" style={{ borderRadius: 8 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Radio.Group
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="ALL">All COD</Radio.Button>
            <Radio.Button value="PENDING">Pending</Radio.Button>
            <Radio.Button value="COLLECTED">Collected</Radio.Button>
            <Radio.Button value="REMITTED">Remitted</Radio.Button>
            <Radio.Button value="SETTLED">Settled</Radio.Button>
          </Radio.Group>

          <Input
            placeholder="Search CN or Customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
            style={{ width: 240 }}
            allowClear
          />
        </div>
      </Card>

      <DataTable
        columns={columns}
        dataSource={rows}
        rowKey="cn_no"
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: 'No COD records matching criteria' }}
      />

      {/* Lifecycle Action Modal */}
      <Modal
        title={
          actionModal.type === 'COLLECT'
            ? `Step 1: Record COD Cash Collection (${actionModal.record?.cn_no})`
            : actionModal.type === 'REMIT'
            ? `Step 2: Remit Cash to Hub Treasury (${actionModal.record?.cn_no})`
            : `Step 3: Settle & Disburse to Shipper (${actionModal.record?.cn_no})`
        }
        open={actionModal.open}
        onCancel={() => setActionModal({ open: false, type: null, record: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={actionForm} layout="vertical" onFinish={handleActionSubmit}>
          <div style={{ fontSize: 13, color: '#5B6B7C', marginBottom: 16 }}>
            {actionModal.type === 'COLLECT' && 'Confirm that cash payment has been collected from the recipient on delivery.'}
            {actionModal.type === 'REMIT' && 'Confirm that the driver/drop point has handed over collected cash to branch finance.'}
            {actionModal.type === 'SETTLE' && 'Confirm electronic transfer or payout settlement to the merchant shipper.'}
          </div>

          <Form.Item label="Amount to Process (RM)" name="amount" rules={[{ required: true }]}>
            <InputNumber min={0.01} precision={2} prefix="RM" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="Handled By" name="collected_by">
            <Input />
          </Form.Item>

          <Form.Item label="Reference / Bank Receipt No" name="reference_no">
            <Input />
          </Form.Item>

          <Form.Item label="Audit Note" name="note">
            <Input.TextArea rows={2} placeholder="Optional audit trail note" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button onClick={() => setActionModal({ open: false, type: null, record: null })}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={actionSubmitting}
              style={{
                background:
                  actionModal.type === 'SETTLE'
                    ? '#1B8A5A'
                    : actionModal.type === 'REMIT'
                    ? '#0891B2'
                    : '#1668DC',
                borderColor: 'transparent',
              }}
            >
              Confirm {actionModal.type}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
