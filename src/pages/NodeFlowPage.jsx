import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  InboxOutlined,
  ReloadOutlined,
  ScanOutlined,
  SendOutlined,
} from '@ant-design/icons'
import {
  apiError,
  getDispatchDrivers,
  getNodeFlow,
  getNodeFlowMeta,
  listMaster,
  scanNodeFlow,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import DataTable from '../components/DataTable'
import StatusTag from '../components/StatusTag'

const { Title, Text, Paragraph } = Typography

export default function NodeFlowPage() {
  const { user, can, isAdmin } = useAuth()
  const scanRef = useRef(null)

  const [meta, setMeta] = useState(null)
  const [node, setNode] = useState('')
  const [direction, setDirection] = useState('inbound')
  const [hub, setHub] = useState('')
  const [dp, setDp] = useState('')
  const [hubs, setHubs] = useState([])
  const [dps, setDps] = useState([])
  const [drivers, setDrivers] = useState([])
  const [driverId, setDriverId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [payload, setPayload] = useState(null)
  const [barcode, setBarcode] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [confirmed, setConfirmed] = useState(() => new Set())

  const nodeLocked = Boolean(meta?.nodeLocked)
  const needsCourier = Boolean(payload?.needsCourier)

  const loadMeta = useCallback(async () => {
    try {
      const m = await getNodeFlowMeta()
      setMeta(m)
      setNode((prev) => prev || m.defaultNode || 'hub')
    } catch (err) {
      message.error(apiError(err))
    }
  }, [])

  const loadLookups = useCallback(async () => {
    if (!isAdmin && !can('admin') && user?.role !== 'Operation') return
    try {
      const [hubRes, dpRes, drvRes] = await Promise.all([
        listMaster('hubs').catch(() => ({ rows: [] })),
        listMaster('delivery-points').catch(() => ({ rows: [] })),
        getDispatchDrivers().catch(() => []),
      ])
      setHubs(hubRes?.rows || hubRes?.data || [])
      setDps(dpRes?.rows || dpRes?.data || [])
      setDrivers(Array.isArray(drvRes) ? drvRes : drvRes?.drivers || [])
    } catch {
      /* ignore */
    }
  }, [can, isAdmin, user?.role])

  const loadFlow = useCallback(async () => {
    if (!node) return
    setLoading(true)
    try {
      const data = await getNodeFlow({
        node,
        direction,
        hub: hub || undefined,
        dp: dp || undefined,
      })
      setPayload(data)
      if (data?.needsCourier && drivers.length === 0) {
        const drvRes = await getDispatchDrivers().catch(() => [])
        setDrivers(Array.isArray(drvRes) ? drvRes : drvRes?.drivers || [])
      }
    } catch (err) {
      setPayload(null)
      message.error(apiError(err))
    } finally {
      setLoading(false)
      queueMicrotask(() => scanRef.current?.focus())
    }
  }, [node, direction, hub, dp, drivers.length])

  useEffect(() => {
    loadMeta()
    loadLookups()
  }, [loadMeta, loadLookups])

  useEffect(() => {
    loadFlow()
    setConfirmed(new Set())
    setLastResult(null)
  }, [loadFlow])

  const items = payload?.items || []
  const unitKey = (r) =>
    String(r?.sealNo || r?.mfgNo || r?.cnNo || '')
      .trim()
      .toUpperCase()
  const pendingCount = items.filter((r) => !confirmed.has(unitKey(r))).length

  async function onScanSubmit(e) {
    e?.preventDefault?.()
    const code = barcode.trim().toUpperCase()
    if (!code) return
    if (needsCourier && !driverId) {
      message.warning('Select the courier taking these parcels out before scanning')
      return
    }
    setScanning(true)
    setBarcode('')
    try {
      const res = await scanNodeFlow({
        node,
        direction,
        barcode: code,
        driverId: needsCourier ? driverId : undefined,
        hub: hub || undefined,
        dp: dp || undefined,
      })
      setLastResult(res)
      const next = new Set(confirmed)
      for (const d of res?.done || []) {
        const key = String(d.sealNo || d.mfgNo || d.cnNo || '')
          .trim()
          .toUpperCase()
        if (key) next.add(key)
      }
      setConfirmed(next)
      if ((res?.doneCount || 0) > 0) {
        message.success(res.message || `Confirmed ${res.doneCount}`)
        await loadFlow()
      } else if (res?.failed?.length) {
        message.error(res.failed[0]?.error || 'Scan failed')
      }
    } catch (err) {
      setLastResult({ failed: [{ barcode: code, error: apiError(err) }] })
      message.error(apiError(err))
    } finally {
      setScanning(false)
      queueMicrotask(() => scanRef.current?.focus())
    }
  }

  const columns = [
    {
      title: 'Unit',
      key: 'unit',
      width: 120,
      render: (_, r) => {
        const t = r.unitType || (r.sealNo ? 'seal' : r.mfgNo ? 'manifest' : 'loose')
        if (t === 'seal') return <Tag color="purple">Seal</Tag>
        if (t === 'manifest') return <Tag color="geekblue">Manifest</Tag>
        if (t === 'cn') return <Tag color="cyan">CN (opened)</Tag>
        return <Tag>Loose</Tag>
      },
    },
    {
      title: 'Barcode',
      key: 'cn',
      render: (_, r) => {
        const primary =
          r.unitType === 'seal'
            ? r.sealNo || r.cnNo
            : r.unitType === 'manifest'
              ? r.mfgNo || r.cnNo
              : r.cnNo
        return (
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A' }}>
              {primary || '—'}
            </div>
            {r.unitType === 'seal' ? (
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {r.cnCount ? `${r.cnCount} CN inside` : 'Sealed bag'}
                {r.sealTier ? ` · ${r.sealTier}` : ''}
                {r.sealLifecycle ? ` · ${r.sealLifecycle}` : ''}
              </div>
            ) : null}
            {r.unitType === 'manifest' ? (
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {r.cnCount ? `${r.cnCount} loose CN on manifesto` : 'Manifesto'}
              </div>
            ) : null}
            {r.unitType === 'cn' && r.sealNo ? (
              <div style={{ fontSize: 11, color: '#64748B' }}>
                From opened seal <strong>{r.sealNo}</strong>
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <StatusTag status={v} />,
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => (
        <span style={{ fontSize: 12, color: '#4B5563' }}>
          {(r.origin || '—') + ' → ' + (r.dest || '—')}
        </span>
      ),
    },
    {
      title: 'Consignee',
      dataIndex: 'consignee',
      key: 'consignee',
      render: (v, r) =>
        r.unitType === 'seal' || r.unitType === 'manifest' ? (
          <Text type="secondary">—</Text>
        ) : (
          v || '—'
        ),
    },
    {
      title: 'Expected',
      dataIndex: 'note',
      key: 'note',
      render: (v) => <span style={{ fontSize: 12, color: '#64748B' }}>{v || '—'}</span>,
    },
    {
      title: 'Confirm',
      key: 'ok',
      width: 100,
      align: 'center',
      render: (_, r) => {
        const ok = confirmed.has(unitKey(r))
        return ok ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Scanned
          </Tag>
        ) : (
          <Tag color="default">Awaiting scan</Tag>
        )
      },
    },
  ]

  const nodeOptions = (meta?.nodes || []).map((n) => ({
    value: n.id,
    label: n.label,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Inbound / Outbound Desk
          </Title>
          <Text type="secondary">
            System builds the expected list for your delivery node. Staff only confirm by scanning —
            no manual tick-off.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadFlow} loading={loading}>
          Refresh list
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        message={payload?.nodeName ? `${payload.nodeName} (${payload.nodeCode})` : 'Your delivery node'}
        description={
          payload?.scanInstructions
          || 'Scan CN or seal barcodes to confirm. Items already scanned leave the expected queue.'
        }
      />

      <Card size="small" styles={{ body: { paddingBottom: 8 } }}>
        <Space wrap style={{ width: '100%', marginBottom: 12 }}>
          <Select
            style={{ minWidth: 260 }}
            value={node || undefined}
            onChange={setNode}
            options={nodeOptions}
            disabled={nodeLocked && !isAdmin}
            placeholder="Delivery node type"
          />
          {!nodeLocked || isAdmin || user?.role === 'Operation' ? (
            <>
              {node === 'hub' ? (
                <Select
                  allowClear
                  showSearch
                  placeholder="Hub code (Admin/Ops)"
                  style={{ minWidth: 180 }}
                  value={hub || undefined}
                  onChange={(v) => setHub(v || '')}
                  options={hubs.map((h) => ({
                    value: h.hub_code,
                    label: `${h.hub_name || h.hub_code} (${h.hub_code})`,
                  }))}
                />
              ) : null}
              {node === 'station' ? (
                <Select
                  allowClear
                  showSearch
                  placeholder="Delivery point (Admin/Ops)"
                  style={{ minWidth: 200 }}
                  value={dp || undefined}
                  onChange={(v) => setDp(v || '')}
                  options={dps.map((d) => ({
                    value: d.delivery_point_code || d.zone_code,
                    label: `${d.delivery_point_name || d.zone_name || d.delivery_point_code} (${d.delivery_point_code || d.zone_code})`,
                  }))}
                />
              ) : null}
            </>
          ) : null}
        </Space>

        <Tabs
          activeKey={direction}
          onChange={setDirection}
          items={[
            {
              key: 'inbound',
              label: (
                <span>
                  <InboxOutlined /> Inbound{' '}
                  <Badge count={payload?.counts?.inbound ?? 0} style={{ backgroundColor: '#1668DC' }} />
                </span>
              ),
            },
            {
              key: 'outbound',
              label: (
                <span>
                  <SendOutlined /> Outbound{' '}
                  <Badge count={payload?.counts?.outbound ?? 0} style={{ backgroundColor: '#D97706' }} />
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Expected units" value={items.length} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Seals" value={payload?.counts?.sealed ?? 0} valueStyle={{ color: '#7C3AED' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Manifests" value={payload?.counts?.manifest ?? 0} valueStyle={{ color: '#1668DC' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Loose" value={payload?.counts?.loose ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="CN (opened)" value={payload?.counts?.cn ?? 0} valueStyle={{ color: '#0E7490' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic title="Still to scan" value={pendingCount} valueStyle={{ color: '#D97706' }} />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <ScanOutlined />
            <span>Scan to confirm {direction}</span>
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          {payload?.scanHint
            ? `Status written: ${payload.scanHint}. `
            : null}
          List shows <strong>seals</strong>, <strong>manifests</strong>, and <strong>loose parcels</strong>.
          Consignment notes appear only after a seal is <strong>opened</strong>.
        </Paragraph>

        {needsCourier ? (
          <Select
            style={{ width: '100%', maxWidth: 420, marginBottom: 12 }}
            placeholder="Courier taking parcels out"
            value={driverId || undefined}
            onChange={setDriverId}
            options={drivers.map((d) => ({
              value: Number(d.driver_id || d.driverId || d.id),
              label: `${d.full_name || d.fullName || d.name || 'Driver'} (#${d.driver_id || d.driverId || d.id})`,
            }))}
          />
        ) : null}

        <form onSubmit={onScanSubmit}>
          <Space.Compact style={{ width: '100%', maxWidth: 560 }}>
            <Input
              ref={scanRef}
              size="large"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan seal / MFG / loose CN…"
              disabled={scanning}
              autoFocus
            />
            <Button type="primary" size="large" htmlType="submit" loading={scanning} icon={<ScanOutlined />}>
              Confirm
            </Button>
          </Space.Compact>
        </form>

        {lastResult?.failed?.length ? (
          <Alert
            style={{ marginTop: 12 }}
            type="error"
            showIcon
            message="Scan rejected"
            description={lastResult.failed.map((f) => `${f.barcode}: ${f.error}`).join(' · ')}
          />
        ) : null}
        {lastResult?.doneCount > 0 ? (
          <Alert
            style={{ marginTop: 12 }}
            type="success"
            showIcon
            message={lastResult.message}
          />
        ) : null}
      </Card>

      <DataTable
        columns={columns}
        dataSource={items}
        loading={loading}
        rowKey={(r) => `${r.unitType || 'u'}:${r.sealNo || r.mfgNo || r.cnNo || ''}`}
        pagination={{ pageSize: 25 }}
        locale={{
          emptyText: loading
            ? 'Loading expected list…'
            : 'No expected consignments for this direction — list is system-built from network routing.',
        }}
        rowClassName={(r) => {
          const key = String(r.cnNo || '').toUpperCase()
          return confirmed.has(key) ? 'row-confirmed' : ''
        }}
      />

      <style>{`
        .row-confirmed td { background: #F0FDF4 !important; }
      `}</style>
    </div>
  )
}
