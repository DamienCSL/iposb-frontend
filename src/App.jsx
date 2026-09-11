import React from 'react'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import SetupHubPage from './modules/onboarding/SetupHubPage'
import DashboardPage from './modules/dashboard/DashboardPage'
import ConsignmentsListPage from './modules/consignments/ConsignmentsListPage'
import ConsignmentDetailPage from './modules/consignments/ConsignmentDetailPage'
import PickupsPage from './modules/pickups/PickupsPage'
import ManifestsPage from './modules/manifests/ManifestsPage'
import ReturnsPage from './modules/returns/ReturnsPage'
import FinanceBillingPage from './modules/billing/FinanceBillingPage'
import CodPage from './modules/cod/CodPage'
import CommissionsPage from './modules/commissions/CommissionsPage'
import SupportPage from './modules/support/SupportPage'
import StaffPage from './modules/staff/StaffPage'
import MasterAdminPage from './modules/admin/MasterAdminPage'
import NetworkAnalyticsPage from './modules/network/NetworkAnalyticsPage'
import SystemLogsPage from './modules/audit/SystemLogsPage'
import { iposbTheme } from './theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <ConfigProvider theme={iposbTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/onboarding/setup-hub" element={<SetupHubPage />} />

              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/ops/dashboard" replace />} />
                <Route path="/ops/dashboard" element={<DashboardPage />} />

                <Route path="/ops/consignments" element={<ConsignmentsListPage />} />
                <Route path="/ops/consignments/import" element={<ConsignmentsListPage />} />
                <Route path="/ops/consignments/:cn" element={<ConsignmentDetailPage />} />
                <Route path="/ops/consignments/:cn/tracking" element={<ConsignmentDetailPage />} />

                <Route path="/ops/pickups" element={<PickupsPage />} />
                <Route path="/ops/manifests" element={<ManifestsPage />} />
                <Route path="/ops/manifests/:mfg" element={<ManifestsPage />} />
                <Route path="/ops/returns" element={<ReturnsPage />} />

                <Route path="/ops/billing" element={<Navigate to="/ops/billing/invoices" replace />} />
                <Route path="/ops/billing/:doc" element={<FinanceBillingPage />} />
                <Route path="/ops/billing/:doc/:id" element={<FinanceBillingPage />} />

                <Route path="/ops/cod" element={<CodPage />} />
                <Route path="/ops/commissions" element={<CommissionsPage />} />
                <Route path="/ops/commissions/config" element={<CommissionsPage />} />
                <Route path="/ops/partner-wallets" element={<CommissionsPage />} />

                <Route path="/ops/cs/tickets" element={<SupportPage />} />
                <Route path="/ops/cs/tickets/:id" element={<SupportPage />} />
                <Route path="/ops/staff" element={<StaffPage />} />

                <Route path="/ops/admin" element={<Navigate to="/ops/admin/hubs" replace />} />
                <Route path="/ops/admin/:resource" element={<MasterAdminPage />} />
                <Route path="/ops/logs" element={<SystemLogsPage />} />
                <Route path="/network" element={<NetworkAnalyticsPage />} />

                <Route path="/logs" element={<Navigate to="/ops/logs" replace />} />
                <Route path="/audit-logs" element={<Navigate to="/ops/logs" replace />} />
                <Route path="/shipments" element={<Navigate to="/ops/consignments" replace />} />
                <Route path="/dispatch" element={<Navigate to="/ops/pickups" replace />} />
                <Route path="/billing" element={<Navigate to="/ops/billing/invoices" replace />} />
                <Route path="/agents" element={<Navigate to="/ops/commissions" replace />} />
                <Route path="/support" element={<Navigate to="/ops/cs/tickets" replace />} />
                <Route path="/settings" element={<Navigate to="/ops/admin/hubs" replace />} />

                <Route path="/consignments/new" element={<Navigate to="/ops/consignments" replace />} />
                <Route path="/consignments/tracking" element={<Navigate to="/ops/consignments" replace />} />
                <Route path="/consignments/import-log" element={<Navigate to="/ops/consignments/import" replace />} />
                <Route path="/consignments/cancellations" element={<Navigate to="/ops/consignments" replace />} />
                <Route path="/consignments" element={<Navigate to="/ops/consignments" replace />} />

                <Route path="/dispatch/assign" element={<Navigate to="/ops/pickups" replace />} />
                <Route path="/dispatch/remote" element={<Navigate to="/ops/pickups" replace />} />
                <Route path="/dispatch/manifests" element={<Navigate to="/ops/manifests" replace />} />
                <Route path="/dispatch/seals" element={<Navigate to="/ops/manifests" replace />} />
                <Route path="/dispatch/drivers" element={<Navigate to="/ops/admin/drivers" replace />} />

                <Route path="/billing/invoices" element={<Navigate to="/ops/billing/invoices" replace />} />
                <Route path="/billing/do" element={<Navigate to="/ops/billing/do" replace />} />
                <Route path="/billing/receipts" element={<Navigate to="/ops/billing/receipts" replace />} />
                <Route path="/billing/credit-notes" element={<Navigate to="/ops/billing/credit-notes" replace />} />
                <Route path="/billing/cod" element={<Navigate to="/ops/cod" replace />} />
                <Route path="/billing/commissions" element={<Navigate to="/ops/commissions" replace />} />
                <Route path="/billing/wallet" element={<Navigate to="/ops/partner-wallets" replace />} />
                <Route path="/billing/cancellation-settings" element={<Navigate to="/ops/commissions/config" replace />} />
                <Route path="/billing/*" element={<Navigate to="/ops/billing/invoices" replace />} />

                <Route path="/drop-points" element={<Navigate to="/ops/admin/drop-points" replace />} />
                <Route path="/agent/bilyet-in" element={<Navigate to="/ops/billing/agent-in" replace />} />
                <Route path="/agent/bilyet-out" element={<Navigate to="/ops/billing/agent-out" replace />} />
                <Route path="/agent/*" element={<Navigate to="/ops/commissions" replace />} />

                <Route path="/cs/tickets" element={<Navigate to="/ops/cs/tickets" replace />} />
                <Route path="/cs/*" element={<Navigate to="/ops/cs/tickets" replace />} />

                <Route path="/admin/staff" element={<Navigate to="/ops/staff" replace />} />
                <Route path="/admin/users" element={<Navigate to="/ops/admin/users" replace />} />
                <Route path="/admin/role-access" element={<Navigate to="/ops/admin/users" replace />} />
                <Route path="/admin/branches" element={<Navigate to="/ops/admin/hubs" replace />} />
                <Route path="/admin/hubs" element={<Navigate to="/ops/admin/hubs" replace />} />
                <Route path="/admin/delivery-points" element={<Navigate to="/ops/admin/zones" replace />} />
                <Route path="/admin/zones" element={<Navigate to="/ops/admin/zones" replace />} />
                <Route path="/admin/areas" element={<Navigate to="/ops/admin/zones" replace />} />
                <Route path="/admin/3pl" element={<Navigate to="/ops/admin/3pl" replace />} />
                <Route path="/admin/routes" element={<Navigate to="/ops/admin/routes" replace />} />
                <Route path="/admin/drivers" element={<Navigate to="/ops/admin/drivers" replace />} />
                <Route path="/admin/*" element={<Navigate to="/ops/admin/hubs" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/ops/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}
