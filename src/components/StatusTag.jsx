import React from 'react'

const STATUS_MAP = {
  // SOP Chain
  BDE: { label: 'Order Confirmed', color: '#D97706' },
  ACC: { label: 'Awaiting Pickup', color: '#D97706' },
  PKU: { label: 'Picked Up', color: '#1668DC' },
  ARR: { label: 'At Origin Hub', color: '#1668DC' },
  SRT: { label: 'Sorting', color: '#1668DC' },
  GWD: { label: 'Hub Departed', color: '#1668DC' },
  INB: { label: 'In Transit', color: '#1668DC' },
  HUB: { label: 'At Dest Hub', color: '#1668DC' },
  SHB: { label: 'At Station', color: '#1668DC' },
  MNF: { label: 'Manifested', color: '#1668DC' },
  OFD: { label: 'Out for Delivery', color: '#0891B2' },
  POD: { label: 'Delivered (POD)', color: '#1B8A5A' },
  PCC: { label: 'Delivered (Consignee)', color: '#1B8A5A' },
  PCB: { label: 'Delivered (Branch)', color: '#1B8A5A' },
  DOD: { label: 'Delivered on Demand', color: '#1B8A5A' },

  // Exceptions
  UND: { label: 'Undelivered', color: '#D4380D' },
  UTL: { label: 'Untraced / Lost', color: '#D4380D' },
  HLD: { label: 'On Hold', color: '#D97706' },
  SHL: { label: 'Short Landing', color: '#D97706' },
  CAN: { label: 'Cancelled', color: '#64748B' },
  RTN: { label: 'Returned', color: '#7C3AED' },
  RTS: { label: 'Return to Shipper', color: '#7C3AED' },

  // General & Billing
  PAID: { label: 'Paid', color: '#1B8A5A' },
  UNPAID: { label: 'Unpaid', color: '#D97706' },
  ACTIVE: { label: 'Active', color: '#1B8A5A' },
  INACTIVE: { label: 'Inactive', color: '#64748B' },
  ASSIGNED: { label: 'Assigned', color: '#1668DC' },
  UNASSIGNED: { label: 'Unassigned', color: '#D97706' },
  OPEN: { label: 'Open', color: '#1668DC' },
  CLOSED: { label: 'Closed', color: '#64748B' },
}

export default function StatusTag({ status, text, color: customColor }) {
  const key = String(status || '').trim().toUpperCase()
  const conf = STATUS_MAP[key] || {
    label: text || status || '—',
    color: customColor || '#475569',
  }
  const color = customColor || conf.color

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 600,
        background: `${color}18`, // ~10% opacity
        color,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
        letterSpacing: '0.2px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {text || conf.label}
    </span>
  )
}


