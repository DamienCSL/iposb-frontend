/** FMS sidebar — same grouping as deploy/FMS/shared/nav.php */

export const NAV_SECTIONS = [
  {
    id: 'consignment',
    title: 'Consignment',
    cap: 'consignments',
    items: [
      { to: '/consignments/new', label: 'Consignment Entry', icon: 'bi-plus-circle', legacy: '/FMS/operations/cn_entry.php' },
      { to: '/consignments', label: 'Consignment List', icon: 'bi-list-ul', legacy: '/FMS/operations/cn_entry_view.php' },
      { to: '/consignments/import-log', label: 'Import Error Log', icon: 'bi-exclamation-octagon', legacy: '/FMS/operations/cn_import_log.php' },
      { to: '/consignments/tracking', label: 'Consignment Tracking', icon: 'bi-search', live: true, legacy: '/FMS/operations/cn_tracking.php' },
    ],
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    cap: 'dispatch',
    items: [
      { to: '/dispatch/assign', label: 'Driver Assignment', icon: 'bi-person-workspace', live: true, legacy: '/FMS/operations/driver_assign.php' },
      { to: '/dispatch/remote', label: 'Remote / 3PL Pickup', icon: 'bi-geo', live: true, legacy: '/FMS/operations/remote_pickup_queue.php' },
    ],
  },
  {
    id: 'cs',
    title: 'Customer Service',
    cap: 'customerService',
    items: [
      { to: '/cs/tickets', label: 'CS Tickets', icon: 'bi-ticket-detailed', legacy: '/FMS/operations/cs_inbox.php' },
    ],
  },
  {
    id: 'summaries',
    title: 'Status Summaries',
    cap: 'summaries',
    items: [
      { to: '/summaries', label: 'Overall Status Summary', icon: 'bi-bar-chart', legacy: '/FMS/operations/cn_status_summary.php' },
      { to: '/summaries/status', label: 'Summary by Status', icon: 'bi-pie-chart', legacy: '/FMS/operations/cn_status_summary_by_status.php' },
      { to: '/summaries/agent', label: 'Summary by Agent', icon: 'bi-people', legacy: '/FMS/operations/cn_status_summary_by_agent.php' },
      { to: '/summaries/consignee', label: 'Summary by Consignee', icon: 'bi-person', legacy: '/FMS/operations/cn_status_summary_by_consignee.php' },
      { to: '/summaries/consigner', label: 'Summary by Consigner', icon: 'bi-person', legacy: '/FMS/operations/cn_status_summary_by_consigner.php' },
      { to: '/summaries/shipper', label: 'Summary by Shipper', icon: 'bi-ship', legacy: '/FMS/operations/cn_status_summary_by_shipper.php' },
      { to: '/summaries/manifest', label: 'Summary by Manifest', icon: 'bi-file-earmark-text', legacy: '/FMS/operations/cn_status_summary_by_manifest.php' },
      { to: '/summaries/date', label: 'Summary by Date', icon: 'bi-calendar', legacy: '/FMS/operations/cn_status_summary_by_date.php' },
      { to: '/summaries/branch', label: 'Summary by Branch', icon: 'bi-geo-alt', legacy: '/FMS/operations/cn_status_summary_by_branch.php' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    cap: 'billing',
    items: [
      { to: '/billing/invoices/new', label: 'Invoice Entry', icon: 'bi-receipt', legacy: '/FMS/billing/inv_entry.php' },
      { to: '/billing/invoices', label: 'Invoice List', icon: 'bi-list-check', legacy: '/FMS/billing/inv_entry_view.php' },
      { to: '/billing/invoices/tracking', label: 'Invoice Tracking', icon: 'bi-search', legacy: '/FMS/billing/inv_tracking.php' },
      { to: '/billing/do/new', label: 'Delivery Order Entry', icon: 'bi-file-earmark-arrow-up', legacy: '/FMS/billing/do_entry.php' },
      { to: '/billing/do', label: 'Delivery Order List', icon: 'bi-list-check', legacy: '/FMS/billing/do_entry_view.php' },
      { to: '/billing/do/tracking', label: 'Delivery Order Tracking', icon: 'bi-search', legacy: '/FMS/billing/do_tracking.php' },
      { to: '/billing/receipts/new', label: 'Receipt Entry', icon: 'bi-cash-coin', legacy: '/FMS/billing/receipt_entry.php' },
      { to: '/billing/receipts', label: 'Receipt List', icon: 'bi-list-check', legacy: '/FMS/billing/receipt_entry_view.php' },
      { to: '/billing/receipts/tracking', label: 'Receipt Tracking', icon: 'bi-search', legacy: '/FMS/billing/receipt_tracking.php' },
      { to: '/billing/credit-notes', label: 'Credit Note Entry', icon: 'bi-file-earmark-minus', legacy: '/FMS/billing/cn_credit_note.php' },
      { to: '/billing/credit-notes/list', label: 'Credit Note List', icon: 'bi-list-check', legacy: '/FMS/billing/cn_credit_note_view.php' },
      { to: '/billing/debit-notes', label: 'Debit Note Entry', icon: 'bi-file-earmark-plus', legacy: '/FMS/billing/cn_debit_note.php' },
      { to: '/billing/debit-notes/list', label: 'Debit Note List', icon: 'bi-list-check', legacy: '/FMS/billing/cn_debit_note_view.php' },
    ],
  },
  {
    id: 'agent',
    title: 'Agent',
    cap: 'agent',
    items: [
      { to: '/agent/bilyet-in', label: 'Agent Money In', icon: 'bi-arrow-down-circle', legacy: '/FMS/agent/bilyet_in.php' },
      { to: '/agent/bilyet-in/list', label: 'Agent Money In List', icon: 'bi-list-check', legacy: '/FMS/agent/bilyet_in_view.php' },
      { to: '/agent/bilyet-out', label: 'Agent Money Out', icon: 'bi-arrow-up-circle', legacy: '/FMS/agent/bilyet_out.php' },
      { to: '/agent/bilyet-out/list', label: 'Agent Money Out List', icon: 'bi-list-check', legacy: '/FMS/agent/bilyet_out_view.php' },
      { to: '/agent/credit-notes', label: 'Agent Credit Note', icon: 'bi-file-earmark-minus', legacy: '/FMS/agent/agent_credit_note.php' },
      { to: '/agent/credit-notes/list', label: 'Agent Credit Note List', icon: 'bi-list-check', legacy: '/FMS/agent/agent_credit_note_view.php' },
      { to: '/agent/debit-notes', label: 'Agent Debit Note', icon: 'bi-file-earmark-plus', legacy: '/FMS/agent/agent_debit_note.php' },
      { to: '/agent/debit-notes/list', label: 'Agent Debit Note List', icon: 'bi-list-check', legacy: '/FMS/agent/agent_debit_note_view.php' },
      { to: '/agent/stock', label: 'Agent Stock Record', icon: 'bi-journal-text', legacy: '/FMS/agent/agent_stock_record.php' },
    ],
  },
  {
    id: 'customer',
    title: 'Customer',
    cap: 'customerReports',
    items: [
      { to: '/customer/stock', label: 'Customer Stock Record', icon: 'bi-journal-text', legacy: '/FMS/customer/customer_stock_record.php' },
      { to: '/customer/summary', label: 'Customer Summary Report', icon: 'bi-graph-up', legacy: '/FMS/customer/customer_summary_report.php' },
      { to: '/customer/agent-summary', label: 'Agent Summary Report', icon: 'bi-graph-up', legacy: '/FMS/customer/agent_summary_report.php' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    anyCaps: ['reports', 'billing'],
    items: [
      { to: '/reports/manifest', label: 'Print Manifest', icon: 'bi-printer', cap: 'reports', legacy: '/FMS/reports/manifest_print.php' },
      { to: '/reports/cn', label: 'Print Consignment', icon: 'bi-printer', cap: 'reports', legacy: '/FMS/reports/cn_print.php' },
      { to: '/reports/invoice', label: 'Print Invoice', icon: 'bi-printer', cap: 'billing', legacy: '/FMS/reports/invoice_print.php' },
      { to: '/reports/do', label: 'Print Delivery Order', icon: 'bi-printer', cap: 'billing', legacy: '/FMS/reports/do_print.php' },
      { to: '/reports/receipt', label: 'Print Receipt', icon: 'bi-printer', cap: 'billing', legacy: '/FMS/reports/receipt_print.php' },
    ],
  },
]

export const ADMIN_ITEMS = [
  { cap: 'users', to: '/admin/users', label: 'User Management', icon: 'bi-person-gear', legacy: '/FMS/admin/user_management.php' },
  { cap: 'branches', to: '/admin/branches', label: 'Branch Management', icon: 'bi-building', legacy: '/FMS/admin/branch_management.php' },
  { cap: 'hubs', to: '/admin/hubs', label: 'Hub Management', icon: 'bi-diagram-3', legacy: '/FMS/admin/hub_management.php' },
  { cap: 'dropPoints', to: '/admin/drop-points', label: 'Drop Point Management', icon: 'bi-geo-alt', legacy: '/FMS/admin/drop_point_management.php' },
  { cap: 'dropPoints', to: '/admin/3pl', label: '3PL Partners', icon: 'bi-truck-flatbed', legacy: '/FMS/admin/3pl_partner_management.php' },
  { cap: 'dropPoints', to: '/admin/coverage', label: 'Coverage Areas', icon: 'bi-map', legacy: '/FMS/admin/coverage_area_management.php' },
  { cap: 'staff', to: '/admin/staff', label: 'Staff Verification', icon: 'bi-shield-check', legacy: '/FMS/admin/staff_verification.php' },
  { cap: 'staff', to: '/admin/dispatchers', label: 'Dispatcher Management', icon: 'bi-headset', legacy: '/FMS/admin/dispatcher_management.php' },
  { cap: 'staff', to: '/admin/drivers', label: 'Driver Management', icon: 'bi-truck', legacy: '/FMS/admin/driver_management.php' },
  { cap: 'routing', to: '/admin/routes', label: 'Route Table', icon: 'bi-signpost-2', legacy: '/FMS/admin/route_table_management.php' },
  { cap: 'routing', to: '/admin/zones', label: 'Zone Management', icon: 'bi-map', legacy: '/FMS/admin/zone_management.php' },
  { cap: 'routing', to: '/admin/route-codes', label: 'Route Codes', icon: 'bi-sign-turn-right', legacy: '/FMS/admin/route_code_management.php' },
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
