/** FMS sidebar — same grouping as deploy/FMS/shared/nav.php */

export const NAV_SECTIONS = [
  {
    id: 'consignment',
    title: 'Consignment',
    cap: 'consignments',
    items: [
      { to: '/consignments/new', label: 'Consignment Entry', icon: 'bi-plus-circle', live: true },
      { to: '/consignments', label: 'Consignment List', icon: 'bi-list-ul', live: true },
      { to: '/consignments/import-log', label: 'Import Error Log', icon: 'bi-exclamation-octagon', live: true },
      { to: '/consignments/tracking', label: 'Consignment Tracking', icon: 'bi-search', live: true },
      { to: '/consignments/cancellations', label: 'Cancellation Log', icon: 'bi-journal-text', live: true },
    ],
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    cap: 'dispatch',
    items: [
      { to: '/dispatch/assign', label: 'Driver Assignment', icon: 'bi-person-workspace', live: true },
      { to: '/dispatch/remote', label: 'Remote / 3PL Pickup', icon: 'bi-geo', live: true },
    ],
  },
  {
    id: 'cs',
    title: 'Customer Service',
    cap: 'customerService',
    items: [
      { to: '/cs/tickets', label: 'CS Tickets', icon: 'bi-ticket-detailed', live: true },
    ],
  },
  {
    id: 'summaries',
    title: 'Status Summaries',
    cap: 'summaries',
    items: [
      { to: '/summaries', label: 'Overall Status Summary', icon: 'bi-bar-chart', live: true },
      { to: '/summaries/status', label: 'Summary by Status', icon: 'bi-pie-chart', live: true },
      { to: '/summaries/drop-point', label: 'Summary by Drop Point', icon: 'bi-geo-alt', live: true },
      { to: '/summaries/consignee', label: 'Summary by Consignee', icon: 'bi-person', live: true },
      { to: '/summaries/consigner', label: 'Summary by Consigner', icon: 'bi-person', live: true },
      { to: '/summaries/shipper', label: 'Summary by Shipper', icon: 'bi-ship', live: true },
      { to: '/summaries/manifest', label: 'Summary by Manifest', icon: 'bi-file-earmark-text', live: true },
      { to: '/summaries/date', label: 'Summary by Date', icon: 'bi-calendar', live: true },
      { to: '/summaries/branch', label: 'Summary by Branch', icon: 'bi-geo-alt', live: true },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    cap: 'billing',
    items: [
      { to: '/billing/invoices/new', label: 'Invoice Entry', icon: 'bi-receipt', live: true },
      { to: '/billing/invoices', label: 'Invoice List', icon: 'bi-list-check', live: true },
      { to: '/billing/invoices/tracking', label: 'Invoice Tracking', icon: 'bi-search', live: true },
      { to: '/billing/do/new', label: 'Delivery Order Entry', icon: 'bi-file-earmark-arrow-up', live: true },
      { to: '/billing/do', label: 'Delivery Order List', icon: 'bi-list-check', live: true },
      { to: '/billing/do/tracking', label: 'Delivery Order Tracking', icon: 'bi-search', live: true },
      { to: '/billing/receipts/new', label: 'Receipt Entry', icon: 'bi-cash-coin', live: true },
      { to: '/billing/receipts', label: 'Receipt List', icon: 'bi-list-check', live: true },
      { to: '/billing/receipts/tracking', label: 'Receipt Tracking', icon: 'bi-search', live: true },
      { to: '/billing/credit-notes', label: 'Credit Note Entry', icon: 'bi-file-earmark-minus', live: true },
      { to: '/billing/credit-notes/list', label: 'Credit Note List', icon: 'bi-list-check', live: true },
      { to: '/billing/debit-notes', label: 'Debit Note Entry', icon: 'bi-file-earmark-plus', live: true },
      { to: '/billing/debit-notes/list', label: 'Debit Note List', icon: 'bi-list-check', live: true },
      { to: '/billing/cod', label: 'COD Outstanding', icon: 'bi-wallet2', live: true },
      { to: '/billing/wallet', label: 'Customer Wallet', icon: 'bi-piggy-bank', live: true },
      { to: '/billing/cancellation-settings', label: 'Cancellation Policy', icon: 'bi-sliders', live: true },
    ],
  },
  {
    id: 'dropPoint',
    title: 'Drop Point',
    cap: 'dropPoints',
    items: [
      { to: '/drop-points', label: 'Drop Point Management', icon: 'bi-geo-alt', live: true },
      { to: '/drop-points/3pl', label: '3PL Partners', icon: 'bi-truck-flatbed', live: true },
      { to: '/drop-points/coverage', label: 'Coverage Areas', icon: 'bi-map', live: true },
      { to: '/drop-points/bilyet-in', label: 'Money In (Bilyet)', icon: 'bi-cash-stack', live: true },
      { to: '/drop-points/bilyet-in/list', label: 'Money In List', icon: 'bi-list-check', live: true },
      { to: '/drop-points/bilyet-out', label: 'Money Out (Bilyet)', icon: 'bi-cash', live: true },
      { to: '/drop-points/bilyet-out/list', label: 'Money Out List', icon: 'bi-list-check', live: true },
      { to: '/drop-points/credit-notes', label: 'Credit Note Entry', icon: 'bi-file-earmark-minus', live: true },
      { to: '/drop-points/credit-notes/list', label: 'Credit Note List', icon: 'bi-list-check', live: true },
      { to: '/drop-points/debit-notes', label: 'Debit Note Entry', icon: 'bi-file-earmark-plus', live: true },
      { to: '/drop-points/debit-notes/list', label: 'Debit Note List', icon: 'bi-list-check', live: true },
      { to: '/drop-points/stock', label: 'Drop Point Stock Record', icon: 'bi-journal-text', live: true },
      { to: '/billing/commissions', label: 'Commission & Wallets', icon: 'bi-currency-exchange', live: true },
      { to: '/dispatch/remote', label: 'Remote / 3PL Pickup', icon: 'bi-geo', live: true },
    ],
  },
  {
    id: 'customer',
    title: 'Customer',
    cap: 'customerReports',
    items: [
      { to: '/customer/stock', label: 'Customer Stock Record', icon: 'bi-journal-text', live: true },
      { to: '/customer/summary', label: 'Customer Summary Report', icon: 'bi-graph-up', live: true },
      { to: '/customer/drop-point-summary', label: 'Drop Point Summary Report', icon: 'bi-graph-up', live: true },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    anyCaps: ['reports', 'billing'],
    items: [
      { to: '/reports/manifest', label: 'Print Manifest', icon: 'bi-printer', cap: 'reports', live: true },
      { to: '/reports/cn', label: 'Print Consignment', icon: 'bi-printer', cap: 'reports', live: true },
      { to: '/reports/invoice', label: 'Print Invoice', icon: 'bi-printer', cap: 'billing', live: true },
      { to: '/reports/do', label: 'Print Delivery Order', icon: 'bi-printer', cap: 'billing', live: true },
      { to: '/reports/receipt', label: 'Print Receipt', icon: 'bi-printer', cap: 'billing', live: true },
    ],
  },
]

export const ADMIN_ITEMS = [
  { cap: 'roleAccess', to: '/admin/role-access', label: 'Staff Access Settings', icon: 'bi-shield-lock', live: true },
  { cap: 'users', to: '/admin/users', label: 'User Management', icon: 'bi-person-gear', live: true },
  { cap: 'branches', to: '/admin/branches', label: 'Branch Management', icon: 'bi-building', live: true },
  { cap: 'hubs', to: '/admin/hubs', label: 'Hub Management', icon: 'bi-diagram-3', live: true },
  { cap: 'staff', to: '/admin/staff', label: 'Staff Verification', icon: 'bi-shield-check', live: true },
  { cap: 'staff', to: '/admin/dispatchers', label: 'Dispatcher Management', icon: 'bi-headset', live: true },
  { cap: 'staff', to: '/admin/drivers', label: 'Driver Management', icon: 'bi-truck', live: true },
  { cap: 'routing', to: '/admin/routes', label: 'Route Table', icon: 'bi-signpost-2', live: true },
  { cap: 'routing', to: '/admin/zones', label: 'Zone Management', icon: 'bi-map', live: true },
  { cap: 'routing', to: '/admin/route-codes', label: 'Route Codes', icon: 'bi-sign-turn-right', live: true },
]

function sectionAllowed(section, caps) {
  if (section.cap) return Boolean(caps[section.cap])
  if (section.anyCaps) return section.anyCaps.some((c) => caps[c])
  return true
}

export function visibleSections(caps) {
  return NAV_SECTIONS.filter((s) => sectionAllowed(s, caps)).map((s) => ({
    ...s,
    items: s.items.filter((i) => (i.cap ? Boolean(caps[i.cap]) : true)),
  })).filter((s) => s.items.length > 0)
}

export function visibleAdmin(caps) {
  return ADMIN_ITEMS.filter((i) => caps[i.cap])
}

export function findNavMeta(pathname) {
  for (const s of NAV_SECTIONS) {
    const hit = s.items.find((i) => i.to === pathname)
    if (hit) return hit
  }
  return ADMIN_ITEMS.find((i) => i.to === pathname)
}
