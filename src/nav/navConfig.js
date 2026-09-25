/**
 * FMS sidebar — arranged by delivery network nodes.
 *
 * Network: Hub → Delivery Point → (Area) → Drop Point
 * Shared: Consignment, Billing, CS, cross-cutting summaries/prints, Admin access
 *
 * Add future node features under the matching section groups
 * (hub-ops, dpn-ops, drop-ops, etc.).
 */

export const NAV_SECTIONS = [
  // ── Shared: consignments span the whole network ─────────────────────
  {
    id: 'consignment',
    title: 'Consignment',
    cap: 'consignments',
    items: [
      { to: '/consignments/new', label: 'Consignment Entry', icon: 'bi-plus-circle', live: true },
      { to: '/consignments', label: 'Consignment List', icon: 'bi-list-ul', live: true },
      { to: '/consignments/tracking', label: 'Consignment Tracking', icon: 'bi-search', live: true },
      { to: '/consignments/import-log', label: 'Import Error Log', icon: 'bi-exclamation-octagon', live: true },
      { to: '/consignments/cancellations', label: 'Cancellation Log', icon: 'bi-journal-text', live: true },
    ],
  },

  // ── Hub node ────────────────────────────────────────────────────────
  {
    id: 'hub',
    title: 'Hub',
    anyCaps: ['dispatch', 'hubs', 'reports', 'summaries'],
    groups: [
      {
        id: 'hub-ops',
        title: 'Hub ops',
        cap: 'dispatch',
        items: [
          { to: '/dispatch/seals', label: 'Seal Station', icon: 'bi-box-seam', live: true },
          { to: '/dispatch/manifests', label: 'Manifest Station', icon: 'bi-truck', live: true },
        ],
      },
      {
        id: 'hub-setup',
        title: 'Hub setup',
        cap: 'hubs',
        items: [
          { to: '/admin/hubs', label: 'Hub Management', icon: 'bi-diagram-3', live: true },
        ],
      },
      {
        id: 'hub-reports',
        title: 'Hub reports',
        anyCaps: ['reports', 'summaries'],
        items: [
          { to: '/reports/manifest', label: 'Print Manifest', icon: 'bi-printer', cap: 'reports', live: true },
          { to: '/summaries/manifest', label: 'Summary by Manifest', icon: 'bi-file-earmark-text', cap: 'summaries', live: true },
          { to: '/summaries/branch', label: 'Summary by Branch', icon: 'bi-building', cap: 'summaries', live: true },
        ],
      },
    ],
  },

  // ── Delivery Point node ─────────────────────────────────────────────
  {
    id: 'deliveryPoint',
    title: 'Delivery Point',
    anyCaps: ['dispatch', 'routing', 'staff', 'dropPoints'],
    groups: [
      {
        id: 'dpn-ops',
        title: 'DP ops',
        cap: 'dispatch',
        items: [
          { to: '/dispatch/assign', label: 'Driver Assignment', icon: 'bi-person-workspace', live: true },
        ],
      },
      {
        id: 'dpn-setup',
        title: 'DP & areas',
        cap: 'routing',
        items: [
          { to: '/admin/delivery-points', label: 'Delivery Points', icon: 'bi-geo-alt', live: true },
          { to: '/admin/areas', label: 'Areas', icon: 'bi-pin-map', live: true },
          { to: '/admin/routes', label: 'Route Table', icon: 'bi-signpost-2', live: true },
          { to: '/admin/route-codes', label: 'Route Codes', icon: 'bi-sign-turn-right', live: true },
        ],
      },
      {
        id: 'dpn-people',
        title: 'DP people',
        cap: 'staff',
        items: [
          { to: '/admin/dispatchers', label: 'Dispatcher Management', icon: 'bi-headset', live: true },
          { to: '/admin/drivers', label: 'Driver Management', icon: 'bi-truck', live: true },
        ],
      },
      {
        id: 'dpn-finance',
        title: 'Franchisee finance',
        cap: 'dropPoints',
        items: [
          { to: '/billing/commissions', label: 'Commission & Wallets', icon: 'bi-currency-exchange', live: true },
        ],
      },
    ],
  },

  // ── Drop Point node ─────────────────────────────────────────────────
  {
    id: 'dropPoint',
    title: 'Drop Point',
    anyCaps: ['dropPoints', 'summaries', 'customerReports'],
    groups: [
      {
        id: 'drop-ops',
        title: 'Drop ops',
        cap: 'dropPoints',
        items: [
          { to: '/drop-points', label: 'Drop Point Management', icon: 'bi-geo-alt', live: true },
          { to: '/drop-points/stock', label: 'Stock Record', icon: 'bi-journal-text', live: true },
        ],
      },
      {
        id: 'drop-bilyet',
        title: 'Bilyet (money)',
        cap: 'dropPoints',
        items: [
          { to: '/drop-points/bilyet-in', label: 'Money In', icon: 'bi-cash-stack', live: true },
          { to: '/drop-points/bilyet-in/list', label: 'Money In List', icon: 'bi-list-check', live: true },
          { to: '/drop-points/bilyet-out', label: 'Money Out', icon: 'bi-cash', live: true },
          { to: '/drop-points/bilyet-out/list', label: 'Money Out List', icon: 'bi-list-check', live: true },
        ],
      },
      {
        id: 'drop-notes',
        title: 'Credit / debit notes',
        cap: 'dropPoints',
        items: [
          { to: '/drop-points/credit-notes', label: 'Credit Note Entry', icon: 'bi-file-earmark-minus', live: true },
          { to: '/drop-points/credit-notes/list', label: 'Credit Note List', icon: 'bi-list-check', live: true },
          { to: '/drop-points/debit-notes', label: 'Debit Note Entry', icon: 'bi-file-earmark-plus', live: true },
          { to: '/drop-points/debit-notes/list', label: 'Debit Note List', icon: 'bi-list-check', live: true },
        ],
      },
      {
        id: 'drop-reports',
        title: 'Drop reports',
        anyCaps: ['summaries', 'customerReports'],
        items: [
          { to: '/summaries/drop-point', label: 'Summary by Drop Point', icon: 'bi-geo-alt', cap: 'summaries', live: true },
          { to: '/customer/drop-point-summary', label: 'Drop Point Summary Report', icon: 'bi-graph-up', cap: 'customerReports', live: true },
        ],
      },
    ],
  },

  // ── Shared service & commercial ─────────────────────────────────────
  {
    id: 'cs',
    title: 'Customer Service',
    cap: 'customerService',
    items: [
      { to: '/cs/tickets', label: 'CS Tickets', icon: 'bi-ticket-detailed', live: true },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    anyCaps: ['billing', 'reports'],
    groups: [
      {
        id: 'billing-invoices',
        title: 'Invoices',
        cap: 'billing',
        items: [
          { to: '/billing/invoices/new', label: 'Invoice Entry', icon: 'bi-receipt', live: true },
          { to: '/billing/invoices', label: 'Invoice List', icon: 'bi-list-check', live: true },
          { to: '/billing/invoices/tracking', label: 'Invoice Tracking', icon: 'bi-search', live: true },
          { to: '/reports/invoice', label: 'Print Invoice', icon: 'bi-printer', live: true },
        ],
      },
      {
        id: 'billing-do',
        title: 'Delivery orders',
        cap: 'billing',
        items: [
          { to: '/billing/do/new', label: 'DO Entry', icon: 'bi-file-earmark-arrow-up', live: true },
          { to: '/billing/do', label: 'DO List', icon: 'bi-list-check', live: true },
          { to: '/billing/do/tracking', label: 'DO Tracking', icon: 'bi-search', live: true },
          { to: '/reports/do', label: 'Print Delivery Order', icon: 'bi-printer', live: true },
        ],
      },
      {
        id: 'billing-receipts',
        title: 'Receipts',
        cap: 'billing',
        items: [
          { to: '/billing/receipts/new', label: 'Receipt Entry', icon: 'bi-cash-coin', live: true },
          { to: '/billing/receipts', label: 'Receipt List', icon: 'bi-list-check', live: true },
          { to: '/billing/receipts/tracking', label: 'Receipt Tracking', icon: 'bi-search', live: true },
          { to: '/reports/receipt', label: 'Print Receipt', icon: 'bi-printer', live: true },
        ],
      },
      {
        id: 'billing-notes',
        title: 'Credit / debit notes',
        cap: 'billing',
        items: [
          { to: '/billing/credit-notes', label: 'Credit Note Entry', icon: 'bi-file-earmark-minus', live: true },
          { to: '/billing/credit-notes/list', label: 'Credit Note List', icon: 'bi-list-check', live: true },
          { to: '/billing/debit-notes', label: 'Debit Note Entry', icon: 'bi-file-earmark-plus', live: true },
          { to: '/billing/debit-notes/list', label: 'Debit Note List', icon: 'bi-list-check', live: true },
        ],
      },
      {
        id: 'billing-other',
        title: 'COD & policy',
        cap: 'billing',
        items: [
          { to: '/billing/cod', label: 'COD Outstanding', icon: 'bi-wallet2', live: true },
          { to: '/billing/wallet', label: 'Customer Wallet', icon: 'bi-piggy-bank', live: true },
          { to: '/billing/cancellation-settings', label: 'Cancellation Policy', icon: 'bi-sliders', live: true },
        ],
      },
    ],
  },
  {
    id: 'summaries',
    title: 'Network summaries',
    anyCaps: ['summaries', 'reports', 'customerReports'],
    groups: [
      {
        id: 'summary-main',
        title: 'Overview',
        cap: 'summaries',
        items: [
          { to: '/summaries', label: 'Overall Status', icon: 'bi-bar-chart', live: true },
          { to: '/summaries/status', label: 'By Status', icon: 'bi-pie-chart', live: true },
          { to: '/summaries/date', label: 'By Date', icon: 'bi-calendar', live: true },
        ],
      },
      {
        id: 'summary-party',
        title: 'By party',
        anyCaps: ['summaries', 'customerReports'],
        items: [
          { to: '/summaries/consignee', label: 'By Consignee', icon: 'bi-person', cap: 'summaries', live: true },
          { to: '/summaries/consigner', label: 'By Consigner', icon: 'bi-person', cap: 'summaries', live: true },
          { to: '/summaries/shipper', label: 'By Shipper', icon: 'bi-ship', cap: 'summaries', live: true },
          { to: '/customer/stock', label: 'Customer Stock Record', icon: 'bi-journal-text', cap: 'customerReports', live: true },
          { to: '/customer/summary', label: 'Customer Summary', icon: 'bi-graph-up', cap: 'customerReports', live: true },
        ],
      },
      {
        id: 'summary-print',
        title: 'Print CN',
        cap: 'reports',
        items: [
          { to: '/ops/reports/cn', label: 'Print Consignment', icon: 'bi-printer', live: true },
        ],
      },
    ],
  },
]

/** Admin: access control + customer master (network setup lives under each node) */
export const ADMIN_SECTIONS = [
  {
    id: 'admin',
    title: 'Administration',
    groups: [
      {
        id: 'admin-access',
        title: 'Access',
        items: [
          { cap: 'roleAccess', to: '/admin/role-access', label: 'Staff Access Settings', icon: 'bi-shield-lock', live: true },
          { cap: 'users', to: '/admin/users', label: 'User Management', icon: 'bi-person-gear', live: true },
          { cap: 'staff', to: '/admin/staff', label: 'Staff Verification', icon: 'bi-shield-check', live: true },
        ],
      },
      {
        id: 'admin-customers',
        title: 'Customers',
        items: [
          { cap: 'consignments', to: '/admin/customers', label: 'Customer Registration', icon: 'bi-people', live: true },
        ],
      },
    ],
  },
]

/** Flat list kept for route meta lookups / older callers */
export const ADMIN_ITEMS = ADMIN_SECTIONS.flatMap((s) =>
  (s.groups || [{ items: s.items || [] }]).flatMap((g) => g.items || [])
)

function sectionAllowed(section, caps) {
  if (section.cap) return Boolean(caps[section.cap])
  if (section.anyCaps) return section.anyCaps.some((c) => caps[c])
  return true
}

function groupAllowed(group, caps) {
  if (group.cap) return Boolean(caps[group.cap])
  if (group.anyCaps) return group.anyCaps.some((c) => caps[c])
  return true
}

function filterItems(items, caps) {
  return (items || []).filter((i) => (i.cap ? Boolean(caps[i.cap]) : true))
}

function filterGroups(groups, caps) {
  return (groups || [])
    .map((g) => {
      if (!groupAllowed(g, caps)) return null
      const items = filterItems(g.items, caps)
      if (!items.length) return null
      return { ...g, items }
    })
    .filter(Boolean)
}

export function visibleSections(caps) {
  return NAV_SECTIONS.filter((s) => sectionAllowed(s, caps))
    .map((s) => {
      if (s.groups?.length) {
        const groups = filterGroups(s.groups, caps)
        return { ...s, groups, items: groups.flatMap((g) => g.items) }
      }
      const items = filterItems(s.items, caps)
      return { ...s, items, groups: undefined }
    })
    .filter((s) => (s.groups?.length || s.items?.length))
}

export function visibleAdmin(caps) {
  return ADMIN_SECTIONS.map((s) => {
    const groups = filterGroups(s.groups, caps)
    return { ...s, groups, items: groups.flatMap((g) => g.items) }
  }).filter((s) => s.groups.length > 0)
}

/** @deprecated use visibleAdmin — flat list of admin links */
export function visibleAdminItems(caps) {
  return ADMIN_ITEMS.filter((i) => caps[i.cap])
}

export function findNavMeta(pathname) {
  for (const s of NAV_SECTIONS) {
    const items = s.groups?.length
      ? s.groups.flatMap((g) => g.items || [])
      : s.items || []
    const hit = items.find((i) => i.to === pathname)
    if (hit) return hit
  }
  return ADMIN_ITEMS.find((i) => i.to === pathname)
}

export function sectionContainsPath(section, pathname) {
  const items = section.groups?.length
    ? section.groups.flatMap((g) => g.items || [])
    : section.items || []
  return items.some((i) => i.to === pathname)
}

export function groupContainsPath(group, pathname) {
  return (group.items || []).some((i) => i.to === pathname)
}
