import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { visibleAdmin, visibleSections } from '../nav/navConfig'

const LEGACY = import.meta.env.VITE_LEGACY_URL || 'http://localhost:8080'

export default function AppLayout() {
  const { user, caps, logout } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const sections = visibleSections(caps)
  const admin = visibleAdmin(caps)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/iposb-logo.png" alt="IPOSB" />
          <div className="brand-text">
            <span>IPOSB</span>
            <small>FMS</small>
          </div>
        </div>

        <NavLink to="/" end>
          Dashboard
        </NavLink>

        {sections.map((section) => (
          <div key={section.id}>
            <div className="section-title">{section.title}</div>
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
                {item.live ? <span className="nav-live">live</span> : null}
              </NavLink>
            ))}
          </div>
        ))}

        {admin.length > 0 && (
          <div>
            <div className="section-title">Administration</div>
            {admin.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </div>
        )}

        <div className="sidebar-user">
          <div className="user-meta">
            <strong>{user.name}</strong>
            <span>
              {user.role}
              {user.branchCode ? ` | ${user.branchCode}` : ''}
            </span>
          </div>
          <button type="button" className="linkish" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="muted">React back-office · Wave 1 (shell + live tracking/dispatch)</span>
          <a className="legacy-link" href={`${LEGACY}/FMS/dashboard.php`} target="_blank" rel="noreferrer">
            Open legacy FMS
          </a>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
