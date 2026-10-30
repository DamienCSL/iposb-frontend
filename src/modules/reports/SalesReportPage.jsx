import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Row,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd'
import { PrinterOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { apiError, getReport } from '../../api/client'
import SummaryScopeBanner from '../../components/SummaryScopeBanner'
import { money } from '../../ui/bits'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .sales-report-print, .sales-report-print * { visibility: visible !important; }
  .sales-report-print {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 12px 16px;
  }
  .no-print { display: none !important; }
  .sales-report-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .sales-report-table th, .sales-report-table td {
    border: 1px solid #bfbfbf;
    padding: 4px 6px;
    vertical-align: top;
  }
  .sales-report-table th { background: #f5f5f5; font-weight: 700; }
  .sales-report-title { text-align: center; font-size: 18px; font-weight: 700; margin: 0 0 4px; }
  .sales-report-date { text-align: right; font-size: 12px; margin-bottom: 12px; }
  .sales-report-total { text-align: right; font-weight: 700; margin-top: 10px; font-size: 13px; }
}
`

function fmtQty(v) {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

export default function SalesReportPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({
    rows: [],
    lookups: [],
    totals: { amount: 0, count: 0 },
    area: null,
    scope: null,
    title: '',
    dateLabel: '',
    needDrop: false,
    dropLocked: false,
  })

  async function load(values) {
    setLoading(true)
    try {
      const range = values?.range
      const q = {
        drop_code: values?.drop_code || '',
        date_from: range?.[0] ? range[0].format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        date_to: range?.[1] ? range[1].format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      }
      const res = await getReport('sales', q)
      setData({
        rows: res.rows || [],
        lookups: res.lookups || [],
        totals: res.totals || { amount: 0, count: 0 },
        area: res.area || null,
        scope: res.scope || null,
        title: res.title || '',
        dateLabel: res.dateLabel || '',
        needDrop: !!res.needDrop,
        dropLocked: !!res.dropLocked,
        message: res.message || '',
      })
      if (res.dropLocked && res.area?.code) {
        form.setFieldsValue({ drop_code: res.area.code })
      } else if (!values?.drop_code && res.lookups?.length === 1) {
        form.setFieldsValue({ drop_code: res.lookups[0].code })
      }
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    form.setFieldsValue({ range: [dayjs(), dayjs()] })
    load({ range: [dayjs(), dayjs()] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = useMemo(
    () => [
      { title: 'No', dataIndex: 'no', key: 'no', width: 56, align: 'center' },
      {
        title: 'Consignment Number',
        dataIndex: 'consignmentNumber',
        key: 'consignmentNumber',
        render: (v) => (
          <Text style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A' }}>{v || '—'}</Text>
        ),
      },
      { title: 'Partner', dataIndex: 'partner', key: 'partner', width: 110, render: (v) => v || '' },
      { title: 'Sender Name', dataIndex: 'senderName', key: 'senderName', render: (v) => v || '' },
      { title: 'From - To', dataIndex: 'fromTo', key: 'fromTo', render: (v) => v || '' },
      {
        title: 'Quantity',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 90,
        align: 'right',
        render: (v) => fmtQty(v),
      },
      {
        title: 'Amount',
        dataIndex: 'amount',
        key: 'amount',
        width: 100,
        align: 'right',
        render: (v) => money(v),
      },
      {
        title: 'Term of Payment',
        dataIndex: 'termOfPayment',
        key: 'termOfPayment',
        width: 130,
      },
    ],
    [],
  )

  const titleText = data.title || (data.area?.name ? `${data.area.name} Sales Report` : 'Sales Report')
  const dateText =
    data.dateLabel ||
    (() => {
      const range = form.getFieldValue('range')
      if (range?.[0] && range?.[1]) {
        return `Date: ${range[0].format('YYYY-MM-DD')} - ${range[1].format('YYYY-MM-DD')}`
      }
      return ''
    })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{PRINT_CSS}</style>

      <div className="no-print">
        <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
          Sales Report
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Node sales listing by drop point — print-ready format matching the counter sales report.
        </Text>
      </div>

      <div className="no-print">
        <SummaryScopeBanner scope={data.scope} />
      </div>

      <Card size="small" className="no-print">
        <Form form={form} layout="vertical" onFinish={load}>
          <Row gutter={12} align="bottom">
            <Col xs={24} md={8}>
              <Form.Item
                name="drop_code"
                label="Drop point / area"
                style={{ marginBottom: 0 }}
                rules={
                  data.dropLocked
                    ? []
                    : [{ required: true, message: 'Select a drop point' }]
                }
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={data.dropLocked}
                  placeholder="Select drop point"
                  options={(data.lookups || []).map((l) => ({
                    value: l.code,
                    label: `${l.code}${l.name ? ` — ${l.name}` : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="range" label="Date range" style={{ marginBottom: 0 }}>
                <RangePicker style={{ width: '100%' }} allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                  Run
                </Button>
                <Button
                  icon={<PrinterOutlined />}
                  disabled={!data.area || !(data.rows || []).length}
                  onClick={() => window.print()}
                >
                  Print
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      {data.needDrop && !data.area ? (
        <Alert
          className="no-print"
          type="info"
          showIcon
          message={data.message || 'Select a drop point to run the sales report.'}
        />
      ) : null}

      <Card size="small" className="sales-report-print" bodyStyle={{ paddingTop: 16 }}>
        <div className="sales-report-title">{titleText}</div>
        {dateText ? <div className="sales-report-date">{dateText}</div> : null}

        <Table
          className="sales-report-table-wrap"
          size="small"
          rowKey={(r) => `${r.no}-${r.consignmentNumber}`}
          columns={columns}
          dataSource={data.rows || []}
          loading={loading}
          pagination={false}
          locale={{ emptyText: data.needDrop ? 'Select a drop point and run the report.' : 'No consignments in this range.' }}
          summary={() =>
            (data.rows || []).length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6} align="right">
                  <strong>Total:</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong>{money(data.totals?.amount || 0)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
              </Table.Summary.Row>
            ) : null
          }
        />

        {/* Print-only HTML table for cleaner PDF layout */}
        <table className="sales-report-table" style={{ display: 'none' }}>
          <thead>
            <tr>
              <th>No</th>
              <th>Consignment Number</th>
              <th>Partner</th>
              <th>Sender Name</th>
              <th>From - To</th>
              <th>Quantity</th>
              <th>Amount</th>
              <th>Term of Payment</th>
            </tr>
          </thead>
          <tbody>
            {(data.rows || []).map((r) => (
              <tr key={`${r.no}-${r.consignmentNumber}`}>
                <td>{r.no}.</td>
                <td>{r.consignmentNumber || ''}</td>
                <td>{r.partner || ''}</td>
                <td>{r.senderName || ''}</td>
                <td>{r.fromTo || ''}</td>
                <td style={{ textAlign: 'right' }}>{fmtQty(r.quantity)}</td>
                <td style={{ textAlign: 'right' }}>{r.amount != null ? Number(r.amount).toFixed(2) : ''}</td>
                <td>{r.termOfPayment || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data.rows || []).length > 0 ? (
          <div className="sales-report-total" style={{ display: 'none' }}>
            Total: {Number(data.totals?.amount || 0).toFixed(2)}
          </div>
        ) : null}
      </Card>

      <style>{`
        @media print {
          .sales-report-table-wrap { display: none !important; }
          .sales-report-table { display: table !important; }
          .sales-report-total { display: block !important; }
        }
      `}</style>
    </div>
  )
}
