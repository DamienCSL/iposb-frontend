import { useEffect, useRef } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { routeAllowed } from '../auth/routeCaps'
import { visibleAdmin, visibleSections } from '../nav/navConfig'

const SCROLL_KEY = 'fms.sidebar.scrollTop'

export default function AppLayout() {
  const { user, caps, logout, booting, defaultRoute } = useAuth()
  const location = useLocation()
  const sidebarRef = useRef(null)

  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved !== null) {
      el.scrollTop = parseInt(saved, 10) || 0
    }
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [user])

  if (booting) {
    return <div className="main-content text-muted p-4">Loading session…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const sections = visibleSections(caps)
  const admin = visibleAdmin(caps)
  const homeRoute = defaultRoute || '/'

  if (!routeAllowed(location.pathname, caps)) {
    return <Navigate to={homeRoute} replace />
  }

  async function onLogout() {
    await logout()
  }

  return (
    <>
      <nav className="sidebar" ref={sidebarRef}>
        <div className="brand">
          <img src="/iposb-logo.png" alt="IPOSB" />
          <div className="brand-text">
            <span>IPOSB</span>
            <small>FMS</small>
          </div>
        </div>

        <NavLink to="/" end>
          <i className="bi bi-speedometer2" /> Dashboard
        </NavLink>

        {sections.map((section) => (
          <div key={section.id}>
            <div className="section-title">{section.title}</div>
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to} end onClick={() => {
                if (sidebarRef.current) {
                  sessionStorage.setItem(SCROLL_KEY, String(sidebarRef.current.scrollTop))
                }
              }}>
                <i className={`bi ${item.icon || 'bi-circle'}`} /> {item.label}
              </NavLink>
            ))}
          </div>
        ))}

        {admin.length > 0 && (
          <div>
            <div className="section-title">Administration</div>
            {admin.map((item) => (
              <NavLink key={item.to} to={item.to} end>
                <i className={`bi ${item.icon || 'bi-circle'}`} /> {item.label}
              </NavLink>
            ))}
          </div>
        )}

        <div className="sidebar-user">
          <div className="px-3 text-secondary" style={{ fontSize: '0.8rem', paddingTop: 12 }}>
            <div>
              <strong>{user.name}</strong>
            </div>
            <div>
              {user.role}
              {user.branchCode ? ` | ${user.branchCode}` : ''}
            </div>
          </div>
          <button type="button" className="logout-link" onClick={onLogout}>
            <i className="bi bi-box-arrow-left" /> Logout
          </button>
        </div>
      </nav>

      <div className="main-content">
        <Outlet />
      </div>
    </>
  )
}
