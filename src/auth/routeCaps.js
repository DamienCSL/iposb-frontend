/**
 * Map URL paths to required capability keys (must match API / nav caps).
 * First match wins — put more specific prefixes first.
 */
const ROUTE_RULES = [
  ['/ops/admin/role-access', 'roleAccess'],
  ['/ops/admin/users', 'users'],
  ['/ops/admin/drop-points', 'dropPoints'],
  ['/ops/admin/drivers', 'staff'],
  ['/ops/admin/dispatchers', 'staff'],
  ['/ops/admin/routes', 'routing'],
  ['/ops/admin/zones', 'routing'],
  ['/ops/admin/delivery-points', 'routing'],
  ['/ops/admin/route-codes', 'routing'],
  ['/ops/admin/areas', 'routing'],
  ['/ops/admin', 'admin'],
  ['/ops/staff', 'staff'],
  ['/ops/commissions', 'commissions'],
  ['/ops/partner-wallets', 'commissions'],
  ['/ops/cod', 'cod'],
  ['/ops/billing', 'billing'],
  ['/ops/pickups', 'pickups'],
  ['/ops/manifests', 'manifests'],
  ['/ops/seals', 'manifests'],
  ['/ops/station/manifests', 'manifests'],
  ['/ops/dispatch', 'dispatch'],
  ['/ops/returns', 'consignments'],
  ['/ops/ats-claims', 'consignments'],
  ['/ops/overnight-requests', 'pickups'],
  ['/ops/consignments', 'consignments'],
  ['/ops/cs', 'customerService'],
  ['/ops/summaries', 'summaries'],
  ['/ops/reports/customer-summary', 'customerReports'],
  ['/ops/reports/invoice', 'billing'],
  ['/ops/reports/do', 'billing'],
  ['/ops/reports/receipt', 'billing'],
  ['/ops/reports', 'reports'],
  ['/network', 'reports'],
  ['/admin/role-access', 'roleAccess'],
  ['/admin/users', 'users'],
  ['/admin/customers', 'consignments'],
  ['/admin/branches', 'hubs'],
  ['/admin/hubs', 'hubs'],
  ['/admin/staff', 'staff'],
  ['/admin/dispatchers', 'staff'],
  ['/admin/drivers', 'staff'],
  ['/admin/routes', 'routing'],
  ['/admin/delivery-points', 'routing'],
  ['/admin/areas', 'routing'],
  ['/admin/zones', 'routing'],
  ['/admin/route-codes', 'routing'],
  ['/billing/commissions', 'commissions'],
  ['/billing/', 'billing'],
  ['/drop-points', 'dropPoints'],
  ['/consignments', 'consignments'],
  ['/dispatch', 'dispatch'],
  ['/cs/', 'customerService'],
  ['/summaries', 'summaries'],
  ['/customer/', 'customerReports'],
  ['/reports/invoice', 'billing'],
  ['/reports/do', 'billing'],
  ['/reports/receipt', 'billing'],
  ['/reports/', 'reports'],
]

export function routeRequiredCap(pathname) {
  if (!pathname || pathname === '/' || pathname === '/ops/dashboard') return null
  for (const [prefix, cap] of ROUTE_RULES) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      return cap
    }
  }
  return null
}

export function routeAllowed(pathname, caps) {
  const cap = routeRequiredCap(pathname)
  if (!cap) return true
  return Boolean(caps?.[cap])
}
