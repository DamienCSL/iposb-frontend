import { useMemo, useState } from 'react'
import { Button, Input, Modal, Radio, Select, Space, Tag, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import CodeLookupField from '../../../components/CodeLookupField'
import { customersWithRows, emptyTarget, laneKey, laneLabel, lanesForScope, normTarget } from './pricingModel'

const { Text } = Typography

export default function PricingTargetBar({ rows, target, onChange, onCustomerPending, showLane = true }) {
  const t = normTarget(target)
  const [isCustomer, setIsCustomer] = useState(Boolean(t.custAcNo))
  const [laneOpen, setLaneOpen] = useState(false)
  const [laneDraft, setLaneDraft] = useState(emptyTarget())

  const customers = useMemo(() => customersWithRows(rows), [rows])
  const lanes = useMemo(() => {
    const list = lanesForScope(rows, t.custAcNo)
    if (!list.some((l) => l.key === laneKey(t))) list.push({ key: laneKey(t), target: { ...t, custAcNo: '' } })
    return list
  }, [rows, t.custAcNo, t.origin, t.destination, t.serviceType])

  const setScope = (custAcNo, customerMode = isCustomer) => {
    onCustomerPending?.(customerMode && !custAcNo)
    onChange({ ...emptyTarget(), custAcNo })
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
            style={{ minWidth: 260 }}
            value={laneKey(t)}
            onChange={(key) => {
              const lane = lanes.find((l) => l.key === key)
              onChange({ ...(lane?.target || emptyTarget()), custAcNo: t.custAcNo })
            }}
            options={lanes.map((l) => ({ value: l.key, label: laneLabel(l.target) }))}
          />
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setLaneDraft(emptyTarget())
              setLaneOpen(true)
            }}
          >
            Add lane override
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            A lane override beats "All lanes" for parcels on that route or service type.
          </Text>
        </Space>
      ) : null}

      <Modal
        title="Add lane override"
        open={laneOpen}
        onCancel={() => setLaneOpen(false)}
        okText="Use this lane"
        okButtonProps={{ disabled: laneKey(laneDraft) === '||' }}
        onOk={() => {
          onChange({ ...normTarget(laneDraft), custAcNo: t.custAcNo })
          setLaneOpen(false)
        }}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">Leave a field blank to match any value. Set at least one.</Text>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Origin hub</div>
            <CodeLookupField
              kind="hubs"
              allowCustom
              allowClear
              showGenerate={false}
              showManageLink={false}
              placeholder="Any origin"
              value={laneDraft.origin}
              onChange={(v) => setLaneDraft((d) => ({ ...d, origin: v || '' }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Destination hub</div>
            <CodeLookupField
              kind="hubs"
              allowCustom
              allowClear
              showGenerate={false}
              showManageLink={false}
              placeholder="Any destination"
              value={laneDraft.destination}
              onChange={(v) => setLaneDraft((d) => ({ ...d, destination: v || '' }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Service type</div>
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
