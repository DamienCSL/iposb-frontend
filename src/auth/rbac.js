/** Mirrors deploy/shared/core/Rbac.php */

export const SUPER_ADMIN = 'Super Admin'
export const ADMIN = 'Admin'
export const HUB_MANAGER = 'Hub Manager'
export const DROPPOINT_MANAGER = 'Droppoint Manager'

export const DEMO_USERS = [
  { username: 'admin', password: 'admin123', name: 'Demo Super Admin', role: SUPER_ADMIN, branchCode: 'BKI' },
  { username: 'ops', password: 'ops123', name: 'Demo Operations', role: 'Operation', branchCode: 'BKI' },
  { username: 'billing', password: 'billing123', name: 'Demo Billing', role: 'Invoice', branchCode: 'BKI' },
  { username: 'dp', password: 'dp123', name: 'Demo DP Manager', role: DROPPOINT_MANAGER, branchCode: 'BKI' },
  { username: 'agent', password: 'agent123', name: 'Demo Agent', role: 'Agent', branchCode: 'BKI' },
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
  agent: false,
  customerReports: false,
  reports: false,
  users: false,
  branches: false,
  hubs: false,
  dropPoints: false,
  routing: false,
  voidBilling: false,
  rotateApiKey: false,
  verifyCommission: false,
}

export function normalizeRole(role) {
  if (role === 'System' || role === 'Supervisor') return ADMIN
  if (role === 'Agent 2') return 'Agent'
  if (role === 'Finance') return 'Invoice'
  return role || 'Others'
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
      agent: true,
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
      cod: true,
      dropPoints: true,
      customerService: true,
      reports: true,
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
      voidBilling: false,
      rotateApiKey: false,
      verifyCommission: false,
    },
    Invoice: {
      ...EMPTY,
      consignments: true,
      billing: true,
      cod: true,
      commissions: true,
      customerReports: true,
      reports: true,
      voidBilling: false,
      rotateApiKey: false,
      verifyCommission: false,
    },
    CSL: {
      ...EMPTY,
      consignments: true,
      customerService: true,
      summaries: true,
      customerReports: true,
      reports: true,
    },
    Agent: {
      ...EMPTY,
      consignments: true,
      agent: true,
      customerService: true,
      customerReports: true,
      reports: true,
    },
  }
  return map[r] ?? { ...EMPTY, consignments: true, customerReports: true, reports: true }
}

export function can(caps, capability) {
  return Boolean(caps?.[capability])
}
