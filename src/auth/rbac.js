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
  dispatch: false,
  summaries: false,
  billing: false,
  agent: false,
  customerReports: false,
  reports: false,
  users: false,
  branches: false,
  hubs: false,
  dropPoints: false,
  staff: false,
  routing: false,
  customerService: false,
}

export function normalizeRole(role) {
  if (role === 'System' || role === 'Supervisor') return ADMIN
  if (role === 'Agent 2') return 'Agent'
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
      dispatch: true,
      summaries: true,
      billing: true,
      agent: true,
      customerReports: true,
      reports: true,
      branches: true,
      hubs: true,
      dropPoints: true,
      staff: true,
      routing: true,
      customerService: true,
    },
    [HUB_MANAGER]: {
      ...EMPTY,
      consignments: true,
      dispatch: true,
      summaries: true,
      customerReports: true,
      reports: true,
      hubs: true,
      dropPoints: true,
      routing: true,
      customerService: true,
    },
    [DROPPOINT_MANAGER]: {
      ...EMPTY,
      consignments: true,
      customerReports: true,
      reports: true,
      dropPoints: true,
      customerService: true,
    },
    Operation: {
      ...EMPTY,
      consignments: true,
      dispatch: true,
      summaries: true,
      customerReports: true,
      reports: true,
      customerService: true,
    },
    Agent: {
      ...EMPTY,
      consignments: true,
      dispatch: true,
      summaries: true,
      agent: true,
      customerReports: true,
      reports: true,
      customerService: true,
    },
    Invoice: {
      ...EMPTY,
      consignments: true,
      billing: true,
      customerReports: true,
      reports: true,
    },
    CSL: {
      ...EMPTY,
      consignments: true,
      summaries: true,
      customerReports: true,
      reports: true,
      customerService: true,
    },
  }
  return map[r] ?? { ...EMPTY, consignments: true, customerReports: true, reports: true }
}

export function can(caps, capability) {
  return Boolean(caps?.[capability])
}
