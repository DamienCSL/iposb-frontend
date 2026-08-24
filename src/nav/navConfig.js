/** FMS sidebar — same grouping as deploy/FMS/shared/nav.php */

export const NAV_SECTIONS = [
  {
    id: 'consignment',
    title: 'Consignment',
    cap: 'consignments',
    items: [
      { to: '/consignments/new', label: 'Consignment Entry', legacy: '/FMS/operations/cn_entry.php' },
      { to: '/consignments', label: 'Consignment List', legacy: '/FMS/operations/cn_entry_view.php' },
      { to: '/consignments/import-log', label: 'Import Error Log', legacy: '/FMS/operations/cn_import_log.php' },
      { to: '/consignments/tracking', label: 'Consignment Tracking', live: true, legacy: '/FMS/operations/cn_tracking.php' },
    ],
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    cap: 'dispatch',
    items: [
      { to: '/dispatch/assign', label: 'Driver Assignment', live: true, legacy: '/FMS/operations/driver_assign.php' },
      { to: '/dispatch/remote', label: 'Remote / 3PL Pickup', live: true, legacy: '/FMS/operations/remote_pickup_queue.php' },
    ],
  },
  {
    id: 'cs',
    title: 'Customer Service',
    cap: 'customerService',
    items: [
      { to: '/cs/tickets', label: 'CS Tickets', legacy: '/FMS/operations/cs_inbox.php' },
    ],
  },
  {
    id: 'summaries',
    title: 'Status Summaries',
    cap: 'summaries',
    items: [
      { to: '/summaries', label: 'Overall Status Summary', legacy: '/FMS/operations/cn_status_summary.php' },
      { to: '/summaries/status', label: 'Summary by Status', legacy: '/FMS/operations/cn_status_summary_by_status.php' },
      { to: '/summaries/agent', label: 'Summary by Agent', legacy: '/FMS/operations/cn_status_summary_by_agent.php' },
      { to: '/summaries/date', label: 'Summary by Date', legacy: '/FMS/operations/cn_status_summary_by_date.php' },
      { to: '/summaries/branch', label: 'Summary by Branch', legacy: '/FMS/operations/cn_status_summary_by_branch.php' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    cap: 'billing',
    items: [
      { to: '/billing/invoices/new', label: 'Invoice Entry', legacy: '/FMS/billing/inv_entry.php' },
      { to: '/billing/invoices', label: 'Invoice List', legacy: '/FMS/billing/inv_entry_view.php' },
      { to: '/billing/do/new', label: 'Delivery Order Entry', legacy: '/FMS/billing/do_entry.php' },
      { to: '/billing/receipts/new', label: 'Receipt Entry', legacy: '/FMS/billing/receipt_entry.php' },
      { to: '/billing/credit-notes', label: 'Credit Note Entry', legacy: '/FMS/billing/cn_credit_note.php' },
      { to: '/billing/debit-notes', label: 'Debit Note Entry', legacy: '/FMS/billing/cn_debit_note.php' },
    ],
  },
  {
    id: 'agent',
    title: 'Agent',
    cap: 'agent',
    items: [
      { to: '/agent/bilyet-in', label: 'Agent Money In', legacy: '/FMS/agent/bilyet_in.php' },
      { to: '/agent/bilyet-out', label: 'Agent Money Out', legacy: '/FMS/agent/bilyet_out.php' },
      { to: '/agent/stock', label: 'Agent Stock Record', legacy: '/FMS/agent/agent_stock_record.php' },
    ],
  },
  {
    id: 'customer',
    title: 'Customer',
    cap: 'customerReports',
    items: [
      { to: '/customer/stock', label: 'Customer Stock Record', legacy: '/FMS/customer/customer_stock_record.php' },
      { to: '/customer/summary', label: 'Customer Summary Report', legacy: '/FMS/customer/customer_summary_report.php' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    cap: 'reports',
    items: [
      { to: '/reports/manifest', label: 'Print Manifest', legacy: '/FMS/reports/manifest_print.php' },
      { to: '/reports/cn', label: 'Print Consignment', legacy: '/FMS/reports/cn_print.php' },
    ],
  },
]

export const ADMIN_ITEMS = [
  { cap: 'users', to: '/admin/users', label: 'User Management', legacy: '/FMS/admin/user_management.php' },
  { cap: 'branches', to: '/admin/branches', label: 'Branch Management', legacy: '/FMS/admin/branch_management.php' },
  { cap: 'hubs', to: '/admin/hubs', label: 'Hub Management', legacy: '/FMS/admin/hub_management.php' },
  { cap: 'dropPoints', to: '/admin/drop-points', label: 'Drop Point Management', legacy: '/FMS/admin/drop_point_management.php' },
  { cap: 'dropPoints', to: '/admin/3pl', label: '3PL Partners', legacy: '/FMS/admin/3pl_partner_management.php' },
  { cap: 'dropPoints', to: '/admin/coverage', label: 'Coverage Areas', legacy: '/FMS/admin/coverage_area_management.php' },
  { cap: 'staff', to: '/admin/staff', label: 'Staff Verification', legacy: '/FMS/admin/staff_verification.php' },
  { cap: 'staff', to: '/admin/dispatchers', label: 'Dispatcher Management', legacy: '/FMS/admin/dispatcher_management.php' },
  { cap: 'staff', to: '/admin/drivers', label: 'Driver Management', legacy: '/FMS/admin/driver_management.php' },
  { cap: 'routing', to: '/admin/routes', label: 'Route Table', legacy: '/FMS/admin/route_table_management.php' },
  { cap: 'routing', to: '/admin/zones', label: 'Zone Management', legacy: '/FMS/admin/zone_management.php' },
  { cap: 'routing', to: '/admin/route-codes', label: 'Route Codes', legacy: '/FMS/admin/route_code_management.php' },
]

export function visibleSections(caps) {
  return NAV_SECTIONS.filter((s) => caps[s.cap])
}

export function visibleAdmin(caps) {
  return ADMIN_ITEMS.filter((i) => caps[i.cap])
}
