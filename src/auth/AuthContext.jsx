import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiError, loginOffice, logoutOffice, meOffice } from '../api/client'
import { capabilitiesFor, DEMO_USERS } from './rbac'

import { message } from 'antd'

const AuthContext = createContext(null)
const STORAGE_KEY = 'iposb.staff.session'

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function sessionFromApi(token, user, capabilities = null, issuedAt = null) {
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.fullName || user.username,
    role: user.role || user.appRole || 'Others',
    branchCode: user.branchCode || null,
    capabilities: capabilities || user.capabilities || null,
    issuedAt: issuedAt || Date.now(),
    token,
    authKind: 'office',
  }
}

function demoFallbackEnabled() {
  return String(import.meta.env.VITE_ALLOW_DEMO_LOGIN || '').toLowerCase() === 'true'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession)
  const [booting, setBooting] = useState(Boolean(loadSession()?.token))

  // Re-validate office Bearer on refresh (ignore fake demoStaff tokens).
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const session = loadSession()
      if (!session?.token || String(session.token).startsWith('demoStaff:')) {
        setBooting(false)
        return
      }
      try {
        const data = await meOffice()
        const apiUser = data.user || data
        const apiCaps = data.capabilities || apiUser.capabilities || session.capabilities || null
        if (!cancelled) {
          const next = sessionFromApi(session.token, apiUser, apiCaps, session.issuedAt)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          setUser(next)
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY)
          setUser(null)
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  // 12-hour session lifespan tracker with 11-hour warning
  useEffect(() => {
    if (!user?.token || !user?.issuedAt) return
    let warned = false
    const interval = setInterval(() => {
      const elapsed = Date.now() - user.issuedAt
      const twelveHours = 12 * 60 * 60 * 1000
      const elevenHours = 11 * 60 * 60 * 1000
      if (elapsed >= twelveHours) {
        clearInterval(interval)
        message.error('Your 12-hour office session has expired. Please log in again.')
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      } else if (elapsed >= elevenHours && !warned) {
        warned = true
        message.warning('Your session will expire in less than 1 hour. Please save your work.')
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [user])

  const caps = useMemo(() => {
    if (!user) return null
    const defaultCaps = capabilitiesFor(user.role)
    if (user.capabilities && typeof user.capabilities === 'object') {
      return { ...defaultCaps, ...user.capabilities }
    }
    return defaultCaps
  }, [user])

  const value = useMemo(() => {
    const isAdmin = ['Super Admin', 'Admin'].includes(user?.role)
    return {
      user,
      caps,
      booting,
      isAdmin,
      can(capName) {
        if (!caps) return false
        if (isAdmin) return true
        return Boolean(caps[capName])
      },
      async login(username, password) {
        try {
          const data = await loginOffice(username, password)
          if (!data?.token || !data?.user) {
            throw new Error(data?.error || 'Login failed')
          }
          const session = sessionFromApi(
            data.token,
            data.user,
            data.capabilities || data.user?.capabilities,
            Date.now(),
          )
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
          setUser(session)
          return session
        } catch (err) {
          // Optional local-only fallback (dev). Off by default.
          if (demoFallbackEnabled()) {
            const found = DEMO_USERS.find(
              (u) => u.username === username.trim() && u.password === password,
            )
            if (found) {
              const session = {
                username: found.username,
                name: found.name,
                role: found.role,
                branchCode: found.branchCode,
                capabilities: capabilitiesFor(found.role),
                issuedAt: Date.now(),
                token: `demoStaff:${found.username}`,
                authKind: 'demo',
              }
              localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
              setUser(session)
              return session
            }
          }
          throw new Error(apiError(err) || err.message || 'Login failed')
        }
      },
      async logout() {
        try {
          await logoutOffice()
        } finally {
          localStorage.removeItem(STORAGE_KEY)
          sessionStorage.removeItem('fms.ops.cn_tracking')
          setUser(null)
        }
      },
    }
  }, [user, caps, booting])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
