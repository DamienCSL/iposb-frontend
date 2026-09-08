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
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { listConsignments } from '../api/client'

const { Header, Sider, Content } = Layout

const APP_PAGES = [
  { title: 'Dashboard', path: '/', keywords: ['home', 'overview'] },
  { title: 'Shipments', path: '/shipments', keywords: ['consignments', 'cn', 'tracking', 'list'] },
  { title: 'New Consignment Entry', path: '/shipments?action=new', keywords: ['create', 'add', 'shipment'] },
  { title: 'Consignment Tracking & POD', path: '/shipments?tab=tracking', keywords: ['track', 'pod', 'status'] },
  { title: 'Dispatch & Fleet', path: '/dispatch', keywords: ['driver', 'vehicle', '3pl', 'manifest'] },
  { title: 'Analytics', path: '/network', keywords: ['reports', 'summary', 'statistics'] },
  { title: 'Billing', path: '/billing', keywords: ['invoices', 'do', 'receipts', 'finance'] },
  { title: 'Agents', path: '/agents', keywords: ['bilyet', 'partners', 'stock', 'topup'] },
  { title: 'Customer Service', path: '/support', keywords: ['cs', 'tickets', 'support', 'helpdesk', 'issues'] },
  { title: 'Settings', path: '/settings', keywords: ['admin', 'branches', 'hubs', 'users', 'coverage'] },
  { title: 'Staff Verification', path: '/settings?tab=staff', keywords: ['staff', 'approval', 'identity'] },
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
  const params = new URLSearchParams(search || '')
  const items = [
    { label: 'IPOSB', path: '/' },
    { label: 'Freight Management System', path: '/' },
  ]

  if (pathname === '/' || pathname === '') {
    return items
  }

  if (pathname.startsWith('/shipments')) {
    items.push({ label: 'Consignments', path: '/shipments' })
    const tab = params.get('tab')
    const action = params.get('action')
    if (action === 'new') {
      items.push({ label: 'Consignment Entry', path: '/shipments?action=new' })
    } else if (tab === 'tracking') {
      items.push({ label: 'Consignment Tracking', path: '/shipments?tab=tracking' })
    } else if (tab === 'import') {
      items.push({ label: 'Import Error Log', path: '/shipments?tab=import' })
    } else {
      items.push({ label: 'Consignment List', path: '/shipments' })
    }
  } else if (pathname.startsWith('/dispatch')) {
    items.push({ label: 'Dispatch & Fleet', path: '/dispatch' })
    const tab = params.get('tab')
    if (tab === 'remote') {
      items.push({ label: 'Remote / 3PL Pickup', path: '/dispatch?tab=remote' })
    } else if (tab === 'drivers') {
      items.push({ label: 'Driver Roster', path: '/dispatch?tab=drivers' })
    } else {
      items.push({ label: 'Driver Assignment', path: '/dispatch?tab=assign' })
    }
  } else if (pathname.startsWith('/network')) {
    items.push({ label: 'Status Summaries', path: '/network' })
    const group = params.get('group')
    if (group) {
      const groupNames = {
        status: 'By Status',
        agent: 'By Agent',
        consignee: 'By Consignee',
        consigner: 'By Consigner',
        shipper: 'By Shipper',
        date: 'By Date',
        branch: 'By Branch',
      }
      items.push({ label: groupNames[group] || `Summary (${group})`, path: `/network?group=${group}` })
    } else {
      items.push({ label: 'Overall Status Summary', path: '/network' })
    }
  } else if (pathname.startsWith('/billing')) {
    items.push({ label: 'Billing & Invoicing', path: '/billing' })
    const doc = params.get('doc')
    if (doc === 'do') {
      items.push({ label: 'Delivery Orders (DO)', path: '/billing?doc=do' })
    } else if (doc === 'receipts') {
      items.push({ label: 'Payment Receipts', path: '/billing?doc=receipts' })
    } else if (doc === 'credit-notes') {
      items.push({ label: 'Credit Notes', path: '/billing?doc=credit-notes' })
    } else {
      items.push({ label: 'Invoices', path: '/billing?doc=invoices' })
    }
  } else if (pathname.startsWith('/agents')) {
    items.push({ label: 'Agent Operations', path: '/agents' })
    const tab = params.get('tab')
    const type = params.get('type')
    if (tab === 'ledger') {
      if (type === 'agent-out') items.push({ label: 'Agent Money Out', path: '/agents?tab=ledger&type=agent-out' })
      else if (type === 'agent-credit') items.push({ label: 'Credit / Debit Notes', path: '/agents?tab=ledger&type=agent-credit' })
      else items.push({ label: 'Agent Money In', path: '/agents?tab=ledger&type=agent-in' })
    } else {
      items.push({ label: 'Agent Balances & Overview', path: '/agents?tab=overview' })
    }
  } else if (pathname.startsWith('/support')) {
    items.push({ label: 'Customer Service', path: '/support' })
    items.push({ label: 'Tickets Queue', path: '/support' })
  } else if (pathname.startsWith('/settings')) {
    items.push({ label: 'Administration & Masters', path: '/settings' })
    const tab = params.get('tab')
    const sub = params.get('sub')
    if (tab === 'staff') {
      items.push({ label: 'Staff Verification', path: '/settings?tab=staff' })
    } else if (sub === '3pl') {
      items.push({ label: '3PL Partners', path: '/settings?tab=masters&sub=3pl' })
    } else if (sub === 'routes') {
      items.push({ label: 'Routes & Zones', path: '/settings?tab=masters&sub=routes' })
    } else if (sub === 'branches' || tab === 'masters') {
      items.push({ label: 'Hubs & Branches', path: '/settings?tab=masters&sub=branches' })
    } else {
      items.push({ label: 'User Management', path: '/settings?tab=users' })
    }
  } else {
    const name = pathname.replace('/', '')
    items.push({ label: name.charAt(0).toUpperCase() + name.slice(1), path: pathname })
  }

  return items
}

