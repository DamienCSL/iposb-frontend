import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  BankOutlined,
  BarChartOutlined,
  BranchesOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  CustomerServiceOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  IdcardOutlined,
  InboxOutlined,
  KeyOutlined,
  LockOutlined,
  PrinterOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { apiError, getRbacModules, getRbacRoles, updateRbacRole } from '../api/client'
import { remapDefaultRoute } from '../auth/routeAliases'
import { useAuth } from '../auth/AuthContext'
import { Link } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const LOCKED_ROLES = new Set(['Super Admin'])

/** Plain-language hints for each job role */
const ROLE_HINTS = {
  'Super Admin': 'Full access to everything. This role is protected and cannot be changed.',
  Admin: 'Head office staff who oversee most daily work, billing, and user setup.',
  'Hub Manager': 'Runs hub scanning, consignments, and dispatch at a hub.',
  'Droppoint Manager': 'Manages drop-point collections, bilyet, and local stock.',
  Operation: 'Operations desk — consignments, dispatch, and status reports.',
  Agent: 'Drop-point agent — consignments, summaries, and drop-point money.',
  Invoice: 'Billing team — invoices, receipts, credit notes, and COD.',
  CSL: 'Customer service — tickets and consignment lookup.',
  Others: 'Limited or custom access — configure modules below.',
}

/** Icons + friendly descriptions (non-technical) */
const MODULE_META = {
  consignments: {
    icon: InboxOutlined,
    hint: 'Create, search, track, and cancel shipments',
  },
  pickups: {
    icon: CarOutlined,
    hint: 'First-mile waiting queue and courier / DP assignment',
  },
  manifests: {
    icon: FileTextOutlined,
    hint: 'Manifests, bags, and seal station',
  },
  dispatch: {
    icon: CarOutlined,
    hint: 'Driver assignment, plan path, and remote / 3PL coverage',
  },
  summaries: {
    icon: BarChartOutlined,
    hint: 'View status summaries and operational reports',
  },
  customerService: {
    icon: CustomerServiceOutlined,
    hint: 'Handle customer tickets and inquiries',
  },
  billing: {
    icon: FileTextOutlined,
    hint: 'Invoices, receipts, credit notes, and customer wallet',
  },
  cod: {
    icon: DollarOutlined,
    hint: 'Cash-on-delivery collection and reconciliation',
  },
  commissions: {
    icon: RiseOutlined,
    hint: 'Commission rate matrix, calculator, ledger, and withdrawals',
  },
  dropPoints: {
    icon: EnvironmentOutlined,
    hint: 'Drop points, stock, and drop-point money',
  },
  agent: {
    icon: TeamOutlined,
    hint: 'Agent money overview and drop-point agent tools',
  },
  customerReports: {
    icon: RiseOutlined,
    hint: 'Customer and drop-point summary reports',
  },
  reports: {
    icon: PrinterOutlined,
    hint: 'Print manifests, consignments, and billing documents',
  },
  users: {
    icon: TeamOutlined,
    hint: 'Add and manage staff login accounts',
  },
  branches: {
    icon: BankOutlined,
    hint: 'Branch locations and settings',
  },
  hubs: {
    icon: ClusterOutlined,
    hint: 'Scan hubs and hub configuration',
  },
  staff: {
    icon: IdcardOutlined,
    hint: 'Approve app sign-ups; manage drivers and dispatchers',
  },
  routing: {
    icon: BranchesOutlined,
    hint: 'Zones, routes, and route codes for planning',
  },
  admin: {
    icon: SettingOutlined,
    hint: 'Master data admin screens (branches, hubs, partners)',
  },
}

const GROUP_META = {
  Operations: { icon: SettingOutlined, subtitle: 'Daily shipping and customer work' },
  Finance: { icon: DollarOutlined, subtitle: 'Money, invoices, and refunds' },
  Network: { icon: EnvironmentOutlined, subtitle: 'Drop points and local money' },
  Reports: { icon: FileTextOutlined, subtitle: 'Printouts and summaries' },
  Administration: { icon: SafetyCertificateOutlined, subtitle: 'Setup for managers and IT' },
  Other: { icon: AppstoreOutlined, subtitle: 'Other areas' },
}

