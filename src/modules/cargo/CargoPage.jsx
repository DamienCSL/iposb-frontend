import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { ReloadOutlined, ScanOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { apiError, cargoScan, listCargoHandovers } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'

const { Title, Text } = Typography

function money(v) {
  return `RM ${Number(v || 0).toFixed(2)}`
}

function StageTag({ stage }) {
  return stage === 'origin'
    ? <Tag color="blue">Lodged at airport / port</Tag>
    : <Tag color="green">Collected from airport / port</Tag>
}

export default function CargoPage() {
  const { user } = useAuth()
  const isCargo = user?.role === 'Cargo Team'
  const inputRef = useRef(null)
  const [barcode, setBarcode] = useState('')
  const [remarks, setRemarks] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState(null)
  const [rows, setRows] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('')
  const [range, setRange] = useState(null)
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await listCargoHandovers({
        stage: stage || undefined,
        from: range?.[0]?.format('YYYY-MM-DD'),
        to: range?.[1]?.format('YYYY-MM-DD'),
        q: q || undefined,
        limit: 200,
      })
      setRows(res?.items || [])
      setMe(res?.me || null)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, range])

  async function onScan() {
    const code = barcode.trim().toUpperCase()
    if (!code) return
    setScanning(true)
    try {
      const res = await cargoScan({ barcode: code, remarks: remarks || undefined })
      setLastScan(res)
      setBarcode('')
      if (res?.doneCount) {
        message.success(`${code}: ${res.doneCount} consignment(s) ${res.stageLabel ? `— ${res.stageLabel.toLowerCase()}` : 'recorded'}`)
      } else {
        message.warning(`${code}: nothing recorded`)
      }
      load()
    } catch (err) {
      setLastScan({ error: apiError(err), key: code })
      message.error(apiError(err))
    } finally {
      setScanning(false)
      inputRef.current?.focus()
    }
  }

  const columns = [
    { title: 'Scanned', dataIndex: 'scannedAt', width: 160 },
    {
      title: 'Consignment',
      dataIndex: 'cnNo',
      render: (cn) => <Link to={`/ops/consignments/${encodeURIComponent(cn)}`}>{cn}</Link>,
    },
    { title: 'Handover', dataIndex: 'stage', render: (s) => <StageTag stage={s} /> },
    { title: 'Mode', dataIndex: 'transportMode', width: 80, render: (m) => String(m || '').toUpperCase() },
    { title: 'Scanned code', dataIndex: 'scannedCode' },
    ...(isCargo ? [] : [{ title: 'Cargo staff', dataIndex: 'username' }]),
    {
      title: 'Commission',
      dataIndex: 'commission',
      render: (c) => (c ? <span>{money(c.amount)} <Text type="secondary" style={{ fontSize: 12 }}>{c.status}</Text></span> : <Text type="secondary">—</Text>),
    },
    { title: 'Remarks', dataIndex: 'remarks' },
  ]

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>Airport / Port Cargo</Title>
      <Text type="secondary">
        Air and sea consignments only. Scan a manifest, bag or CN — the system decides per consignment whether it is
        being <strong>lodged</strong> at the origin airport / port or <strong>collected</strong> at the destination.
      </Text>

      {isCargo ? (
        <Card size="small" style={{ marginTop: 16 }}>
          <Space.Compact style={{ width: '100%', maxWidth: 640 }}>
            <Input
              ref={inputRef}
              autoFocus
              size="large"
              prefix={<ScanOutlined />}
              placeholder="Scan or type manifest / bag / CN"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onPressEnter={onScan}
              disabled={scanning}
            />
            <Button size="large" type="primary" loading={scanning} onClick={onScan}>Record</Button>
          </Space.Compact>
          <Input
            style={{ marginTop: 8, maxWidth: 640 }}
            placeholder="Remarks (optional, e.g. flight / vessel no.)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          {lastScan?.error ? (
            <Alert style={{ marginTop: 12 }} type="error" showIcon message={`${lastScan.key}: ${lastScan.error}`} />
          ) : lastScan ? (
            <Alert
              style={{ marginTop: 12 }}
              type={lastScan.failed?.length ? 'warning' : 'success'}
              showIcon
              message={`${lastScan.key} (${lastScan.type}): ${lastScan.doneCount} recorded${lastScan.failed?.length ? `, ${lastScan.failed.length} skipped` : ''}`}
              description={lastScan.failed?.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {lastScan.failed.slice(0, 10).map((f) => <li key={f.cnNo}>{f.cnNo}: {f.error}</li>)}
                  {lastScan.failed.length > 10 ? <li>…and {lastScan.failed.length - 10} more</li> : null}
                </ul>
              ) : null}
            />
          ) : null}
        </Card>
      ) : (
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message="Only Cargo Team accounts can record handovers. You are viewing all cargo handovers."
        />
      )}

      {me ? (
        <Row gutter={12} style={{ marginTop: 16 }}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Lodged today" value={me.lodgedToday} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Collected today" value={me.collectedToday} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Pending commission" value={money(me.pendingBalance)} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Wallet balance" value={money(me.balance)} /></Card></Col>
        </Row>
      ) : null}

      <Card size="small" style={{ marginTop: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            style={{ width: 220 }}
            value={stage}
            onChange={setStage}
            options={[
              { value: '', label: 'All handovers' },
              { value: 'origin', label: 'Lodged (origin)' },
              { value: 'destination', label: 'Collected (destination)' },
            ]}
          />
          <DatePicker.RangePicker value={range} onChange={setRange} />
          <Input.Search
            allowClear
            placeholder="CN / code / staff"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onSearch={load}
            style={{ width: 240 }}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </Space>
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 50 }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  )
}
