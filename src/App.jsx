import React from 'react'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './modules/dashboard/DashboardPage'
import ShipmentsPage from './modules/shipments/ShipmentsPage'
import DispatchPage from './modules/dispatch/DispatchPage'
import NetworkAnalyticsPage from './modules/network/NetworkAnalyticsPage'
import FinanceBillingPage from './modules/billing/FinanceBillingPage'
import AgentsPage from './modules/agents/AgentsPage'
import SupportPage from './modules/support/SupportPage'
import SettingsPage from './modules/settings/SettingsPage'
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
              {/* Public Authentication */}
              <Route path="/login" element={<LoginPage />} />

              {/* Authenticated Control Tower Shell */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/shipments" element={<ShipmentsPage />} />
                <Route path="/dispatch" element={<DispatchPage />} />
                <Route path="/network" element={<NetworkAnalyticsPage />} />
                <Route path="/billing" element={<FinanceBillingPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* Backward-Compatible Redirects for Legacy Submenus */}
                <Route path="/consignments/new" element={<Navigate to="/shipments?action=new" replace />} />
                <Route path="/consignments/tracking" element={<Navigate to="/shipments?tab=tracking" replace />} />
                <Route path="/consignments/import-log" element={<Navigate to="/shipments?tab=import" replace />} />
                <Route path="/consignments" element={<Navigate to="/shipments" replace />} />

                <Route path="/dispatch/assign" element={<Navigate to="/dispatch?tab=assign" replace />} />
                <Route path="/dispatch/remote" element={<Navigate to="/dispatch?tab=remote" replace />} />
                <Route path="/dispatch/drivers" element={<Navigate to="/dispatch?tab=drivers" replace />} />

                <Route path="/summaries/status" element={<Navigate to="/network?group=status" replace />} />
                <Route path="/summaries/agent" element={<Navigate to="/network?group=agent" replace />} />
                <Route path="/summaries/consignee" element={<Navigate to="/network?group=consignee" replace />} />
                <Route path="/summaries/consigner" element={<Navigate to="/network?group=consigner" replace />} />
                <Route path="/summaries/shipper" element={<Navigate to="/network?group=shipper" replace />} />
                <Route path="/summaries/manifest" element={<Navigate to="/network?group=manifest" replace />} />
                <Route path="/summaries/date" element={<Navigate to="/network?group=date" replace />} />
                <Route path="/summaries/branch" element={<Navigate to="/network?group=branch" replace />} />
                <Route path="/summaries" element={<Navigate to="/network" replace />} />
                <Route path="/summaries/*" element={<Navigate to="/network" replace />} />

                <Route path="/billing/invoices" element={<Navigate to="/billing?doc=invoices" replace />} />
                <Route path="/billing/do" element={<Navigate to="/billing?doc=do" replace />} />
                <Route path="/billing/receipts" element={<Navigate to="/billing?doc=receipts" replace />} />
                <Route path="/billing/credit-notes" element={<Navigate to="/billing?doc=credit-notes" replace />} />
                <Route path="/billing/*" element={<Navigate to="/billing" replace />} />

                <Route path="/agent/bilyet-in" element={<Navigate to="/agents?tab=ledger&type=agent-in" replace />} />
                <Route path="/agent/bilyet-out" element={<Navigate to="/agents?tab=ledger&type=agent-out" replace />} />
                <Route path="/agent/credit-notes" element={<Navigate to="/agents?tab=ledger&type=agent-credit" replace />} />
                <Route path="/agent/debit-notes" element={<Navigate to="/agents?tab=ledger&type=agent-debit" replace />} />
                <Route path="/agent/stock" element={<Navigate to="/agents?tab=overview" replace />} />
                <Route path="/agent/*" element={<Navigate to="/agents" replace />} />
                <Route path="/customer/*" element={<Navigate to="/network" replace />} />
                <Route path="/reports/*" element={<Navigate to="/network" replace />} />

                <Route path="/cs/tickets" element={<Navigate to="/support" replace />} />
                <Route path="/cs/*" element={<Navigate to="/support" replace />} />

                <Route path="/admin/staff" element={<Navigate to="/settings?tab=staff" replace />} />
                <Route path="/admin/users" element={<Navigate to="/settings?tab=users" replace />} />
                <Route path="/admin/branches" element={<Navigate to="/settings?tab=masters&sub=branches" replace />} />
                <Route path="/admin/hubs" element={<Navigate to="/settings?tab=masters&sub=hubs" replace />} />
                <Route path="/admin/3pl" element={<Navigate to="/settings?tab=masters&sub=3pl" replace />} />
                <Route path="/admin/routes" element={<Navigate to="/settings?tab=masters&sub=routes" replace />} />
                <Route path="/admin/zones" element={<Navigate to="/settings?tab=masters&sub=zones" replace />} />
                <Route path="/admin/drivers" element={<Navigate to="/dispatch?tab=drivers" replace />} />
                <Route path="/admin/*" element={<Navigate to="/settings?tab=masters" replace />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}
