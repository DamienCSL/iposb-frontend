import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DEMO_USERS } from '../auth/rbac'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
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
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/iposb-logo.png" alt="IPOSB" />
          <h1>IPOSB FMS</h1>
          <p>Freight Management System</p>
        </div>

        {error ? <div className="alert">{error}</div> : null}

        <form onSubmit={onSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button type="submit" className="btn-primary">
            Sign in
          </button>
        </form>

        <p className="hint">
          Demo login (local). Staff Sanctum login comes with Laravel. Try{' '}
          {DEMO_USERS.map((u) => u.username).join(', ')} — password is username + 123.
        </p>
      </div>
    </div>
  )
}
