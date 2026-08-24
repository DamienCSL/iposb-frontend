import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { can } from '../auth/rbac'

export default function DashboardPage() {
  const { user, caps } = useAuth()

  const stats = {
    total_cn: 0,
    pending_cn: 0,
    delivered_today: 0,
    manifested_today: 0,
    unpaid_invoices: 0,
    total_revenue: 0,
    pending_staff: 0,
  }

  const today = new Date().toISOString().slice(0, 10)

  const actions = [
    { to: '/consignments/new', title: 'New Consignment', desc: 'Create or update a consignment', icon: 'bi-plus-circle', color: 'primary', show: can(caps, 'consignments') },
    { to: '/consignments', title: 'Consignment List', desc: 'Search and manage consignments', icon: 'bi-list-ul', color: 'secondary', show: can(caps, 'consignments') },
    { to: '/consignments/tracking', title: 'Track Consignment', desc: 'Look up status history', icon: 'bi-search', color: 'info', show: can(caps, 'consignments') },
    { to: '/dispatch/assign', title: 'Assign Driver', desc: 'Dispatch consignments to drivers', icon: 'bi-person-workspace', color: 'primary', show: can(caps, 'dispatch') },
    { to: '/dispatch/remote', title: 'Remote / 3PL Pickup', desc: 'Uncovered areas and third-party couriers', icon: 'bi-geo', color: 'warning', show: can(caps, 'dispatch') },
    { to: '/cs/tickets', title: 'CS Tickets', desc: 'Pending / Processing / Processed customer inquiries', icon: 'bi-ticket-detailed', color: 'info', show: can(caps, 'customerService') },
    { to: '/summaries', title: 'Status Summary', desc: 'Overall consignment status report', icon: 'bi-bar-chart', color: 'warning', show: can(caps, 'summaries') },
    { to: '/billing/invoices/new', title: 'Generate Invoice', desc: 'Bill unbilled consignments', icon: 'bi-receipt', color: 'success', show: can(caps, 'billing') },
    { to: '/billing/invoices', title: 'Invoice List', desc: 'View and filter invoices', icon: 'bi-list-check', color: 'success', show: can(caps, 'billing') },
    { to: '/billing/credit-notes', title: 'Credit Note', desc: 'Create a customer credit note', icon: 'bi-file-earmark-minus', color: 'dark', show: can(caps, 'billing') },
    { to: '/admin/users', title: 'User Management', desc: 'Add or edit system users', icon: 'bi-person-gear', color: 'danger', show: can(caps, 'users') },
    { to: '/admin/branches', title: 'Branch Management', desc: 'Maintain branch records', icon: 'bi-building', color: 'danger', show: can(caps, 'branches') },
    { to: '/admin/hubs', title: 'Hub Management', desc: 'Maintain scan hubs (SBH325, 805, …)', icon: 'bi-diagram-3', color: 'danger', show: can(caps, 'hubs') },
    { to: '/admin/drop-points', title: 'Drop Point Management', desc: 'Pickup / delivery collection points', icon: 'bi-geo-alt', color: 'danger', show: can(caps, 'dropPoints') },
    { to: '/admin/3pl', title: '3PL Partners', desc: 'Third-party couriers for remote pickup', icon: 'bi-truck-flatbed', color: 'danger', show: can(caps, 'dropPoints') },
    { to: '/admin/coverage', title: 'Coverage Areas', desc: 'Own DP vs 3PL pickup map (no nearest-DP)', icon: 'bi-map', color: 'danger', show: can(caps, 'dropPoints') },
    {
      to: '/admin/staff',
      title: 'Staff Verification',
      desc: stats.pending_staff
        ? `${stats.pending_staff} pending app sign-up(s)`
        : 'Approve driver / dispatcher app sign-ups',
      icon: 'bi-shield-check',
      color: 'warning',
      show: can(caps, 'staff'),
    },
    { to: '/admin/dispatchers', title: 'Dispatcher Management', desc: 'Mobile dispatchers (app login)', icon: 'bi-headset', color: 'danger', show: can(caps, 'staff') },
    { to: '/admin/drivers', title: 'Driver Management', desc: 'Mobile drivers (app login + zones)', icon: 'bi-truck', color: 'danger', show: can(caps, 'staff') },
    { to: '/admin/routes', title: 'Route Table', desc: 'Origin→dest hub / route suggestions', icon: 'bi-signpost-2', color: 'danger', show: can(caps, 'routing') },
    { to: '/admin/zones', title: 'Zone Management', desc: 'Origin / destination service zones', icon: 'bi-map', color: 'danger', show: can(caps, 'routing') },
    { to: '/admin/route-codes', title: 'Route Codes', desc: 'Preferred driver route pools (BKI001…)', icon: 'bi-sign-turn-right', color: 'danger', show: can(caps, 'routing') },
  ].filter((a) => a.show)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Dashboard</h2>
          <p className="text-muted mb-0">
            Welcome, {user.name} ({user.role})
          </p>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <Link to={`/consignments?date_from=${today}&date_to=${today}`} className="text-decoration-none">
            <div className="card text-bg-primary">
              <div className="card-body">
                <h6 className="card-title">Consignments Created Today</h6>
                <h2>{stats.total_cn}</h2>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-3">
          <Link to="/consignments?cn_status=SHL" className="text-decoration-none">
            <div className="card text-bg-warning">
              <div className="card-body">
                <h6 className="card-title">Pending / On Hold</h6>
                <h2>{stats.pending_cn}</h2>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-3">
          <Link to="/summaries/status" className="text-decoration-none">
            <div className="card text-bg-success">
              <div className="card-body">
                <h6 className="card-title">Delivered Today</h6>
                <h2>{stats.delivered_today}</h2>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-3">
          <Link to="/summaries/manifest" className="text-decoration-none">
            <div className="card text-bg-info">
              <div className="card-body">
                <h6 className="card-title">Manifested Today</h6>
                <h2>{stats.manifested_today}</h2>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {can(caps, 'billing') ? (
        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <Link to="/billing/invoices?inv_status=UPD" className="text-decoration-none text-dark">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">Unpaid Invoices</h6>
                  <h3>{stats.unpaid_invoices}</h3>
                </div>
              </div>
            </Link>
          </div>
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">Year-to-Date Revenue</h6>
                <h3>
                  {new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(
                    stats.total_revenue,
                  )}
                </h3>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card mb-4">
        <div className="card-header bg-white">
          <strong>
            <i className="bi bi-lightning-charge" /> Quick Actions
          </strong>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {actions.map((action) => (
              <div key={action.to} className="col-6 col-md-4 col-xl-3">
                <Link to={action.to} className="text-decoration-none">
                  <div className="border rounded p-3 h-100 quick-action-tile">
                    <div className="d-flex align-items-start gap-2">
                      <span className={`text-${action.color}`} style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                        <i className={`bi ${action.icon}`} />
                      </span>
                      <div>
                        <div className="fw-semibold text-dark">{action.title}</div>
                        <div className="small text-muted">{action.desc}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
