import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { ADMIN_ITEMS, NAV_SECTIONS } from '../nav/navConfig'

const LEGACY = import.meta.env.VITE_LEGACY_URL || 'http://localhost:8080'

export default function PlaceholderPage() {
  const { pathname } = useLocation()
  const meta = useMemo(() => {
    for (const s of NAV_SECTIONS) {
      const hit = s.items.find((i) => i.to === pathname)
      if (hit) return hit
    }
    return ADMIN_ITEMS.find((i) => i.to === pathname)
  }, [pathname])

  const heading = meta?.label || 'Page'
  const legacy = meta?.legacy

  return (
    <div>
      <h1 className="page-title">{heading}</h1>
      <div className="panel">
        <p>
          This screen is not migrated yet. React owns routing and RBAC; the working form still lives in PHP FMS.
        </p>
        {legacy ? (
          <p>
            <a className="btn-primary inline" href={`${LEGACY}${legacy}`} target="_blank" rel="noreferrer">
              Open in legacy FMS
            </a>
          </p>
        ) : null}
        <p className="muted path">{pathname}</p>
      </div>
    </div>
  )
}
