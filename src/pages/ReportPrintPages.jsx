import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Typography,
  message,
} from 'antd'
import { PrinterOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { apiError, getPrint, getReport } from '../api/client'
import CnLabelPrint from '../components/CnLabelPrint'
import DataTable from '../components/DataTable'
import StatusTag from '../components/StatusTag'
import { money } from '../ui/bits'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export function ReportPage({ kind, title }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({ rows: [], lookups: [] })

  async function load(values) {
    setLoading(true)
    try {
      const q = {
        code: values?.code || '',
        date_from: values?.range?.[0] ? values.range[0].format('YYYY-MM-DD') : '',
        date_to: values?.range?.[1] ? values.range[1].format('YYYY-MM-DD') : '',
      }
      setData(await getReport(kind, q))
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const columns = [
    {
      title: 'CN',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (v) => <Text style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A' }}>{v}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'cn_status',
      key: 'cn_status',
      render: (v) => <StatusTag status={v} />,
    },
    { title: 'Origin', dataIndex: 'cn_origin', key: 'cn_origin', width: 80 },
    { title: 'Dest', dataIndex: 'cn_dstn', key: 'cn_dstn', width: 80 },
    { title: 'Pcs', dataIndex: 'cn_pcs', key: 'cn_pcs', width: 70 },
    { title: 'Wt', dataIndex: 'cn_wt', key: 'cn_wt', width: 80 },
    { title: 'Amount', dataIndex: 'tot_cn_amt', key: 'tot_cn_amt', render: (v) => money(v) },
    { title: 'Date', dataIndex: 'cn_dt_tm', key: 'cn_dt_tm', width: 150 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>{title}</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>Stock / summary report for operations and finance.</Text>
      </div>

      <Card size="small">
        <Form form={form} layout="vertical" onFinish={load}>
          <Row gutter={12} align="bottom">
            <Col xs={24} md={8}>
              <Form.Item name="code" label="Filter code" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  placeholder="All"
                  options={(data.lookups || []).map((l) => ({
                    value: l.code,
                    label: `${l.code} ${l.name || ''}`.trim(),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="range" label="Date range" style={{ marginBottom: 0 }}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                Run
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      <DataTable
        rowKey="cn_no"
        columns={columns}
        dataSource={data.rows || []}
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: false }}
      />
    </div>
  )
}

export function PrintPage({ kind, title, idLabel }) {
  const [form] = Form.useForm()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const isCn = kind === 'cn'
  const formatFromUrl = searchParams.get('format') === 'a5' ? 'a5' : 'a4-4'
  const [cnFormat, setCnFormat] = useState(formatFromUrl)

  async function run(values) {
    const id = String(values?.id || '').trim()
    if (!id) return
    setLoading(true)
    try {
      setData(await getPrint(kind, id))
      if (isCn) {
        const next = new URLSearchParams(searchParams)
        next.set('id', id)
        next.set('format', cnFormat)
        setSearchParams(next, { replace: true })
      }
    } catch (err) {
      message.error(apiError(err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isCn) return
    const id = String(searchParams.get('id') || '').trim()
    if (!id) return
    form.setFieldsValue({ id })
    const fmt = searchParams.get('format') === 'a5' ? 'a5' : 'a4-4'
    setCnFormat(fmt)
    run({ id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  function onFormatChange(value) {
    setCnFormat(value)
    if (isCn && searchParams.get('id')) {
      const next = new URLSearchParams(searchParams)
      next.set('format', value)
      setSearchParams(next, { replace: true })
    }
  }

  const cnRows = isCn
    ? (data?.rows?.length ? data.rows : data?.row ? [data.row] : [])
    : []

  const lineColumns =
    data?.lines?.length > 0
      ? Object.keys(data.lines[0]).map((k) => ({
          title: k,
          dataIndex: k,
          key: k,
          render: (v) => (v == null ? '—' : String(v)),
        }))
      : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="no-print">
        <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>{title}</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {isCn
            ? 'Print cuttable consignment notes (A5 single or A4 · 4 per page) with barcode and QR.'
            : 'Look up a document and print a preview.'}
        </Text>
      </div>

      <Card size="small" className="no-print">
        <Form
          form={form}
          layout={isCn ? 'vertical' : 'inline'}
          onFinish={run}
          initialValues={isCn ? { format: 'a4-4' } : undefined}
        >
          {isCn ? (
            <Row gutter={12} align="bottom">
              <Col xs={24} md={12}>
                <Form.Item
                  name="id"
                  label={idLabel}
                  rules={[{ required: true, message: `Enter ${idLabel}` }]}
                  style={{ marginBottom: 0 }}
                  extra="One CN, or several separated by comma / space / newline (up to 4 fit on one A4)."
                >
                  <Input.TextArea
                    placeholder={'e.g. CN25090001\nor CN25090001, CN25090002, CN25090003, CN25090004'}
                    rows={3}
                    allowClear
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Print format" style={{ marginBottom: 0 }}>
                  <Radio.Group
                    value={cnFormat}
                    onChange={(e) => onFormatChange(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    options={[
                      { value: 'a4-4', label: 'A4 · 4 per page' },
                      { value: 'a5', label: 'A5 · 1 per page' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading} block>
                  Preview
                </Button>
              </Col>
            </Row>
          ) : (
            <>
              <Form.Item name="id" rules={[{ required: true, message: `Enter ${idLabel}` }]}>
                <Input placeholder={idLabel} style={{ width: 280 }} allowClear />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                  Print preview
                </Button>
              </Form.Item>
            </>
          )}
        </Form>
      </Card>

      {data && !(isCn ? cnRows.length : data.row) ? (
        <Alert type="warning" showIcon className="no-print" message="No record found for that number." />
      ) : null}

      {isCn && cnRows.length ? (
        <>
          <Card
            size="small"
            className="no-print"
            title={`${data.title || title} · ${cnRows.length} note${cnRows.length === 1 ? '' : 's'}`}
            extra={
              <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
                Print
              </Button>
            }
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {cnFormat === 'a4-4'
                ? 'Cut along the dashed guides. Each slot is one consignment note with barcode + QR.'
                : 'One full consignment note per A5 page.'}
            </Text>
          </Card>
          <div className="cn-print-area">
            <CnLabelPrint rows={cnRows} format={cnFormat} />
          </div>
        </>
      ) : null}

      {!isCn && data?.row ? (
        <Card
          size="small"
          title={data.title || title}
          extra={
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print
            </Button>
          }
        >
          <Descriptions size="small" column={1} bordered>
            {Object.entries(data.row).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>
                {v == null ? '—' : String(v)}
              </Descriptions.Item>
            ))}
          </Descriptions>
          {data.lines?.length ? (
            <div style={{ marginTop: 16 }}>
              <DataTable
                rowKey={(_, i) => String(i)}
                columns={lineColumns}
                dataSource={data.lines}
                pagination={false}
                size="small"
              />
            </div>
          ) : null}
        </Card>
      ) : null}

      {!data && (
        <Text type="secondary" className="no-print">
          Enter a number to preview.
        </Text>
      )}
    </div>
  )
}
