import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
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
  Timeline,
  Typography,
  Upload,
  message,
} from 'antd'
import DataTable from '../../components/DataTable'
import {
  ClockCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import {
  apiError,
  cancelConsignment,
  downloadCsv,
  exportConsignments,
  getCnLookups,
  getTracking,
  importConsignments,
  listConsignments,
  listImportBatches,
  saveConsignment,
} from '../../api/client'
import ListPageLayout from '../../components/ListPageLayout'
import ShipmentStepper from '../../components/ShipmentStepper'
import StatusTag from '../../components/StatusTag'

const { Text, Title } = Typography

export default function ShipmentsPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') || 'all'
  const initialCn = params.get('cn') || ''
  const openNewAction = params.get('action') === 'new'

  // Tab state
  function handleTabChange(key) {
    setParams({ tab: key })
  }

  // ─────────────────────────────────────────────────────────────
  // Lookups & Reference Data
  // ─────────────────────────────────────────────────────────────
  const [lookups, setLookups] = useState({
    locations: [],
    zones: [],
    dropPoints: [],
    serviceTypes: [],
    statuses: [],
  })

  useEffect(() => {
    getCnLookups()
      .then((data) => setLookups(data || {}))
      .catch(() => {})
  }, [])

  // ─────────────────────────────────────────────────────────────
  // Tab 1: All Shipments List State
  // ─────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState(params.get('cn_no') || '')
  const [selectedStatus, setSelectedStatus] = useState(params.get('status') || '')
  const [selectedOrigin, setSelectedOrigin] = useState('')
  const [listData, setListData] = useState({ rows: [], totalPages: 1, page: 1, total: 0 })
  const [listLoading, setListLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  async function fetchShipments(page = 1) {
    setListLoading(true)
    try {
      const res = await listConsignments({
        cn_no: searchQuery || undefined,
        cn_status: selectedStatus || undefined,
        cn_origin: selectedOrigin || undefined,
        page,
      })
      setListData(res || { rows: [], totalPages: 1, page: 1 })
      setCurrentPage(page)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    fetchShipments(1)
  }, [searchQuery, selectedStatus, selectedOrigin])

  // ─────────────────────────────────────────────────────────────
  // Tab 2: Tracking State
  // ─────────────────────────────────────────────────────────────
  const [trackingCn, setTrackingCn] = useState(initialCn)
  const [trackingData, setTrackingData] = useState(null)
  const [trackingLoading, setTrackingLoading] = useState(false)

  async function doTrack(cnToTrack) {
    const cn = (cnToTrack || trackingCn).trim().toUpperCase()
    if (!cn) return
    setTrackingLoading(true)
    try {
      const res = await getTracking(cn)
      setTrackingData(res)
    } catch (err) {
      message.error(apiError(err))
      setTrackingData(null)
    } finally {
      setTrackingLoading(false)
    }
  }

  useEffect(() => {
    if (initialCn) {
      setTrackingCn(initialCn)
      doTrack(initialCn)
    }
  }, [initialCn])

  // ─────────────────────────────────────────────────────────────
  // Tab 3: Import Log State
  // ─────────────────────────────────────────────────────────────
  const [batches, setBatches] = useState([])
  const [batchLoading, setBatchLoading] = useState(false)

  async function fetchBatches() {
    setBatchLoading(true)
    try {
      const res = await listImportBatches()
      setBatches(res.batches || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setBatchLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'import') fetchBatches()
  }, [activeTab])

  // ─────────────────────────────────────────────────────────────
  // Create / Edit Shipment Drawer State
  // ─────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(openNewAction)
  const [drawerSaving, setDrawerSaving] = useState(false)
  const [form] = Form.useForm()

  function openCreateDrawer() {
    form.resetFields()
    form.setFieldsValue({
      cn_origin: 'BKI',
      srv_typ: 'STD',
      pkg_typ: 'P',
      cn_pcs: 1,
      pu_dt: new Date().toISOString().slice(0, 10),
    })
    setDrawerOpen(true)
  }

  useEffect(() => {
    if (params.get('action') === 'new') {
      openCreateDrawer()
    }
  }, [params])

  async function handleSaveShipment(values) {
    setDrawerSaving(true)
    try {
      const res = await saveConsignment(values)
      message.success(res.message || 'Consignment saved successfully')
      setDrawerOpen(false)
      form.resetFields()
      fetchShipments(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setDrawerSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Bulk CSV Upload Modal State
  // ─────────────────────────────────────────────────────────────
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  async function handleBulkImport() {
    if (!uploadFile) {
      message.warning('Please select a CSV file to upload')
      return
    }
    setUploading(true)
    try {
      const res = await importConsignments(uploadFile)
      message.success(`Import complete: ${res.imported_count || 0} shipments created`)
      setBulkModalOpen(false)
      setUploadFile(null)
      fetchShipments(1)
      if (activeTab === 'import') fetchBatches()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setUploading(false)
    }
  }

  // Export CSV
  async function handleExport() {
    try {
      const res = await exportConsignments({
        columns: ['cn_no', 'cust_name', 'cn_status', 'cn_origin', 'cn_dstn', 'tot_cn_amt', 'cn_dt_tm'],
        cn_status: selectedStatus || undefined,
        cn_origin: selectedOrigin || undefined,
      })
      if (res.rows) {
        downloadCsv(`consignments_${new Date().toISOString().slice(0, 10)}.csv`, res.rows)
        message.success('Export downloaded')
      }
    } catch (err) {
      message.error(apiError(err))
    }
  }

  // Table Columns for All Shipments
  const columns = [
    {
      title: 'CN Number',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (val) => (
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
            color: '#1B8A5A',
            cursor: 'pointer',
          }}
          onClick={() => {
            setTrackingCn(val)
            doTrack(val)
            setParams({ tab: 'tracking', cn: val })
          }}
        >
          {val}
        </span>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'cust_name',
      key: 'cust_name',
      render: (val, r) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1F2937' }}>{val || r.cust_ac_no || '—'}</div>
          {r.consignee && <div style={{ fontSize: 11, color: '#6B7280' }}>To: {r.consignee}</div>}
        </div>
      ),
    },
    {
      title: 'Origin → Dest',
      key: 'route',
      render: (_, r) => (
        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
          {r.cn_origin || '—'} → {r.cn_dstn || '—'}
        </span>
      ),
    },
    {
      title: 'Pieces / Wt',
      key: 'pcs_wt',
      render: (_, r) => (
        <span style={{ fontSize: 12 }}>
          {r.cn_pcs || 1} pcs · {r.cn_wt ? `${r.cn_wt} kg` : '—'}
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
      title: 'Amount',
      dataIndex: 'tot_cn_amt',
      key: 'tot_cn_amt',
      align: 'right',
      render: (val) =>
        val ? (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
            RM {Number(val).toFixed(2)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setTrackingCn(r.cn_no)
              doTrack(r.cn_no)
              setParams({ tab: 'tracking', cn: r.cn_no })
            }}
          />
          {r.cn_status !== 'CAN' && r.cn_status !== 'POD' && (
            <Popconfirm
              title={`Cancel consignment ${r.cn_no}?`}
              onConfirm={async () => {
                try {
                  await cancelConsignment(r.cn_no)
                  message.success(`Consignment ${r.cn_no} cancelled`)
                  fetchShipments(currentPage)
                } catch (e) {
                  message.error(apiError(e))
                }
              }}
            >
              <Button size="small" danger>
                Cancel
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Module Header */}
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
            Shipment Management
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Manage consignments, manifest dispatch routing, bulk imports, and real-time tracking.
          </Text>
        </div>

        <Space>
          <Button icon={<FileExcelOutlined />} onClick={() => setBulkModalOpen(true)}>
            Bulk CSV Import
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export CSV
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            onClick={openCreateDrawer}
          >
            + New Shipment
          </Button>
        </Space>
      </div>

      {/* Module Tabs: All Shipments · Issues & Import Log · Tracking */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'all',
            label: (
              <span>
                <InboxOutlined style={{ marginRight: 6 }} />
                All Shipments
              </span>
            ),
            children: (
              <ListPageLayout
                title=""
                searchPlaceholder="Search CN #, customer, phone…"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                filters={[
                  {
                    key: 'status',
                    placeholder: 'All Statuses',
                    value: selectedStatus,
                    onChange: setSelectedStatus,
                    options: (lookups.statuses || []).map((s) =>
                      typeof s === 'string'
                        ? { label: s, value: s }
                        : { label: `${s.status_code || s.code} - ${s.status_name || s.name}`, value: s.status_code || s.code },
                    ),
                    width: 170,
                  },
                  {
                    key: 'origin',
                    placeholder: 'Origin Branch',
                    value: selectedOrigin,
                    onChange: setSelectedOrigin,
                    options: (lookups.locations || []).map((l) => ({
                      label: `${l.loc_id || l.loc_code} (${l.loc_name || ''})`,
                      value: l.loc_id || l.loc_code,
                    })),
                    width: 150,
                  },
                ]}
                columns={columns}
                dataSource={listData.rows || []}
                loading={listLoading}
                rowKey="cn_no"
                pagination={{
                  current: currentPage,
                  pageSize: 20,
                  total: (listData.totalPages || 1) * 20,
                  onChange: (page) => fetchShipments(page),
                }}
                onNewClick={openCreateDrawer}
                newButtonText="+ New Shipment"
              />
            ),
          },
          {
            key: 'tracking',
            label: (
              <span>
                <SearchOutlined style={{ marginRight: 6 }} />
                Tracking Timeline
              </span>
            ),
            children: (
              <Card size="small" style={{ borderRadius: 6, borderColor: '#E5E7EB' }}>
                <div style={{ maxWidth: 900, margin: '0 auto', padding: '12px 0' }}>
                  {/* Search bar */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <Input
                      placeholder="Enter Consignment Number (e.g. BKI10001)…"
                      value={trackingCn}
                      onChange={(e) => setTrackingCn(e.target.value)}
                      onPressEnter={() => doTrack()}
                      prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
                      style={{ fontSize: 14 }}
                    />
                    <Button
                      type="primary"
                      onClick={() => doTrack()}
                      loading={trackingLoading}
                      style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
                    >
                      Track Shipment
                    </Button>
                  </div>

                  {/* Stepper & Details */}
                  {trackingData?.cn ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <ShipmentStepper currentStatus={trackingData.cn.cn_status} />

                      <Descriptions
                        title="Consignment Particulars"
                        bordered
                        size="small"
                        column={{ xs: 1, sm: 2, md: 3 }}
                      >
                        <Descriptions.Item label="Consignment #">
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                            {trackingData.cn.cn_no}
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Status">
                          <StatusTag status={trackingData.cn.cn_status} />
                        </Descriptions.Item>
                        <Descriptions.Item label="Service Type">
                          {trackingData.cn.srv_typ || 'Standard'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Origin Branch">
                          {trackingData.cn.cn_origin || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Destination Branch">
                          {trackingData.cn.cn_dstn || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Weight / Pcs">
                          {trackingData.cn.cn_wt} kg · {trackingData.cn.cn_pcs || 1} pcs
                        </Descriptions.Item>
                        <Descriptions.Item label="Consigner">
                          {trackingData.cn.consigner || trackingData.cn.cust_name || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Consignee">
                          {trackingData.cn.consignee || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Pickup Date">
                          {trackingData.cn.pu_dt ? trackingData.cn.pu_dt.slice(0, 10) : '—'}
                        </Descriptions.Item>
                      </Descriptions>

                      {/* Event checkpoints timeline */}
                      <Card
                        title="Scan Checkpoints & Event History"
                        size="small"
                        style={{ borderRadius: 6 }}
                      >
                        {trackingData.events && trackingData.events.length > 0 ? (
                          <Timeline
                            style={{ marginTop: 12 }}
                            items={trackingData.events.map((ev) => ({
                              color: ev.status === 'POD' ? '#1B8A5A' : '#1668DC',
                              children: (
                                <div>
                                  <div style={{ fontWeight: 600, color: '#1F2937' }}>
                                    {ev.description || ev.status} ·{' '}
                                    <span style={{ fontWeight: 400, color: '#6B7280' }}>
                                      {ev.location || ev.hub || 'Station'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                                    {ev.timestamp || ev.date_time || '—'}
                                  </div>
                                </div>
                              ),
                            }))}
                          />
                        ) : (
                          <div style={{ color: '#6B7280', padding: '12px 0' }}>
                            Order registered in system. Awaiting first scan event.
                          </div>
                        )}
                      </Card>
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="Enter a CN number above to inspect full lifecycle tracking history"
                    />
                  )}
                </div>
              </Card>
            ),
          },
          {
            key: 'import',
            label: (
              <span>
                <HistoryOutlined style={{ marginRight: 6 }} />
                Import Log & Errors
              </span>
            ),
            children: (
              <DataTable
                size="small"
                columns={[
                  { title: 'Batch ID', dataIndex: 'id', key: 'id', width: 90 },
                  { title: 'File Name', dataIndex: 'filename', key: 'filename' },
                  {
                    title: 'Rows Imported',
                    dataIndex: 'imported_count',
                    key: 'imported_count',
                    render: (v) => <span style={{ fontWeight: 600, color: '#1B8A5A' }}>{v}</span>,
                  },
                  {
                    title: 'Errors',
                    dataIndex: 'error_count',
                    key: 'error_count',
                    render: (v) =>
                      v > 0 ? (
                        <span style={{ fontWeight: 600, color: '#D4380D' }}>{v} failed</span>
                      ) : (
                        <span style={{ color: '#9CA3AF' }}>0</span>
                      ),
                  },
                  { title: 'Uploaded At', dataIndex: 'created_at', key: 'created_at' },
                ]}
                dataSource={batches}
                rowKey="id"
                loading={batchLoading}
                pagination={{ pageSize: 15 }}
              />
            ),
          },
        ]}
      />

      {/* ─────────────────────────────────────────────────────────────
          Create / Edit Shipment Drawer Form (High Density)
         ───────────────────────────────────────────────────────────── */}
      <Drawer
        title="Create New Consignment"
        placement="right"
        width={540}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
              onClick={() => form.submit()}
              loading={drawerSaving}
            >
              Save Shipment
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSaveShipment}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="cn_no"
                label="Consignment # (Leave blank to auto-generate)"
              >
                <Input placeholder="e.g. BKI10023" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cust_ac_no" label="Customer Account / Code">
                <Input placeholder="e.g. CUST001" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 16px' }} />

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="cn_origin"
                label="Origin Branch"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select
                  placeholder="Select Origin"
                  options={(lookups.locations || []).map((l) => ({
                    label: `${l.loc_id || l.loc_code} (${l.loc_name || ''})`,
                    value: l.loc_id || l.loc_code,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cn_dstn"
                label="Destination Branch"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select
                  placeholder="Select Destination"
                  options={(lookups.locations || []).map((l) => ({
                    label: `${l.loc_id || l.loc_code} (${l.loc_name || ''})`,
                    value: l.loc_id || l.loc_code,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="srv_typ" label="Service Type">
                <Select
                  options={[
                    { label: 'Standard Delivery (STD)', value: 'STD' },
                    { label: 'Express Next-Day (EXP)', value: 'EXP' },
                    { label: 'Linehaul Freight (FRT)', value: 'FRT' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pkg_typ" label="Package Type">
                <Select
                  options={[
                    { label: 'Parcel / Box (P)', value: 'P' },
                    { label: 'Document / Envelope (D)', value: 'D' },
                    { label: 'Heavy / Pallet (H)', value: 'H' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="cn_pcs" label="Pieces">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cn_wt" label="Weight (kg)">
                <InputNumber min={0.1} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tot_cn_amt" label="Amount (RM)">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 16px' }} />

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="consigner" label="Sender / Consigner Name">
                <Input placeholder="Sender full name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="consignee" label="Recipient / Consignee Name">
                <Input placeholder="Recipient full name" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="recp_name" label="Delivery Address / Landmark">
            <Input.TextArea rows={2} placeholder="Address details for delivery courier" />
          </Form.Item>

          <Form.Item name="remarks" label="Special Instructions / Remarks">
            <Input placeholder="e.g. Fragile, call before delivery" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ─────────────────────────────────────────────────────────────
          Bulk CSV Import Modal
         ───────────────────────────────────────────────────────────── */}
      <Modal
        title="Bulk Consignment CSV Import"
        open={bulkModalOpen}
        onCancel={() => setBulkModalOpen(false)}
        onOk={handleBulkImport}
        confirmLoading={uploading}
        okText="Upload & Process"
        okButtonProps={{ style: { background: '#1B8A5A', borderColor: '#1B8A5A' } }}
      >
        <div style={{ padding: '10px 0' }}>
          <p style={{ fontSize: 13, color: '#4B5563' }}>
            Upload a CSV file containing consignment records. The columns should include:{' '}
            <code>cn_no</code>, <code>cust_ac_no</code>, <code>cn_origin</code>,{' '}
            <code>cn_dstn</code>, <code>consignee</code>, <code>cn_wt</code>, <code>cn_pcs</code>.
          </p>

          <Upload.Dragger
            name="file"
            multiple={false}
            beforeUpload={(file) => {
              setUploadFile(file)
              return false
            }}
            onRemove={() => setUploadFile(null)}
            fileList={uploadFile ? [uploadFile] : []}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ color: '#1B8A5A', fontSize: 32 }} />
            </p>
            <p className="ant-upload-text">Click or drag CSV file to this area to upload</p>
          </Upload.Dragger>
        </div>
      </Modal>
    </div>
  )
}
