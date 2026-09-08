import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tabs,
  Typography,
  message,
} from 'antd'
import {
  DollarCircleOutlined,
  DownloadOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { apiError, listBilling, saveBilling } from '../../api/client'
import ListPageLayout from '../../components/ListPageLayout'
import StatusTag from '../../components/StatusTag'

const { Title, Text } = Typography

export default function FinanceBillingPage() {
  const [params, setParams] = useSearchParams()
  const activeDoc = params.get('doc') || 'invoices'

  const [data, setData] = useState({ rows: [], page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Create Document Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  async function fetchBillingData() {
    setLoading(true)
    try {
      const q = { page: 1 }
      if (search) q.search = search
      if (statusFilter) q.status = statusFilter
      const res = await listBilling(activeDoc, q)
      setData(res || { rows: [], page: 1, totalPages: 1 })
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBillingData()
  }, [activeDoc, statusFilter])

  async function handleCreateDoc(values) {
    setSaving(true)
    try {
      const res = await saveBilling(activeDoc, values)
      message.success(res.message || 'Document created successfully')
      setDrawerOpen(false)
      form.resetFields()
      fetchBillingData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  // Column definitions per tab
  const columnsByDoc = {
    invoices: [
      {
        title: 'Invoice Number',
        dataIndex: 'inv_no',
        key: 'inv_no',
        render: (v) => (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A' }}>
            {v}
          </span>
        ),
      },
      { title: 'Customer Account', dataIndex: 'cust_ac_no', key: 'cust_ac_no' },
      { title: 'Date', dataIndex: 'inv_dt', key: 'inv_dt' },
      {
        title: 'Total Amount',
        dataIndex: 'tot_inv_amt',
        key: 'tot_inv_amt',
        align: 'right',
        render: (v) => (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
            RM {Number(v || 0).toFixed(2)}
          </span>
        ),
      },
      {
        title: 'Outstanding Balance',
        dataIndex: 'bal_inv_amt',
        key: 'bal_inv_amt',
        align: 'right',
        render: (v) => (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: Number(v) > 0 ? '#D97706' : '#1B8A5A' }}>
            RM {Number(v || 0).toFixed(2)}
          </span>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'inv_status',
        key: 'inv_status',
        render: (v) => <StatusTag status={v === 'PAY' ? 'PAID' : 'UNPAID'} />,
      },
    ],
    do: [
      {
        title: 'Delivery Order #',
        dataIndex: 'dn_no',
        key: 'dn_no',
        render: (v) => (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{v}</span>
        ),
      },
      { title: 'Customer Account', dataIndex: 'cust_ac_no', key: 'cust_ac_no' },
      { title: 'Date', dataIndex: 'dn_dt', key: 'dn_dt' },
      {
        title: 'Route',
        key: 'route',
        render: (_, r) => `${r.cn_origin || '—'} → ${r.cn_dstn || '—'}`,
      },
      {
        title: 'Status',
        dataIndex: 'cn_status',
        key: 'cn_status',
        render: (v) => <StatusTag status={v} />,
      },
    ],
    receipts: [
      {
        title: 'Invoice / Ref #',
        dataIndex: 'inv_no',
        key: 'inv_no',
        render: (v) => (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{v}</span>
        ),
      },
      { title: 'Customer', dataIndex: 'cust_ac_no', key: 'cust_ac_no' },
      { title: 'Payment Date', dataIndex: 'pay_dt', key: 'pay_dt' },
      {
        title: 'Amount Received',
        dataIndex: 'pay_amt',
        key: 'pay_amt',
        align: 'right',
        render: (v) => (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A' }}>
            RM {Number(v || 0).toFixed(2)}
          </span>
        ),
      },
      { title: 'Method', dataIndex: 'pay_typ', key: 'pay_typ' },
      {
        title: 'Status',
        dataIndex: 'pay_status',
        key: 'pay_status',
        render: (v) => <StatusTag status={v || 'PAID'} />,
      },
    ],
    'credit-notes': [
      {
        title: 'Note Number',
        dataIndex: 'credit_note_no',
        key: 'credit_note_no',
        render: (v) => (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{v}</span>
        ),
      },
      { title: 'Customer', dataIndex: 'cust_ac_no', key: 'cust_ac_no' },
      { title: 'Date', dataIndex: 'credit_note_date', key: 'credit_note_date' },
      { title: 'Invoice Ref', dataIndex: 'invoice_no', key: 'invoice_no' },
      {
        title: 'Amount',
        dataIndex: 'total_amount',
        key: 'total_amount',
        align: 'right',
        render: (v) => (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
            RM {Number(v || 0).toFixed(2)}
          </span>
        ),
      },
      { title: 'Reason', dataIndex: 'reason', key: 'reason' },
    ],
  }

  const columns = columnsByDoc[activeDoc] || columnsByDoc.invoices

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
            Finance & Billing Management
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Centralized billing documents, delivery orders, payment receipts, and credit notes.
          </Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchBillingData} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            onClick={() => {
              form.resetFields()
              setDrawerOpen(true)
            }}
          >
            + Create Document
          </Button>
        </Space>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeDoc}
        onChange={(k) => setParams({ doc: k })}
        items={[
          {
            key: 'invoices',
            label: (
              <span>
                <DollarCircleOutlined style={{ marginRight: 6 }} />
                Invoices
              </span>
            ),
          },
          {
            key: 'do',
            label: (
              <span>
                <FileDoneOutlined style={{ marginRight: 6 }} />
                Delivery Orders (DO)
              </span>
            ),
          },
          {
            key: 'receipts',
            label: (
              <span>
                <FileTextOutlined style={{ marginRight: 6 }} />
                Receipts
              </span>
            ),
          },
          {
            key: 'credit-notes',
            label: (
              <span>
                <FileTextOutlined style={{ marginRight: 6 }} />
                Credit Notes
              </span>
            ),
          },
        ]}
      />

      <ListPageLayout
        title=""
        searchPlaceholder={`Search by reference or customer account…`}
        searchValue={search}
        onSearchChange={setSearch}
        columns={columns}
        dataSource={data.rows || []}
        loading={loading}
        rowKey={(r, i) => r.inv_no || r.dn_no || r.credit_note_no || i}
        pagination={{ pageSize: 15 }}
        onNewClick={() => {
          form.resetFields()
          setDrawerOpen(true)
        }}
        newButtonText="+ Create Document"
      />

      {/* Adaptable Create Document Drawer */}
      <Drawer
        title={`Create New ${activeDoc === 'invoices' ? 'Invoice' : activeDoc === 'do' ? 'Delivery Order' : activeDoc === 'receipts' ? 'Receipt' : 'Credit Note'}`}
        width={460}
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
              Save Document
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleCreateDoc}>
          <Form.Item
            name="cust_ac_no"
            label="Customer Account #"
            rules={[{ required: true, message: 'Customer account is required' }]}
          >
            <Input placeholder="e.g. CUST001" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name={activeDoc === 'invoices' ? 'inv_dt' : activeDoc === 'do' ? 'dn_dt' : 'doc_date'}
                label="Document Date"
                initialValue={new Date().toISOString().slice(0, 10)}
              >
                <input
                  type="date"
                  style={{
                    width: '100%',
                    height: 32,
                    padding: '0 8px',
                    border: '1px solid #D1D5DB',
                    borderRadius: 4,
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amount" label="Total Amount (RM)">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {activeDoc === 'invoices' && (
            <Form.Item name="remarks" label="Invoice Remarks / Reference">
              <Input placeholder="Optional reference or PO number" />
            </Form.Item>
          )}

          {activeDoc === 'credit-notes' && (
            <>
              <Form.Item name="invoice_no" label="Invoice Reference #">
                <Input placeholder="e.g. INV2026-001" />
              </Form.Item>
              <Form.Item name="reason" label="Adjustment Reason">
                <Input.TextArea rows={2} placeholder="Reason for credit/debit adjustment" />
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>
    </div>
  )
}
