import React from 'react'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import SetupHubPage from './modules/onboarding/SetupHubPage'
import DashboardPage from './modules/dashboard/DashboardPage'
import ConsignmentsListPage from './modules/consignments/ConsignmentsListPage'
import ConsignmentDetailPage from './modules/consignments/ConsignmentDetailPage'
import ConsignmentEntryPage from './modules/consignments/ConsignmentEntryPage'
import PickupsPage from './modules/pickups/PickupsPage'
import DispatchPage from './modules/dispatch/DispatchPage'
import ManifestsPage from './modules/manifests/ManifestsPage'
import ReturnsPage from './modules/returns/ReturnsPage'
import FinanceBillingPage from './modules/billing/FinanceBillingPage'
import CodPage from './modules/cod/CodPage'
import AgentsPage from './modules/agents/AgentsPage'
import SupportPage from './modules/support/SupportPage'
import StaffPage from './modules/staff/StaffPage'
import MasterAdminPage from './modules/admin/MasterAdminPage'
import NetworkAnalyticsPage from './modules/network/NetworkAnalyticsPage'
import SystemLogsPage from './modules/audit/SystemLogsPage'
import SealStationPage from './pages/SealStationPage'
import ManifestStationPage from './pages/ManifestStationPage'
import CommissionPage from './pages/CommissionPage'
import TrackingPage from './pages/TrackingPage'
import ImportLogPage from './pages/ImportLogPage'
import CancellationLogPage from './pages/CancellationLogPage'
import CancellationPolicyPage from './pages/CancellationPolicyPage'
import WalletPage from './pages/WalletPage'
import RoleAccessPage from './pages/RoleAccessPage'
import SummaryPage from './pages/SummaryPage'
import { ReportPage, PrintPage } from './pages/ReportPrintPages'
import { TrackingLookupPage } from './pages/BillingPages'
import { iposbTheme } from './theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

const BILLING_TRACKING = {
  invoices: { title: 'Invoice Tracking', idKey: 'Invoice number' },
  do: { title: 'Delivery Order Tracking', idKey: 'DN number' },
  receipts: { title: 'Receipt Tracking', idKey: 'Invoice number' },
}

function BillingTrackingRoute() {
  const { doc } = useParams()
  const meta = BILLING_TRACKING[doc]
  if (!meta) return <Navigate to={`/ops/billing/${doc || 'invoices'}`} replace />
  return <TrackingLookupPage doc={doc} title={meta.title} idKey={meta.idKey} />
}

function LegacySummaryRedirect() {
  const { kind } = useParams()
  if (!kind) return <Navigate to="/ops/summaries" replace />
  if (kind === 'agent') return <Navigate to="/ops/summaries/drop-point" replace />
  return <Navigate to={`/ops/summaries/${kind}`} replace />
}

