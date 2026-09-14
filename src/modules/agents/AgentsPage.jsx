import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Typography,
  message,
} from 'antd'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DollarCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Link, useSearchParams } from 'react-router-dom'
import { apiError, listBilling } from '../../api/client'

const { Title, Text } = Typography

export default function AgentsPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') || 'overview'

  // Ledger state
  const [ledgerType, setLedgerType] = useState(params.get('type') || 'agent-in') // 'agent-in' | 'agent-out' | 'agent-credit' | 'agent-debit'
  const [ledgerData, setLedgerData] = useState({ rows: [] })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = params.get('type')
    if (t && t !== ledgerType) {
      setLedgerType(t)
    }
  }, [params])

  async function fetchLedger() {
    setLoading(true)
    try {
      const res = await listBilling(ledgerType, { agent_cd: search || undefined, bilyet_no: search || undefined })
      setLedgerData({ rows: res?.rows || res?.data || [] })
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLedger()
  }, [ledgerType])

  const columns = [
    {
      title: 'Bilyet / Reference #',
      dataIndex: 'bilyet_no',
      key: 'bilyet_no',
      render: (v, r) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1B8A5A' }}>
          {v || r.credit_note_no || r.debit_note_no || '—'}
        </span>
      ),
    },
    {
      title: 'Agent Code',
      dataIndex: 'agent_cd',
      key: 'agent_cd',
      render: (v) => <StatusTag status="ASSIGNED" text={v || 'AGENT'} color="#1668DC" />,
    },
    {
      title: 'Date',
      dataIndex: 'bilyet_dt',
      key: 'bilyet_dt',
      render: (v, r) => v || r.date || '—',
    },
    {
      title: 'Transaction Type',
      key: 'typ',
      render: () => {
        if (ledgerType === 'agent-in') return <StatusTag status="PAID" text="Money In (+)" color="#1B8A5A" />
        if (ledgerType === 'agent-out') return <StatusTag status="UNPAID" text="Money Out (-)" color="#D97706" />
        if (ledgerType === 'agent-credit') return <StatusTag status="CREDIT" text="Credit Note" color="#7C3AED" />
        return <StatusTag status="DEBIT" text="Debit Note" color="#D4380D" />
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amt',
      key: 'amt',
      align: 'right',
      render: (v, r) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
          RM {Number(v || r.total_amount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'bilyet_status',
      key: 'bilyet_status',
      render: (v) => <StatusTag status={v || 'CLEARED'} text={v || 'Cleared'} />,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#0F1B2D' }}>
            Agent Settlements & Ledger
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Track agent commissions, bilyet money-in/out deposits, credit adjustments, and branch stock.
          </Text>
        </div>

        <Button icon={<ReloadOutlined />} onClick={fetchLedger} loading={loading}>
          Refresh
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setParams({ tab: k })}
        items={[
          {
            key: 'overview',
            label: (
              <span>
                <TeamOutlined style={{ marginRight: 6 }} />
                Overview & Balances
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Drop-point / agent money"
                  description={
                    <span>
                      Use Damien billing entry screens for bilyets:{' '}
                      <Link to="/ops/billing/agent-in?mode=entry">Money In</Link>
                      {' · '}
                      <Link to="/ops/billing/agent-out?mode=entry">Money Out</Link>
                      {' · '}
                      <Link to="/ops/billing/agent-credit?mode=entry">Credit</Link>
                      {' · '}
                      <Link to="/ops/billing/agent-debit?mode=entry">Debit</Link>
                      . Commission wallets live under{' '}
                      <Link to="/ops/commissions/wallets">Partner Wallets</Link>.
                    </span>
                  }
                />
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 6, borderColor: '#E5E7EB' }}>
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#5B6B7C' }}>Loaded ledger rows ({ledgerType})</span>}
                        value={(ledgerData.rows || ledgerData.data || []).length}
                        prefix={<TeamOutlined style={{ color: '#1668DC' }} />}
                        valueStyle={{ fontWeight: 700, color: '#0F1B2D' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 6, borderColor: '#E5E7EB' }}>
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#5B6B7C' }}>Sum on current list</span>}
                        value={(ledgerData.rows || ledgerData.data || []).reduce((s, r) => s + Number(r.amt || r.total_amount || 0), 0)}
                        precision={2}
                        prefix={<ArrowDownOutlined style={{ color: '#1B8A5A' }} />}
                        suffix="RM"
                        valueStyle={{ fontWeight: 700, color: '#1B8A5A' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 6, borderColor: '#E5E7EB' }}>
                      <Button type="link" href={`/ops/billing/${ledgerType}?mode=entry`} style={{ padding: 0 }}>
                        Create {ledgerType} document →
                      </Button>
                    </Card>
                  </Col>
                </Row>

                <Card
                  title={<span style={{ fontWeight: 600, fontSize: 13 }}>Agent Activity Guidelines</span>}
                  size="small"
                  style={{ borderRadius: 6, borderColor: '#E5E7EB' }}
                >
                  <p style={{ margin: 0, color: '#4B5563', fontSize: 13 }}>
                    Use the <strong>Transaction Ledger</strong> tab to filter and verify Bilyet Money In/Out and
                    credit/debit notes. COD remittance requires a Money In bilyet first.
                  </p>
                </Card>
              </div>
            ),
          },
          {
            key: 'ledger',
            label: (
              <span>
                <DollarCircleOutlined style={{ marginRight: 6 }} />
                Transaction Ledger
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Ledger filter bar */}
                <Card
                  size="small"
                  bodyStyle={{ padding: '10px 14px' }}
                  style={{ borderRadius: 6, borderColor: '#E5E7EB' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <Radio.Group
                      value={ledgerType}
                      onChange={(e) => setLedgerType(e.target.value)}
                      buttonStyle="solid"
                      size="small"
                    >
                      <Radio.Button value="agent-in">Money In</Radio.Button>
                      <Radio.Button value="agent-out">Money Out</Radio.Button>
                      <Radio.Button value="agent-credit">Credit Notes</Radio.Button>
                      <Radio.Button value="agent-debit">Debit Notes</Radio.Button>
                    </Radio.Group>

                    <Input
                      placeholder="Filter by agent code, reference…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onPressEnter={fetchLedger}
                      prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
                      style={{ width: 260 }}
                      size="small"
                      allowClear
                    />
                  </div>
                </Card>

                {/* Table */}
                <DataTable
                  columns={columns}
                  dataSource={ledgerData.rows || []}
                  rowKey={(r, i) => r.bilyet_no || i}
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: 'No agent transactions recorded' }}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
