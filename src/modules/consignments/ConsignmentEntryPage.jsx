import React, { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
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
  Spin,
  Typography,
  message,
  notification,
} from 'antd'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  apiError,
  generateCode,
  generateSystemCode,
  getCnLookups,
  getCodConfig,
  getCodRecord,
  getConsignment,
  get3plPartners,
  quoteConsignment,
  saveConsignment,
  saveMaster,
  searchCustomers,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { isDroppointManager } from '../../auth/rbac'

const { Title, Text } = Typography

const BRAND = '#1B8A5A'
const MUTED = '#475569'
const LABEL = '#1E293B'

function FieldHint({ children }) {
  return (
    <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.45, color: MUTED }}>
      {children}
    </div>
  )
}

function money(x) {
  if (x == null || x === '') return '—'
  const n = Number(x)
  if (Number.isNaN(n)) return '—'
  return `RM ${n.toFixed(2)}`
}

function zoneCode(z) {
  return z?.delivery_point_code || z?.zone_code || ''
}

function zoneName(z) {
  return z?.delivery_point_name || z?.zone_name || zoneCode(z)
}

function zoneHub(z) {
  return z?.hub_code || z?.branch_code || ''
}

function emptyPiece() {
  return {
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    weight: '',
    qty: 1,
    itemDesc: '',
  }
}

function emptyForm() {
  return {
    cn_no: '',
    cust_ac_no: '',
    srv_typ: 'STD',
    pkg_typ: 'P',
    cn_origin: '',
    cn_dstn: '',
    origin_zone: '',
    destination_zone: '',
    destination_area_code: '',
    origin_drop_point_id: '',
    destination_drop_point_id: '',
    origin_service: 'DROP_COUNTER',
    destination_service: 'DOORSTEP',
    sender_address: '',
    remarks: '',
    pu_dt: dayjs().format('YYYY-MM-DD'),
    cn_wt: '',
    cn_pcs: '1',
    pieces: [emptyPiece()],
    spec_handle: 'N',
    spec_cd: '',
    spec_amt: '',
    consignee: '',
    consigner: '',
    recp_name: '',
    sender_phone: '',
    receiver_phone: '',
    partner_code: '',
    partner_cn_no: '',
    pay_mode: 'PPD',
    cash_amt: '',
    transport_mode: 'road',
    linehaul_mode: '',
    vessel_name: '',
    voyage_ref: '',
    sailing_date: '',
    port_origin: '',
    port_destination: '',
  }
}

function summarizePieces(pieces, divisor = 6000) {
  const d = Number(divisor) > 0 ? Number(divisor) : 6000
  let actual = 0
  let vol = 0
  let cbm = 0
  let pcs = 0
  const rows = (pieces || []).map((p, i) => {
    const l = Number(p.lengthCm) || 0
    const w = Number(p.widthCm) || 0
    const h = Number(p.heightCm) || 0
    const qty = Math.max(1, Number(p.qty) || 1)
    const wtOne = Number(p.weight) || 0
    const volOne = l > 0 && w > 0 && h > 0 ? (l * w * h) / d : 0
    const cbmOne = l > 0 && w > 0 && h > 0 ? (l * w * h) / 1e6 : 0
    const empty = l <= 0 && w <= 0 && h <= 0 && wtOne <= 0
    if (!empty) {
      actual += wtOne * qty
      vol += volOne * qty
      cbm += cbmOne * qty
      pcs += qty
    }
    return {
      ...p,
      seq: i + 1,
      qty,
      volWeight: Math.round(volOne * qty * 1000) / 1000,
      cbm: Math.round(cbmOne * qty * 1e6) / 1e6,
      empty,
    }
  })
  const chargeable = Math.max(actual, vol)
  return {
    rows,
    pcs: pcs || 0,
    actualWt: Math.round(actual * 1000) / 1000,
    volWt: Math.round(vol * 1000) / 1000,
    chargeableWt: Math.round(chargeable * 1000) / 1000,
    cbm: Math.round(cbm * 1e6) / 1e6,
    divisor: d,
  }
}

function piecesPayload(pieces) {
  return (pieces || [])
    .map((p, i) => ({
      seq: i + 1,
      qty: Math.max(1, Number(p.qty) || 1),
      lengthCm: Number(p.lengthCm) || 0,
      widthCm: Number(p.widthCm) || 0,
      heightCm: Number(p.heightCm) || 0,
      weight: Number(p.weight) || 0,
      itemDesc: String(p.itemDesc || '').trim(),
    }))
    .filter((p) => p.lengthCm > 0 || p.widthCm > 0 || p.heightCm > 0 || p.weight > 0)
}

