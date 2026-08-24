import { Link, useLocation } from 'react-router-dom'
import { findNavMeta } from '../nav/navConfig'

const LEGACY = import.meta.env.VITE_LEGACY_URL || 'http://localhost:8080'

export default function PlaceholderPage() {
  const { pathname } = useLocation()
  const meta = findNavMeta(pathname)
  const heading = meta?.label || 'Coming Soon'
  const legacy = meta?.legacy

  return (
    <div className="card">
      <div className="card-body text-center py-5">
        <i className="bi bi-tools text-secondary" style={{ fontSize: '3rem' }} />
        <h3 className="mt-3">{heading}</h3>
        <p className="text-muted mb-4">
          This screen is linked in the menu but has not been fully ported from the legacy system yet.
        </p>
        {legacy ? (
          <a className="btn btn-outline-primary me-2" href={`${LEGACY}${legacy}`} target="_blank" rel="noreferrer">
            Open in legacy FMS
          </a>
        ) : null}
        <Link to="/" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
