import React, { useEffect, useState } from 'react'
import { Alert, Card, Skeleton, Table, Typography, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { apiError, getCancellationConfig } from '../api/client'
import { money } from '../ui/bits'

const { Title, Text } = Typography

export default function CancellationPolicyPage() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getCancellationConfig()
      .then(setConfig)
      .catch((err) => message.error(apiError(err)))
      .finally(() => setLoading(false))
  }, [])

  const columns = [
    { title: 'Parcel stage', dataIndex: 'label', key: 'label' },
    {
      title: 'Processing fee',
      dataIndex: 'feePct',
      key: 'feePct',
      width: 140,
      render: (v) => <Text strong>{v}%</Text>,
    },
  ]

  const locked = config?.feesLocked !== false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Title level={4} style={{ margin: 0, color: '#0F1B2D' }}>Cancellation & Processing Fees</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Live fee tiers loaded from the backend. Percentages are fixed by policy and cannot be edited in the UI.
        </Text>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          <Alert
            type={locked ? 'warning' : 'info'}
            showIcon
            icon={locked ? <LockOutlined /> : undefined}
            message={locked ? 'Fee tiers are locked' : 'Fee configuration'}
            description={
              locked
                ? 'The API rejects updates to processing-fee percentages (403). This page is read-only by design — change requires a product/policy decision and backend unlock.'
                : 'Configuration can be updated via PUT /ops/billing/cancellation-config.'
            }
          />

          <Card size="small" styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="tier"
              size="small"
              pagination={false}
              columns={columns}
              dataSource={config?.tiers || []}
            />
          </Card>

          <Card size="small" title="Policy">
            <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 13, lineHeight: 1.7 }}>
              <li>Customers may request cancellation after pickup or drop-off at a service point.</li>
              <li>
                <Text strong>Blocked:</Text> once the parcel is in transit or handed to the courier for delivery.
              </li>
              <li>After deducting the processing fee, the remaining amount is refunded to the customer wallet.</li>
              <li>All cancellations are recorded in the audit log with fee, refund, and credit note references.</li>
              <li>
                <Text strong>Not for address changes.</Text> To change the delivery address, create a new order/CN.
              </li>
              <li>
                At the 0% tier, the parcel is still at the service point — the customer may self-collect instead of cancelling.
              </li>
              {config?.refundToWalletDefault != null && (
                <li>Default refund to wallet: <Text strong>{config.refundToWalletDefault ? 'Yes' : 'No'}</Text></li>
              )}
              {config?.requiresApproval != null && (
                <li>Requires approval workflow: <Text strong>{config.requiresApproval ? 'Yes' : 'No'}</Text></li>
              )}
            </ul>
          </Card>

          <Alert
            type="info"
            showIcon
            message={`Example: RM 100 order at 30% tier → processing fee ${money(30)}, wallet refund ${money(70)}.`}
          />
        </>
      )}
    </div>
  )
}