function LegacyReportRedirect() {
  const { kind } = useParams()
  const map = {
    manifest: '/ops/reports/manifest',
    cn: '/ops/reports/cn',
    invoice: '/ops/reports/invoice',
    do: '/ops/reports/do',
    receipt: '/ops/reports/receipt',
  }
  return <Navigate to={map[kind] || '/ops/reports/cn'} replace />
}

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
                <Route path="/ops/consignments/new" element={<ConsignmentEntryPage />} />
                <Route path="/ops/consignments/import" element={<ConsignmentsListPage />} />
                <Route path="/ops/consignments/import-log" element={<ImportLogPage />} />
                <Route path="/ops/consignments/tracking" element={<TrackingPage />} />
                <Route path="/ops/consignments/cancellations" element={<CancellationLogPage />} />
                <Route path="/ops/consignments/:cn" element={<ConsignmentDetailPage />} />
                <Route path="/ops/consignments/:cn/tracking" element={<ConsignmentDetailPage />} />

                <Route path="/ops/pickups" element={<PickupsPage />} />
                <Route path="/ops/dispatch" element={<DispatchPage />} />
                <Route path="/ops/seals" element={<SealStationPage />} />
                <Route path="/ops/station/manifests" element={<ManifestStationPage />} />
                <Route path="/ops/manifests" element={<ManifestsPage />} />
                <Route path="/ops/manifests/:mfg" element={<ManifestsPage />} />
                <Route path="/ops/returns" element={<ReturnsPage />} />

                <Route path="/ops/summaries" element={<SummaryPage kind="overall" />} />
                <Route path="/ops/summaries/status" element={<SummaryPage kind="status" />} />
                <Route path="/ops/summaries/drop-point" element={<SummaryPage kind="drop-point" />} />
                <Route path="/ops/summaries/agent" element={<Navigate to="/ops/summaries/drop-point" replace />} />
                <Route path="/ops/summaries/consignee" element={<SummaryPage kind="consignee" />} />
                <Route path="/ops/summaries/consigner" element={<SummaryPage kind="consigner" />} />
                <Route path="/ops/summaries/shipper" element={<SummaryPage kind="shipper" />} />
                <Route path="/ops/summaries/manifest" element={<SummaryPage kind="manifest" />} />
                <Route path="/ops/summaries/date" element={<SummaryPage kind="date" />} />
                <Route path="/ops/summaries/branch" element={<SummaryPage kind="branch" />} />

                <Route path="/ops/reports/manifest" element={<PrintPage kind="manifest" title="Print Manifest" idLabel="Manifest number" />} />
                <Route path="/ops/reports/cn" element={<PrintPage kind="cn" title="Print Consignment" idLabel="Consignment number" />} />
                <Route path="/ops/reports/invoice" element={<PrintPage kind="invoice" title="Print Invoice" idLabel="Invoice number" />} />
                <Route path="/ops/reports/do" element={<PrintPage kind="do" title="Print Delivery Order" idLabel="DN number" />} />
                <Route path="/ops/reports/receipt" element={<PrintPage kind="receipt" title="Print Receipt" idLabel="Invoice number" />} />
                <Route path="/ops/reports/drop-point-stock" element={<ReportPage kind="drop-point" title="Drop Point Stock Record" />} />
                <Route path="/ops/reports/customer-stock" element={<ReportPage kind="customer" title="Customer Stock Record" />} />
                <Route path="/ops/reports/customer-summary" element={<ReportPage kind="customer" title="Customer Summary Report" />} />
                <Route path="/ops/reports/drop-point-summary" element={<ReportPage kind="drop-point" title="Drop Point Summary Report" />} />

                <Route path="/ops/billing" element={<Navigate to="/ops/billing/invoices" replace />} />
                <Route path="/ops/billing/cancellation-settings" element={<CancellationPolicyPage />} />
                <Route path="/ops/billing/customer-wallet" element={<WalletPage />} />
                <Route path="/ops/billing/:doc/tracking" element={<BillingTrackingRoute />} />
                <Route path="/ops/billing/:doc" element={<FinanceBillingPage />} />
                <Route path="/ops/billing/:doc/:id" element={<FinanceBillingPage />} />

                <Route path="/ops/cod" element={<CodPage />} />
                <Route path="/ops/commissions" element={<CommissionPage />} />
                <Route path="/ops/commissions/config" element={<Navigate to="/ops/commissions/rates?tab=rates" replace />} />
                <Route path="/ops/commissions/rates" element={<CommissionPage />} />
                <Route path="/ops/partner-wallets" element={<Navigate to="/ops/commissions/rates?tab=wallets" replace />} />
                <Route path="/ops/agents" element={<AgentsPage />} />

                <Route path="/ops/cs/tickets" element={<SupportPage />} />
                <Route path="/ops/cs/tickets/:id" element={<SupportPage />} />
                <Route path="/ops/staff" element={<StaffPage />} />

                <Route path="/ops/admin" element={<Navigate to="/ops/admin/hubs" replace />} />
                <Route path="/ops/admin/role-access" element={<RoleAccessPage />} />
                <Route path="/ops/admin/:resource" element={<MasterAdminPage />} />
                <Route path="/ops/logs" element={<SystemLogsPage />} />
                <Route path="/network" element={<NetworkAnalyticsPage />} />

                <Route path="/logs" element={<Navigate to="/ops/logs" replace />} />
                <Route path="/audit-logs" element={<Navigate to="/ops/logs" replace />} />
                <Route path="/shipments" element={<Navigate to="/ops/consignments" replace />} />
                <Route path="/dispatch" element={<Navigate to="/ops/dispatch" replace />} />
                <Route path="/billing" element={<Navigate to="/ops/billing/invoices" replace />} />
                <Route path="/agents" element={<Navigate to="/ops/agents" replace />} />
                <Route path="/support" element={<Navigate to="/ops/cs/tickets" replace />} />
                <Route path="/settings" element={<Navigate to="/ops/admin/hubs" replace />} />

                <Route path="/consignments/new" element={<Navigate to="/ops/consignments/new" replace />} />
                <Route path="/consignments/tracking" element={<Navigate to="/ops/consignments/tracking" replace />} />
                <Route path="/consignments/import-log" element={<Navigate to="/ops/consignments/import-log" replace />} />
                <Route path="/consignments/cancellations" element={<Navigate to="/ops/consignments/cancellations" replace />} />
                <Route path="/consignments" element={<Navigate to="/ops/consignments" replace />} />

                <Route path="/dispatch/assign" element={<Navigate to="/ops/dispatch?tab=assign" replace />} />
                <Route path="/dispatch/remote" element={<Navigate to="/ops/dispatch?tab=remote" replace />} />
                <Route path="/dispatch/manifests" element={<Navigate to="/ops/station/manifests" replace />} />
                <Route path="/dispatch/seals" element={<Navigate to="/ops/seals" replace />} />
                <Route path="/dispatch/drivers" element={<Navigate to="/ops/admin/drivers" replace />} />

                <Route path="/summaries" element={<Navigate to="/ops/summaries" replace />} />
                <Route path="/summaries/:kind" element={<LegacySummaryRedirect />} />
                <Route path="/reports/:kind" element={<LegacyReportRedirect />} />
                <Route path="/drop-points/stock" element={<Navigate to="/ops/reports/drop-point-stock" replace />} />
                <Route path="/customer/stock" element={<Navigate to="/ops/reports/customer-stock" replace />} />
                <Route path="/customer/summary" element={<Navigate to="/ops/reports/customer-summary" replace />} />
                <Route path="/customer/drop-point-summary" element={<Navigate to="/ops/reports/drop-point-summary" replace />} />
                <Route path="/customer/agent-summary" element={<Navigate to="/ops/reports/drop-point-summary" replace />} />

                <Route path="/billing/invoices" element={<Navigate to="/ops/billing/invoices" replace />} />
                <Route path="/billing/do" element={<Navigate to="/ops/billing/do" replace />} />
                <Route path="/billing/receipts" element={<Navigate to="/ops/billing/receipts" replace />} />
                <Route path="/billing/credit-notes" element={<Navigate to="/ops/billing/credit-notes" replace />} />
                <Route path="/billing/cod" element={<Navigate to="/ops/cod" replace />} />
                <Route path="/billing/commissions" element={<Navigate to="/ops/commissions/rates" replace />} />
                <Route path="/billing/wallet" element={<Navigate to="/ops/billing/customer-wallet" replace />} />
                <Route path="/billing/cancellation-settings" element={<Navigate to="/ops/billing/cancellation-settings" replace />} />
                <Route path="/billing/*" element={<Navigate to="/ops/billing/invoices" replace />} />

                <Route path="/drop-points" element={<Navigate to="/ops/admin/drop-points" replace />} />
                <Route path="/drop-points/bilyet-in" element={<Navigate to="/ops/billing/agent-in" replace />} />
                <Route path="/drop-points/bilyet-out" element={<Navigate to="/ops/billing/agent-out" replace />} />
                <Route path="/drop-points/credit-notes" element={<Navigate to="/ops/billing/agent-credit" replace />} />
                <Route path="/drop-points/debit-notes" element={<Navigate to="/ops/billing/agent-debit" replace />} />
                <Route path="/agent/bilyet-in" element={<Navigate to="/ops/billing/agent-in" replace />} />
                <Route path="/agent/bilyet-out" element={<Navigate to="/ops/billing/agent-out" replace />} />
                <Route path="/agent/credit-notes" element={<Navigate to="/ops/billing/agent-credit" replace />} />
                <Route path="/agent/debit-notes" element={<Navigate to="/ops/billing/agent-debit" replace />} />
                <Route path="/agent/stock" element={<Navigate to="/ops/reports/drop-point-stock" replace />} />
                <Route path="/agent/*" element={<Navigate to="/ops/agents" replace />} />

                <Route path="/cs/tickets" element={<Navigate to="/ops/cs/tickets" replace />} />
                <Route path="/cs/*" element={<Navigate to="/ops/cs/tickets" replace />} />

                <Route path="/admin/staff" element={<Navigate to="/ops/staff" replace />} />
                <Route path="/admin/users" element={<Navigate to="/ops/admin/users" replace />} />
                <Route path="/admin/role-access" element={<Navigate to="/ops/admin/role-access" replace />} />
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
