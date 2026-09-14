import { Navigate } from 'react-router-dom'

/** Slice 3: Remote / 3PL queue retired — use Driver Assignment. */
export default function RemotePickupPage() {
  return <Navigate to="/dispatch/assign" replace />
}
