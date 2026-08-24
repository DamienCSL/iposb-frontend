import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const key = import.meta.env.VITE_DISPATCH_KEY
  if (key) {
    config.headers['X-Dispatch-Key'] = key
  }
  const raw = localStorage.getItem('iposb.staff.session')
  if (raw) {
    try {
      const session = JSON.parse(raw)
      if (session.token) {
        config.headers.Authorization = `Bearer ${session.token}`
      }
    } catch {
      /* ignore */
    }
  }
  return config
})

export async function getHealth() {
  const { data } = await api.get('/health')
  return data
}

export async function getTracking(cn) {
  const { data } = await api.get(`/tracking/${encodeURIComponent(cn)}`)
  return data
}

export async function getDispatchJobs(assigned = false) {
  const { data } = await api.get('/dispatch/jobs', {
    params: assigned ? { assigned: '1' } : {},
  })
  return data
}

export async function getUncoveredJobs() {
  const { data } = await api.get('/dispatch/uncovered')
  return data
}
