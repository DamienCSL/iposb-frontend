import { createContext, useContext, useMemo, useState } from 'react'
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession)

  const value = useMemo(() => {
    const caps = user ? capabilitiesFor(user.role) : null
    return {
      user,
      caps,
      login(username, password) {
        const found = DEMO_USERS.find(
          (u) => u.username === username.trim() && u.password === password,
        )
        if (!found) {
          throw new Error('Invalid username or password.')
        }
        const session = {
          username: found.username,
          name: found.name,
          role: found.role,
          branchCode: found.branchCode,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
        setUser(session)
        return session
      },
      logout() {
        localStorage.removeItem(STORAGE_KEY)
        sessionStorage.removeItem('fms.ops.cn_tracking')
        setUser(null)
      },
    }
  }, [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
