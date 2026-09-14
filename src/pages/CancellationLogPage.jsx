import React, { useEffect, useState } from 'react'
import { Button, Space, Typography, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { apiError, listCancellationLog } from '../api/client'
import DataTable from '../components/DataTable'
import { money } from '../ui/bits'

const { Title, Text } = Typography

export default function CancellationLogPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({ rows: [], page: 1, totalPages: 1, total: 0 })

  async function load(page = 1) {
    setLoading(true)
    try {
      const result = await listCancellationLog({ page })
      setData(result)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [])

  const columns = [
    {
      title: 'CN',
      dataIndex: 'cnNo',
      key: 'cnNo',
      render: (cn) => (
        <Link to={`/ops/consignments/tracking?cn=${encodeURIComponent(cn)}`} style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A' }}>
          {cn}
        </Link>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_, row) => (
        <div>
          <div>{row.custAcNo || '—'}</div>
          {row.recipientName ? <Text type="secondary" style={{ fontSize: 12 }}>{row.recipientName}</Text> : null}
        </div>
      ),
    },
    {
      title: 'Tier',
      key: 'tier',
      render: (_, row) => (
        <div>
          <div style={{ fontSize: 12 }}>{row.tierLabel || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.feePct}%</Text>
        </div>
      ),
    },
    { title: 'Freight', dataIndex: 'freightAmt', key: 'freightAmt', render: (v) => money(v) },
    {
      title: 'Processing fee',
      dataIndex: 'feeAmt',
      key: 'feeAmt',
      render: (v) => <Text type="danger">{money(v)}</Text>,
    },
    {
      title: 'Wallet refund',
      dataIndex: 'refundAmt',
      key: 'refundAmt',
      render: (v) => <Text style={{ color: '#1B8A5A' }}>{money(v)}</Text>,
    },
    { title: 'Credit note', dataIndex: 'creditNoteNo', key: 'creditNoteNo', render: (v) => v || '—' },
    {
      title: 'By / source',
      key: 'by',
      render: (_, row) => (
        <div>
          <div style={{ fontSize: 12 }}>{row.cancelledBy || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.source || ''}</Text>
        </div>
      ),
    },
    {
      title: 'When',
      dataIndex: 'cancelledAt',
      key: 'cancelledAt',
      render: (v) => <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{v || '—'}</Text>,
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true, render: (v) => v || '—' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>Cancellation Audit Log</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Completed cancellations with processing fee, wallet refund, and credit note references.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(data.page || 1)}>Refresh</Button>
      </div>

      <DataTable
        rowKey={(row) => `${row.cnNo}-${row.cancelledAt}`}
        columns={columns}
        dataSource={data.rows || []}
        loading={loading}
        pagination={{
          current: data.page || 1,
          pageSize: 25,
          total: data.total || (data.totalPages || 1) * 25,
          onChange: (p) => load(p),
          showSizeChanger: false,
        }}
      />
    </div>
  )
}
