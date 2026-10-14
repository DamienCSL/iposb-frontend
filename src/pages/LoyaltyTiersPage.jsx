import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { CrownOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { apiError, getLoyaltyConfig, saveLoyaltyConfig } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const { Title, Text } = Typography

function blankTier(n) {
  return {
    code: '',
    name: '',
    minLifetimePoints: 0,
    monthlyPrice: 0,
    yearlyPrice: 0,
    discountPct: 0,
    pointsMultiplier: 1,
    perks: '',
    color: '#1B8A5A',
    sortOrder: n,
    isActive: true,
    isNew: true,
  }
}

export default function LoyaltyTiersPage() {
  const { isAdmin: canEdit } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [pointsPerRm, setPointsPerRm] = useState(1)
  const [earnStart, setEarnStart] = useState('')
  const [tiers, setTiers] = useState([])
  const [stats, setStats] = useState({})

  function apply(data) {
    setEnabled(Boolean(data.enabled))
    setPointsPerRm(Number(data.pointsPerRm ?? 1))
    setEarnStart(data.earnStartDate || '')
    setTiers((data.tiers || []).map((t) => ({ ...t, isNew: false })))
    setStats(data.stats || {})
  }

  async function load() {
    setLoading(true)
    try {
      apply(await getLoyaltyConfig())
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function patch(index, key, value) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [key]: value } : t)))
  }

  async function save() {
    setSaving(true)
    try {
      apply(await saveLoyaltyConfig({ enabled, pointsPerRm, tiers }))
      message.success('Loyalty settings saved')
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const num = (key, props = {}) => (v, _r, i) => (
    <InputNumber
      size="small"
      value={v}
      disabled={!canEdit}
      onChange={(val) => patch(i, key, val ?? 0)}
      style={{ width: '100%' }}
      {...props}
    />
  )

  const columns = [
    {
      title: 'Tier',
      dataIndex: 'name',
      width: 170,
      render: (v, r, i) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Input
            size="small"
            value={v}
            disabled={!canEdit}
            placeholder="Name"
            onChange={(e) => patch(i, 'name', e.target.value)}
            prefix={<CrownOutlined style={{ color: r.color || '#999' }} />}
          />
          <Input
            size="small"
            value={r.code}
            disabled={!canEdit || !r.isNew}
            placeholder="code"
            onChange={(e) => patch(i, 'code', e.target.value.toLowerCase())}
          />
        </Space>
      ),
    },
    { title: 'Lifetime iCoins to reach', dataIndex: 'minLifetimePoints', width: 130, render: num('minLifetimePoints', { min: 0, step: 100 }) },
    { title: 'Monthly (RM)', dataIndex: 'monthlyPrice', width: 110, render: num('monthlyPrice', { min: 0, step: 1, precision: 2 }) },
    { title: 'Yearly (RM)', dataIndex: 'yearlyPrice', width: 110, render: num('yearlyPrice', { min: 0, step: 10, precision: 2 }) },
    { title: 'Delivery fee discount %', dataIndex: 'discountPct', width: 120, render: num('discountPct', { min: 0, max: 100, step: 1 }) },
    { title: 'iCoin multiplier', dataIndex: 'pointsMultiplier', width: 110, render: num('pointsMultiplier', { min: 0, max: 20, step: 0.1, precision: 2 }) },
    {
      title: 'Perks shown in app (one per line)',
      dataIndex: 'perks',
      render: (v, _r, i) => (
        <Input.TextArea
          size="small"
          value={v}
          disabled={!canEdit}
          autoSize={{ minRows: 2, maxRows: 4 }}
          onChange={(e) => patch(i, 'perks', e.target.value)}
        />
      ),
    },
    {
      title: 'Colour',
      dataIndex: 'color',
      width: 80,
      render: (v, _r, i) => (
        <input type="color" value={v || '#1B8A5A'} disabled={!canEdit} onChange={(e) => patch(i, 'color', e.target.value)} />
      ),
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      width: 70,
      render: (v, _r, i) => <Switch size="small" checked={Boolean(v)} disabled={!canEdit} onChange={(c) => patch(i, 'isActive', c)} />,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>Loyalty Tiers</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Customers reach a tier by lifetime iCoins earned (redeeming never lowers it) or by paying a monthly / yearly membership
          from their wallet. The higher of the two applies.
        </Text>
      </div>

      {!canEdit ? <Alert type="info" showIcon message="Only Admin can change loyalty settings." /> : null}

      <Row gutter={12}>
        <Col xs={24} md={6}>
          <Card size="small">
            <Space direction="vertical">
              <Text strong>Program on</Text>
              <Switch checked={enabled} disabled={!canEdit} onChange={setEnabled} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>iCoins per RM1 paid</Text>
              <InputNumber min={0} max={1000} step={0.5} value={pointsPerRm} disabled={!canEdit} onChange={(v) => setPointsPerRm(v ?? 0)} />
              <Text type="secondary" style={{ fontSize: 12 }}>Awarded when a customer-app shipment is delivered, × tier multiplier.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Active memberships" value={stats.activeSubscriptions ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Customers at first tier or above" value={stats.members ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title="Tiers"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} disabled={loading}>Reload</Button>
            {canEdit ? (
              <>
                <Button icon={<PlusOutlined />} onClick={() => setTiers((p) => [...p, blankTier(p.length + 1)])}>Add tier</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save</Button>
              </>
            ) : null}
          </Space>
        }
      >
        <Table
          rowKey={(r, i) => r.code || `new-${i}`}
          size="small"
          loading={loading}
          columns={columns}
          dataSource={tiers}
          pagination={false}
          scroll={{ x: 1100 }}
        />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          Set a price to 0 to hide that subscription option. The discount is taken off the delivery fee (before SST) on bookings made
          in the customer app. {earnStart ? <>Shipments created from <Tag>{earnStart}</Tag> earn iCoins.</> : null}
        </Text>
      </Card>
    </div>
  )
}
