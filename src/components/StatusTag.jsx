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
  DRS: { label: 'With Courier', color: '#0891B2' },
  POD: { label: 'Delivered (POD)', color: '#1B8A5A' },
  PCC: { label: 'Delivered (Consignee)', color: '#1B8A5A' },
  PCB: { label: 'Delivered (Branch)', color: '#1B8A5A' },
  PAE: { label: 'POD Entered', color: '#1B8A5A' },
  DOD: { label: 'Delivered on Demand', color: '#1B8A5A' },
  AWAITING_PAYMENT: { label: 'Awaiting Payment', color: '#D97706' },

  // Self-collect
  SCF: { label: 'Awaiting Collection', color: '#0891B2' },
  CPA: { label: 'At Collection Point', color: '#0891B2' },
  CPI: { label: 'Ready for Collection', color: '#0891B2' },
  SCN: { label: 'Collect Notice Sent', color: '#0891B2' },

  // Exceptions / SOP
  UND: { label: 'Undelivered', color: '#D4380D' },
  OVN: { label: 'Awaiting Redelivery', color: '#D97706' },
  RDL: { label: 'Awaiting Redelivery', color: '#D97706' },
  RSC: { label: 'Reschedule Requested', color: '#D97706' },
  ADR: { label: 'Address Issue', color: '#D4380D' },
  UTL: { label: 'Lost Shipment', color: '#D4380D' },
  N13: { label: 'Lost (N13)', color: '#D4380D' },
  N12: { label: 'Damaged (N12)', color: '#D4380D' },
  N9: { label: 'Damaged (N9)', color: '#D4380D' },
  D4: { label: 'Return Rejected (D4)', color: '#D4380D' },
  HLD: { label: 'On Hold', color: '#D97706' },
  DMG: { label: 'Damaged', color: '#D4380D' },
  LOS: { label: 'Lost', color: '#D4380D' },
  SHL: { label: 'Hold at Hub', color: '#D97706' },
  CAN: { label: 'Cancelled', color: '#64748B' },
  RTN: { label: 'Return to Sender', color: '#7C3AED' },
  RTS: { label: 'Return to Shipper', color: '#7C3AED' },
  PFP: { label: 'Delivered (POD Faxed)', color: '#1B8A5A' },

  // General & Billing & COD
  PAID: { label: 'Paid', color: '#1B8A5A' },
  PAY: { label: 'Paid', color: '#1B8A5A' },
  UNPAID: { label: 'Unpaid', color: '#D97706' },
  UPD: { label: 'Unpaid', color: '#D97706' },
  VOID: { label: 'Void', color: '#64748B' },
  PENDING: { label: 'Pending', color: '#D97706' },
  COLLECTED: { label: 'Collected', color: '#1668DC' },
  REMITTED: { label: 'Remitted', color: '#0891B2' },
  SETTLED: { label: 'Settled', color: '#1B8A5A' },
  VERIFIED: { label: 'Verified', color: '#1B8A5A' },
  UNVERIFIED: { label: 'Unverified', color: '#D97706' },
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


