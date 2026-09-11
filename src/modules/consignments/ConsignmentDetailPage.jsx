import React, { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  BarcodeOutlined,
  BranchesOutlined,
  CalendarOutlined,
  CarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  CompassOutlined,
  CreditCardOutlined,
  DollarCircleOutlined,
  DownOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  MoreOutlined,
  PhoneOutlined,
  PrinterOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SyncOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  apiError,
  cancelConsignment,
  getConsignment,
  getOpsConsignmentTracking,
  getPickup,
  getTracking,
  listBilling,
  listCsTickets,
  saveConsignment,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import ShipmentStepper from '../../components/ShipmentStepper'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

export default function ConsignmentDetailPage() {
  const { cn } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { can, isAdmin, user } = useAuth()
  const canOperate = isAdmin || ['Operation', 'Super Admin', 'Admin'].includes(user?.role)

  // Determine active tab based on route or query param (?tab=tracking vs ?tab=info)
  const isTrackingRoute = location.pathname.endsWith('/tracking') || searchParams.get('tab') === 'tracking'
  const activeTab = isTrackingRoute ? 'tracking' : 'info'

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [tracking, setTracking] = useState(null)
  const [opsTracking, setOpsTracking] = useState(null)
  const [pickup, setPickup] = useState(null)
  const [linkedTickets, setLinkedTickets] = useState([])
  const [linkedBilling, setLinkedBilling] = useState([])

  // Cancel Preview Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelConfirmed, setCancelConfirmed] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Edit Drawer State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [form] = Form.useForm()

  async function loadDetails() {
    setLoading(true)
    try {
      const [cnRes, trackRes, opsTrackRes, pickupRes, csRes, billingRes] = await Promise.all([
        getConsignment(cn).catch(() => null),
        getTracking(cn).catch(() => null),
        getOpsConsignmentTracking(cn).catch(() => null),
        getPickup(cn).catch(() => null),
        listCsTickets({ cn }).catch(() => ({ tickets: [] })),
        listBilling('invoices', { search: cn }).catch(() => ({ data: [] })),
      ])

      // Resilient unwrap of consignment record (handles cnRes.cn, cnRes.data, opsTrackRes.cn, trackRes)
      let consignment =
        cnRes?.cn ||
        opsTrackRes?.cn ||
        cnRes?.data ||
        cnRes?.consignment ||
        (cnRes?.ok && cnRes?.found ? cnRes.cn : null) ||
        cnRes ||
        {}

      // Fallback merge from public tracking if ops fields are missing
      if ((!consignment.cn_no && !consignment.consignment_no) && trackRes) {
        consignment = {
          ...consignment,
          cn_no: trackRes.cnNo || cn,
          consignment_no: trackRes.cnNo || cn,
          cn_status: trackRes.statusCode || 'BDE',
          status: trackRes.statusCode || 'BDE',
          recipientName: trackRes.recipientName,
          recp_name: trackRes.recipientName,
          consignee: trackRes.recipientName,
          cn_origin: trackRes.origin,
          cn_dstn: trackRes.destination,
          origin_branch: trackRes.origin,
          destination_branch: trackRes.destination,
          location: trackRes.location,
          ppd_cct: trackRes.payMode || 'PPD',
          pay_typ: trackRes.payMode || 'PPD',
          cod_amt: trackRes.isCod ? trackRes.expectedAmt || 0 : 0,
          customerLabel: trackRes.customerLabel,
          shortLabel: trackRes.shortLabel,
          scanningType: trackRes.scanningType,
        }
      }

      setData(consignment)
      setTracking(trackRes?.data || trackRes || null)
      setOpsTracking(opsTrackRes || null)
      setPickup(pickupRes?.data || pickupRes || null)
      setLinkedTickets(csRes?.tickets || csRes?.data || [])
      setLinkedBilling(billingRes?.data || billingRes?.rows || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (cn) loadDetails()
  }, [cn])

  function handleTabChange(tabKey) {
    if (tabKey === 'tracking') {
      navigate(`/ops/consignments/${encodeURIComponent(cn)}/tracking`, { replace: true })
    } else {
      navigate(`/ops/consignments/${encodeURIComponent(cn)}`, { replace: true })
    }
  }

  // Handle Cancel with confirmation
  async function confirmCancel() {
    if (!cancelConfirmed) {
      message.warning('Please confirm this is a cancellation request, not an address change.')
      return
    }
    setCancelling(true)
    try {
      await cancelConsignment(cn, { reason: cancelReason, confirmNotAddressChange: true })
      message.success(`Consignment ${cn} successfully cancelled`)
      setCancelModalOpen(false)
      setCancelConfirmed(false)
      setCancelReason('')
      loadDetails()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setCancelling(false)
    }
  }

  // Handle Edit Submit
  async function handleEditSubmit(values) {
    setSavingEdit(true)
    try {
      await saveConsignment({ ...values, cn_no: cn, consignment_no: cn })
      message.success('Consignment details updated successfully')
      setEditDrawerOpen(false)
      loadDetails()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSavingEdit(false)
    }
  }

  function openEditDrawer() {
    form.setFieldsValue({
      senderName: data?.senderName || data?.consigner || data?.cust_name || '',
      senderAddress: data?.senderAddress || data?.sender_address || data?.origin_addr || '',
      senderPhone: data?.senderPhone || data?.sender_phone || data?.phone || '',
      recipientName: data?.recipientName || data?.consignee || data?.recp_name || '',
      address: data?.address || data?.recp_name || '',
      phone: data?.phone || data?.recp_phone || '',
      weight: data?.weight || data?.cn_wt || 1,
      pieces: data?.pieces || data?.cn_pcs || 1,
      batch_no: data?.batch_no || data?.pod_batch || '',
      mfg_no: data?.mfg_no || '',
      remarks: data?.remarks || '',
    })
    setEditDrawerOpen(true)
  }

  if (loading) {
    return (
      <div style={{ padding: 24, background: '#FFFFFF', borderRadius: 8 }}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    )
  }

  if (!data || (!data.cn_no && !data.id && !data.consignment_no && !tracking?.cnNo)) {
    return (
      <Card style={{ borderRadius: 8 }}>
        <Empty
          description={`Consignment ${cn} was not found on this system.`}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Space>
            <Button type="primary" onClick={() => navigate('/ops/consignments')}>
              Return to Consignments List
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadDetails}>
              Retry Check
            </Button>
          </Space>
        </Empty>
      </Card>
    )
  }

  const activeCn = data.cn_no || data.consignment_no || tracking?.cnNo || cn

  async function copyText(value, label) {
    try {
      await navigator.clipboard.writeText(String(value))
      message.success(`${label} copied`)
    } catch {
      message.error(`Unable to copy ${label.toLowerCase()}`)
    }
  }
  const status = data.cn_status || data.status || tracking?.statusCode || 'BDE'
  const isCancelled = status === 'CAN'

  // Bag & Manifest identification
  const bagNo = data.batch_no || data.pod_batch || data.bag_no || null
  const manifestNo = data.mfg_no || null

  // Determine Agent in Charge (courier / driver / drop point)
  const agentName =
    pickup?.driver_name ||
    pickup?.courier_name ||
    data.assigned_driver ||
    data.assigned_courier ||
    pickup?.drop_point_name ||
    data.drop_point_name ||
    null

  const agentRole =
    pickup?.driver_name || data.assigned_driver
      ? 'Courier Driver'
      : pickup?.drop_point_name || data.drop_point_name
      ? 'Drop Point Operator'
      : 'Unassigned'

  // Multimodal / Sea metadata if applicable
  const isMultimodalOrSea =
    ['sea', 'multimodal', 'ocean'].includes(String(data.transport_mode || data.transportMode || data.srv_typ || '').toLowerCase()) ||
    Boolean(data.vessel_name || data.voyage_ref)

  // Tracking timeline events from ops tracking or public tracking
  const rawTimelineEvents =
    opsTracking?.timeline && opsTracking.timeline.length > 0
      ? opsTracking.timeline
      : tracking?.timeline && tracking.timeline.length > 0
      ? tracking.timeline
      : opsTracking?.trackHistory && opsTracking.trackHistory.length > 0
      ? opsTracking.trackHistory.map((h) => ({
          statusCode: h.cn_status,
          statusDesc: h.status_desc || h.remarks || h.cn_status,
          customerLabel: h.status_desc || h.remarks,
          at: h.upd_dt_tm,
          location: h.loc_id,
          note: h.remarks,
          by: h.upd_id,
        }))
      : [
          {
            statusCode: status,
            statusDesc: tracking?.shortLabel || 'Booking Registered',
            customerLabel: tracking?.customerLabel || 'Consignment Registered in System',
            at: data.cn_dt_tm || data.created_at || '—',
            location: data.cn_origin || data.origin_branch || 'Origin',
            note: data.remarks || '',
            by: data.upd_id || 'System',
          },
        ]

  // Clean and de-duplicate timeline entries to avoid repetitive info
  const timelineEvents = rawTimelineEvents.map((evt) => {
    const mainTitle = evt.statusDesc || evt.customerLabel || evt.title || evt.description || ''
    // Check if note is identical or repetitive to title
    const noteClean = evt.note && evt.note.trim().toLowerCase() !== mainTitle.trim().toLowerCase() ? evt.note : null
    return {
      ...evt,
      cleanTitle: mainTitle,
      cleanNote: noteClean,
    }
  })

  // Action Menu Items for the top right Menu Dropdown
  const actionMenuItems = {
    items: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Edit Parcel Details',
        disabled: !canOperate || isCancelled,
        onClick: openEditDrawer,
      },
      manifestNo
        ? {
            key: 'manifest',
            icon: <FileTextOutlined />,
            label: `View Manifest (${manifestNo})`,
            onClick: () => navigate(`/ops/manifests/${encodeURIComponent(manifestNo)}`),
          }
        : null,
      {
        key: 'pickups',
        icon: <CarOutlined />,
        label: 'Assign Pickup / Courier',
        onClick: () => navigate('/ops/pickups'),
      },
      {
        key: 'label',
        icon: <PrinterOutlined />,
        label: 'Print Waybill Label',
        onClick: () => window.open(`/api/labels/${encodeURIComponent(activeCn)}`, '_blank'),
      },
      {
        key: 'ticket',
        icon: <QuestionCircleOutlined />,
        label: 'Open CS Ticket for this CN',
        onClick: () => navigate(`/ops/cs/tickets?cn=${encodeURIComponent(activeCn)}`),
      },
      { type: 'divider' },
      {
        key: 'cancel',
        icon: <CloseCircleOutlined />,
        label: 'Cancel Consignment',
        danger: true,
        disabled: !canOperate || isCancelled,
        onClick: () => setCancelModalOpen(true),
      },
    ].filter(Boolean),
  }

  const tabItems = [
    {
      key: 'info',
      label: (
        <Space size={6}>
          <FileTextOutlined />
          <span style={{ fontWeight: 600 }}>Consignment Information</span>
        </Space>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top Key Metrics Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '12px 18px',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Freight Total</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1B8A5A' }}>
                RM {data.tot_cn_amt || data.con_ramt || '0.00'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Pay Mode</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0F1B2D' }}>
                <Tag color={data.ppd_cct === 'COD' || Number(data.cod_amt) > 0 ? 'orange' : 'blue'} style={{ margin: 0 }}>
                  {data.ppd_cct || (Number(data.cod_amt) > 0 ? 'COD' : 'PPD')}
                </Tag>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Weight / Pieces</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0F1B2D' }}>
                {data.weight || data.cn_wt || '0.00'} kg · {data.pieces || data.cn_pcs || 1} pcs
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Bag Assignment</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0F1B2D' }}>
                {bagNo ? <Tag color="purple" style={{ margin: 0 }}>Bag: {bagNo}</Tag> : <span style={{ color: '#9CA3AF' }}>Loose</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Manifest (MFG)</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {manifestNo ? (
                  <Tag
                    color="cyan"
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={() => navigate(`/ops/manifests/${encodeURIComponent(manifestNo)}`)}
                  >
                    {manifestNo}
                  </Tag>
                ) : (
                  <span style={{ color: '#9CA3AF' }}>Unmanifested</span>
                )}
              </div>
            </div>

            <Button
              type="primary"
              size="small"
              icon={<CompassOutlined />}
              onClick={() => handleTabChange('tracking')}
              style={{ background: '#1668DC', borderColor: '#1668DC' }}
            >
              View Tracking History →
            </Button>
          </div>

          {/* 3-COLUMN CORE DOSSIER: SENDER | SHIPPING & BAGS | RECIPIENT */}
          <Row gutter={[16, 16]}>
            {/* COLUMN 1: SENDER */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <Space>
                    <UserOutlined style={{ color: '#1B8A5A' }} />
                    <span>Sender Details</span>
                  </Space>
                }
                size="small"
                style={{ height: '100%', borderRadius: 8 }}
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="Sender Name">
                    <strong>{data.senderName || data.consigner || data.cust_name || '—'}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Contact Phone">
                    {data.senderPhone || data.sender_phone || data.phone || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Sender Address">
                    {data.senderAddress || data.sender_address || data.origin_addr || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Customer Account">
                    <Tag color="geekblue">{data.cust_ac_no || 'WALK-IN'}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* COLUMN 2: SHIPPING, BAGS & CARGO */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <Space>
                    <CarOutlined style={{ color: '#1B8A5A' }} />
                    <span>Shipping & Cargo</span>
                  </Space>
                }
                size="small"
                style={{ height: '100%', borderRadius: 8 }}
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="Route">
                    <strong>{data.cn_origin || data.origin_branch || '—'}</strong> →{' '}
                    <strong>{data.cn_dstn || data.destination_branch || '—'}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Zones">
                    {data.origin_zone || data.originZone || '—'} → {data.destination_zone || data.destZone || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Cargo Specs">
                    {data.weight || data.cn_wt || '0.00'} kg · {data.pieces || data.cn_pcs || 1} pcs
                  </Descriptions.Item>
                  <Descriptions.Item label="Transport Mode">
                    <Tag color="cyan" style={{ textTransform: 'uppercase' }}>
                      {data.transport_mode || data.transportMode || data.srv_typ || 'ROAD'}
                    </Tag>{' '}
                    ({data.srv_typ || 'STD'})
                  </Descriptions.Item>
                  <Descriptions.Item label="Bag / Batch">
                    {bagNo ? (
                      <Tag color="purple">Bag: {bagNo}</Tag>
                    ) : (
                      <span style={{ color: '#9CA3AF' }}>Loose Parcel</span>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Manifest (MFG)">
                    {manifestNo ? (
                      <a
                        style={{ color: '#1B8A5A', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => navigate(`/ops/manifests/${encodeURIComponent(manifestNo)}`)}
                      >
                        {manifestNo} <LinkOutlined />
                      </a>
                    ) : (
                      <span style={{ color: '#9CA3AF' }}>Unmanifested</span>
                    )}
                  </Descriptions.Item>
                </Descriptions>

                {/* Maritime attributes if sea/multimodal */}
                {isMultimodalOrSea && (
                  <div style={{ marginTop: 10, padding: 8, background: '#F0F9FF', borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 600, color: '#0369A1' }}>Maritime Sea Cargo:</div>
                    <div>Vessel: {data.vessel_name || data.vesselName || 'MV IPOSB TRADER'}</div>
                    <div>Voyage: {data.voyage_ref || data.voyageRef || 'VY-2026-09A'}</div>
                  </div>
                )}
              </Card>
            </Col>

            {/* COLUMN 3: RECIPIENT */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <Space>
                    <EnvironmentOutlined style={{ color: '#1668DC' }} />
                    <span>Recipient Details</span>
                  </Space>
                }
                size="small"
                style={{ height: '100%', borderRadius: 8 }}
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="Recipient Name">
                    <strong>{data.recipientName || data.consignee || data.recp_name || '—'}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Contact Phone">
                    {data.phone || data.recp_phone || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Delivery Address">
                    {data.address || data.recp_name || data.destination_addr || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Destination Hub">
                    <Tag color="blue">{data.cn_dstn || data.destination_branch || '—'}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

          {/* SECONDARY ROW: FINANCIAL CHARGES & OPERATIONAL CUSTODY */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <DollarCircleOutlined style={{ color: '#1B8A5A' }} />
                    <span>Financial Charges & Payment</span>
                  </Space>
                }
                size="small"
                style={{ height: '100%', borderRadius: 8 }}
              >
                <Row gutter={[16, 12]}>
                  <Col span={12}>
                    <Statistic
                      title="Freight Total"
                      value={data.tot_cn_amt || data.con_ramt || 0}
                      precision={2}
                      prefix="RM"
                      valueStyle={{ color: '#1B8A5A', fontSize: 18 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Payment Mode"
                      value={data.ppd_cct || data.pay_typ || (Number(data.cod_amt) > 0 ? 'COD' : 'PPD')}
                      valueStyle={{ fontSize: 18, fontWeight: 700 }}
                    />
                  </Col>
                </Row>

                {Number(data.cod_amt || 0) > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '8px 12px',
                      background: '#FFFBEB',
                      borderRadius: 6,
                      border: '1px solid #FDE68A',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>COD Amount:</span>
                      <span style={{ marginLeft: 6, fontWeight: 700, color: '#92400E' }}>RM {data.cod_amt}</span>
                    </div>
                    <Button
                      size="small"
                      type="link"
                      onClick={() => navigate('/ops/cod')}
                      style={{ padding: 0, height: 'auto', fontSize: 11 }}
                    >
                      COD Control →
                    </Button>
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <TeamOutlined style={{ color: '#1668DC' }} />
                    <span>Operational Custody & Queue</span>
                  </Space>
                }
                size="small"
                style={{ height: '100%', borderRadius: 8 }}
                extra={
                  <Button size="small" type="link" onClick={() => navigate('/ops/pickups')}>
                    Manage Pickups →
                  </Button>
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: agentName ? '#EBF5FF' : '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: agentName ? '#1668DC' : '#9CA3AF',
                      fontSize: 18,
                    }}
                  >
                    <CarOutlined />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0F1B2D' }}>
                      {agentName || 'Pending Courier / Driver Assignment'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{agentRole}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  <Button size="small" onClick={() => navigate('/ops/pickups')}>
                    Assign Courier
                  </Button>
                  <Button size="small" onClick={() => navigate(`/ops/cs/tickets?cn=${encodeURIComponent(activeCn)}`)}>
                    Open CS Ticket
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'tracking',
      label: (
        <Space size={6}>
          <HistoryOutlined />
          <span style={{ fontWeight: 600 }}>Tracking History</span>
        </Space>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* High-Level SOP Stepper (Full Width at Top) */}
          <ShipmentStepper currentStatus={status} />

          {/* 2-COLUMN TRACKING: LEFT = STATUS & CUSTODY | RIGHT = CHRONOLOGICAL TIMELINE */}
          <Row gutter={[16, 16]}>
            {/* COLUMN 1: TRACKING DETAILS & OPERATIONAL CUSTODY */}
            <Col xs={24} lg={10}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Milestone Details Card */}
                <Card
                  title={
                    <Space>
                      <CompassOutlined style={{ color: '#1668DC' }} />
                      <span>Tracking Status Details</span>
                    </Space>
                  }
                  size="small"
                  style={{ borderRadius: 8 }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <StatusTag status={status} />
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#0F1B2D' }}>
                        {tracking?.shortLabel || opsTracking?.statusDesc || status}
                      </span>
                    </div>

                    {(tracking?.customerLabel || opsTracking?.statusDesc) && (
                      <div
                        style={{
                          padding: '10px 12px',
                          background: '#F8FAFC',
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#334155',
                          borderLeft: '4px solid #1B8A5A',
                        }}
                      >
                        {tracking?.customerLabel || opsTracking?.statusDesc}
                      </div>
                    )}
                  </div>

                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Current Location">
                      <strong>{data.location || tracking?.location || data.cn_dstn || '—'}</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Scan Timestamp">
                      {data.cn_dt_tm || data.upd_dt_tm || data.updated_at || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Scan Operator">
                      <Tag color="geekblue">{data.upd_id || 'admin'}</Tag>
                    </Descriptions.Item>
                    {(tracking?.estimatedDeliveryAt || opsTracking?.slaDeadlineAt) && (
                      <Descriptions.Item label="Estimated Delivery">
                        {String(tracking?.estimatedDeliveryAt || opsTracking?.slaDeadlineAt).slice(0, 16)}
                      </Descriptions.Item>
                    )}
                  </Descriptions>

                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Button
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => window.open(`/api/tracking/${encodeURIComponent(activeCn)}`, '_blank')}
                    >
                      Public Tracking
                    </Button>
                    <Button
                      size="small"
                      icon={<PrinterOutlined />}
                      onClick={() => window.open(`/api/labels/${encodeURIComponent(activeCn)}`, '_blank')}
                    >
                      Waybill Label
                    </Button>
                  </div>
                </Card>

                {/* Custody in Tracking Context */}
                <Card
                  title={
                    <Space>
                      <TeamOutlined style={{ color: '#1668DC' }} />
                      <span>Current Custody</span>
                    </Space>
                  }
                  size="small"
                  style={{ borderRadius: 8 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: agentName ? '#EBF5FF' : '#F3F4F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: agentName ? '#1668DC' : '#9CA3AF',
                        fontSize: 18,
                      }}
                    >
                      <CarOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0F1B2D' }}>
                        {agentName || 'Unassigned Courier'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{agentRole}</div>
                    </div>
                  </div>
                </Card>
              </div>
            </Col>

            {/* COLUMN 2: CHRONOLOGICAL TIMELINE (CLEAN & NON-REPETITIVE) */}
            <Col xs={24} lg={14}>
              <Card
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#1668DC' }} />
                    <span>Chronological Scan History</span>
                  </Space>
                }
                size="small"
                style={{ borderRadius: 8 }}
              >
                <Timeline
                  mode="left"
                  style={{ marginTop: 8, padding: '0 8px' }}
                  items={timelineEvents.map((evt, idx) => ({
                    color: evt.statusCode === 'POD' ? '#1B8A5A' : evt.statusCode === 'RTS' ? '#D97706' : '#1668DC',
                    children: (
                      <div style={{ paddingBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StatusTag status={evt.statusCode || evt.status} />
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#1F2937' }}>
                            {evt.cleanTitle}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                          Location: <strong>{evt.location || evt.hub || 'In Transit'}</strong>
                          {evt.at || evt.time ? ` · ${evt.at || evt.time}` : ''}
                          {evt.by ? ` · Operator: ${evt.by}` : ''}
                        </div>
                        {evt.cleanNote && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#475569',
                              background: '#F9FAFB',
                              padding: '4px 8px',
                              borderRadius: 4,
                              marginTop: 4,
                              display: 'inline-block',
                            }}
                          >
                            {evt.cleanNote}
                          </div>
                        )}
                      </div>
                    ),
                  }))}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header & Breadcrumbs with Direct Redirect Links */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          background: '#FFFFFF',
          borderRadius: 8,
          border: '1px solid #E5E8EB',
        }}
      >
        <Space size="middle">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ops/consignments')}>
            Back to List
          </Button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#0F1B2D',
                }}
              >
                {activeCn}
              </span>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                aria-label="Copy consignment number"
                title="Copy consignment number"
                onClick={() => copyText(activeCn, 'Consignment number')}
              />
              <StatusTag status={status} />
              {isCancelled && <Tag color="red">CANCELLED</Tag>}
              {data.ppd_cct && <Tag color="blue">{data.ppd_cct}</Tag>}
              {bagNo && (
                <Tag color="purple" icon={<BarcodeOutlined />}>
                  Bag: {bagNo}
                </Tag>
              )}
              {manifestNo && (
                <Tag
                  color="cyan"
                  icon={<LinkOutlined />}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/ops/manifests/${encodeURIComponent(manifestNo)}`)}
                >
                  MFG: {manifestNo}
                </Tag>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
              Route: <strong>{data.cn_origin || data.origin_branch || '—'}</strong> →{' '}
              <strong>{data.cn_dstn || data.destination_branch || '—'}</strong> · Created:{' '}
              {data.cn_dt_tm || data.created_at || '—'}
            </div>
          </div>
        </Space>

        {/* Top Action Controls Menu */}
        <Space wrap>
          {canOperate && !isCancelled && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={openEditDrawer}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              Edit Details
            </Button>
          )}

          <Button
            icon={<PrinterOutlined />}
            onClick={() => window.open(`/api/labels/${encodeURIComponent(activeCn)}`, '_blank')}
          >
            Waybill
          </Button>

          <Dropdown menu={actionMenuItems} placement="bottomRight">
            <Button>
              Actions <DownOutlined />
            </Button>
          </Dropdown>

          <Tooltip title="Refresh Latest Status">
            <Button icon={<SyncOutlined />} onClick={loadDetails} />
          </Tooltip>
        </Space>
      </div>

      {/* Main Clean Tab Navigation */}
      <Card
        style={{ borderRadius: 8, padding: 0 }}
        bodyStyle={{ padding: '0 16px 16px' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          size="large"
          tabBarStyle={{ marginBottom: 20 }}
        />
      </Card>

      {/* Cancel Preview Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#D4380D' }} />
            <span>Confirm Consignment Cancellation</span>
          </Space>
        }
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        footer={[
          <Button key="back" onClick={() => setCancelModalOpen(false)}>
            Dismiss
          </Button>,
          <Button key="submit" type="primary" danger loading={cancelling} onClick={confirmCancel}>
            Confirm Cancel
          </Button>,
        ]}
      >
        <Alert
          type="warning"
          showIcon
          message="Cancellation Preview"
          description={`Consignment ${activeCn} will be permanently set to CAN status. Any active courier pickup jobs and sorting manifests referencing this parcel will be unlinked immediately.`}
          style={{ marginBottom: 16 }}
        />
        <Alert
          type="info"
          showIcon
          message="Cancellation only"
          description="This request cancels the consignment. It does not change the delivery address. To change the delivery address, create a new order/CN."
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          rows={2}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Cancellation reason (optional)"
          style={{ marginBottom: 12 }}
        />
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={cancelConfirmed}
            onChange={(e) => setCancelConfirmed(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>I confirm this is a cancellation request, not an address change.</span>
        </label>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Consignment Number">{activeCn}</Descriptions.Item>
          <Descriptions.Item label="Customer">{data.cust_name || data.senderName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Current Status">{status}</Descriptions.Item>
          <Descriptions.Item label="Freight Value">RM {data.tot_cn_amt || data.con_ramt || '0.00'}</Descriptions.Item>
        </Descriptions>
      </Modal>

      {/* Edit Drawer (Allows user to fix parcel, sender, receiver, and bag details) */}
      <Drawer
        title={`Edit / Fix Consignment ${activeCn}`}
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setEditDrawerOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              loading={savingEdit}
              onClick={() => form.submit()}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
          <Divider orientation="left" style={{ margin: '8px 0 16px', fontSize: 13 }}>
            Sender Details
          </Divider>
          <Form.Item label="Sender / Company Name" name="senderName" rules={[{ required: true }]}>
            <Input placeholder="Sender Name" />
          </Form.Item>
          <Form.Item label="Sender Phone" name="senderPhone">
            <Input placeholder="Sender Phone" />
          </Form.Item>
          <Form.Item label="Sender Origin Address" name="senderAddress">
            <Input.TextArea rows={2} placeholder="Sender Address" />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '16px 0', fontSize: 13 }}>
            Recipient Details
          </Divider>
          <Form.Item label="Recipient Name" name="recipientName" rules={[{ required: true }]}>
            <Input placeholder="Recipient Name" />
          </Form.Item>
          <Form.Item label="Recipient Phone" name="phone">
            <Input placeholder="Recipient Phone" />
          </Form.Item>
          <Form.Item label="Delivery Address" name="address">
            <Input.TextArea rows={2} placeholder="Delivery Address" />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '16px 0', fontSize: 13 }}>
            Bags, Manifest & Cargo Specifications
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Bag / Batch Number" name="batch_no">
                <Input placeholder="e.g. BATCH003" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Manifest No (MFG)" name="mfg_no">
                <Input placeholder="e.g. MFG0003" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Weight (kg)" name="weight">
                <InputNumber min={0.1} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Pieces" name="pieces">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Special Instructions / Remarks" name="remarks">
            <Input.TextArea rows={2} placeholder="Remarks" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
