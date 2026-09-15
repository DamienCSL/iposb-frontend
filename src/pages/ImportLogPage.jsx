import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Space, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, EyeOutlined, ReloadOutlined, SearchOutlined, SyncOutlined } from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiError, exportImportBatchErrors, getImportBatch, listImportBatches, retryImportBatch } from '../api/client'
import DataTable from '../components/DataTable'
import ListPageLayout from '../components/ListPageLayout'
import StatusTag from '../components/StatusTag'

const { Title, Text } = Typography

function statusColor(s) {
  if (s === 'ok') return 'success'
  if (s === 'partial') return 'warning'
  if (s === 'failed') return 'error'
  return 'default'
}

function statusLabel(s) {
  if (s === 'ok') return 'No issues'
  if (s === 'partial') return 'Some rows failed'
  if (s === 'failed') return 'Import failed'
  return s || '—'
}

export default function ImportLogPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const id = Number(params.get('id') || 0)
  const q = params.get('q') || ''
  const page = Number(params.get('page') || 1)
  const [search, setSearch] = useState(q)
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState({ rows: [], totalPages: 1, total: 0 })
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [retrying, setRetrying] = useState(false)

  async function loadList() {
    setLoading(true)
    try {
      const res = await listImportBatches({ q, page })
      setList(res)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(batchId) {
    if (!batchId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      setDetail(await getImportBatch(batchId))
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleExportErrors() {
    if (!id) return
    setExporting(true)
    try {
      await exportImportBatchErrors(id)
      message.success('Error CSV downloaded')
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setExporting(false)
    }
  }

  async function handleRetry() {
    if (!id) return
    setRetrying(true)
    try {
      const res = await retryImportBatch(id)
      message.success(res?.message || 'Retry queued')
      await loadDetail(id)
      await loadList()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [q, page])

  useEffect(() => {
    loadDetail(id || 0)
  }, [id])

  const batch = detail?.batch
  const errors = detail?.errors || []

  const columns = [
    {
      title: 'When',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v) => <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{v || '—'}</Text>,
    },
    { title: 'File', dataIndex: 'file_name', key: 'file_name', ellipsis: true },
    { title: 'By', dataIndex: 'imported_by', key: 'imported_by', width: 120 },
    { title: 'Created', dataIndex: 'created_count', key: 'created_count', width: 80 },
    { title: 'Updated', dataIndex: 'updated_count', key: 'updated_count', width: 80 },
    { title: 'Issues', dataIndex: 'error_count', key: 'error_count', width: 80 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (s) => <Tag color={statusColor(s)}>{statusLabel(s)}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setParams({ q, page: String(page), id: String(row.id) })}
        >
          View
        </Button>
      ),
    },
  ]

  const errorColumns = [
    { title: 'Excel row', dataIndex: 'row_no', key: 'row_no', width: 100 },
    {
      title: 'CN',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (cn) =>
        cn ? (
          <Link to={`/ops/consignments/tracking?cn=${encodeURIComponent(cn)}`} style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A' }}>
            {cn}
          </Link>
        ) : (
          '—'
        ),
    },
    { title: 'Issue', dataIndex: 'error_code', key: 'error_code', width: 140 },
    { title: 'Why it failed', dataIndex: 'message', key: 'message' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>Import Error Log</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Review why consignment spreadsheet rows were skipped or failed.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadList}>Refresh</Button>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ops/consignments')}>
            Consignments
          </Button>
        </Space>
      </div>

      {batch ? (
        <Card
          loading={detailLoading}
          size="small"
          title={
            <Space>
              <Text strong>Import #{batch.id}</Text>
              <Tag color={statusColor(batch.status)}>{statusLabel(batch.status)}</Tag>
            </Space>
          }
          extra={
            <Space>
              {errors.length > 0 && (
                <Button size="small" icon={<DownloadOutlined />} loading={exporting} onClick={handleExportErrors}>
                  Export errors
                </Button>
              )}
              {(batch.status === 'partial' || batch.status === 'failed' || errors.length > 0) && (
                <Button size="small" icon={<SyncOutlined />} loading={retrying} onClick={handleRetry}>
                  Retry failed rows
                </Button>
              )}
              <Button type="link" size="small" onClick={() => setParams({ q, page: String(page) })}>
                Close
              </Button>
            </Space>
          }
          styles={{ body: { paddingTop: 12 } }}
        >
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }}>
            <Descriptions.Item label="When">{batch.created_at || '—'}</Descriptions.Item>
            <Descriptions.Item label="File">{batch.file_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Imported by">{batch.imported_by || '—'}</Descriptions.Item>
            <Descriptions.Item label="Result">{batch.summary || '—'}</Descriptions.Item>
          </Descriptions>
          {errors.length ? (
            <div style={{ marginTop: 12 }}>
              <DataTable
                rowKey="id"
                columns={errorColumns}
                dataSource={errors}
                pagination={false}
                size="small"
              />
            </div>
          ) : (
            <Alert type="success" showIcon style={{ marginTop: 12 }} message="This import had no row errors." />
          )}
        </Card>
      ) : null}

      <ListPageLayout
        title="Recent imports"
        searchPlaceholder="File name, user, or summary"
        searchValue={search}
        onSearchChange={setSearch}
        actions={[
          {
            key: 'search',
            label: 'Search',
            icon: <SearchOutlined />,
            type: 'primary',
            onClick: () => setParams({ q: search, page: '1', ...(id ? { id: String(id) } : {}) }),
          },
        ]}
        columns={columns}
        dataSource={list.rows || []}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 20,
          total: list.total || (list.totalPages || 1) * 20,
          onChange: (p) => setParams({ q, page: String(p), ...(id ? { id: String(id) } : {}) }),
        }}
        emptyText="No imports yet"
        emptyDescription="Batch import a spreadsheet from Consignments to see history here."
      />
    </div>
  )
}
