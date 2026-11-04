import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Space, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { apiError, listPendingAppOrders } from '../../api/client'
import ConfirmAppOrderModal from '../../components/ConfirmAppOrderModal'
import ListPageLayout from '../../components/ListPageLayout'
import { money } from '../../ui/bits'

const { Text } = Typography

export default function AppOrdersPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [confirmCn, setConfirmCn] = useState(null)

  const load = useCallback(async (pageNum = 1) => {
    setLoading(true)
    setError('')
    try {
      const res = await listPendingAppOrders({
        page: pageNum,
        per_page: 25,
        search: search.trim() || undefined,
        paidOnly: true,
      })
      setRows(Array.isArray(res?.items) ? res.items : [])
      setTotal(Number(res?.pagination?.total ?? res?.total ?? 0) || 0)
      setPage(pageNum)
    } catch (err) {
      setError(apiError(err) || 'Could not load app orders')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => load(1), 250)
    return () => clearTimeout(t)
  }, [load])

  const columns = [
    {
      title: 'CN',
      dataIndex: 'displayCn',
      key: 'cn',
      width: 180,
      render: (v, r) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() =>
            navigate(
              `/ops/consignments/tracking?cn=${encodeURIComponent(r.cnNo || v)}&tab=${encodeURIComponent(r.cnNo || v)}`,
            )
          }
        >
          {v || r.cnNo}
        </Button>
      ),
    },
    {
      title: 'Route',
      key: 'route',
      width: 120,
      render: (_, r) => `${r.origin || '—'} → ${r.destination || '—'}`,
    },
    {
      title: 'Sender',
      dataIndex: 'senderName',
      key: 'sender',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Recipient',
      dataIndex: 'recipientName',
      key: 'recipient',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Booked',
      key: 'dims',
      width: 140,
      render: (_, r) => (
        <Text style={{ fontSize: 12 }}>
          {r.weightKg != null ? `${r.weightKg} kg` : '—'} · {r.pieces || 1} pcs
        </Text>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmt',
      key: 'amt',
      width: 100,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text>{money(v)}</Text>
          {r.payMode ? <Tag style={{ margin: 0 }}>{r.payMode}</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v) => <Tag color="orange">{v || 'PENDING'}</Tag>,
    },
    {
      title: '',
      key: 'act',
      width: 120,
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<CheckCircleOutlined />}
          style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
          onClick={() => setConfirmCn(r)}
        >
          Confirm
        </Button>
      ),
    },
  ]

  return (
    <>
      <ListPageLayout
        title="App order confirm"
        subtitle="Confirm weight & dimensions after the courier picks up — pickup scan can happen first."
        searchPlaceholder="Search CN, sender, recipient…"
        searchValue={search}
        onSearchChange={setSearch}
        actions={[
          {
            key: 'reload',
            label: 'Refresh',
            icon: <ReloadOutlined />,
            onClick: () => load(page),
          },
        ]}
        extraHeader={
          error ? <Alert type="warning" showIcon message={error} /> : (
            <Alert
              type="info"
              showIcon
              message={`${total} order${total === 1 ? '' : 's'} waiting for weight / dimension confirm`}
            />
          )
        }
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey={(r) => r.cnNo || r.displayCn}
        pagination={{
          current: page,
          pageSize: 25,
          total,
          onChange: (p) => load(p),
          showSizeChanger: false,
        }}
        emptyDescription="No customer-app orders waiting for confirm"
      />

      <ConfirmAppOrderModal
        open={Boolean(confirmCn)}
        cnNo={confirmCn?.cnNo || ''}
        initial={confirmCn || {}}
        onClose={() => setConfirmCn(null)}
        onConfirmed={() => {
          message.success('Order confirmed')
          load(page)
        }}
      />
    </>
  )
}
