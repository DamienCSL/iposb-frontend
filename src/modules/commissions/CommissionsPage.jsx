import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  apiError,
  getCommissionConfig,
  listCommissions,
  listPartnerWallets,
  requestPartnerWalletWithdrawal,
  saveCommissionConfig,
  verifyCommission,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import StatusTag from '../../components/StatusTag'

const { Title, Text, Paragraph } = Typography

export default function CommissionsPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const pathTab = location.pathname.includes('/partner-wallets')
    ? 'wallets'
    : location.pathname.includes('/config')
      ? 'config'
      : null
  const activeTab = pathTab || params.get('tab') || 'ledger' // 'ledger' | 'config' | 'wallets'
  const { can, isAdmin, user } = useAuth()
  const canVerify = isAdmin // Super Admin & Admin only per RBAC table

  function selectTab(k) {
    if (k === 'wallets') {
      navigate('/ops/partner-wallets')
      return
    }
    if (k === 'config') {
      navigate('/ops/commissions/config')
      return
    }
    navigate('/ops/commissions')
    setParams({})
  }

  const [loading, setLoading] = useState(false)
  const [ledgerRows, setLedgerRows] = useState([])
  const [wallets, setWallets] = useState([])
  const [config, setConfig] = useState(null)
  const [configSaving, setConfigSaving] = useState(false)
  const [configForm] = Form.useForm()

  // Withdrawal Request Modal
  const [withdrawModal, setWithdrawModal] = useState({ open: false, wallet: null })
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)
  const [withdrawForm] = Form.useForm()

  // Check if current day of month is in valid withdrawal window (days 1-5 and 15-19)
  const currentDay = new Date().getDate()
  const isWithdrawalWindow = (currentDay >= 1 && currentDay <= 5) || (currentDay >= 15 && currentDay <= 19)

  async function loadData() {
    setLoading(true)
    try {
      const [commRes, walRes, cfgRes] = await Promise.all([
        listCommissions().catch(() => ({ data: [] })),
        listPartnerWallets().catch(() => ({ data: [] })),
        getCommissionConfig().catch(() => ({ data: {} })),
      ])
      setLedgerRows(commRes?.data || commRes?.commissions || commRes?.rows || [])
      setWallets(walRes?.data || walRes?.wallets || walRes?.rows || [])
      const cfg = cfgRes?.data || cfgRes?.config || cfgRes || {}
      setConfig(cfg)
      configForm.setFieldsValue({
        default_rate_pct: cfg.default_rate_pct || cfg.rate || 5,
        min_payout_amount: cfg.min_payout_amount || 50,
        payout_terms_days: cfg.payout_terms_days || 14,
      })
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Verify Commission (Admin only with 403 safety)
  async function handleVerify(id) {
    try {
      await verifyCommission(id)
      message.success('Commission payout verified and locked')
      loadData()
    } catch (err) {
      message.error(apiError(err))
    }
  }

  // Save Commission Config
  async function handleSaveConfig(values) {
    setConfigSaving(true)
    try {
      await saveCommissionConfig(values)
      message.success('Commission rates updated successfully')
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setConfigSaving(false)
    }
  }

  // Submit Withdrawal Request
  async function handleWithdrawSubmit(values) {
    setWithdrawSubmitting(true)
    try {
      await requestPartnerWalletWithdrawal({
        partner_id: withdrawModal.wallet?.partner_id || withdrawModal.wallet?.id,
        ...values,
      })
      message.success('Withdrawal request submitted for review')
      setWithdrawModal({ open: false, wallet: null })
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setWithdrawSubmitting(false)
    }
  }

  const ledgerColumns = [
    {
      title: 'Ref / Record #',
      dataIndex: 'ref_no',
      key: 'ref_no',
      render: (v, r) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1B8A5A' }}>
          {v || `COMM-${r.id || '00'}`}
        </span>
      ),
    },
    {
      title: 'Partner / Agent',
      dataIndex: 'partner_name',
      key: 'partner_name',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || r.agent_name || 'Agent'}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{r.partner_code || r.agent_cd || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Source CN',
      dataIndex: 'cn_no',
      key: 'cn_no',
      render: (v) => v || 'Monthly Consolidated',
    },
    {
      title: 'Commission (RM)',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v) => <strong style={{ color: '#0F1B2D' }}>RM {Number(v || 0).toFixed(2)}</strong>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <StatusTag status={v || 'PENDING'} />,
    },
    {
      title: 'Verification',
      key: 'verify',
      align: 'right',
      render: (_, r) => {
        const isVerified = r.status === 'VERIFIED' || r.is_verified
        if (isVerified) {
          return <Tag color="green" icon={<CheckCircleOutlined />}>Verified</Tag>
        }
        return canVerify ? (
          <Popconfirm
            title="Verify this commission item?"
            description="Verification locks the transaction and queues it for the partner's wallet withdrawal."
            onConfirm={() => handleVerify(r.id)}
            okText="Verify"
          >
            <Button size="small" type="primary" style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}>
              Verify
            </Button>
          </Popconfirm>
        ) : (
          <Tag color="default">Pending Admin Review</Tag>
        )
      },
    },
  ]

  const walletColumns = [
    {
      title: 'Partner Code',
      dataIndex: 'partner_code',
      key: 'partner_code',
      render: (v) => <Tag color="blue">{v || 'AGENT'}</Tag>,
    },
    {
      title: 'Partner Name',
      dataIndex: 'partner_name',
      key: 'partner_name',
      render: (v) => <strong>{v}</strong>,
    },
    {
      title: 'Available Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (v) => <strong style={{ color: '#1B8A5A', fontSize: 14 }}>RM {Number(v || 0).toFixed(2)}</strong>,
    },
    {
      title: 'Pending Clearance',
      dataIndex: 'pending_balance',
      key: 'pending_balance',
      align: 'right',
      render: (v) => `RM ${Number(v || 0).toFixed(2)}`,
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, r) => (
        <Button
          size="small"
          disabled={!isWithdrawalWindow || Number(r.balance || 0) < 50}
          onClick={() => {
            withdrawForm.resetFields()
            withdrawForm.setFieldsValue({ amount: r.balance })
            setWithdrawModal({ open: true, wallet: r })
          }}
        >
          Review Withdrawal
        </Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0F1B2D', letterSpacing: '-0.3px' }}>
            Commissions & Partner Wallets
          </h2>
          <div style={{ fontSize: 12, color: '#5B6B7C', marginTop: 2 }}>
            Agent commission ledgers, verification controls, rate matrix, and withdrawal windows.
          </div>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Withdrawal Window Notice Banner */}
      {!isWithdrawalWindow ? (
        <Alert
          type="info"
          showIcon
          message="Partner Withdrawal Window Closed"
          description={`Per IPOSB financial policy, partner wallet withdrawals can only be processed during the 1st–5th and 15th–19th of each calendar month. (Today is day ${currentDay}). Withdrawal action is currently locked.`}
        />
      ) : (
        <Alert
          type="success"
          showIcon
          message="Withdrawal Window Active"
          description={`Partner withdrawal window is currently open (active until day ${currentDay <= 5 ? 5 : 19}). Verified balances can be disbursed.`}
        />
      )}

      {/* Tabs */}
      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={selectTab}
          items={[
            {
              key: 'ledger',
              label: (
                <Space>
                  <HistoryOutlined />
                  <span>Commission Ledger</span>
                </Space>
              ),
              children: (
                <DataTable
                  columns={ledgerColumns}
                  dataSource={ledgerRows}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: 'No commission ledger items recorded' }}
                />
              ),
            },
            {
              key: 'wallets',
              label: (
                <Space>
                  <WalletOutlined />
                  <span>Partner Wallets ({wallets.length})</span>
                </Space>
              ),
              children: (
                <DataTable
                  columns={walletColumns}
                  dataSource={wallets}
                  rowKey="partner_code"
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: 'No partner wallets found' }}
                />
              ),
            },
            {
              key: 'config',
              label: (
                <Space>
                  <SettingOutlined />
                  <span>Rate Configuration</span>
                </Space>
              ),
              children: (
                <div style={{ maxWidth: 540, padding: '12px 0' }}>
                  <Form form={configForm} layout="vertical" onFinish={handleSaveConfig}>
                    <Form.Item
                      label="Standard Agent Commission Rate (%)"
                      name="default_rate_pct"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      label="Minimum Wallet Withdrawal Threshold (RM)"
                      name="min_payout_amount"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} prefix="RM" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      label="Standard Payout Terms (Days)"
                      name="payout_terms_days"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} addonAfter="days" style={{ width: '100%' }} />
                    </Form.Item>

                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={configSaving}
                      disabled={!canVerify}
                      style={{ background: '#1B8A5A', borderColor: '#1B8A5A', marginTop: 8 }}
                    >
                      Save Configuration
                    </Button>
                    {!canVerify && (
                      <div style={{ fontSize: 12, color: '#D97706', marginTop: 6 }}>
                        * Only Administrators can modify commission calculation policies.
                      </div>
                    )}
                  </Form>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Withdrawal Review Modal */}
      <Modal
        title={`Process Withdrawal — ${withdrawModal.wallet?.partner_name}`}
        open={withdrawModal.open}
        onCancel={() => setWithdrawModal({ open: false, wallet: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={withdrawForm} layout="vertical" onFinish={handleWithdrawSubmit}>
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Partner Code">{withdrawModal.wallet?.partner_code}</Descriptions.Item>
            <Descriptions.Item label="Available Balance">RM {withdrawModal.wallet?.balance}</Descriptions.Item>
            <Descriptions.Item label="Bank Account">{withdrawModal.wallet?.bank_account || 'Maybank ****1289'}</Descriptions.Item>
          </Descriptions>

          <Form.Item
            label="Withdrawal Amount (RM)"
            name="amount"
            rules={[{ required: true, message: 'Specify withdrawal amount' }]}
          >
            <InputNumber
              min={50}
              max={Number(withdrawModal.wallet?.balance || 0)}
              prefix="RM"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="Bank Transaction Ref" name="bank_ref" rules={[{ required: true }]}>
            <Input placeholder="e.g. IBFT-2026-908123" />
          </Form.Item>

          <Form.Item label="Internal Note" name="note">
            <Input.TextArea rows={2} placeholder="Optional audit memo" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button onClick={() => setWithdrawModal({ open: false, wallet: null })}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={withdrawSubmitting}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              Confirm Disbursal
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
