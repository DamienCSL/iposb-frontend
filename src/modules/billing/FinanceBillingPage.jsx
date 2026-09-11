import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Descriptions,
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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CloseCircleOutlined,
  DollarCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  apiError,
  getBilling,
  getBillingPdfUrl,
  listBilling,
  saveBilling,
  voidBilling,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import ListPageLayout from '../../components/ListPageLayout'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

const DOC_TYPES = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'credit-notes', label: 'Credit Notes' },
  { key: 'debit-notes', label: 'Debit Notes' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'do', label: 'Delivery Orders (DO)' },
  { key: 'agent-in', label: 'Agent Money In' },
  { key: 'agent-out', label: 'Agent Money Out' },
]

export default function FinanceBillingPage() {
  const { doc: pathDoc, id: pathId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { can, isAdmin, user } = useAuth()
  const canVoid = isAdmin // strictly Admin / Super Admin only per RBAC

  const activeDoc = pathDoc || params.get('doc') || 'invoices'

  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Detail Drawer State
  const [detailOpen, setDetailOpen] = useState(Boolean(pathId))
  const [activeItem, setActiveItem] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Create Document Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // Void Document Modal State
  const [voidModal, setVoidModal] = useState({ open: false, item: null })
  const [voiding, setVoiding] = useState(false)
  const [voidForm] = Form.useForm()

  async function fetchBillingData(page = pagination.current, pageSize = pagination.pageSize) {
    setLoading(true)
    try {
      const q = { page, per_page: pageSize }
      if (search) q.search = search
      if (statusFilter) q.status = statusFilter
      const res = await listBilling(activeDoc, q)

      const records = res?.data || res?.rows || []
      const pag = res?.pagination || {}
      setRows(records)
      setPagination({
        current: pag.page || page,
        pageSize: pag.per_page || pageSize,
        total: pag.total || res?.total || records.length,
      })
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await getBilling(activeDoc, id)
      setActiveItem(res?.data || res || {})
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    fetchBillingData(1, pagination.pageSize)
  }, [activeDoc, statusFilter])

  useEffect(() => {
    if (pathId) openDetail(pathId)
  }, [pathId])

  function handleTabSwitch(docKey) {
    navigate(`/ops/billing/${docKey}`)
  }

  async function handleCreateDoc(values) {
    setSaving(true)
    try {
      const res = await saveBilling(activeDoc, values)
      message.success(res?.message || 'Document created successfully')
      setDrawerOpen(false)
      form.resetFields()
      fetchBillingData(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  // Handle Void
  async function handleConfirmVoid(values) {
    const item = voidModal.item
    const id = item?.inv_no || item?.doc_no || item?.id
    if (!id) return
    setVoiding(true)
    try {
      await voidBilling(activeDoc, id, values.note)
      message.success(`Document ${id} has been voided`)
      setVoidModal({ open: false, item: null })
      voidForm.resetFields()
      setDetailOpen(false)
      fetchBillingData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setVoiding(false)
    }
  }

  const columns = [
    {
      title: 'Document Number',
      key: 'doc_no',
      render: (_, r) => {
        const docNo = r.inv_no || r.dn_no || r.recp_no || r.cn_no || r.bilyet_no || r.id
        return (
          <span
            style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A', cursor: 'pointer' }}
            onClick={() => openDetail(docNo)}
          >
            {docNo}
          </span>
        )
      },
    },
    {
      title: 'Customer / Partner',
      key: 'party',
      render: (_, r) => r.cust_name || r.cust_ac_no || r.agent_name || r.agent_cd || '—',
    },
    {
      title: 'Date',
      key: 'date',
      render: (_, r) => {
        const d = r.inv_dt || r.dn_dt || r.recp_dt || r.doc_dt || r.created_at
        return <span style={{ fontSize: 12, color: '#6B7280' }}>{d ? String(d).slice(0, 10) : '—'}</span>
      },
    },
    {
      title: 'Amount (RM)',
      key: 'amount',
      align: 'right',
      render: (_, r) => {
        const amt = r.tot_inv_amt || r.amount || r.tot_amt || r.dn_amt || 0
        return <strong style={{ color: '#0F1B2D', fontFamily: 'monospace' }}>RM {Number(amt).toFixed(2)}</strong>
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const st = r.status || (r.inv_status === 'PAY' ? 'PAID' : r.inv_status || 'ACTIVE')
        return <StatusTag status={st} />
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, r) => {
        const docNo = r.inv_no || r.dn_no || r.recp_no || r.cn_no || r.bilyet_no || r.id
        const isVoided = String(r.status || '').toUpperCase() === 'VOID' || r.is_void
        return (
          <Space size="small">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(docNo)}>
              View
            </Button>
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              onClick={() => window.open(getBillingPdfUrl(activeDoc, docNo), '_blank')}
            >
              PDF
            </Button>
            {/* Void strictly gated to Admin / Super Admin */}
            {canVoid && !isVoided && (
              <Button
                size="small"
                danger
                onClick={() => {
                  voidForm.resetFields()
                  setVoidModal({ open: true, item: r })
                }}
              >
                Void
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Document Type Selector Tabs */}
      <Card size="small" style={{ borderRadius: 8 }} bodyStyle={{ padding: '8px 16px' }}>
        <Tabs
          activeKey={activeDoc}
          onChange={handleTabSwitch}
          items={DOC_TYPES.map((t) => ({ key: t.key, label: t.label }))}
          style={{ marginBottom: 0 }}
        />
      </Card>

      <ListPageLayout
        title={`${DOC_TYPES.find((d) => d.key === activeDoc)?.label || 'Billing'}`}
        subtitle="Financial ledger, revenue reconciliation, invoice generation, and audit records."
        searchPlaceholder="Search document number or customer..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v)
          fetchBillingData(1)
        }}
        actions={[
          {
            key: 'reload',
            label: 'Refresh',
            icon: <ReloadOutlined />,
            onClick: () => fetchBillingData(),
          },
        ]}
        onNewClick={() => {
          form.resetFields()
          setDrawerOpen(true)
        }}
        newButtonText={`New ${activeDoc.replace(/-/g, ' ').replace(/s$/, '')}`}
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey={(r) => r.inv_no || r.dn_no || r.recp_no || r.id}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, pageSize) => fetchBillingData(page, pageSize),
        }}
        emptyText={`No ${activeDoc} records found`}
      />

      {/* Document Detail Drawer */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1B8A5A' }} />
            <span>Document: {activeItem?.inv_no || activeItem?.dn_no || activeItem?.id}</span>
            <StatusTag status={activeItem?.status || 'ACTIVE'} />
          </Space>
        }
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
        extra={
          activeItem && (
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              onClick={() => window.open(getBillingPdfUrl(activeDoc, activeItem.inv_no || activeItem.id), '_blank')}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              Download PDF
            </Button>
          )
        }
      >
        {detailLoading ? (
          <Text>Loading document details...</Text>
        ) : activeItem ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Doc Number">
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {activeItem.inv_no || activeItem.dn_no || activeItem.id}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Customer Account">
                <Tag color="geekblue">{activeItem.cust_ac_no || activeItem.agent_cd || 'WALK-IN'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Customer Name" span={2}>
                <strong>{activeItem.cust_name || activeItem.agent_name || '—'}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Document Date">
                {activeItem.inv_dt || activeItem.created_at || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                <strong style={{ color: '#1B8A5A', fontSize: 15 }}>
                  RM {Number(activeItem.tot_inv_amt || activeItem.amount || 0).toFixed(2)}
                </strong>
              </Descriptions.Item>
            </Descriptions>

            {/* Void Action for Admin with Audit Note Prompt */}
            {canVoid && activeItem.status !== 'VOID' && (
              <Card size="small" style={{ background: '#FEF2F2', borderColor: '#FECACA', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#991B1B' }}>Administrative Void Control</div>
                    <div style={{ fontSize: 12, color: '#7F1D1D' }}>
                      Voiding invalidates this document across financial summaries and records an audit trail.
                    </div>
                  </div>
                  <Button
                    danger
                    onClick={() => {
                      voidForm.resetFields()
                      setVoidModal({ open: true, item: activeItem })
                    }}
                  >
                    Void Document
                  </Button>
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </Drawer>

      {/* Void Confirmation Modal (Strictly required by PRD 6.9) */}
      <Modal
        title={<Space><CloseCircleOutlined style={{ color: '#D4380D' }} /> Void Billing Document</Space>}
        open={voidModal.open}
        onCancel={() => setVoidModal({ open: false, item: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={voidForm} layout="vertical" onFinish={handleConfirmVoid}>
          <Paragraph style={{ fontSize: 13, color: '#5B6B7C' }}>
            You are about to void document{' '}
            <strong>{voidModal.item?.inv_no || voidModal.item?.doc_no || voidModal.item?.id}</strong>.
            This action is permanent and restricted to Administrators.
          </Paragraph>

          <Form.Item
            label="Mandatory Audit Trail Note"
            name="note"
            rules={[{ required: true, message: 'An audit reason is required when voiding billing documents' }]}
          >
            <Input.TextArea rows={3} placeholder="Explain reason for voiding (e.g. Rate dispute, duplicate entry, incorrect consignor)" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button onClick={() => setVoidModal({ open: false, item: null })}>Cancel</Button>
            <Button type="primary" danger htmlType="submit" loading={voiding}>
              Confirm & Void
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Create Document Drawer */}
      <Drawer
        title={`New ${activeDoc}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              loading={saving}
              onClick={() => form.submit()}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              Generate Document
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleCreateDoc}>
          <Form.Item label="Customer Account" name="cust_ac_no" rules={[{ required: true }]}>
            <Input placeholder="e.g. APX-KUL-08" />
          </Form.Item>
          <Form.Item label="Customer Name" name="cust_name" rules={[{ required: true }]}>
            <Input placeholder="Company or Individual" />
          </Form.Item>
          <Form.Item label="Total Amount (RM)" name="amount" rules={[{ required: true }]}>
            <InputNumber min={0.01} precision={2} prefix="RM" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Reference CN / Memo" name="remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
