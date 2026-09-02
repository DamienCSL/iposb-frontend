import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { routeAllowed } from '../auth/routeCaps'

export default function LoginPage() {
  const { user, login, booting, defaultRoute } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (booting) {
    return (
      <div className="iposb-login-page">
        <div className="container text-center text-muted py-5">Checking session…</div>
      </div>
    )
  }

  if (user) {
    return <Navigate to={defaultRoute || '/'} replace />
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const session = await login(username, password)
      const from = location.state?.from
      const to = from && routeAllowed(from, session?.capabilities) ? from : (session?.defaultRoute || '/')
      navigate(to, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="iposb-login-page">
      <div className="container">
        <div className="card iposb-login-card">
          <div className="card-body">
            <div className="iposb-login-brand">
              <img src="/iposb-logo.png" alt="IPOSB" />
              <h4 className="mb-1">IPOSB FMS</h4>
              <p className="text-muted mb-0">Freight Management System</p>
            </div>

            {error ? <div className="alert alert-danger">{error}</div> : null}

            <form onSubmit={onSubmit}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  autoFocus
                  disabled={busy}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                {busy ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <p className="text-muted small mt-3 mb-0">
              Office login against Laravel <code>/api/ops/auth/login</code>. Local seed:{' '}
              <strong>admin</strong> / <strong>admin123</strong> (also ops01, inv01, agent01).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
