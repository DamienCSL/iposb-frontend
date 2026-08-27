import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiError, loginOffice, logoutOffice, meOffice } from '../api/client'
import { capabilitiesFor, DEMO_USERS } from './rbac'

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

function sessionFromApi(token, user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.fullName || user.username,
    role: user.role || user.appRole || 'Others',
    branchCode: user.branchCode || null,
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
        if (!cancelled) {
          const next = sessionFromApi(session.token, apiUser)
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

  const value = useMemo(() => {
    const caps = user ? capabilitiesFor(user.role) : null
    return {
      user,
      caps,
      booting,
      async login(username, password) {
        try {
          const data = await loginOffice(username, password)
          if (!data?.token || !data?.user) {
            throw new Error(data?.error || 'Login failed')
          }
          const session = sessionFromApi(data.token, data.user)
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
  }, [user, booting])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
