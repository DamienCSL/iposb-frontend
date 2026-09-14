import React, { useEffect, useState } from 'react'
import { Button, Card, Col, DatePicker, Form, Input, Row, Space, Typography, message } from 'antd'
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { apiError, getSummary } from '../api/client'
import DataTable from '../components/DataTable'
import StatusTag from '../components/StatusTag'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const TITLES = {
  overall: 'Consignment Status Summary',
  status: 'Summary by Status',
  'drop-point': 'Summary by Drop Point',
  agent: 'Summary by Drop Point',
  consignee: 'Summary by Consignee',
  consigner: 'Summary by Consigner',
  shipper: 'Summary by Shipper',
  manifest: 'Summary by Manifest',
  date: 'Summary by Date',
  branch: 'Summary by Branch',
}

export default function SummaryPage({ kind = 'status' }) {
  const [params, setParams] = useSearchParams()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({ rows: [], totals: {} })
  const apiKind = kind === 'overall' ? 'status' : kind

  useEffect(() => {
    form.setFieldsValue({
      range:
        params.get('date_from') || params.get('date_to')
          ? [
              params.get('date_from') ? dayjs(params.get('date_from')) : null,
              params.get('date_to') ? dayjs(params.get('date_to')) : null,
            ]
          : null,
      cn_origin: params.get('cn_origin') || '',
    })
  }, [params, form])

  useEffect(() => {
    setLoading(true)
    getSummary(apiKind, Object.fromEntries(params.entries()))
      .then(setData)
      .catch((err) => message.error(apiError(err)))
      .finally(() => setLoading(false))
  }, [apiKind, params])

  function applyFilters(values) {
    const next = {}
    if (values.cn_origin) next.cn_origin = values.cn_origin
    if (values.range?.[0]) next.date_from = values.range[0].format('YYYY-MM-DD')
    if (values.range?.[1]) next.date_to = values.range[1].format('YYYY-MM-DD')
    setParams(next)
  }

  const columns = [
    {
      title: 'Key',
      key: 'key',
      width: 120,
      render: (_, r) => <StatusTag status={r.key_code || r.cn_status || '—'} />,
    },
    {
      title: 'Description',
      key: 'label',
      render: (_, r) => r.key_label || r.status_desc || '—',
    },
    { title: 'Count', dataIndex: 'cnt', key: 'cnt', width: 90 },
    { title: 'Total pieces', dataIndex: 'total_pcs', key: 'total_pcs', width: 110 },
    {
      title: 'Total weight (kg)',
      dataIndex: 'total_wt',
      key: 'total_wt',
      width: 130,
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      title: '%',
      dataIndex: 'pct',
      key: 'pct',
      width: 80,
      render: (v) => `${v ?? 0}%`,
    },
  ]

  const rows = [...(data.rows || [])]
  if (rows.length) {
    rows.push({
      key_code: 'TOTAL',
      key_label: 'TOTAL',
      cnt: data.totals?.cnt,
      total_pcs: data.totals?.total_pcs,
      total_wt: data.totals?.total_wt,
      pct: 100,
      __total: true,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>{TITLES[kind] || 'Status Summary'}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Operational volume by selected grouping.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setParams(Object.fromEntries(params.entries()))}>
          Refresh
        </Button>
      </div>

      <Card size="small">
        <Form form={form} layout="vertical" onFinish={applyFilters}>
          <Row gutter={12} align="bottom">
            <Col xs={24} md={10}>
              <Form.Item name="range" label="Date range" style={{ marginBottom: 0 }}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="cn_origin" label="Origin branch" style={{ marginBottom: 0 }}>
                <Input maxLength={3} placeholder="e.g. BKI" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                Filter
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      <DataTable
        rowKey={(r, i) => `${r.key_code || r.cn_status || 'row'}-${i}`}
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        rowClassName={(r) => (r.__total ? 'iposb-summary-total' : '')}
      />
    </div>
  )
}
