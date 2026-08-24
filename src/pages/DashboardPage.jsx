import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getHealth } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { can } from '../auth/rbac'

export default function DashboardPage() {
  const { user, caps } = useAuth()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
  })

  const actions = [
    { to: '/consignments/new', title: 'New Consignment', desc: 'Create or update a consignment', show: can(caps, 'consignments') },
    { to: '/consignments', title: 'Consignment List', desc: 'Search and manage consignments', show: can(caps, 'consignments') },
    { to: '/consignments/tracking', title: 'Track Consignment', desc: 'Look up status history (live API)', show: can(caps, 'consignments') },
    { to: '/dispatch/assign', title: 'Assign Driver', desc: 'Unassigned jobs (live API)', show: can(caps, 'dispatch') },
    { to: '/dispatch/remote', title: 'Remote / 3PL Pickup', desc: 'Uncovered pickups (live API)', show: can(caps, 'dispatch') },
    { to: '/cs/tickets', title: 'CS Tickets', desc: 'Customer inquiries', show: can(caps, 'customerService') },
    { to: '/billing/invoices/new', title: 'Generate Invoice', desc: 'Bill unbilled consignments', show: can(caps, 'billing') },
    { to: '/admin/drop-points', title: 'Drop Points', desc: 'Collection points', show: can(caps, 'dropPoints') },
  ].filter((a) => a.show)

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="lede">
        Welcome, {user.name}. Menus match FMS RBAC. Screens marked live call the Laravel{' '}
        <code>/api</code>. Everything else still opens the legacy PHP page until it is ported.
      </p>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-label">API</span>
          <strong>{health.isLoading ? '…' : health.isSuccess ? 'up' : 'down'}</strong>
          <small>{health.data?.service || 'Start Laravel on :8000'}</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Backend</span>
          <strong className="stat-role">{health.data?.backend || '—'}</strong>
          <small>v{health.data?.version || '?'}</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Role</span>
          <strong className="stat-role">{user.role}</strong>
          <small>{user.branchCode}</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Live screens</span>
          <strong>3</strong>
          <small>Track, assign, 3PL queue</small>
        </div>
      </div>

      <h2 className="section-h">Quick actions</h2>
      <div className="action-grid">
        {actions.map((a) => (
          <Link key={a.to} className="action-card" to={a.to}>
            <h3>{a.title}</h3>
            <p>{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
