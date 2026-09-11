import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
  notification,
} from 'antd'
import {
  ArrowLeftOutlined,
  BarcodeOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  CopyOutlined,
  CreditCardOutlined,
  DollarCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
  ShopOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { apiError, generateCode, getCnLookups, quoteConsignment, saveConsignment } from '../../api/client'

const { Title, Text, Paragraph } = Typography

// Comprehensive registered IPOSB branches & gateways (Sabah, Sarawak, and Peninsular Malaysia)
const DEFAULT_BRANCHES = [
  { value: 'BKI', label: 'BKI — Kota Kinabalu Central Hub (Sabah)', group: 'Sabah' },
  { value: 'SDK', label: 'SDK — Sandakan Branch (Sabah)', group: 'Sabah' },
  { value: 'TWU', label: 'TWU — Tawau Gateway (Sabah)', group: 'Sabah' },
  { value: 'LDD', label: 'LDD — Lahad Datu Branch (Sabah)', group: 'Sabah' },
  { value: 'KEN', label: 'KEN — Keningau Hub (Sabah)', group: 'Sabah' },
  { value: 'KCH', label: 'KCH — Kuching International Hub (Sarawak)', group: 'Sarawak' },
  { value: 'MYY', label: 'MYY — Miri Regional Hub (Sarawak)', group: 'Sarawak' },
  { value: 'BTU', label: 'BTU — Bintulu Gateway (Sarawak)', group: 'Sarawak' },
  { value: 'SBW', label: 'SBW — Sibu Branch (Sarawak)', group: 'Sarawak' },
  { value: 'LBU', label: 'LBU — Labuan Federal Territory Hub', group: 'Federal Territory' },
  { value: 'KUL', label: 'KUL — Kuala Lumpur Central Gateway (Selangor)', group: 'Peninsular' },
  { value: 'PEN', label: 'PEN — Penang Northern Hub (Penang)', group: 'Peninsular' },
  { value: 'JHB', label: 'JHB — Johor Bahru Southern Gateway (Johor)', group: 'Peninsular' },
  { value: 'IPH', label: 'IPH — Ipoh Hub (Perak)', group: 'Peninsular' },
  { value: 'KTN', label: 'KTN — Kuantan East Coast Hub (Pahang)', group: 'Peninsular' },
  { value: 'MLK', label: 'MLK — Melaka Branch (Melaka)', group: 'Peninsular' },
  { value: 'ALR', label: 'ALR — Alor Setar Hub (Kedah)', group: 'Peninsular' },
  { value: 'KBR', label: 'KBR — Kota Bharu Hub (Kelantan)', group: 'Peninsular' },
  { value: 'TRG', label: 'TRG — Kuala Terengganu Hub (Terengganu)', group: 'Peninsular' },
]

export default function ConsignmentEntryPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [lookups, setLookups] = useState({})

  // Mode: Auto-generated CN (default) vs Manual scan pre-printed barcode
  const [isManualCn, setIsManualCn] = useState(false)
  const [activeCnNo, setActiveCnNo] = useState('')

  // Watched state values for dynamic calculations & conditionals
  const [originBranch, setOriginBranch] = useState('BKI')
  const [destinationBranch, setDestinationBranch] = useState('KUL')
  const [originService, setOriginService] = useState('CUSTOMER_DROP')
  const [destinationService, setDestinationService] = useState('DOOR')
  const [payMode, setPayMode] = useState('PPD')
  const [weight, setWeight] = useState(1.0)
  const [pieces, setPieces] = useState(1)
  const [dimL, setDimL] = useState(0)
  const [dimW, setDimW] = useState(0)
  const [dimH, setDimH] = useState(0)
  const [codAmount, setCodAmount] = useState(0)

  // Freight estimate quote
  const [quoteSummary, setQuoteSummary] = useState({
    baseFreight: 12.0,
    fuelSurcharge: 1.2,
    handlingFee: 0.0,
    codFee: 0.0,
    total: 13.2,
  })

  // Volumetric calculation: (L * W * H) / 5000
  const volumetricWeight = useMemo(() => {
    if (dimL > 0 && dimW > 0 && dimH > 0) {
      return Number(((dimL * dimW * dimH) / 5000).toFixed(2))
    }
    return 0
  }, [dimL, dimW, dimH])

  const chargeableWeight = useMemo(() => {
    return Math.max(weight || 0, volumetricWeight || 0)
  }, [weight, volumetricWeight])

  // Build clean, unique branch options from lookup and defaults
  const branchOptions = useMemo(() => {
    const rows = lookups.locations || lookups.hubs || []
    const mapped = rows
      .map((row) => ({
        value: row.loc_id || row.hub_code || row.branch_code,
        label: `${row.loc_name || row.hub_name || row.branch_name || row.loc_id || row.hub_code || row.branch_code} (${row.loc_id || row.hub_code || row.branch_code})`,
        group: 'Registered Nodes',
      }))
      .filter((row) => row.value)

    const merged = [...DEFAULT_BRANCHES, ...mapped]
    const map = new Map()
    for (const item of merged) {
      if (!map.has(item.value)) {
        map.set(item.value, item)
      }
    }
    return Array.from(map.values())
  }, [lookups])

  // Filter zones/delivery points by origin branch
  const originZoneOptions = useMemo(() => {
    const rows = lookups.zones || lookups.deliveryPoints || []
    const filtered = rows.filter(
      (z) => !originBranch || z.hub_code === originBranch || z.branch_code === originBranch,
    )
    const list = filtered.length > 0 ? filtered : rows
    return list.map((z) => ({
      value: z.zone_code || z.delivery_point_code,
      label: `${z.zone_name || z.delivery_point_name || z.zone_code || z.delivery_point_code} (${z.zone_code || z.delivery_point_code})`,
    }))
  }, [lookups, originBranch])

  // Filter zones/delivery points by destination branch
  const destZoneOptions = useMemo(() => {
    const rows = lookups.zones || lookups.deliveryPoints || []
    const filtered = rows.filter(
      (z) => !destinationBranch || z.hub_code === destinationBranch || z.branch_code === destinationBranch,
    )
    const list = filtered.length > 0 ? filtered : rows
    return list.map((z) => ({
      value: z.zone_code || z.delivery_point_code,
      label: `${z.zone_name || z.delivery_point_name || z.zone_code || z.delivery_point_code} (${z.zone_code || z.delivery_point_code})`,
    }))
  }, [lookups, destinationBranch])

  // Drop point options
  const dropPointOptions = useMemo(() => {
    return (lookups.dropPoints || []).map((row) => ({
      value: row.id,
      label: `${row.drop_name} (${row.drop_code}) — ${row.branch_code || row.hub_code || 'Counter'}`,
      branch: row.branch_code || row.hub_code,
    }))
  }, [lookups])

  // Auto-generate CN number on page mount or via button
  async function generateNewCn() {
    setGenerating(true)
    try {
      const res = await generateCode('cn_no')
      const generated = res?.code || res?.cn_no
      if (generated) {
        form.setFieldValue('cn_no', generated)
        setActiveCnNo(generated)
      }
    } catch {
      // Fallback local format if server call is delayed
      const fallback = `IP${dayjs().format('YYMMDD')}${Math.floor(1000 + Math.random() * 9000)}`
      form.setFieldValue('cn_no', fallback)
      setActiveCnNo(fallback)
    } finally {
      setGenerating(false)
    }
  }

  // Calculate live freight quote estimate
  async function fetchLiveQuote() {
    if (!originBranch || !destinationBranch || chargeableWeight <= 0) return
    setQuoting(true)
    try {
      const res = await quoteConsignment({
        cn_origin: originBranch,
        cn_dstn: destinationBranch,
        cn_wt: chargeableWeight,
        cn_pcs: pieces,
        pay_mode: payMode,
        srv_typ: form.getFieldValue('srv_typ') || 'STD',
      })
      if (res && res.amount) {
        const base = Number(res.amount) || 12.0
        const fuel = Number((base * 0.1).toFixed(2))
        const cod = payMode === 'COD' ? Math.max(3.0, Number((codAmount * 0.02).toFixed(2))) : 0.0
        setQuoteSummary({
          baseFreight: base,
          fuelSurcharge: fuel,
          handlingFee: 0.0,
          codFee: cod,
          total: Number((base + fuel + cod).toFixed(2)),
        })
        return
      }
    } catch {
      // Offline fallback heuristic
    } finally {
      setQuoting(false)
    }

    // Heuristic estimate fallback
    const isInterState = originBranch !== destinationBranch
    const isEastWest =
      (['BKI', 'SDK', 'TWU', 'KCH', 'MYY', 'BTU'].includes(originBranch) &&
        ['KUL', 'PEN', 'JHB', 'IPH', 'KTN'].includes(destinationBranch)) ||
      (['KUL', 'PEN', 'JHB', 'IPH', 'KTN'].includes(originBranch) &&
        ['BKI', 'SDK', 'TWU', 'KCH', 'MYY', 'BTU'].includes(destinationBranch))

    let rate = isEastWest ? 15.0 : isInterState ? 9.0 : 6.0
    rate += Math.max(0, chargeableWeight - 1) * (isEastWest ? 8.0 : 4.0)
    const fuel = Number((rate * 0.1).toFixed(2))
    const cod = payMode === 'COD' ? Math.max(3.0, Number((codAmount * 0.02).toFixed(2))) : 0.0
    setQuoteSummary({
      baseFreight: Number(rate.toFixed(2)),
      fuelSurcharge: fuel,
      handlingFee: 0.0,
      codFee: cod,
      total: Number((rate + fuel + cod).toFixed(2)),
    })
  }

  // Load master lookups & initial auto-generated CN
  useEffect(() => {
    getCnLookups()
      .then((data) => {
        setLookups(data || {})
      })
      .catch(() => setLookups({}))

    generateNewCn()

    // Form initial baseline defaults
    form.setFieldsValue({
      cust_ac_type: 'WALK_IN',
      cust_ac_no: 'WALK-IN',
      cust_name: 'WALK-IN RETAIL CUSTOMER',
      booking_date: dayjs(),
      srv_typ: 'STD',
      pkg_typ: 'P',
      transport_mode: 'ROAD',
      cn_origin: 'BKI',
      cn_dstn: 'KUL',
      origin_service: 'CUSTOMER_DROP',
      destination_service: 'DOOR',
      cn_wt: 1.0,
      cn_pcs: 1,
      pay_mode: 'PPD',
      pu_time_window: 'morning',
    })
  }, [])

  // Recalculate quote whenever origin, destination, weight or payment changes
  useEffect(() => {
    fetchLiveQuote()
  }, [originBranch, destinationBranch, chargeableWeight, pieces, payMode, codAmount])

  // Copy CN barcode number
  function handleCopyCn() {
    const cn = form.getFieldValue('cn_no') || activeCnNo
    if (cn) {
      navigator.clipboard.writeText(cn)
      message.success(`Consignment number ${cn} copied to clipboard`)
    }
  }

  // Submit Handler: Saves consignment, optionally prints waybill label
  async function handleSubmit(values, printAfter = false) {
    setLoading(true)
    try {
      const finalCn = (values.cn_no || activeCnNo || '').trim().toUpperCase()

      // Resolve origin zone fallback if unselected
      const finalOriginZone =
        values.origin_zone ||
        originZoneOptions[0]?.value ||
        values.cn_origin ||
        'BKI'

      // Resolve destination zone fallback if unselected
      const finalDestZone =
        values.destination_zone ||
        destZoneOptions[0]?.value ||
        values.cn_dstn ||
        'KUL'

      // Resolve drop points
      const originDrop =
        values.origin_service === 'CUSTOMER_DROP'
          ? values.origin_drop_point_id || (dropPointOptions[0]?.value || 0)
          : 0

      const destDrop =
        values.destination_service === 'SELF_COLLECT'
          ? values.destination_drop_point_id || (dropPointOptions[0]?.value || 0)
          : 0

      // Sender address formatting
      const senderAddr =
        values.origin_service === 'OWN_DP'
          ? values.sender_address
          : `Counter Drop-off: ${values.cn_origin} Hub Counter`

      // Delivery address formatting
      const deliveryAddr =
        values.destination_service === 'DOOR'
          ? [
              values.remarks,
              values.dest_postcode ? `Postcode: ${values.dest_postcode}` : '',
              values.dest_city ? `City: ${values.dest_city}` : '',
              values.dest_state ? `State: ${values.dest_state}` : '',
            ]
              .filter(Boolean)
              .join(', ')
          : `Self-Collect: ${values.cn_dstn} Hub / Counter Collection Point`

      // Construct remarks with special delivery instructions
      const combinedRemarks = [
        deliveryAddr,
        values.special_instructions ? `[Instructions: ${values.special_instructions}]` : '',
        values.goods_desc ? `[Cargo: ${values.goods_desc}]` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      const payload = {
        cn_no: finalCn,
        cust_ac_no: values.cust_ac_no || 'WALK-IN',
        cust_name: values.cust_name || values.consigner,
        srv_typ: values.srv_typ || 'STD',
        pkg_typ: values.pkg_typ || 'P',
        transport_mode: values.transport_mode || 'ROAD',
        cn_origin: values.cn_origin || 'BKI',
        cn_dstn: values.cn_dstn || 'KUL',
        origin_zone: finalOriginZone,
        destination_zone: finalDestZone,
        origin_service: values.origin_service || 'CUSTOMER_DROP',
        destination_service: values.destination_service || 'DOOR',
        origin_drop_point_id: originDrop,
        destination_drop_point_id: destDrop,
        consigner: values.consigner,
        sender_phone: values.sender_phone,
        sender_email: values.sender_email,
        sender_address: senderAddr,
        consignee: values.consignee,
        recp_name: values.consignee,
        recp_phone: values.recp_phone,
        remarks: combinedRemarks,
        pu_dt: values.booking_date ? values.booking_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        cn_wt: Number(chargeableWeight || 1.0),
        cn_pcs: Number(values.cn_pcs || 1),
        pay_mode: values.pay_mode || 'PPD',
        cash_amt: values.pay_mode === 'COD' ? Number(values.cash_amt || 0) : 0,
        cod_amt: values.pay_mode === 'COD' ? Number(values.cash_amt || 0) : 0,
        tot_cn_amt: quoteSummary.total,
      }

      const res = await saveConsignment(payload)
      const createdCn = res?.cnNo || res?.cn_no || finalCn

      notification.success({
        message: 'Shipment Successfully Registered',
        description: `Consignment ${createdCn} has been created and logged in the system.`,
        placement: 'topRight',
        duration: 4,
      })

      if (printAfter) {
        window.open(`/api/labels/${encodeURIComponent(createdCn)}`, '_blank')
      }

      // Navigate to the newly created consignment details page
      navigate(`/ops/consignments/${encodeURIComponent(createdCn)}`)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 64 }}>
      {/* Top Breadcrumb & Page Title Strip */}
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb
          items={[
            { title: <Link to="/ops/dashboard">Operations</Link> },
            { title: <Link to="/ops/consignments">Consignments</Link> },
            { title: 'New Shipment Booking' },
          ]}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space align="center" size={12}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/ops/consignments')}
              style={{ borderRadius: 6 }}
            >
              Back
            </Button>
            <div>
              <Title level={3} style={{ margin: 0, color: '#0F172A', fontWeight: 700 }}>
                New Consignment Booking
              </Title>
              <Text style={{ fontSize: 13, color: '#64748B' }}>
                Full operational intake: auto-generated CN barcode, branch routing, client, sender, receiver & pickup details.
              </Text>
            </div>
          </Space>

          <Space size={10}>
            <Button onClick={() => navigate('/ops/consignments')}>Cancel</Button>
            <Button
              icon={<PrinterOutlined />}
              loading={loading}
              onClick={() => form.validateFields().then((vals) => handleSubmit(vals, true))}
            >
              Save & Print Label
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={loading}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
              onClick={() => form.submit()}
            >
              Create Shipment
            </Button>
          </Space>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={(vals) => handleSubmit(vals, false)}
        initialValues={{
          pay_mode: 'PPD',
          pkg_typ: 'P',
          srv_typ: 'STD',
          transport_mode: 'ROAD',
          cn_origin: 'BKI',
          cn_dstn: 'KUL',
          origin_service: 'CUSTOMER_DROP',
          destination_service: 'DOOR',
          cn_pcs: 1,
          cn_wt: 1.0,
          cash_amt: 0,
        }}
      >
        {/* CN NUMBER & SERVICE IDENTITY HEADER STRIP */}
        <Card
          style={{
            marginBottom: 20,
            borderRadius: 8,
            border: '1px solid #CBD5E1',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <Row gutter={[20, 16]} align="middle">
            {/* CN Number display & regeneration */}
            <Col xs={24} md={10}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 13, color: '#334155' }}>
                    <BarcodeOutlined style={{ marginRight: 6, color: '#1B8A5A' }} />
                    Consignment Number (CN)
                  </Text>
                  <Space size={6}>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>Scan Existing</Text>
                    <Switch
                      size="small"
                      checked={isManualCn}
                      onChange={(checked) => {
                        setIsManualCn(checked)
                        if (!checked && !activeCnNo) generateNewCn()
                      }}
                    />
                  </Space>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Form.Item
                    name="cn_no"
                    noStyle
                    rules={[{ required: true, message: 'CN number is required' }]}
                  >
                    <Input
                      readOnly={!isManualCn}
                      placeholder="e.g. 20260911001"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        fontSize: 16,
                        letterSpacing: '0.05em',
                        color: isManualCn ? '#0F172A' : '#1B8A5A',
                        background: isManualCn ? '#FFFFFF' : '#F1F5F9',
                      }}
                      onChange={(e) => setActiveCnNo(e.target.value.toUpperCase())}
                    />
                  </Form.Item>

                  {!isManualCn && (
                    <Tooltip title="Regenerate unique CN number">
                      <Button
                        icon={<ReloadOutlined spin={generating} />}
                        loading={generating}
                        onClick={generateNewCn}
                      />
                    </Tooltip>
                  )}
                  <Tooltip title="Copy CN number">
                    <Button icon={<CopyOutlined />} onClick={handleCopyCn} />
                  </Tooltip>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color="success" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                    {isManualCn ? 'Manual Waybill Scan' : 'Auto-Generated by IPOSB System'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Unique identity key for tracking & billing
                  </Text>
                </div>
              </div>
            </Col>

            {/* Booking Date */}
            <Col xs={24} sm={8} md={5}>
              <Form.Item
                label={
                  <Space size={4}>
                    <ClockCircleOutlined style={{ color: '#64748B' }} />
                    <span>Booking Date</span>
                  </Space>
                }
                name="booking_date"
                rules={[{ required: true }]}
                style={{ marginBottom: 0 }}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" allowClear={false} />
              </Form.Item>
            </Col>

            {/* Service Level */}
            <Col xs={24} sm={8} md={4}>
              <Form.Item
                label="Service Speed"
                name="srv_typ"
                rules={[{ required: true }]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  options={[
                    { value: 'STD', label: 'STD — Standard Delivery' },
                    { value: 'EXP', label: 'EXP — Express Priority' },
                    { value: 'SD', label: 'SD — Same Day' },
                  ]}
                />
              </Form.Item>
            </Col>

            {/* Transport Mode */}
            <Col xs={24} sm={8} md={5}>
              <Form.Item
                label="Transit Trunk"
                name="transport_mode"
                rules={[{ required: true }]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  options={[
                    { value: 'ROAD', label: 'ROAD — Peninsular Trunk' },
                    { value: 'SEA', label: 'SEA — Ocean Marine Cargo' },
                    { value: 'MULTIMODAL', label: 'MULTIMODAL — Road + Sea' },
                    { value: 'AIR', label: 'AIR — Air Cargo Freight' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 2-COLUMN DOSSIER: SENDER (LEFT) vs RECEIVER (RIGHT) */}
        <Row gutter={[20, 20]}>
          {/* SENDER & ORIGIN PICKUP SECTION */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <UserOutlined style={{ color: '#1B8A5A' }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Sender Details & Origin Pickup</span>
                </Space>
              }
              size="small"
              style={{ borderRadius: 8, height: '100%', border: '1px solid #E2E8F0' }}
              headStyle={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}
            >
              {/* Origin Branch Dropdown — Structured Select, NOT text input */}
              <Form.Item
                label={
                  <Space size={4}>
                    <EnvironmentOutlined style={{ color: '#1B8A5A' }} />
                    <span style={{ fontWeight: 600 }}>Origin Branch / Hub (Counter)</span>
                  </Space>
                }
                name="cn_origin"
                rules={[{ required: true, message: 'Please select origin branch' }]}
                tooltip="Select the originating IPOSB hub or counter handling this intake"
              >
                <Select
                  showSearch
                  placeholder="Select origin branch..."
                  optionFilterProp="label"
                  options={branchOptions}
                  onChange={(val) => {
                    setOriginBranch(val)
                    form.setFieldValue('origin_zone', undefined)
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item
                    label="Sender Full Name"
                    name="consigner"
                    rules={[{ required: true, message: 'Sender name is required' }]}
                  >
                    <Input placeholder="e.g. Ahmad bin Razak" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item
                    label="Sender Phone"
                    name="sender_phone"
                    rules={[{ required: true, message: 'Contact phone is required' }]}
                  >
                    <Input placeholder="e.g. 012-3456789" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Sender Email (Optional)" name="sender_email">
                <Input type="email" placeholder="e.g. ahmad@gmail.com" />
              </Form.Item>

              <Divider style={{ margin: '14px 0' }} />

              {/* Pickup Type / Origin Service Mode */}
              <Form.Item
                label={
                  <Space size={4}>
                    <CarOutlined style={{ color: '#1668DC' }} />
                    <span style={{ fontWeight: 600 }}>Pickup Method</span>
                  </Space>
                }
                name="origin_service"
                rules={[{ required: true }]}
              >
                <Radio.Group
                  buttonStyle="solid"
                  style={{ width: '100%', display: 'flex' }}
                  onChange={(e) => setOriginService(e.target.value)}
                >
                  <Radio.Button value="CUSTOMER_DROP" style={{ flex: 1, textAlign: 'center' }}>
                    Counter Drop-off
                  </Radio.Button>
                  <Radio.Button value="OWN_DP" style={{ flex: 1, textAlign: 'center' }}>
                    Courier Pickup
                  </Radio.Button>
                  <Radio.Button value="3PL" style={{ flex: 1, textAlign: 'center' }}>
                    Drop Point Agent
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              {/* Conditional Pickup Details */}
              {originService === 'OWN_DP' ? (
                <div
                  style={{
                    padding: 12,
                    background: '#F0F9FF',
                    borderRadius: 6,
                    border: '1px solid #BAE6FD',
                    marginBottom: 12,
                  }}
                >
                  <Form.Item
                    label="Pickup Address"
                    name="sender_address"
                    rules={[{ required: true, message: 'Pickup address is required for courier pickup' }]}
                  >
                    <Input.TextArea
                      rows={2}
                      placeholder="Full pickup location address (street, building, unit, landmark)"
                    />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="Pickup Time Window" name="pu_time_window">
                        <Select
                          options={[
                            { value: 'morning', label: 'Morning (09:00 - 13:00)' },
                            { value: 'afternoon', label: 'Afternoon (14:00 - 18:00)' },
                            { value: 'anytime', label: 'Anytime Today' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Origin Zone" name="origin_zone">
                        <Select
                          allowClear
                          showSearch
                          placeholder="Select zone..."
                          optionFilterProp="label"
                          options={originZoneOptions}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              ) : (
                <Row gutter={12}>
                  <Col span={14}>
                    <Form.Item label="Drop Point Counter" name="origin_drop_point_id">
                      <Select
                        allowClear
                        showSearch
                        placeholder="Select branch counter..."
                        optionFilterProp="label"
                        options={dropPointOptions}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item label="Origin Zone" name="origin_zone">
                      <Select
                        allowClear
                        showSearch
                        placeholder="Zone code..."
                        optionFilterProp="label"
                        options={originZoneOptions}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              )}
            </Card>
          </Col>

          {/* RECIPIENT & DESTINATION DELIVERY SECTION */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <EnvironmentOutlined style={{ color: '#1668DC' }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Receiver Details & Destination Delivery</span>
                </Space>
              }
              size="small"
              style={{ borderRadius: 8, height: '100%', border: '1px solid #E2E8F0' }}
              headStyle={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}
            >
              {/* Destination Branch Dropdown — Structured Select, NOT text input */}
              <Form.Item
                label={
                  <Space size={4}>
                    <EnvironmentOutlined style={{ color: '#1668DC' }} />
                    <span style={{ fontWeight: 600 }}>Destination Branch / Hub</span>
                  </Space>
                }
                name="cn_dstn"
                rules={[{ required: true, message: 'Please select destination branch' }]}
                tooltip="Select the receiving IPOSB gateway or delivery hub"
              >
                <Select
                  showSearch
                  placeholder="Select destination branch..."
                  optionFilterProp="label"
                  options={branchOptions}
                  onChange={(val) => {
                    setDestinationBranch(val)
                    form.setFieldValue('destination_zone', undefined)
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item
                    label="Recipient Full Name"
                    name="consignee"
                    rules={[{ required: true, message: 'Recipient name is required' }]}
                  >
                    <Input placeholder="e.g. Siti Nurhaliza" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item
                    label="Recipient Phone"
                    name="recp_phone"
                    rules={[{ required: true, message: 'Phone number is required' }]}
                  >
                    <Input placeholder="e.g. 019-8765432" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item label="Secondary Phone (Optional)" name="recp_phone2">
                    <Input placeholder="e.g. 088-123456" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item label="Recipient Email (Optional)" name="recp_email">
                    <Input type="email" placeholder="siti@gmail.com" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '14px 0' }} />

              {/* Delivery Service Mode */}
              <Form.Item
                label={
                  <Space size={4}>
                    <InboxOutlined style={{ color: '#1B8A5A' }} />
                    <span style={{ fontWeight: 600 }}>Delivery Method</span>
                  </Space>
                }
                name="destination_service"
                rules={[{ required: true }]}
              >
                <Radio.Group
                  buttonStyle="solid"
                  style={{ width: '100%', display: 'flex' }}
                  onChange={(e) => setDestinationService(e.target.value)}
                >
                  <Radio.Button value="DOOR" style={{ flex: 1, textAlign: 'center' }}>
                    Doorstep Delivery
                  </Radio.Button>
                  <Radio.Button value="SELF_COLLECT" style={{ flex: 1, textAlign: 'center' }}>
                    Hub Self-Collect
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              {/* Conditional Delivery Details */}
              {destinationService === 'DOOR' ? (
                <div>
                  <Form.Item
                    label="Delivery Street Address"
                    name="remarks"
                    rules={[{ required: true, message: 'Delivery address is required for doorstep delivery' }]}
                  >
                    <Input.TextArea
                      rows={2}
                      placeholder="Street name, residential lot, building, floor/unit number"
                    />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="Postcode" name="dest_postcode">
                        <Input placeholder="e.g. 50450" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="City" name="dest_city">
                        <Input placeholder="e.g. Kuala Lumpur" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Delivery Zone" name="destination_zone">
                        <Select
                          allowClear
                          showSearch
                          placeholder="Zone..."
                          optionFilterProp="label"
                          options={destZoneOptions}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="Delivery Instructions / Gate Code" name="special_instructions">
                    <Input placeholder="e.g. Leave at guardhouse / Call recipient 15 min before arrival" />
                  </Form.Item>
                </div>
              ) : (
                <div>
                  <Form.Item
                    label="Destination Collection Drop Point"
                    name="destination_drop_point_id"
                    rules={[{ required: true, message: 'Please choose destination collection counter' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select collection hub or partner drop point..."
                      optionFilterProp="label"
                      options={dropPointOptions}
                    />
                  </Form.Item>
                  <Alert
                    type="info"
                    showIcon
                    message="Receiver will collect parcel from counter upon SMS arrival notification."
                    style={{ fontSize: 12, marginBottom: 12 }}
                  />
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* PARCEL & CARGO SPECIFICATION */}
        <Card
          title={
            <Space>
              <InboxOutlined style={{ color: '#1B8A5A' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Cargo & Parcel Specifications</span>
            </Space>
          }
          size="small"
          style={{ marginTop: 20, borderRadius: 8, border: '1px solid #E2E8F0' }}
          headStyle={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}
        >
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={6}>
              <Form.Item label="Package Type" name="pkg_typ" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'P', label: 'Parcel / Carton Box' },
                    { value: 'D', label: 'Document / Envelope' },
                    { value: 'F', label: 'Fragile Goods' },
                    { value: 'H', label: 'Heavy Cargo / Pallet' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={12} sm={6}>
              <Form.Item
                label="Actual Weight (kg)"
                name="cn_wt"
                rules={[{ required: true, message: 'Enter weight' }]}
              >
                <InputNumber
                  min={0.01}
                  step={0.1}
                  precision={2}
                  style={{ width: '100%' }}
                  onChange={(val) => setWeight(Number(val || 1))}
                />
              </Form.Item>
            </Col>

            <Col xs={12} sm={4}>
              <Form.Item
                label="Pieces (pcs)"
                name="cn_pcs"
                rules={[{ required: true, message: 'Enter pieces' }]}
              >
                <InputNumber
                  min={1}
                  precision={0}
                  style={{ width: '100%' }}
                  onChange={(val) => setPieces(Number(val || 1))}
                />
              </Form.Item>
            </Col>

            {/* Dimensions for volumetric calculation */}
            <Col xs={24} sm={8}>
              <Form.Item label="Dimensions: L × W × H (cm)">
                <Space.Compact style={{ width: '100%' }}>
                  <InputNumber
                    placeholder="L (cm)"
                    min={0}
                    style={{ width: '33%' }}
                    onChange={(val) => setDimL(Number(val || 0))}
                  />
                  <InputNumber
                    placeholder="W (cm)"
                    min={0}
                    style={{ width: '33%' }}
                    onChange={(val) => setDimW(Number(val || 0))}
                  />
                  <InputNumber
                    placeholder="H (cm)"
                    min={0}
                    style={{ width: '34%' }}
                    onChange={(val) => setDimH(Number(val || 0))}
                  />
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          {/* Dynamic Volumetric / Chargeable weight helper strip */}
          <div
            style={{
              padding: '10px 14px',
              background: '#F8FAFC',
              borderRadius: 6,
              border: '1px solid #E2E8F0',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <Space size={16}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>ACTUAL WEIGHT</Text>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{weight || 0} kg</div>
              </div>
              <Divider type="vertical" style={{ height: 28 }} />
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>VOLUMETRIC WEIGHT</Text>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#64748B' }}>
                  {volumetricWeight} kg
                </div>
              </div>
              <Divider type="vertical" style={{ height: 28 }} />
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>BILLABLE CHARGEABLE WEIGHT</Text>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1B8A5A' }}>
                  {chargeableWeight} kg
                </div>
              </div>
            </Space>

            <Tag color={volumetricWeight > weight ? 'orange' : 'blue'} style={{ margin: 0, fontWeight: 600 }}>
              {volumetricWeight > weight ? 'Volumetric Heavy Parcel' : 'Actual Weight Billable'}
            </Tag>
          </div>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Content Description" name="goods_desc">
                <Input placeholder="e.g. Commercial spare parts, garments, electronics" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item label="Declared Cargo Value (RM)" name="declared_value">
                <InputNumber min={0} precision={2} prefix="RM" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item label="Customer Account Code" name="cust_ac_no">
                <Input placeholder="WALK-IN" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* PAYMENT & FINANCIAL RECONCILIATION */}
        <Card
          title={
            <Space>
              <DollarCircleOutlined style={{ color: '#1B8A5A' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Payment Mode & Freight Billing</span>
            </Space>
          }
          size="small"
          style={{ marginTop: 20, borderRadius: 8, border: '1px solid #E2E8F0' }}
          headStyle={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}
        >
          <Row gutter={[20, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Payment Mode</span>}
                name="pay_mode"
                rules={[{ required: true }]}
              >
                <Radio.Group
                  buttonStyle="solid"
                  style={{ width: '100%', display: 'flex' }}
                  onChange={(e) => setPayMode(e.target.value)}
                >
                  <Radio.Button value="PPD" style={{ flex: 1, textAlign: 'center' }}>
                    PPD — Prepaid
                  </Radio.Button>
                  <Radio.Button value="COD" style={{ flex: 1, textAlign: 'center' }}>
                    COD — Cash on Delivery
                  </Radio.Button>
                  <Radio.Button value="ACC" style={{ flex: 1, textAlign: 'center' }}>
                    ACC — Credit Account
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              {payMode === 'COD' && (
                <div
                  style={{
                    padding: 14,
                    background: '#FFFBEB',
                    borderRadius: 6,
                    border: '1px solid #FDE68A',
                    marginTop: 10,
                  }}
                >
                  <Form.Item
                    label={
                      <span style={{ fontWeight: 700, color: '#92400E' }}>
                        COD Amount to Collect from Recipient (RM)
                      </span>
                    }
                    name="cash_amt"
                    rules={[{ required: true, message: 'Please enter COD collection amount' }]}
                    style={{ marginBottom: 8 }}
                  >
                    <InputNumber
                      min={0.01}
                      precision={2}
                      prefix="RM"
                      style={{ width: '100%', fontSize: 16, fontWeight: 700 }}
                      onChange={(val) => setCodAmount(Number(val || 0))}
                    />
                  </Form.Item>
                  <Text style={{ fontSize: 12, color: '#B45309' }}>
                    The delivering courier/agent will collect this cash upon handing over the parcel.
                  </Text>
                </div>
              )}
            </Col>

            {/* Estimated Quote Breakdown Box */}
            <Col xs={24} md={12}>
              <div
                style={{
                  padding: '14px 18px',
                  background: '#F8FAFC',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 13, color: '#334155' }}>
                    Freight & Surcharge Estimate
                  </Text>
                  <Tag color="cyan">{originBranch} → {destinationBranch}</Tag>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <Text type="secondary">Base Freight ({chargeableWeight} kg):</Text>
                  <Text strong>RM {quoteSummary.baseFreight.toFixed(2)}</Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <Text type="secondary">Fuel Surcharge (10%):</Text>
                  <Text strong>RM {quoteSummary.fuelSurcharge.toFixed(2)}</Text>
                </div>

                {quoteSummary.codFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <Text type="secondary">COD Processing Fee:</Text>
                    <Text strong>RM {quoteSummary.codFee.toFixed(2)}</Text>
                  </div>
                )}

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 14, color: '#0F172A' }}>Estimated Total:</Text>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#1B8A5A' }}>
                    RM {quoteSummary.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        {/* STICKY BOTTOM ACTION STRIP */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 100,
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            padding: '14px 24px',
            marginTop: 24,
            borderRadius: 8,
            border: '1px solid #CBD5E1',
            boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: 15,
                color: '#1B8A5A',
              }}
            >
              {activeCnNo || 'Generating CN...'}
            </span>
            <Tag color="geekblue" style={{ margin: 0 }}>
              {originBranch} → {destinationBranch}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Freight: <strong>RM {quoteSummary.total.toFixed(2)}</strong> ({payMode})
            </Text>
          </div>

          <Space size={12}>
            <Button size="large" onClick={() => navigate('/ops/consignments')}>
              Cancel
            </Button>
            <Button
              size="large"
              icon={<PrinterOutlined />}
              loading={loading}
              onClick={() => form.validateFields().then((vals) => handleSubmit(vals, true))}
            >
              Save & Print Waybill Label
            </Button>
            <Button
              size="large"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={loading}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A', minWidth: 160 }}
              htmlType="submit"
            >
              Create Consignment
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  )
}
