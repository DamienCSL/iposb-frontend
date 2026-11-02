import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CloseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  apiError,
  closeRunsheet,
  createRunsheet,
  getDispatchDrivers,
  getRunsheet,
  listRunsheets,
  updateRunsheet,
} from '../../api/client'
import { money } from '../../ui/bits'

const { Title, Text } = Typography
const { TextArea } = Input

export default function RunsheetsPage() {
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [drivers, setDrivers] = useState([])
  const [filterDate, setFilterDate] = useState(dayjs())
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const driverOptions = useMemo(
    () =>
      (drivers || []).map((d) => ({
        value: Number(d.driver_id ?? d.driverId),
        label: `${d.full_name || d.fullName || `Driver #${d.driver_id}`} (${d.phone || '—'})`,
      })),
    [drivers],
  )

  async function loadDrivers() {
    try {
      // available=0 → all courier drivers (not only currently available)
      const list = await getDispatchDrivers({ available: 0 })
      setDrivers(Array.isArray(list) ? list : [])
    } catch (err) {
      message.error(apiError(err))
    }
  }

  async function loadList(date = filterDate) {
    setLoading(true)
    try {
      const res = await listRunsheets({
        date: date ? date.format('YYYY-MM-DD') : '',
      })
      setRows(res.rows || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrivers()
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openDetail(id) {
    try {
      const res = await getRunsheet(id)
      setDetail(res.runsheet || null)
      setDetailOpen(true)
      if (res.runsheet) {
        editForm.setFieldsValue({
          note: res.runsheet.note || '',
          helper_driver_ids: (res.runsheet.crew || [])
            .filter((c) => c.role === 'HELPER')
            .map((c) => c.driverId),
        })
      }
    } catch (err) {
      message.error(apiError(err))
    }
  }

  async function onCreate(values) {
    setSaving(true)
    try {
      const res = await createRunsheet({
        lead_driver_id: values.lead_driver_id,
        run_date: values.run_date.format('YYYY-MM-DD'),
        helper_driver_ids: values.helper_driver_ids || [],
        note: values.note || '',
      })
      message.success('Runsheet created')
      setCreateOpen(false)
      form.resetFields()
      await loadList()
      if (res.runsheet?.id) openDetail(res.runsheet.id)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onSaveDetail() {
    if (!detail?.id || detail.status === 'CLOSED') return
    setSaving(true)
    try {
      const values = await editForm.validateFields()
      const res = await updateRunsheet(detail.id, {
        helper_driver_ids: values.helper_driver_ids || [],
        note: values.note || '',
      })
      message.success('Runsheet updated')
      setDetail(res.runsheet || null)
      await loadList()
    } catch (err) {
      if (err?.errorFields) return
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onCloseRunsheet() {
    if (!detail?.id) return
    setSaving(true)
    try {
      const res = await closeRunsheet(detail.id)
      message.success('Runsheet closed')
      setDetail(res.runsheet || null)
      await loadList()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'runDate',
      key: 'runDate',
      width: 120,
    },
    {
      title: 'Lead driver',
      key: 'lead',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.leadDriverName || `Driver #${r.leadDriverId}`}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.leadDriverPhone || '—'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Crew',
      dataIndex: 'crewCount',
      key: 'crewCount',
      width: 80,
      align: 'center',
      render: (v) => <Tag icon={<TeamOutlined />}>{v || 0}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) => (
        <Tag color={v === 'CLOSED' ? 'default' : 'green'}>{v || 'OPEN'}</Tag>
      ),
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => openDetail(r.id)}>
          Open
        </Button>
      ),
    },
  ]

  const leadIdWatch = Form.useWatch('lead_driver_id', form)
  const helperOptionsCreate = driverOptions.filter((o) => o.value !== leadIdWatch)
  const helperOptionsEdit = driverOptions.filter((o) => o.value !== detail?.leadDriverId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
            Delivery Runsheets
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Record helpers who rode with the lead driver. Delivery earnings that day split equally across the crew.
          </Text>
        </div>
        <Space>
          <DatePicker
            value={filterDate}
            onChange={(d) => {
              setFilterDate(d)
              loadList(d)
            }}
            allowClear={false}
          />
          <Button icon={<ReloadOutlined />} onClick={() => loadList()} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.setFieldsValue({
                run_date: filterDate || dayjs(),
                helper_driver_ids: [],
                note: '',
              })
              setCreateOpen(true)
            }}
          >
            New runsheet
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="How splits work"
        description="When a delivery earning accrues for the lead driver on the runsheet date, the amount is split equally across the lead + helpers. Partner commission is not affected."
      />

      <Card size="small" bodyStyle={{ paddingTop: 0 }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: 'No runsheets for this date.' }}
        />
      </Card>

      <Modal
        title="New delivery runsheet"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Create"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item
            name="run_date"
            label="Run date"
            rules={[{ required: true, message: 'Pick a date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="lead_driver_id"
            label="Lead driver (drives)"
            rules={[{ required: true, message: 'Select lead driver' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select lead driver"
              options={driverOptions}
            />
          </Form.Item>
          <Form.Item name="helper_driver_ids" label="Helpers">
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Select helper drivers"
              options={helperOptionsCreate}
            />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <TextArea rows={2} maxLength={255} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={
          detail
            ? `Runsheet · ${detail.runDate} · ${detail.leadDriverName || `Driver #${detail.leadDriverId}`}`
            : 'Runsheet'
        }
        width={560}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        extra={
          detail?.status === 'OPEN' ? (
            <Space>
              <Button onClick={onSaveDetail} loading={saving}>
                Save
              </Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={onCloseRunsheet} loading={saving}>
                Close
              </Button>
            </Space>
          ) : (
            <Tag>CLOSED</Tag>
          )
        }
      >
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Row gutter={12}>
              <Col span={12}>
                <Text type="secondary">Status</Text>
                <div>
                  <Tag color={detail.status === 'CLOSED' ? 'default' : 'green'}>{detail.status}</Tag>
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Crew size</Text>
                <div style={{ fontWeight: 600 }}>{(detail.crew || []).length}</div>
              </Col>
            </Row>

            <Form form={editForm} layout="vertical" disabled={detail.status === 'CLOSED'}>
              <Form.Item name="helper_driver_ids" label="Helpers">
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  options={helperOptionsEdit}
                  placeholder="Select helpers"
                />
              </Form.Item>
              <Form.Item name="note" label="Note">
                <TextArea rows={2} maxLength={255} />
              </Form.Item>
            </Form>

            <div>
              <Text strong>Crew</Text>
              <Table
                size="small"
                pagination={false}
                rowKey={(r) => `${r.role}-${r.driverId}`}
                dataSource={detail.crew || []}
                style={{ marginTop: 8 }}
                columns={[
                  {
                    title: 'Role',
                    dataIndex: 'role',
                    width: 90,
                    render: (v) => <Tag color={v === 'LEAD' ? 'blue' : 'default'}>{v}</Tag>,
                  },
                  {
                    title: 'Driver',
                    key: 'name',
                    render: (_, r) => r.fullName || `#${r.driverId}`,
                  },
                  { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
                ]}
              />
            </div>

            <div>
              <Text strong>Delivery earnings that day</Text>
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={detail.earnings || []}
                style={{ marginTop: 8 }}
                locale={{ emptyText: 'No delivery earnings recorded yet.' }}
                columns={[
                  { title: 'CN', dataIndex: 'cnNo', render: (v) => <Text code>{v}</Text> },
                  {
                    title: 'Driver',
                    dataIndex: 'driverName',
                    render: (v, r) => v || `#${r.driverId}`,
                  },
                  {
                    title: 'Amount',
                    dataIndex: 'amount',
                    align: 'right',
                    render: (v) => money(v),
                  },
                  { title: 'Status', dataIndex: 'status', width: 90 },
                ]}
              />
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
