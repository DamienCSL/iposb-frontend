import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { apiError, calculateCommission, getCommissionConfig, updateCommissionConfig } from '../../../api/client'
import PricingTargetBar from './PricingTargetBar'
import { FORMULA_EDITORS } from './editors'
import {
  FORMULAS,
  MODES,
  activeRowsAt,
  buildSaveRows,
  describeRow,
  findFormulaRow,
  formulaBySlug,
  isAllLanes,
  laneLabel,
  mergeRows,
  normTarget,
  saveBody,
  scopeLabel,
  splitByScope,
  targetFromSearch,
  targetSearch,
} from './pricingModel'

const { Title, Text } = Typography

const BRAND = '#1B8A5A'

export default function FormulaPage() {
  const { slug } = useParams()
  const formula = formulaBySlug(slug)
  if (!formula) return <Navigate to="/ops/commissions/pricing" replace />
  return <FormulaPageInner key={formula.slug} formula={formula} />
}

function FormulaPageInner({ formula }) {
  const editor = FORMULA_EDITORS[formula.type]
  const location = useLocation()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [deliveryFeeEnabled, setDeliveryFeeEnabled] = useState(true)
  const [target, setTarget] = useState(() => targetFromSearch(location.search))
  const [enabledModes, setEnabledModes] = useState({ air: false, road: false, sea: false })
  const [draft, setDraftState] = useState(() => editor.fromRows({}))
  const [dirty, setDirty] = useState(false)
  const [focusMode, setFocusMode] = useState(() => new URLSearchParams(location.search).get('mode') || 'air')
  const [test, setTest] = useState({ mode: 'road', weight: 3, pcs: 1 })
  const [testResult, setTestResult] = useState(null)
  const [testBusy, setTestBusy] = useState(false)

  const setDraft = (fn) => {
    setDraftState(fn)
    setDirty(true)
  }

  function resetFromRows(allRows, t) {
    const byMode = Object.fromEntries(MODES.map((m) => [m.code, findFormulaRow(allRows, formula, t, m.code)]))
    setDraftState(editor.fromRows(byMode))
    setEnabledModes(Object.fromEntries(MODES.map((m) => [m.code, Boolean(byMode[m.code]?.isActive)])))
    setDirty(false)
    setTestResult(null)
  }

  function applyConfig(cfg, t = target) {
    const all = [...(cfg?.deliveryFeeRates || []), ...(cfg?.customerDeliveryFeeRates || [])]
    setRows(all)
    setDeliveryFeeEnabled(Boolean(cfg?.deliveryFeeEnabled))
    resetFromRows(all, t)
  }

  async function load() {
    setLoading(true)
    try {
      applyConfig(await getCommissionConfig())
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function changeTarget(next) {
    const go = () => {
      const t = normTarget(next)
      setTarget(t)
      resetFromRows(rows, t)
      navigate(`${location.pathname}${targetSearch(t)}`, { replace: true })
    }
    if (dirty) {
      Modal.confirm({
        title: 'Discard unsaved changes?',
        content: 'Switching customer or lane reloads the prices for that selection.',
        okText: 'Discard',
        onOk: go,
      })
    } else {
      go()
    }
  }

  const { errors, warnings } = useMemo(() => editor.validate(draft, enabledModes), [draft, enabledModes])
  const [customerMissing, setCustomerMissing] = useState(false)

  function changedRows() {
    return buildSaveRows({
      rows,
      formula,
      target,
      enabledModes,
      paramsForMode: (modeCode) => editor.paramsForMode(draft, modeCode),
      description: (m) => {
        const where = [scopeLabel(target.custAcNo), isAllLanes(target) ? null : laneLabel(target)].filter(Boolean).join(' · ')
        return `${formula.title} (${m.label}) — ${where}`
      },
    })
  }

  async function save() {
    if (customerMissing) {
      message.error('Pick the customer account first')
      return
    }
    if (errors.length) {
      message.error('Fix the errors before saving')
      return
    }
    const changed = changedRows()
    const body = saveBody(changed, { deliveryFeeEnabled })
    setSaving(true)
    try {
      const res = await updateCommissionConfig(body)
      message.success('Pricing saved')
      if (res?.config) applyConfig(res.config)
      else await load()
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  async function runTest() {
    if (errors.length) {
      message.error('Fix the errors before testing')
      return
    }
    setTestBusy(true)
    try {
      const { deliveryFeeRates, customerDeliveryFeeRates } = splitByScope(mergeRows(rows, changedRows()))
      const res = await calculateCommission({
        transportMode: test.mode,
        cn_wt: Number(test.weight) || 0,
        cn_pcs: Number(test.pcs) || 1,
        custAcNo: target.custAcNo || undefined,
        origin: target.origin || undefined,
        destination: target.destination || undefined,
        serviceType: target.serviceType || undefined,
        deliveryFeeEnabled: true,
        deliveryFeeRates,
        customerDeliveryFeeRates,
      })
      setTestResult(res)
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setTestBusy(false)
    }
  }

  const modeStatus = (m) => {
    const active = activeRowsAt(rows, target, m.code)
    const mine = findFormulaRow(rows, formula, target, m.code)
    const others = active.filter((r) => !mine || r.id !== mine.id)
    if (mine?.isActive && !others.length) return { text: 'Using this formula', color: 'green' }
    if (others.length) {
      return {
        text: `Now using ${others.map(describeRow).join(', ')}. Turning this on replaces it.`,
        color: 'orange',
      }
    }
    if (target.custAcNo) return { text: 'Not set, so this customer pays Public pricing', color: 'default' }
    if (!isAllLanes(target)) return { text: 'Not set, so this lane uses All lanes pricing', color: 'default' }
    return { text: 'Not set (falls back to the freight tariff)', color: 'default' }
  }

  const Editor = editor.Editor
  const backTo = `/ops/commissions/pricing${targetSearch(target)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link to={backTo}>
            <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0 }}>
              Customer pricing
            </Button>
          </Link>
          <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>
            {formula.title}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {formula.summary}
          </Text>
        </div>
        <Space wrap>
          <Select
            style={{ width: 230 }}
            value={formula.slug}
            onChange={(s) => {
              const go = () => navigate(`/ops/commissions/pricing/${s}${targetSearch(target)}`)
              if (dirty) Modal.confirm({ title: 'Discard unsaved changes?', okText: 'Discard', onOk: go })
              else go()
            }}
            options={FORMULAS.map((f) => ({ value: f.slug, label: f.title }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Reload
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={save}
            loading={saving}
            disabled={!dirty || errors.length > 0 || customerMissing}
            style={{ background: BRAND, borderColor: BRAND }}
          >
            Save
          </Button>
        </Space>
      </div>

      {!deliveryFeeEnabled ? (
        <Alert
          type="warning"
          showIcon
          message="Delivery-fee quoting is off"
          description={
            <Space wrap>
              <span>Live quotes use the freight tariff until this is on, so these prices won't be charged.</span>
              <Switch
                checked={deliveryFeeEnabled}
                onChange={(v) => {
                  setDeliveryFeeEnabled(v)
                  setDirty(true)
                }}
                checkedChildren="On"
                unCheckedChildren="Off"
              />
              <Text type="secondary">(saved with this page)</Text>
            </Space>
          }
        />
      ) : null}

      <Card size="small" styles={{ body: { padding: 16 } }}>
        <PricingTargetBar rows={rows} target={target} onChange={changeTarget} onCustomerPending={setCustomerMissing} />
        {customerMissing ? (
          <Alert type="info" showIcon style={{ marginTop: 12 }} message="Pick the customer account before editing their prices." />
        ) : null}
      </Card>

      <Card
        size="small"
        title={`Use this formula for (${scopeLabel(target.custAcNo)} · ${laneLabel(target)})`}
        styles={{ body: { padding: 16 } }}
      >
        <Row gutter={[16, 12]}>
          {MODES.map((m) => {
            const status = modeStatus(m)
            return (
              <Col xs={24} md={8} key={m.code}>
                <Card size="small" style={{ background: enabledModes[m.code] ? '#f6ffed' : '#fafafa', height: '100%' }}>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Text strong>{m.label}</Text>
                      <Switch
                        checked={enabledModes[m.code]}
                        onChange={(v) => {
                          setEnabledModes((s) => ({ ...s, [m.code]: v }))
                          setDirty(true)
                          if (v) setFocusMode(m.code)
                        }}
                        checkedChildren="On"
                        unCheckedChildren="Off"
                      />
                    </Space>
                    <Tag color={status.color} style={{ whiteSpace: 'normal', margin: 0 }}>
                      {status.text}
                    </Tag>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          Each mode uses one formula here. Saving with a mode on turns off whatever else was pricing that mode for this
          selection.
        </Text>
      </Card>

      <Card size="small" title="Prices" styles={{ body: { padding: 16 } }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {errors.length ? (
            <Alert
              type="error"
              showIcon
              message="Fix these before saving"
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              }
            />
          ) : null}
          {warnings.map((w) => (
            <Alert key={w} type="warning" showIcon message={w} />
          ))}
          <Editor
            draft={draft}
            setDraft={setDraft}
            enabledModes={enabledModes}
            focusMode={focusMode}
            onFocusMode={setFocusMode}
          />
        </Space>
      </Card>

      <Card size="small" title="Test a parcel" styles={{ body: { padding: 16 } }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Select
              style={{ width: 110 }}
              value={test.mode}
              onChange={(v) => setTest((s) => ({ ...s, mode: v }))}
              options={MODES.map((m) => ({ value: m.code, label: m.label }))}
            />
            <InputNumber
              min={0}
              step={0.5}
              value={test.weight}
              addonAfter="kg"
              onChange={(v) => setTest((s) => ({ ...s, weight: v ?? 0 }))}
            />
            <InputNumber
              min={1}
              step={1}
              value={test.pcs}
              addonAfter="pcs"
              onChange={(v) => setTest((s) => ({ ...s, pcs: v ?? 1 }))}
            />
            <Button type="primary" ghost onClick={runTest} loading={testBusy} style={{ borderColor: BRAND, color: BRAND }}>
              Calculate
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Runs the real quoting rules on the server with your unsaved prices, for {scopeLabel(target.custAcNo)} ·{' '}
            {laneLabel(target)}. SST is added using the rate set on Customer pricing.
          </Text>
          {testResult ? <TestResult result={testResult} /> : null}
        </Space>
      </Card>
    </div>
  )
}

function TestResult({ result }) {
  const fb = result.feeBreakdown || {}
  const fromBand = ['delivery_fee_rate', 'customer_delivery_fee_rate'].includes(result.feeSource)
  const price = result.customerPrice || {}
  const taxRate = Number(price.taxRate || 0)
  const taxAmount = Number(price.taxAmount || 0)
  const total = Number(price.total ?? result.deliveryFee ?? 0)
  return (
    <Card size="small" style={{ background: '#fafafa' }}>
      {!fromBand ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="No formula priced this parcel"
          description={result.feeLabel}
        />
      ) : null}
      <Descriptions size="small" column={1}>
        <Descriptions.Item label="Priced by">{result.feeLabel}</Descriptions.Item>
        {(fb.parts || []).map((p, i) => (
          <Descriptions.Item key={`${p.code}-${i}`} label={p.label}>
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {p.how}
              </Text>
              <span>RM {Number(p.amount || 0).toFixed(2)}</span>
            </Space>
          </Descriptions.Item>
        ))}
        <Descriptions.Item label="Delivery fee">RM {Number(result.deliveryFee || 0).toFixed(2)}</Descriptions.Item>
        <Descriptions.Item label={taxRate > 0 ? `SST ${taxRate}%` : 'SST'}>
          {taxRate > 0 ? `RM ${taxAmount.toFixed(2)}` : <Text type="secondary">Off</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Total">
          <Text strong style={{ color: BRAND }}>
            RM {total.toFixed(2)}
          </Text>
        </Descriptions.Item>
        {fb.formulaPlain ? (
          <Descriptions.Item label="Formula">
            <Text type="secondary" style={{ fontSize: 12 }}>
              {fb.formulaPlain}
            </Text>
          </Descriptions.Item>
        ) : null}
      </Descriptions>
    </Card>
  )
}
