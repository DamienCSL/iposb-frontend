import React, { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  apiError,
  createAtsClaim,
  detectAtsClaims,
  listAtsClaims,
  settleAtsClaim,
  submitAtsClaim,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'

const { Title, Text } = Typography

function typeColor(t) {
  if (t === 'DAMAGE') return 'orange'
  if (t === 'REJECT') return 'magenta'
  if (t === 'LOST') return 'red'
  return 'default'
}

function statusColor(s) {
  if (s === 'OPEN') return 'gold'
  if (s === 'SUBMITTED') return 'blue'
  if (s === 'APPROVED') return 'green'
  if (s === 'REJECTED' || s === 'EXPIRED') return 'red'
  return 'default'
}

export default function AtsClaimsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { isAdmin, user } = useAuth()
  const canManage =
    isAdmin || ['Operation', 'Super Admin', 'Admin', 'Hub Manager', 'CS'].includes(user?.role)

  const statusFilter = (params.get('status') || 'ACTIVE').toUpperCase()
  const typeFilter = (params.get('type') || '').toUpperCase()
  const [q, setQ] = useState(params.get('q') || '')
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({})
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [acting, setActing] = useState(false)
  const [createForm] = Form.useForm()
  const [submitForm] = Form.useForm()
  const [settleForm] = Form.useForm()
  const [lastDetect, setLastDetect] = useState(null)

  async function load(nextPage = page) {
    setLoading(true)
    try {
      const res = await listAtsClaims({
        status: statusFilter,
        type: typeFilter || undefined,
        q: q || undefined,
        page: nextPage,
        per_page: 25,
      })
      setRows(res?.rows || [])
      setSummary(res?.summary || {})
      setTotal(res?.total ?? 0)
      setPage(res?.page ?? nextPage)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter])

  function setStatus(status) {
    const next = new URLSearchParams(params)
    next.set('status', status)
    setParams(next, { replace: true })
  }

  function setType(type) {
    const next = new URLSearchParams(params)
    if (type) next.set('type', type)
    else next.delete('type')
    setParams(next, { replace: true })
  }

  async function onCreate(values) {
    setActing(true)
    try {
      const res = await createAtsClaim({
        cn_no: String(values.cn_no || '').trim().toUpperCase(),
        claim_type: values.claim_type,
        note: values.note || '',
        evidence_url: values.evidence_url || undefined,
      })
      message.success(`Opened ${res?.claim?.claimNo || 'ATS claim'}`)
      setCreateOpen(false)
      createForm.resetFields()
      setStatus('ACTIVE')
      load(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActing(false)
    }
  }

  async function onSubmit(values) {
    if (!active) return
    setActing(true)
    try {
      await submitAtsClaim(active.id, {
        note: values?.note || '',
        evidence_url: values?.evidence_url || undefined,
      })
      message.success(`Submitted ${active.claimNo}`)
      setSubmitOpen(false)
      setActive(null)
      submitForm.resetFields()
      load()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActing(false)
    }
  }

  async function onSettle(values) {
    if (!active) return
    setActing(true)
    try {
      await settleAtsClaim(active.id, {
        outcome: values.outcome,
        note: values?.note || '',
      })
      message.success(`Settled ${active.claimNo} → ${values.outcome}`)
      setSettleOpen(false)
      setActive(null)
      settleForm.resetFields()
      load()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setActing(false)
    }
  }

  async function onDetect(autoReturn = false) {
    setDetecting(true)
    try {
      const res = await detectAtsClaims({
        auto_initiate_return: autoReturn,
        limit: 50,
      })
      setLastDetect(res)
      message.success(
        `Detect done — expired ${res?.expired?.expired ?? 0}, missing-arrival ${res?.missingArrival?.detected ?? 0}, 3×UND ${res?.tripleUnd?.candidates?.length ?? 0}`,
      )
      load(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setDetecting(false)
    }
  }

  const columns = [
    {
      title: 'Claim',
      dataIndex: 'claimNo',
      key: 'claimNo',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontFamily: 'monospace' }}>
            {v}
          </Text>
          <Space size={4}>
            <Tag color={typeColor(r.claimType)}>{r.claimType}</Tag>
            {r.overdue && <Tag color="error">OVERDUE</Tag>}
          </Space>
        </Space>
      ),
    },
    {
      title: 'CN',
      dataIndex: 'cnNo',
      key: 'cnNo',
      render: (v) => (
        <Link to={`/ops/consignments/${encodeURIComponent(v)}`} style={{ fontFamily: 'monospace', fontWeight: 700 }}>
          {v}
        </Link>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'claimStatus',
      key: 'claimStatus',
      width: 120,
      render: (v) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: 'Trigger',
      dataIndex: 'triggerStatus',
      key: 'triggerStatus',
      width: 90,
      render: (v) => <Tag>{v || '—'}</Tag>,
    },
    {
      title: 'Deadline',
      key: 'deadline',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text type={r.overdue ? 'danger' : undefined}>{r.deadlineAt || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.deadlineLabel}
            {r.hoursLeft != null ? ` · ${r.hoursLeft}h left` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Opened',
      key: 'opened',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{r.openedAt || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.openedBy || '—'} · {r.source || 'scan'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, r) => (
        <Space wrap size={4}>
          <Button size="small" onClick={() => navigate(`/ops/consignments/${encodeURIComponent(r.cnNo)}`)}>
            CN
          </Button>
          {canManage && r.claimStatus === 'OPEN' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
              onClick={() => {
                setActive(r)
                setSubmitOpen(true)
              }}
            >
              Submit
            </Button>
          )}
          {canManage && ['OPEN', 'SUBMITTED'].includes(r.claimStatus) && (
            <Button
              size="small"
              onClick={() => {
                setActive(r)
                settleForm.setFieldsValue({ outcome: 'APPROVED' })
                setSettleOpen(true)
              }}
            >
              Settle
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '8px 4px 24px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} align="start" wrap>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <WarningOutlined style={{ color: '#D97706', marginRight: 8 }} />
            ATS / Problematic Scans
          </Title>
          <Text type="secondary">
            LOST (N13, 24h) · DAMAGE (N12/N9, 4h) · REJECT (D4). Auto-opens on scan; detection finds missing arrivals and
            3× UND return candidates.
          </Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => load()}>
            Refresh
          </Button>
          {canManage && (
            <Button icon={<ThunderboltOutlined />} loading={detecting} onClick={() => onDetect(false)}>
              Run detection
            </Button>
          )}
          {canManage && (
            <Button loading={detecting} onClick={() => onDetect(true)}>
              Detect + auto-return
            </Button>
          )}
          {canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
              onClick={() => setCreateOpen(true)}
            >
              Open claim
            </Button>
          )}
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Flow windows"
        description="Overnight hold requests must be before 3:00 PM. After 3 failed deliveries (UND), return registration is 1:00–3:00 PM (force override available on those screens)."
      />

      <Space wrap style={{ marginBottom: 12 }}>
        {[
          ['ACTIVE', 'Active', (summary.open || 0) + (summary.submitted || 0)],
          ['OPEN', 'Open', summary.open || 0],
          ['OVERDUE', 'Overdue', summary.overdue || 0],
          ['SUBMITTED', 'Submitted', summary.submitted || 0],
          ['EXPIRED', 'Expired', summary.expired || 0],
          ['ALL', 'All', 0],
        ].map(([key, label, count]) => (
          <Badge key={key} count={count} overflowCount={999} offset={[-4, 4]} showZero={false}>
            <Button
              type={statusFilter === key ? 'primary' : 'default'}
              size="small"
              onClick={() => setStatus(key)}
              style={
                statusFilter === key
                  ? { background: '#1B8A5A', borderColor: '#1B8A5A' }
                  : undefined
              }
            >
              {label}
            </Button>
          </Badge>
        ))}
        <Select
          allowClear
          placeholder="Claim type"
          style={{ width: 140 }}
          value={typeFilter || undefined}
          onChange={(v) => setType(v || '')}
          options={[
            { value: 'LOST', label: 'LOST' },
            { value: 'DAMAGE', label: 'DAMAGE' },
            { value: 'REJECT', label: 'REJECT' },
          ]}
        />
        <Input.Search
          allowClear
          placeholder="CN or claim #"
          style={{ width: 220 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={() => load(1)}
          enterButton={<SearchOutlined />}
        />
      </Space>

      {lastDetect && (
        <Alert
          type="success"
          closable
          onClose={() => setLastDetect(null)}
          style={{ marginBottom: 12 }}
          message="Last detection run"
          description={
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="Expired">{lastDetect?.expired?.expired ?? 0}</Descriptions.Item>
              <Descriptions.Item label="Missing arrival">
                {lastDetect?.missingArrival?.detected ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="3× UND candidates">
                {lastDetect?.tripleUnd?.candidates?.length ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Auto returns">
                {lastDetect?.tripleUnd?.initiated ?? 0}
                {lastDetect?.tripleUnd?.returnWindowOpen === false ? ' (outside 1–3 PM)' : ''}
              </Descriptions.Item>
            </Descriptions>
          }
        />
      )}

      <DataTable
        columns={columns}
        dataSource={rows}
        rowKey={(r) => r.id || r.claimNo}
        loading={loading}
        pagination={{
          current: page,
          pageSize: 25,
          total,
          onChange: (p) => load(p),
          showTotal: (t) => `${t} claims`,
        }}
      />

      <Modal
        title="Open ATS claim"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={onCreate} initialValues={{ claim_type: 'LOST' }}>
          <Form.Item name="cn_no" label="Consignment number" rules={[{ required: true }]}>
            <Input placeholder="CN" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="claim_type" label="Claim type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'LOST', label: 'LOST (N13 / missing — 24h)' },
                { value: 'DAMAGE', label: 'DAMAGE (N12/N9 — 4h)' },
                { value: 'REJECT', label: 'REJECT (D4)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="evidence_url" label="Evidence URL">
            <Input placeholder="https://…" allowClear />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={acting} style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}>
              Open
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`Submit claim — ${active?.claimNo || ''}`}
        open={submitOpen}
        onCancel={() => setSubmitOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 12 }}
          message={active?.deadlineLabel}
          description={`Deadline ${active?.deadlineAt || '—'} · ${active?.hoursLeft ?? '—'}h left`}
        />
        <Form form={submitForm} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="note" label="Submit note">
            <Input.TextArea rows={3} placeholder="Claim details / customer statement" />
          </Form.Item>
          <Form.Item name="evidence_url" label="Evidence URL">
            <Input allowClear />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={acting} style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}>
              Submit within deadline
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`Settle claim — ${active?.claimNo || ''}`}
        open={settleOpen}
        onCancel={() => setSettleOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={settleForm} layout="vertical" onFinish={onSettle}>
          <Form.Item name="outcome" label="Outcome" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'APPROVED', label: 'APPROVED' },
                { value: 'REJECTED', label: 'REJECTED' },
                { value: 'CLOSED', label: 'CLOSED' },
                { value: 'EXPIRED', label: 'EXPIRED' },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="Settle note">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setSettleOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={acting}>
              Settle
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
