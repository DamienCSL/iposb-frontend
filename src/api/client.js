import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL,
  timeout: 30000,
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

export function apiError(err) {
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
  const { data } = await api.get(`/tracking/${encodeURIComponent(cn)}`)
  return data
}

export async function getDispatchJobs(assigned = false) {
  const { data } = await api.get('/dispatch/jobs', { params: assigned ? { assigned: '1' } : {} })
  return data
}

export async function getUncoveredJobs() {
  const { data } = await api.get('/dispatch/uncovered', { params: { limit: 150 } })
  return data
}

export async function getDispatchDrivers() {
  const { data } = await api.get('/dispatch/drivers', { params: { available: 1 } })
  return data.drivers || []
}

export async function get3plPartners() {
  const { data } = await api.get('/dispatch/3pl-partners')
  return data.partners || []
}

export async function assignDriver({ cnNo, driverId, firebaseUid, jobType }) {
  const { data } = await api.post('/dispatch/assign', { cnNo, driverId, firebaseUid, jobType })
  return data
}

export async function assign3pl({ cnNo, partnerId }) {
  const { data } = await api.post('/dispatch/assign-3pl', { cnNo, partnerId })
  return data
}

export async function planDispatch(cnNo, autoAssign = true) {
  const { data } = await api.post('/dispatch/plan', { cnNo, autoAssign })
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

export async function listCodCollections(params) {
  const { data } = await api.get('/ops/cod', { params })
  return data
}

export async function getCodRecord(cn) {
  const { data } = await api.get(`/ops/cod/${encodeURIComponent(cn)}`)
  return data
}

export async function collectCodAtDropPoint(cn, body) {
  const { data } = await api.post(`/ops/cod/${encodeURIComponent(cn)}/collect`, body)
  return data
}

export async function remitCod(cn, body) {
  const { data } = await api.post(`/ops/cod/${encodeURIComponent(cn)}/remit`, body)
  return data
}

export async function settleCod(cn) {
  const { data } = await api.post(`/ops/cod/${encodeURIComponent(cn)}/settle`)
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

export async function getCommissionConfig() {
  const { data } = await api.get('/ops/commissions/config')
  return data
}

export async function listCommissions(params) {
  const { data } = await api.get('/ops/commissions', { params })
  return data
}

export async function accrueCommission(cn) {
  const { data } = await api.post(`/ops/commissions/accrue/${encodeURIComponent(cn)}`)
  return data
}

export async function verifyCommission(id) {
  const { data } = await api.post(`/ops/commissions/${id}/verify`)
  return data
}

export async function listPartnerWallets(params) {
  const { data } = await api.get('/ops/partner-wallets', { params })
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

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
