import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AppLayout from './layouts/AppLayout'
import AdminCrudPage from './pages/AdminCrudPage'
import BillingListPage, { BillingEntryPage, TrackingLookupPage } from './pages/BillingPages'
import CancellationLogPage from './pages/CancellationLogPage'
import CancellationPolicyPage from './pages/CancellationPolicyPage'
import ConsignmentEntryPage from './pages/ConsignmentEntryPage'
import ConsignmentListPage from './pages/ConsignmentListPage'
import CodPage from './pages/CodPage'
import CommissionPage from './pages/CommissionPage'
import CsTicketsPage from './pages/CsTicketsPage'
import WalletPage from './pages/WalletPage'
import DashboardPage from './pages/DashboardPage'
import DispatchJobsPage from './pages/DispatchJobsPage'
import ImportLogPage from './pages/ImportLogPage'
import LoginPage from './pages/LoginPage'
import RemotePickupPage from './pages/RemotePickupPage'
import { PrintPage, ReportPage } from './pages/ReportPrintPages'
import RoleAccessPage from './pages/RoleAccessPage'
import StaffVerifyPage from './pages/StaffVerifyPage'
import SummaryPage from './pages/SummaryPage'
import TrackingPage from './pages/TrackingPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />

              <Route path="/consignments" element={<ConsignmentListPage />} />
              <Route path="/consignments/new" element={<ConsignmentEntryPage />} />
              <Route path="/consignments/import-log" element={<ImportLogPage />} />
              <Route path="/consignments/tracking" element={<TrackingPage />} />
              <Route path="/consignments/cancellations" element={<CancellationLogPage />} />

              <Route path="/dispatch/assign" element={<DispatchJobsPage />} />
              <Route path="/dispatch/remote" element={<RemotePickupPage />} />

              <Route path="/cs/tickets" element={<CsTicketsPage />} />

              <Route path="/summaries" element={<SummaryPage kind="overall" />} />
              <Route path="/summaries/status" element={<SummaryPage kind="status" />} />
              <Route path="/summaries/drop-point" element={<SummaryPage kind="drop-point" />} />
              <Route path="/summaries/agent" element={<Navigate to="/summaries/drop-point" replace />} />
              <Route path="/summaries/consignee" element={<SummaryPage kind="consignee" />} />
              <Route path="/summaries/consigner" element={<SummaryPage kind="consigner" />} />
              <Route path="/summaries/shipper" element={<SummaryPage kind="shipper" />} />
              <Route path="/summaries/manifest" element={<SummaryPage kind="manifest" />} />
              <Route path="/summaries/date" element={<SummaryPage kind="date" />} />
              <Route path="/summaries/branch" element={<SummaryPage kind="branch" />} />

              <Route path="/billing/invoices/new" element={<BillingEntryPage doc="invoices" />} />
              <Route path="/billing/invoices" element={<BillingListPage doc="invoices" />} />
              <Route path="/billing/invoices/tracking" element={<TrackingLookupPage doc="invoices" title="Invoice Tracking" idKey="Invoice number" />} />
              <Route path="/billing/do/new" element={<BillingEntryPage doc="do" />} />
              <Route path="/billing/do" element={<BillingListPage doc="do" />} />
              <Route path="/billing/do/tracking" element={<TrackingLookupPage doc="do" title="Delivery Order Tracking" idKey="DN number" />} />
              <Route path="/billing/receipts/new" element={<BillingEntryPage doc="receipts" />} />
              <Route path="/billing/receipts" element={<BillingListPage doc="receipts" />} />
              <Route path="/billing/receipts/tracking" element={<TrackingLookupPage doc="receipts" title="Receipt Tracking" idKey="Invoice number" />} />
              <Route path="/billing/credit-notes" element={<BillingEntryPage doc="credit-notes" />} />
              <Route path="/billing/credit-notes/list" element={<BillingListPage doc="credit-notes" />} />
              <Route path="/billing/debit-notes" element={<BillingEntryPage doc="debit-notes" />} />
              <Route path="/billing/debit-notes/list" element={<BillingListPage doc="debit-notes" />} />
              <Route path="/billing/cod" element={<CodPage />} />
              <Route path="/billing/wallet" element={<WalletPage />} />
              <Route path="/billing/cancellation-settings" element={<CancellationPolicyPage />} />
              <Route path="/billing/commissions" element={<CommissionPage />} />

              <Route path="/drop-points/bilyet-in" element={<BillingEntryPage doc="agent-in" />} />
              <Route path="/drop-points/bilyet-in/list" element={<BillingListPage doc="agent-in" title="Drop Point Money In List" />} />
              <Route path="/drop-points/bilyet-out" element={<BillingEntryPage doc="agent-out" />} />
              <Route path="/drop-points/bilyet-out/list" element={<BillingListPage doc="agent-out" title="Drop Point Money Out List" />} />
              <Route path="/drop-points/credit-notes" element={<BillingEntryPage doc="agent-credit" />} />
              <Route path="/drop-points/credit-notes/list" element={<BillingListPage doc="agent-credit" title="Drop Point Credit Note List" />} />
              <Route path="/drop-points/debit-notes" element={<BillingEntryPage doc="agent-debit" />} />
              <Route path="/drop-points/debit-notes/list" element={<BillingListPage doc="agent-debit" title="Drop Point Debit Note List" />} />
              <Route path="/drop-points/stock" element={<ReportPage kind="drop-point" title="Drop Point Stock Record" />} />
              <Route path="/agent/bilyet-in" element={<Navigate to="/drop-points/bilyet-in" replace />} />
              <Route path="/agent/bilyet-in/list" element={<Navigate to="/drop-points/bilyet-in/list" replace />} />
              <Route path="/agent/bilyet-out" element={<Navigate to="/drop-points/bilyet-out" replace />} />
              <Route path="/agent/bilyet-out/list" element={<Navigate to="/drop-points/bilyet-out/list" replace />} />
              <Route path="/agent/credit-notes" element={<Navigate to="/drop-points/credit-notes" replace />} />
              <Route path="/agent/credit-notes/list" element={<Navigate to="/drop-points/credit-notes/list" replace />} />
              <Route path="/agent/debit-notes" element={<Navigate to="/drop-points/debit-notes" replace />} />
              <Route path="/agent/debit-notes/list" element={<Navigate to="/drop-points/debit-notes/list" replace />} />
              <Route path="/agent/stock" element={<Navigate to="/drop-points/stock" replace />} />

              <Route path="/customer/stock" element={<ReportPage kind="customer" title="Customer Stock Record" />} />
              <Route path="/customer/summary" element={<ReportPage kind="customer" title="Customer Summary Report" />} />
              <Route path="/customer/drop-point-summary" element={<ReportPage kind="drop-point" title="Drop Point Summary Report" />} />
              <Route path="/customer/agent-summary" element={<Navigate to="/customer/drop-point-summary" replace />} />

              <Route path="/reports/manifest" element={<PrintPage kind="manifest" title="Print Manifest" idLabel="Manifest number" />} />
              <Route path="/reports/cn" element={<PrintPage kind="cn" title="Print Consignment" idLabel="Consignment number" />} />
              <Route path="/reports/invoice" element={<PrintPage kind="invoice" title="Print Invoice" idLabel="Invoice number" />} />
              <Route path="/reports/do" element={<PrintPage kind="do" title="Print Delivery Order" idLabel="DN number" />} />
              <Route path="/reports/receipt" element={<PrintPage kind="receipt" title="Print Receipt" idLabel="Invoice number" />} />

              <Route path="/admin/users" element={<AdminCrudPage resource="users" />} />
              <Route path="/admin/role-access" element={<RoleAccessPage />} />
              <Route path="/admin/branches" element={<Navigate to="/admin/hubs" replace />} />
              <Route path="/admin/hubs" element={<AdminCrudPage resource="hubs" />} />
              <Route path="/drop-points" element={<AdminCrudPage resource="drop-points" />} />
              <Route path="/drop-points/3pl" element={<AdminCrudPage resource="3pl" />} />
              <Route path="/drop-points/coverage" element={<AdminCrudPage resource="coverage" />} />
              <Route path="/admin/drop-points" element={<Navigate to="/drop-points" replace />} />
              <Route path="/admin/3pl" element={<Navigate to="/drop-points/3pl" replace />} />
              <Route path="/admin/coverage" element={<Navigate to="/drop-points/coverage" replace />} />
              <Route path="/admin/staff" element={<StaffVerifyPage />} />
              <Route path="/admin/dispatchers" element={<AdminCrudPage resource="dispatchers" />} />
              <Route path="/admin/drivers" element={<AdminCrudPage resource="drivers" />} />
              <Route path="/admin/routes" element={<AdminCrudPage resource="routes" />} />
              <Route path="/admin/delivery-points" element={<AdminCrudPage resource="delivery-points" />} />
              <Route path="/admin/zones" element={<Navigate to="/admin/delivery-points" replace />} />
              <Route path="/admin/route-codes" element={<AdminCrudPage resource="route-codes" />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
