import { useMemo, useState } from 'react'
import { Button, Input, Modal, Radio, Select, Space, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import CodeLookupField from '../../../components/CodeLookupField'
import {
  customersWithRows,
  emptyTarget,
  laneExistsInRows,
  laneKey,
  laneLabel,
  lanePlaceholderRow,
  lanesForScope,
  normTarget,
  saveBody,
} from './pricingModel'
import { apiError, updateCommissionConfig } from '../../../api/client'

const { Text } = Typography

/**
 * @param {{
 *   rows: any[],
 *   target: object,
 *   onChange: (t: object) => void,
 *   onCustomerPending?: (missing: boolean) => void,
 *   showLane?: boolean,
 *   onRowsReload?: (cfg?: object) => void | Promise<void>,
 * }} props
 */
export default function PricingTargetBar({
  rows,
  target,
  onChange,
  onCustomerPending,
  showLane = true,
  onRowsReload,
}) {
  const t = normTarget(target)
  const [isCustomer, setIsCustomer] = useState(Boolean(t.custAcNo))
  const [laneOpen, setLaneOpen] = useState(false)
  const [laneDraft, setLaneDraft] = useState(emptyTarget())
  const [creating, setCreating] = useState(false)

  const customers = useMemo(() => customersWithRows(rows), [rows])
  const lanes = useMemo(() => {
    const list = lanesForScope(rows, t.custAcNo)
    if (!list.some((l) => l.key === laneKey(t))) {
      list.push({ key: laneKey(t), target: { ...t, custAcNo: '' } })
    }
    return list
  }, [rows, t.custAcNo, t.origin, t.destination, t.serviceType])

  const setScope = (custAcNo, customerMode = isCustomer) => {
    onCustomerPending?.(customerMode && !custAcNo)
    onChange({ ...emptyTarget(), custAcNo })
  }

  const saveNewLane = async () => {
    const next = { ...normTarget(laneDraft), custAcNo: t.custAcNo }
    if (laneKey(next) === '||') {
      message.warning('Set at least origin or destination for a city lane')
      return
    }
    if (laneExistsInRows(rows, next)) {
      onChange(next)
      setLaneOpen(false)
      message.info(`${laneLabel(next)} already exists — selected it`)
      return
    }

    setCreating(true)
    try {
      const placeholder = lanePlaceholderRow(next)
      const res = await updateCommissionConfig(saveBody([placeholder]))
      message.success(`${laneLabel(next)} saved. Open a formula to set prices for this lane.`)
      if (onRowsReload) await onRowsReload(res?.config)
      onChange(next)
      setLaneOpen(false)
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space wrap align="center">
        <Text strong style={{ minWidth: 80 }}>Pricing for</Text>
        <Radio.Group
          value={isCustomer ? 'customer' : 'public'}
          optionType="button"
          buttonStyle="solid"
          onChange={(e) => {
            const cust = e.target.value === 'customer'
            setIsCustomer(cust)
            if (cust) onCustomerPending?.(!t.custAcNo)
            else setScope('', false)
          }}
          options={[
            { value: 'public', label: 'Public (walk-in / default)' },
            { value: 'customer', label: 'A customer' },
          ]}
        />
        {isCustomer ? (
          <div style={{ width: 240 }}>
            <CodeLookupField
              kind="customers"
              allowCustom
              allowClear
              showGenerate={false}
              placeholder="Customer account no."
              value={t.custAcNo}
              onChange={(v) => setScope(String(v || '').toUpperCase())}
            />
          </div>
        ) : null}
      </Space>
      {isCustomer && customers.length ? (
        <Space wrap size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>Customers with their own pricing:</Text>
          {customers.map((c) => (
            <Tag.CheckableTag key={c} checked={c === t.custAcNo} onChange={() => setScope(c)}>
              {c}
            </Tag.CheckableTag>
          ))}
        </Space>
      ) : null}
      {showLane ? (
        <Space wrap align="center">
          <Text strong style={{ minWidth: 80 }}>Lane</Text>
          <Select
            style={{ minWidth: 280 }}
            value={laneKey(t)}
            onChange={(key) => {
              const lane = lanes.find((l) => l.key === key)
              onChange({ ...(lane?.target || emptyTarget()), custAcNo: t.custAcNo })
            }}
            options={lanes.map((l) => ({
              value: l.key,
              label: laneLabel(l.target),
            }))}
          />
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setLaneDraft(emptyTarget())
              setLaneOpen(true)
            }}
          >
            Add city lane
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Each city lane is saved separately (e.g. BKI→SDK and BKI→TWU). Then set a formula per lane.
          </Text>
        </Space>
      ) : null}

      <Modal
        title="Add city / route lane"
        open={laneOpen}
        onCancel={() => setLaneOpen(false)}
        okText="Save lane"
        confirmLoading={creating}
        okButtonProps={{ disabled: laneKey(laneDraft) === '||' }}
        onOk={saveNewLane}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">
            This saves the lane so it stays in the list (you can add many). Prices are set afterward by opening a formula
            for that lane. Hubs = cities (BKI = KK, SDK = Sandakan, TWU = Tawau).
          </Text>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Origin city (hub)</div>
            <CodeLookupField
              kind="hubs"
              allowCustom
              allowClear
              showGenerate={false}
              showManageLink={false}
              placeholder="e.g. BKI (KK)"
              value={laneDraft.origin}
              onChange={(v) => setLaneDraft((d) => ({ ...d, origin: v || '' }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Destination city (hub)</div>
            <CodeLookupField
              kind="hubs"
              allowCustom
              allowClear
              showGenerate={false}
              showManageLink={false}
              placeholder="e.g. SDK (Sandakan)"
              value={laneDraft.destination}
              onChange={(v) => setLaneDraft((d) => ({ ...d, destination: v || '' }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Service type (optional)</div>
            <Input
              placeholder="Any service (e.g. STD, EXP)"
              value={laneDraft.serviceType}
              onChange={(e) => setLaneDraft((d) => ({ ...d, serviceType: e.target.value.toUpperCase() }))}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  )
}
