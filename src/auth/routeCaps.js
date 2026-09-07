/**
 * Map URL paths to required capability keys (must match API / nav caps).
 * First match wins — put more specific prefixes first.
 */
const ROUTE_RULES = [
  ['/admin/role-access', 'roleAccess'],
  ['/admin/users', 'users'],
  ['/admin/branches', 'hubs'],
  ['/admin/hubs', 'hubs'],
  ['/admin/staff', 'staff'],
  ['/admin/dispatchers', 'staff'],
  ['/admin/drivers', 'staff'],
  ['/admin/routes', 'routing'],
  ['/admin/delivery-points', 'routing'],
  ['/admin/zones', 'routing'],
  ['/admin/route-codes', 'routing'],
  ['/billing/commissions', 'dropPoints'],
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

/** Dashboard is always allowed. */
export function routeRequiredCap(pathname) {
  if (!pathname || pathname === '/') return null
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
