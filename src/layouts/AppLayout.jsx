import React, { useEffect, useRef, useState } from 'react'
import {
  AutoComplete,
  Avatar,
  Badge,
  Breadcrumb,
  Dropdown,
  Input,
  Layout,
  Menu,
} from 'antd'
import {
  BarChartOutlined,
  BellOutlined,
  CarOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarCircleOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InboxOutlined,
  LogoutOutlined,
  MoonOutlined,
  PlusCircleOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
  PrinterOutlined,
  AuditOutlined,
  GlobalOutlined,
  KeyOutlined,
  WarningOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { consignmentsNewPath, isDroppointManager } from '../auth/rbac'
import { listConsignments } from '../api/client'

const { Header, Sider, Content } = Layout

const APP_PAGES = [
  { title: 'Dashboard', path: '/ops/dashboard', keywords: ['home', 'overview', 'stats'] },
  { title: 'Consignments', path: '/ops/consignments', keywords: ['shipments', 'cn', 'tracking', 'list'] },
  { title: 'New Consignment Booking', path: '/ops/consignments/new', keywords: ['new', 'create', 'booking', 'shipment', 'consignment', 'entry'] },
  { title: 'Drop Point Counter Booking', path: '/ops/consignments/new?mode=drop', keywords: ['drop', 'counter', 'partner', 'jnt', '3pl', 'awb'] },
  { title: 'Batch Import Consignments', path: '/ops/consignments/import', keywords: ['csv', 'excel', 'bulk', 'import'] },
  { title: 'Import Error Log', path: '/ops/consignments/import-log', keywords: ['import', 'errors', 'batch', 'failures'] },
  { title: 'Consignment Tracking', path: '/ops/consignments/tracking', keywords: ['tracking', 'timeline', 'cn', 'status'] },
  { title: 'Cancellation Log', path: '/ops/consignments/cancellations', keywords: ['cancel', 'void', 'cancellations'] },
  { title: 'Pickups Queue', path: '/ops/pickups', keywords: ['driver', 'vehicle', 'dispatch', 'assign', 'waiting', 'courier'] },
  { title: 'Overnight Scan Requests', path: '/ops/overnight-requests', keywords: ['overnight', 'ovn', 'hold', 'redelivery', 'dispatcher'] },
  { title: 'ATS / Problematic Scans', path: '/ops/ats-claims', keywords: ['ats', 'n13', 'n12', 'damage', 'lost', 'd4', 'reject', 'problematic'] },
  { title: 'Dispatch Driver Assignment', path: '/ops/dispatch?tab=assign', keywords: ['3pl', 'remote', 'assign', 'dispatch', 'drivers', 'plan', 'auto-assign'] },
  { title: 'Remote / 3PL Pickup', path: '/ops/dispatch?tab=remote', keywords: ['3pl', 'remote', 'uncovered', 'partner'] },
  { title: 'Seal Station', path: '/ops/seals', keywords: ['seal', 'bag', 'pack', 'scan'] },
  { title: 'Manifest Station', path: '/ops/station/manifests', keywords: ['manifest', 'baby', 'mother', 'father', 'hub'] },
  { title: 'Manifests & Linehaul Bags', path: '/ops/manifests', keywords: ['linehaul', 'gateway', 'container', 'bags'] },
  { title: 'Returns & RTS', path: '/ops/returns', keywords: ['rts', 'return', 'undelivered', 'reverse'] },
  { title: 'Network Analytics', path: '/network', keywords: ['volume', 'charts', 'kpi', 'traffic', 'network'] },
  { title: 'Status Summaries', path: '/ops/summaries', keywords: ['summary', 'status', 'counts'] },
  { title: 'Print Manifest', path: '/ops/reports/manifest', keywords: ['print', 'manifest'] },
  { title: 'Print Consignment', path: '/ops/reports/cn', keywords: ['print', 'cn', 'awb'] },
  { title: 'Print Invoice', path: '/ops/reports/invoice', keywords: ['print', 'invoice'] },
  { title: 'Print DO', path: '/ops/reports/do', keywords: ['print', 'do', 'delivery'] },
  { title: 'Drop Point Stock', path: '/ops/reports/drop-point-stock', keywords: ['stock', 'drop', 'inventory'] },
  { title: 'Customer Stock', path: '/ops/reports/customer-stock', keywords: ['stock', 'customer', 'inventory'] },
  { title: 'Invoices', path: '/ops/billing/invoices', keywords: ['billing', 'finance', 'tax', 'invoice', 'paid', 'unpaid'] },
  { title: 'Delivery Orders (DO)', path: '/ops/billing/do', keywords: ['do', 'delivery', 'billing'] },
  { title: 'Credit Notes', path: '/ops/billing/credit-notes', keywords: ['cn', 'credit', 'refund', 'adjustment'] },
  { title: 'Debit Notes', path: '/ops/billing/debit-notes', keywords: ['dn', 'debit', 'charge'] },
  { title: 'Drop Point Money In', path: '/ops/billing/agent-in', keywords: ['drop point', 'topup', 'deposit', 'billing', 'bilyet'] },
  { title: 'Drop Point Money Out', path: '/ops/billing/agent-out', keywords: ['drop point', 'payout', 'settle', 'billing', 'bilyet'] },
  { title: 'Drop Point Credit Notes', path: '/ops/billing/agent-credit', keywords: ['drop point', 'credit', 'bilyet'] },
  { title: 'Drop Point Debit Notes', path: '/ops/billing/agent-debit', keywords: ['drop point', 'debit', 'bilyet'] },
  { title: 'Customer Wallet', path: '/ops/billing/customer-wallet', keywords: ['wallet', 'customer', 'ledger', 'balance'] },
  { title: 'Cancellation Policy', path: '/ops/billing/cancellation-settings', keywords: ['cancel', 'policy', 'fees', 'tiers'] },
  { title: 'COD Reconciliation', path: '/ops/cod', keywords: ['cash', 'collect', 'remit', 'settle', 'cod'] },
  { title: 'Commissions Ledger', path: '/ops/commissions/ledger', keywords: ['commissions', 'ledger', 'wallet'] },
  { title: 'Partner Wallets & Withdrawals', path: '/ops/commissions/wallets', keywords: ['wallets', 'payouts', 'balance'] },
  { title: 'Commission Rate Rules', path: '/ops/commissions/rates', keywords: ['rate', 'config', 'percentage', 'rules', 'matrix', 'split', 'engine'] },
  { title: 'Commission Rates Calculator', path: '/ops/commissions/calculator', keywords: ['calculator', 'rates', 'matrix', 'what-if', 'walkthrough', 'split'] },
  { title: 'Commission Withdrawals', path: '/ops/commissions/withdrawals', keywords: ['withdrawals', 'payout'] },
  { title: 'CS Support Tickets', path: '/ops/cs/tickets', keywords: ['cs', 'tickets', 'support', 'helpdesk', 'issues'] },
  { title: 'Staff Verification', path: '/ops/staff', keywords: ['staff', 'approval', 'drivers', 'kyc'] },
  { title: 'Role Access / RBAC', path: '/ops/admin/role-access', keywords: ['rbac', 'roles', 'permissions', 'access'] },
  { title: 'Master Data: Branches', path: '/ops/admin/branches', keywords: ['branches', 'branch', 'office'] },
  { title: 'Master Data: Hubs & Transit', path: '/ops/admin/hubs', keywords: ['hubs', 'gateway', 'transit'] },
  { title: 'Master Data: Drop Points', path: '/ops/admin/drop-points', keywords: ['drop', 'counter', 'locker'] },
  { title: 'Master Data: Drivers & Couriers', path: '/ops/admin/drivers', keywords: ['drivers', 'couriers', 'riders'] },
  { title: 'Master Data: Dispatchers', path: '/ops/admin/dispatchers', keywords: ['dispatchers', 'controllers'] },
  { title: 'Master Data: 3PL Partners', path: '/ops/admin/3pl', keywords: ['3pl', 'logistics', 'dhl', 'jnt'] },
  { title: 'Master Data: Coverage Areas', path: '/ops/admin/coverage', keywords: ['coverage', 'areas', 'territory'] },
  { title: 'Master Data: Routing Rules', path: '/ops/admin/routes', keywords: ['routes', 'rules', 'origin', 'dest'] },
  { title: 'Master Data: Delivery Points', path: '/ops/admin/zones', keywords: ['zones', 'delivery points', 'coverage', 'postcode'] },
  { title: 'Master Data: Network Areas', path: '/ops/admin/areas', keywords: ['areas', 'network', 'last-mile'] },
  { title: 'Master Data: Route Codes', path: '/ops/admin/route-codes', keywords: ['route-codes', 'sector', 'area'] },
  { title: 'Master Data: Customers', path: '/ops/admin/customers', keywords: ['customers', 'corporate', 'clients'] },
  { title: 'Master Data: Staff Users', path: '/ops/admin/users', keywords: ['users', 'accounts', 'passwords', 'roles'] },
  { title: 'System Activity & Audit Logs', path: '/ops/logs', keywords: ['logs', 'audit', 'activity', 'history', 'events', 'trail'] },
]

function saveRecentSearch(term) {
  try {
    if (!term || typeof term !== 'string') return
    const key = 'iposb_recent_searches'
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const updated = [term, ...existing.filter((item) => item !== term)].slice(0, 8)
    localStorage.setItem(key, JSON.stringify(updated))
  } catch {
    // safely ignore local storage errors
  }
}

function highlightMatch(text, query) {
  if (!query || !text) return text
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)
  if (idx === -1) return text
  return (
    <span>
      {text.substring(0, idx)}
      <strong style={{ color: '#1B8A5A' }}>{text.substring(idx, idx + query.length)}</strong>
      {text.substring(idx + query.length)}
    </span>
  )
}

