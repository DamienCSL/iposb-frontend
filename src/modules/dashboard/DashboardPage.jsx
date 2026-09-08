import React, { useEffect, useState } from 'react'
import { Button, Card, Col, Row, Space, Typography } from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { getOpsDashboard, listConsignments } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'

const { Title, Text } = Typography

/**
 * Full-width thin SVG sparkline strip anchored along the bottom edge of the KPI card
 */
function BottomSparkline({
  data = [12, 18, 15, 22, 28, 25, 32],
  color = '#1B8A5A',
  height = 28,
  animKey = 0,
  delay = 0,
}) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const width = 100 // viewBox coordinate width
  const padY = 3
  const effectiveH = height - padY * 2

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width
    const y = height - padY - ((val - min) / range) * effectiveH
    return { x, y }
  })

  const pathD = points.reduce(
    (acc, p, i) => (i === 0 ? `M ${p.x.toFixed(1)},${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    ''
  )
  const areaD = `${pathD} L 100,${height} L 0,${height} Z`
  const gradId = `spark-bottom-${color.replace('#', '')}-${animKey}`

  return (
    <div style={{ margin: '8px -16px -1px -16px', lineHeight: 0 }}>
      <svg
        key={animKey}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: height, display: 'block', overflow: 'hidden' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path
          d={areaD}
          fill={`url(#${gradId})`}
          className="sparkline-area-animated"
          style={{ animationDelay: `${delay}ms` }}
        />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
          className="sparkline-path-animated"
          style={{ animationDelay: `${delay}ms` }}
        />
      </svg>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    total_cn: 0,
    pending_cn: 0,
    delivered_today: 0,
    manifested_today: 0,
    unpaid_invoices: 0,
    total_revenue: 0,
    pending_staff: 0,
  })
  const [recentCns, setRecentCns] = useState([])
  const [loading, setLoading] = useState(true)
  const [animKey, setAnimKey] = useState(0)

  async function loadData() {
    setLoading(true)
    setAnimKey((prev) => prev + 1)
    try {
      const [dashRes, cnRes] = await Promise.all([
        getOpsDashboard().catch(() => ({ stats: {} })),
        listConsignments({ page: 1 }).catch(() => ({ rows: [] })),
      ])
      if (dashRes.stats) setStats(dashRes.stats)
      if (cnRes.rows) setRecentCns(cnRes.rows.slice(0, 8))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
          onClick={() => navigate(`/shipments?tab=tracking&cn=${encodeURIComponent(val)}`)}
        >
          {val}
        </span>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'cust_name',
      key: 'cust_name',
      render: (val, r) => val || r.cust_ac_no || '—',
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => (
        <span style={{ fontSize: 12, color: '#4B5563' }}>
          {r.cn_origin || '—'} → {r.cn_dstn || '—'}
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
          <span style={{ fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>
            RM {Number(val).toFixed(2)}
          </span>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner */}
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
          <Title level={3} style={{ margin: 0, color: '#0F1B2D', fontWeight: 600 }}>
            Operational Control Tower
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Logged in as <strong>{user?.name}</strong> · {user?.role}{' '}
            {user?.branchCode ? `(${user?.branchCode})` : ''}
          </Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            onClick={() => navigate('/shipments?action=new')}
          >
            + New Shipment
          </Button>
        </Space>
      </div>

      {/* Metric Cards Grid: Coherent Top-to-Bottom Stack with Full-Width Bottom Sparkline */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            className="kpi-card kpi-card-total"
            hoverable
            onClick={() => navigate('/shipments')}
            styles={{ body: { padding: '14px 16px 0 16px', overflow: 'hidden', position: 'relative' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <InboxOutlined style={{ color: '#0F1B2D', fontSize: 15 }} />
              <span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>Today's Shipments</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0F1B2D', lineHeight: 1.1 }}>
              {stats.total_cn || 0}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#64748B' }}>
              <ArrowUpOutlined style={{ color: '#1B8A5A', fontSize: 11 }} />
              <span style={{ color: '#1B8A5A', fontWeight: 600 }}>+8.4%</span>
              <span>vs yesterday</span>
            </div>
            <BottomSparkline
              data={[14, 22, 19, 28, 24, 31, stats.total_cn || 35]}
              color="#0F1B2D"
              animKey={animKey}
              delay={0}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            className="kpi-card kpi-card-pending"
            hoverable
            onClick={() => navigate('/shipments?tab=all&status=ACC')}
            styles={{ body: { padding: '14px 16px 0 16px', overflow: 'hidden', position: 'relative' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ClockCircleOutlined style={{ color: '#D97706', fontSize: 15 }} />
              <span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>Pending Pickup</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#D97706', lineHeight: 1.1 }}>
              {stats.pending_cn || 0}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#64748B' }}>
              <ArrowDownOutlined style={{ color: '#1B8A5A', fontSize: 11 }} />
              <span style={{ color: '#1B8A5A', fontWeight: 600 }}>-3</span>
              <span>vs last hour</span>
            </div>
            <BottomSparkline
              data={[8, 12, 10, 15, 11, 9, stats.pending_cn || 6]}
              color="#D97706"
              animKey={animKey}
              delay={80}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            className="kpi-card kpi-card-delivered"
            hoverable
            onClick={() => navigate('/shipments?tab=all&status=POD')}
            styles={{ body: { padding: '14px 16px 0 16px', overflow: 'hidden', position: 'relative' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <CheckCircleOutlined style={{ color: '#1B8A5A', fontSize: 15 }} />
              <span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>Delivered Today</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1B8A5A', lineHeight: 1.1 }}>
              {stats.delivered_today || 0}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#64748B' }}>
              <ArrowUpOutlined style={{ color: '#1B8A5A', fontSize: 11 }} />
              <span style={{ color: '#1B8A5A', fontWeight: 600 }}>+14.2%</span>
              <span>vs last week</span>
            </div>
            <BottomSparkline
              data={[18, 25, 22, 30, 27, 34, stats.delivered_today || 29]}
              color="#1B8A5A"
              animKey={animKey}
              delay={160}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            size="small"
            className="kpi-card kpi-card-invoices"
            hoverable
            onClick={() => navigate('/billing')}
            styles={{ body: { padding: '14px 16px 0 16px', overflow: 'hidden', position: 'relative' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <DollarCircleOutlined style={{ color: '#1668DC', fontSize: 15 }} />
              <span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>Unpaid Invoices</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1668DC', lineHeight: 1.1 }}>
              {stats.unpaid_invoices || 0}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#64748B' }}>
              <ArrowDownOutlined style={{ color: '#1B8A5A', fontSize: 11 }} />
              <span style={{ color: '#1B8A5A', fontWeight: 600 }}>-2</span>
              <span>cleared today</span>
            </div>
            <BottomSparkline
              data={[15, 13, 14, 11, 10, 8, stats.unpaid_invoices || 7]}
              color="#1668DC"
              animKey={animKey}
              delay={240}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Split Section: Recent Activity (Table) + Quick Navigation */}
      <Row gutter={[16, 16]}>
        {/* Left Column: Recent Shipments Shared DataTable (Prominent Focal Element) */}
        <Col xs={24} lg={16}>
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderBottom: '1px solid #F3F4F6',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#0F1B2D' }}>Recent Shipments</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>Real-time consignment dispatch & delivery log</div>
              </div>
              <Link to="/shipments" style={{ color: '#1B8A5A', fontSize: 12, fontWeight: 600 }}>
                View All Shipments →
              </Link>
            </div>
            <DataTable
              cardStyle={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}
              columns={columns}
              dataSource={recentCns}
              rowKey="cn_no"
              loading={loading}
              pagination={false}
              locale={{ emptyText: 'No recent shipments found' }}
            />
          </div>
        </Col>

        {/* Right Column: Unified Muted Quick Operations & SOP Legend */}
        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card
              title={<span style={{ fontWeight: 600, fontSize: 14 }}>Quick Operations</span>}
              size="small"
              style={{ borderRadius: 8, borderColor: '#E5E7EB' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Dispatch */}
                <div
                  className="quick-action-row"
                  onClick={() => navigate('/dispatch')}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="icon-chip-muted">
                      <CarOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0F1B2D' }}>
                        Dispatch & Driver Assignment
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        Manage runs, manifests & 3PL handoffs
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>→</span>
                </div>

                {/* Finance */}
                <div
                  className="quick-action-row"
                  onClick={() => navigate('/billing')}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="icon-chip-muted">
                      <DollarCircleOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0F1B2D' }}>
                        Finance & Invoicing
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        Issue invoices, DOs & payment receipts
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>→</span>
                </div>

                {/* Agents */}
                <div
                  className="quick-action-row"
                  onClick={() => navigate('/agents')}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="icon-chip-muted">
                      <TeamOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0F1B2D' }}>
                        Agent Settlements & Stock
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        Deposit top-ups & commission ledger
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>→</span>
                </div>

                {/* Staff Verification */}
                <div
                  className="quick-action-row"
                  onClick={() => navigate('/settings?tab=staff')}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="icon-chip-muted">
                      <SafetyCertificateOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0F1B2D' }}>
                        Staff Verification
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        {stats.pending_staff ? `${stats.pending_staff} pending approvals` : 'Identity verification'}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>→</span>
                </div>
              </div>
            </Card>

            <Card
              title={<span style={{ fontWeight: 600, fontSize: 14 }}>SOP State Legend</span>}
              size="small"
              style={{ borderRadius: 6, borderColor: '#E5E7EB' }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <StatusTag status="BDE" />
                <StatusTag status="ACC" />
                <StatusTag status="PKU" />
                <StatusTag status="ARR" />
                <StatusTag status="INB" />
                <StatusTag status="SHB" />
                <StatusTag status="OFD" />
                <StatusTag status="POD" />
                <StatusTag status="UND" />
              </div>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  )
}
