import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { apiError, getSystemLogStats, listSystemLogs } from '../../api/client'
import ListPageLayout from '../../components/ListPageLayout'

const { Text } = Typography

const MODULES = [
  'Consignments',
  'Manifests',
  'Returns',
  'Pickups',
  'Master Data',
  'System',
  'General',
]

const ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'IMPORT',
  'ATTACH',
  'ASSIGN',
  'CANCEL',
  'RTS',
  'STATUS_CHANGE',
  'SYSTEM_BOOT',
  'EVENT',
]

const ACTION_COLOR = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  CANCEL: 'red',
  RTS: 'orange',
  IMPORT: 'purple',
  ASSIGN: 'cyan',
  ATTACH: 'geekblue',
  STATUS_CHANGE: 'default',
  SYSTEM_BOOT: 'default',
}

function actorLabel(row) {
  return row.actor_username || row.actor || row.user || row.username || 'system'
}

function actionLabel(row) {
  return String(row.action || row.event || '').toUpperCase() || '—'
}

export default function SystemLogsPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [module, setModule] = useState(undefined)
  const [action, setAction] = useState(undefined)
  const [dateRange, setDateRange] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async (pageNum = 1, searchOverride) => {
    setLoading(true)
    setError('')
    try {
      const q = searchOverride !== undefined ? searchOverride : search
      const params = {
        page: pageNum,
        per_page: 50,
      }
      if (String(q || '').trim()) params.search = String(q).trim()
      if (module) params.module = module
      if (action) params.action = action
      if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD')
      if (dateRange?.[1]) params.date_to = dateRange[1].format('YYYY-MM-DD')

      const [listRes, statsRes] = await Promise.all([
        listSystemLogs(params),
        getSystemLogStats().catch(() => null),
      ])
      const data = listRes?.data || listRes?.rows || listRes?.logs || (Array.isArray(listRes) ? listRes : [])
      setRows(Array.isArray(data) ? data : [])
      setTotal(Number(listRes?.pagination?.total ?? data.length) || 0)
      setPage(pageNum)
      setStats(statsRes?.stats || listRes?.stats || null)
    } catch (err) {
      setError(apiError(err) || 'Could not load system logs')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, module, action, dateRange])

  useEffect(() => {
    const t = setTimeout(() => load(1), 250)
    return () => clearTimeout(t)
  }, [load])

  const columns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 168,
      render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'),
    },
    {
      title: 'Who',
      key: 'actor',
      width: 160,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{actorLabel(r)}</Text>
          {r.actor_role ? (
            <Text type="secondary" style={{ fontSize: 12 }}>{r.actor_role}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 130,
      render: (_, r) => {
        const a = actionLabel(r)
        return <Tag color={ACTION_COLOR[a] || 'default'}>{a}</Tag>
      },
    },
    {
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: (v) => v || '—',
    },
    {
      title: 'Activity',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v, r) => v || r.message || r.event || '—',
    },
    {
      title: 'Ref',
      key: 'ref',
      width: 150,
      render: (_, r) => r.entity_id || r.ref || r.consignment_no || r.cn_no || '—',
    },
  ]

  const subtitleParts = ['Office audit trail — each row shows the activity and who did it.']
  if (stats) {
    subtitleParts.push(
      `Today ${stats.today_count ?? 0} · 7d critical ${stats.critical_events ?? 0} · active staff ${stats.active_staff ?? 0}`,
    )
  }

  return (
    <ListPageLayout
      title="System activity"
      subtitle={subtitleParts.join(' ')}
      searchPlaceholder="Search CN, actor, action, module…"
      searchValue={search}
      onSearchChange={setSearch}
      filters={[
        {
          key: 'module',
          placeholder: 'Module',
          value: module,
          onChange: setModule,
          width: 150,
          options: MODULES.map((m) => ({ value: m, label: m })),
        },
        {
          key: 'action',
          placeholder: 'Action',
          value: action,
          onChange: setAction,
          width: 150,
          options: ACTIONS.map((a) => ({ value: a, label: a })),
        },
        {
          key: 'dates',
          type: 'dateRange',
          value: dateRange,
          onChange: setDateRange,
          width: 240,
        },
      ]}
      actions={[
        {
          key: 'reload',
          label: 'Refresh',
          onClick: () => load(page),
        },
      ]}
      extraHeader={error ? <Alert type="warning" showIcon message={error} /> : null}
      columns={columns}
      dataSource={rows}
      loading={loading}
      rowKey={(r, i) => r.id || r.log_id || String(i)}
      pagination={{
        current: page,
        pageSize: 50,
        total,
        onChange: (p) => load(p),
        showSizeChanger: false,
      }}
      emptyDescription="No activity logged yet"
    />
  )
}
