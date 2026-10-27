import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CalculatorOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  apiError,
  getFourFeeConfig,
  quoteFourFees,
  updateFourFeeConfig,
} from '../api/client'
import { money } from '../ui/bits'

const { Title, Text, Paragraph } = Typography
const BRAND = '#1B8A5A'

const FEE_LABELS = {
  waybill: 'Waybill',
  transport: 'Transport',
  handling: 'Handling',
  delivery: 'Delivery (last-mile)',
}

function emptyBand(corridor = 'same_city') {
  return {
    id: undefined,
    corridor,
    weightMinKg: 0.01,
    weightMaxKg: 0.5,
    waybillRm: 0,
    transportRm: 0,
    handlingRm: 0,
    deliveryRm: 0,
    isActive: true,
    sortOrder: 0,
    notes: '',
    _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  }
}

export default function FourFeePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cfg, setCfg] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [tableCode, setTableCode] = useState('IPOSB')
  const [bands, setBands] = useState([])
  const [modes, setModes] = useState([])
  const [exceptions, setExceptions] = useState([])
  const [quoteForm] = Form.useForm()
  const [quoteResult, setQuoteResult] = useState(null)
  const [quoting, setQuoting] = useState(false)

  const corridorOptions = useMemo(
    () => (cfg?.corridors || []).map((c) => ({ value: c.code, label: `${c.label} (${c.code})` })),
    [cfg],
  )
  const calcModeOptions = useMemo(
    () => (cfg?.calcModes || []).map((m) => ({ value: m.code, label: m.label })),
    [cfg],
  )
  const exceptionRuleOptions = useMemo(
    () => (cfg?.exceptionRuleModes || []).map((m) => ({ value: m.code, label: m.label })),
    [cfg],
  )
  const payeeOptions = useMemo(
    () => (cfg?.payeeRoles || []).map((r) => ({ value: r.code, label: r.label })),
    [cfg],
  )
  const tableOptions = useMemo(
    () => (cfg?.tables || []).map((t) => ({
      value: t.tableCode,
      label: `${t.label || t.tableCode}${t.isDefault ? ' (default)' : ''}`,
    })),
    [cfg],
  )

  const applyConfig = useCallback((data, preferTable) => {
    setCfg(data)
    setEnabled(Boolean(data?.enabled))
    const nextTable = preferTable || data?.viewTable || data?.defaultTable || 'IPOSB'
    setTableCode(nextTable)
    setBands((data?.bands || []).map((b, i) => ({ ...b, _key: b.id ? `id-${b.id}` : `row-${i}` })))
    setModes((data?.modes || []).map((m) => ({ ...m })))
    setExceptions((data?.exceptions || []).map((e) => ({ ...e })))
  }, [])

  const load = useCallback(async (code) => {
    setLoading(true)
    try {
      const data = await getFourFeeConfig(code ? { tableCode: code } : {})
      applyConfig(data, code)
      if (!data?.installed) {
        message.warning(data?.hint || 'Four-fee tables not installed yet — run migration 076.')
      }
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }, [applyConfig])

  useEffect(() => {
    load()
  }, [load])

  const onChangeTable = async (code) => {
    setTableCode(code)
    await load(code)
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      const body = {
        enabled,
        defaultTable: tableCode,
        tableCode,
        bands: bands.map(({ _key, _delete, ...rest }) => ({
          ...rest,
          _delete: Boolean(_delete),
        })),
        modes,
        exceptions,
      }
      const res = await updateFourFeeConfig(body)
      applyConfig(res?.config || (await getFourFeeConfig({ tableCode })), tableCode)
      message.success('Four-fee settings saved')
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const runQuote = async () => {
    try {
      const values = await quoteForm.validateFields()
      setQuoting(true)
      setQuoteResult(null)
      const res = await quoteFourFees({
        tableCode,
        corridor: values.corridor,
        weightKg: values.weightKg,
        deliveryFee: values.deliveryFee ?? 0,
      })
      setQuoteResult(res)
    } catch (err) {
      if (err?.errorFields) return
      message.error(apiError(err))
    } finally {
      setQuoting(false)
    }
  }

  const bandColumns = [
    {
      title: 'Corridor',
      dataIndex: 'corridor',
      width: 160,
      render: (v, row) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={v}
          options={corridorOptions}
          disabled={row._delete}
          onChange={(val) => setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, corridor: val } : b)))}
        />
      ),
    },
    {
      title: 'Min kg',
      dataIndex: 'weightMinKg',
      width: 90,
      render: (v, row) => (
        <InputNumber
          size="small"
          min={0.01}
          step={0.01}
          value={v}
          disabled={row._delete}
          onChange={(val) => setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, weightMinKg: val } : b)))}
        />
      ),
    },
    {
      title: 'Max kg',
      dataIndex: 'weightMaxKg',
      width: 90,
      render: (v, row) => (
        <InputNumber
          size="small"
          min={0.01}
          step={0.01}
          value={v}
          disabled={row._delete}
          onChange={(val) => setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, weightMaxKg: val } : b)))}
        />
      ),
    },
    {
      title: 'Waybill',
      dataIndex: 'waybillRm',
      width: 90,
      render: (v, row) => (
        <InputNumber size="small" min={0} step={0.1} value={v} disabled={row._delete}
          onChange={(val) => setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, waybillRm: val } : b)))} />
      ),
    },
    {
      title: 'Transport',
      dataIndex: 'transportRm',
      width: 90,
      render: (v, row) => (
        <InputNumber size="small" min={0} step={0.1} value={v} disabled={row._delete}
          onChange={(val) => setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, transportRm: val } : b)))} />
      ),
    },
    {
      title: 'Handling',
      dataIndex: 'handlingRm',
      width: 90,
      render: (v, row) => (
        <InputNumber size="small" min={0} step={0.1} value={v} disabled={row._delete}
          onChange={(val) => setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, handlingRm: val } : b)))} />
      ),
    },
    {
      title: 'Delivery',
      dataIndex: 'deliveryRm',
      width: 90,
      render: (v, row) => (
        <InputNumber size="small" min={0} step={0.1} value={v} disabled={row._delete}
          onChange={(val) => setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, deliveryRm: val } : b)))} />
      ),
    },
    {
      title: 'Total',
      key: 'total',
      width: 80,
      render: (_, row) => money(
        Number(row.waybillRm || 0) + Number(row.transportRm || 0) + Number(row.handlingRm || 0) + Number(row.deliveryRm || 0),
      ),
    },
    {
      title: 'On',
      dataIndex: 'isActive',
      width: 60,
      render: (v, row) => (
        <Switch
          size="small"
          checked={Boolean(v) && !row._delete}
          disabled={row._delete}
          onChange={(val) => setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, isActive: val } : b)))}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 70,
      render: (_, row) => (
        <Button
          size="small"
          danger={!row._delete}
          type="link"
          onClick={() => {
            if (!row.id) {
              setBands((prev) => prev.filter((b) => b._key !== row._key))
              return
            }
            setBands((prev) => prev.map((b) => (b._key === row._key ? { ...b, _delete: !b._delete } : b)))
          }}
        >
          {row._delete ? 'Undo' : 'Del'}
        </Button>
      ),
    },
  ]

  const modeColumns = [
    {
      title: 'Fee',
      dataIndex: 'feeCode',
      width: 160,
      render: (v) => <Text strong>{FEE_LABELS[v] || v}</Text>,
    },
    {
      title: 'Calc mode',
      dataIndex: 'calcMode',
      width: 220,
      render: (v, row) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={v}
          options={calcModeOptions}
          onChange={(val) => setModes((prev) => prev.map((m) => (m.feeCode === row.feeCode ? { ...m, calcMode: val } : m)))}
        />
      ),
    },
    {
      title: '% of delivery fee',
      dataIndex: 'pct',
      width: 130,
      render: (v, row) => (
        <InputNumber
          size="small"
          min={0}
          max={100}
          step={0.1}
          value={v}
          disabled={row.calcMode !== 'percent_of_delivery_fee'}
          onChange={(val) => setModes((prev) => prev.map((m) => (m.feeCode === row.feeCode ? { ...m, pct: val } : m)))}
        />
      ),
    },
    {
      title: 'Payee role',
      dataIndex: 'payeeRole',
      width: 180,
      render: (v, row) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={v || undefined}
          options={payeeOptions}
          allowClear
          onChange={(val) => setModes((prev) => prev.map((m) => (m.feeCode === row.feeCode ? { ...m, payeeRole: val || '' } : m)))}
        />
      ),
    },
    {
      title: 'On',
      dataIndex: 'enabled',
      width: 60,
      render: (v, row) => (
        <Switch
          size="small"
          checked={Boolean(v)}
          onChange={(val) => setModes((prev) => prev.map((m) => (m.feeCode === row.feeCode ? { ...m, enabled: val } : m)))}
        />
      ),
    },
  ]

  const exceptionColumns = [
    {
      title: 'Exception',
      dataIndex: 'exceptionCode',
      width: 120,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: 'Rule',
      dataIndex: 'ruleMode',
      width: 180,
      render: (v, row) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={v}
          options={exceptionRuleOptions}
          onChange={(val) => setExceptions((prev) => prev.map((e) => (e.exceptionCode === row.exceptionCode ? { ...e, ruleMode: val } : e)))}
        />
      ),
    },
    {
      title: '%',
      dataIndex: 'pct',
      width: 90,
      render: (v, row) => (
        <InputNumber
          size="small"
          min={0}
          max={100}
          value={v}
          disabled={!['percent', 'from_delivery_fee'].includes(row.ruleMode)}
          onChange={(val) => setExceptions((prev) => prev.map((e) => (e.exceptionCode === row.exceptionCode ? { ...e, pct: val } : e)))}
        />
      ),
    },
    {
      title: 'Fixed RM',
      dataIndex: 'amountRm',
      width: 100,
      render: (v, row) => (
        <InputNumber
          size="small"
          min={0}
          step={0.1}
          value={v}
          disabled={row.ruleMode !== 'fixed_rm'}
          onChange={(val) => setExceptions((prev) => prev.map((e) => (e.exceptionCode === row.exceptionCode ? { ...e, amountRm: val } : e)))}
        />
      ),
    },
    {
      title: 'Applies to',
      dataIndex: 'appliesToFee',
      width: 120,
      render: (v, row) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={v}
          options={[
            { value: 'delivery', label: 'Delivery' },
            { value: 'handling', label: 'Handling' },
            { value: 'all', label: 'All fees' },
          ]}
          onChange={(val) => setExceptions((prev) => prev.map((e) => (e.exceptionCode === row.exceptionCode ? { ...e, appliesToFee: val } : e)))}
        />
      ),
    },
    {
      title: 'On',
      dataIndex: 'enabled',
      width: 60,
      render: (v, row) => (
        <Switch
          size="small"
          checked={Boolean(v)}
          onChange={(val) => setExceptions((prev) => prev.map((e) => (e.exceptionCode === row.exceptionCode ? { ...e, enabled: val } : e)))}
        />
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>Four Fees (网络四费)</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Split network cost into waybill + transport + handling + delivery. Mode C: RM table first, optional % of customer delivery fee.
          </Text>
        </div>
        <Space wrap>
          <Select
            style={{ minWidth: 180 }}
            value={tableCode}
            options={tableOptions.length ? tableOptions : [{ value: 'IPOSB', label: 'IPOSB' }]}
            onChange={onChangeTable}
            disabled={loading}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load(tableCode)} disabled={loading}>
            Reload
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={saveAll}
            disabled={loading || cfg?.installed === false}
            style={{ background: BRAND, borderColor: BRAND }}
          >
            Save
          </Button>
        </Space>
      </div>

      {cfg?.installed === false && (
        <Alert type="warning" showIcon message="Migration required" description={cfg?.hint || 'Run 076_four_fee_split.sql on the API.'} />
      )}

      <Card size="small" loading={loading}>
        <Space size="large" wrap>
          <Space>
            <Text>Enable 4-fee engine</Text>
            <Switch checked={enabled} onChange={setEnabled} />
            <Tag color={enabled ? 'green' : 'default'}>{enabled ? 'ON' : 'OFF'}</Tag>
          </Space>
          <Text type="secondary">Charge / snapshot at: <Text code>{cfg?.chargeAt || 'cn_create'}</Text> (payout still later)</Text>
        </Space>
        {cfg?.hint && (
          <Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
            {cfg.hint}
          </Paragraph>
        )}
      </Card>

      <Tabs
        items={[
          {
            key: 'bands',
            label: (
              <span>
                <SettingOutlined /> Weight / corridor bands
              </span>
            ),
            children: (
              <Card
                size="small"
                title="RM amounts by corridor + kg band"
                extra={(
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setBands((prev) => [...prev, emptyBand(prev[0]?.corridor || 'same_city')])}
                  >
                    Add band
                  </Button>
                )}
              >
                <Table
                  size="small"
                  rowKey="_key"
                  pagination={false}
                  scroll={{ x: 980 }}
                  columns={bandColumns}
                  dataSource={bands}
                  rowClassName={(row) => (row._delete ? 'ant-table-row-disabled' : '')}
                />
              </Card>
            ),
          },
          {
            key: 'modes',
            label: 'Fee modes (% override)',
            children: (
              <Card size="small" title="Per-fee calc mode">
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="fixed_rm uses the band table. percent_of_delivery_fee ignores that fee’s RM and uses % of customer delivery fee instead."
                />
                <Table
                  size="small"
                  rowKey="feeCode"
                  pagination={false}
                  columns={modeColumns}
                  dataSource={modes}
                />
              </Card>
            ),
          },
          {
            key: 'exceptions',
            label: 'Exceptions',
            children: (
              <Card size="small" title="Return / destroy / fake POD rules">
                <Table
                  size="small"
                  rowKey="exceptionCode"
                  pagination={false}
                  columns={exceptionColumns}
                  dataSource={exceptions}
                />
              </Card>
            ),
          },
          {
            key: 'quote',
            label: (
              <span>
                <CalculatorOutlined /> Quote preview
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} md={10}>
                  <Card size="small" title="What-if quote">
                    <Form
                      form={quoteForm}
                      layout="vertical"
                      initialValues={{ corridor: 'same_city', weightKg: 1, deliveryFee: 7 }}
                      onFinish={runQuote}
                    >
                      <Form.Item name="corridor" label="Corridor" rules={[{ required: true }]}>
                        <Select options={corridorOptions} />
                      </Form.Item>
                      <Form.Item name="weightKg" label="Chargeable kg" rules={[{ required: true }]}>
                        <InputNumber min={0.01} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="deliveryFee" label="Customer delivery fee (RM)">
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={quoting} block style={{ background: BRAND, borderColor: BRAND }}>
                        Calculate split
                      </Button>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} md={14}>
                  <Card size="small" title="Result">
                    {!quoteResult ? (
                      <Text type="secondary">Run a quote to see the 4-fee split and margin.</Text>
                    ) : (
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Space wrap>
                          <Tag>{quoteResult.tableCode}</Tag>
                          <Tag>{quoteResult.corridor}</Tag>
                          <Tag>{quoteResult.chargeableKg} kg</Tag>
                          {quoteResult.band?.id && <Tag color="blue">band #{quoteResult.band.id}</Tag>}
                        </Space>
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="fee"
                          dataSource={Object.entries(quoteResult.fees || {}).map(([fee, row]) => ({
                            fee,
                            ...row,
                          }))}
                          columns={[
                            { title: 'Fee', dataIndex: 'fee', render: (v) => FEE_LABELS[v] || v },
                            { title: 'Amount', dataIndex: 'amountRm', render: (v) => money(v) },
                            { title: 'Mode', dataIndex: 'calcMode' },
                            { title: 'Source', dataIndex: 'source' },
                            { title: 'Payee', dataIndex: 'payeeRole' },
                          ]}
                        />
                        <Row gutter={12}>
                          <Col span={8}><Text type="secondary">Customer fee</Text><div><Text strong>{money(quoteResult.deliveryFeeRm)}</Text></div></Col>
                          <Col span={8}><Text type="secondary">4-fee total</Text><div><Text strong>{money(quoteResult.totalSplitRm)}</Text></div></Col>
                          <Col span={8}>
                            <Text type="secondary">Margin</Text>
                            <div>
                              <Text strong style={{ color: (quoteResult.marginRm || 0) >= 0 ? BRAND : '#cf1322' }}>
                                {money(quoteResult.marginRm)}
                                {quoteResult.marginPct != null ? ` (${quoteResult.marginPct}%)` : ''}
                              </Text>
                            </div>
                          </Col>
                        </Row>
                        {quoteResult.note && <Text type="secondary" style={{ fontSize: 12 }}>{quoteResult.note}</Text>}
                      </Space>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  )
}
