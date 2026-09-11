import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL,
  timeout: 300000,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const url = String(config.url || '')
  const key = import.meta.env.VITE_DISPATCH_KEY
  // Dispatch routes accept X-Dispatch-Key; ops/staff should use real office Bearer.
  if (key && (url.startsWith('/dispatch') || url.startsWith('/ops/scan') || url.startsWith('/demo/'))) {
    config.headers['X-Dispatch-Key'] = key
  }
  const raw = localStorage.getItem('iposb.staff.session')
  if (raw) {
    try {
      const session = JSON.parse(raw)
      if (session.token) config.headers.Authorization = `Bearer ${session.token}`
    } catch {
      /* ignore */
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      localStorage.removeItem('iposb.staff.session')
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export function apiError(err) {
  if (err?.response?.status === 403) {
    return "You don't have permission for this action"
  }
  return err?.response?.data?.error || err?.response?.data?.message || err.message
}

/** Office / FMS staff — POST /api/ops/auth/login */
export async function loginOffice(username, password) {
  const { data } = await api.post('/ops/auth/login', { username, password })
  return data
}

export async function logoutOffice() {
  try {
    await api.post('/ops/auth/logout')
  } catch {
    /* best-effort revoke */
  }
}

export async function meOffice() {
  const { data } = await api.get('/ops/auth/me')
  return data
}

export async function getRbacModules() {
  const { data } = await api.get('/ops/rbac/modules')
  return data
}

export async function getRbacRoles() {
  const { data } = await api.get('/ops/rbac/roles')
  return data
}

export async function updateRbacRole(role, body) {
  const { data } = await api.put(`/ops/rbac/roles/${encodeURIComponent(role)}`, body)
  return data
}

export async function getHealth() {
  const { data } = await api.get('/health')
  return data
}

export async function getTracking(cn) {
  // FMS uses ops tracking (planned route + assignment). Fall back to public tracking.
  try {
    const { data } = await api.get(`/ops/consignments/${encodeURIComponent(cn)}/tracking`)
    return data
  } catch {
    const { data } = await api.get(`/tracking/${encodeURIComponent(cn)}`)
    return data
  }
}

export async function getDispatchJobs(assigned = false) {
  const { data } = await api.get('/ops/dispatch/jobs', { params: assigned ? { assigned: '1' } : {} })
  return data
}

export async function getUncoveredJobs() {
  const { data } = await api.get('/ops/dispatch/uncovered', { params: { limit: 150 } })
  return data
}

export async function getDispatchDrivers() {
  const { data } = await api.get('/ops/dispatch/drivers', { params: { available: 1 } })
  return data.drivers || []
}

export async function get3plPartners() {
  const { data } = await api.get('/ops/dispatch/3pl-partners')
  return data.partners || []
}

export async function assignDriver({ cnNo, driverId, firebaseUid, jobType }) {
  const { data } = await api.post('/ops/dispatch/assign', { cnNo, driverId, firebaseUid, jobType })
  return data
}

export async function assign3pl({ cnNo, partnerId }) {
  const { data } = await api.post('/ops/dispatch/assign-3pl', { cnNo, partnerId })
  return data
}

export async function planDispatch(cnNo, autoAssign = true) {
  const { data } = await api.post('/ops/dispatch/plan', { cnNo, autoAssign })
  return data
}

export async function getOpsDashboard() {
  const { data } = await api.get('/ops/dashboard')
  return data
}

export async function getCnLookups() {
  const { data } = await api.get('/ops/consignments/lookups')
  return data
}

export async function listConsignments(params) {
  const { data } = await api.get('/ops/consignments', { params })
  return data
}

export async function getConsignment(cn) {
  const { data } = await api.get(`/ops/consignments/${encodeURIComponent(cn)}`)
  return data
}

export async function getOpsConsignmentTracking(cn) {
  const { data } = await api.get(`/ops/consignments/${encodeURIComponent(cn)}/tracking`)
  return data
}

export async function saveConsignment(body) {
  const { data } = await api.post('/ops/consignments', body)
  return data
}

export async function quoteConsignment(body) {
  const { data } = await api.post('/ops/consignments/quote', body)
  return data
}

export async function previewInvoice(params) {
  const { data } = await api.get('/ops/billing/invoices/preview', { params })
  return data
}

export async function generateInvoice(body) {
  const { data } = await api.post('/ops/billing/invoices/generate', body)
  return data
}

/** Suggest a unique identity / document code for form fields. */
export async function generateSystemCode(body) {
  const { data } = await api.post('/ops/codes/generate', body)
  return data
}

export async function cancelConsignment(cn, body = {}) {
  const { data } = await api.post(`/ops/consignments/${encodeURIComponent(cn)}/cancel`, body)
  return data
}

export async function previewCancellation(cn) {
  const { data } = await api.get(`/ops/consignments/${encodeURIComponent(cn)}/cancel-preview`)
  return data
}

export async function getCancellationConfig() {
  const { data } = await api.get('/ops/billing/cancellation-config')
  return data
}

export async function updateCancellationConfig(body) {
  const { data } = await api.put('/ops/billing/cancellation-config', body)
  return data
}

export async function getCancellationDetail(cn) {
  const { data } = await api.get(`/ops/consignments/${encodeURIComponent(cn)}/cancellation`)
  return data
}

export async function listCancellationLog(params = {}) {
  const { data } = await api.get('/ops/cancellations/log', { params })
  return data
}

export async function getWalletLedger(params) {
  const { data } = await api.get('/ops/billing/wallet', { params })
  return data
}

export async function accrueCommission(cn) {
  const { data } = await api.post(`/ops/commissions/accrue/${encodeURIComponent(cn)}`)
  return data
}

export async function listCommissionWithdrawals(params) {
  const { data } = await api.get('/ops/commission-withdrawals', { params })
  return data
}

export async function requestCommissionWithdrawal(code, body) {
  const { data } = await api.post(`/ops/partner-wallets/${encodeURIComponent(code)}/withdraw`, body)
  return data
}

export async function advanceCommissionWithdrawal(id, action) {
  const { data } = await api.post(`/ops/commission-withdrawals/${id}/advance`, { action })
  return data
}

export async function exportConsignments(body) {
  const { data } = await api.post('/ops/consignments/export', body)
  return data
}

export async function importConsignments(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/ops/consignments/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
  return data
}

export async function listImportBatches(params) {
  const { data } = await api.get('/ops/import-batches', { params })
  return data
}

export async function getImportBatch(id) {
  const { data } = await api.get(`/ops/import-batches/${id}`)
  return data
}

export async function getSummary(kind, params) {
  const { data } = await api.get(`/ops/summaries/${kind}`, { params })
  return data
}

export async function listBilling(doc, params) {
  const { data } = await api.get(`/ops/billing/${doc}`, { params })
  return data
}

export async function getBilling(doc, id) {
  const { data } = await api.get(`/ops/billing/${doc}/${encodeURIComponent(id)}`)
  return data
}

export async function saveBilling(doc, body) {
  const { data } = await api.post(`/ops/billing/${doc}`, body)
  return data
}

export async function listMaster(resource) {
  const { data } = await api.get(`/ops/admin/${resource}`)
  return data
}

export async function saveMaster(resource, body, id) {
  const { data } = id
    ? await api.put(`/ops/admin/${resource}/${id}`, body)
    : await api.post(`/ops/admin/${resource}`, body)
  return data
}

export async function deleteMaster(resource, id) {
  const { data } = await api.delete(`/ops/admin/${resource}/${id}`)
  return data
}

export async function listStaff(tab) {
  const { data } = await api.get('/ops/staff', { params: { tab } })
  return data
}

export async function verifyStaff(id, action, note) {
  const { data } = await api.post(`/ops/staff/${id}/verify`, { action, note })
  return data
}

export async function getReport(kind, params) {
  const { data } = await api.get(`/ops/reports/${kind}`, { params })
  return data
}

export async function getPrint(kind, id) {
  const { data } = await api.get(`/ops/print/${kind}`, { params: { id } })
  return data
}

export async function listCsTickets(params) {
  const { data } = await api.get('/ops/cs/tickets', { params })
  return data
}

export async function getCsTicket(id) {
  const { data } = await api.get(`/ops/cs/tickets/${id}`)
  return data
}

export async function replyCsTicket(id, body) {
  const { data } = await api.post(`/ops/cs/tickets/${id}/reply`, { body })
  return data
}

export async function closeCsTicket(id) {
  const { data } = await api.post(`/ops/cs/tickets/${id}/close`)
  return data
}

// --- Pickups (v3.5) ---
export async function getPickupsWaiting(params) {
  const { data } = await api.get('/ops/pickups/waiting', { params })
  return data
}

export async function getPickupsQueue(params) {
  const { data } = await api.get('/ops/pickups/queue', { params })
  return data
}

export async function assignPickup(cn, body) {
  const { data } = await api.post(`/ops/pickups/${encodeURIComponent(cn)}/assign`, body)
  return data
}

export async function autoAssignPickups(body) {
  const { data } = await api.post('/ops/pickups/auto-assign', body)
  return data
}

export async function getPickup(cn) {
  const { data } = await api.get(`/ops/pickups/${encodeURIComponent(cn)}`)
  return data
}

// --- Manifests (v3.5) ---
export async function listManifests(params) {
  const { data } = await api.get('/ops/manifests', { params })
  return data
}

export async function getManifest(mfg) {
  const { data } = await api.get(`/ops/manifests/${encodeURIComponent(mfg)}`)
  return data
}

export async function createManifest(body) {
  const { data } = await api.post('/ops/manifests', body)
  return data
}

export async function attachManifestConsignments(mfg, body) {
  const { data } = await api.post(`/ops/manifests/${encodeURIComponent(mfg)}/consignments`, body)
  return data
}

export async function detachManifestConsignment(mfg, cn) {
  const { data } = await api.delete(`/ops/manifests/${encodeURIComponent(mfg)}/consignments/${encodeURIComponent(cn)}`)
  return data
}

// --- Billing Void & PDF ---
export async function voidBilling(doc, id, note) {
  const { data } = await api.post(`/ops/billing/${doc}/${encodeURIComponent(id)}/void`, { note })
  return data
}

export function getBillingPdfUrl(doc, id) {
  const token = (() => {
    try {
      const raw = localStorage.getItem('iposb.staff.session')
      return raw ? JSON.parse(raw)?.token : ''
    } catch {
      return ''
    }
  })()
  const base = import.meta.env.VITE_API_URL || '/api'
  return `${base}/ops/billing/${doc}/${encodeURIComponent(id)}/pdf?token=${encodeURIComponent(token)}`
}

// --- COD (v3.5) ---
export async function listCod(params) {
  const { data } = await api.get('/ops/cod', { params })
  return data
}

export async function getCod(cn) {
  const { data } = await api.get(`/ops/cod/${encodeURIComponent(cn)}`)
  return data
}

export async function collectCod(cn, body) {
  const { data } = await api.post(`/ops/cod/${encodeURIComponent(cn)}/collect`, body)
  return data
}

export async function remitCod(cn, body) {
  const { data } = await api.post(`/ops/cod/${encodeURIComponent(cn)}/remit`, body)
  return data
}

export async function settleCod(cn, body) {
  const { data } = await api.post(`/ops/cod/${encodeURIComponent(cn)}/settle`, body)
  return data
}

// --- Commissions & Partner Wallets (v3.5) ---
export async function listCommissions(params) {
  const { data } = await api.get('/ops/commissions', { params })
  return data
}

export async function getCommissionConfig() {
  const { data } = await api.get('/ops/commissions/config')
  return data
}

export async function saveCommissionConfig(body) {
  const { data } = await api.put('/ops/commissions/config', body)
  return data
}

export async function updateCommissionConfig(body) {
  return saveCommissionConfig(body)
}

export async function verifyCommission(id) {
  const { data } = await api.post(`/ops/commissions/${encodeURIComponent(id)}/verify`)
  return data
}

export async function listPartnerWallets(params) {
  const { data } = await api.get('/ops/partner-wallets', { params })
  return data
}

export async function requestPartnerWalletWithdrawal(body) {
  const { data } = await api.post('/ops/partner-wallets/withdraw', body)
  return data
}

// --- Partner API Key Rotation ---
export async function rotateApiKey(partnerCode) {
  const { data } = await api.post(`/ops/admin/api-keys/${encodeURIComponent(partnerCode)}/rotate`)
  return data
}

// --- First Run Detection ---
export async function checkFirstRun() {
  try {
    const [hubsRes, branchesRes] = await Promise.all([
      api.get('/hubs').catch(() => api.get('/ops/admin/hubs')).catch(() => ({ data: [] })),
      api.get('/branches').catch(() => api.get('/ops/admin/branches')).catch(() => ({ data: [] })),
    ])
    const hubs =
      hubsRes?.data?.hubs ||
      hubsRes?.data?.data ||
      hubsRes?.data?.rows ||
      (Array.isArray(hubsRes?.data) ? hubsRes.data : [])
    const branches =
      branchesRes?.data?.branches ||
      branchesRes?.data?.data ||
      branchesRes?.data?.rows ||
      (Array.isArray(branchesRes?.data) ? branchesRes.data : [])

    const hasHubs = Array.isArray(hubs) && hubs.length > 0
    const hasBranches = Array.isArray(branches) && branches.length > 0

    return {
      hasHubs,
      hasBranches,
      isFirstRun: !hasHubs && !hasBranches,
    }
  } catch {
    return { hasHubs: true, hasBranches: true, isFirstRun: false }
  }
}

export async function listReturns(params) {
  const { data } = await api.get('/ops/returns', { params })
  return data
}

export async function getReturn(cn) {
  const { data } = await api.get(`/ops/returns/${encodeURIComponent(cn)}`)
  return data
}

export async function initiateReturn(cn, body) {
  const { data } = await api.post(`/ops/returns/${encodeURIComponent(cn)}/initiate`, body)
  return data
}

export function downloadCsv(filename, rows) {
  if (!rows) return

  const normalizedRows = Array.isArray(rows)
    ? rows
    : Array.isArray(rows?.data)
      ? rows.data
      : Array.isArray(rows?.rows)
        ? rows.rows
        : null

  if (!normalizedRows || normalizedRows.length === 0) return

  let csv = ''
  if (typeof rows === 'string') {
    csv = rows
  } else if (Array.isArray(normalizedRows)) {
    if (!Array.isArray(normalizedRows[0]) && typeof normalizedRows[0] === 'object' && normalizedRows[0] !== null) {
      const headers = Object.keys(normalizedRows[0])
      const headerLine = headers.map((h) => `"${String(h ?? '').replaceAll('"', '""')}"`).join(',')
      const dataLines = normalizedRows.map((r) =>
        headers.map((h) => `"${String(r?.[h] ?? '').replaceAll('"', '""')}"`).join(',')
      )
      csv = [headerLine, ...dataLines].join('\n')
    } else {
      csv = normalizedRows
        .map((r) => (Array.isArray(r) ? r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(',') : String(r)))
        .join('\n')
    }
  } else {
    return
  }

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'export.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadExportJob(jobId, defaultFilename = 'consignments.csv') {
  const response = await api.get(`/ops/exports/${jobId}/download`, {
    responseType: 'blob',
  })
  let filename = defaultFilename
  const disposition = response.headers?.['content-disposition']
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/)
    if (match?.[1]) filename = match[1]
  }
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

// --- System Audit & Activity Logs ---
export async function listSystemLogs(params) {
  const { data } = await api.get('/ops/logs', { params })
  return data
}

export async function getSystemLogStats() {
  const { data } = await api.get('/ops/logs/stats')
  return data
}

export const listCodCollections = listCod
export const getCodRecord = getCod
export const collectCodAtDropPoint = collectCod

