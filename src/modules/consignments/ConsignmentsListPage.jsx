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
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  apiError,
  cancelConsignment,
  cancelConsignmentsBatch,
  downloadCsv,
  downloadExportJob,
  exportConsignments,
  importConsignments,
  listConsignments,
  saveConsignment,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { consignmentsNewPath, isDroppointManager } from '../../auth/rbac'
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
  const isDpManager = isDroppointManager(user?.role)
  const newCnPath = consignmentsNewPath(user?.role)

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
  const [batchCancelling, setBatchCancelling] = useState(false)

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
      if (status === 'ALL') {
        q.include_cancelled = 1
      } else if (status) {
        q.status = status
      }
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

  function notifyCancelFailure(cn, errorText) {
    notification.error({
      message: `Cannot cancel ${cn}`,
      description: errorText || 'This order cannot be cancelled.',
      placement: 'topRight',
      duration: 8,
    })
  }

  // Cancel consignment — must send confirmNotAddressChange (API returns 422 without it)
  async function handleCancel(cn) {
    try {
      await cancelConsignment(cn, { confirmNotAddressChange: true })
      message.success(`Consignment ${cn} has been cancelled`)
      loadData()
    } catch (err) {
      notifyCancelFailure(cn, apiError(err))
    }
  }

  async function handleBatchCancel() {
    const codes = selectedKeys.map((k) => String(k).trim().toUpperCase()).filter(Boolean)
    if (codes.length === 0) {
      message.warning('Select at least one consignment to cancel.')
      return
    }
    setBatchCancelling(true)
    try {
      const res = await cancelConsignmentsBatch({
        cnNos: codes,
        confirmNotAddressChange: true,
      })
      const succeeded = Array.isArray(res?.succeeded) ? res.succeeded : []
      const failed = Array.isArray(res?.failed) ? res.failed : []

      if (succeeded.length > 0) {
        message.success(
          res?.message || `Cancelled ${succeeded.length} consignment(s).`,
        )
      } else if (failed.length === 0) {
        message.warning(res?.message || 'No consignments cancelled.')
      }

      failed.forEach((item) => {
        notifyCancelFailure(
          item?.cnNo || item?.cn_no || 'CN',
          item?.error || 'This order cannot be cancelled.',
        )
      })

      if (failed.length > 0 && succeeded.length > 0) {
        notification.warning({
          message: 'Batch cancel partially completed',
          description: `${succeeded.length} cancelled, ${failed.length} failed. See error notifications for details.`,
          placement: 'topRight',
          duration: 8,
        })
      } else if (failed.length > 0 && succeeded.length === 0) {
        notification.error({
          message: 'Batch cancel failed',
          description: `None of the ${failed.length} selected order(s) could be cancelled.`,
          placement: 'topRight',
          duration: 8,
        })
      }

      setSelectedKeys([])
      loadData()
    } catch (err) {
      notification.error({
        message: 'Batch cancel failed',
        description: apiError(err),
        placement: 'topRight',
        duration: 8,
      })
    } finally {
      setBatchCancelling(false)
    }
  }

  function trackSelected() {
    if (selectedKeys.length === 0) {
      message.warning('Select at least one consignment.')
      return
    }
    const codes = selectedKeys.map((k) => String(k).trim().toUpperCase()).filter(Boolean)
    if (codes.length === 0) {
      message.warning('Select at least one consignment.')
      return
    }
    const first = codes[0]
    navigate(
      `/ops/consignments/tracking?cn=${encodeURIComponent(codes.join(','))}&tab=${encodeURIComponent(first)}`,
    )
  }

  function selectedCnCodes() {
    return selectedKeys.map((k) => String(k).trim().toUpperCase()).filter(Boolean)
  }

  function selectedConsignmentRows() {
    const keySet = new Set(selectedCnCodes())
    return rows.filter((r) => keySet.has(String(r.cn_no || r.id || '').trim().toUpperCase()))
  }

  function uniqueCodes(values) {
    const out = []
    const seen = new Set()
    for (const raw of values) {
      const code = String(raw || '').trim().toUpperCase()
      if (!code || seen.has(code)) continue
      seen.add(code)
      out.push(code)
    }
    return out
  }

  function openPrintPages(kind, ids, emptyMsg) {
    if (!ids.length) {
      message.warning(emptyMsg)
      return
    }
    if (ids.length === 1) {
      navigate(`/ops/reports/${kind}?id=${encodeURIComponent(ids[0])}`)
      return
    }
    ids.forEach((id) => {
      window.open(`/ops/reports/${kind}?id=${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer')
    })
    message.info(`Opened ${ids.length} print pages`)
  }

  function printSelected(format) {
    const codes = selectedCnCodes()
    if (codes.length === 0) {
      message.warning('Select at least one consignment to print.')
      return
    }
    const formatQs =
      format && ['thermal', 'a5', 'a4-4'].includes(format)
        ? `&format=${encodeURIComponent(format)}`
        : ''
    navigate(`/ops/reports/cn?id=${encodeURIComponent(codes.join(','))}${formatQs}`)
  }

  function printSelectedManifest() {
    const ids = uniqueCodes(selectedConsignmentRows().map((r) => r.mfg_no || r.mfgNo))
    openPrintPages(
      'manifest',
      ids,
      'None of the selected consignments are on a consignment manifesto yet.',
    )
  }

  function printSelectedSealManifest() {
    const ids = uniqueCodes(
      selectedConsignmentRows().map((r) => r.batch_no || r.bag_no || r.seal_no || r.sealNo),
    )
    openPrintPages(
      'seal-manifest',
      ids,
      'None of the selected consignments are in a seal / bag yet.',
    )
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
      const createdN = res?.created_count ?? res?.created ?? res?.imported_count ?? 0
      const updatedN = res?.updated_count ?? res?.updated ?? 0
      const skippedN = res?.skipped_count ?? res?.skipped ?? 0
      const errorN = res?.error_count ?? res?.errorCount ?? (Array.isArray(res?.errors) ? res.errors.length : 0)
      setImportSummary({
        created: createdN,
        updated: updatedN,
        skipped: skippedN,
        errors: errorN,
      })

      const status = res?.status || (errorN > 0 ? 'partial' : 'ok')
      if (status === 'failed') {
        notification.error({
          message: 'Import failed',
          description: res?.summary || 'No consignments were created. Check the import error log.',
          placement: 'topRight',
          duration: 8,
        })
      } else if (errorN > 0) {
        notification.warning({
          message: 'Import completed with issues',
          description: res?.summary || `Created ${createdN}, skipped ${skippedN}, issues ${errorN}.`,
          placement: 'topRight',
          duration: 8,
        })
      } else {
        notification.success({
          message: 'Import complete',
          description: res?.summary || `Created ${createdN} consignments.`,
          placement: 'topRight',
          duration: 6,
        })
      }
      setImportStatusText(res?.summary || 'Import finished.')
      loadData(1)

      const batchId = res?.batch_id || res?.batchId || res?.id
      if (batchId || errorN > 0) {
        const qs = batchId ? `?id=${encodeURIComponent(batchId)}` : ''
        notification.info({
          message: 'Review import log',
          description: (
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={() => {
                setImportOpen(false)
                navigate(`/ops/consignments/import-log${qs}`)
              }}
            >
              Open import error log →
            </Button>
          ),
          placement: 'topRight',
          duration: 10,
        })
      }
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
          onClick={() => navigate(`/ops/consignments/tracking?cn=${encodeURIComponent(val || r.id)}&tab=${encodeURIComponent(val || r.id)}`)}
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
        const pay = String(r.pay_mode || r.ppd_cct || r.pay_typ || '').toUpperCase()
        const isCod = r.is_cod === true || r.is_cod === 1 || r.is_cod === '1' || pay === 'COD'
        const label = String(r.pay_mode_label || r.payment_offer || '').trim()
        const amt = r.cod_amt ?? r.cod_expected_amt ?? r.cash_amt ?? r.tot_cn_amt
        if (isCod) {
          return (
            <Tag color="orange" style={{ fontWeight: 600 }}>
              COD{amt != null && Number(amt) > 0 ? ` RM ${Number(amt).toFixed(2)}` : ''}
            </Tag>
          )
        }
        const display = label && !['PPD', 'PREPAID'].includes(label.toUpperCase())
          ? label
          : 'PPD'
        return (
          <Tag color="blue" style={{ fontWeight: 600 }}>{display}</Tag>
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
              onClick={() => navigate(`/ops/consignments/tracking?cn=${encodeURIComponent(cn)}&tab=${encodeURIComponent(cn)}`)}
            >
              View detail
            </Button>
            {canEdit && r.cn_status !== 'CAN' && (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() =>
                  navigate(
                    consignmentsNewPath(user?.role, { cn }),
                  )
                }
              >
                Edit
              </Button>
            )}
            {canEdit && r.cn_status !== 'CAN' && (
              <Popconfirm
                title={`Cancel consignment ${cn}?`}
                description="This cancels the order (not an address change). Delivery workflows will halt and status becomes CAN."
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
      label: isDpManager ? 'DP Counter Booking' : 'New Shipment',
      icon: <PlusOutlined />,
      type: 'primary',
      onClick: () => navigate(newCnPath),
    },
    {
      key: 'track',
      label: selectedKeys.length > 0 ? `Open selected (${selectedKeys.length})` : 'Open selected',
      icon: <SearchOutlined />,
      disabled: selectedKeys.length === 0,
      onClick: trackSelected,
    },
    {
      key: 'print',
      label: selectedKeys.length > 0 ? `Print (${selectedKeys.length})` : 'Print',
      icon: <PrinterOutlined />,
      disabled: selectedKeys.length === 0,
      onClick: () => printSelected(),
      menu: {
        items: [
          {
            key: 'cn',
            label: 'CN note(s)',
            icon: <PrinterOutlined />,
            onClick: () => printSelected(),
          },
          {
            key: 'cn-thermal',
            label: 'CN note · Thermal',
            onClick: () => printSelected('thermal'),
          },
          {
            key: 'cn-a5',
            label: 'CN note · A5',
            onClick: () => printSelected('a5'),
          },
          {
            key: 'cn-a4',
            label: 'CN note · A4 (4 per page)',
            onClick: () => printSelected('a4-4'),
          },
          { type: 'divider' },
          {
            key: 'manifest',
            label: 'Consignment manifesto',
            onClick: printSelectedManifest,
          },
          {
            key: 'seal-manifest',
            label: 'Seal manifesto',
            onClick: printSelectedSealManifest,
          },
        ],
      },
    },
    ...(canEdit
      ? [
          {
            key: 'batch-cancel',
            label:
              selectedKeys.length > 0
                ? `Cancel selected (${selectedKeys.length})`
                : 'Cancel selected',
            icon: <CloseCircleOutlined />,
            danger: true,
            disabled: selectedKeys.length === 0 || batchCancelling,
            loading: batchCancelling,
            onClick: () => {
              if (selectedKeys.length === 0) {
                message.warning('Select at least one consignment to cancel.')
                return
              }
              Modal.confirm({
                title: `Cancel ${selectedKeys.length} consignment(s)?`,
                content:
                  'This cancels the selected order(s) (not an address change). Orders that cannot be cancelled (billed, already CAN, or in transit) will be skipped and listed in error notifications.',
                okText: 'Yes, cancel selected',
                okButtonProps: { danger: true },
                cancelText: 'No',
                onOk: handleBatchCancel,
              })
            },
          },
        ]
      : []),
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
              { label: 'Active (hide cancelled)', value: '' },
              { label: 'All including cancelled', value: 'ALL' },
              { label: 'BDE — Order Confirmed', value: 'BDE' },
              { label: 'ACC — Awaiting Pickup', value: 'ACC' },
              { label: 'PKU — Shipment Picked Up', value: 'PKU' },
              { label: 'ODP — Arrived at Origin Delivery Point', value: 'ODP' },
              { label: 'SRT — Sorting in Progress (seal/bag)', value: 'SRT' },
              { label: 'DTH — Departure to Hub', value: 'DTH' },
              { label: 'ARR — Arrived at Origin Hub', value: 'ARR' },
              { label: 'GWD — Departed Hub', value: 'GWD' },
              { label: 'INB — In Transit', value: 'INB' },
              { label: 'MNF — In Transit (Manifest)', value: 'MNF' },
              { label: 'HUB — Arrived at Destination Hub', value: 'HUB' },
              { label: 'SHB — Arrived at Delivery Station', value: 'SHB' },
              { label: 'OFD — Out for Delivery', value: 'OFD' },
              { label: 'UND — Unsuccessful Delivery Attempt', value: 'UND' },
              { label: 'OVN — Awaiting Redelivery', value: 'OVN' },
              { label: 'SCF — Awaiting Collection at Station', value: 'SCF' },
              { label: 'POD — Delivered', value: 'POD' },
              { label: 'CAN — Cancelled', value: 'CAN' },
            ],
            width: 220,
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
          <Text style={{ fontSize: 13, color: '#5B6B7C', display: 'block', marginBottom: 12 }}>
            Upload CSV/XLSX to create consignments (auto CN). Blank Customer Account auto-creates (or reuses) a walk-in
            account from Sender Name + Phone. Same account + same receiver on multiple rows = one multi-piece CN.
            Dims L/W/H + weight required. Payment Type: Cash / Credit / Online Transfer / FPS / COD / PPD
            (only COD is cash-on-delivery; others book as PPD without gateway).
          </Text>

          <Space wrap style={{ marginBottom: 16 }}>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => {
                const csvCell = (v) => {
                  const s = String(v ?? '')
                  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
                  return s
                }
                const csvRow = (cols) => cols.map(csvCell).join(',')
                const header = [
                  'Sender Name',
                  'Sender Phone',
                  'Sender Address',
                  'Sender Postcode',
                  'Receiver Name',
                  'Receiver Phone',
                  'Receiver Address',
                  'Receiver Postcode',
                  'Service / Shipment Type',
                  'Parcel Type',
                  'Total Weight (kg)',
                  'Length (cm)',
                  'Width (cm)',
                  'Height (cm)',
                  'Parcel Value (RM)',
                  'Category of Items',
                  'Payment Type',
                  'Customer Account',
                  'Partner Code',
                  'Partner Tracking No.',
                ]
                const sampleA = [
                  'ACME Trading Sdn Bhd',
                  '012-3456789',
                  'Lot 12, Jalan Industri, KK',
                  '88000',
                  'Damien Chua',
                  '016-9876543',
                  'No.5, Jalan Utama, SDK',
                  '90000',
                  'Standard',
                  'Parcel',
                  '2.0',
                  '30',
                  '20',
                  '15',
                  '150.00',
                  'Electronic & Gadgets',
                  'PPD',
                  'C0001',
                  '',
                  '',
                ]
                // Same account + same receiver → multi-piece CN (piece 2)
                const sampleB = [
                  'ACME Trading Sdn Bhd',
                  '012-3456789',
                  'Lot 12, Jalan Industri, KK',
                  '88000',
                  'Damien Chua',
                  '016-9876543',
                  'No.5, Jalan Utama, SDK',
                  '90000',
                  'Standard',
                  'Parcel',
                  '1.5',
                  '25',
                  '18',
                  '12',
                  '150.00',
                  'Electronic & Gadgets',
                  'PPD',
                  'C0001',
                  '',
                  '',
                ]
                const blob = new Blob(
                  [[csvRow(header), csvRow(sampleA), csvRow(sampleB)].join('\n')],
                  { type: 'text/csv;charset=utf-8' },
                )
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'consignment_import_template.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Download import template
            </Button>
            <Button
              size="small"
              onClick={() => {
                setImportOpen(false)
                navigate('/ops/consignments/import-log')
              }}
            >
              Open import error log
            </Button>
          </Space>

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
            <p className="ant-upload-hint">Supports .xlsx and .csv files. First row must be column headers.</p>
          </Upload.Dragger>

          {importSummary && (
            <Card size="small" style={{ marginTop: 16, background: '#F8FAFC', borderRadius: 6 }}>
              <Text strong style={{ fontSize: 13, color: '#0F1B2D' }}>
                Batch Processing Summary:
              </Text>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
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
