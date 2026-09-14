/** Map pre-merge / legacy default routes onto the Ant Design /ops shell. */
const ROUTE_ALIASES = {
  '/': '/ops/dashboard',
  '/ops/dashboard': '/ops/dashboard',
  '/consignments': '/ops/consignments',
  '/dispatch': '/ops/dispatch?tab=assign',
  '/dispatch/assign': '/ops/dispatch?tab=assign',
  '/dispatch/remote': '/ops/dispatch?tab=remote',
  '/summaries': '/ops/summaries',
  '/cs/tickets': '/ops/cs/tickets',
  '/billing/invoices': '/ops/billing/invoices',
  '/billing/commissions': '/ops/commissions/rates',
  '/drop-points': '/ops/admin/drop-points',
  '/customer/summary': '/ops/reports/customer-summary',
  '/reports/manifest': '/ops/reports/manifest',
  '/admin/users': '/ops/admin/users',
  '/admin/branches': '/ops/admin/branches',
  '/admin/hubs': '/ops/admin/hubs',
  '/admin/staff': '/ops/staff',
  '/admin/routes': '/ops/admin/routes',
  '/admin/role-access': '/ops/admin/role-access',
}

export function remapDefaultRoute(route) {
  const raw = String(route || '').trim() || '/ops/dashboard'
  if (ROUTE_ALIASES[raw]) return ROUTE_ALIASES[raw]
  if (raw.startsWith('/ops/')) return raw
  if (raw.startsWith('/admin/')) return `/ops${raw}`
  if (raw.startsWith('/billing/')) return `/ops${raw}`
  if (raw.startsWith('/cs/')) return `/ops${raw}`
  return raw.startsWith('/') ? raw : '/ops/dashboard'
}
