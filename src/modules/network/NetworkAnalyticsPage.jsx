import React, { useEffect, useState } from 'react'
import {
  AppstoreOutlined,
  BarChartOutlined,
  ClusterOutlined,
  DownloadOutlined,
  FilterOutlined,
  InboxOutlined,
  LineChartOutlined,
  PieChartOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tooltip,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { apiError, downloadCsv, getSummary, listMaster } from '../../api/client'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'

const { Title, Text } = Typography

const GROUP_OPTIONS = [
  { label: 'Status (SOP Lifecycle)', value: 'status' },
  { label: 'Drop Point', value: 'drop-point' },
  { label: 'Consignee (Recipient)', value: 'consignee' },
  { label: 'Consigner (Sender)', value: 'consigner' },
  { label: 'Shipper', value: 'shipper' },
  { label: 'Manifest', value: 'manifest' },
  { label: 'Date', value: 'date' },
  { label: 'Branch', value: 'branch' },
]

const RANGE_PRESETS = [
  { label: 'Today', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: 'Last 7 Days', value: [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] },
  { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: 'Last 30 Days', value: [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')] },
]

export default function NetworkAnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') || 'analytics'

  // Analytics filters
  const [groupBy, setGroupBy] = useState(params.get('group') || 'status')
  const [dateRange, setDateRange] = useState(() => {
    const from = params.get('date_from')
    const to = params.get('date_to')
    if (from && to) return [dayjs(from), dayjs(to)]
    return null
  })
  const [originBranch, setOriginBranch] = useState(params.get('origin') || '')

  const [summaryData, setSummaryData] = useState({ rows: [], totals: {} })
  const [loading, setLoading] = useState(false)

  // Network Infrastructure Masters tab
  const [networkResource, setNetworkResource] = useState('hubs')
  const [masterRows, setMasterRows] = useState([])
  const [masterLoading, setMasterLoading] = useState(false)

  async function fetchSummary() {
    setLoading(true)
    try {
      const q = {}
      if (dateRange && dateRange[0] && dateRange[1]) {
        q.date_from = dateRange[0].format('YYYY-MM-DD')
        q.date_to = dateRange[1].format('YYYY-MM-DD')
      }
      if (originBranch) q.cn_origin = originBranch
      const res = await getSummary(groupBy, q)
      setSummaryData(res || { rows: [], totals: {} })
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  async function fetchMaster(resource) {
    setMasterLoading(true)
    try {
      const res = await listMaster(resource)
      setMasterRows(res?.rows || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setMasterLoading(false)
    }
  }

  useEffect(() => {
    const g = params.get('group')
    if (g && g !== groupBy) {
      setGroupBy(g)
    }
  }, [params])

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchSummary()
    } else if (activeTab === 'infrastructure') {
      fetchMaster(networkResource)
    }
  }, [activeTab, groupBy, networkResource])

  function handleExportCsv() {
    const rows = [
      ['Group Key', 'Description', 'Shipment Count', 'Total Pieces', 'Total Weight (kg)', 'Percentage (%)'],
      ...(summaryData.rows || []).map((r) => [
        r.key_code || r.cn_status || '',
        r.key_label || r.status_desc || '',
        r.cnt || 0,
        r.total_pcs || 0,
        r.total_wt || 0,
        `${r.pct || 0}%`,
      ]),
    ]
    downloadCsv(`summary_${groupBy}_${new Date().toISOString().slice(0, 10)}.csv`, rows)
    message.success('Summary CSV exported successfully')
  }

  const columns = [
    {
      title: 'Grouping Key',
      dataIndex: 'key_code',
      key: 'key_code',
      render: (v, r) => {
        const val = v || r.cn_status
        if (groupBy === 'status') {
          return <StatusTag status={val} text={r.key_label || r.status_desc} />
        }
        return (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A' }}>
            {val || '—'}
          </span>
        )
      },
    },
    {
      title: 'Description / Title',
      dataIndex: 'key_label',
      key: 'key_label',
      render: (v, r) => v || r.status_desc || '—',
    },
    {
      title: 'Consignments',
      dataIndex: 'cnt',
      key: 'cnt',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600, color: '#0F1B2D' }}>{v}</span>,
    },
    {
      title: 'Total Pieces',
      dataIndex: 'total_pcs',
      key: 'total_pcs',
      align: 'right',
      render: (v) => v || 0,
    },
    {
      title: 'Total Weight (kg)',
      dataIndex: 'total_wt',
      key: 'total_wt',
      align: 'right',
      render: (v) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {Number(v || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Volume Share (%)',
      dataIndex: 'pct',
      key: 'pct',
      align: 'right',
      render: (v) => {
        const val = Number(v || 0)
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <span style={{ fontWeight: 600, color: val > 20 ? '#1B8A5A' : '#475569' }}>
              {val.toFixed(1)}%
            </span>
          </div>
        )
      },
    },
  ]

  // Totals calculations
  const totalCount = summaryData.totals?.cnt ?? (summaryData.rows || []).reduce((acc, r) => acc + Number(r.cnt || 0), 0)
  const totalPcs = summaryData.totals?.total_pcs ?? (summaryData.rows || []).reduce((acc, r) => acc + Number(r.total_pcs || 0), 0)
  const totalWt = summaryData.totals?.total_wt ?? (summaryData.rows || []).reduce((acc, r) => acc + Number(r.total_wt || 0), 0)
  const topSegment = summaryData.rows && summaryData.rows.length > 0 ? summaryData.rows[0] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Module Title Header */}
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
          <Title level={3} style={{ margin: 0, fontWeight: 600, color: '#0F1B2D' }}>
            Analytics & Network Intelligence
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Unified throughput analytics by status, drop point, destination, shipper, and route infrastructure.
          </Text>
        </div>

        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
            Export Summary CSV
          </Button>
          <Button
            icon={<ReloadOutlined />}
            loading={loading || masterLoading}
            onClick={() => {
              if (activeTab === 'analytics') fetchSummary()
              else fetchMaster(networkResource)
            }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setParams({ tab: k })}
        items={[
          {
            key: 'analytics',
            label: (
            <span>
              <LineChartOutlined style={{ marginRight: 6 }} />
              Unified Status & Volume Summary
            </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Control Bar: Ant Select + DatePicker.RangePicker */}
                <Card
                  size="small"
                  className="table-surface-card"
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <Space wrap size="middle">
                    <div>
                      <span style={{ fontSize: 12, color: '#5B6B7C', marginRight: 8, fontWeight: 600 }}>
                        Group Shipments By:
                      </span>
                      <Select
                        value={groupBy}
                        onChange={(v) => {
                          setGroupBy(v)
                          setParams({ tab: 'analytics', group: v })
                        }}
                        options={GROUP_OPTIONS}
                        style={{ width: 220 }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: 12, color: '#5B6B7C', marginRight: 8, fontWeight: 600 }}>
                        Date Range:
                      </span>
                      <DatePicker.RangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        presets={RANGE_PRESETS}
                        format="YYYY-MM-DD"
                        placeholder={['Start Date', 'End Date']}
                        style={{ width: 250 }}
                        allowClear
                      />
                    </div>

                    <div>
                      <Input
                        placeholder="Origin Branch (e.g. BKI)"
                        value={originBranch}
                        onChange={(e) => setOriginBranch(e.target.value.toUpperCase())}
                        style={{ width: 170 }}
                        maxLength={6}
                        allowClear
                      />
                    </div>

                    <Button
                      type="primary"
                      icon={<FilterOutlined />}
                      style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
                      onClick={fetchSummary}
                      loading={loading}
                    >
                      Apply Filters
                    </Button>
                  </Space>
                </Card>

                {/* Infographic Hero KPI Cards with Bone Loading Animation */}
                {loading ? (
                  <Row gutter={[12, 12]}>
                    {[1, 2, 3, 4].map((i) => (
                      <Col xs={24} sm={12} lg={6} key={i}>
                        <Card size="small" style={{ borderRadius: 8, borderColor: '#E5E7EB' }}>
                          <Skeleton active paragraph={{ rows: 1 }} title={{ width: 90 }} />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small" className="kpi-card kpi-card-delivered">
                        <Statistic
                          title={<span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>Total Consignments</span>}
                          value={totalCount}
                          prefix={<InboxOutlined style={{ color: '#1B8A5A', marginRight: 8 }} />}
                          valueStyle={{ fontWeight: 700, color: '#0F1B2D', fontSize: 24 }}
                        />
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                          Across selected period & filter
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small" className="kpi-card kpi-card-invoices">
                        <Statistic
                          title={<span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>Total Pieces Handled</span>}
                          value={totalPcs}
                          prefix={<AppstoreOutlined style={{ color: '#1668DC', marginRight: 8 }} />}
                          valueStyle={{ fontWeight: 700, color: '#1668DC', fontSize: 24 }}
                        />
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                          ~{((totalPcs || 0) / (totalCount || 1)).toFixed(1)} pcs/consignment average
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small" className="kpi-card kpi-card-pending">
                        <Statistic
                          title={<span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>Gross Freight Weight</span>}
                          value={Number(totalWt || 0).toFixed(1)}
                          suffix="kg"
                          prefix={<ThunderboltOutlined style={{ color: '#D97706', marginRight: 8 }} />}
                          valueStyle={{ fontWeight: 700, color: '#D97706', fontSize: 24 }}
                        />
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                          ~{((totalWt || 0) / (totalCount || 1)).toFixed(1)} kg/consignment average
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small" className="kpi-card kpi-card-total">
                        <Statistic
                          title={<span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 500 }}>Active Categories</span>}
                          value={summaryData.rows?.length || 0}
                          prefix={<PieChartOutlined style={{ color: '#0F1B2D', marginRight: 8 }} />}
                          valueStyle={{ fontWeight: 700, color: '#0F1B2D', fontSize: 24 }}
                        />
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {topSegment ? `Leader: ${topSegment.key_label || topSegment.key_code} (${topSegment.pct || 0}%)` : 'No active segments'}
                        </div>
                      </Card>
                    </Col>
                  </Row>
                )}

                {/* Infographic Volume Distribution & Share Breakdown Meter */}
                <Card
                  size="small"
                  className="table-surface-card"
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#0F1B2D' }}>
                        Throughput Share & Volume Breakdown
                      </span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>
                        Categorized by {groupBy.toUpperCase()}
                      </span>
                    </div>
                  }
                  styles={{ body: { padding: '14px 16px' } }}
                >
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Skeleton.Input active block style={{ height: 12 }} />
                      <Skeleton active paragraph={{ rows: 2 }} />
                    </div>
                  ) : summaryData.rows && summaryData.rows.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Proportional Strip Meter */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
                          <span>Volume Distribution Proportion</span>
                          <span>{summaryData.rows.length} Total Segments</span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            height: 12,
                            borderRadius: 6,
                            overflow: 'hidden',
                            width: '100%',
                            background: '#F1F5F9',
                            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                          }}
                        >
                          {summaryData.rows.slice(0, 10).map((r, idx) => {
                            const colors = [
                              '#1B8A5A',
                              '#1668DC',
                              '#D97706',
                              '#7C3AED',
                              '#0891B2',
                              '#DC2626',
                              '#059669',
                              '#475569',
                            ]
                            const c = colors[idx % colors.length]
                            const pct = Math.max(Number(r.pct || 0), 1)
                            return (
                              <Tooltip
                                title={`${r.key_label || r.key_code}: ${r.cnt} CNs (${r.pct || 0}%)`}
                                key={r.key_code || idx}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    background: c,
                                    height: '100%',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s',
                                  }}
                                />
                              </Tooltip>
                            )
                          })}
                        </div>
                      </div>

                      {/* Top Segment Mini-Bars */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                          gap: 12,
                        }}
                      >
                        {summaryData.rows.slice(0, 6).map((r, idx) => {
                          const colors = ['#1B8A5A', '#1668DC', '#D97706', '#7C3AED', '#0891B2', '#475569']
                          const c = colors[idx % colors.length]
                          return (
                            <div
                              key={r.key_code || idx}
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: 6,
                                padding: '10px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 13,
                                    color: '#1E293B',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <span style={{ fontSize: 10, color: '#94A3B8' }}>#{idx + 1}</span>
                                  {groupBy === 'status' ? (
                                    <StatusTag status={r.key_code} />
                                  ) : (
                                    <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {r.key_label || r.key_code}
                                    </span>
                                  )}
                                </span>
                                <span style={{ fontWeight: 700, fontSize: 13, color: c }}>
                                  {r.pct || 0}%
                                </span>
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: 11,
                                  color: '#64748B',
                                }}
                              >
                                <span>{r.cnt || 0} consignments</span>
                                <span>{Number(r.total_wt || 0).toFixed(1)} kg · {r.total_pcs || 0} pcs</span>
                              </div>
                              <Progress
                                percent={Number(r.pct || 0)}
                                strokeColor={c}
                                size={['100%', 6]}
                                showInfo={false}
                                railColor="#E2E8F0"
                                trailColor="#E2E8F0"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8' }}>
                      No operational throughput data found for this filter criteria.
                    </div>
                  )}
                </Card>

                {/* Detailed Summary Table */}
                <DataTable
                  columns={columns}
                  dataSource={summaryData.rows || []}
                  rowKey={(r) => r.key_code || r.cn_status || r.key_label || 'row'}
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  summary={() => {
                    return (
                      <Table.Summary fixed>
                        <Table.Summary.Row style={{ background: '#F4F6F8', fontWeight: 600 }}>
                          <Table.Summary.Cell index={0}>Total Aggregation</Table.Summary.Cell>
                          <Table.Summary.Cell index={1}>All Groups Combined</Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right">
                            <span style={{ color: '#0F1B2D' }}>{totalCount}</span>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right">
                            {totalPcs}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right">
                            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                              {Number(totalWt).toFixed(2)}
                            </span>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={5} align="right">
                            <span style={{ color: '#1B8A5A' }}>100%</span>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    )
                  }}
                />
              </div>
            ),
          },
          {
            key: 'infrastructure',
            label: (
              <span>
                <ClusterOutlined style={{ marginRight: 6 }} />
                Network Infrastructure & Masters
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card
                  size="small"
                  className="table-surface-card"
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <Space>
                    <span style={{ fontSize: 12, color: '#5B6B7C', fontWeight: 600 }}>
                      Select Network Entity:
                    </span>
                    <Select
                      value={networkResource}
                      onChange={setNetworkResource}
                      style={{ width: 220 }}
                      options={[
                        { label: 'Sorting Hubs', value: 'hubs' },
                        { label: 'Regional Branches', value: 'branches' },
                        { label: 'Drop Points (Collection)', value: 'drop-points' },
                        { label: '3PL Partner Couriers', value: '3pl' },
                        { label: 'Coverage Areas', value: 'coverage' },
                        { label: 'Routing Tables', value: 'routes' },
                      ]}
                    />
                  </Space>
                </Card>

                <DataTable
                  dataSource={masterRows}
                  rowKey="id"
                  loading={masterLoading}
                  columns={[
                    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
                    {
                      title: 'Code',
                      dataIndex: 'code',
                      key: 'code',
                      render: (v, r) => (
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A' }}>
                          {v || r.hub_code || r.loc_code || r.dp_code || r.route_code || '—'}
                        </span>
                      ),
                    },
                    {
                      title: 'Name / Description',
                      dataIndex: 'name',
                      key: 'name',
                      render: (v, r) => v || r.hub_name || r.loc_name || r.dp_name || r.partner_name || '—',
                    },
                    {
                      title: 'State / Region',
                      dataIndex: 'state',
                      key: 'state',
                      render: (v, r) => v || r.state_name || r.zone || '—',
                    },
                  ]}
                  pagination={{ pageSize: 15 }}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

