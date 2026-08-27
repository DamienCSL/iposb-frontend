import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AppLayout from './layouts/AppLayout'
import AdminCrudPage from './pages/AdminCrudPage'
import BillingListPage, { BillingEntryPage, TrackingLookupPage } from './pages/BillingPages'
import ConsignmentEntryPage from './pages/ConsignmentEntryPage'
import ConsignmentListPage from './pages/ConsignmentListPage'
import CsTicketsPage from './pages/CsTicketsPage'
import DashboardPage from './pages/DashboardPage'
import DispatchJobsPage from './pages/DispatchJobsPage'
import ImportLogPage from './pages/ImportLogPage'
import LoginPage from './pages/LoginPage'
import RemotePickupPage from './pages/RemotePickupPage'
import { PrintPage, ReportPage } from './pages/ReportPrintPages'
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

              <Route path="/dispatch/assign" element={<DispatchJobsPage />} />
              <Route path="/dispatch/remote" element={<RemotePickupPage />} />

              <Route path="/cs/tickets" element={<CsTicketsPage />} />

              <Route path="/summaries" element={<SummaryPage kind="overall" />} />
              <Route path="/summaries/status" element={<SummaryPage kind="status" />} />
              <Route path="/summaries/agent" element={<SummaryPage kind="agent" />} />
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

              <Route path="/agent/bilyet-in" element={<BillingEntryPage doc="agent-in" />} />
              <Route path="/agent/bilyet-in/list" element={<BillingListPage doc="agent-in" title="Agent Money In List" />} />
              <Route path="/agent/bilyet-out" element={<BillingEntryPage doc="agent-out" />} />
              <Route path="/agent/bilyet-out/list" element={<BillingListPage doc="agent-out" title="Agent Money Out List" />} />
              <Route path="/agent/credit-notes" element={<BillingEntryPage doc="agent-credit" />} />
              <Route path="/agent/credit-notes/list" element={<BillingListPage doc="agent-credit" title="Agent Credit Note List" />} />
              <Route path="/agent/debit-notes" element={<BillingEntryPage doc="agent-debit" />} />
              <Route path="/agent/debit-notes/list" element={<BillingListPage doc="agent-debit" title="Agent Debit Note List" />} />
              <Route path="/agent/stock" element={<ReportPage kind="agent" title="Agent Stock Record" />} />

              <Route path="/customer/stock" element={<ReportPage kind="customer" title="Customer Stock Record" />} />
              <Route path="/customer/summary" element={<ReportPage kind="customer" title="Customer Summary Report" />} />
              <Route path="/customer/agent-summary" element={<ReportPage kind="agent" title="Agent Summary Report" />} />

              <Route path="/reports/manifest" element={<PrintPage kind="manifest" title="Print Manifest" idLabel="Manifest number" />} />
              <Route path="/reports/cn" element={<PrintPage kind="cn" title="Print Consignment" idLabel="Consignment number" />} />
              <Route path="/reports/invoice" element={<PrintPage kind="invoice" title="Print Invoice" idLabel="Invoice number" />} />
              <Route path="/reports/do" element={<PrintPage kind="do" title="Print Delivery Order" idLabel="DN number" />} />
              <Route path="/reports/receipt" element={<PrintPage kind="receipt" title="Print Receipt" idLabel="Invoice number" />} />

              <Route path="/admin/users" element={<AdminCrudPage resource="users" />} />
              <Route path="/admin/branches" element={<AdminCrudPage resource="branches" />} />
              <Route path="/admin/hubs" element={<AdminCrudPage resource="hubs" />} />
              <Route path="/admin/drop-points" element={<AdminCrudPage resource="drop-points" />} />
              <Route path="/admin/3pl" element={<AdminCrudPage resource="3pl" />} />
              <Route path="/admin/coverage" element={<AdminCrudPage resource="coverage" />} />
              <Route path="/admin/staff" element={<StaffVerifyPage />} />
              <Route path="/admin/dispatchers" element={<AdminCrudPage resource="dispatchers" />} />
              <Route path="/admin/drivers" element={<AdminCrudPage resource="drivers" />} />
              <Route path="/admin/routes" element={<AdminCrudPage resource="routes" />} />
              <Route path="/admin/zones" element={<AdminCrudPage resource="zones" />} />
              <Route path="/admin/route-codes" element={<AdminCrudPage resource="route-codes" />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