function getSelectedKey(pathname, search) {
  const params = new URLSearchParams(search || '')
  if (pathname === '/' || pathname === '') return '/'

  if (pathname.startsWith('/shipments')) {
    if (params.get('action') === 'new') return '/shipments/new'
    if (params.get('tab') === 'tracking') return '/shipments/tracking'
    if (params.get('tab') === 'import') return '/shipments/import'
    return '/shipments'
  }
  if (pathname.startsWith('/dispatch')) {
    if (params.get('tab') === 'remote') return '/dispatch/remote'
    if (params.get('tab') === 'drivers') return '/dispatch/drivers'
    return '/dispatch/assign'
  }
  if (pathname.startsWith('/network')) {
    const group = params.get('group')
    if (group) return `/network/${group}`
    return '/network'
  }
  if (pathname.startsWith('/billing')) {
    const doc = params.get('doc')
    if (doc) return `/billing/${doc}`
    return '/billing/invoices'
  }
  if (pathname.startsWith('/agents')) {
    const tab = params.get('tab')
    const type = params.get('type')
    if (tab === 'ledger') {
      if (type === 'agent-out') return '/agents/out'
      if (type === 'agent-credit') return '/agents/credit'
      return '/agents/in'
    }
    return '/agents/overview'
  }
  if (pathname.startsWith('/support')) return '/support'
  if (pathname.startsWith('/settings')) {
    const tab = params.get('tab')
    const sub = params.get('sub')
    if (tab === 'staff') return '/settings/staff'
    if (sub === '3pl') return '/settings/3pl'
    if (sub === 'routes') return '/settings/routes'
    if (sub === 'branches' || tab === 'masters') return '/settings/branches'
    return '/settings/users'
  }
  return pathname
}