function getBreadcrumbs(pathname, search) {
  const items = [
    { label: 'IPOSB', path: '/ops/dashboard' },
    { label: 'Control Tower', path: '/ops/dashboard' },
  ]

  if (pathname === '/' || pathname === '/ops/dashboard' || pathname === '') {
    return items
  }

  if (pathname.startsWith('/ops/consignments')) {
    items.push({ label: 'Consignments', path: '/ops/consignments' })
    const parts = pathname.split('/')
    if (parts[3] === 'new') {
      const dropMode = new URLSearchParams(search || '').get('mode') === 'drop'
      items.push({
        label: dropMode ? 'DP Counter Booking' : 'New Shipment',
        path: dropMode ? `${pathname}?mode=drop` : pathname,
      })
    } else if (parts[3] === 'import') {
      items.push({ label: 'Batch Import', path: pathname })
    } else if (parts[3]) {
      items.push({ label: parts[3], path: pathname })
    }
  } else if (pathname.startsWith('/ops/pickups')) {
    items.push({ label: 'Pickups Queue', path: '/ops/pickups' })
    const tab = new URLSearchParams(search || '').get('tab')
    if (tab === 'queue') items.push({ label: 'Assigned Queue', path: '/ops/pickups?tab=queue' })
    else items.push({ label: 'Waiting', path: '/ops/pickups' })
  } else if (pathname.startsWith('/ops/overnight-requests')) {
    items.push({ label: 'Overnight Scan Requests', path: '/ops/overnight-requests' })
  } else if (pathname.startsWith('/ops/ats-claims')) {
    items.push({ label: 'ATS / Problematic Scans', path: '/ops/ats-claims' })
  } else if (pathname.startsWith('/ops/dispatch')) {
    items.push({ label: 'Dispatch & 3PL', path: '/ops/dispatch?tab=assign' })
    const tab = new URLSearchParams(search || '').get('tab')
    if (tab === 'remote') items.push({ label: 'Remote / 3PL', path: '/ops/dispatch?tab=remote' })
    else if (tab === 'drivers') items.push({ label: 'Drivers', path: '/ops/dispatch?tab=drivers' })
    else items.push({ label: 'Driver assignment', path: '/ops/dispatch?tab=assign' })
  } else if (pathname.startsWith('/ops/manifests')) {
    items.push({ label: 'Manifests & Bags', path: '/ops/manifests' })
    const parts = pathname.split('/')
    if (parts[3]) items.push({ label: parts[3], path: pathname })
  } else if (pathname.startsWith('/ops/returns')) {
    items.push({ label: 'Returns & RTS', path: '/ops/returns' })
  } else if (pathname.startsWith('/network')) {
    items.push({ label: 'Network Analytics', path: '/network' })
  } else if (pathname.startsWith('/ops/billing')) {
    items.push({ label: 'Billing & Invoicing', path: '/ops/billing/invoices' })
    const parts = pathname.split('/')
    if (parts[3]) items.push({ label: parts[3].toUpperCase().replace(/-/g, ' '), path: `/ops/billing/${parts[3]}` })
  } else if (pathname.startsWith('/ops/cod')) {
    items.push({ label: 'COD Reconciliation', path: '/ops/cod' })
  } else if (pathname.startsWith('/ops/partner-wallets') || pathname.startsWith('/ops/commissions')) {
    items.push({ label: 'Commissions', path: '/ops/commissions/rates' })
    const seg = pathname.split('/').filter(Boolean).pop()
    const tab = new URLSearchParams(search || '').get('tab') || seg
    if (tab === 'calculator') items.push({ label: 'Calculator', path: '/ops/commissions/calculator' })
    else if (tab === 'ledger') items.push({ label: 'Ledger', path: '/ops/commissions/ledger' })
    else if (tab === 'wallets') items.push({ label: 'Partner Wallets', path: '/ops/commissions/wallets' })
    else if (tab === 'withdrawals') items.push({ label: 'Withdrawals', path: '/ops/commissions/withdrawals' })
    else items.push({ label: 'Rate settings', path: '/ops/commissions/rates' })
  } else if (pathname.startsWith('/ops/cs')) {
    items.push({ label: 'Customer Service', path: '/ops/cs/tickets' })
  } else if (pathname.startsWith('/ops/staff')) {
    items.push({ label: 'Staff Verification', path: '/ops/staff' })
  } else if (pathname.startsWith('/ops/admin')) {
    items.push({ label: 'Master Data Admin', path: '/ops/admin/branches' })
    const parts = pathname.split('/')
    if (parts[3]) items.push({ label: parts[3].toUpperCase().replace(/-/g, ' '), path: `/ops/admin/${parts[3]}` })
  } else {
    const name = pathname.replace('/', '')
    items.push({ label: name.charAt(0).toUpperCase() + name.slice(1), path: pathname })
  }

  return items
}

