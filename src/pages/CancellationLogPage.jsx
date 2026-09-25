import React, { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Input, Select, Space, Typography, message } from 'antd'
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { apiError, exportCancellationLog, listCancellationLog } from '../api/client'
import DataTable from '../components/DataTable'
import { money } from '../ui/bits'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'ops', label: 'Ops' },
  { value: 'customer', label: 'Customer' },
  { value: 'system', label: 'System (unpaid expiry)' },
]

const TIER_OPTIONS = [
  { value: '', label: 'All tiers' },
  { value: 'before_pickup', label: 'Before pickup (0%)' },
  { value: 'return_sp', label: 'Return SP (15%)' },
  { value: 'return_pickup', label: 'Return pickup (30%)' },
  { value: 'at_hub', label: 'At hub (50%)' },
  { value: 'unpaid_expired', label: 'Unpaid expired' },
]

const PAGE_SIZE = 25

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function CancellationLogPage() {
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [q, setQ] = useState('')
  const [range, setRange] = useState(null)
  const [source, setSource] = useState('')
  const [tier, setTier] = useState('')
  const [applied, setApplied] = useState({ q: '', dateFrom: '', dateTo: '', source: '', tier: '' })
  const [data, setData] = useState({ rows: [], page: 1, limit: PAGE_SIZE, totalPages: 1, total: 0 })

  const filterParams = useCallback(
    (page = 1) => ({
      page,
      limit: PAGE_SIZE,
      q: applied.q || undefined,
      dateFrom: applied.dateFrom || undefined,
      dateTo: applied.dateTo || undefined,
      source: applied.source || undefined,
      tier: applied.tier || undefined,
    }),
    [applied]
  )

  const load = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const result = await listCancellationLog(filterParams(page))
        setData(result)
      } catch (err) {
        message.error(apiError(err))
      } finally {
        setLoading(false)
      }
    },
    [filterParams]
  )

  useEffect(() => {
    load(1)
  }, [load])

  function applyFilters() {
    setApplied({
      q: q.trim(),
      dateFrom: range?.[0] ? range[0].format('YYYY-MM-DD') : '',
      dateTo: range?.[1] ? range[1].format('YYYY-MM-DD') : '',
      source,
      tier,
    })
  }

  function clearFilters() {
    setQ('')
    setRange(null)
    setSource('')
    setTier('')
    setApplied({ q: '', dateFrom: '', dateTo: '', source: '', tier: '' })
  }

  async function onExport() {
    setExporting(true)
    try {
      const blob = await exportCancellationLog({
        q: applied.q || undefined,
        dateFrom: applied.dateFrom || undefined,
        dateTo: applied.dateTo || undefined,
        source: applied.source || undefined,
        tier: applied.tier || undefined,
      })
      const stamp = dayjs().format('YYYYMMDD_HHmmss')
      downloadBlob(blob, `cancellation_log_${stamp}.csv`)
      message.success('Export downloaded')
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      title: 'CN',
      dataIndex: 'cnNo',
      key: 'cnNo',
      render: (cn) => (
        <Link
          to={`/ops/consignments/tracking?cn=${encodeURIComponent(cn)}`}
          style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A' }}
        >
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
          {row.recipientName ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.recipientName}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Tier',
      key: 'tier',
      render: (_, row) => (
        <div>
          <div style={{ fontSize: 12 }}>{row.tierLabel || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.feePct}%
            {row.statusAtCancel ? ` · ${row.statusAtCancel}` : ''}
          </Text>
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
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.source || ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'When',
      dataIndex: 'cancelledAt',
      key: 'cancelledAt',
      render: (v) => (
        <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{v || '—'}</Text>
      ),
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true, render: (v) => v || '—' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
            Cancellation Audit Log
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Ops / customer cancellations and unpaid auto-cancels — fee, refund, and credit note references.
          </Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => load(data.page || 1)}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={onExport}
          >
            Export CSV
          </Button>
        </Space>
      </div>

      <Space wrap size="middle" style={{ width: '100%' }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="CN / customer / recipient"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={applyFilters}
          style={{ width: 240 }}
        />
        <RangePicker
          value={range}
          onChange={setRange}
          allowEmpty={[true, true]}
          style={{ width: 260 }}
        />
        <Select
          value={source}
          onChange={setSource}
          options={SOURCE_OPTIONS}
          style={{ width: 180 }}
        />
        <Select
          value={tier}
          onChange={setTier}
          options={TIER_OPTIONS}
          style={{ width: 200 }}
        />
        <Button type="primary" onClick={applyFilters}>
          Search
        </Button>
        <Button onClick={clearFilters}>Clear</Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {data.total ?? 0} result{(data.total ?? 0) === 1 ? '' : 's'}
        </Text>
      </Space>

      <DataTable
        rowKey={(row) => `${row.cnNo}-${row.cancelledAt}`}
        columns={columns}
        dataSource={data.rows || []}
        loading={loading}
        pagination={{
          current: data.page || 1,
          pageSize: data.limit || PAGE_SIZE,
          total: data.total || 0,
          onChange: (p) => load(p),
          showSizeChanger: false,
        }}
      />
    </div>
  )
}
