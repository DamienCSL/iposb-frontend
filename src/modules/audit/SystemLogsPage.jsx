import React, { useEffect, useState } from 'react'
import { Alert, Table, Typography } from 'antd'
import { apiError, getSystemLogStats, listSystemLogs } from '../../api/client'
import ListPageLayout from '../../components/ListPageLayout'

const { Text } = Typography

export default function SystemLogsPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [listRes] = await Promise.all([
        listSystemLogs({ per_page: 50 }).catch(() => ({ data: [] })),
        getSystemLogStats().catch(() => null),
      ])
      const data = listRes?.data || listRes?.rows || listRes?.logs || (Array.isArray(listRes) ? listRes : [])
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(apiError(err) || 'Could not load system logs')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const columns = [
    { title: 'Time', dataIndex: 'created_at', key: 'created_at', width: 180, render: (v, r) => v || r.createdAt || r.upd_dt_tm || '—' },
    { title: 'Actor', dataIndex: 'actor', key: 'actor', width: 140, render: (v, r) => v || r.user || r.username || '—' },
    { title: 'Event', dataIndex: 'event', key: 'event', render: (v, r) => v || r.action || r.message || '—' },
    { title: 'Ref', dataIndex: 'ref', key: 'ref', width: 160, render: (v, r) => v || r.consignment_no || r.cn_no || '—' },
  ]

  return (
    <ListPageLayout
      title="System activity"
      subtitle="Audit trail of office actions. Empty until /ops/logs is available."
    >
      {error ? <Alert type="warning" showIcon message={error} style={{ marginBottom: 12 }} /> : null}
      <Table
        rowKey={(r, i) => r.id || r.log_id || String(i)}
        loading={loading}
        columns={columns}
        dataSource={rows}
        size="small"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Text type="secondary">No log rows yet</Text> }}
      />
    </ListPageLayout>
  )
}
