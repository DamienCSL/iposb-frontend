/** Mirrors iposb-api RbacService + FMS staff roles. */

export const SUPER_ADMIN = 'Super Admin'
export const ADMIN = 'Admin'
export const HUB_MANAGER = 'Hub Manager'
export const DROPPOINT_MANAGER = 'Droppoint Manager'

/**
 * Roles assignable in FMS User Management (t_user).
 * Seller / Receiver are consignment parties — not login roles.
 * Shipper billing accounts use Customer Registration (t_customer).
 * Mobile app logins use t_mobile_user (customer / driver / dispatcher).
 * Legacy "Agent" accounts map to Droppoint Manager.
 */
export const STAFF_ASSIGNABLE_ROLES = [
  SUPER_ADMIN,
  ADMIN,
  HUB_MANAGER,
  DROPPOINT_MANAGER,
  'Operation',
  'Invoice',
  'CSL',
]

export const STAFF_ROLE_OPTIONS = STAFF_ASSIGNABLE_ROLES.map((r) => [r, r])

export const DEMO_USERS = [
  { username: 'admin', password: 'admin123', name: 'Demo Super Admin', role: SUPER_ADMIN, branchCode: 'BKI' },
  { username: 'ops', password: 'ops123', name: 'Demo Operations', role: 'Operation', branchCode: 'BKI' },
  { username: 'billing', password: 'billing123', name: 'Demo Billing', role: 'Invoice', branchCode: 'BKI' },
  { username: 'dp', password: 'dp123', name: 'Demo DP Manager', role: DROPPOINT_MANAGER, branchCode: 'BKI' },
]

const EMPTY = {
  consignments: false,
  pickups: false,
  manifests: false,
  billing: false,
  cod: false,
  commissions: false,
  customerService: false,
  staff: false,
  admin: false,
  dispatch: false,
  summaries: false,
  customerReports: false,
  reports: false,
  users: false,
  branches: false,
  hubs: false,
  dropPoints: false,
  routing: false,
  roleAccess: false,
  voidBilling: false,
  rotateApiKey: false,
  verifyCommission: false,
}

export function normalizeRole(role) {
  const raw = String(role || '').trim()
  const key = raw.toLowerCase().replace(/[_-]+/g, ' ')
  if (key === 'super admin' || key === 'superadmin') return SUPER_ADMIN
  if (key === 'admin' || key === 'system' || key === 'supervisor') return key === 'admin' ? ADMIN : ADMIN
  if (key === 'agent' || key === 'agent 2') return DROPPOINT_MANAGER
  if (key === 'finance') return 'Invoice'
  return raw || 'Others'
}

/** Drop point counter staff (legacy Agent / Agent 2 normalize here). */
export function isDroppointManager(role) {
  return normalizeRole(role) === DROPPOINT_MANAGER
}

/** Consignment entry URL for the current role (DP managers are locked to drop mode). */
export function consignmentsNewPath(role, extraParams = {}) {
  const q = new URLSearchParams()
  if (isDroppointManager(role)) q.set('mode', 'drop')
  for (const [k, v] of Object.entries(extraParams || {})) {
    if (v != null && v !== '') q.set(k, String(v))
  }
  const qs = q.toString()
  return qs ? `/ops/consignments/new?${qs}` : '/ops/consignments/new'
}

export function capabilitiesFor(role) {
  const r = normalizeRole(role)
  if (r === SUPER_ADMIN) {
    return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true]))
  }
  const map = {
    [ADMIN]: {
      ...EMPTY,
      consignments: true,
      pickups: true,
      manifests: true,
      billing: true,
      cod: true,
      commissions: true,
      customerService: true,
      staff: true,
      admin: true,
      dispatch: true,
      summaries: true,
      customerReports: true,
      reports: true,
      users: true,
      branches: true,
      hubs: true,
      dropPoints: true,
      routing: true,
      voidBilling: true,
      rotateApiKey: true,
      verifyCommission: true,
    },
    [HUB_MANAGER]: {
      ...EMPTY,
      consignments: true,
      pickups: true,
      manifests: true,
      customerService: true,
      dispatch: true,
      hubs: true,
      dropPoints: true,
      routing: true,
      summaries: true,
      reports: true,
    },
    [DROPPOINT_MANAGER]: {
      ...EMPTY,
      consignments: true,
      pickups: true,
      billing: true,
      cod: true,
      dropPoints: true,
      customerService: true,
      reports: true,
      customerReports: true,
    },
    Operation: {
      ...EMPTY,
      consignments: true,
      pickups: true,
      manifests: true,
      customerService: true,
      dispatch: true,
      summaries: true,
      reports: true,
    },
    Invoice: {
      ...EMPTY,
      consignments: true,
      billing: true,
      cod: true,
      commissions: true,
      customerReports: true,
      reports: true,
    },
    CSL: {
      ...EMPTY,
      consignments: true,
      customerService: true,
      summaries: true,
      customerReports: true,
      reports: true,
    },
  }
  return map[r] ?? { ...EMPTY, consignments: true, customerReports: true, reports: true }
}

export function can(caps, capability) {
  return Boolean(caps?.[capability])
}
