import React, { useEffect, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Tabs,
  Typography,
  message,
} from 'antd'
import DataTable from '../../components/DataTable'
import {
  CarOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import {
  apiError,
  assign3pl,
  assignDriver,
  get3plPartners,
  getDispatchDrivers,
  getTracking,
  getUncoveredJobs,
  listConsignments,
  planDispatch,
} from '../../api/client'
import StatusTag from '../../components/StatusTag'

const { Title, Text } = Typography

export default function DispatchPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') || 'assign'

  // Data states
  const [drivers, setDrivers] = useState([])
  const [partners, setPartners] = useState([])
  const [pendingCns, setPendingCns] = useState([])
  const [uncoveredJobs, setUncoveredJobs] = useState([])
  const [loading, setLoading] = useState(false)

  // Selection & Assignment state
  const [selectedCn, setSelectedCn] = useState(null)
  const [selectedDriverId, setSelectedDriverId] = useState(null)
  const [selectedPartnerId, setSelectedPartnerId] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [driverSearch, setDriverSearch] = useState('')

  async function loadAll() {
    setLoading(true)
    try {
      const [drvRes, partRes, cnRes, uncRes] = await Promise.all([
        getDispatchDrivers().catch(() => []),
        get3plPartners().catch(() => []),
        listConsignments({ cn_status: 'ACC', page: 1 }).catch(() => ({ rows: [] })),
        getUncoveredJobs().catch(() => ({ jobs: [] })),
      ])
      setDrivers(drvRes || [])
      setPartners(partRes || [])
      setPendingCns(cnRes.rows || [])
      setUncoveredJobs(uncRes.jobs || [])
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Assign Driver Action
  async function handleAssignDriver(cnNo, drvId) {
    if (!cnNo || !drvId) {
      message.warning('Please select both a shipment and a driver')
      return
    }
    setAssigning(true)
    try {
      const res = await assignDriver({
        cnNo,
        driverId: drvId,
        jobType: 'delivery',
      })
      message.success(res.message || `Assigned ${cnNo} to driver`)
      setSelectedCn(null)
      loadAll()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setAssigning(false)
    }
  }

  // Assign 3PL Partner Action
  async function handleAssign3pl(cnNo, partId) {
    if (!cnNo || !partId) {
      message.warning('Please select a 3PL partner')
      return
    }
    setAssigning(true)
    try {
      const res = await assign3pl({ cnNo, partnerId: partId })
      message.success(res.message || `Assigned ${cnNo} to 3PL partner`)
      loadAll()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setAssigning(false)
    }
  }

  // Filter available drivers by search
  const filteredDrivers = drivers.filter(
    (d) =>
      !driverSearch ||
      (d.fullName || d.name || '').toLowerCase().includes(driverSearch.toLowerCase()) ||
      (d.phone || '').includes(driverSearch) ||
      (d.branchCode || '').toLowerCase().includes(driverSearch.toLowerCase()),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Module Title Header */}
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
            Dispatch & Fleet Control
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Allocate shipments to mobile couriers, coordinate linehaul transit, and offload 3PL remote routes.
          </Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setParams({ tab: k })}
        items={[
          {
            key: 'assign',
            label: (
              <span>
                <CarOutlined style={{ marginRight: 6 }} />
                Jobs (Driver Assignment)
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                {/* Left Column: Pending Orders (60%) */}
                <Col xs={24} lg={14}>
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: 8,
                      overflow: 'hidden',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #F3F4F6',
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#0F1B2D',
                      }}
                    >
                      Pending Pickups & Dispatches ({pendingCns.length})
                    </div>
                    <DataTable
                      cardStyle={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}
                      rowKey="cn_no"
                      dataSource={pendingCns}
                      loading={loading}
                      pagination={{ pageSize: 12 }}
                      onRow={(record) => ({
                        onClick: () => setSelectedCn(record),
                        style: {
                          cursor: 'pointer',
                          background: selectedCn?.cn_no === record.cn_no ? '#F0FBF6' : undefined,
                        },
                      })}
                      columns={[
                        {
                          title: 'CN Number',
                          dataIndex: 'cn_no',
                          key: 'cn_no',
                          render: (v) => (
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                              {v}
                            </span>
                          ),
                        },
                        {
                          title: 'Customer',
                          dataIndex: 'cust_name',
                          key: 'cust_name',
                          render: (v, r) => v || r.cust_ac_no || '—',
                        },
                        {
                          title: 'Route',
                          key: 'route',
                          render: (_, r) => `${r.cn_origin || '—'} → ${r.cn_dstn || '—'}`,
                        },
                        {
                          title: 'Status',
                          dataIndex: 'cn_status',
                          key: 'cn_status',
                          render: (v) => <StatusTag status={v} />,
                        },
                        {
                          title: 'Select',
                          key: 'sel',
                          render: (_, r) => (
                            <Radio checked={selectedCn?.cn_no === r.cn_no} />
                          ),
                        },
                      ]}
                      locale={{
                        emptyText: 'No pending shipments awaiting driver assignment',
                      }}
                    />
                  </div>
                </Col>

                {/* Right Column: Active Driver Roster & Quick Assign (40%) */}
                <Col xs={24} lg={10}>
                  <Card
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          Available Drivers ({drivers.length})
                        </span>
                        {selectedCn && (
                          <StatusTag
                            status="ASSIGNED"
                            text={`Target: ${selectedCn.cn_no}`}
                            color="#1B8A5A"
                          />
                        )}
                      </div>
                    }
                    size="small"
                    style={{ borderRadius: 6, borderColor: '#E5E7EB' }}
                  >
                    <Input
                      placeholder="Search driver by name, phone, branch…"
                      value={driverSearch}
                      onChange={(e) => setDriverSearch(e.target.value)}
                      prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
                      style={{ marginBottom: 12 }}
                      allowClear
                    />

                    {selectedCn ? (
                      <Alert
                        message={`Assigning Consignment ${selectedCn.cn_no}`}
                        description={`Origin: ${selectedCn.cn_origin} | Dest: ${selectedCn.cn_dstn} | Click "Assign" next to any driver below.`}
                        type="info"
                        showIcon
                        style={{ marginBottom: 12 }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#6B7280',
                          padding: '6px 0 12px',
                        }}
                      >
                        👉 Select a consignment from the left list to enable direct driver assignment.
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
                      {filteredDrivers.map((drv, idx) => (
                        <div
                          key={drv.id || drv.uid || drv.username || `drv-${idx}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: '#F9FAFB',
                            borderRadius: 6,
                            border: '1px solid #E5E7EB',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar
                              size="small"
                              style={{ backgroundColor: '#1B8A5A' }}
                              icon={<UserOutlined />}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#1F2937' }}>
                                {drv.fullName || drv.name || drv.username}
                              </div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>
                                <PhoneOutlined style={{ marginRight: 4 }} />
                                {drv.phone || 'No phone'} · {drv.branchCode || 'KUL'}
                              </div>
                            </div>
                          </div>

                          <Button
                            size="small"
                            type="primary"
                            disabled={!selectedCn}
                            loading={assigning}
                            style={{
                              background: selectedCn ? '#1B8A5A' : undefined,
                              borderColor: selectedCn ? '#1B8A5A' : undefined,
                            }}
                            onClick={() => handleAssignDriver(selectedCn.cn_no, drv.id || drv.uid)}
                          >
                            Assign
                          </Button>
                        </div>
                      ))}

                      {filteredDrivers.length === 0 && (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No available drivers found" />
                      )}
                    </div>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'remote',
            label: (
              <span>
                <GlobalOutlined style={{ marginRight: 6 }} />
                3PL Partners (Remote Pickup) ({uncoveredJobs.length})
              </span>
            ),
            children: (
              <DataTable
                dataSource={uncoveredJobs}
                rowKey="cn_no"
                loading={loading}
                columns={[
                  {
                    title: 'CN Number',
                    dataIndex: 'cn_no',
                    key: 'cn_no',
                    render: (v) => (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{v}</span>
                    ),
                  },
                  { title: 'Customer', dataIndex: 'cust_name', key: 'cust_name' },
                  {
                    title: 'Coverage Status',
                    dataIndex: 'pickup_owner_type',
                    key: 'pickup_owner_type',
                    render: (v) => <StatusTag status={v || 'UNCOVERED'} text={v || 'Uncovered'} />,
                  },
                  {
                    title: 'Assign 3PL Partner',
                    key: 'assign_3pl',
                    render: (_, r) => (
                      <Space>
                        <Select
                          placeholder="Select 3PL Partner"
                          style={{ width: 180 }}
                          onChange={(pId) => handleAssign3pl(r.cn_no, pId)}
                          options={partners.map((p) => ({
                            label: p.name || p.partner_name,
                            value: p.id,
                          }))}
                        />
                      </Space>
                    ),
                  },
                ]}
                locale={{ emptyText: 'No uncovered remote jobs currently pending' }}
              />
            ),
          },
          {
            key: 'drivers',
            label: (
              <span>
                <UserOutlined style={{ marginRight: 6 }} />
                Drivers (Driver Roster) ({drivers.length})
              </span>
            ),
            children: (
              <DataTable
                dataSource={drivers}
                rowKey="id"
                loading={loading}
                columns={[
                  { title: 'ID / Code', dataIndex: 'id', key: 'id', width: 90 },
                  {
                    title: 'Full Name',
                    dataIndex: 'fullName',
                    key: 'fullName',
                    render: (v, r) => (
                      <span style={{ fontWeight: 600 }}>{v || r.name || r.username}</span>
                    ),
                  },
                  { title: 'Phone', dataIndex: 'phone', key: 'phone' },
                  { title: 'Branch', dataIndex: 'branchCode', key: 'branchCode' },
                  {
                    title: 'Status',
                    key: 'status',
                    render: () => <StatusTag status="ACTIVE" text="Available" />,
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