function getSelectedKey(pathname, search = '') {
  if (!pathname || pathname === '/' || pathname === '/ops/dashboard') return '/ops/dashboard'
  if (pathname === '/ops/consignments/new') {
    return new URLSearchParams(search || '').get('mode') === 'drop'
      ? '/ops/consignments/new?mode=drop'
      : '/ops/consignments/new'
  }
  if (pathname.startsWith('/ops/consignments/import-log')) return '/ops/consignments/import-log'
  if (pathname.startsWith('/ops/consignments/import')) return '/ops/consignments/import'
  if (pathname.startsWith('/ops/consignments/tracking')) return '/ops/consignments/tracking'
  if (pathname.startsWith('/ops/consignments/cancellations')) return '/ops/consignments/cancellations'
  if (pathname.startsWith('/ops/consignments')) return '/ops/consignments'
  if (pathname.startsWith('/ops/pickups')) return '/ops/pickups'
  if (pathname.startsWith('/ops/overnight-requests')) return '/ops/overnight-requests'
  if (pathname.startsWith('/ops/ats-claims')) return '/ops/ats-claims'
  if (pathname.startsWith('/ops/dispatch')) return '/ops/dispatch'
  if (pathname.startsWith('/ops/seals')) return '/ops/seals'
  if (pathname.startsWith('/ops/station/manifests')) return '/ops/station/manifests'
  if (pathname.startsWith('/ops/manifests')) return '/ops/manifests'
  if (pathname.startsWith('/ops/returns')) return '/ops/returns'
  if (pathname.startsWith('/ops/summaries')) return pathname
  if (pathname.startsWith('/ops/reports/')) return pathname
  if (pathname.startsWith('/network')) return '/network'
  if (pathname.startsWith('/ops/billing/cancellation-settings')) return '/ops/billing/cancellation-settings'
  if (pathname.startsWith('/ops/billing/customer-wallet')) return '/ops/billing/customer-wallet'
  if (pathname.startsWith('/ops/billing/')) {
    const parts = pathname.split('/')
    return `/ops/billing/${parts[3] || 'invoices'}`
  }
  if (pathname.startsWith('/ops/billing')) return '/ops/billing/invoices'
  if (pathname.startsWith('/ops/cod')) return '/ops/cod'
  if (pathname.startsWith('/ops/partner-wallets') || pathname.startsWith('/ops/commissions')) {
    const seg = pathname.split('/').filter(Boolean).pop()
    const tab = new URLSearchParams(search).get('tab') || seg
    if (tab === 'ledger') return '/ops/commissions/ledger'
    if (tab === 'wallets') return '/ops/commissions/wallets'
    if (tab === 'withdrawals') return '/ops/commissions/withdrawals'
    if (tab === 'calculator') return '/ops/commissions/calculator'
    return '/ops/commissions/rates'
  }
  if (pathname.startsWith('/ops/agents')) return '/ops/billing/agent-in'
  if (pathname.startsWith('/ops/cs')) return '/ops/cs/tickets'
  if (pathname.startsWith('/ops/staff')) return '/ops/staff'
  if (pathname.startsWith('/ops/admin/role-access')) return '/ops/admin/role-access'
  if (pathname.startsWith('/ops/admin/')) {
    const parts = pathname.split('/')
    return `/ops/admin/${parts[3] || 'branches'}`
  }
  if (pathname.startsWith('/ops/admin')) return '/ops/admin/branches'
  if (pathname.startsWith('/ops/logs')) return '/ops/logs'
  return pathname
}