function CustomerPicker({ value, onSelect }) {
  const [q, setQ] = useState(value || '')
  const [hits, setHits] = useState([])
  const [busy, setBusy] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    cust_ac_no: '',
    cust_name: '',
    cust_tel: '',
    cust_email: '',
    cust_addr1: '',
  })
  const timer = useRef(null)

  useEffect(() => {
    setQ(value || '')
  }, [value])

  function search(term) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const t = String(term || '').trim()
      if (t.length < 1) {
        setHits([])
        return
      }
      setBusy(true)
      try {
        const r = await searchCustomers(t)
        setHits(r.customers || [])
      } catch (err) {
        message.error(apiError(err))
        setHits([])
      } finally {
        setBusy(false)
      }
    }, 250)
  }

  async function createCustomer() {
    if (!String(draft.cust_name || '').trim()) {
      message.error('Customer name is required')
      return
    }
    setCreating(true)
    try {
      let ac = String(draft.cust_ac_no || '').trim().toUpperCase()
      if (!ac) {
        try {
          const gen = await generateSystemCode({ kind: 'cust_ac_no', resource: 'customers' })
          ac = gen.code
        } catch {
          const gen = await generateCode('cust_ac_no')
          ac = gen?.code || gen?.cust_ac_no
        }
      }
      await saveMaster('customers', { ...draft, cust_ac_no: ac, cust_status: 'A' })
      onSelect({
        cust_ac_no: ac,
        cust_name: draft.cust_name,
        cust_tel: draft.cust_tel,
      })
      setQ(ac)
      setShowNew(false)
      setDraft({ cust_ac_no: '', cust_name: '', cust_tel: '', cust_email: '', cust_addr1: '' })
      setHits([])
      message.success(`Customer ${ac} created`)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={q}
          placeholder="Search name, phone, or account…"
          prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
          onChange={(e) => {
            const v = e.target.value
            setQ(v)
            onSelect({ cust_ac_no: v.toUpperCase() })
            search(v)
          }}
          onFocus={() => {
            if (q) search(q)
          }}
        />
        <Button icon={<UserAddOutlined />} onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Cancel' : 'New'}
        </Button>
      </Space.Compact>
      {busy ? <Text type="secondary" style={{ fontSize: 12 }}>Searching…</Text> : null}
      {hits.length > 0 ? (
        <div
          style={{
            marginTop: 6,
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            maxHeight: 180,
            overflowY: 'auto',
            background: '#fff',
          }}
        >
          {hits.map((c) => (
            <button
              key={c.cust_ac_no}
              type="button"
              onClick={() => {
                onSelect(c)
                setQ(c.cust_ac_no)
                setHits([])
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                borderBottom: '1px solid #F1F5F9',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <Text strong>{c.cust_ac_no}</Text>
              <Text type="secondary"> — {c.cust_name}</Text>
              {c.cust_tel ? <Text type="secondary"> · {c.cust_tel}</Text> : null}
            </button>
          ))}
        </div>
      ) : null}
      {showNew ? (
        <Card size="small" style={{ marginTop: 8, background: '#F8FAFC' }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Register customer</Text>
          <Row gutter={[8, 8]}>
            <Col span={8}>
              <Input
                placeholder="Account (optional)"
                value={draft.cust_ac_no}
                onChange={(e) => setDraft((d) => ({ ...d, cust_ac_no: e.target.value.toUpperCase() }))}
              />
            </Col>
            <Col span={8}>
              <Input
                placeholder="Name *"
                value={draft.cust_name}
                onChange={(e) => setDraft((d) => ({ ...d, cust_name: e.target.value }))}
              />
            </Col>
            <Col span={8}>
              <Input
                placeholder="Phone"
                value={draft.cust_tel}
                onChange={(e) => setDraft((d) => ({ ...d, cust_tel: e.target.value }))}
              />
            </Col>
            <Col span={8}>
              <Input
                placeholder="Email"
                type="email"
                value={draft.cust_email}
                onChange={(e) => setDraft((d) => ({ ...d, cust_email: e.target.value }))}
              />
            </Col>
            <Col span={16}>
              <Input
                placeholder="Address"
                value={draft.cust_addr1}
                onChange={(e) => setDraft((d) => ({ ...d, cust_addr1: e.target.value }))}
              />
            </Col>
            <Col span={24}>
              <Button type="primary" loading={creating} onClick={createCustomer} style={{ background: BRAND, borderColor: BRAND }}>
                Save customer & use
              </Button>
            </Col>
          </Row>
        </Card>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Search an existing account, or click New to register.
        </Text>
      )}
    </div>
  )
}

export default function ConsignmentEntryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const preset = (params.get('cn') || '').toUpperCase()
  const dropMode = params.get('mode') === 'drop'
  const isDpManager = isDroppointManager(user?.role)

  // Droppoint Manager may only use counter booking (?mode=drop).
  useEffect(() => {
    if (!isDpManager || dropMode) return
    const next = new URLSearchParams(params)
    next.set('mode', 'drop')
    navigate(`/ops/consignments/new?${next.toString()}`, { replace: true })
  }, [isDpManager, dropMode, navigate, params])

  const [lookups, setLookups] = useState({
    locations: [],
    zones: [],
    areas: [],
    dropPoints: [],
    serviceTypes: [],
    transportModes: [],
  })
  const [partners3pl, setPartners3pl] = useState([])
  const [form, setForm] = useState(() => {
    const base = emptyForm()
    if (dropMode) base.origin_service = 'DROP_COUNTER'
    return base
  })
  const [isExisting, setIsExisting] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [codFeeRm, setCodFeeRm] = useState(2)
  const [codInfo, setCodInfo] = useState(null)
  const [savedFreight, setSavedFreight] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const quoteTimer = useRef(null)
  const bootstrapped = useRef(false)

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  useEffect(() => {
    getCnLookups()
      .then(setLookups)
      .catch((err) => message.error(apiError(err) || 'Could not load dropdown options.'))
    getCodConfig()
      .then((d) => {
        if (d?.codFeeRm != null) setCodFeeRm(Number(d.codFeeRm))
      })
      .catch(() => {})
    get3plPartners()
      .then((list) => setPartners3pl(Array.isArray(list) ? list : []))
      .catch(() => setPartners3pl([]))
  }, [])

  useEffect(() => {
    if (!dropMode) return
    setForm((f) =>
      f.origin_service === 'DROP_COUNTER' ? f : { ...f, origin_service: 'DROP_COUNTER', sender_address: '' },
    )
  }, [dropMode])

  // Overnight is operational, not bookable at entry
  useEffect(() => {
    const code = String(form.srv_typ || '').toUpperCase()
    if (['OND', 'OVN', 'OVERNIGHT'].includes(code)) {
      setForm((f) => ({ ...f, srv_typ: 'STD' }))
    }
  }, [form.srv_typ])

  // Live quote — uses chargeable weight from piece dimensions when present
  useEffect(() => {
    const dim = summarizePieces(form.pieces, lookups.volumetricDivisor)
    const wt = dim.pcs > 0 ? dim.chargeableWt : parseFloat(form.cn_wt)
    const pcs = dim.pcs > 0 ? dim.pcs : (parseInt(form.cn_pcs, 10) || 1)
    if (!form.cust_ac_no || !form.cn_origin || !form.cn_dstn || !wt || wt <= 0) {
      setQuote(null)
      setQuoting(false)
      return
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    setQuoting(true)
    quoteTimer.current = setTimeout(() => {
      const body = {
        cust_ac_no: form.cust_ac_no,
        srv_typ: form.srv_typ,
        pkg_typ: form.pkg_typ,
        cn_origin: form.cn_origin,
        cn_dstn: form.cn_dstn,
        cn_wt: wt,
        cn_pcs: pcs,
        transport_mode: form.transport_mode || 'road',
        linehaul_mode: form.linehaul_mode || '',
        spec_handle: form.spec_handle,
        spec_amt: form.spec_amt,
        pu_dt: form.pu_dt,
      }
      const pieceRows = piecesPayload(form.pieces)
      if (pieceRows.length) body.pieces = pieceRows
      quoteConsignment(body)
        .then((r) => {
          setQuote(r)
          setQuoting(false)
        })
        .catch(() => {
          setQuote(null)
          setQuoting(false)
        })
    }, 400)
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current)
    }
  }, [form, lookups.volumetricDivisor])

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    if (preset) {
      loadCn(preset)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  function applyCnRow(cnNo, existing) {
    const loadedPieces = Array.isArray(existing?.pieces) && existing.pieces.length
      ? existing.pieces.map((p) => ({
          lengthCm: p.lengthCm ?? p.length_cm ?? '',
          widthCm: p.widthCm ?? p.width_cm ?? '',
          heightCm: p.heightCm ?? p.height_cm ?? '',
          weight: p.weight != null ? Number(p.weight) / Math.max(1, Number(p.qty) || 1) : '',
          qty: p.qty || 1,
          itemDesc: p.itemDesc || p.item_desc || '',
        }))
      : [emptyPiece()]
    setForm({
      cn_no: cnNo,
      cust_ac_no: existing?.cust_ac_no || '',
      srv_typ: existing?.srv_typ || 'STD',
      pkg_typ: existing?.pkg_typ || 'P',
      cn_origin: existing?.cn_origin || '',
      cn_dstn: existing?.cn_dstn || '',
      origin_zone: existing?.origin_zone || '',
      destination_zone: existing?.destination_zone || '',
      destination_area_code: existing?.destination_area_code || '',
      origin_drop_point_id: existing?.origin_drop_point_id || '',
      destination_drop_point_id: existing?.destination_drop_point_id || '',
      origin_service: existing?.origin_service || 'DROP_COUNTER',
      destination_service: existing?.destination_service || 'DOORSTEP',
      sender_address: existing?.sender_address || '',
      remarks: existing?.remarks || '',
      pu_dt: (existing?.pu_dt || '').slice(0, 10) || dayjs().format('YYYY-MM-DD'),
      cn_wt: existing?.cn_wt || '',
      cn_pcs: existing?.cn_pcs || '1',
      pieces: loadedPieces,
      spec_handle: existing?.spec_handle || 'N',
      spec_cd: existing?.oda_cd || '',
      spec_amt: existing?.spec_amt || '',
      consignee: existing?.consignee || '',
      consigner: existing?.consigner || '',
      recp_name: existing?.recp_name || '',
      sender_phone: existing?.sender_phone || existing?.senderPhone || '',
      receiver_phone: existing?.receiver_phone || existing?.receiverPhone || existing?.recp_phone || '',
      partner_code: existing?.partner_code || existing?.partnerCode || '',
      partner_cn_no: existing?.partner_cn_no || existing?.partnerCnNo || '',
      pay_mode: existing?.ppd_cct === 'COD' ? 'COD' : 'PPD',
      cash_amt: existing?.cash_amt || '',
      transport_mode: (existing?.transport_mode || 'road').toLowerCase(),
      linehaul_mode: existing?.linehaul_mode || '',
      vessel_name: existing?.vessel_name || '',
      voyage_ref: existing?.voyage_ref || '',
      sailing_date: (existing?.sailing_date || '').slice(0, 10) || '',
      port_origin: existing?.port_origin || '',
      port_destination: existing?.port_destination || '',
    })
    setIsExisting(Boolean(existing))
    setSavedFreight(
      existing
        ? {
            total: existing.tot_cn_amt,
            tax: existing.cn_tax_amt,
            invFlag: existing.cn_inv_flg,
            invNo: existing.inv_no,
          }
        : null,
    )
    setCodInfo(null)
    if (existing?.ppd_cct === 'COD' && typeof getCodRecord === 'function') {
      getCodRecord(cnNo)
        .then((r) => setCodInfo(r.cod || r))
        .catch(() => setCodInfo(null))
    }
  }

  async function loadCn(cn) {
    const cnNo = String(cn || form.cn_no || '').trim().toUpperCase()
    if (!cnNo) {
      message.error('Enter a consignment number to load.')
      return
    }
    setLoading(true)
    try {
      const existing = (await getConsignment(cnNo)).cn
      applyCnRow(cnNo, existing)
      setParams({ cn: cnNo })
      message.success(`Loaded existing consignment ${cnNo}.`)
    } catch {
      message.warning(`No consignment found for ${cnNo}. Keep typing to create a new one, or Generate a number.`)
      applyCnRow(cnNo, null)
      setParams({ cn: cnNo })
    } finally {
      setLoading(false)
    }
  }

  async function generateCn() {
    setGenerating(true)
    try {
      let code
      try {
        const res = await generateSystemCode({ kind: 'cn_no' })
        code = res?.code || res?.cn_no
      } catch {
        const res = await generateCode('cn_no')
        code = res?.code || res?.cn_no
      }
      if (code) {
        setIsExisting(false)
        set('cn_no', String(code).toUpperCase())
      }
    } catch (err) {
      message.error(apiError(err) || 'Could not generate CN number.')
    } finally {
      setGenerating(false)
    }
  }

  function startNew() {
    setQuote(null)
    setCodInfo(null)
    setSavedFreight(null)
    setIsExisting(false)
    setForm(emptyForm())
    setParams({})
  }

  async function onSave() {
    if (!String(form.cn_no || '').trim()) {
      message.error('Generate or enter a consignment number first.')
      return
    }
    if (!form.cust_ac_no) {
      message.error('Customer account is required.')
      return
    }
    if (!form.origin_zone || !form.destination_zone) {
      message.error('Origin and destination delivery points are required.')
      return
    }
    if (form.origin_service === 'DROP_COUNTER' && !form.origin_drop_point_id) {
      message.error('Select the drop point (counter) for first-mile drop-off.')
      return
    }
    if (form.origin_service === 'ADDRESS_PICKUP' && !String(form.sender_address || '').trim()) {
      message.error('Pickup address is required for address pickup.')
      return
    }
    if (form.destination_service === 'DOORSTEP' && !String(form.remarks || '').trim()) {
      message.error('Delivery address is required for doorstep delivery.')
      return
    }
    const partnerCode = String(form.partner_code || '').trim().toUpperCase()
    const partnerCn = String(form.partner_cn_no || '').trim().toUpperCase()
    if ((partnerCode === '') !== (partnerCn === '')) {
      message.error('Partner code and partner CN must both be set, or both left blank.')
      return
    }
    setSaving(true)
    try {
      const pieceRows = piecesPayload(form.pieces)
      const dim = summarizePieces(form.pieces, lookups.volumetricDivisor)
      const { pieces: _omitPieces, ...formRest } = form
      const payload = {
        ...formRest,
        cn_no: String(form.cn_no).trim().toUpperCase(),
        transport_mode: String(form.transport_mode || 'road').toLowerCase(),
        recp_name: form.recp_name || form.consignee,
        sender_phone: String(form.sender_phone || '').trim() || undefined,
        receiver_phone: String(form.receiver_phone || '').trim() || undefined,
        partner_code: partnerCode,
        partner_cn_no: partnerCn,
        cn_wt: dim.pcs > 0 ? dim.chargeableWt : form.cn_wt,
        cn_pcs: dim.pcs > 0 ? dim.pcs : form.cn_pcs,
        pieces: pieceRows,
      }
      const r = await saveConsignment(payload)
      const iposbCn = r?.iposbCnNo || payload.cn_no
      const displayCn = r?.cnNo || r?.partnerCnNo || iposbCn
      if (r.quote) setQuote(r.quote)
      notification.success({
        message: 'Consignment saved',
        description:
          r.message ||
          (partnerCn
            ? `Saved ${iposbCn} (partner ${partnerCode}:${partnerCn}).`
            : `Consignment ${displayCn} saved successfully.`),
        placement: 'topRight',
        btn: (
          <Button
            type="primary"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() =>
              navigate(`/ops/reports/cn?id=${encodeURIComponent(iposbCn)}&format=a5`)
            }
          >
            Print note
          </Button>
        ),
      })
      navigate(`/ops/consignments/${encodeURIComponent(iposbCn)}`)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const zoneOptions = lookups.zones?.length ? lookups.zones : lookups.deliveryPoints || []

  function pickOriginDp(code) {
    const z = zoneOptions.find((x) => zoneCode(x) === code)
    setForm((f) => ({
      ...f,
      origin_zone: code,
      cn_origin: zoneHub(z) || f.cn_origin,
      origin_drop_point_id: '',
    }))
  }

  function pickDestDp(code) {
    const z = zoneOptions.find((x) => zoneCode(x) === code)
    setForm((f) => ({
      ...f,
      destination_zone: code,
      cn_dstn: zoneHub(z) || f.cn_dstn,
      destination_drop_point_id: '',
      destination_area_code: '',
    }))
  }

  function pickOriginDrop(dropId) {
    const d = (lookups.dropPoints || []).find((x) => String(x.id) === String(dropId))
    const dpCode = d?.delivery_point_code || ''
    const z = dpCode ? zoneOptions.find((x) => zoneCode(x) === dpCode) : null
    setForm((f) => ({
      ...f,
      origin_drop_point_id: dropId,
      origin_zone: dpCode || f.origin_zone,
      cn_origin: zoneHub(z) || d?.hub_code || d?.branch_code || f.cn_origin,
    }))
  }

  const pickupDrops = useMemo(() => {
    const all = (lookups.dropPoints || []).filter((d) => {
      const typ = String(d.drop_type || 'both').toLowerCase()
      return ['pickup', 'both', ''].includes(typ)
    })
    if (!form?.origin_zone) return all
    const matched = all.filter((d) => !d.delivery_point_code || d.delivery_point_code === form.origin_zone)
    return matched.length > 0 ? matched : all
  }, [lookups.dropPoints, form?.origin_zone])

  const deliveryDrops = useMemo(() => {
    const all = (lookups.dropPoints || []).filter((d) => {
      const typ = String(d.drop_type || 'both').toLowerCase()
      return ['delivery', 'both', ''].includes(typ)
    })
    if (!form?.destination_zone) return all
    const matched = all.filter((d) => !d.delivery_point_code || d.delivery_point_code === form.destination_zone)
    return matched.length > 0 ? matched : all
  }, [lookups.dropPoints, form?.destination_zone])

  const destAreas = useMemo(() => {
    const all = lookups.areas || []
    if (!form?.destination_zone) return all
    const matched = all.filter((a) => String(a.delivery_point_code || '') === String(form.destination_zone))
    return matched.length > 0 ? matched : all
  }, [lookups.areas, form?.destination_zone])

  const serviceTypeOptions = (
    lookups.serviceTypes?.length
      ? lookups.serviceTypes
      : [
          { code: 'STD', cd_desc: 'Standard' },
          { code: 'EXP', cd_desc: 'Express' },
        ]
  ).filter((s) => {
    const code = String(s.code || '').toUpperCase()
    const desc = String(s.cd_desc || s.label || '').toUpperCase()
    return !['OND', 'OVN', 'OVERNIGHT'].includes(code) && !desc.includes('OVERNIGHT')
  })

  const originServices = (lookups.originServices?.length
    ? lookups.originServices
    : [
        { code: 'DROP_COUNTER', label: 'Drop at counter' },
        { code: 'ADDRESS_PICKUP', label: 'Address pickup' },
      ]
  ).filter((s) => !dropMode || s.code === 'DROP_COUNTER')
  const destinationServices = lookups.destinationServices?.length
    ? lookups.destinationServices
    : [
        { code: 'DOORSTEP', label: 'Doorstep delivery' },
        { code: 'SELF_COLLECT', label: 'Self-collect' },
      ]
  const transportModes = lookups.transportModes?.length
    ? lookups.transportModes
    : [
        { code: 'road', label: 'Road / Land' },
        { code: 'sea', label: 'Sea / Ferry' },
        { code: 'air', label: 'Air' },
        { code: 'multi', label: 'Multimodal' },
      ]

  const showSeaFields =
    form?.transport_mode === 'sea' || (form?.transport_mode === 'multi' && form?.linehaul_mode === 'sea')

  const originLabel = useMemo(() => {
    const z = zoneOptions.find((x) => zoneCode(x) === form?.origin_zone)
    return z ? `${zoneCode(z)} · ${zoneName(z)}` : form?.origin_zone || '—'
  }, [zoneOptions, form?.origin_zone])

  const destLabel = useMemo(() => {
    const z = zoneOptions.find((x) => zoneCode(x) === form?.destination_zone)
    return z ? `${zoneCode(z)} · ${zoneName(z)}` : form?.destination_zone || '—'
  }, [zoneOptions, form?.destination_zone])

  const dimSummary = useMemo(
    () => summarizePieces(form?.pieces, lookups.volumetricDivisor),
    [form?.pieces, lookups.volumetricDivisor],
  )

  const chargeableWt = dimSummary.pcs > 0 ? dimSummary.chargeableWt : parseFloat(form?.cn_wt) || 0
  const canQuote = form && form.cust_ac_no && form.cn_origin && form.cn_dstn && chargeableWt > 0

  function setPiece(idx, patch) {
    setForm((f) => {
      const pieces = [...(f.pieces || [emptyPiece()])]
      pieces[idx] = { ...pieces[idx], ...patch }
      const dim = summarizePieces(pieces, lookups.volumetricDivisor)
      return {
        ...f,
        pieces,
        cn_wt: dim.pcs > 0 ? String(dim.chargeableWt) : f.cn_wt,
        cn_pcs: dim.pcs > 0 ? String(dim.pcs) : f.cn_pcs,
      }
    })
  }

  function addPiece() {
    setForm((f) => ({ ...f, pieces: [...(f.pieces || []), emptyPiece()] }))
  }

  function removePiece(idx) {
    setForm((f) => {
      const pieces = (f.pieces || []).filter((_, i) => i !== idx)
      const next = pieces.length ? pieces : [emptyPiece()]
      const dim = summarizePieces(next, lookups.volumetricDivisor)
      return {
        ...f,
        pieces: next,
        cn_wt: dim.pcs > 0 ? String(dim.chargeableWt) : '',
        cn_pcs: dim.pcs > 0 ? String(dim.pcs) : '1',
      }
    })
  }

  const zoneSelectOptions = zoneOptions.map((z) => {
    const code = zoneCode(z)
    return {
      value: code,
      label: `${code} — ${zoneName(z)} (${zoneHub(z) || '—'})`,
    }
  })

  const cardHead = { background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }
  const cardStyle = { borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: 16 }
  const formItemProps = { style: { marginBottom: 0 } }

  return (
    <div className="cn-entry" style={{ width: '100%', maxWidth: '100%', margin: 0, paddingBottom: 48 }}>
      <style>{`
        .cn-entry .ant-form-item-label > label {
          color: ${LABEL} !important;
          font-weight: 600 !important;
          font-size: 13px !important;
        }
        .cn-entry .ant-select-selection-item,
        .cn-entry .ant-picker-input > input {
          font-size: 13px;
        }
        .cn-entry .ant-radio-button-wrapper {
          white-space: normal;
          height: auto;
          line-height: 1.3;
          padding: 8px 12px;
        }
      `}</style>
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb
          items={[
            { title: <Link to="/ops/dashboard">Operations</Link> },
            { title: <Link to="/ops/consignments">Consignments</Link> },
            { title: isExisting && form.cn_no ? `Edit ${form.cn_no}` : dropMode ? 'Drop point booking' : 'New booking' },
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
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ops/consignments')}>
              Back
            </Button>
            <div>
              <Title level={4} style={{ margin: 0, color: '#0F172A' }}>
                {isExisting && form.cn_no
                  ? `Edit ${form.cn_no}`
                  : dropMode
                    ? 'Drop point counter booking'
                    : 'New consignment'}
              </Title>
              <Text style={{ fontSize: 13.5, color: MUTED }}>
                {dropMode
                  ? 'Origin is drop-at-counter. Optional partner AWB links 3PL consignments for dual tracking.'
                  : 'Fill the steps below. Delivery points set hubs automatically.'}
              </Text>
            </div>
          </Space>
          <Space>
            {String(form.cn_no || '').trim() ? (
              <Button
                icon={<PrinterOutlined />}
                onClick={() =>
                  navigate(
                    `/ops/reports/cn?id=${encodeURIComponent(String(form.cn_no).trim().toUpperCase())}&format=a5`,
                  )
                }
              >
                Print note
              </Button>
            ) : null}
            <Button onClick={startNew}>New CN</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={onSave}
              style={{ background: BRAND, borderColor: BRAND }}
            >
              Save consignment
            </Button>
          </Space>
        </div>
      </div>

      <Row gutter={20} align="top">
        {/* ─── Main form column ─── */}
        <Col xs={24} lg={16}>
          {/* Step 1: Basics */}
          <Card
            size="small"
            title={<Text strong>1 · Basics</Text>}
            extra={<Text style={{ fontSize: 12.5, color: MUTED }}>CN, customer, service, parcel</Text>}
            style={cardStyle}
            headStyle={cardHead}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={14}>
                <Form.Item label="Consignment number" required {...formItemProps}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      value={form.cn_no}
                      maxLength={20}
                      placeholder="Generate or type CN number"
                      style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                      onChange={(e) => {
                        setIsExisting(false)
                        set('cn_no', e.target.value.toUpperCase())
                      }}
                    />
                    <Button loading={generating} onClick={generateCn}>
                      Generate
                    </Button>
                    <Button
                      loading={loading}
                      disabled={!String(form.cn_no || '').trim()}
                      onClick={() => loadCn(form.cn_no)}
                    >
                      Load
                    </Button>
                  </Space.Compact>
                </Form.Item>
                <FieldHint>Generate for a new CN, or type an existing number and Load to edit.</FieldHint>
              </Col>
              <Col xs={24} xl={10}>
                <Form.Item label="Customer account" required {...formItemProps}>
                  <CustomerPicker
                    value={form.cust_ac_no}
                    onSelect={(c) => {
                      setForm((f) => ({
                        ...f,
                        cust_ac_no: String(c.cust_ac_no || '').toUpperCase(),
                        consigner: c.cust_name || f.consigner,
                      }))
                    }}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Form.Item label="Service type" {...formItemProps}>
                  <Select
                    value={form.srv_typ}
                    onChange={(v) => set('srv_typ', v)}
                    options={serviceTypeOptions.map((s) => ({
                      value: s.code,
                      label: s.cd_desc || s.label || s.code,
                    }))}
                    optionLabelProp="label"
                    popupMatchSelectWidth={false}
                    dropdownStyle={{ minWidth: 220 }}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Form.Item label="Package type" {...formItemProps}>
                  <Select
                    value={form.pkg_typ}
                    onChange={(v) => set('pkg_typ', v)}
                    options={[
                      { value: 'P', label: 'Parcel' },
                      { value: 'D', label: 'Document' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Form.Item label="Payment" {...formItemProps}>
                  <Checkbox
                    checked={form.pay_mode === 'COD'}
                    onChange={(e) => {
                      const on = e.target.checked
                      setForm((f) => ({
                        ...f,
                        pay_mode: on ? 'COD' : 'PPD',
                        cash_amt: '',
                      }))
                      if (!on) setCodInfo(null)
                    }}
                  >
                    Cash on Delivery (COD)
                  </Checkbox>
                  <FieldHint>
                    {form.pay_mode === 'COD'
                      ? `Receiver pays delivery fee + RM ${Number(codFeeRm).toFixed(2)} COD fee at delivery.`
                      : 'Unchecked = prepaid / account — shipper pays freight up front.'}
                  </FieldHint>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Form.Item label="Pickup date" {...formItemProps}>
                  <DatePicker
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD"
                    allowClear={false}
                    value={form.pu_dt ? dayjs(form.pu_dt) : null}
                    onChange={(d) => set('pu_dt', d ? d.format('YYYY-MM-DD') : '')}
                  />
                </Form.Item>
              </Col>

              {form.pay_mode === 'COD' && quote?.total != null ? (
                <Col xs={24} sm={12} lg={8}>
                  <Form.Item label="Receiver pays (auto)" {...formItemProps}>
                    <div style={{ fontWeight: 700, color: '#92400E', fontSize: 16 }}>
                      {money(Number(quote.total) + Number(codFeeRm))}
                    </div>
                    <FieldHint>
                      Delivery {money(quote.total)} + COD fee {money(codFeeRm)}
                    </FieldHint>
                  </Form.Item>
                </Col>
              ) : null}

              <Col xs={24} sm={8} md={6}>
                <Form.Item label="Transport mode" {...formItemProps}>
                  <Select
                    value={form.transport_mode || 'road'}
                    onChange={(mode) => {
                      setForm((f) => ({
                        ...f,
                        transport_mode: mode,
                        linehaul_mode: mode === 'multi' ? f.linehaul_mode || 'sea' : '',
                        ...(mode !== 'sea' && !(mode === 'multi' && (f.linehaul_mode || 'sea') === 'sea')
                          ? {
                              vessel_name: '',
                              voyage_ref: '',
                              sailing_date: '',
                              port_origin: '',
                              port_destination: '',
                            }
                          : {}),
                      }))
                    }}
                    options={transportModes.map((m) => ({
                      value: String(m.code || '').toLowerCase(),
                      label: m.label || m.cd_desc || m.code,
                    }))}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              {form.transport_mode === 'multi' ? (
                <Col xs={24} sm={8} md={6}>
                  <Form.Item label="Linehaul mode" {...formItemProps}>
                    <Select
                      value={form.linehaul_mode || 'sea'}
                      onChange={(v) => set('linehaul_mode', v)}
                      options={[
                        { value: 'road', label: 'Road / Land' },
                        { value: 'sea', label: 'Sea / Ferry' },
                        { value: 'air', label: 'Air' },
                      ]}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              ) : null}
              {showSeaFields ? (
                <>
                  <Col xs={24} sm={8} md={6}>
                    <Form.Item label="Vessel" {...formItemProps}>
                      <Input value={form.vessel_name || ''} onChange={(e) => set('vessel_name', e.target.value)} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8} md={6}>
                    <Form.Item label="Voyage ref" {...formItemProps}>
                      <Input value={form.voyage_ref || ''} onChange={(e) => set('voyage_ref', e.target.value)} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8} md={6}>
                    <Form.Item label="Sailing date" {...formItemProps}>
                      <DatePicker
                        style={{ width: '100%' }}
                        format="YYYY-MM-DD"
                        value={form.sailing_date ? dayjs(form.sailing_date) : null}
                        onChange={(d) => set('sailing_date', d ? d.format('YYYY-MM-DD') : '')}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8} md={6}>
                    <Form.Item label="Port origin" {...formItemProps}>
                      <Input value={form.port_origin || ''} onChange={(e) => set('port_origin', e.target.value)} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8} md={6}>
                    <Form.Item label="Port destination" {...formItemProps}>
                      <Input
                        value={form.port_destination || ''}
                        onChange={(e) => set('port_destination', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                </>
              ) : null}
              <Col xs={24} sm={8} md={6}>
                <Form.Item label="Special handling" {...formItemProps}>
                  <Select
                    value={form.spec_handle}
                    onChange={(v) => set('spec_handle', v)}
                    options={[
                      { value: 'N', label: 'No' },
                      { value: 'Y', label: 'Yes' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              {form.spec_handle === 'Y' ? (
                <>
                  <Col xs={24} sm={8} md={6}>
                    <Form.Item label="Handling code" {...formItemProps}>
                      <Input
                        maxLength={10}
                        value={form.spec_cd}
                        onChange={(e) => set('spec_cd', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8} md={6}>
                    <Form.Item label="Handling amount (RM)" {...formItemProps}>
                      <InputNumber
                        min={0}
                        step={0.01}
                        precision={2}
                        style={{ width: '100%' }}
                        value={form.spec_amt === '' ? null : Number(form.spec_amt)}
                        onChange={(v) => set('spec_amt', v == null ? '' : String(v))}
                      />
                    </Form.Item>
                  </Col>
                </>
              ) : null}
            </Row>
          </Card>

          <Card
            size="small"
            title={<Text strong>1a · Partner / 3PL consignment (optional)</Text>}
            extra={
              <Text style={{ fontSize: 12.5, color: MUTED }}>
                Track by partner AWB; barcode stays IPOSB CN
              </Text>
            }
            style={cardStyle}
            headStyle={cardHead}
          >
            <Row gutter={[16, 12]}>
              <Col xs={24} md={8}>
                <Form.Item label="Partner code" style={{ marginBottom: 0 }}>
                  <Select
                    showSearch
                    allowClear
                    placeholder="e.g. JNT"
                    value={form.partner_code || undefined}
                    optionFilterProp="label"
                    options={[
                      ...partners3pl.map((p) => ({
                        value: String(p.partner_code || p.code || '').toUpperCase(),
                        label: `${String(p.partner_code || p.code || '').toUpperCase()} — ${p.partner_name || p.name || ''}`,
                      })),
                    ].filter((o) => o.value)}
                    onChange={(v) => set('partner_code', v ? String(v).toUpperCase() : '')}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <Divider style={{ margin: '8px 0' }} />
                        <Input
                          placeholder="Or type a code"
                          maxLength={20}
                          value={form.partner_code}
                          onChange={(e) => set('partner_code', e.target.value.toUpperCase())}
                          style={{ margin: '0 8px 8px', width: 'calc(100% - 16px)' }}
                        />
                      </>
                    )}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={16}>
                <Form.Item label="Partner CN / AWB" style={{ marginBottom: 0 }}>
                  <Input
                    value={form.partner_cn_no}
                    maxLength={40}
                    placeholder="Third-party consignment number"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                    onChange={(e) => set('partner_cn_no', e.target.value.toUpperCase())}
                  />
                </Form.Item>
                <FieldHint>
                  Unique per partner. Leave both blank for IPOSB-only. Tracking accepts either number.
                </FieldHint>
              </Col>
            </Row>
          </Card>

          <Card
            size="small"
            title={<Text strong>1b · Piece dimensions (cm / kg)</Text>}
            extra={
              <Space size={8}>
                <Text style={{ fontSize: 12, color: MUTED }}>
                  Divisor {dimSummary.divisor} · chargeable = max(actual, volumetric)
                </Text>
                <Button size="small" icon={<PlusOutlined />} onClick={addPiece}>
                  Add piece
                </Button>
              </Space>
            }
            style={cardStyle}
            headStyle={cardHead}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: MUTED, borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '6px 4px', width: 36 }}>#</th>
                    <th style={{ padding: '6px 4px' }}>L (cm)</th>
                    <th style={{ padding: '6px 4px' }}>W (cm)</th>
                    <th style={{ padding: '6px 4px' }}>H (cm)</th>
                    <th style={{ padding: '6px 4px' }}>Wt (kg)</th>
                    <th style={{ padding: '6px 4px', width: 64 }}>Qty</th>
                    <th style={{ padding: '6px 4px' }}>Vol kg</th>
                    <th style={{ padding: '6px 4px' }}>CBM</th>
                    <th style={{ padding: '6px 4px' }}>Desc</th>
                    <th style={{ padding: '6px 4px', width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {(form.pieces || [emptyPiece()]).map((p, idx) => {
                    const row = dimSummary.rows[idx] || {}
                    return (
                      <tr key={`piece-${idx}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 4px', color: MUTED }}>{idx + 1}</td>
                        <td style={{ padding: '4px' }}>
                          <InputNumber min={0} step={0.1} style={{ width: '100%' }} value={p.lengthCm === '' ? null : Number(p.lengthCm)} onChange={(v) => setPiece(idx, { lengthCm: v == null ? '' : String(v) })} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <InputNumber min={0} step={0.1} style={{ width: '100%' }} value={p.widthCm === '' ? null : Number(p.widthCm)} onChange={(v) => setPiece(idx, { widthCm: v == null ? '' : String(v) })} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <InputNumber min={0} step={0.1} style={{ width: '100%' }} value={p.heightCm === '' ? null : Number(p.heightCm)} onChange={(v) => setPiece(idx, { heightCm: v == null ? '' : String(v) })} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <InputNumber min={0} step={0.1} style={{ width: '100%' }} value={p.weight === '' ? null : Number(p.weight)} onChange={(v) => setPiece(idx, { weight: v == null ? '' : String(v) })} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <InputNumber min={1} precision={0} style={{ width: '100%' }} value={Number(p.qty) || 1} onChange={(v) => setPiece(idx, { qty: v || 1 })} />
                        </td>
                        <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{row.volWeight != null ? row.volWeight.toFixed(3) : '—'}</td>
                        <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{row.cbm != null ? row.cbm.toFixed(4) : '—'}</td>
                        <td style={{ padding: '4px' }}>
                          <Input value={p.itemDesc || ''} onChange={(e) => setPiece(idx, { itemDesc: e.target.value })} placeholder="Optional" />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <Button type="text" danger icon={<DeleteOutlined />} disabled={(form.pieces || []).length <= 1} onClick={() => removePiece(idx)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Row gutter={[16, 8]} style={{ marginTop: 12 }}>
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>Actual kg</Text>
                <div style={{ fontWeight: 700 }}>{dimSummary.actualWt.toFixed(3)}</div>
              </Col>
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>Volumetric kg</Text>
                <div style={{ fontWeight: 700 }}>{dimSummary.volWt.toFixed(3)}</div>
              </Col>
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>Chargeable kg (billed)</Text>
                <div style={{ fontWeight: 800, color: BRAND }}>{chargeableWt > 0 ? chargeableWt.toFixed(3) : '—'}</div>
              </Col>
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>Total CBM</Text>
                <div style={{ fontWeight: 700 }}>{dimSummary.cbm.toFixed(4)} m³</div>
              </Col>
            </Row>
            <div style={{ marginTop: 8 }}>
              <FieldHint>
                Delivery fee uses chargeable weight. Pieces = {dimSummary.pcs || form.cn_pcs || 1}.
                Or enter a single total weight below if you skip dimensions.
              </FieldHint>
            </div>
            <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
              <Col xs={12} sm={8}>
                <Form.Item label="Fallback weight (kg)" {...formItemProps}>
                  <InputNumber
                    min={0.1}
                    step={0.1}
                    style={{ width: '100%' }}
                    disabled={dimSummary.pcs > 0}
                    value={form.cn_wt === '' ? null : Number(form.cn_wt)}
                    onChange={(v) => set('cn_wt', v == null ? '' : String(v))}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8}>
                <Form.Item label="Fallback pieces" {...formItemProps}>
                  <InputNumber
                    min={1}
                    precision={0}
                    style={{ width: '100%' }}
                    disabled={dimSummary.pcs > 0}
                    value={form.cn_pcs === '' ? null : Number(form.cn_pcs)}
                    onChange={(v) => set('cn_pcs', v == null ? '1' : String(v))}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Step 2: Route */}
          <Card
            size="small"
            title={<Text strong>2 · Route</Text>}
            extra={<Text style={{ fontSize: 12.5, color: MUTED }}>Pick delivery points — hubs fill in</Text>}
            style={cardStyle}
            headStyle={cardHead}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Form.Item label="Origin delivery point" required style={{ marginBottom: 4 }}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Search origin delivery point…"
                    value={form.origin_zone || undefined}
                    options={zoneSelectOptions}
                    onChange={pickOriginDp}
                    popupMatchSelectWidth={false}
                    dropdownStyle={{ minWidth: 320 }}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <FieldHint>
                  Hub: <Text strong style={{ color: LABEL }}>{form.cn_origin || '—'}</Text>
                </FieldHint>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Destination delivery point" required style={{ marginBottom: 4 }}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Search destination delivery point…"
                    value={form.destination_zone || undefined}
                    options={zoneSelectOptions}
                    onChange={pickDestDp}
                    popupMatchSelectWidth={false}
                    dropdownStyle={{ minWidth: 320 }}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <FieldHint>
                  Hub: <Text strong style={{ color: LABEL }}>{form.cn_dstn || '—'}</Text>
                </FieldHint>
              </Col>
              <Col span={24}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    background: '#F8FAFC',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                    flexWrap: 'wrap',
                    minHeight: 44,
                  }}
                >
                  <EnvironmentOutlined style={{ color: BRAND, fontSize: 16 }} />
                  {form.origin_zone || form.destination_zone ? (
                    <>
                      <Text strong style={{ color: LABEL }}>{originLabel}</Text>
                      <Text style={{ color: MUTED }}>→</Text>
                      <Text strong style={{ color: LABEL }}>{destLabel}</Text>
                    </>
                  ) : (
                    <Text style={{ color: MUTED }}>
                      Select origin and destination delivery points to preview the route.
                    </Text>
                  )}
                </div>
              </Col>
            </Row>
          </Card>

          {/* Step 3: First mile */}
          <Card
            size="small"
            title={<Text strong>3 · First mile</Text>}
            extra={<Text style={{ fontSize: 12.5, color: MUTED }}>How the parcel enters the network</Text>}
            style={cardStyle}
            headStyle={cardHead}
          >
            <Form.Item style={{ marginBottom: 16 }}>
              <Radio.Group
                buttonStyle="solid"
                value={form.origin_service || 'DROP_COUNTER'}
                onChange={(e) => {
                  const mode = e.target.value
                  setForm((f) => ({
                    ...f,
                    origin_service: mode,
                    origin_drop_point_id: mode === 'DROP_COUNTER' ? f.origin_drop_point_id : '',
                    sender_address: mode === 'ADDRESS_PICKUP' ? f.sender_address : '',
                  }))
                }}
                style={{ width: '100%', display: 'flex' }}
              >
                {originServices.map((s) => (
                  <Radio.Button key={s.code} value={s.code} style={{ flex: 1, textAlign: 'center' }}>
                    {s.label || s.code}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </Form.Item>
            <Row gutter={[16, 12]}>
              {form.origin_service === 'DROP_COUNTER' ? (
                <Col xs={24} md={16}>
                  <Form.Item label="Drop point" style={{ marginBottom: 4 }}>
                    <Select
                      showSearch
                      allowClear
                      optionFilterProp="label"
                      placeholder="Search drop counter…"
                      value={form.origin_drop_point_id ? String(form.origin_drop_point_id) : undefined}
                      options={pickupDrops.map((d) => ({
                        value: String(d.id),
                        label: `${d.drop_code} — ${d.drop_name}${d.delivery_point_code ? ` · ${d.delivery_point_code}` : ''}`,
                      }))}
                      onChange={(id) => (id ? pickOriginDrop(id) : set('origin_drop_point_id', ''))}
                      popupMatchSelectWidth={false}
                      dropdownStyle={{ minWidth: 280 }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <FieldHint>Choosing a drop point also sets the origin delivery point.</FieldHint>
                </Col>
              ) : (
                <Col span={24}>
                  <Form.Item label="Pickup address" required style={{ marginBottom: 0 }}>
                    <Input.TextArea
                      rows={2}
                      value={form.sender_address || ''}
                      onChange={(e) => set('sender_address', e.target.value)}
                      placeholder="Full sender address for collection"
                    />
                  </Form.Item>
                </Col>
              )}
              <Col xs={24} md={12}>
                <Form.Item label="Sender / consigner" style={{ marginBottom: 0 }}>
                  <Input
                    value={form.consigner}
                    onChange={(e) => set('consigner', e.target.value)}
                    placeholder="Sender name"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Sender phone" style={{ marginBottom: 0 }}>
                  <Input
                    value={form.sender_phone}
                    onChange={(e) => set('sender_phone', e.target.value)}
                    placeholder="Optional contact number"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Step 4: Last mile */}
          <Card
            size="small"
            title={<Text strong>4 · Last mile</Text>}
            extra={<Text style={{ fontSize: 12.5, color: MUTED }}>How the receiver gets the parcel</Text>}
            style={cardStyle}
            headStyle={cardHead}
          >
            <Form.Item style={{ marginBottom: 16 }}>
              <Radio.Group
                buttonStyle="solid"
                value={form.destination_service || 'DOORSTEP'}
                onChange={(e) => {
                  const mode = e.target.value
                  setForm((f) => ({
                    ...f,
                    destination_service: mode,
                    destination_drop_point_id: mode === 'SELF_COLLECT' ? f.destination_drop_point_id : '',
                    destination_area_code: mode === 'DOORSTEP' ? f.destination_area_code : '',
                    remarks: mode === 'DOORSTEP' ? f.remarks : '',
                  }))
                }}
                style={{ width: '100%', display: 'flex' }}
              >
                {destinationServices.map((s) => (
                  <Radio.Button key={s.code} value={s.code} style={{ flex: 1, textAlign: 'center' }}>
                    {s.label || s.code}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </Form.Item>
            <Row gutter={[16, 12]}>
              <Col xs={24} md={12}>
                <Form.Item label="Receiver / consignee" style={{ marginBottom: 0 }}>
                  <Input
                    value={form.consignee}
                    onChange={(e) => {
                      const v = e.target.value
                      setForm((f) => ({ ...f, consignee: v, recp_name: v }))
                    }}
                    placeholder="Receiver name"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Receiver phone" style={{ marginBottom: 0 }}>
                  <Input
                    value={form.receiver_phone}
                    onChange={(e) => set('receiver_phone', e.target.value)}
                    placeholder="Optional contact number"
                  />
                </Form.Item>
              </Col>
              {form.destination_service === 'SELF_COLLECT' ? (
                <Col xs={24} md={12}>
                  <Form.Item label="Self-collect drop point" style={{ marginBottom: 0 }}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Search self-collect drop…"
                      value={form.destination_drop_point_id ? String(form.destination_drop_point_id) : undefined}
                      options={deliveryDrops.map((d) => ({
                        value: String(d.id),
                        label: `${d.drop_code} — ${d.drop_name}`,
                      }))}
                      onChange={(id) => set('destination_drop_point_id', id || '')}
                      popupMatchSelectWidth={false}
                      dropdownStyle={{ minWidth: 280 }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              ) : (
                <>
                  <Col xs={24} md={12}>
                    <Form.Item label="Destination area" style={{ marginBottom: 4 }}>
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        placeholder="Search area (or leave blank)"
                        value={form.destination_area_code || undefined}
                        options={destAreas.map((a) => ({
                          value: a.area_code,
                          label: `${a.area_code} — ${a.area_name}`,
                        }))}
                        onChange={(code) => set('destination_area_code', code || '')}
                        popupMatchSelectWidth={false}
                        dropdownStyle={{ minWidth: 280 }}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <FieldHint>Optional — assigns the area’s dispatcher for delivery.</FieldHint>
                  </Col>
                  <Col span={24}>
                    <Form.Item label="Delivery address" required style={{ marginBottom: 0 }}>
                      <Input.TextArea
                        rows={2}
                        value={form.remarks || ''}
                        onChange={(e) => set('remarks', e.target.value)}
                        placeholder="Full receiver address (used to match area keywords if area is blank)"
                      />
                    </Form.Item>
                  </Col>
                </>
              )}
            </Row>
          </Card>

          {savedFreight?.total != null && Number(savedFreight.total) > 0 ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={
                <span>
                  Saved freight: <strong>{money(savedFreight.total)}</strong>
                  {savedFreight.invNo ? ` · Invoice ${savedFreight.invNo}` : ''}
                </span>
              }
            />
          ) : null}

          {form.pay_mode === 'COD' && codInfo ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={
                <span>
                  COD {codInfo.status || 'PENDING'}: expected {money(codInfo.expectedAmt)}{' '}
                  <Link to={`/ops/cod?cn=${encodeURIComponent(form.cn_no)}`}>Open COD</Link>
                </span>
              }
            />
          ) : null}
        </Col>

        {/* ─── Sticky quote sidebar ─── */}
        <Col xs={24} lg={8}>
          <div style={{ position: 'sticky', top: 16 }}>
            <Card
              size="small"
              title={<Text strong style={{ color: BRAND }}>Live quote</Text>}
              extra={quoting ? <Spin size="small" /> : null}
              style={{
                borderRadius: 8,
                border: `1px solid ${BRAND}33`,
                boxShadow: '0 2px 12px rgba(27, 138, 90, 0.08)',
              }}
              headStyle={{ background: '#F0FDF4', borderBottom: '1px solid #BBF7D0' }}
            >
              {quote ? (
                <>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {quote.source === 'delivery_fee' ? 'Delivery fee' : 'Freight'}
                    {quote.rateLabel ? ` · ${quote.rateLabel}` : ''}
                  </Text>
                  <div style={{ fontSize: 28, fontWeight: 800, color: BRAND, margin: '8px 0 4px' }}>
                    {money(quote.total)}
                  </div>
                  {form.pay_mode === 'COD' ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Receiver pays {money(Number(quote.total || 0) + Number(codFeeRm))}
                      {' '}(delivery + RM {Number(codFeeRm).toFixed(2)} COD fee)
                    </Text>
                  ) : null}
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Route</span>
                      <Text strong>
                        {form.cn_origin || '—'} → {form.cn_dstn || '—'}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Weight</span>
                      <Text strong>
                        {chargeableWt > 0 ? `${chargeableWt.toFixed(3)} kg` : '—'}
                        {' · '}
                        {dimSummary.pcs || form.cn_pcs || 1} pcs
                        {dimSummary.cbm > 0 ? ` · ${dimSummary.cbm.toFixed(4)} m³` : ''}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Mode</span>
                      <Text strong>{(form.transport_mode || 'road').toUpperCase()}</Text>
                    </div>
                  </div>
                </>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {canQuote
                    ? quoting
                      ? 'Calculating quote…'
                      : 'No quote returned — check rate tables.'
                    : 'Enter customer, hubs/DPs, and weight for a quote'}
                </Text>
              )}

              <Divider style={{ margin: '16px 0 12px' }} />
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Button
                  type="primary"
                  block
                  size="large"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={onSave}
                  style={{ background: BRAND, borderColor: BRAND }}
                >
                  Save consignment
                </Button>
                <Button
                  block
                  icon={<PrinterOutlined />}
                  disabled={!String(form.cn_no || '').trim()}
                  onClick={() =>
                    navigate(
                      `/ops/reports/cn?id=${encodeURIComponent(String(form.cn_no).trim().toUpperCase())}&format=a5`,
                    )
                  }
                >
                  Print consignment note
                </Button>
                <Button block icon={<ReloadOutlined />} onClick={startNew}>
                  Clear / New CN
                </Button>
                <Button block onClick={() => navigate('/ops/consignments')}>
                  Cancel
                </Button>
              </Space>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  )
}
