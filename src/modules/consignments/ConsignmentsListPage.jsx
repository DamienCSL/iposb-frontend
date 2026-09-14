import React, { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DatePicker,
  Dropdown,
  Form,
  Modal,
  Input,
  InputNumber,
  Popconfirm,
  Progress,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
  message,
  notification,
} from 'antd'
import {
  CloseCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  apiError,
  cancelConsignment,
  downloadCsv,
  downloadExportJob,
  exportConsignments,
  importConsignments,
  listConsignments,
  saveConsignment,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import ListPageLayout from '../../components/ListPageLayout'
import StatusTag from '../../components/StatusTag'

const { Text } = Typography

const DATE_PRESETS = [
  { label: 'Today', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: 'Past 7 Days', value: [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')] },
  { label: 'Past 30 Days', value: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')] },
  { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
]

export default function ConsignmentsListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { can, isAdmin, user } = useAuth()
  const canEdit = isAdmin || ['Operation', 'Super Admin', 'Admin'].includes(user?.role)

  // Data & Pagination
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 })
  const [loading, setLoading] = useState(false)

  // Filters (SearchQueryBuilder)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState(undefined)
  const [bagStatus, setBagStatus] = useState(undefined)
  const [dateRange, setDateRange] = useState([null, null])

  // Bulk Selection
  const [selectedKeys, setSelectedKeys] = useState([])

  // Import Modal State
  const [importOpen, setImportOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [importSummary, setImportSummary] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importStatusText, setImportStatusText] = useState('')

  // Export State
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (location.pathname.endsWith('/import')) {
      setImportOpen(true)
    }
  }, [location.pathname])

  // Search debounce ~300ms
  const searchTimer = useRef(null)
  function handleSearchChange(val) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPagination((p) => ({ ...p, current: 1 }))
    }, 300)
  }

  async function loadData(page = pagination.current, pageSize = pagination.pageSize) {
    setLoading(true)
    try {
      const q = {
        page,
        per_page: pageSize,
      }
      if (debouncedSearch) q.search = debouncedSearch
      if (status) q.status = status
      if (bagStatus) q.bag_status = bagStatus
      if (dateRange[0]) q.date_from = dateRange[0].format('YYYY-MM-DD')
      if (dateRange[1]) q.date_to = dateRange[1].format('YYYY-MM-DD')

      const res = await listConsignments(q)
      // v3.5 Canonical envelope: data + pagination
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

  useEffect(() => {
    loadData(1, pagination.pageSize)
  }, [debouncedSearch, status, bagStatus, dateRange])

  // Cancel consignment handler with 403 safety
  async function handleCancel(cn) {
    try {
      await cancelConsignment(cn)
      message.success(`Consignment ${cn} has been cancelled`)
      loadData()
    } catch (err) {
      message.error(apiError(err))
    }
  }



  // Handle Export
  async function handleExportSelected() {
    setExporting(true)
    try {
      const body = {
        columns: ['cn_no', 'cust_name', 'cn_status', 'cn_origin', 'cn_dstn', 'tot_cn_amt', 'cn_dt_tm'],
      }
      if (selectedKeys.length > 0) {
        body.cns = selectedKeys
      } else {
        if (debouncedSearch) body.search = debouncedSearch
        if (status) body.status = status
        if (dateRange?.[0] && dateRange?.[1]) {
          body.date_from = dateRange[0].format('YYYY-MM-DD')
          body.date_to = dateRange[1].format('YYYY-MM-DD')
        }
      }

      notification.info({
        message: 'Consignment Export Initiated',
        description: 'Generating spreadsheet. Download will begin shortly.',
        placement: 'topRight',
      })

      const res = await exportConsignments(body)
      const exportRows = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.rows)
          ? res.rows
          : []
      const filename = res?.filename || `consignments_${new Date().toISOString().slice(0, 10)}.csv`

      if (exportRows.length > 0) {
        downloadCsv(filename, exportRows)
        message.success(`Exported ${exportRows.length} consignments successfully`)
      } else if (res?.job_id) {
        await downloadExportJob(res.job_id, filename)
        message.success('Export file downloaded successfully')
      } else {
        message.warning('No consignments found matching criteria.')
      }
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setExporting(false)
    }
  }

  // Handle Import
  async function handleImportSubmit() {
    if (!uploadFile) {
      message.warning('Please select a file to import')
      return
    }

    setUploading(true)
    setImportBusy(true)
    setImportStatusText('Importing data… this can take a few minutes for 10k rows.')

    try {
      const res = await importConsignments(uploadFile)
      setImportSummary({
        created: res?.created_count || res?.imported_count || 0,
        updated: res?.updated_count || 0,
        skipped: res?.skipped_count || 0,
        errors: res?.error_count || res?.errors?.length || 0,
      })

      notification.success({
        message: 'Import complete',
        description: `Finished processing ${res?.created_count || res?.imported_count || 0} new consignments.`,
        placement: 'topRight',
        duration: 6,
      })
      setImportStatusText('Import finished successfully.')
      loadData(1)
    } catch (err) {
      notification.error({
        message: 'Import failed',
        description: apiError(err),
        placement: 'topRight',
        duration: 8,
      })
      setImportStatusText('Import failed. Please try again.')
      message.error(apiError(err))
    } finally {
      setUploading(false)
      window.setTimeout(() => setImportBusy(false), 1400)
    }
  }

  const columns = [
    {
      title: 'CN Number',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (val, r) => (
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
            color: '#1B8A5A',
            cursor: 'pointer',
          }}
          onClick={() => navigate(`/ops/consignments/${encodeURIComponent(val || r.id)}`)}
        >
          {val || r.id}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'cn_status',
      key: 'cn_status',
      render: (val) => <StatusTag status={val} />,
    },
    {
      title: 'Bag / Manifest',
      key: 'bag_manifest',
      width: 145,
      render: (_, r) => {
        const bag = r.batch_no || r.bag_no
        const mfg = r.mfg_no
        if (!bag && !mfg) {
          return <span style={{ fontSize: 12, color: '#9CA3AF' }}>Loose Parcel</span>
        }
        return (
          <Space direction="vertical" size={2} style={{ display: 'flex' }}>
            {bag && (
              <Tag color="purple" style={{ margin: 0, fontSize: 11, fontWeight: 500 }}>
                Bag: {bag}
              </Tag>
            )}
            {mfg && (
              <Tag
                color="cyan"
                style={{ margin: 0, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/ops/manifests/${encodeURIComponent(mfg)}`)
                }}
                title="Click to view Linehaul Manifest"
              >
                MFG: {mfg}
              </Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Sender',
      dataIndex: 'consigner',
      key: 'consigner',
      render: (val, r) => val || r.senderName || r.cust_name || '—',
    },
    {
      title: 'Recipient',
      dataIndex: 'consignee',
      key: 'consignee',
      render: (val, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{val || r.recipientName || '—'}</div>
          {r.recp_name && (
            <div style={{ fontSize: 11, color: '#6B7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.recp_name}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Destination',
      key: 'destination',
      render: (_, r) => (
        <span style={{ fontSize: 12, color: '#374151' }}>
          {r.cn_origin || r.origin_branch || '—'} → <strong>{r.cn_dstn || r.destination_branch || '—'}</strong>
        </span>
      ),
    },
    {
      title: 'Pay Mode',
      key: 'pay_mode',
      render: (_, r) => {
        const isCod = r.pay_typ === 'COD' || Number(r.cod_amt || r.codAmount || 0) > 0
        return isCod ? (
          <Tag color="orange" style={{ fontWeight: 600 }}>COD RM {r.cod_amt || r.codAmount || r.tot_cn_amt}</Tag>
        ) : (
          <Tag color="blue" style={{ fontWeight: 600 }}>PPD</Tag>
        )
      },
    },
    {
      title: 'Booking Date',
      dataIndex: 'cn_dt_tm',
      key: 'cn_dt_tm',
      width: 135,
      render: (v, r) => {
        const raw = v || r.created_at || r.cn_date
        if (!raw) return <span style={{ color: '#9CA3AF' }}>—</span>
        const d = String(raw)
        return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1F2937' }}>{d.slice(0, 10)}</div>
            {d.length > 10 && (
              <div style={{ fontSize: 11, color: '#6B7280' }}>{d.slice(11, 19)}</div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Assigned Agent / Driver',
      key: 'assigned',
      render: (_, r) => {
        const agent = r.assigned_driver || r.assigned_courier || r.drop_point_name || r.agent_name
        return agent ? (
          <span style={{ fontSize: 12, fontWeight: 500, color: '#1668DC' }}>{agent}</span>
        ) : (
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>Unassigned</span>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, r) => {
        const cn = r.cn_no || r.id
        return (
          <Space size="small">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/ops/consignments/${encodeURIComponent(cn)}`)}
            >
              View
            </Button>
            {canEdit && r.cn_status !== 'CAN' && (
              <Popconfirm
                title={`Cancel consignment ${cn}?`}
                description="This will halt delivery workflows and mark as cancelled."
                onConfirm={() => handleCancel(cn)}
                okText="Yes, Cancel"
                cancelText="No"
              >
                <Button size="small" danger icon={<CloseCircleOutlined />}>
                  Cancel
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  const actions = [
    {
      key: 'create',
      label: 'New Shipment',
      icon: <PlusOutlined />,
      type: 'primary',
      onClick: () => navigate('/ops/consignments/new'),
    },
    {
      key: 'reload',
      label: 'Refresh',
      icon: <ReloadOutlined />,
      onClick: () => loadData(),
    },
    {
      key: 'import',
      label: 'Import CSV/XLSX',
      icon: <UploadOutlined />,
      onClick: () => setImportOpen(true),
    },
    {
      key: 'export',
      label: selectedKeys.length > 0 ? `Export (${selectedKeys.length})` : 'Export All',
      icon: <DownloadOutlined />,
      loading: exporting,
      onClick: handleExportSelected,
    },
  ]

  return (
    <div>
      <style>{`
        @keyframes iposb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {importBusy && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '10px 16px',
            background: 'rgba(239, 246, 255, 0.96)',
            backdropFilter: 'blur(4px)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 999,
              padding: '8px 12px',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
            }}
          >
            <div
              style={{
                width: 15,
                height: 15,
                borderRadius: '50%',
                border: '2px solid rgba(27,138,90,0.25)',
                borderTopColor: '#1B8A5A',
                animation: 'iposb-spin 0.9s linear infinite',
              }}
            />
            <div>
              <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 13 }}>{importStatusText}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>Page remains responsive while import runs.</div>
            </div>
          </div>
        </div>
      )}

      <ListPageLayout
        title="Consignments"
        subtitle="Manage and track the full consignment lifecycle across all branches and hubs."
        searchPlaceholder="Search CN, customer, sender, recipient..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filters={[
          {
            key: 'status',
            placeholder: 'All Statuses',
            value: status,
            onChange: (val) => setStatus(val),
            options: [
              { label: 'All Statuses', value: '' },
              { label: 'BDE — Order Confirmed', value: 'BDE' },
              { label: 'ACC — Awaiting Pickup', value: 'ACC' },
              { label: 'PKU — Picked Up', value: 'PKU' },
              { label: 'ARR — At Origin Hub', value: 'ARR' },
              { label: 'SRT — Sorting', value: 'SRT' },
              { label: 'INB — In Transit', value: 'INB' },
              { label: 'OFD — Out for Delivery', value: 'OFD' },
              { label: 'POD — Delivered', value: 'POD' },
              { label: 'CAN — Cancelled', value: 'CAN' },
            ],
            width: 170,
          },
          {
            key: 'bag_status',
            placeholder: 'Consolidation / Bag',
            value: bagStatus,
            onChange: (val) => setBagStatus(val),
            options: [
              { label: 'All Parcels', value: '' },
              { label: 'In Bag / Manifest', value: 'bagged' },
              { label: 'Loose Parcels (Unbagged)', value: 'loose' },
            ],
            width: 180,
          },
          {
            key: 'date_range',
            type: 'dateRange',
            value: dateRange,
            onChange: (dates) => setDateRange(dates || [null, null]),
            presets: DATE_PRESETS,
            placeholder: ['Booking Date From', 'Booking Date To'],
            width: 250,
          },
        ]}
        actions={actions}
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey="cn_no"
        selectedRowKeys={selectedKeys}
        onSelectionChange={(keys) => setSelectedKeys(keys)}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, pageSize) => loadData(page, pageSize),
        }}
        emptyText="No consignments found"
        emptyDescription="Try adjusting your search or filters."
      />



      {/* Import Modal */}
      <Modal
        title="Import Consignments"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false)
          setImportSummary(null)
          setUploadFile(null)
        }}
        footer={null}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <Text style={{ fontSize: 13, color: '#5B6B7C', display: 'block', marginBottom: 16 }}>
            Upload a spreadsheet (.xlsx, .csv) containing booking consignments. The system will parse
            addresses, parcel dimensions, and generate tracking barcodes automatically.
          </Text>

          <Upload.Dragger
            maxCount={1}
            beforeUpload={(file) => {
              setUploadFile(file)
              return false
            }}
            onRemove={() => setUploadFile(null)}
          >
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ fontSize: 36, color: '#1B8A5A' }} />
            </p>
            <p className="ant-upload-text">Click or drag file to this area to upload</p>
            <p className="ant-upload-hint">Supports .xlsx and .csv files</p>
          </Upload.Dragger>

          {importSummary && (
            <Card size="small" style={{ marginTop: 16, background: '#F8FAFC', borderRadius: 6 }}>
              <Text strong style={{ fontSize: 13, color: '#0F1B2D' }}>
                Batch Processing Summary:
              </Text>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div>Created: <Tag color="green">{importSummary.created}</Tag></div>
                <div>Updated: <Tag color="blue">{importSummary.updated}</Tag></div>
                <div>Skipped: <Tag color="orange">{importSummary.skipped}</Tag></div>
                <div>Errors: <Tag color="red">{importSummary.errors}</Tag></div>
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button onClick={() => setImportOpen(false)}>Close</Button>
            <Button
              type="primary"
              loading={uploading}
              disabled={!uploadFile}
              onClick={handleImportSubmit}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              Start Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
