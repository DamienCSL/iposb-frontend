import React from 'react'
import { Steps } from 'antd'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'

const SOP_STAGES = [
  { code: 'BDE', title: 'Order Confirmed', sub: 'BDE' },
  { code: 'ACC', title: 'Awaiting Pickup', sub: 'ACC' },
  { code: 'PKU', title: 'Picked Up', sub: 'PKU' },
  { code: 'ARR', title: 'Origin Hub', sub: 'ARR / SRT' },
  { code: 'INB', title: 'Linehaul', sub: 'INB / HUB' },
  { code: 'SHB', title: 'Station', sub: 'SHB' },
  { code: 'OFD', title: 'Out for Delivery', sub: 'OFD' },
  { code: 'POD', title: 'Delivered', sub: 'POD' },
]

const STAGE_INDEX = {
  BDE: 0,
  ACC: 1,
  PKU: 2,
  ARR: 3,
  SRT: 3,
  GWD: 3,
  INB: 4,
  HUB: 4,
  SHB: 5,
  OFD: 6,
  POD: 7,
}

export default function ShipmentStepper({ currentStatus, exceptionStatus }) {
  const code = String(currentStatus || 'BDE').trim().toUpperCase()
  const currentIndex = STAGE_INDEX[code] !== undefined ? STAGE_INDEX[code] : 0
  const isDelivered = code === 'POD'
  const isException = ['UND', 'HLD', 'CAN', 'RTN'].includes(code) || Boolean(exceptionStatus)

  const items = SOP_STAGES.map((s, idx) => {
    let status = 'wait'
    let icon = undefined

    if (idx < currentIndex) {
      status = 'finish'
      icon = <CheckCircleFilled style={{ color: '#1B8A5A' }} />
    } else if (idx === currentIndex) {
      if (isException) {
        status = 'error'
      } else if (isDelivered) {
        status = 'finish'
        icon = <CheckCircleFilled style={{ color: '#1B8A5A' }} />
      } else {
        status = 'process'
        icon = <LoadingOutlined style={{ color: '#1B8A5A' }} />
      }
    } else {
      status = 'wait'
      icon = <ClockCircleOutlined style={{ color: '#9CA3AF' }} />
    }

    return {
      title: <span style={{ fontSize: '12px', fontWeight: 600 }}>{s.title}</span>,
      description: <span style={{ fontSize: '11px', color: '#6B7280', fontFamily: 'JetBrains Mono, monospace' }}>{s.sub}</span>,
      status,
      icon,
    }
  })

  return (
    <div style={{ padding: '16px 8px', background: '#FFFFFF', borderRadius: 8 }}>
      <Steps
        size="small"
        current={currentIndex}
        items={items}
        responsive
      />
    </div>
  )
}
