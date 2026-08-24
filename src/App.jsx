import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import DispatchJobsPage from './pages/DispatchJobsPage'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'
import RemotePickupPage from './pages/RemotePickupPage'
import TrackingPage from './pages/TrackingPage'
import { ADMIN_ITEMS, NAV_SECTIONS } from './nav/navConfig'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

const LIVE = {
  '/consignments/tracking': TrackingPage,
  '/dispatch/assign': DispatchJobsPage,
  '/dispatch/remote': RemotePickupPage,
}

const placeholderPaths = [
  ...NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.to)),
  ...ADMIN_ITEMS.map((i) => i.to),
].filter((p) => !LIVE[p])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              {Object.entries(LIVE).map(([path, Page]) => (
                <Route key={path} path={path} element={<Page />} />
              ))}
              {placeholderPaths.map((path) => (
                <Route key={path} path={path} element={<PlaceholderPage />} />
              ))}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
