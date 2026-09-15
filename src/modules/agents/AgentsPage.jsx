import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Radio,
  Row,
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
  DollarCircleOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { Link, useSearchParams } from 'react-router-dom'
import { apiError, getAgentStatement, getAgentStock, listBilling } from '../../api/client'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function money(v) {
  return `RM ${Number(v || 0).toFixed(2)}`
}

export default function AgentsPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') || 'overview'

  const [ledgerType, setLedgerType] = useState(params.get('type') || 'agent-in')
  const [ledgerData, setLedgerData] = useState({ rows: [] })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [agentCode, setAgentCode] = useState(params.get('code') || '')
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()])
  const [statement, setStatement] = useState(null)
  const [stock, setStock] = useState(null)
  const [lookupBusy, setLookupBusy] = useState(false)

  useEffect(() => {
    const t = params.get('type')
    if (t && t !== ledgerType) setLedgerType(t)
  }, [params])

  async function fetchLedger() {
    setLoading(true)
    try {
      const res = await listBilling(ledgerType, {
        agent_cd: search || undefined,
        bilyet_no: search || undefined,
      })
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

  async function loadStatementAndStock() {
    const code = String(agentCode || '').trim().toUpperCase()
    if (!code) {
      message.warning('Enter a drop point / agent code')
      return
    }
    setLookupBusy(true)
    try {
      const q = {
        date_from: dateRange?.[0]?.format('YYYY-MM-DD'),
        date_to: dateRange?.[1]?.format('YYYY-MM-DD'),
      }
      const [stmt, stk] = await Promise.all([
        getAgentStatement(code, q),
        getAgentStock(code, q),
      ])
      setStatement(stmt)
      setStock(stk)
      setParams({ tab: activeTab, code })
      message.success(`Loaded ${code}`)
    } catch (err) {
      setStatement(null)
      setStock(null)
      message.error(apiError(err))
    } finally {
      setLookupBusy(false)
    }
  }

  const ledgerColumns = [
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
          {money(v || r.total_amount)}
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

  const cnColumns = [
    {
      title: 'CN',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (v) => (
        <Link to={`/ops/consignments/tracking?cn=${encodeURIComponent(v || '')}`} style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A' }}>
          {v}
        </Link>
      ),
    },
    { title: 'Date', dataIndex: 'cn_dt_tm', key: 'cn_dt_tm', render: (v) => (v ? String(v).slice(0, 16) : '—') },
    { title: 'Consigner', dataIndex: 'consigner', key: 'consigner' },
    { title: 'Consignee', dataIndex: 'consignee', key: 'consignee' },
    { title: 'Pcs', dataIndex: 'cn_pcs', key: 'cn_pcs', width: 70 },
    { title: 'Kg', dataIndex: 'cn_wt', key: 'cn_wt', width: 70 },
    {
      title: 'Amount',
      dataIndex: 'con_ramt',
      key: 'con_ramt',
      align: 'right',
      render: (v) => money(v),
    },
    {
      title: 'Status',
      dataIndex: 'cn_status',
      key: 'cn_status',
      render: (v) => <StatusTag status={v || '—'} />,
    },
  ]

  const bilyetColumns = [
    { title: 'Bilyet #', dataIndex: 'bilyet_no', key: 'bilyet_no', render: (v) => <Text code>{v}</Text> },
    { title: 'Date', dataIndex: 'bilyet_dt', key: 'bilyet_dt' },
    { title: 'Amount', dataIndex: 'amt', key: 'amt', align: 'right', render: (v) => money(v) },
    {
      title: 'Status',
      dataIndex: 'bilyet_status',
      key: 'bilyet_status',
      render: (v) => <StatusTag status={v || '—'} />,
    },
  ]

  const lookupBar = (
    <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ borderRadius: 6, borderColor: '#E5E7EB' }}>
      <Space wrap>
        <Input
          placeholder="Drop point / agent code"
          value={agentCode}
          onChange={(e) => setAgentCode(e.target.value.toUpperCase())}
          onPressEnter={loadStatementAndStock}
          style={{ width: 200 }}
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          allowClear
        />
        <RangePicker value={dateRange} onChange={(v) => setDateRange(v || [null, null])} />
        <Button type="primary" loading={lookupBusy} onClick={loadStatementAndStock} style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}>
          Load from database
        </Button>
      </Space>
    </Card>
  )

  const totals = statement?.totals || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#0F1B2D' }}>
            Agent Settlements & Ledger
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Drop-point / agent statement, stock, and bilyet money ledgers from the live database.
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            if (activeTab === 'ledger' || activeTab === 'overview') fetchLedger()
            else if (agentCode) loadStatementAndStock()
          }}
          loading={loading || lookupBusy}
        >
          Refresh
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setParams({ tab: k, ...(agentCode ? { code: agentCode } : {}) })}
        items={[
          {
            key: 'overview',
            label: (
              <span>
                <TeamOutlined style={{ marginRight: 6 }} />
                Overview
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
                      Use billing entry for bilyets:{' '}
                      <Link to="/ops/billing/agent-in?mode=entry">Money In</Link>
                      {' · '}
                      <Link to="/ops/billing/agent-out?mode=entry">Money Out</Link>
                      {' · '}
                      <Link to="/ops/billing/agent-credit?mode=entry">Credit</Link>
                      {' · '}
                      <Link to="/ops/billing/agent-debit?mode=entry">Debit</Link>
                      . Statement & stock tabs load live DB data by drop/agent code.
                    </span>
                  }
                />
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={8}>
                    <Card size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#5B6B7C' }}>Loaded ledger rows ({ledgerType})</span>}
                        value={(ledgerData.rows || []).length}
                        prefix={<TeamOutlined style={{ color: '#1668DC' }} />}
                        valueStyle={{ fontWeight: 700 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12, color: '#5B6B7C' }}>Sum on current list</span>}
                        value={(ledgerData.rows || []).reduce((s, r) => s + Number(r.amt || r.total_amount || 0), 0)}
                        precision={2}
                        prefix={<ArrowDownOutlined style={{ color: '#1B8A5A' }} />}
                        suffix="RM"
                        valueStyle={{ fontWeight: 700, color: '#1B8A5A' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small">
                      <Button type="link" href={`/ops/billing/${ledgerType}?mode=entry`} style={{ padding: 0 }}>
                        Create {ledgerType} document →
                      </Button>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'statement',
            label: (
              <span>
                <DollarCircleOutlined style={{ marginRight: 6 }} />
                Statement
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lookupBar}
                {statement ? (
                  <>
                    <Row gutter={[12, 12]}>
                      <Col xs={12} sm={6}>
                        <Card size="small"><Statistic title="CN count" value={totals.cnCount || 0} /></Card>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Card size="small"><Statistic title="CN amount" value={totals.totAmt || 0} precision={2} suffix="RM" /></Card>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Card size="small"><Statistic title="Bilyet amount" value={totals.totBilyetAmt || 0} precision={2} suffix="RM" /></Card>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Card size="small"><Statistic title="Balance" value={totals.balance || 0} precision={2} suffix="RM" valueStyle={{ color: Number(totals.balance) >= 0 ? '#1B8A5A' : '#D4380D' }} /></Card>
                      </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {(statement.dropPoint?.drop_name || statement.agent?.agent_name || agentCode)} · {statement.fromDt} → {statement.toDt}
                    </Text>
                    <Card size="small" title="Consignments">
                      <DataTable
                        columns={cnColumns}
                        dataSource={statement.consignments || []}
                        rowKey={(r, i) => r.cn_no || i}
                        pagination={{ pageSize: 10 }}
                        locale={{ emptyText: 'No consignments in range' }}
                      />
                    </Card>
                    <Card size="small" title="Bilyets">
                      <DataTable
                        columns={bilyetColumns}
                        dataSource={statement.bilyets || []}
                        rowKey={(r, i) => r.bilyet_no || i}
                        pagination={{ pageSize: 10 }}
                        locale={{ emptyText: 'No bilyets in range' }}
                      />
                    </Card>
                  </>
                ) : (
                  <Alert type="info" showIcon message="Enter a drop point / agent code and load statement from the database." />
                )}
              </div>
            ),
          },
          {
            key: 'stock',
            label: (
              <span>
                <InboxOutlined style={{ marginRight: 6 }} />
                Stock
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lookupBar}
                {stock ? (
                  <DataTable
                    columns={[
                      ...cnColumns,
                      { title: 'Origin', dataIndex: 'cn_origin', key: 'cn_origin', width: 90 },
                      { title: 'Dest', dataIndex: 'cn_dstn', key: 'cn_dstn', width: 90 },
                    ]}
                    dataSource={stock.rows || []}
                    rowKey={(r, i) => r.cn_no || i}
                    loading={lookupBusy}
                    pagination={{ pageSize: 15 }}
                    locale={{ emptyText: 'No stock rows in range' }}
                  />
                ) : (
                  <Alert type="info" showIcon message="Enter a drop point / agent code and load stock from the database." />
                )}
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
                <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <Radio.Group value={ledgerType} onChange={(e) => setLedgerType(e.target.value)} buttonStyle="solid" size="small">
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
                <DataTable
                  columns={ledgerColumns}
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
