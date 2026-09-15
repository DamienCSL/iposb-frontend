import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Row, Space, Typography, message } from 'antd'
import {
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
import { apiError, getOpsDashboard, listConsignments } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'

const { Title, Text } = Typography

const EMPTY_STATS = {
  total_cn: 0,
  pending_cn: 0,
  delivered_today: 0,
  manifested_today: 0,
  unpaid_invoices: 0,
  total_revenue: 0,
  pending_staff: 0,
  pending_cod: 0,
  pending_commissions: 0,
}

function KpiCard({ icon, label, value, hint, color, onClick }) {
  return (
    <Card
      size="small"
      hoverable={Boolean(onClick)}
      onClick={onClick}
      styles={{ body: { padding: '14px 16px' } }}
      style={{ borderRadius: 8, borderColor: '#E5E7EB', height: '100%' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {hint ? (
        <div style={{ marginTop: 6, fontSize: 11, color: '#64748B' }}>{hint}</div>
      ) : null}
    </Card>
  )
}

export default function DashboardPage() {
  const { user, can, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(EMPTY_STATS)
  const [recentCns, setRecentCns] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [partialError, setPartialError] = useState('')

  async function loadData() {
    setLoading(true)
    setLoadError('')
    setPartialError('')
    const errors = []

    let dashRes = null
    let cnRes = null

    try {
      dashRes = await getOpsDashboard()
    } catch (err) {
      errors.push(`Dashboard KPIs: ${apiError(err)}`)
      setStats(EMPTY_STATS)
    }

    try {
      cnRes = await listConsignments({ page: 1, per_page: 8 })
    } catch (err) {
      errors.push(`Recent shipments: ${apiError(err)}`)
      setRecentCns([])
    }

    if (dashRes) {
      const next = dashRes.stats || dashRes.data || {}
      setStats({ ...EMPTY_STATS, ...next })
    }
    if (cnRes) {
      const records = cnRes?.data || cnRes?.rows || []
      setRecentCns(records.slice(0, 8))
    }

    if (errors.length === 2) {
      setLoadError(errors.join(' · '))
      message.error('Dashboard failed to load from the server')
    } else if (errors.length === 1) {
      setPartialError(errors[0])
      message.warning(errors[0])
    }

    setLoading(false)
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
          onClick={() => navigate(`/ops/consignments/${encodeURIComponent(val)}`)}
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
        val != null && val !== '' ? (
          <span style={{ fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>
            RM {Number(val).toFixed(2)}
          </span>
        ) : (
          '—'
        ),
    },
  ]

  const revenue = Number(stats.total_revenue || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            onClick={() => navigate('/ops/consignments/new')}
          >
            New consignment
          </Button>
        </Space>
      </div>

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message="Could not load dashboard data"
          description={loadError}
          action={
            <Button size="small" onClick={loadData}>
              Retry
            </Button>
          }
        />
      ) : null}

      {partialError && !loadError ? (
        <Alert type="warning" showIcon closable message={partialError} onClose={() => setPartialError('')} />
      ) : null}

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<InboxOutlined style={{ color: '#0F1B2D', fontSize: 15 }} />}
            label="Created Today"
            value={Number(stats.total_cn || 0)}
            hint="Consignments booked today (DB)"
            color="#0F1B2D"
            onClick={() => navigate('/ops/consignments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<ClockCircleOutlined style={{ color: '#D97706', fontSize: 15 }} />}
            label="Pending / On Hold"
            value={Number(stats.pending_cn || 0)}
            hint="Status BDE / SHL awaiting progress"
            color="#D97706"
            onClick={() => navigate('/ops/pickups')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<CheckCircleOutlined style={{ color: '#1B8A5A', fontSize: 15 }} />}
            label="Delivered Today"
            value={Number(stats.delivered_today || 0)}
            hint="POD confirmed today"
            color="#1B8A5A"
            onClick={() => navigate('/ops/consignments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<CarOutlined style={{ color: '#0891B2', fontSize: 15 }} />}
            label="Manifested Today"
            value={Number(stats.manifested_today || 0)}
            hint="Linehaul bags / manifests today"
            color="#0891B2"
            onClick={() => navigate('/ops/manifests')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<DollarCircleOutlined style={{ color: '#1668DC', fontSize: 15 }} />}
            label="Unpaid Invoices"
            value={Number(stats.unpaid_invoices || 0)}
            hint="Invoice status UPD"
            color="#1668DC"
            onClick={() => navigate('/ops/billing/invoices')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<DollarCircleOutlined style={{ color: '#1B8A5A', fontSize: 15 }} />}
            label="YTD Revenue"
            value={`RM ${revenue}`}
            hint="Sum of invoices this year"
            color="#1B8A5A"
            onClick={() => navigate('/ops/billing/invoices')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<SafetyCertificateOutlined style={{ color: '#7C3AED', fontSize: 15 }} />}
            label="Staff Verifications"
            value={Number(stats.pending_staff || stats.pending_staff_verifications || 0)}
            hint="Pending driver / dispatcher approvals →"
            color="#7C3AED"
            onClick={() => navigate('/ops/staff')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<DollarCircleOutlined style={{ color: '#D97706', fontSize: 15 }} />}
            label="Pending COD"
            value={Number(stats.pending_cod || 0)}
            hint="COD collections awaiting settle →"
            color="#D97706"
            onClick={() => navigate('/ops/cod')}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
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
                <div style={{ fontSize: 11, color: '#6B7280' }}>Latest consignments from the database</div>
              </div>
              <Link to="/ops/consignments" style={{ color: '#1B8A5A', fontSize: 12, fontWeight: 600 }}>
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
              locale={{
                emptyText: loadError
                  ? 'Could not load shipments'
                  : 'No recent shipments found',
              }}
            />
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card
              title={<span style={{ fontWeight: 600, fontSize: 14 }}>Quick Operations</span>}
              size="small"
              style={{ borderRadius: 8, borderColor: '#E5E7EB' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  {
                    key: 'new-cn',
                    show: can('consignments') || isAdmin,
                    path: '/ops/consignments/new',
                    icon: <PlusOutlined />,
                    title: 'New Consignment',
                    desc: 'Create or update a booking',
                  },
                  {
                    key: 'track',
                    show: can('consignments') || isAdmin,
                    path: '/ops/consignments/tracking',
                    icon: <InboxOutlined />,
                    title: 'Track Consignment',
                    desc: 'Look up status history',
                  },
                  {
                    key: 'pickups',
                    show: can('dispatch') || can('consignments') || isAdmin,
                    path: '/ops/pickups',
                    icon: <CarOutlined />,
                    title: 'Pickup Queue & Auto-Assign',
                    desc: 'Dispatch fleet couriers and load balance',
                  },
                  {
                    key: 'invoice',
                    show: can('billing') || isAdmin,
                    path: '/ops/billing/invoices?mode=entry',
                    icon: <DollarCircleOutlined />,
                    title: 'Generate Invoice',
                    desc: 'Bill unbilled consignments',
                  },
                  {
                    key: 'billing',
                    show: can('billing') || isAdmin,
                    path: '/ops/billing/invoices',
                    icon: <DollarCircleOutlined />,
                    title: 'Finance & Invoicing',
                    desc: 'Issue invoices, DOs & payment receipts',
                  },
                  {
                    key: 'commissions',
                    show: can('commissions') || can('billing') || isAdmin,
                    path: '/ops/commissions/rates',
                    icon: <TeamOutlined />,
                    title: 'Commissions & Wallets',
                    desc: 'Rate settings, ledger & withdrawals',
                  },
                  {
                    key: 'cs',
                    show: can('customerService') || isAdmin,
                    path: '/ops/cs/tickets',
                    icon: <TeamOutlined />,
                    title: 'CS Tickets',
                    desc: 'Customer inquiries & escalations',
                  },
                  {
                    key: 'customers',
                    show: can('consignments') || isAdmin,
                    path: '/ops/admin/customers',
                    icon: <TeamOutlined />,
                    title: 'Customer Registration',
                    desc: 'Shipper accounts for billing',
                  },
                  {
                    key: 'hubs',
                    show: can('hubs') || can('admin') || isAdmin,
                    path: '/ops/admin/hubs',
                    icon: <SafetyCertificateOutlined />,
                    title: 'Hub Management',
                    desc: 'Main and mini hub gateways',
                  },
                  {
                    key: 'zones',
                    show: can('routing') || can('admin') || isAdmin,
                    path: '/ops/admin/zones',
                    icon: <SafetyCertificateOutlined />,
                    title: 'Delivery Points',
                    desc: 'Service areas under each hub',
                  },
                  {
                    key: 'areas',
                    show: can('routing') || can('admin') || isAdmin,
                    path: '/ops/admin/areas',
                    icon: <SafetyCertificateOutlined />,
                    title: 'Areas',
                    desc: 'Last-mile territories & keywords',
                  },
                  {
                    key: 'drops',
                    show: can('dropPoints') || can('admin') || isAdmin,
                    path: '/ops/admin/drop-points',
                    icon: <SafetyCertificateOutlined />,
                    title: 'Drop Points',
                    desc: 'Counter stations under a DP',
                  },
                  {
                    key: 'drivers',
                    show: can('staff') || isAdmin,
                    path: '/ops/admin/drivers',
                    icon: <CarOutlined />,
                    title: 'Driver Management',
                    desc: 'Mobile drivers & route pools',
                  },
                  {
                    key: 'route-codes',
                    show: can('routing') || can('admin') || isAdmin,
                    path: '/ops/admin/route-codes',
                    icon: <SafetyCertificateOutlined />,
                    title: 'Route Codes',
                    desc: 'Preferred driver route pools',
                  },
                  {
                    key: 'staff',
                    show: can('staff') || isAdmin,
                    path: '/ops/staff',
                    icon: <SafetyCertificateOutlined />,
                    title: 'Staff Verification Queue',
                    desc: stats.pending_staff
                      ? `${stats.pending_staff} pending approvals`
                      : 'Identity verification',
                  },
                ]
                  .filter((a) => a.show)
                  .map((a) => (
                    <div
                      key={a.key}
                      className="quick-action-row"
                      onClick={() => navigate(a.path)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') navigate(a.path)
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="icon-chip-muted">{a.icon}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#0F1B2D' }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{a.desc}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, color: '#9CA3AF' }}>→</span>
                    </div>
                  ))}
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
