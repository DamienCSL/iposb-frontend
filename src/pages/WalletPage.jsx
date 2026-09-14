import React, { useState } from 'react'
import { Button, Card, Col, Form, Input, Row, Space, Statistic, Typography, message } from 'antd'
import { ReloadOutlined, SearchOutlined, WalletOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { apiError, getWalletLedger } from '../api/client'
import DataTable from '../components/DataTable'
import { money } from '../ui/bits'

const { Title, Text } = Typography

export default function WalletPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({ wallet: null, entries: [] })

  async function load(values) {
    const custAcNo = (values?.custAcNo ?? form.getFieldValue('custAcNo') ?? '').trim()
    const mobileUserId = (values?.mobileUserId ?? form.getFieldValue('mobileUserId') ?? '').trim()
    if (!custAcNo && !mobileUserId) {
      message.warning('Enter a customer account or mobile user id.')
      return
    }
    setLoading(true)
    try {
      const params = {}
      if (custAcNo) params.cust_ac_no = custAcNo
      if (mobileUserId) params.mobile_user_id = mobileUserId
      setData(await getWalletLedger(params))
    } catch (err) {
      message.error(apiError(err))
      setData({ wallet: null, entries: [] })
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v) => String(v || '').slice(0, 16) || '—',
    },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 120 },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (v) => money(v) },
    { title: 'Balance', dataIndex: 'balanceAfter', key: 'balanceAfter', render: (v) => money(v) },
    {
      title: 'CN',
      dataIndex: 'cnNo',
      key: 'cnNo',
      render: (cn) =>
        cn ? (
          <Link to={`/ops/consignments/tracking?cn=${encodeURIComponent(cn)}`} style={{ fontFamily: 'monospace', color: '#1B8A5A' }}>
            {cn}
          </Link>
        ) : (
          '—'
        ),
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>Customer Wallet</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          View wallet balance and refund ledger entries from order cancellations.
        </Text>
      </div>

      <Card size="small">
        <Form form={form} layout="vertical" onFinish={load}>
          <Row gutter={12} align="bottom">
            <Col xs={24} md={8}>
              <Form.Item name="custAcNo" label="Customer account" style={{ marginBottom: 0 }}>
                <Input placeholder="e.g. C0001" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="mobileUserId" label="Mobile user id" style={{ marginBottom: 0 }}>
                <Input placeholder="optional" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                  Load
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => form.submit()} disabled={loading}>
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      {data.wallet ? (
        <Card size="small">
          <Statistic
            title="Wallet balance"
            value={Number(data.wallet.balance || 0)}
            precision={2}
            prefix={<WalletOutlined style={{ color: '#1B8A5A' }} />}
            suffix="MYR"
            valueStyle={{ color: '#1B8A5A', fontWeight: 700 }}
          />
        </Card>
      ) : null}

      <DataTable
        rowKey="id"
        columns={columns}
        dataSource={data.entries || []}
        loading={loading}
        pagination={{ pageSize: 25, showSizeChanger: false }}
      />
    </div>
  )
}