export default function AppLayout() {
  const { user, logout, booting } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

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
      // 1. Matched Pages
      const matchedPages = APP_PAGES.filter((p) => {
        const query = trimmed.toLowerCase()
        return (
          p.title.toLowerCase().includes(query) ||
          p.keywords?.some((k) => k.toLowerCase().includes(query))
        )
      }).map((p) => ({
        value: p.title,
        key: p.path,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: '#1B8A5A' }} />
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
        const res = await listConsignments({ q: trimmed, limit: 5 })
        const rows = res?.rows || []

        matchedCns = rows.map((r) => ({
          value: r.cn_no,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                {highlightMatch(r.cn_no, trimmed)}
              </span>
              <span style={{ fontSize: 11, color: '#64748B' }}>
                {r.cn_origin} → {r.cn_dstn}
              </span>
            </div>
          ),
          type: 'consignment',
          cn: r.cn_no,
        }))

        // Deduplicated customers
        const custMap = new Map()
        rows.forEach((r) => {
          if (r.cust_name && !custMap.has(r.cust_name)) {
            custMap.set(r.cust_name, r)
          }
        })
        matchedCusts = Array.from(custMap.values()).map((r) => ({
          value: r.cust_name,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined style={{ color: '#1668DC' }} />
              <span>{highlightMatch(r.cust_name, trimmed)}</span>
            </div>
          ),
          type: 'customer',
          customer: r.cust_name,
        }))
      } catch {
        // API fallback
      }

      const groups = []
      if (matchedPages.length > 0) {
        groups.push({
          label: (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
              <FileTextOutlined style={{ marginRight: 6 }} /> System Navigation
            </span>
          ),
          options: matchedPages,
        })
      }
      if (matchedCns.length > 0) {
        groups.push({
          label: (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
              <InboxOutlined style={{ marginRight: 6 }} /> Consignments
            </span>
          ),
          options: matchedCns,
        })
      }
      if (matchedCusts.length > 0) {
        groups.push({
          label: (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
              <UserOutlined style={{ marginRight: 6 }} /> Customers
            </span>
          ),
          options: matchedCusts,
        })
      }

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
    const pageMatch = APP_PAGES.find(
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
      navigate(`/shipments?tab=tracking&cn=${encodeURIComponent(targetCn || value)}`)
      setSearchText('')
      setSearchOptions([])
      return
    }

    // 3. Customer match
    if (targetType === 'customer' || targetCustomer) {
      navigate(`/shipments?tab=all&customer=${encodeURIComponent(targetCustomer || value)}`)
      setSearchText('')
      setSearchOptions([])
      return
    }

    // 4. Fallback: navigate to tracking with query
    navigate(`/shipments?tab=tracking&cn=${encodeURIComponent(value)}`)
    setSearchText('')
    setSearchOptions([])
  }

  function handleGlobalSearch(value) {
    const trimmed = (value || '').trim()
    if (!trimmed) return
    saveRecentSearch(trimmed)

    const query = trimmed.toLowerCase()
    const pageMatch = APP_PAGES.find(
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

    navigate(`/shipments?tab=tracking&cn=${encodeURIComponent(trimmed)}`)
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
  const pathSegment = location.pathname.split('/')[1] || ''
  const activeRoot = '/' + pathSegment
  const selectedKey =
    activeRoot === '/consignments'
      ? '/shipments'
      : activeRoot === '/admin'
      ? '/settings'
      : activeRoot === '/summaries'
      ? '/network'
      : activeRoot || '/'

  // Clean Grouped Navigation: 8 Core Non-Repetitive Modules
  const menuItems = [
    {
      key: 'grp-operations',
      type: 'group',
      label: 'OPERATIONS',
      children: [
        {
          key: '/',
          icon: <DashboardOutlined />,
          label: <Link to="/" style={{ display: 'block', width: '100%' }}>Dashboard</Link>,
        },
        {
          key: '/shipments',
          icon: <InboxOutlined />,
          label: <Link to="/shipments" style={{ display: 'block', width: '100%' }}>Shipments</Link>,
        },
        {
          key: '/dispatch',
          icon: <CarOutlined />,
          label: <Link to="/dispatch" style={{ display: 'block', width: '100%' }}>Dispatch & Fleet</Link>,
        },
        {
          key: '/network',
          icon: <BarChartOutlined />,
          label: <Link to="/network" style={{ display: 'block', width: '100%' }}>Analytics</Link>,
        },
      ],
    },
    {
      key: 'grp-finance',
      type: 'group',
      label: 'FINANCE & PARTNERS',
      children: [
        {
          key: '/billing',
          icon: <DollarCircleOutlined />,
          label: <Link to="/billing" style={{ display: 'block', width: '100%' }}>Billing</Link>,
        },
        {
          key: '/agents',
          icon: <TeamOutlined />,
          label: <Link to="/agents" style={{ display: 'block', width: '100%' }}>Agents</Link>,
        },
      ],
    },
    {
      key: 'grp-support',
      type: 'group',
      label: 'SUPPORT',
      children: [
        {
          key: '/support',
          icon: <CustomerServiceOutlined />,
          label: <Link to="/support" style={{ display: 'block', width: '100%' }}>Customer Service</Link>,
        },
      ],
    },
    {
      key: 'grp-system',
      type: 'group',
      label: 'SYSTEM',
      children: [
        {
          key: '/settings',
          icon: <SettingOutlined />,
          label: <Link to="/settings" style={{ display: 'block', width: '100%' }}>Settings</Link>,
        },
      ],
    },
  ]

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
            onClick={({ key }) => {
              if (key && !key.startsWith('grp-')) {
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