export default function AppLayout() {
  const { user, logout, booting, can, isAdmin } = useAuth()
  const isDpManager = isDroppointManager(user?.role)
  const entryPath = consignmentsNewPath(user?.role)
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  // DP managers only get drop-counter booking in search; others keep full New Shipment.
  const searchablePages = isDpManager
    ? APP_PAGES.filter((p) => p.path !== '/ops/consignments/new')
    : APP_PAGES

  // AutoComplete Type-Ahead State
  const [searchText, setSearchText] = useState('')
  const [searchOptions, setSearchOptions] = useState([])
  const searchTimerRef = useRef(null)

  // Keyboard shortcut: Ctrl+K or Cmd+K focuses search
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const inputEl = document.querySelector('.header-search-input input') || document.querySelector('.header-search-input')
        inputEl?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSearchChange(query) {
    setSearchText(query)
    const trimmed = (query || '').trim()

    if (trimmed.length < 2) {
      setSearchOptions([])
      return
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    searchTimerRef.current = setTimeout(async () => {
      // 1. Match system pages
      const matchedPages = searchablePages.filter(
        (p) =>
          p.title.toLowerCase().includes(trimmed.toLowerCase()) ||
          p.keywords?.some((k) => k.toLowerCase().includes(trimmed.toLowerCase()))
      ).map((p) => ({
        value: p.title,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#1B8A5A', fontSize: 13 }}>●</span>
            <span>{highlightMatch(p.title, trimmed)}</span>
          </div>
        ),
        type: 'page',
        path: p.path,
      }))

      // 2. Query Live API for consignments & customers
      let matchedCns = []
      let matchedCusts = []
      try {
        const res = await listConsignments({ search: trimmed, per_page: 5 })
        const rows = res?.data || res?.rows || []

        matchedCns = rows.map((r) => ({
          value: r.cn_no,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A' }}>
                {highlightMatch(r.cn_no, trimmed)}
              </span>
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {r.cn_origin} → {r.cn_dstn}
              </span>
            </div>
          ),
          type: 'consignment',
          cn: r.cn_no,
        }))

        const uniqueCusts = [...new Set(rows.map((r) => r.cust_name || r.consigner).filter(Boolean))]
        matchedCusts = uniqueCusts.slice(0, 3).map((cust) => ({
          value: cust,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#6B7280', fontSize: 12 }}>Customer:</span>
              <span>{highlightMatch(cust, trimmed)}</span>
            </div>
          ),
          type: 'customer',
          customer: cust,
        }))
      } catch {
        /* ignore */
      }

      const groups = []
      if (matchedPages.length > 0) groups.push({ label: 'Navigation', options: matchedPages })
      if (matchedCns.length > 0) groups.push({ label: 'Consignments', options: matchedCns })
      if (matchedCusts.length > 0) groups.push({ label: 'Customers', options: matchedCusts })
      setSearchOptions(groups)
    }, 280)
  }

  function handleOptionSelect(value, option) {
    saveRecentSearch(value)

    const targetType = option?.type || option?.data?.type
    const targetPath = option?.path || option?.data?.path
    const targetCn = option?.cn || option?.data?.cn
    const targetCustomer = option?.customer || option?.data?.customer

    // 1. Direct page match from APP_PAGES or explicit path
    const pageMatch = searchablePages.find(
      (p) =>
        p.title === value ||
        p.path === value ||
        (value && p.title.toLowerCase().includes(value.toLowerCase())) ||
        (value && value.toLowerCase().includes(p.title.toLowerCase()))
    )

    if (targetPath || targetType === 'page' || pageMatch) {
      navigate(targetPath || pageMatch?.path)
      setSearchText('')
      setSearchOptions([])
      return
    }

    // 2. Consignment match
    if (targetType === 'consignment' || targetCn) {
      navigate(`/ops/consignments/${encodeURIComponent(targetCn || value)}`)
      setSearchText('')
      setSearchOptions([])
      return
    }

    // 3. Customer match
    if (targetType === 'customer' || targetCustomer) {
      navigate(`/ops/consignments?search=${encodeURIComponent(targetCustomer || value)}`)
      setSearchText('')
      setSearchOptions([])
      return
    }

    // 4. Fallback
    navigate(`/ops/consignments/${encodeURIComponent(value)}`)
    setSearchText('')
    setSearchOptions([])
  }

  function handleGlobalSearch(value) {
    const trimmed = (value || '').trim()
    if (!trimmed) return
    saveRecentSearch(trimmed)

    const query = trimmed.toLowerCase()
    const pageMatch = searchablePages.find(
      (p) =>
        p.title.toLowerCase() === query ||
        p.title.toLowerCase().includes(query) ||
        p.keywords?.some((k) => k.toLowerCase().includes(query))
    )

    if (pageMatch) {
      navigate(pageMatch.path)
      setSearchText('')
      setSearchOptions([])
      return
    }

    navigate(`/ops/consignments/${encodeURIComponent(trimmed)}`)
    setSearchText('')
    setSearchOptions([])
  }

  if (booting) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#0F1B2D',
          color: '#C7D2DB',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Initializing IPOSB Control Tower…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Active menu root key calculation
  const selectedKey = getSelectedKey(location.pathname, location.search)

  // Full Production Navigation: Operations · Finance · Customer Service · Administration
  const menuGroups = [
    {
      key: 'grp-operations',
      type: 'group',
      label: 'OPERATIONS',
      children: [
        {
          key: '/ops/dashboard',
          icon: <DashboardOutlined />,
          label: <Link to="/ops/dashboard" style={{ display: 'block', width: '100%' }}>Dashboard</Link>,
          visible: true,
        },
        {
          key: '/ops/consignments',
          icon: <InboxOutlined />,
          label: <Link to="/ops/consignments" style={{ display: 'block', width: '100%' }}>Consignments</Link>,
          visible: can('consignments'),
        },
        {
          key: '/ops/consignments/new',
          icon: <PlusCircleOutlined />,
          label: <Link to="/ops/consignments/new" style={{ display: 'block', width: '100%' }}>New Shipment</Link>,
          visible: can('consignments') && !isDpManager,
        },
        {
          key: '/ops/consignments/new?mode=drop',
          icon: <InboxOutlined />,
          label: (
            <Link to={entryPath} style={{ display: 'block', width: '100%' }}>
              DP Counter Booking
            </Link>
          ),
          visible: can('consignments'),
        },
        {
          key: '/ops/consignments/tracking',
          icon: <SearchOutlined />,
          label: <Link to="/ops/consignments/tracking" style={{ display: 'block', width: '100%' }}>CN Tracking</Link>,
          visible: can('consignments'),
        },
        {
          key: '/ops/consignments/import',
          icon: <InboxOutlined />,
          label: <Link to="/ops/consignments/import" style={{ display: 'block', width: '100%' }}>Batch Import</Link>,
          visible: can('consignments'),
        },
        {
          key: '/ops/consignments/import-log',
          icon: <HistoryOutlined />,
          label: <Link to="/ops/consignments/import-log" style={{ display: 'block', width: '100%' }}>Import Error Log</Link>,
          visible: can('consignments'),
        },
        {
          key: '/ops/consignments/cancellations',
          icon: <AuditOutlined />,
          label: <Link to="/ops/consignments/cancellations" style={{ display: 'block', width: '100%' }}>Cancellation Log</Link>,
          visible: can('consignments') || isAdmin,
        },
        {
          key: '/ops/pickups',
          icon: <CarOutlined />,
          label: <Link to="/ops/pickups" style={{ display: 'block', width: '100%' }}>Pickups Queue</Link>,
          visible: can('pickups') || can('dispatch') || isAdmin,
        },
        {
          key: '/ops/overnight-requests',
          icon: <MoonOutlined />,
          label: <Link to="/ops/overnight-requests" style={{ display: 'block', width: '100%' }}>Overnight Requests</Link>,
          visible: can('pickups') || can('dispatch') || isAdmin,
        },
        {
          key: '/ops/ats-claims',
          icon: <WarningOutlined />,
          label: <Link to="/ops/ats-claims" style={{ display: 'block', width: '100%' }}>ATS / Problematic</Link>,
          visible: can('consignments') || can('dispatch') || can('pickups') || isAdmin,
        },
        {
          key: '/ops/dispatch',
          icon: <GlobalOutlined />,
          label: <Link to="/ops/dispatch?tab=assign" style={{ display: 'block', width: '100%' }}>Dispatch & 3PL</Link>,
          visible: can('pickups') || can('dispatch') || isAdmin,
        },
        {
          key: '/ops/seals',
          icon: <SafetyCertificateOutlined />,
          label: <Link to="/ops/seals" style={{ display: 'block', width: '100%' }}>Seal Station</Link>,
          visible: can('manifests') || can('dispatch') || isAdmin,
        },
        {
          key: '/ops/station/manifests',
          icon: <FileTextOutlined />,
          label: <Link to="/ops/station/manifests" style={{ display: 'block', width: '100%' }}>Manifest Station</Link>,
          visible: can('manifests') || can('dispatch') || isAdmin,
        },
        {
          key: '/ops/manifests',
          icon: <FileTextOutlined />,
          label: <Link to="/ops/manifests" style={{ display: 'block', width: '100%' }}>Manifests & Bags</Link>,
          visible: can('manifests') || can('consignments') || isAdmin,
        },
        {
          key: '/ops/returns',
          icon: <RollbackOutlined />,
          label: <Link to="/ops/returns" style={{ display: 'block', width: '100%' }}>RTS & Returns</Link>,
          visible: can('returns') || can('consignments') || isAdmin,
        },
        {
          key: '/network',
          icon: <BarChartOutlined />,
          label: <Link to="/network" style={{ display: 'block', width: '100%' }}>Network Analytics</Link>,
          visible: can('reports') || can('analytics') || isAdmin,
        },
        {
          key: 'sub-summaries',
          icon: <BarChartOutlined />,
          label: 'Status Summaries',
          visible: can('reports') || can('analytics') || isAdmin,
          children: [
            {
              key: '/ops/summaries',
              label: <Link to="/ops/summaries" style={{ display: 'block', width: '100%' }}>Overall</Link>,
              visible: true,
            },
            {
              key: '/ops/summaries/status',
              label: <Link to="/ops/summaries/status" style={{ display: 'block', width: '100%' }}>By Status</Link>,
              visible: true,
            },
            {
              key: '/ops/summaries/drop-point',
              label: <Link to="/ops/summaries/drop-point" style={{ display: 'block', width: '100%' }}>By Drop Point</Link>,
              visible: true,
            },
            {
              key: '/ops/summaries/branch',
              label: <Link to="/ops/summaries/branch" style={{ display: 'block', width: '100%' }}>By Branch</Link>,
              visible: true,
            },
            {
              key: '/ops/summaries/date',
              label: <Link to="/ops/summaries/date" style={{ display: 'block', width: '100%' }}>By Date</Link>,
              visible: true,
            },
            {
              key: '/ops/summaries/manifest',
              label: <Link to="/ops/summaries/manifest" style={{ display: 'block', width: '100%' }}>By Manifest</Link>,
              visible: true,
            },
            {
              key: '/ops/summaries/consignee',
              label: <Link to="/ops/summaries/consignee" style={{ display: 'block', width: '100%' }}>By Consignee</Link>,
              visible: true,
            },
            {
              key: '/ops/summaries/consigner',
              label: <Link to="/ops/summaries/consigner" style={{ display: 'block', width: '100%' }}>By Consigner</Link>,
              visible: true,
            },
            {
              key: '/ops/summaries/shipper',
              label: <Link to="/ops/summaries/shipper" style={{ display: 'block', width: '100%' }}>By Shipper</Link>,
              visible: true,
            },
          ],
        },
        {
          key: 'sub-prints',
          icon: <PrinterOutlined />,
          label: 'Print & Stock Reports',
          visible: can('reports') || can('billing') || isAdmin,
          children: [
            {
              key: '/ops/reports/manifest',
              label: <Link to="/ops/reports/manifest" style={{ display: 'block', width: '100%' }}>Print Manifest</Link>,
              visible: true,
            },
            {
              key: '/ops/reports/cn',
              label: <Link to="/ops/reports/cn" style={{ display: 'block', width: '100%' }}>Print Consignment</Link>,
              visible: true,
            },
            {
              key: '/ops/reports/invoice',
              label: <Link to="/ops/reports/invoice" style={{ display: 'block', width: '100%' }}>Print Invoice</Link>,
              visible: true,
            },
            {
              key: '/ops/reports/do',
              label: <Link to="/ops/reports/do" style={{ display: 'block', width: '100%' }}>Print DO</Link>,
              visible: true,
            },
            {
              key: '/ops/reports/drop-point-stock',
              label: <Link to="/ops/reports/drop-point-stock" style={{ display: 'block', width: '100%' }}>Drop Point Stock</Link>,
              visible: true,
            },
            {
              key: '/ops/reports/customer-stock',
              label: <Link to="/ops/reports/customer-stock" style={{ display: 'block', width: '100%' }}>Customer Stock</Link>,
              visible: true,
            },
            {
              key: '/ops/reports/customer-summary',
              label: <Link to="/ops/reports/customer-summary" style={{ display: 'block', width: '100%' }}>Customer Summary</Link>,
              visible: true,
            },
            {
              key: '/ops/reports/drop-point-summary',
              label: <Link to="/ops/reports/drop-point-summary" style={{ display: 'block', width: '100%' }}>Drop Point Summary</Link>,
              visible: true,
            },
          ],
        },
      ],
    },
    {
      key: 'grp-finance',
      type: 'group',
      label: 'FINANCE & BILLING',
      children: [
        {
          key: 'sub-billing',
          icon: <DollarCircleOutlined />,
          label: 'Billing Documents',
          visible: can('billing') || isAdmin,
          children: [
            {
              key: '/ops/billing/invoices',
              label: <Link to="/ops/billing/invoices" style={{ display: 'block', width: '100%' }}>Invoices</Link>,
              visible: can('billing') || isAdmin,
            },
            {
              key: '/ops/billing/invoices/tracking',
              label: <Link to="/ops/billing/invoices/tracking" style={{ display: 'block', width: '100%' }}>Invoice Tracking</Link>,
              visible: can('billing') || isAdmin,
            },
            {
              key: '/ops/billing/do',
              label: <Link to="/ops/billing/do" style={{ display: 'block', width: '100%' }}>Delivery Orders (DO)</Link>,
              visible: can('billing') || isAdmin,
            },
            {
              key: '/ops/billing/do/tracking',
              label: <Link to="/ops/billing/do/tracking" style={{ display: 'block', width: '100%' }}>DO Tracking</Link>,
              visible: can('billing') || isAdmin,
            },
            {
              key: '/ops/billing/credit-notes',
              label: <Link to="/ops/billing/credit-notes" style={{ display: 'block', width: '100%' }}>Credit Notes</Link>,
              visible: can('billing') || isAdmin,
            },
            {
              key: '/ops/billing/debit-notes',
              label: <Link to="/ops/billing/debit-notes" style={{ display: 'block', width: '100%' }}>Debit Notes</Link>,
              visible: can('billing') || isAdmin,
            },
            {
              key: '/ops/billing/agent-in',
              label: <Link to="/ops/billing/agent-in" style={{ display: 'block', width: '100%' }}>Drop Point Money In</Link>,
              visible: can('billing') || can('dropPoints') || isAdmin,
            },
            {
              key: '/ops/billing/agent-out',
              label: <Link to="/ops/billing/agent-out" style={{ display: 'block', width: '100%' }}>Drop Point Money Out</Link>,
              visible: can('billing') || can('dropPoints') || isAdmin,
            },
            {
              key: '/ops/billing/agent-credit',
              label: <Link to="/ops/billing/agent-credit" style={{ display: 'block', width: '100%' }}>Drop Point Credit Notes</Link>,
              visible: can('billing') || can('dropPoints') || isAdmin,
            },
            {
              key: '/ops/billing/agent-debit',
              label: <Link to="/ops/billing/agent-debit" style={{ display: 'block', width: '100%' }}>Drop Point Debit Notes</Link>,
              visible: can('billing') || can('dropPoints') || isAdmin,
            },
          ],
        },
        {
          key: '/ops/cod',
          icon: <WalletOutlined />,
          label: <Link to="/ops/cod" style={{ display: 'block', width: '100%' }}>COD Reconciliation</Link>,
          visible: can('cod') || can('billing') || isAdmin,
        },
        {
          key: '/ops/billing/customer-wallet',
          icon: <WalletOutlined />,
          label: <Link to="/ops/billing/customer-wallet" style={{ display: 'block', width: '100%' }}>Customer Wallet</Link>,
          visible: can('billing') || isAdmin,
        },
        {
          key: '/ops/billing/cancellation-settings',
          icon: <AuditOutlined />,
          label: <Link to="/ops/billing/cancellation-settings" style={{ display: 'block', width: '100%' }}>Cancellation Policy</Link>,
          visible: isAdmin,
        },
        {
          key: 'sub-commissions',
          icon: <TeamOutlined />,
          label: 'Commissions & Wallets',
          visible: can('commissions') || can('billing') || isAdmin,
          children: [
            {
              key: '/ops/commissions/rates',
              label: <Link to="/ops/commissions/rates" style={{ display: 'block', width: '100%' }}>Rate settings (split config)</Link>,
              visible: can('commissions') || can('billing') || isAdmin,
            },
            {
              key: '/ops/commissions/calculator',
              label: <Link to="/ops/commissions/calculator" style={{ display: 'block', width: '100%' }}>What-if calculator</Link>,
              visible: can('commissions') || can('billing') || isAdmin,
            },
            {
              key: '/ops/commissions/ledger',
              label: <Link to="/ops/commissions/ledger" style={{ display: 'block', width: '100%' }}>Commission Ledger</Link>,
              visible: can('commissions') || isAdmin,
            },
            {
              key: '/ops/commissions/wallets',
              label: <Link to="/ops/commissions/wallets" style={{ display: 'block', width: '100%' }}>Partner Wallets</Link>,
              visible: can('commissions') || isAdmin,
            },
            {
              key: '/ops/commissions/withdrawals',
              label: <Link to="/ops/commissions/withdrawals" style={{ display: 'block', width: '100%' }}>Withdrawals</Link>,
              visible: can('commissions') || isAdmin,
            },
          ],
        },
      ],
    },
    {
      key: 'grp-support',
      type: 'group',
      label: 'CUSTOMER SERVICE',
      children: [
        {
          key: '/ops/cs/tickets',
          icon: <CustomerServiceOutlined />,
          label: <Link to="/ops/cs/tickets" style={{ display: 'block', width: '100%' }}>CS Support Tickets</Link>,
          visible: can('customerService') || isAdmin,
        },
      ],
    },
    {
      key: 'grp-system',
      type: 'group',
      label: 'ADMINISTRATION',
      children: [
        {
          key: '/ops/staff',
          icon: <SafetyCertificateOutlined />,
          label: <Link to="/ops/staff" style={{ display: 'block', width: '100%' }}>Staff Verification</Link>,
          visible: can('staff') || isAdmin,
        },
        {
          key: '/ops/admin/role-access',
          icon: <KeyOutlined />,
          label: <Link to="/ops/admin/role-access" style={{ display: 'block', width: '100%' }}>Role Access (RBAC)</Link>,
          visible: can('roleAccess') || String(user?.role || '') === 'Super Admin' || isAdmin,
        },
        {
          key: 'sub-master-data',
          icon: <SettingOutlined />,
          label: 'Master Data',
          visible: can('admin') || can('branches') || isAdmin,
          children: [
            {
              key: '/ops/admin/branches',
              label: <Link to="/ops/admin/branches" style={{ display: 'block', width: '100%' }}>Branches</Link>,
              visible: can('admin') || can('branches') || isAdmin,
            },
            {
              key: '/ops/admin/hubs',
              label: <Link to="/ops/admin/hubs" style={{ display: 'block', width: '100%' }}>Hubs & Transit</Link>,
              visible: can('admin') || can('branches') || isAdmin,
            },
            {
              key: '/ops/admin/drop-points',
              label: <Link to="/ops/admin/drop-points" style={{ display: 'block', width: '100%' }}>Drop Points & Counters</Link>,
              visible: can('admin') || can('branches') || isAdmin,
            },
            {
              key: '/ops/admin/drivers',
              label: <Link to="/ops/admin/drivers" style={{ display: 'block', width: '100%' }}>Drivers & Couriers</Link>,
              visible: can('admin') || can('drivers') || isAdmin,
            },
            {
              key: '/ops/admin/dispatchers',
              label: <Link to="/ops/admin/dispatchers" style={{ display: 'block', width: '100%' }}>Dispatchers</Link>,
              visible: can('admin') || can('dispatch') || isAdmin,
            },
            {
              key: '/ops/admin/3pl',
              label: <Link to="/ops/admin/3pl" style={{ display: 'block', width: '100%' }}>3PL Partners</Link>,
              visible: can('admin') || isAdmin,
            },
            {
              key: '/ops/admin/coverage',
              label: <Link to="/ops/admin/coverage" style={{ display: 'block', width: '100%' }}>Coverage Areas</Link>,
              visible: can('admin') || isAdmin,
            },
            {
              key: '/ops/admin/routes',
              label: <Link to="/ops/admin/routes" style={{ display: 'block', width: '100%' }}>Routing Rules</Link>,
              visible: can('admin') || isAdmin,
            },
            {
              key: '/ops/admin/zones',
              label: <Link to="/ops/admin/zones" style={{ display: 'block', width: '100%' }}>Delivery Points</Link>,
              visible: can('admin') || can('routing') || isAdmin,
            },
            {
              key: '/ops/admin/areas',
              label: <Link to="/ops/admin/areas" style={{ display: 'block', width: '100%' }}>Network Areas</Link>,
              visible: can('admin') || can('routing') || isAdmin,
            },
            {
              key: '/ops/admin/route-codes',
              label: <Link to="/ops/admin/route-codes" style={{ display: 'block', width: '100%' }}>Route Codes</Link>,
              visible: can('admin') || isAdmin,
            },
            {
              key: '/ops/admin/customers',
              label: <Link to="/ops/admin/customers" style={{ display: 'block', width: '100%' }}>Corporate Customers</Link>,
              visible: can('admin') || can('customers') || isAdmin,
            },
            {
              key: '/ops/admin/users',
              label: <Link to="/ops/admin/users" style={{ display: 'block', width: '100%' }}>Staff Users</Link>,
              visible: isAdmin,
            },
          ],
        },
        {
          key: '/ops/logs',
          icon: <HistoryOutlined />,
          label: <Link to="/ops/logs" style={{ display: 'block', width: '100%' }}>Activity & System Logs</Link>,
          visible: true,
        },
      ],
    },
  ]

  function filterMenu(items) {
    if (!items) return []
    return items
      .filter((item) => item.visible !== false)
      .map((item) => {
        if (item.children) {
          const filteredChildren = filterMenu(item.children)
          return {
            ...item,
            children: filteredChildren,
          }
        }
        return item
      })
      .filter((item) => !item.children || item.children.length > 0)
  }

  const menuItems = filterMenu(menuGroups)

  const userMenuItems = {
    items: [
      {
        key: 'user-info',
        disabled: true,
        label: (
          <div style={{ color: '#1F2937', padding: '4px 0' }}>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: '11px', color: '#6B7280' }}>
              {user.role} {user.branchCode ? `(${user.branchCode})` : ''}
            </div>
          </div>
        ),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        danger: true,
        onClick: () => logout(),
      },
    ],
  }

  const breadcrumbItems = getBreadcrumbs(location.pathname, location.search)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sider Rail: Light Theme with Grouped Sections */}
      <Sider
        className="app-sider"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        collapsedWidth={68}
        theme="light"
        style={{
          background: '#FFFFFF',
          borderRight: '1px solid #E5E8EB',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
          overflowY: 'auto',
        }}
      >
        {/* Brand Header: Logo Only + Caption (No duplicate "IPOSB" text) */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            gap: 12,
            borderBottom: '1px solid #E5E8EB',
            position: 'sticky',
            top: 0,
            background: '#FFFFFF',
            zIndex: 10,
          }}
        >
          <img
            src="/logo.png"
            alt="IPOSB"
            style={{ height: 34, width: 'auto', objectFit: 'contain' }}
          />
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  color: '#1B8A5A',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '1.2px',
                  lineHeight: 1.2,
                }}
              >
                CONTROL TOWER
              </span>
          </div>
          )}
        </div>

        {/* Full Nav with Always-Visible Grouped Sections & Expandable Submenus */}
        <div style={{ padding: '6px 0 60px' }}>
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={['sub-billing', 'sub-commissions', 'sub-master-data']}
            onClick={({ key }) => {
              if (key && !key.startsWith('grp-') && !key.startsWith('sub-')) {
                navigate(key)
              }
            }}
            items={menuItems}
            style={{
              background: 'transparent',
              fontSize: 13,
              borderRight: 0,
            }}
          />
        </div>

        {/* User Badge in Light Container */}
        {!collapsed && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px',
              borderTop: '1px solid #E5E7EB',
              background: '#F9FAFB',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar
                size="small"
                style={{ backgroundColor: '#1B8A5A' }}
                icon={<UserOutlined />}
              />
              <div style={{ overflow: 'hidden', lineHeight: 1.2 }}>
                <div
                  style={{
                    color: '#1F2937',
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  {user.name}
                </div>
                <div style={{ color: '#6B7280', fontSize: 11 }}>
                  {user.role} {user.branchCode ? `(${user.branchCode})` : ''}
                </div>
              </div>
          </div>
          </div>
        )}
      </Sider>

      {/* Main Content Layout */}
      <Layout style={{ background: '#F4F6F8' }}>
        {/* Top Header: Fixed 56px, Dynamic Breadcrumb, Baseline Aligned Controls */}
        <Header className="app-header">
          <Breadcrumb
            items={breadcrumbItems.map((m, i) => ({
              title:
                i === breadcrumbItems.length - 1 ? (
                  <span style={{ fontWeight: 600, color: '#0F1B2D' }}>{m.label}</span>
                ) : (
                  <a
                    style={{ color: '#64748B', cursor: 'pointer' }}
                    onClick={() => navigate(m.path)}
                  >
                    {m.label}
                  </a>
                ),
            }))}
          />

          <div className="app-header-right">
            <AutoComplete
              options={searchOptions}
              value={searchText}
              onChange={handleSearchChange}
              onSelect={handleOptionSelect}
              className="header-search-autocomplete"
              popupMatchSelectWidth={300}
            >
              <Input
                className="header-search-input"
                size="middle"
                placeholder="Search CN, customer, or page…"
                prefix={<SearchOutlined style={{ color: '#64748B', fontSize: 14 }} />}
                suffix={
                  <span className="header-search-shortcut">
                    {typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '') ? '⌘K' : 'Ctrl K'}
                  </span>
                }
                allowClear
                onPressEnter={(e) => handleGlobalSearch(e.target.value)}
              />
            </AutoComplete>

            <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
              <Badge dot offset={[-2, 2]}>
                <BellOutlined
                  style={{ fontSize: 18, color: '#4B5563', cursor: 'pointer', display: 'flex' }}
                  onClick={() => navigate('/support')}
                />
              </Badge>
            </div>

            <Dropdown menu={userMenuItems} placement="bottomRight" trigger={['click']}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 6,
                  height: 36,
                }}
              >
                <Avatar
                  style={{ backgroundColor: '#1B8A5A' }}
                  icon={<UserOutlined />}
                  size="small"
                />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1F2937' }}>
                  {user.username}
            </span>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* Content */}
        <Content
          style={{
            padding: '20px 24px',
            margin: 0,
            minHeight: 280,
          }}
          className="content-fade-in"
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
