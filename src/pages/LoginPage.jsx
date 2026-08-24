import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DEMO_USERS } from '../auth/rbac'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (user) {
    return <Navigate to="/" replace />
  }

  function onSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      login(username, password)
      const to = location.state?.from || '/'
      navigate(to, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
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
                />
              </div>
              <button type="submit" className="btn btn-primary w-100">
                Login
              </button>
            </form>

            <p className="text-muted small mt-3 mb-0">
              Demo accounts: {DEMO_USERS.map((u) => u.username).join(', ')} — password is username + 123.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