const DEMO_LOGINS = [
  { role: 'Super Admin', user: 'admin', note: 'Full access — edit Staff Access settings' },
  { role: 'Admin', user: 'office_admin', note: 'Head office — most daily modules' },
  { role: 'Hub Manager', user: 'hubmgr01', note: 'Hub scanning, consignments, dispatch' },
  { role: 'Drop Point Manager', user: 'droppoint01', note: 'Drop points, bilyet, local stock' },
  { role: 'Operations', user: 'ops01', note: 'Consignments, dispatch, summaries' },
  { role: 'Agent', user: 'agent01', note: 'Penang drop-point agent view' },
  { role: 'Billing', user: 'inv01', note: 'Invoices, COD, wallet, commissions' },
  { role: 'Customer Service', user: 'csl01', note: 'CS tickets and tracking' },
  { role: 'Others', user: 'staff01', note: 'Limited access — try your custom settings' },
]

const brandPrimary = { background: '#1B8A5A', borderColor: '#1B8A5A' }

export default function RoleAccessPage() {
  const { user } = useAuth()
  const isSuperAdmin = String(user?.role || '') === 'Super Admin'
  const [modules, setModules] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState('')
  const [enabled, setEnabled] = useState([])
  const [defaultRoute, setDefaultRoute] = useState('/ops/dashboard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const roleRow = useMemo(
    () => roles.find((r) => r.role === selectedRole),
    [roles, selectedRole],
  )
  const locked = LOCKED_ROLES.has(selectedRole) || Boolean(roleRow?.locked)

  const routeOptions = useMemo(() => {
    const enabledSet = new Set(enabled)
    const opts = [{ value: '/ops/dashboard', label: 'Main dashboard', desc: 'Overview when they first log in' }]
    for (const mod of modules) {
      if (mod.code === 'roleAccess') continue
      if (enabledSet.has(mod.code) && mod.suggestedRoute && mod.suggestedRoute !== '/' && mod.suggestedRoute !== '/ops/dashboard') {
        const meta = MODULE_META[mod.code]
        const route = remapDefaultRoute(mod.suggestedRoute)
        if (opts.some((o) => o.value === route)) continue
        opts.push({
          value: route,
          label: mod.label,
          desc: meta?.hint || `Opens ${mod.label}`,
        })
      }
    }
    return opts
  }, [modules, enabled])

  const groupedModules = useMemo(() => {
    const groups = {}
    for (const mod of modules) {
      if (mod.code === 'roleAccess') continue
      const g = mod.group || 'Other'
      if (!groups[g]) groups[g] = []
      groups[g].push(mod)
    }
    return groups
  }, [modules])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [modRes, roleRes] = await Promise.all([getRbacModules(), getRbacRoles()])
        if (cancelled) return
        setModules(modRes.modules || [])
        const roleList = roleRes.roles || []
        setRoles(roleList)
        const first = roleList.find((r) => !LOCKED_ROLES.has(r.role))?.role || roleList[0]?.role || ''
        setSelectedRole(first)
      } catch (err) {
        if (!cancelled) setError(apiError(err) || err.message || 'Could not load access settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedRole || !roleRow) return
    setEnabled([...(roleRow.modules || [])])
    setDefaultRoute(remapDefaultRoute(roleRow.defaultRoute || '/ops/dashboard'))
  }, [selectedRole, roleRow])

  useEffect(() => {
    if (routeOptions.some((o) => o.value === defaultRoute)) return
    setDefaultRoute(routeOptions[0]?.value || '/')
  }, [routeOptions, defaultRoute])

  function toggleModule(code) {
    if (locked) return
    setEnabled((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  function setGroupAll(codes, on) {
    if (locked) return
    setEnabled((prev) => {
      const set = new Set(prev)
      for (const code of codes) {
        if (on) set.add(code)
        else set.delete(code)
      }
      return [...set]
    })
  }

  async function onSave() {
    if (!selectedRole || locked) return
    setSaving(true)
    setError('')
    try {
      const res = await updateRbacRole(selectedRole, { modules: enabled, defaultRoute })
      const updated = res.role
      setRoles((prev) => prev.map((r) => (r.role === updated.role ? updated : r)))
      message.success(`Access settings saved for “${selectedRole}”. They will see the changes next time they log in.`)
    } catch (err) {
      const msg = apiError(err) || err.message || 'Could not save — please try again'
      setError(msg)
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = enabled.length
  const totalModules = modules.filter((m) => m.code !== 'roleAccess').length

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280 }}>
        <Space direction="vertical" align="center" size={12}>
          <Spin size="large" style={{ color: '#1B8A5A' }} />
          <Text type="secondary">Loading access settings…</Text>
        </Space>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#0F1B2D' }}>
            Staff Access Settings
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Damien RBAC: choose which modules each job role can use, and where they land after login.
            Assign people to roles under{' '}
            <Link to="/ops/admin/users">Staff Users</Link>.
          </Text>
        </div>
        <Space>
          <Link to="/ops/admin/users">
            <Button>Staff Users</Button>
          </Link>
          <Tag icon={<SafetyCertificateOutlined />} color="success" style={{ borderColor: '#1B8A5A', color: '#1B8A5A' }}>
            RBAC Control Tower
          </Tag>
        </Space>
      </div>

      {error ? (
        <Alert type="error" showIcon message="Could not complete request" description={error} closable onClose={() => setError('')} />
      ) : null}

      <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: 16 } }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text strong style={{ color: '#0F1B2D', fontSize: 14 }}>
              Who are you setting up?
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Select a job role to review or edit module permissions.
              </Text>
            </div>
          </div>

          <Select
            showSearch
            optionFilterProp="label"
            value={selectedRole || undefined}
            onChange={setSelectedRole}
            placeholder="Select a role"
            style={{ width: '100%', maxWidth: 420 }}
            options={roles.map((r) => {
              const isLocked = LOCKED_ROLES.has(r.role) || r.locked
              return {
                value: r.role,
                label: r.role,
                disabled: false,
                searchLabel: r.role,
                isLocked,
                moduleCount: (r.modules || []).length,
              }
            })}
            optionRender={(option) => (
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space size={8}>
                  {option.data.isLocked ? (
                    <LockOutlined style={{ color: '#6B7280' }} />
                  ) : (
                    <UserOutlined style={{ color: '#1B8A5A' }} />
                  )}
                  <span>{option.data.label}</span>
                </Space>
                {option.data.isLocked ? (
                  <Tag>Protected</Tag>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {option.data.moduleCount} area{option.data.moduleCount === 1 ? '' : 's'}
                  </Text>
                )}
              </Space>
            )}
          />

          {selectedRole ? (
            <Paragraph style={{ margin: 0, fontSize: 13, color: '#5B6B7C' }}>
              {ROLE_HINTS[selectedRole] || 'Configure module access below.'}
            </Paragraph>
          ) : null}
        </Space>
      </Card>

      {locked ? (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          message={`${selectedRole} is protected`}
          description="This role always has full access to protect system security. Permissions cannot be changed and save is disabled."
        />
      ) : (
        <>
          {!isSuperAdmin ? (
            <Alert
              type="info"
              showIcon
              message="View only"
              description="Only Super Admin can save Role Access changes. You can review the matrix, then ask a Super Admin to apply updates."
            />
          ) : null}
          <Card
            size="small"
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: 16 } }}
            title={
              <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <div>
                  <Text strong style={{ color: '#0F1B2D' }}>
                    What can they use?
                  </Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      Turn on each part of the system this role should see in the menu.
                    </Text>
                  </div>
                </div>
                <Tag color="processing">
                  <strong>{enabledCount}</strong> of {totalModules} areas on
                </Tag>
              </Space>
            }
          >
            {Object.entries(groupedModules).map(([group, items], idx) => {
              const gMeta = GROUP_META[group] || GROUP_META.Other
              const GroupIcon = gMeta.icon
              const codes = items.map((i) => i.code)
              const groupOn = codes.filter((c) => enabled.includes(c)).length
              const allOn = groupOn === codes.length

              return (
                <div key={group}>
                  {idx > 0 ? <Divider style={{ margin: '16px 0' }} /> : null}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <Space align="start" size={8}>
                      <GroupIcon style={{ color: '#1B8A5A', fontSize: 16, marginTop: 2 }} />
                      <div>
                        <Text strong style={{ color: '#0F1B2D' }}>
                          {group}
                        </Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {gMeta.subtitle}
                          </Text>
                        </div>
                      </div>
                    </Space>
                    <Space size={8}>
                      <Button size="small" onClick={() => setGroupAll(codes, true)} disabled={locked || allOn}>
                        Allow all
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setGroupAll(codes, false)}
                        disabled={locked || groupOn === 0}
                      >
                        Remove all
                      </Button>
                    </Space>
                  </div>

                  <Row gutter={[12, 12]}>
                    {items.map((mod) => {
                      const meta = MODULE_META[mod.code] || { icon: AppstoreOutlined, hint: mod.label }
                      const ModIcon = meta.icon
                      const on = enabled.includes(mod.code)
                      return (
                        <Col key={mod.code} xs={24} sm={12} lg={8}>
                          <Card
                            size="small"
                            hoverable={!locked}
                            onClick={() => toggleModule(mod.code)}
                            style={{
                              borderRadius: 8,
                              borderColor: on ? '#1B8A5A' : undefined,
                              background: on ? 'rgba(27, 138, 90, 0.04)' : undefined,
                              cursor: locked ? 'not-allowed' : 'pointer',
                              height: '100%',
                            }}
                            styles={{ body: { padding: 12 } }}
                          >
                            <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Space align="start" size={10}>
                                <ModIcon style={{ color: on ? '#1B8A5A' : '#6B7280', fontSize: 18, marginTop: 2 }} />
                                <div>
                                  <Text strong style={{ color: '#0F1B2D', display: 'block' }}>
                                    {mod.label}
                                  </Text>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {meta.hint}
                                  </Text>
                                </div>
                              </Space>
                              <Checkbox
                                checked={on}
                                disabled={locked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleModule(mod.code)}
                              />
                            </Space>
                          </Card>
                        </Col>
                      )
                    })}
                  </Row>

                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    {groupOn} of {codes.length} allowed in this section
                    {allOn ? ' · all on' : ''}
                  </Text>
                </div>
              )
            })}
          </Card>

          <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: 16 } }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Text strong style={{ color: '#0F1B2D', fontSize: 14 }}>
                  Where should they land after login?
                </Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Pick the first screen they see — usually the dashboard or their main work area.
                  </Text>
                </div>
              </div>

              <Select
                value={defaultRoute}
                onChange={setDefaultRoute}
                disabled={locked}
                style={{ width: '100%', maxWidth: 480 }}
                options={routeOptions.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                  desc: opt.desc,
                }))}
                optionRender={(option) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#0F1B2D' }}>{option.data.label}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {option.data.desc}
                    </Text>
                  </div>
                )}
              />
            </Space>
          </Card>

          <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: 16 } }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12, margin: 0 }}>
                Changes apply to everyone with the <Text strong>{selectedRole}</Text> role after they sign in again.
              </Text>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={saving}
                disabled={locked || !isSuperAdmin || enabled.length === 0}
                onClick={onSave}
                style={brandPrimary}
              >
                Save access for {selectedRole}
              </Button>
            </div>
          </Card>
        </>
      )}

      <Card
        size="small"
        style={{ borderRadius: 8 }}
        styles={{ body: { padding: 16 } }}
        title={
          <Space>
            <KeyOutlined style={{ color: '#1B8A5A' }} />
            <span style={{ color: '#0F1B2D' }}>Try it: demo logins</span>
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
          Log out, then sign in as one of these users to see what each role experiences. Password for all:{' '}
          <Text strong code>
            admin123
          </Text>
        </Paragraph>
        <Table
          size="small"
          pagination={false}
          rowKey="user"
          dataSource={DEMO_LOGINS}
          columns={[
            {
              title: 'Job role',
              dataIndex: 'role',
              key: 'role',
              render: (v) => <Text strong style={{ color: '#0F1B2D' }}>{v}</Text>,
            },
            {
              title: 'Username',
              dataIndex: 'user',
              key: 'user',
              render: (v) => <Tag icon={<ApartmentOutlined />}>{v}</Tag>,
            },
            {
              title: 'Good for testing',
              dataIndex: 'note',
              key: 'note',
              render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
            },
          ]}
        />
      </Card>
    </div>
  )
}
